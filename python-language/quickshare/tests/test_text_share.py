import pytest

from quickshare.text_share import TextShare, TextShareError


def board(tmp_path, max_content=50):
    return TextShare(tmp_path / "texts.json", max_content)


def test_get_returns_the_saved_text(tmp_path):
    notes = board(tmp_path)
    created = notes.create("正文")
    assert notes.get(created.id).content == "正文"
    with pytest.raises(TextShareError) as raised:
        notes.get("missing")
    assert raised.value.status == 404


def test_update_keeps_the_same_id(tmp_path):
    notes = board(tmp_path)
    created = notes.create("第一版")
    updated = notes.update(created.id, "第二版")
    assert updated.id == created.id
    assert updated.created == created.created
    assert updated.content == "第二版"
    assert updated.updated
    assert notes.list_texts()[0].id == created.id


def test_blank_and_overlong_text_is_rejected(tmp_path):
    notes = board(tmp_path)
    with pytest.raises(TextShareError, match="缺少内容"):
        notes.create("  ")
    with pytest.raises(TextShareError, match="内容不能超过"):
        notes.create("正" * 51)


def test_update_missing_text_and_clear(tmp_path):
    notes = board(tmp_path)
    created = notes.create("内容")
    with pytest.raises(TextShareError) as raised:
        notes.update("missing", "内容")
    assert raised.value.status == 404
    notes.clear()
    assert notes.list_texts() == []
    notes.create("另一条")
    notes.delete(notes.list_texts()[0].id)
    assert notes.list_texts() == []
    assert created.id not in (tmp_path / "texts.json").read_text(encoding="utf-8")
