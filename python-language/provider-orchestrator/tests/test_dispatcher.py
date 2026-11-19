import pytest

from provider_orchestrator.adapters.echo import EchoAdapter
from provider_orchestrator.adapters.fallback_static import StaticFallbackAdapter
from provider_orchestrator.keys.memory_store import InMemoryKeyStore
from provider_orchestrator.keys.registry import KeyRegistry
from provider_orchestrator.ports.product import ProductRequest
from provider_orchestrator.scheduler.dispatch import Dispatcher
from provider_orchestrator.scheduler.memory_cache import InMemoryCache


@pytest.mark.asyncio
async def test_dispatch_cache_and_quota():
    registry = KeyRegistry(InMemoryKeyStore())
    registry.add(platform="echo", access_key="k-cache-1", hour_limit=100)
    dispatcher = Dispatcher(
        adapters=[EchoAdapter()],
        registry=registry,
        cache=InMemoryCache(default_ttl=60),
        fallback=StaticFallbackAdapter(),
    )
    req = ProductRequest(query="q1")
    a = await dispatcher.dispatch(req)
    b = await dispatcher.dispatch(req)
    assert a.result.ok and not a.result.from_cache
    assert b.result.from_cache
    assert registry.quota_snapshot()[0]["hour_used"] == 1


@pytest.mark.asyncio
async def test_fallback_when_no_keys():
    registry = KeyRegistry(InMemoryKeyStore())
    dispatcher = Dispatcher(
        adapters=[EchoAdapter()],
        registry=registry,
        fallback=StaticFallbackAdapter(),
    )
    out = await dispatcher.dispatch(ProductRequest(query="lonely"))
    assert out.result.from_fallback
    assert out.result.ok
