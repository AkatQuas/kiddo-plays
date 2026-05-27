from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from repo_report.models import CommitInfo

logger = logging.getLogger("repo_report.git")


class GitOperations:
    def __init__(self, lookback_days: int = 7) -> None:
        self._lookback_days = lookback_days

    def sync_repo(self, url: str, branch: str, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        local = Path(url).expanduser()
        if local.exists() and (local / ".git").exists() and not (path / ".git").exists():
            self._run(["git", "clone", str(local.resolve()), str(path)])
            self._run(["git", "-C", str(path), "checkout", branch])
            return
        if not (path / ".git").exists():
            clone_url = str(local.resolve()) if local.exists() else url
            self._run(
                [
                    "git",
                    "clone",
                    "--branch",
                    branch,
                    "--single-branch",
                    clone_url,
                    str(path),
                ]
            )
            return
        self._run(["git", "-C", str(path), "fetch", "origin"])
        self._run(["git", "-C", str(path), "checkout", branch])
        self._run(["git", "-C", str(path), "pull", "--ff-only", "origin", branch])

    def head_sha(self, path: Path) -> str:
        return self._run(["git", "-C", str(path), "rev-parse", "HEAD"]).strip()

    def collect_commits(
        self,
        path: Path,
        since_sha: str | None,
        since_date: datetime | None = None,
        until_date: datetime | None = None,
    ) -> list[CommitInfo]:
        args = [
            "git",
            "-C",
            str(path),
            "log",
            "--no-merges",
            "--format=%H|%h|%an|%ae|%s|%ci",
        ]
        if since_sha:
            args.append(f"{since_sha}..HEAD")
        elif since_date:
            args.append(f"--since={since_date.isoformat()}")
        if until_date:
            args.append(f"--until={until_date.isoformat()}")

        output = self._run(args)
        commits: list[CommitInfo] = []
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("|", 5)
            if len(parts) < 6:
                continue
            sha, short_id, author, email, message, committed_at = parts
            if not self._has_file_changes(path, sha):
                continue
            if self._is_comment_only(path, sha):
                continue
            commits.append(
                CommitInfo(
                    sha=sha,
                    short_id=short_id,
                    author=author,
                    email=email,
                    message=message,
                    committed_at=committed_at,
                )
            )
        return list(reversed(commits))

    def default_since_date(self) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=self._lookback_days)

    def _has_file_changes(self, path: Path, sha: str) -> bool:
        out = self._run(
            [
                "git",
                "-C",
                str(path),
                "diff-tree",
                "--no-commit-id",
                "--name-only",
                "-r",
                sha,
            ]
        )
        return bool(out.strip())

    def _is_comment_only(self, path: Path, sha: str) -> bool:
        out = self._run(["git", "-C", str(path), "show", "--numstat", "--format=", sha])
        for line in out.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                try:
                    added = int(parts[0]) if parts[0] != "-" else 0
                    deleted = int(parts[1]) if parts[1] != "-" else 0
                    if added > 0 or deleted > 0:
                        return False
                except ValueError:
                    continue
        return bool(out.strip())

    def _run(self, cmd: list[str]) -> str:
        logger.debug("Running: %s", " ".join(cmd))
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Git command failed ({result.returncode}): {' '.join(cmd)}\n"
                f"stderr: {result.stderr.strip()}"
            )
        return result.stdout
