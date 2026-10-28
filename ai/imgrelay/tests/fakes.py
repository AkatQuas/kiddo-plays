"""Test doubles. Not a deployment option — production queue is Redis."""

from __future__ import annotations

import uuid
from collections import deque

from imgrelay.jobs import FAILED, FINISHED, RUNNING, WAITING, JobRecord, JobSpec


class MemoryJobBoard:
    def __init__(self) -> None:
        self.jobs: dict[str, JobRecord] = {}
        self.waiting: deque[str] = deque()
        self.inflight: set[str] = set()

    def ping(self) -> bool:
        return True

    def submit(self, spec: JobSpec) -> str:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = JobRecord(job_id=job_id, spec=spec, status=WAITING)
        self.waiting.append(job_id)
        return job_id

    def get(self, job_id: str) -> JobRecord | None:
        return self.jobs.get(job_id)

    def claim(self, block_seconds: int) -> JobRecord | None:
        del block_seconds
        if not self.waiting:
            return None
        job_id = self.waiting.popleft()
        record = self.jobs[job_id]
        record.status = RUNNING
        self.inflight.add(job_id)
        return record

    def ack(self, job_id: str, result_ref: str) -> None:
        record = self.jobs[job_id]
        record.status = FINISHED
        record.result_ref = result_ref
        record.error = None
        self.inflight.discard(job_id)

    def retry(self, job_id: str, error: str) -> None:
        record = self.jobs[job_id]
        record.attempts += 1
        record.status = WAITING
        record.error = error
        self.inflight.discard(job_id)
        self.waiting.append(job_id)

    def fail(self, job_id: str, error: str) -> None:
        record = self.jobs[job_id]
        record.attempts += 1
        record.status = FAILED
        record.error = error
        self.inflight.discard(job_id)


class ScriptedEngine:
    def __init__(self, script: list[bytes | Exception]):
        self.script = list(script)
        self.seen: list[str] = []

    def edit(self, job: JobRecord) -> tuple[bytes, str]:
        self.seen.append(job.spec.prompt)
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item, "image/png"


class MemoryStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes, content_type: str) -> str:
        del content_type
        self.objects[key] = data
        return f"mem://{key}"
