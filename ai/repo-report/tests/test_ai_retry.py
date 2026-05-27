from repo_report.ai.claude_code import ClaudeCodeAgent
from repo_report.config.loader import AIConfig


def test_should_retry_on_429():
    agent = ClaudeCodeAgent(AIConfig(max_retries=3))
    exc = RuntimeError("Claude CLI exit code 1: Error 429 rate limit exceeded")
    assert agent._should_retry(exc, attempt=1) is True


def test_should_not_retry_on_exit_2():
    agent = ClaudeCodeAgent(AIConfig(max_retries=3))
    exc = RuntimeError("Claude CLI exit code 2: invalid config")
    assert agent._should_retry(exc, attempt=1) is False


def test_should_not_retry_after_max():
    agent = ClaudeCodeAgent(AIConfig(max_retries=3))
    exc = RuntimeError("Error 500 server")
    assert agent._should_retry(exc, attempt=3) is False
