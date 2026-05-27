from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from repo_report.models import CommitInfo


@dataclass
class AnalyzeContext:
    repo_name: str
    repo_url: str
    branch: str
    repo_path: Path
    stat_period: str
    commits: list[CommitInfo]


class AIAgent(ABC):
    @abstractmethod
    def analyze(self, ctx: AnalyzeContext) -> str:
        """Return per-repo analysis text."""
