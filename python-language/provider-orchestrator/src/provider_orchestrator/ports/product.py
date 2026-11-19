"""
Product adapter port.

Concrete product capabilities (search, retrieval, domain APIs, …) plug in here.
The orchestrator only depends on this contract — products are replaceable.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ProductRequest:
    """Normalized inbound request. Extra fields stay in `params`."""

    query: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProductResult:
    """Normalized outbound result from any provider implementation."""

    ok: bool
    provider: str
    items: list[dict[str, Any]] = field(default_factory=list)
    raw: Any = None
    error: Optional[str] = None
    from_cache: bool = False
    from_fallback: bool = False


class ProductAdapter(ABC):
    """One upstream provider (or mock) behind a stable call shape."""

    name: str = "abstract"

    @abstractmethod
    async def execute(self, request: ProductRequest, credential: str) -> ProductResult:
        """Run the product call using a single credential string."""
