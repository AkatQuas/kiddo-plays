from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://mongo:27017"
    mongodb_db: str = "lite_oss"
    minio_endpoint: str = "http://localhost:9000"
    minio_bucket: str = "lite-oss-files"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"


settings = Settings()
