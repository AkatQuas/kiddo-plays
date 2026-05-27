from pathlib import Path

from repo_report.cursor.store import CursorStore


def test_cursor_append_and_read(tmp_path: Path):
    store = CursorStore(tmp_path)
    assert store.read_last("ordering", "main") is None
    store.append("ordering", "main", "abc123")
    store.append("ordering", "main", "def456")
    assert store.read_last("ordering", "main") == "def456"
