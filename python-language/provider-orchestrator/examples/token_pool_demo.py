"""Run: PYTHONPATH=src python examples/token_pool_demo.py"""

from __future__ import annotations

import time

from provider_orchestrator.pool.token_pool import TokenPool


def main() -> None:
    pool = TokenPool(
        tokens=["tok-1", "tok-2", "tok-3"],
        qps_per_token=1.0,
        fail_threshold=2,
        circuit_seconds=2.0,
    )

    def call(token: str) -> str:
        # pretend upstream work
        return f"ok:{token}"

    t0 = time.perf_counter()
    for i in range(6):
        result = pool.try_call(call, timeout=3.0)
        print(i, result)

    # trip circuit on one slot
    slot = pool.acquire(timeout=2.0)
    pool.release_err(slot, rate_limited=True)
    pool.release_err(slot, rate_limited=True)
    print("stats after circuit:", pool.stats())
    print(f"elapsed={time.perf_counter() - t0:.2f}s")


if __name__ == "__main__":
    main()
