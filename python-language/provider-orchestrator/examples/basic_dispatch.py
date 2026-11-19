"""Run: PYTHONPATH=src python examples/basic_dispatch.py"""

from __future__ import annotations

import asyncio

from provider_orchestrator.adapters.echo import EchoAdapter
from provider_orchestrator.adapters.fallback_static import StaticFallbackAdapter
from provider_orchestrator.keys.memory_store import InMemoryKeyStore
from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.ports.product import ProductRequest
from provider_orchestrator.scheduler.dispatch import Dispatcher
from provider_orchestrator.scheduler.memory_cache import InMemoryCache


async def main() -> None:
    store = InMemoryKeyStore()
    registry = KeyRegistry(store)
    registry.add(platform="echo", access_key="alpha-key-001", name="a", hour_limit=10)
    registry.add(platform="echo", access_key="beta-key-002", name="b", hour_limit=10)

    dispatcher = Dispatcher(
        adapters=[EchoAdapter(name="echo")],
        registry=registry,
        cache=InMemoryCache(default_ttl=60),
        fallback=StaticFallbackAdapter(),
        platform_order=["echo"],
    )

    first = await dispatcher.dispatch(ProductRequest(query="hello orchestration"))
    second = await dispatcher.dispatch(ProductRequest(query="hello orchestration"))

    print("first :", first.result.provider, first.result.from_cache, first.attempts)
    print("second:", second.result.provider, second.result.from_cache, second.attempts)
    print("quota :", registry.quota_snapshot())


if __name__ == "__main__":
    asyncio.run(main())
