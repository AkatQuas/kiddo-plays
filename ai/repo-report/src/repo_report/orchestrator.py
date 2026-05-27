from __future__ import annotations

import logging
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import fields
from datetime import date, datetime
from pathlib import Path

from repo_report.cleanup.stale import archive_stale_repos, check_disk_space
from repo_report.config.loader import AppConfig, RepoConfig, load_config
from repo_report.cursor.store import CursorStore
from repo_report.lock import ExecutionLock
from repo_report.logging_setup import setup_logging
from repo_report.models import CommitInfo, RepoResult, RepoStatus
from repo_report.push.factory import create_push_channels
from repo_report.report.builder import ReportBuilder
from repo_report.worker import config_to_dict, process_repo

logger = logging.getLogger("repo_report")


class Orchestrator:
    def __init__(
        self,
        config_path: Path,
        since: datetime | None = None,
        until: datetime | None = None,
        dry_run: bool = False,
    ) -> None:
        self._config_path = config_path
        self._since = since
        self._until = until
        self._dry_run = dry_run

    def run(self) -> int:
        config = load_config(self._config_path)
        log = setup_logging(
            config.global_.log_dir, config.global_.log_retention_days
        )
        log.info("repo-report started (dry_run=%s)", self._dry_run)

        stat_period = self._stat_period()
        lock = ExecutionLock(config.global_.lock_file)

        try:
            with lock.acquire():
                check_disk_space(config.global_.min_free_disk_mb)
                archive_stale_repos(config)

                repos = config.enabled_repos()
                if not repos:
                    log.warning("No enabled repositories in config")
                    return 0

                results = self._process_all(config, repos, stat_period)
                title, content = ReportBuilder().build(results, stat_period)
                self._log_report(log, title, content)

                if not self._dry_run:
                    self._push(config, title, content)
                    self._update_cursors(config, results)
                else:
                    log.info("Dry-run: skipping push and cursor updates")
                    print(content)

                log.info("repo-report finished successfully")
                return 0
        except Exception:
            log.exception("repo-report failed")
            return 1

    def _log_report(
        self, log: logging.Logger, title: str, content: str
    ) -> None:
        log.info("Report generated (%d chars)", len(content))
        log.info("--- Daily report: %s ---", title)
        for line in content.splitlines():
            log.info("%s", line)
        log.info("--- End of daily report ---")

    def _stat_period(self) -> str:
        if self._since and self._until:
            return f"{self._since.date()} ~ {self._until.date()}"
        if self._since:
            return f"{self._since.date()} 起"
        return str(date.today())

    def _process_all(
        self,
        config: AppConfig,
        repos: list[RepoConfig],
        stat_period: str,
    ) -> list[RepoResult]:
        config_dict = config_to_dict(config)
        since_iso = self._since.isoformat() if self._since else None
        until_iso = self._until.isoformat() if self._until else None

        results: list[RepoResult] = []
        max_workers = min(config.global_.max_parallel_repos, len(repos))

        with ProcessPoolExecutor(max_workers=max_workers) as pool:
            futures = {
                pool.submit(
                    process_repo,
                    repo.model_dump(),
                    config_dict,
                    stat_period,
                    since_iso,
                    until_iso,
                ): repo
                for repo in repos
            }
            for future in as_completed(futures):
                repo = futures[future]
                raw = future.result()
                result = _dict_to_repo_result(raw)
                results.append(result)
                logger.info(
                    "Repo %s finished: status=%s commits=%d",
                    repo.name,
                    result.status.value,
                    len(result.commits),
                )

        results.sort(key=lambda r: r.name)
        return results

    def _push(self, config: AppConfig, title: str, content: str) -> None:
        channels = create_push_channels(config.push)
        if not channels:
            logger.warning("No push channels enabled")
            return
        for channel in channels:
            result = channel.send(title, content)
            if result.success:
                logger.info("Push via %s succeeded (attempts=%d)", channel.name, result.attempts)
            else:
                logger.error(
                    "Push via %s failed after %d attempts: %s",
                    channel.name,
                    result.attempts,
                    result.message,
                )

    def _update_cursors(self, config: AppConfig, results: list[RepoResult]) -> None:
        cursor = CursorStore(config.global_.cursor_dir)
        for result in results:
            if result.status in (RepoStatus.SUCCESS, RepoStatus.EMPTY) and result.head_sha:
                cursor.append(result.name, result.branch, result.head_sha)
                logger.info(
                    "Cursor updated for %s/%s -> %s",
                    result.name,
                    result.branch,
                    result.head_sha[:8],
                )


def _dict_to_repo_result(raw: dict) -> RepoResult:
    commits = [CommitInfo(**c) for c in raw.pop("commits", [])]
    status = RepoStatus(raw.get("status", RepoStatus.ERROR.value))
    if isinstance(status, str):
        status = RepoStatus(status)
    field_names = {f.name for f in fields(RepoResult)}
    kwargs = {k: v for k, v in raw.items() if k in field_names}
    kwargs["status"] = status
    kwargs["commits"] = commits
    return RepoResult(**kwargs)
