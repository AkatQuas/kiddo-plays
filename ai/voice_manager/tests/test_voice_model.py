from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from common.exceptions import DuplicateVoiceError
from voice_model import VoiceMetaModel, _is_duplicate_voice_name


@pytest.fixture
def db(tmp_path) -> VoiceMetaModel:
    model = VoiceMetaModel(db_url=f"sqlite:///{tmp_path / 'voices.db'}")
    model.create_table()
    return model


def test_create_and_list_private_voices(db: VoiceMetaModel) -> None:
    voice = db.create_voice_meta("u1", "demo", "s3://voices/a.wav", "hello", is_public=False)
    listed, total = db.list_voices_by_user("u1")
    assert total == 1
    assert len(listed) == 1
    assert listed[0].id == voice.id
    assert listed[0].voice_name == "demo"
    public_items, public_total = db.list_public_voices()
    assert public_items == []
    assert public_total == 0


def test_public_voice_not_returned_as_private(db: VoiceMetaModel) -> None:
    public = db.create_voice_meta("admin", "pub", "s3://voices/p.wav", "hi", is_public=True)
    assert db.get_voice_by_id(public.id, "u1", is_public=True) is not None
    assert db.get_voice_by_id(public.id, "u1", is_public=False) is None
    listed, total = db.list_voices_by_user("admin")
    assert listed == []
    assert total == 0


def test_private_voice_not_returned_as_public(db: VoiceMetaModel) -> None:
    private = db.create_voice_meta("u1", "mine", "s3://voices/m.wav", "hi", is_public=False)
    assert db.get_voice_by_id(private.id, "u1", is_public=False) is not None
    assert db.get_voice_by_id(private.id, "u1", is_public=True) is None
    assert db.get_voice_by_id(private.id, "other", is_public=False) is None


def test_duplicate_voice_name_raises(db: VoiceMetaModel) -> None:
    db.create_voice_meta("u1", "demo", "s3://voices/a.wav", "hello", is_public=False)
    with pytest.raises(DuplicateVoiceError):
        db.create_voice_meta("u1", "demo", "s3://voices/b.wav", "hello", is_public=False)


def test_user_unique_error_is_not_duplicate_voice() -> None:
    user_err = IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: users.id"))
    voice_err = IntegrityError(
        "INSERT", {}, Exception("UNIQUE constraint failed: voices.owner_id, voices.voice_name")
    )
    pg_err = IntegrityError(
        "INSERT",
        {},
        Exception('duplicate key value violates unique constraint "uq_voice_owner_name"'),
    )
    assert not _is_duplicate_voice_name(user_err)
    assert _is_duplicate_voice_name(voice_err)
    assert _is_duplicate_voice_name(pg_err)
