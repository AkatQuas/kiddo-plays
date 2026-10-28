"""Composition root. The only place that chooses concrete adapters."""

from __future__ import annotations

from imgrelay.constants import LOCAL_OUTPUT_DIR, STORAGE_BACKEND
from imgrelay.engine import HttpImageEngine
from imgrelay.env import ExternalServices, load_env
from imgrelay.redis_board import RedisJobBoard
from imgrelay.scheduler import Scheduler
from imgrelay.storage import LocalStore, S3Store


def build_runtime(env: ExternalServices | None = None) -> Scheduler:
    env = env or load_env()
    board = RedisJobBoard(env.redis_url)
    engine = HttpImageEngine(env.engine_base_url)
    if STORAGE_BACKEND == "local":
        store = LocalStore(LOCAL_OUTPUT_DIR)
    elif STORAGE_BACKEND == "s3":
        store = S3Store(
            endpoint_url=env.s3_endpoint_url,
            bucket=env.s3_bucket,
            access_key_id=env.s3_access_key_id,
            secret_access_key=env.s3_secret_access_key,
            region=env.s3_region,
        )
    else:
        raise RuntimeError(f"Unknown STORAGE_BACKEND {STORAGE_BACKEND!r}")
    return Scheduler(board, engine, store)
