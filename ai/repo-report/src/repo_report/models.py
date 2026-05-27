from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class RepoStatus(str, Enum):
    SUCCESS = "success"
    EMPTY = "empty"
    ERROR = "error"


@dataclass
class CommitInfo:
    sha: str
    short_id: str
    author: str
    email: str
    message: str
    committed_at: str


@dataclass
class RepoTaskConfig:
    name: str
    url: str
    branch: str
    path: Path


@dataclass
class RepoResult:
    name: str
    branch: str
    status: RepoStatus
    analysis: str = ""
    error: str = ""
    commits: list[CommitInfo] = field(default_factory=list)
    head_sha: str = ""
