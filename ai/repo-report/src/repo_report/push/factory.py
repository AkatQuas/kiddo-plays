from __future__ import annotations

import logging

from repo_report.config.loader import PushChannelConfig, PushConfig
from repo_report.push.base import PushChannel
from repo_report.push.dingtalk import DingTalkPushChannel
from repo_report.push.feishu import FeishuPushChannel
from repo_report.push.retry import RetryingPushChannel
from repo_report.push.webhook import WebhookPushChannel
from repo_report.push.wecom import WeComPushChannel

logger = logging.getLogger("repo_report.push")

PUSH_REGISTRY: dict[str, type[PushChannel]] = {
    "webhook": WebhookPushChannel,
    "feishu": FeishuPushChannel,
    "dingtalk": DingTalkPushChannel,
    "wecom": WeComPushChannel,
}


def _build_channel(cfg: PushChannelConfig) -> PushChannel:
    cls = PUSH_REGISTRY.get(cfg.type)
    if cls is None:
        raise ValueError(
            f"Unknown push channel type '{cfg.type}'. "
            f"Available: {list(PUSH_REGISTRY)}"
        )
    extra = cfg.extra
    custom_body = cfg.custom_body
    if cfg.type == "webhook":
        return cls(url=extra.get("url", ""), custom_body=custom_body)
    return cls(webhook_url=extra.get("webhook_url", extra.get("url", "")), custom_body=custom_body)


def create_push_channels(config: PushConfig) -> list[PushChannel]:
    channels: list[PushChannel] = []
    for cfg in config.channels:
        if not cfg.enabled:
            continue
        inner = _build_channel(cfg)
        wrapped = RetryingPushChannel(
            inner,
            retry_count=config.retry_count,
            retry_interval_seconds=config.retry_interval_seconds,
        )
        channels.append(wrapped)
        logger.info("Registered push channel: %s", cfg.type)
    return channels
