from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


class GlobalConfig(BaseModel):
    repos_root: Path = Path("./repos")
    cursor_dir: Path = Path("./cursors")
    log_dir: Path = Path("./log")
    lock_file: Path = Path("./.repo-report.lock")
    log_retention_days: int = 30
    max_parallel_repos: int = 3
    init_lookback_days: int = 7
    min_free_disk_mb: int = 512
    cron_expression: str = "0 23 * * *"


class AIConfig(BaseModel):
    engine: str = "claude-code"
    timeout_seconds: int = 600
    max_turns: int = 20
    max_retries: int = 3
    retry_interval_seconds: int = 5


class PushChannelConfig(BaseModel):
    type: str
    enabled: bool = False
    custom_body: dict[str, Any] | None = None
    extra: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        return v.strip().lower()


class PushConfig(BaseModel):
    retry_count: int = 2
    retry_interval_seconds: int = 3
    channels: list[PushChannelConfig] = Field(default_factory=list)


class RepoConfig(BaseModel):
    name: str
    url: str
    branch: str = "main"
    enabled: bool = True


class AppConfig(BaseModel):
    global_: GlobalConfig = Field(alias="global")
    ai: AIConfig = AIConfig()
    push: PushConfig = PushConfig()
    repos: list[RepoConfig] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    def resolve_paths(self, config_path: Path) -> None:
        base = config_path.parent.resolve()

        def _resolve(p: Path) -> Path:
            if p.is_absolute():
                return p
            return (base / p).resolve()

        self.global_.repos_root = _resolve(self.global_.repos_root)
        self.global_.cursor_dir = _resolve(self.global_.cursor_dir)
        self.global_.log_dir = _resolve(self.global_.log_dir)
        self.global_.lock_file = _resolve(self.global_.lock_file)

    def enabled_repos(self) -> list[RepoConfig]:
        return [r for r in self.repos if r.enabled]

    def repo_path(self, repo: RepoConfig) -> Path:
        return self.global_.repos_root / repo.name


def _normalize_channel(raw: dict[str, Any]) -> dict[str, Any]:
    data = dict(raw)
    channel_type = data.pop("type", "webhook")
    enabled = data.pop("enabled", False)
    return {"type": channel_type, "enabled": enabled, "extra": data}


def load_config(path: Path) -> AppConfig:
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Config root must be a mapping")

    if "push" in raw and "channels" in raw["push"]:
        raw["push"]["channels"] = [
            _normalize_channel(c) for c in raw["push"]["channels"]
        ]

    config = AppConfig.model_validate(raw)
    config.resolve_paths(path)
    return config
