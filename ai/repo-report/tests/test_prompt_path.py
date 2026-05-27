from repo_report.ai.prompt import DEFAULT_PROMPT_PATH, load_prompt_template


def test_default_prompt_exists():
    assert DEFAULT_PROMPT_PATH.name == "analyze_repo.txt"
    assert DEFAULT_PROMPT_PATH.parent.name == "prompts"
    assert DEFAULT_PROMPT_PATH.exists()
    text = load_prompt_template()
    assert "{repo_name}" in text
