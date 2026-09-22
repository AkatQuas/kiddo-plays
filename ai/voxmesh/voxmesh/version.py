from __future__ import annotations

from pathlib import Path

_VERSION_FILE = Path(__file__).resolve().parent / "version.txt"


def get_version(default: str = "unknown") -> str:
    try:
        return _VERSION_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return default
