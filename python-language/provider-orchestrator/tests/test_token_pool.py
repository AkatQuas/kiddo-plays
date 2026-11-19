import time

from provider_orchestrator.pool.token_pool import TokenPool


def test_token_pool_round_robin_and_stats():
    pool = TokenPool(tokens=["a", "b"], qps_per_token=100.0)
    seen = []
    for _ in range(4):
        slot = pool.acquire(timeout=1.0)
        seen.append(slot.token)
        pool.release_ok(slot)
    assert set(seen) == {"a", "b"}
    stats = pool.stats()
    assert stats.size == 2
    assert sum(s["total_ok"] for s in stats.slots) == 4


def test_circuit_opens():
    pool = TokenPool(
        tokens=["only"],
        qps_per_token=100.0,
        fail_threshold=2,
        circuit_seconds=0.2,
    )
    s = pool.acquire(timeout=1.0)
    pool.release_err(s, rate_limited=True)
    s = pool.acquire(timeout=1.0)
    pool.release_err(s, rate_limited=True)
    assert pool.stats().slots[0]["circuit_open"] is True
    time.sleep(0.25)
    s = pool.acquire(timeout=1.0)
    pool.release_ok(s)
    assert pool.stats().slots[0]["circuit_open"] is False
