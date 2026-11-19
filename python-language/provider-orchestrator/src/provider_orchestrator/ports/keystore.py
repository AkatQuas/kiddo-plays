"""Key store port — persistence for provider credentials & quota counters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from provider_orchestrator.keys.models import ProviderKey


class KeyStorePort(ABC):
    @abstractmethod
    def list_keys(self, platform: str | None = None) -> list[ProviderKey]:
        ...

    @abstractmethod
    def get(self, key_id: str) -> Optional[ProviderKey]:
        ...

    @abstractmethod
    def upsert(self, key: ProviderKey) -> ProviderKey:
        ...

    @abstractmethod
    def delete(self, key_id: str) -> bool:
        ...

    @abstractmethod
    def increment_usage(self, key_id: str) -> None:
        ...
