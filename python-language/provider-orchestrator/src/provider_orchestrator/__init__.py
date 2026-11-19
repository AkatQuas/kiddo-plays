"""
Provider Orchestrator — layered multi-provider runtime patterns.

Focus areas:
  - scheduling (cache → key pick → provider call → fallback)
  - token / key pools (sliding window, circuit breaker)
  - quota & key management
  - replaceable product adapters behind stable ports
"""

__version__ = "0.1.0"

from provider_orchestrator.keys.models import ProviderKey
from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.pool.token_pool import TokenPool, TokenSlot
from provider_orchestrator.scheduler.dispatch import Dispatcher, DispatchResult

__all__ = [
    "__version__",
    "KeyRegistry",
    "ProviderKey",
    "TokenPool",
    "TokenSlot",
    "Dispatcher",
    "DispatchResult",
]
