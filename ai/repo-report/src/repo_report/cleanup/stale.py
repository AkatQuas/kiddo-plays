from __future__ import annotations

import logging
import shutil
from datetime import datetime
from pathlib import Path

from repo_report.config.loader import AppConfig

logger = logging.getLogger("repo_report.cleanup")


def check_disk_space(min_free_mb: int) -> None:
    usage = shutil.disk_usage("/")
    free_mb = usage.free // (1024 * 1024)
    if free_mb < min_free_mb:
        raise RuntimeError(
            f"Insufficient disk space: {free_mb}MB free, need {min_free_mb}MB"
        )


def archive_stale_repos(config: AppConfig) -> None:
    active_names = {r.name for r in config.enabled_repos()}
    archive_root = Path("/tmp") / "repo-report-archive" / datetime.now().strftime(
        "%Y%m%d-%H%M%S"
    )

    repos_root = config.global_.repos_root
    if repos_root.exists():
        for entry in repos_root.iterdir():
            if entry.is_dir() and entry.name not in active_names:
                dest = archive_root / "repos" / entry.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(entry), str(dest))
                logger.info("Archived stale repo %s -> %s", entry, dest)

    cursor_dir = config.global_.cursor_dir
    if cursor_dir.exists():
        for cursor_file in cursor_dir.glob("*.cursor.log"):
            repo_part = cursor_file.stem.split("_")[0]
            if repo_part not in active_names:
                dest = archive_root / "cursors" / cursor_file.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(cursor_file), str(dest))
                logger.info("Archived stale cursor %s -> %s", cursor_file, dest)
