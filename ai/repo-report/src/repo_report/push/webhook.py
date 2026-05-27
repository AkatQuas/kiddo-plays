from __future__ import annotations

from typing import Any

import httpx

from repo_report.push.base import PushChannel, PushResult


class WebhookPushChannel(PushChannel):
    def __init__(self, url: str, custom_body: dict[str, Any] | None = None) -> None:
        self._url = url
        self._custom_body = custom_body or {}

    @property
    def name(self) -> str:
        return "webhook"

    def send(self, title: str, content: str) -> PushResult:
        body = {"content": f"{title}\n\n{content}"}
        body.update(self._custom_body)
        try:
            resp = httpx.post(
                self._url,
                json=body,
                timeout=30,
            )
            if resp.status_code < 400:
                return PushResult(channel=self.name, success=True)
            return PushResult(
                channel=self.name,
                success=False,
                message=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )
        except Exception as exc:
            return PushResult(channel=self.name, success=False, message=str(exc))
