from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from common.exceptions import DuplicateVoiceError, VoiceException
from schemas.voice import VoiceCreate
from services.voices import create_voice, decode_audio_data, get_voice, list_voices


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_health_allows_missing_uid(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "voice-manager"}
    assert "X-Request-ID" in response.headers


def test_missing_uid_is_unauthorized(client: TestClient) -> None:
    response = client.get("/v1/voices")
    assert response.status_code == 401
    assert response.json()["error"] == "Missing X-UID"


def test_public_create_requires_admin(client: TestClient) -> None:
    response = client.post(
        "/v1/public/voices",
        headers={"X-UID": "not-admin"},
        json={
            "voice_name": "demo",
            "audio_data": "YQ==",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"] == "Forbidden"


def test_openapi_describes_rest_resources(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/v1/voices" in paths
    assert "/v1/voices/{voice_id}" in paths
    assert "/v1/public/voices" in paths
    assert "post" in paths["/v1/voices"]
    assert "get" in paths["/v1/voices/{voice_id}"]
    assert "delete" in paths["/v1/voices/{voice_id}"]


def test_decode_audio_data_variants() -> None:
    import base64

    raw = b"hello-audio"
    encoded = base64.b64encode(raw).decode("utf-8")
    assert decode_audio_data(encoded) == raw
    assert decode_audio_data(f"data:audio/wav;base64,{encoded}") == raw
    assert decode_audio_data(encoded.rstrip("=")) == raw
    assert decode_audio_data(f"{encoded}\n") == raw
    with pytest.raises(VoiceException) as exc_info:
        decode_audio_data("!!!not-base64!!!")
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_create_voice_rolls_back_object_on_duplicate() -> None:
    import base64

    db = MagicMock()
    db.create_voice_meta.side_effect = DuplicateVoiceError("demo")
    body = VoiceCreate(
        voice_name="demo", audio_data=base64.b64encode(b"wav").decode(), audio_content="hello"
    )

    with (
        patch("services.voices.validate_audio_file"),
        patch(
            "services.voices.save_file_bytes",
            new_callable=AsyncMock,
            return_value="s3://voices/a.wav",
        ),
        patch("services.voices.delete_file", new_callable=AsyncMock) as delete_mock,
    ):
        with pytest.raises(VoiceException) as exc_info:
            await create_voice(db, "u1", body, is_public=False)

    assert exc_info.value.status_code == 409
    delete_mock.assert_awaited_once_with("s3://voices/a.wav")


@pytest.mark.asyncio
async def test_create_voice_uses_asr_when_content_missing() -> None:
    import base64

    db = MagicMock()
    db.create_voice_meta.return_value = SimpleNamespace(
        id=7,
        voice_name="demo",
        voice_content="from-asr",
        voice_path="s3://voices/a.wav",
        created_at=None,
    )
    body = VoiceCreate(voice_name="demo", audio_data=base64.b64encode(b"wav").decode())

    with (
        patch("services.voices.validate_audio_file"),
        patch(
            "services.voices.asr_recognize", new_callable=AsyncMock, return_value="from-asr"
        ) as asr,
        patch(
            "services.voices.save_file_bytes",
            new_callable=AsyncMock,
            return_value="s3://voices/a.wav",
        ),
    ):
        result = await create_voice(db, "u1", body, is_public=False)

    asr.assert_awaited_once_with(b"wav")
    assert result.id == 7
    assert result.voice_content == "from-asr"


@pytest.mark.asyncio
async def test_list_voices_page() -> None:
    voice = SimpleNamespace(
        id=1,
        voice_name="demo",
        voice_content="hi",
        voice_path="s3://voices/a.wav",
        created_at=datetime(2026, 1, 1),
    )
    db = MagicMock()
    db.list_voices_by_user.return_value = ([voice], 1)

    page = await list_voices(db, "u1", is_public=False, offset=0, limit=50)
    db.list_voices_by_user.assert_called_once_with("u1", offset=0, limit=50)
    assert page.total == 1
    assert page.items[0].id == 1


@pytest.mark.asyncio
async def test_get_private_filters_is_public() -> None:
    db = MagicMock()
    db.get_voice_by_id.return_value = SimpleNamespace(
        id=2,
        voice_name="mine",
        voice_content="hi",
        voice_path="s3://voices/a.wav",
        created_at=None,
    )
    result = await get_voice(db, 2, "u1", is_public=False)
    db.get_voice_by_id.assert_called_once_with(2, "u1", is_public=False)
    assert result.id == 2


@pytest.mark.asyncio
async def test_get_public_not_found() -> None:
    db = MagicMock()
    db.get_voice_by_id.return_value = None
    with pytest.raises(VoiceException) as exc_info:
        await get_voice(db, 9, "u1", is_public=True)
    db.get_voice_by_id.assert_called_once_with(9, "u1", is_public=True)
    assert exc_info.value.status_code == 404
