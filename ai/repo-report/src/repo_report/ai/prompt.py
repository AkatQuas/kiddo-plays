from __future__ import annotations

from pathlib import Path

from repo_report.ai.base import AnalyzeContext

# Bundled prompt: repo-report/prompts/analyze_repo.txt (sibling of src/)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PROMPT_PATH = _PROJECT_ROOT / "prompts" / "analyze_repo.txt"


def load_prompt_template(path: Path | None = None) -> str:
    path = path or DEFAULT_PROMPT_PATH
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text(encoding="utf-8")


def format_commit_list(commits: list) -> str:
    if not commits:
        return "(no commits)"
    lines = []
    for c in commits:
        lines.append(
            f"- {c.short_id} | {c.author} <{c.email}> | {c.committed_at}\n"
            f"  {c.message}"
        )
    return "\n".join(lines)


def render_analyze_prompt(template: str, ctx: AnalyzeContext) -> str:
    return template.format(
        repo_name=ctx.repo_name,
        repo_url=ctx.repo_url,
        branch=ctx.branch,
        repo_path=str(ctx.repo_path.resolve()),
        stat_period=ctx.stat_period,
        commit_list=format_commit_list(ctx.commits),
        commit_count=len(ctx.commits),
    )
