"""Environment-driven settings. No product or infra secrets in code."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    demo_provider_keys: str = Field(
        default="",
        description="Comma-separated demo API keys",
    )
    key_hour_limit: int = 100
    key_month_limit: int = 5000

    token_pool_size: int = 3
    token_pool_qps_per_token: float = 1.0

    cache_ttl_seconds: int = 86_400

    learning_proxy_urls: str = Field(
        default="",
        description="Comma-separated proxy URLs for educational demos only",
    )
    learning_proxy_enabled: bool = False

    management_host: str = "127.0.0.1"
    management_port: int = 8080
    management_api_token: str = "change-me"

    def parsed_demo_keys(self) -> list[str]:
        return [k.strip() for k in self.demo_provider_keys.split(",") if k.strip()]

    def parsed_learning_proxies(self) -> list[str]:
        return [u.strip() for u in self.learning_proxy_urls.split(",") if u.strip()]


def get_settings() -> Settings:
    return Settings()
