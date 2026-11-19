"""Cache port — product-agnostic request memoization."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class CachePort(ABC):
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Return cached payload or None."""

    @abstractmethod
    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Store payload with optional TTL override."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Invalidate one key."""
