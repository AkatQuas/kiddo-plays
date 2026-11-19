"""
Key registry — round-robin selection among quota-available credentials.

Management architecture entry point for provider credentials.
"""

from __future__ import annotations

from threading import Lock
from typing import Optional

from provider_orchestrator.keys.models import ProviderKey
from provider_orchestrator.ports.keystore import KeyStorePort


class KeyRegistry:
    def __init__(self, store: KeyStorePort) -> None:
        self.store = store
        self._rr: dict[str, int] = {}
        self._lock = Lock()

    def add(
        self,
        *,
        platform: str,
        access_key: str,
        name: str = "",
        hour_limit: int | None = 100,
        month_limit: int | None = 5000,
        active: bool = True,
    ) -> ProviderKey:
        key = ProviderKey.create(
            platform=platform,
            access_key=access_key,
            name=name,
            hour_limit=hour_limit,
            month_limit=month_limit,
        )
        key.active = active
        return self.store.upsert(key)

    def list(self, platform: str | None = None) -> list[ProviderKey]:
        return self.store.list_keys(platform)

    def pick(self, platform: str) -> Optional[ProviderKey]:
        """Round-robin among currently available keys for a platform."""
        candidates = [
            k for k in self.store.list_keys(platform) if k.is_available()
        ]
        if not candidates:
            return None
        with self._lock:
            idx = self._rr.get(platform, 0) % len(candidates)
            self._rr[platform] = idx + 1
        return candidates[idx]

    def mark_used(self, key_id: str) -> None:
        self.store.increment_usage(key_id)

    def set_active(self, key_id: str, active: bool) -> Optional[ProviderKey]:
        key = self.store.get(key_id)
        if not key:
            return None
        key.active = active
        return self.store.upsert(key)

    def remove(self, key_id: str) -> bool:
        return self.store.delete(key_id)

    def quota_snapshot(self) -> list[dict]:
        return [k.public_view() for k in self.store.list_keys()]
