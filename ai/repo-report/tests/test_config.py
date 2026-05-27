from pathlib import Path

import pytest
import yaml

from repo_report.config.loader import AppConfig, load_config


def test_load_config(tmp_path: Path):
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(
        yaml.dump(
            {
                "global": {"repos_root": "./repos", "cursor_dir": "./cursors"},
                "ai": {"engine": "claude-code"},
                "push": {
                    "channels": [
                        {"type": "webhook", "enabled": True, "url": "http://x"}
                    ]
                },
                "repos": [
                    {
                        "name": "demo",
                        "url": "git@github.com:org/demo.git",
                        "branch": "main",
                        "enabled": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    config = load_config(cfg_file)
    assert config.global_.max_parallel_repos == 3
    assert len(config.push.channels) == 1
    assert config.push.channels[0].extra["url"] == "http://x"
    assert config.enabled_repos()[0].name == "demo"


def test_missing_config(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / "missing.yaml")
