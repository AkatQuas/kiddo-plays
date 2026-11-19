"""
Generic worker pool with health flags and optional sticky proxy binding.

Transport-level pattern only — no browser automation or site scrapers.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

from provider_orchestrator.proxy.pool import ProxyPool


@dataclass
class Worker:
    worker_id: int
    proxy_url: Optional[str] = None
    healthy: bool = True
    failures: int = 0


@dataclass
class WorkerPool:
    size: int
    proxy_pool: ProxyPool | None = None
    fail_threshold: int = 3
    _workers: list[Worker] = field(default_factory=list)
    _lock: Lock = field(default_factory=Lock)
    _cycle: itertools.cycle | None = field(default=None, repr=False)

    def start(self) -> None:
        workers: list[Worker] = []
        for i in range(self.size):
            proxy = None
            if self.proxy_pool is not None:
                ep = self.proxy_pool.bind(i)
                proxy = ep.url if ep else None
            workers.append(Worker(worker_id=i, proxy_url=proxy))
        self._workers = workers
        self._cycle = itertools.cycle(range(self.size))

    def acquire(self) -> Worker:
        if not self._workers or self._cycle is None:
            raise RuntimeError("WorkerPool not started")
        with self._lock:
            for _ in range(self.size):
                idx = next(self._cycle)
                w = self._workers[idx]
                if w.healthy:
                    return w
        raise RuntimeError("no healthy workers")

    def report(self, worker_id: int, ok: bool) -> None:
        with self._lock:
            w = self._workers[worker_id]
            if ok:
                w.failures = 0
                w.healthy = True
                if w.proxy_url and self.proxy_pool:
                    self.proxy_pool.report_success(w.proxy_url)
                return
            w.failures += 1
            if w.proxy_url and self.proxy_pool:
                self.proxy_pool.report_failure(w.proxy_url)
            if w.failures >= self.fail_threshold:
                w.healthy = False

    def stats(self) -> dict:
        with self._lock:
            return {
                "size": self.size,
                "healthy": sum(1 for w in self._workers if w.healthy),
                "workers": [
                    {
                        "worker_id": w.worker_id,
                        "healthy": w.healthy,
                        "failures": w.failures,
                        "has_proxy": bool(w.proxy_url),
                    }
                    for w in self._workers
                ],
            }
