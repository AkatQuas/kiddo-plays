import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DATA_ANALYSIS_",
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "data_analysis (weekend experiment)"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    MCP_SERVER_NAME: str = "data-analysis"
    MCP_TRANSPORT: str = "stdio"
    MCP_HOST: str = "127.0.0.1"
    MCP_SSE_PORT: int = 8001

    SESSION_TTL_SECONDS: int = 1800
    MAX_MEMORY_PER_SESSION_MB: int = 4096
    MAX_TOTAL_MEMORY_MB: int = 0
    MAX_SESSIONS: int = 64
    SESSION_BUSY_TIMEOUT_SECONDS: float = 120.0
    MAX_RESULT_ROWS: int = 5000
    DUCKDB_MEMORY_LIMIT: str = "auto"
    DUCKDB_THREADS: int = Field(default_factory=lambda: max(1, os.cpu_count() or 4))

    API_KEYS: str = ""
    REQUIRE_AUTH: bool = True

    UPLOAD_DIR: str = "data/uploads"
    IMPORT_ALLOWED_DIRS: str = ""
    EXPORT_DIR: str = "data/exports"
    WEBHOOK_ALLOWED_HOSTS: str = ""
    CORS_ALLOW_ORIGINS: str = "http://localhost:8000,http://127.0.0.1:8000"
    LOG_LEVEL: str = "INFO"

    RAY_ENABLED: bool = False
    RAY_ADDRESS: str = ""
    RAY_MIN_ROWS: int = 1_000_000
    RAY_PARTITIONS: int = 0

    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""
    LLM_TIMEOUT_SECONDS: float = 3.0

    @property
    def api_key_list(self) -> list[str]:
        return [k.strip() for k in self.API_KEYS.split(",") if k.strip()]

    @property
    def import_allowed_dir_list(self) -> list[str]:
        extra = [d.strip() for d in self.IMPORT_ALLOWED_DIRS.split(",") if d.strip()]
        return [self.UPLOAD_DIR, *extra]

    @property
    def webhook_allowed_host_list(self) -> list[str]:
        return [h.strip().lower() for h in self.WEBHOOK_ALLOWED_HOSTS.split(",") if h.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]


settings = Settings()
