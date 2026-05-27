from repo_report.config.loader import PushChannelConfig, PushConfig
from repo_report.push.factory import create_push_channels


def test_create_push_channels_empty():
    config = PushConfig(channels=[])
    assert create_push_channels(config) == []


def test_create_push_channels_disabled():
    config = PushConfig(
        channels=[
            PushChannelConfig(type="webhook", enabled=False, extra={"url": "http://x"})
        ]
    )
    assert create_push_channels(config) == []
