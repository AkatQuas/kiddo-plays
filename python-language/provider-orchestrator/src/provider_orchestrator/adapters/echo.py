"""
Echo product adapter — stand-in for any real product capability.

Swap this for an official HTTP client, SDK, or internal service without
changing the dispatcher / key / pool layers.
"""

from __future__ import annotations

import asyncio

from provider_orchestrator.ports.product import ProductAdapter, ProductRequest, ProductResult


class EchoAdapter(ProductAdapter):
    def __init__(self, name: str = "echo", latency_ms: float = 5.0) -> None:
        self.name = name
        self.latency_ms = latency_ms

    async def execute(self, request: ProductRequest, credential: str) -> ProductResult:
        await asyncio.sleep(self.latency_ms / 1000.0)
        suffix = credential[-4:] if credential else "none"
        return ProductResult(
            ok=True,
            provider=self.name,
            items=[
                {
                    "title": f"[{self.name}] {request.query}",
                    "credential_suffix": suffix,
                    "params": dict(request.params),
                }
            ],
            raw={"echo": True},
        )
