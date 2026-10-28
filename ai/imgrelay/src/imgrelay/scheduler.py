"""Scheduler: claim a job, call the engine, publish the image, settle the job.

This is the behaviour the project exists to keep. Model weights, object
storage, and the queue transport sit behind seams and are not referenced
here except through their interfaces.
"""

from __future__ import annotations

import logging
import threading
import time

from imgrelay.constants import MAX_ATTEMPTS, OBJECT_PREFIX, QUEUE_BLOCK_SECONDS, WORKER_CONCURRENCY
from imgrelay.engine import ImageEngine
from imgrelay.jobs import JobBoard, JobRecord
from imgrelay.storage import ObjectStore

logger = logging.getLogger(__name__)

_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _extension(content_type: str) -> str:
    return _EXT.get(content_type.split(";")[0].strip().lower(), ".png")


class Scheduler:
    """Run claimed jobs to completion.

    ``run_once`` is the test surface: one claim, one attempt, one settle.
    ``start`` runs ``WORKER_CONCURRENCY`` loops in this process. Other pods
    run their own loops against the same board.

    A failed attempt is retried until ``MAX_ATTEMPTS``. The attempt counter
    on the record counts finished tries, so the check is ``attempts + 1``.
    Lease expiry is the board's concern, not this loop's.
    """

    def __init__(self, board: JobBoard, engine: ImageEngine, store: ObjectStore):
        self.board = board
        self.engine = engine
        self.store = store
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []

    def run_once(self, *, block_seconds: int | None = None) -> bool:
        """Process a single claimed job. Return False when the queue was empty."""
        timeout = QUEUE_BLOCK_SECONDS if block_seconds is None else block_seconds
        job = self.board.claim(timeout)
        if job is None:
            return False
        logger.info("claimed %s attempt=%s", job.job_id, job.attempts)
        try:
            body, content_type = self.engine.edit(job)
            key = f"{OBJECT_PREFIX}/{job.job_id}{_extension(content_type)}"
            result_ref = self.store.put(key, body, content_type)
        except Exception as exc:
            logger.info("job %s failed: %s", job.job_id, exc)
            self._settle_failure(job, exc)
            return True
        self.board.ack(job.job_id, result_ref)
        logger.info("finished %s", job.job_id)
        return True

    def _settle_failure(self, job: JobRecord, exc: Exception) -> None:
        message = str(exc) or exc.__class__.__name__
        if job.attempts + 1 >= MAX_ATTEMPTS:
            self.board.fail(job.job_id, message)
        else:
            self.board.retry(job.job_id, message)

    def start(self) -> None:
        if self._threads:
            return
        self._stop.clear()
        for index in range(WORKER_CONCURRENCY):
            thread = threading.Thread(
                target=self._loop,
                name=f"imgrelay-worker-{index}",
                daemon=True,
            )
            thread.start()
            self._threads.append(thread)
        logger.info("scheduler started with %s workers", WORKER_CONCURRENCY)

    def stop(self) -> None:
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=QUEUE_BLOCK_SECONDS + 1)
        self._threads.clear()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.run_once()
            except Exception:
                logger.exception("worker iteration failed")
                time.sleep(0.5)
