from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from filelock import FileLock, Timeout


class ExecutionLock:
    def __init__(self, lock_path: Path, timeout: float = 0) -> None:
        self._lock_path = lock_path
        self._file_lock = FileLock(str(lock_path))
        self._timeout = timeout

    @contextmanager
    def acquire(self):
        try:
            self._file_lock.acquire(timeout=self._timeout)
        except Timeout as exc:
            raise RuntimeError(
                "Another repo-report instance is already running"
            ) from exc
        try:
            self._lock_path.parent.mkdir(parents=True, exist_ok=True)
            self._lock_path.write_text(str(os.getpid()), encoding="utf-8")
            yield
        finally:
            if self._lock_path.exists():
                self._lock_path.unlink(missing_ok=True)
            self._file_lock.release()
