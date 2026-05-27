from pathlib import Path

from repo_report.ai.base import AnalyzeContext
from repo_report.ai.prompt import render_analyze_prompt
from repo_report.models import CommitInfo


def test_render_analyze_prompt(tmp_path: Path):
    template = "Repo={repo_name} Path={repo_path} Count={commit_count}\n{commit_list}"
    ctx = AnalyzeContext(
        repo_name="demo",
        repo_url="git@x",
        branch="main",
        repo_path=tmp_path,
        stat_period="2026-05-27",
        commits=[
            CommitInfo(
                sha="a" * 40,
                short_id="abc",
                author="Alice",
                email="a@b.c",
                message="fix bug",
                committed_at="2026-05-27",
            )
        ],
    )
    out = render_analyze_prompt(template, ctx)
    assert "Repo=demo" in out
    assert "abc" in out
    assert "Alice" in out
