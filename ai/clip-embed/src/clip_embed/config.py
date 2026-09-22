from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    model_id: str = "openai/clip-vit-large-patch14"
    model_path: Path = Path("models/clip-vit-large-patch14")
    gallery_path: Path = Path("data/gallery")
    host: str = "0.0.0.0"
    port: int = 11204
    hf_endpoint: str | None = None

    @property
    def resolved_model_path(self) -> Path:
        return self.model_path.resolve()

    @property
    def resolved_gallery_path(self) -> Path:
        return self.gallery_path.resolve()


settings = Settings()
