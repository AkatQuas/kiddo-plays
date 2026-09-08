from __future__ import annotations

import pytest

from common.config import init_config


@pytest.fixture(scope="session", autouse=True)
def _init_app_config(tmp_path_factory: pytest.TempPathFactory) -> None:
    """Initialize config for the whole test session."""
    root = tmp_path_factory.mktemp("voice_manager")
    log_dir = root / "logs"
    log_dir.mkdir()

    config_path = root / "config.json"
    config_path.write_text(
        f"""{{
            "logger_config": {{
                "level": "WARNING",
                "log_dir": "{log_dir.as_posix()}",
                "max_file_size": 1048576,
                "backup_count": 1,
                "console_output": false
            }},
            "admin": [],
            "asr_config": {{"url": "http://localhost/asr", "api_key": "test"}},
            "tts_config": {{"url": "http://localhost/tts", "api_key": "test"}},
            "database_config": {{
                "url": "sqlite:///:memory:",
                "pool_size": 1,
                "max_overflow": 0,
                "pool_timeout": 30,
                "pool_recycle": 3600,
                "pool_pre_ping": true
            }},
            "storage_config": {{
                "bucket": "voices",
                "endpoint": "localhost:9000",
                "access_key": "test",
                "secret_key": "test",
                "secure": false
            }}
        }}
        """,
        encoding="utf-8",
    )
    init_config(str(config_path))

    from common.log import init_log

    init_log()
