from __future__ import annotations

from common.config import get_server_config, load_config


def test_load_config_from_common_config_json() -> None:
    cfg = load_config("config/config.json")
    assert cfg.storage_config.bucket == "voices"
    assert cfg.storage_config.endpoint
    assert cfg.asr_config.url
    assert cfg.tts_config.url
    assert cfg.database_config.url


def test_session_config_initialized() -> None:
    cfg = get_server_config()
    assert cfg.storage_config.bucket == "voices"
    assert cfg.logger_config.level == "WARNING"
