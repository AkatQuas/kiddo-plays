import json
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from typing import Any

from data_analysis.config import settings
from data_analysis.engine.reach_guard import assert_public_http_url

_RESPONSE_PREVIEW_CHARS = 500


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A 30x from a public host must not walk us into a private one."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


class WebhookPusher:
    @staticmethod
    def build_payload(
        title: str,
        message: str,
        platform: str = "generic",
        extra_metrics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        extra_metrics = extra_metrics or {}
        key = platform.lower()
        if key == "slack":
            text = f"*{title}*\n{message}"
            if extra_metrics:
                text += "\n" + "\n".join(f"• {k}: {v}" for k, v in extra_metrics.items())
            return {"text": text}
        if key in ("wecom", "wework", "wechat"):
            content = f"### {title}\n\n{message}"
            if extra_metrics:
                content += "\n" + "\n".join(f"> {k}: {v}" for k, v in extra_metrics.items())
            return {"msgtype": "markdown", "markdown": {"content": content}}
        if key == "feishu":
            elements = [{"tag": "text", "text": message + "\n\n"}]
            for k, v in extra_metrics.items():
                elements.append({"tag": "text", "text": f"• {k}: {v}\n"})
            return {
                "msg_type": "post",
                "content": {"post": {"zh_cn": {"title": title, "content": [elements]}}},
            }
        return {"title": title, "message": message, "metrics": extra_metrics}

    @staticmethod
    def send_alert(
        webhook_url: str,
        title: str,
        message: str,
        platform: str = "generic",  # feishu, dingtalk, slack, generic
        extra_metrics: dict[str, Any] | None = None,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """
        Production Webhook Pusher with Exponential Backoff Retries.
        """
        try:
            assert_public_http_url(webhook_url, settings.webhook_allowed_host_list)
        except PermissionError as exc:
            return {"status": "FAILED", "attempts": 0, "error": str(exc), "rejected": True}

        payload = WebhookPusher.build_payload(title, message, platform, extra_metrics)

        def _json_default(obj: Any) -> str:
            if isinstance(obj, (datetime, date)):
                return obj.isoformat(sep=" ")
            raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                data_bytes = json.dumps(payload, default=_json_default).encode("utf-8")
                req = urllib.request.Request(
                    webhook_url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json", "User-Agent": "MDS-DataAgent/1.0"},
                )
                with _opener.open(req, timeout=5) as response:
                    status_code = response.getcode()
                    # Enough to see the platform's errcode; never a channel for bulk content.
                    resp_text = response.read(4096).decode("utf-8", errors="replace")[
                        :_RESPONSE_PREVIEW_CHARS
                    ]
                    return {
                        "status": "SUCCESS",
                        "http_code": status_code,
                        "attempts": attempt,
                        "response": resp_text,
                    }
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))  # Exponential backoff: 0.5s, 1s, 2s

        return {
            "status": "FAILED",
            "attempts": max_retries,
            "error": last_error,
            "simulated_payload": payload,
        }
