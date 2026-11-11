# -*- coding: utf-8 -*-
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _split_keys(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache
def get_settings() -> "Settings":
    return Settings()


class Settings:
    """All secrets and endpoints come from environment variables."""

    def __init__(self) -> None:
        self.api_bearer_token: str = os.getenv("API_BEARER_TOKEN", "") or ""

        self.tavily_api_keys: list[str] = _split_keys(os.getenv("TAVILY_API_KEY"))
        self.serpapi_api_keys: list[str] = _split_keys(os.getenv("SERPAPI_API_KEY"))
        self.tinyfish_api_keys: list[str] = _split_keys(os.getenv("TINYFISH_API_KEY"))
        self.brave_api_keys: list[str] = _split_keys(os.getenv("BRAVE_API_KEY"))

        order = os.getenv("SEARCH_PROVIDER_ORDER", "tinyfish,tavily,serpapi,brave")
        self.search_provider_order: list[str] = [
            p.strip().lower() for p in order.split(",") if p.strip()
        ]

        self.sensitive_words_path: str = os.getenv("SENSITIVE_WORDS_PATH", "") or ""

        self.s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "") or ""
        self.s3_region: str = os.getenv("S3_REGION", "us-east-1") or "us-east-1"
        self.s3_access_key_id: str = os.getenv("S3_ACCESS_KEY_ID", "") or ""
        self.s3_secret_access_key: str = os.getenv("S3_SECRET_ACCESS_KEY", "") or ""
        self.s3_bucket: str = os.getenv("S3_BUCKET", "") or ""
        self.s3_force_path_style: bool = _env_bool("S3_FORCE_PATH_STYLE", True)

        self.host: str = os.getenv("HOST", "0.0.0.0") or "0.0.0.0"
        self.port: int = int(os.getenv("PORT", "9030") or "9030")
