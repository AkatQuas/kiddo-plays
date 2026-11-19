"""Process-local TTL cache implementing CachePort."""

from __future__ import annotations

import time
from threading import Lock
from typing import Any, Optional

from provider_orchestrator.ports.cache import CachePort


class InMemoryCache(CachePort):
    def __init__(self, default_ttl: int = 86_400) -> None:
        self.default_ttl = default_ttl
        self._data: dict[str, tuple[Any, float]] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            value, expires = item
            if time.monotonic() >= expires:
                self._data.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = self.default_ttl if ttl_seconds is None else ttl_seconds
        with self._lock:
            self._data[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)
