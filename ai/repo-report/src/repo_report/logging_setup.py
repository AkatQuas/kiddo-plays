from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path


def setup_logging(log_dir: Path, retention_days: int) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    _cleanup_old_logs(log_dir, retention_days)

    log_file = log_dir / f"repo-report-{datetime.now():%Y-%m-%d}.log"
    logger = logging.getLogger("repo_report")
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(logging.INFO)
    sh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def _cleanup_old_logs(log_dir: Path, retention_days: int) -> None:
    cutoff = datetime.now() - timedelta(days=retention_days)
    for path in log_dir.glob("repo-report-*.log"):
        try:
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            if mtime < cutoff:
                path.unlink()
        except OSError:
            pass
