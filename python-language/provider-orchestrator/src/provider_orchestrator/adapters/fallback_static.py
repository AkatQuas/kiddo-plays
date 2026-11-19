"""Static fallback adapter — models a secondary retrieval path."""

from __future__ import annotations

from provider_orchestrator.ports.product import ProductAdapter, ProductRequest, ProductResult


class StaticFallbackAdapter(ProductAdapter):
    name = "static-fallback"

    def __init__(self, items: list[dict] | None = None) -> None:
        self._items = items or [
            {"title": "fallback-item", "note": "served when live providers exhaust"},
        ]

    async def execute(self, request: ProductRequest, credential: str) -> ProductResult:
        return ProductResult(
            ok=True,
            provider=self.name,
            items=[{"query": request.query, **it} for it in self._items],
            from_fallback=True,
        )
