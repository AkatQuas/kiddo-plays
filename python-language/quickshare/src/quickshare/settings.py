# -*- coding: utf-8 -*-
"""Upload limits, port, and paths. One module owns the numbers the app and pages share."""

from __future__ import annotations

import importlib.util
import os
from dataclasses import dataclass
from pathlib import Path

_TRUE = {"1", "true", "yes", "on"}


def repo_root() -> Path:
    """项目根目录：放 pyproject.toml 和 config.py 的那一层。"""
    for parent in Path(__file__).resolve().parents:
        if (parent / "pyproject.toml").is_file() and (parent / "config.py").is_file():
            return parent
    raise RuntimeError("找不到项目根目录")


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    debug: bool
    max_upload_bytes: int
    max_content_length: int
    data_dir: Path

    @property
    def upload_folder(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def text_file(self) -> Path:
        return self.data_dir / "texts.json"

    @property
    def md5_cache_file(self) -> Path:
        return self.data_dir / "md5_cache.json"

    @property
    def categories_file(self) -> Path:
        return self.data_dir / "categories.json"

    @property
    def max_upload_mb(self) -> int:
        return self.max_upload_bytes // (1024 * 1024)


def load_settings(environ=None, config=None, data_dir=None) -> Settings:
    """Config file values, then environment variables, then callers of create_app."""
    environ = os.environ if environ is None else environ
    values = {
        "host": "0.0.0.0",
        "port": 9527,
        "debug": False,
        "max_upload_mb": 1024,
        "max_content_length": 100_000,
        "data_dir": "data",
    }
    file_values = _read_config_file() if config is None else config
    for key, value in file_values.items():
        if value is not None:
            values[key] = value

    if "QUICKSHARE_HOST" in environ:
        values["host"] = environ["QUICKSHARE_HOST"].strip()
    if "QUICKSHARE_PORT" in environ:
        values["port"] = _positive_int(environ["QUICKSHARE_PORT"], "QUICKSHARE_PORT")
    if "QUICKSHARE_DEBUG" in environ:
        values["debug"] = environ["QUICKSHARE_DEBUG"].strip().lower() in _TRUE
    if "QUICKSHARE_MAX_UPLOAD_MB" in environ:
        values["max_upload_mb"] = _positive_int(
            environ["QUICKSHARE_MAX_UPLOAD_MB"], "QUICKSHARE_MAX_UPLOAD_MB"
        )
    if "QUICKSHARE_MAX_CONTENT_LENGTH" in environ:
        values["max_content_length"] = _positive_int(
            environ["QUICKSHARE_MAX_CONTENT_LENGTH"], "QUICKSHARE_MAX_CONTENT_LENGTH"
        )
    if "QUICKSHARE_DATA_DIR" in environ and environ["QUICKSHARE_DATA_DIR"].strip():
        values["data_dir"] = environ["QUICKSHARE_DATA_DIR"].strip()

    port = int(values["port"])
    max_upload_mb = int(values["max_upload_mb"])
    if port < 1 or port > 65535:
        raise ValueError(f"端口无效: {port}")
    if max_upload_mb < 1:
        raise ValueError(f"上传上限无效: {max_upload_mb}")

    return Settings(
        host=str(values["host"]),
        port=port,
        debug=_as_bool(values["debug"]),
        max_upload_bytes=max_upload_mb * 1024 * 1024,
        max_content_length=int(values["max_content_length"]),
        data_dir=_resolve_data_dir(data_dir if data_dir is not None else values["data_dir"]),
    )


def _resolve_data_dir(raw) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path
    return repo_root() / path


def _read_config_file() -> dict:
    path = repo_root() / "config.py"
    if not path.exists():
        return {}
    spec = importlib.util.spec_from_file_location("quickshare_config", path)
    if spec is None or spec.loader is None:
        return {}
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return {
        "host": getattr(module, "HOST", None),
        "port": getattr(module, "PORT", None),
        "debug": getattr(module, "DEBUG", None),
        "max_upload_mb": getattr(module, "MAX_UPLOAD_MB", None),
        "max_content_length": getattr(module, "MAX_CONTENT_LENGTH", None),
        "data_dir": getattr(module, "DATA_DIR", None),
    }


def _positive_int(raw: str, name: str) -> int:
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} 必须是正整数") from exc
    if value < 1:
        raise ValueError(f"{name} 必须是正整数")
    return value


def _as_bool(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in _TRUE
    return bool(value)
