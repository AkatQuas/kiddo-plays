"""
Dispatcher — layered scheduling pattern:

  1. cache lookup (product-agnostic key)
  2. ordered platform walk + KeyRegistry round-robin
  3. optional fallback adapter when live providers fail / exhaust quota

Product adapters are injected; the dispatcher never embeds product logic.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Optional, Sequence

from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.ports.cache import CachePort
from provider_orchestrator.ports.product import ProductAdapter, ProductRequest, ProductResult

log = logging.getLogger("provider_orchestrator.scheduler")


@dataclass
class DispatchResult:
    result: ProductResult
    attempts: list[str]


class Dispatcher:
    def __init__(
        self,
        *,
        adapters: Sequence[ProductAdapter],
        registry: KeyRegistry,
        cache: CachePort | None = None,
        fallback: ProductAdapter | None = None,
        platform_order: Sequence[str] | None = None,
        cache_ttl_seconds: int = 86_400,
    ) -> None:
        if not adapters and not fallback:
            raise ValueError("at least one adapter or fallback is required")
        self.adapters = {a.name: a for a in adapters}
        self.registry = registry
        self.cache = cache
        self.fallback = fallback
        self.platform_order = list(platform_order or [a.name for a in adapters])
        self.cache_ttl_seconds = cache_ttl_seconds

    @staticmethod
    def cache_key(request: ProductRequest) -> str:
        payload = {"query": request.query, **request.params}
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    async def dispatch(self, request: ProductRequest) -> DispatchResult:
        attempts: list[str] = []

        # --- layer 1: cache ---
        if self.cache is not None:
            ck = self.cache_key(request)
            cached = self.cache.get(ck)
            if isinstance(cached, dict) and cached.get("items") is not None:
                attempts.append("cache:hit")
                return DispatchResult(
                    result=ProductResult(
                        ok=True,
                        provider=str(cached.get("provider", "cache")),
                        items=list(cached.get("items") or []),
                        raw=cached.get("raw"),
                        from_cache=True,
                    ),
                    attempts=attempts,
                )
            attempts.append("cache:miss")

        # --- layer 2: live providers ---
        for platform in self.platform_order:
            adapter = self.adapters.get(platform)
            if not adapter:
                continue
            key = self.registry.pick(platform)
            if not key:
                attempts.append(f"{platform}:no-key")
                continue
            attempts.append(f"{platform}:try:{key.key_id}")
            try:
                result = await adapter.execute(request, key.access_key)
            except Exception as exc:  # noqa: BLE001 — surface as soft fail & continue
                log.warning("adapter %s failed: %s", platform, exc)
                attempts.append(f"{platform}:error")
                continue

            self.registry.mark_used(key.key_id)
            if result.ok and result.items:
                if self.cache is not None:
                    self.cache.set(
                        self.cache_key(request),
                        {
                            "provider": result.provider or platform,
                            "items": result.items,
                            "raw": result.raw,
                        },
                        ttl_seconds=self.cache_ttl_seconds,
                    )
                attempts.append(f"{platform}:ok")
                return DispatchResult(result=result, attempts=attempts)

            attempts.append(f"{platform}:empty")

        # --- layer 3: fallback ---
        if self.fallback is not None:
            attempts.append(f"fallback:{self.fallback.name}")
            try:
                fb = await self.fallback.execute(request, credential="")
                fb.from_fallback = True
                return DispatchResult(result=fb, attempts=attempts)
            except Exception as exc:  # noqa: BLE001
                log.warning("fallback failed: %s", exc)
                attempts.append("fallback:error")

        return DispatchResult(
            result=ProductResult(
                ok=False,
                provider="none",
                error="all providers exhausted",
            ),
            attempts=attempts,
        )
