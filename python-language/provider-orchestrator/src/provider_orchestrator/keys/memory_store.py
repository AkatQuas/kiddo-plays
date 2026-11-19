"""In-memory KeyStore for demos and tests."""

from __future__ import annotations

from threading import Lock
from typing import Optional

from provider_orchestrator.keys.models import ProviderKey
from provider_orchestrator.ports.keystore import KeyStorePort


class InMemoryKeyStore(KeyStorePort):
    def __init__(self) -> None:
        self._data: dict[str, ProviderKey] = {}
        self._lock = Lock()

    def list_keys(self, platform: str | None = None) -> list[ProviderKey]:
        with self._lock:
            keys = list(self._data.values())
        if platform:
            keys = [k for k in keys if k.platform == platform]
        return [k.model_copy(deep=True) for k in keys]

    def get(self, key_id: str) -> Optional[ProviderKey]:
        with self._lock:
            k = self._data.get(key_id)
            return k.model_copy(deep=True) if k else None

    def upsert(self, key: ProviderKey) -> ProviderKey:
        with self._lock:
            self._data[key.key_id] = key.model_copy(deep=True)
            return key.model_copy(deep=True)

    def delete(self, key_id: str) -> bool:
        with self._lock:
            return self._data.pop(key_id, None) is not None

    def increment_usage(self, key_id: str) -> None:
        with self._lock:
            k = self._data.get(key_id)
            if not k:
                return
            k.reset_windows_if_needed()
            k.hour_used += 1
            k.month_used += 1
