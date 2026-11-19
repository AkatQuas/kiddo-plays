"""
Token pool — multi-credential load balancing with sliding-window QPS
and consecutive-failure circuit breaking.

Tokens are supplied by the caller (env / secrets manager). This module does
not issue or reverse-engineer third-party session tokens.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional


@dataclass
class TokenSlot:
    token: str
    label: str = ""
    window: Deque[float] = field(default_factory=deque)
    consecutive_failures: int = 0
    circuit_open_until: float = 0.0
    total_ok: int = 0
    total_err: int = 0

    def is_circuit_open(self, now: float | None = None) -> bool:
        now = now if now is not None else time.monotonic()
        return now < self.circuit_open_until


@dataclass
class PoolStats:
    size: int
    qps_per_token: float
    slots: list[dict]


class TokenPool:
    """
    Each slot may perform at most `qps_per_token` requests per second.
    Theoretical max QPS ≈ pool_size * qps_per_token.

    On repeated rate-limit / transient failures, a slot opens its circuit
    for `circuit_seconds` to protect the upstream.
    """

    def __init__(
        self,
        tokens: list[str],
        *,
        qps_per_token: float = 1.0,
        window_seconds: float = 1.0,
        fail_threshold: int = 3,
        circuit_seconds: float = 30.0,
    ) -> None:
        if not tokens:
            raise ValueError("tokens must be a non-empty list")
        if qps_per_token <= 0:
            raise ValueError("qps_per_token must be > 0")
        self.qps_per_token = qps_per_token
        self.window_seconds = window_seconds
        self.fail_threshold = fail_threshold
        self.circuit_seconds = circuit_seconds
        self._slots = [
            TokenSlot(token=t, label=f"slot-{i}") for i, t in enumerate(tokens)
        ]
        self._lock = threading.Lock()
        self._rr = 0

    @property
    def size(self) -> int:
        return len(self._slots)

    def _prune(self, slot: TokenSlot, now: float) -> None:
        cutoff = now - self.window_seconds
        while slot.window and slot.window[0] < cutoff:
            slot.window.popleft()

    def _capacity_ok(self, slot: TokenSlot, now: float) -> bool:
        self._prune(slot, now)
        max_in_window = max(1, int(self.qps_per_token * self.window_seconds))
        return len(slot.window) < max_in_window

    def acquire(self, timeout: float = 5.0) -> TokenSlot:
        """
        Block until a slot has capacity, or raise TimeoutError.
        Returns the chosen slot (caller must call release_ok / release_err).
        """
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                now = time.monotonic()
                n = len(self._slots)
                for offset in range(n):
                    idx = (self._rr + offset) % n
                    slot = self._slots[idx]
                    if slot.is_circuit_open(now):
                        continue
                    if not self._capacity_ok(slot, now):
                        continue
                    slot.window.append(now)
                    self._rr = idx + 1
                    return slot

            if time.monotonic() >= deadline:
                raise TimeoutError("token pool exhausted within timeout")
            time.sleep(0.02)

    def release_ok(self, slot: TokenSlot) -> None:
        with self._lock:
            slot.consecutive_failures = 0
            slot.total_ok += 1

    def release_err(self, slot: TokenSlot, *, rate_limited: bool = False) -> None:
        with self._lock:
            slot.total_err += 1
            if rate_limited:
                slot.consecutive_failures += 1
                if slot.consecutive_failures >= self.fail_threshold:
                    slot.circuit_open_until = time.monotonic() + self.circuit_seconds
                    slot.consecutive_failures = 0

    def stats(self) -> PoolStats:
        with self._lock:
            now = time.monotonic()
            slots = []
            for s in self._slots:
                self._prune(s, now)
                slots.append(
                    {
                        "label": s.label,
                        "in_window": len(s.window),
                        "circuit_open": s.is_circuit_open(now),
                        "total_ok": s.total_ok,
                        "total_err": s.total_err,
                    }
                )
            return PoolStats(
                size=self.size,
                qps_per_token=self.qps_per_token,
                slots=slots,
            )

    def try_call(self, fn, *, timeout: float = 5.0, is_rate_limited=None):
        """
        Convenience: acquire → call fn(token) → release.
        `is_rate_limited(exc_or_result) -> bool` optional classifier.
        """
        slot = self.acquire(timeout=timeout)
        try:
            result = fn(slot.token)
            if is_rate_limited and is_rate_limited(result):
                self.release_err(slot, rate_limited=True)
            else:
                self.release_ok(slot)
            return result
        except Exception as exc:
            limited = bool(is_rate_limited and is_rate_limited(exc))
            self.release_err(slot, rate_limited=limited)
            raise
