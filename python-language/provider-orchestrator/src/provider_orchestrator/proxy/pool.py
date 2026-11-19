"""
Proxy pool patterns (educational).

Demonstrates:
  - sticky worker → proxy binding
  - dead-proxy exclusion
  - simple health screening hook

DISCLAIMER
----------
For learning and architecture discussion only. Do not use this module to
bypass access controls, scrape in violation of terms, or run commercial
traffic anonymization without appropriate legal review and provider ToS
compliance. Enable only via LEARNING_PROXY_ENABLED=true.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from threading import Lock
from typing import Callable, Optional, Sequence

log = logging.getLogger("provider_orchestrator.proxy")


@dataclass
class ProxyEndpoint:
    url: str
    label: str = ""
    failures: int = 0
    dead: bool = False


HealthCheck = Callable[[str], bool]


@dataclass
class ProxyPool:
    """
    Sticky index mapping: worker N prefers proxies[N % len].
    Failures mark endpoints dead until reset / refresh.
    """

    endpoints: list[ProxyEndpoint] = field(default_factory=list)
    fail_threshold: int = 3
    _lock: Lock = field(default_factory=Lock)

    @classmethod
    def from_urls(cls, urls: Sequence[str], **kwargs) -> "ProxyPool":
        return cls(
            endpoints=[ProxyEndpoint(url=u, label=f"proxy-{i}") for i, u in enumerate(urls)],
            **kwargs,
        )

    def bind(self, worker_index: int) -> Optional[ProxyEndpoint]:
        """Sticky preference with failover to next live endpoint."""
        with self._lock:
            live = [e for e in self.endpoints if not e.dead]
            if not live:
                return None
            base = worker_index % len(live)
            return live[base]

    def report_failure(self, url: str) -> None:
        with self._lock:
            for e in self.endpoints:
                if e.url == url:
                    e.failures += 1
                    if e.failures >= self.fail_threshold:
                        e.dead = True
                        log.info("marked proxy dead: %s", e.label)
                    return

    def report_success(self, url: str) -> None:
        with self._lock:
            for e in self.endpoints:
                if e.url == url:
                    e.failures = 0
                    return

    def screen(self, check: HealthCheck) -> list[ProxyEndpoint]:
        """
        Run a caller-provided health check. The check itself should be a
        benign connectivity probe defined by the learner — this library does
        not embed target-site probes.
        """
        kept: list[ProxyEndpoint] = []
        with self._lock:
            for e in self.endpoints:
                try:
                    ok = bool(check(e.url))
                except Exception:  # noqa: BLE001
                    ok = False
                if ok:
                    e.dead = False
                    e.failures = 0
                    kept.append(e)
                else:
                    e.dead = True
            self.endpoints = list(self.endpoints)  # keep full set; dead flags set
        return kept

    def stats(self) -> dict:
        with self._lock:
            return {
                "total": len(self.endpoints),
                "live": sum(1 for e in self.endpoints if not e.dead),
                "dead": sum(1 for e in self.endpoints if e.dead),
                "endpoints": [
                    {
                        "label": e.label,
                        "dead": e.dead,
                        "failures": e.failures,
                    }
                    for e in self.endpoints
                ],
            }
