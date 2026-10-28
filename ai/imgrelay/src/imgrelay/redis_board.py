"""Redis adapter for JobBoard.

Layout (all keys share ``KEY_PREFIX``):
- ``waiting`` list, head is the oldest job (RPUSH / take LEFT)
- ``inflight`` list, jobs currently claimed
- ``job:{id}`` hash, the record
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import redis

from imgrelay.constants import KEY_PREFIX, MAX_ATTEMPTS, VISIBILITY_SECONDS
from imgrelay.jobs import FAILED, FINISHED, RUNNING, WAITING, JobRecord, JobSpec

_WAITING = f"{KEY_PREFIX}:waiting"
_INFLIGHT = f"{KEY_PREFIX}:inflight"


def _job_key(job_id: str) -> str:
    return f"{KEY_PREFIX}:job:{job_id}"


def _blank(value: Any) -> str:
    return "" if value is None else str(value)


def _opt_int(value: str) -> int | None:
    if value == "":
        return None
    return int(value)


def _dump(job_id: str, spec: JobSpec) -> dict[str, str]:
    now = str(time.time())
    return {
        "job_id": job_id,
        "prompt": spec.prompt,
        "negative_prompt": spec.negative_prompt,
        "input_image": spec.input_image,
        "width": _blank(spec.width),
        "height": _blank(spec.height),
        "steps": str(spec.steps),
        "cfg_scale": str(spec.cfg_scale),
        "seed": _blank(spec.seed),
        "status": WAITING,
        "attempts": "0",
        "error": "",
        "result_ref": "",
        "claimed_at": "",
        "created_at": now,
        "updated_at": now,
    }


def _load(data: dict[str, str]) -> JobRecord:
    spec = JobSpec(
        prompt=data.get("prompt", ""),
        input_image=data.get("input_image", ""),
        negative_prompt=data.get("negative_prompt", ""),
        width=_opt_int(data.get("width", "")),
        height=_opt_int(data.get("height", "")),
        steps=int(data.get("steps") or 0),
        cfg_scale=float(data.get("cfg_scale") or 0),
        seed=_opt_int(data.get("seed", "")),
    )
    error = data.get("error") or None
    result_ref = data.get("result_ref") or None
    return JobRecord(
        job_id=data["job_id"],
        spec=spec,
        status=data.get("status", WAITING),
        attempts=int(data.get("attempts") or 0),
        error=error,
        result_ref=result_ref,
    )


class RedisJobBoard:
    """Shared FCFS board. Safe for many pods to claim at once."""

    def __init__(
        self,
        url: str | None = None,
        client: redis.Redis | None = None,
        visibility_seconds: int = VISIBILITY_SECONDS,
        max_attempts: int = MAX_ATTEMPTS,
    ):
        if client is None:
            if not url:
                raise ValueError("RedisJobBoard needs a url or a client")
            client = redis.Redis.from_url(url, decode_responses=True)
        self.redis = client
        self.visibility_seconds = visibility_seconds
        self.max_attempts = max_attempts

    def ping(self) -> bool:
        try:
            return bool(self.redis.ping())
        except redis.RedisError:
            return False

    def submit(self, spec: JobSpec) -> str:
        job_id = str(uuid.uuid4())
        pipe = self.redis.pipeline()
        pipe.hset(_job_key(job_id), mapping=_dump(job_id, spec))
        pipe.rpush(_WAITING, job_id)
        pipe.execute()
        return job_id

    def get(self, job_id: str) -> JobRecord | None:
        data = self.redis.hgetall(_job_key(job_id))
        if not data:
            return None
        return _load(data)

    def claim(self, block_seconds: int) -> JobRecord | None:
        self._reap()
        if block_seconds <= 0:
            job_id = self.redis.lmove(_WAITING, _INFLIGHT, "LEFT", "LEFT")
        else:
            job_id = self.redis.blmove(_WAITING, _INFLIGHT, block_seconds, "LEFT", "LEFT")
        if not job_id:
            return None
        now = str(time.time())
        key = _job_key(job_id)
        if not self.redis.exists(key):
            self.redis.lrem(_INFLIGHT, 1, job_id)
            return None
        self.redis.hset(key, mapping={"status": RUNNING, "claimed_at": now, "updated_at": now})
        record = self.get(job_id)
        return record

    def ack(self, job_id: str, result_ref: str) -> None:
        now = str(time.time())
        pipe = self.redis.pipeline()
        pipe.hset(
            _job_key(job_id),
            mapping={
                "status": FINISHED,
                "result_ref": result_ref,
                "error": "",
                "updated_at": now,
            },
        )
        pipe.lrem(_INFLIGHT, 1, job_id)
        pipe.execute()

    def retry(self, job_id: str, error: str) -> None:
        now = str(time.time())
        self.redis.hincrby(_job_key(job_id), "attempts", 1)
        pipe = self.redis.pipeline()
        pipe.hset(
            _job_key(job_id),
            mapping={"status": WAITING, "error": error, "claimed_at": "", "updated_at": now},
        )
        pipe.lrem(_INFLIGHT, 1, job_id)
        pipe.rpush(_WAITING, job_id)
        pipe.execute()

    def fail(self, job_id: str, error: str) -> None:
        now = str(time.time())
        self.redis.hincrby(_job_key(job_id), "attempts", 1)
        pipe = self.redis.pipeline()
        pipe.hset(
            _job_key(job_id),
            mapping={"status": FAILED, "error": error, "claimed_at": "", "updated_at": now},
        )
        pipe.lrem(_INFLIGHT, 1, job_id)
        pipe.execute()

    def _reap(self) -> None:
        """Return expired leases to the tail, or fail them once attempts run out."""
        now = time.time()
        for job_id in self.redis.lrange(_INFLIGHT, 0, -1):
            claimed_at = self.redis.hget(_job_key(job_id), "claimed_at")
            if not claimed_at:
                continue
            if now - float(claimed_at) < self.visibility_seconds:
                continue
            removed = self.redis.lrem(_INFLIGHT, 1, job_id)
            if not removed:
                continue
            attempts = int(self.redis.hincrby(_job_key(job_id), "attempts", 1))
            stamp = str(now)
            if attempts >= self.max_attempts:
                self.redis.hset(
                    _job_key(job_id),
                    mapping={"status": FAILED, "error": "claim expired", "claimed_at": "", "updated_at": stamp},
                )
            else:
                self.redis.hset(
                    _job_key(job_id),
                    mapping={"status": WAITING, "error": "claim expired", "claimed_at": "", "updated_at": stamp},
                )
                self.redis.rpush(_WAITING, job_id)
