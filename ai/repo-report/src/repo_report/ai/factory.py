from __future__ import annotations

from repo_report.ai.base import AIAgent
from repo_report.ai.claude_code import ClaudeCodeAgent
from repo_report.config.loader import AIConfig

_REGISTRY: dict[str, type[AIAgent]] = {
    "claude-code": ClaudeCodeAgent,
}


def create_ai_agent(config: AIConfig) -> AIAgent:
    engine = config.engine.strip().lower()
    cls = _REGISTRY.get(engine)
    if cls is None:
        raise ValueError(
            f"Unknown AI engine '{engine}'. Available: {list(_REGISTRY)}"
        )
    return cls(config)
