from __future__ import annotations

import logging
import re
import subprocess
import time

from repo_report.ai.base import AIAgent, AnalyzeContext
from repo_report.ai.prompt import load_prompt_template, render_analyze_prompt
from repo_report.config.loader import AIConfig

logger = logging.getLogger("repo_report.ai")

RETRYABLE_PATTERN = re.compile(r"\b(401|429|500)\b|rate.?limit|overloaded|timeout", re.I)
NON_RETRYABLE_EXIT = {2}


class ClaudeCodeAgent(AIAgent):
    def __init__(self, config: AIConfig) -> None:
        self._config = config
        self._template = load_prompt_template()

    def analyze(self, ctx: AnalyzeContext) -> str:
        prompt = render_analyze_prompt(self._template, ctx)
        last_error: Exception | None = None

        for attempt in range(1, self._config.max_retries + 1):
            try:
                return self._invoke(prompt)
            except Exception as exc:
                last_error = exc
                if not self._should_retry(exc, attempt):
                    raise
                delay = self._config.retry_interval_seconds
                logger.warning(
                    "AI attempt %d/%d failed (%s), retrying in %ds",
                    attempt,
                    self._config.max_retries,
                    exc,
                    delay,
                )
                time.sleep(delay)

        raise RuntimeError(
            f"AI analysis failed after {self._config.max_retries} attempts"
        ) from last_error

    def _should_retry(self, exc: Exception, attempt: int) -> bool:
        if attempt >= self._config.max_retries:
            return False
        msg = str(exc)
        if isinstance(exc, subprocess.TimeoutExpired):
            return True
        if isinstance(exc, RuntimeError):
            if "exit code" in msg:
                for code in NON_RETRYABLE_EXIT:
                    if f"exit code {code}" in msg:
                        return False
            if RETRYABLE_PATTERN.search(msg):
                return True
        return RETRYABLE_PATTERN.search(msg) is not None

    def _invoke(self, prompt: str) -> str:
        cmd = [
            "claude",
            "--max-turns",
            str(self._config.max_turns),
            "--allowed-tools",
            "Read,Grep,Glob,LS",
            "--disallowed-tools",
            "Edit,Write,Bash,Task,NotebookEdit,WebFetch,WebSearch",
            "-p",
            prompt,
        ]
        logger.info("Invoking Claude Code CLI (timeout=%ds)", self._config.timeout_seconds)
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self._config.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("AI subprocess timeout") from exc

        combined = (result.stdout or "") + (result.stderr or "")
        if result.returncode != 0:
            raise RuntimeError(
                f"Claude CLI exit code {result.returncode}: {combined[:2000]}"
            )
        output = (result.stdout or "").strip()
        if not output:
            raise RuntimeError(f"Claude CLI returned empty output: {combined[:500]}")
        return output
