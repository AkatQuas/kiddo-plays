"""
Educational proxy + worker sticky binding demo.

DISCLAIMER: For learning and architecture discussion only.
Not for commercial anonymization or ToS-violating access.

Run: PYTHONPATH=src python examples/proxy_learning_demo.py
"""

from __future__ import annotations

from provider_orchestrator.proxy.pool import ProxyPool
from provider_orchestrator.workers.pool import WorkerPool


def main() -> None:
    # Fake URLs — no network I/O in this demo
    proxies = ProxyPool.from_urls(
        [
            "http://user:pass@proxy-a.example:8080",
            "http://user:pass@proxy-b.example:8080",
            "http://user:pass@proxy-c.example:8080",
        ]
    )

    workers = WorkerPool(size=3, proxy_pool=proxies)
    workers.start()

    w0 = workers.acquire()
    print("worker0 bound proxy suffix:", (w0.proxy_url or "")[-12:])

    # simulate failures → dead proxy → unhealthy worker
    for _ in range(3):
        workers.report(w0.worker_id, ok=False)
    print("after failures:", workers.stats())
    print("proxy stats:", proxies.stats())

    print(
        "\nReminder: residential/datacenter proxies are a networking technique "
        "for study. Review laws and third-party terms before any real use."
    )


if __name__ == "__main__":
    main()
