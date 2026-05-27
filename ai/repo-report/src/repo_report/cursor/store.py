from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from filelock import FileLock


class CursorStore:
    def __init__(self, cursor_dir: Path) -> None:
        self._cursor_dir = cursor_dir
        self._cursor_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, repo_name: str, branch: str) -> Path:
        safe_branch = branch.replace("/", "_")
        return self._cursor_dir / f"{repo_name}_{safe_branch}.cursor.log"

    def read_last(self, repo_name: str, branch: str) -> str | None:
        path = self._path(repo_name, branch)
        if not path.exists():
            return None
        lines = [
            ln.strip()
            for ln in path.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        ]
        if not lines:
            return None
        return lines[-1].split("|", 1)[-1].strip()

    def append(self, repo_name: str, branch: str, commit_sha: str) -> None:
        path = self._path(repo_name, branch)
        lock = FileLock(str(path) + ".lock")
        ts = datetime.now(timezone.utc).isoformat()
        line = f"{ts}|{commit_sha}\n"
        with lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(line)
