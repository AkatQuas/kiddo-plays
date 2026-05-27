from __future__ import annotations

import logging
import time

from repo_report.push.base import PushChannel, PushResult

logger = logging.getLogger("repo_report.push")


class RetryingPushChannel(PushChannel):
    def __init__(
        self,
        inner: PushChannel,
        retry_count: int,
        retry_interval_seconds: int,
    ) -> None:
        self._inner = inner
        self._retry_count = retry_count
        self._retry_interval = retry_interval_seconds

    @property
    def name(self) -> str:
        return self._inner.name

    def send(self, title: str, content: str) -> PushResult:
        last: PushResult | None = None
        max_attempts = self._retry_count + 1
        for attempt in range(1, max_attempts + 1):
            result = self._inner.send(title, content)
            result.attempts = attempt
            if result.success:
                return result
            last = result
            if attempt < max_attempts:
                logger.warning(
                    "Push %s attempt %d failed: %s, retrying in %ds",
                    self.name,
                    attempt,
                    result.message,
                    self._retry_interval,
                )
                time.sleep(self._retry_interval)
        return last or PushResult(channel=self.name, success=False, message="unknown")
