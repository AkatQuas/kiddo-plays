from __future__ import annotations

from typing import Any

import httpx

from repo_report.push.base import PushChannel, PushResult


class FeishuPushChannel(PushChannel):
    def __init__(self, webhook_url: str, custom_body: dict[str, Any] | None = None) -> None:
        self._url = webhook_url
        self._custom_body = custom_body or {}

    @property
    def name(self) -> str:
        return "feishu"

    def send(self, title: str, content: str) -> PushResult:
        body = {
            "msg_type": "text",
            "content": {"text": f"{title}\n\n{content}"},
        }
        body.update(self._custom_body)
        return self._post(body)

    def _post(self, body: dict) -> PushResult:
        try:
            resp = httpx.post(self._url, json=body, timeout=30)
            data = resp.json() if resp.content else {}
            if resp.status_code < 400 and data.get("code", 0) in (0, None):
                return PushResult(channel=self.name, success=True)
            return PushResult(
                channel=self.name,
                success=False,
                message=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )
        except Exception as exc:
            return PushResult(channel=self.name, success=False, message=str(exc))
