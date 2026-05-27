from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from repo_report.ai.base import AnalyzeContext
from repo_report.ai.factory import create_ai_agent
from repo_report.config.loader import AIConfig, AppConfig, RepoConfig
from repo_report.cursor.store import CursorStore
from repo_report.git.operations import GitOperations
from repo_report.models import CommitInfo, RepoResult, RepoStatus


def process_repo(
    repo_dict: dict,
    config_dict: dict,
    stat_period: str,
    since_iso: str | None,
    until_iso: str | None,
) -> dict:
    repo = RepoConfig.model_validate(repo_dict)
    config = _rebuild_config(config_dict)
    repo_path = config.repo_path(repo)
    git = GitOperations(lookback_days=config.global_.init_lookback_days)
    cursor = CursorStore(config.global_.cursor_dir)

    since_dt = datetime.fromisoformat(since_iso) if since_iso else None
    until_dt = datetime.fromisoformat(until_iso) if until_iso else None

    try:
        git.sync_repo(repo.url, repo.branch, repo_path)
        head_sha = git.head_sha(repo_path)
        since_sha = cursor.read_last(repo.name, repo.branch)

        if since_iso or until_iso:
            commits = git.collect_commits(
                repo_path, since_sha=None, since_date=since_dt, until_date=until_dt
            )
        elif since_sha:
            commits = git.collect_commits(repo_path, since_sha=since_sha)
        else:
            commits = git.collect_commits(
                repo_path,
                since_sha=None,
                since_date=git.default_since_date(),
            )

        if not commits:
            return asdict(
                RepoResult(
                    name=repo.name,
                    branch=repo.branch,
                    status=RepoStatus.EMPTY,
                    head_sha=head_sha,
                )
            )

        agent = create_ai_agent(config.ai)
        ctx = AnalyzeContext(
            repo_name=repo.name,
            repo_url=repo.url,
            branch=repo.branch,
            repo_path=repo_path,
            stat_period=stat_period,
            commits=commits,
        )
        analysis = agent.analyze(ctx)
        return asdict(
            RepoResult(
                name=repo.name,
                branch=repo.branch,
                status=RepoStatus.SUCCESS,
                analysis=analysis,
                commits=commits,
                head_sha=head_sha,
            )
        )
    except Exception as exc:
        return asdict(
            RepoResult(
                name=repo.name,
                branch=repo.branch,
                status=RepoStatus.ERROR,
                error=str(exc),
            )
        )


def _rebuild_config(config_dict: dict) -> AppConfig:
    return AppConfig.model_validate(config_dict)


def config_to_dict(config: AppConfig) -> dict:
    return config.model_dump(by_alias=True)
