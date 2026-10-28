"""Environment for services that do not live in this pod.

Policy knobs stay in ``constants``. This module only reads addresses and
credentials of Redis, the image engine, and (when selected) S3.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from imgrelay.constants import S3_REGION, STORAGE_BACKEND


@dataclass(frozen=True)
class ExternalServices:
    redis_url: str
    engine_base_url: str
    s3_endpoint_url: str
    s3_bucket: str
    s3_access_key_id: str
    s3_secret_access_key: str
    s3_region: str


def load_env() -> ExternalServices:
    values = {
        "REDIS_URL": os.environ.get("REDIS_URL", ""),
        "ENGINE_BASE_URL": os.environ.get("ENGINE_BASE_URL", ""),
    }
    if STORAGE_BACKEND == "s3":
        values.update(
            {
                "S3_ENDPOINT_URL": os.environ.get("S3_ENDPOINT_URL", ""),
                "S3_BUCKET": os.environ.get("S3_BUCKET", ""),
                "S3_ACCESS_KEY_ID": os.environ.get("S3_ACCESS_KEY_ID", ""),
                "S3_SECRET_ACCESS_KEY": os.environ.get("S3_SECRET_ACCESS_KEY", ""),
            }
        )
    missing = [name for name, value in values.items() if not value]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"Missing environment variables for services outside this pod: {joined}"
        )
    return ExternalServices(
        redis_url=values["REDIS_URL"],
        engine_base_url=values["ENGINE_BASE_URL"],
        s3_endpoint_url=values.get("S3_ENDPOINT_URL", ""),
        s3_bucket=values.get("S3_BUCKET", ""),
        s3_access_key_id=values.get("S3_ACCESS_KEY_ID", ""),
        s3_secret_access_key=values.get("S3_SECRET_ACCESS_KEY", ""),
        s3_region=os.environ.get("S3_REGION", S3_REGION),
    )
