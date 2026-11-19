from provider_orchestrator.proxy.pool import ProxyPool
from provider_orchestrator.workers.pool import WorkerPool


def test_sticky_proxy_and_health():
    proxies = ProxyPool.from_urls(
        [
            "http://u:p@a.example:1",
            "http://u:p@b.example:1",
        ],
        fail_threshold=2,
    )
    pool = WorkerPool(size=2, proxy_pool=proxies, fail_threshold=2)
    pool.start()
    w = pool.acquire()
    assert w.proxy_url
    pool.report(w.worker_id, ok=False)
    pool.report(w.worker_id, ok=False)
    assert pool.stats()["healthy"] == 1
