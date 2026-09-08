import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class LoggerConfig:
    level: str
    log_dir: str
    max_file_size: int
    backup_count: int
    console_output: bool

    @classmethod
    def from_dict(cls, config_dict: dict[str, Any]) -> "LoggerConfig":
        return cls(**config_dict)


@dataclass
class AsrConfig:
    url: str
    api_key: str

    @classmethod
    def from_dict(cls, config_dict: dict[str, Any]) -> "AsrConfig":
        return cls(**config_dict)


@dataclass
class TtsConfig:
    url: str
    api_key: str

    @classmethod
    def from_dict(cls, config_dict: dict[str, Any]) -> "TtsConfig":
        return cls(**config_dict)


@dataclass
class DatabaseConfig:
    url: str
    pool_size: int
    max_overflow: int
    pool_timeout: int
    pool_recycle: int
    pool_pre_ping: bool

    @classmethod
    def from_dict(cls, config_dict: dict[str, Any]) -> "DatabaseConfig":
        return cls(**config_dict)


@dataclass
class StorageConfig:
    bucket: str
    endpoint: str
    access_key: str
    secret_key: str
    secure: bool

    @classmethod
    def from_dict(cls, config_dict: dict[str, Any]) -> "StorageConfig":
        return cls(
            bucket=config_dict.get("bucket", "voices"),
            endpoint=config_dict.get("endpoint", "localhost:9000"),
            access_key=config_dict.get("access_key", ""),
            secret_key=config_dict.get("secret_key", ""),
            secure=config_dict.get("secure", False),
        )


@dataclass
class ServerConfig:
    logger_config: LoggerConfig
    admin: list[str]
    description: str
    asr_config: AsrConfig
    database_config: DatabaseConfig
    tts_config: TtsConfig
    storage_config: StorageConfig

    @classmethod
    def from_dict(cls, data: dict) -> "ServerConfig":
        return cls(
            logger_config=LoggerConfig.from_dict(data["logger_config"]),
            admin=data.get("admin", []),
            description=data.get("description", ""),
            asr_config=AsrConfig.from_dict(data.get("asr_config") or {}),
            database_config=DatabaseConfig.from_dict(data.get("database_config") or {}),
            tts_config=TtsConfig.from_dict(data.get("tts_config") or {}),
            storage_config=StorageConfig.from_dict(data.get("storage_config") or {}),
        )


def _set_nested(config_data: dict[str, Any], key_path: str, value: str) -> None:
    keys = key_path.split(".")
    current = config_data
    for key in keys[:-1]:
        current = current.setdefault(key, {})
    current[keys[-1]] = value


def _apply_env_overrides(config_data: dict[str, Any]) -> dict[str, Any]:
    env_mappings = {
        "DATABASE_URL": "database_config.url",
        "ASR_URL": "asr_config.url",
        "ASR_API_KEY": "asr_config.api_key",
        "TTS_URL": "tts_config.url",
        "TTS_API_KEY": "tts_config.api_key",
        "MINIO_BUCKET": "storage_config.bucket",
        "MINIO_ENDPOINT": "storage_config.endpoint",
        "MINIO_ACCESS_KEY": "storage_config.access_key",
        "MINIO_SECRET_KEY": "storage_config.secret_key",
        "MINIO_SECURE": "storage_config.secure",
        "LOG_DIR": "logger_config.log_dir",
        "LOG_LEVEL": "logger_config.level",
    }

    for env_name, config_key in env_mappings.items():
        value = os.environ.get(env_name)
        if value is not None:
            if config_key.endswith(".secure"):
                _set_nested(config_data, config_key, value.lower() in {"1", "true", "yes"})
            else:
                _set_nested(config_data, config_key, value)

    return config_data


def load_config(config_path: str) -> ServerConfig:
    config_file = Path(config_path)
    if not config_file.exists():
        raise FileNotFoundError(f"config file not found: {config_path}")

    with open(config_file, encoding="utf-8") as f:
        config_data = json.load(f)

    config_data = _apply_env_overrides(config_data)
    return ServerConfig.from_dict(config_data)


# 全局配置实例
server_config = None


def init_config(config_path: str):
    global server_config
    server_config = load_config(config_path)


def is_config_initialized() -> bool:
    return server_config is not None


def get_server_config() -> ServerConfig:
    global server_config
    if server_config is None:
        raise ValueError("config not initialized")
    return server_config
