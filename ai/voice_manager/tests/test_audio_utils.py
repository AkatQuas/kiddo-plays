from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from audio_utils import asr_recognize, encode_audio_bytes, validate_audio_file
from common.exceptions import VoiceException


@pytest.mark.asyncio
async def test_asr_recognize_sends_encoded_audio_and_auth_header() -> None:
    audio = b"raw-wav"
    mock_resp = AsyncMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = AsyncMock(return_value={"data": {"text": "你好"}})
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=None)

    session = MagicMock()
    session.post.return_value = mock_resp

    with patch("audio_utils.get_http_session", new_callable=AsyncMock, return_value=session):
        text = await asr_recognize(audio)

    assert text == "你好"
    kwargs = session.post.call_args.kwargs
    assert kwargs["json"]["audio"] == [encode_audio_bytes(audio)]
    assert kwargs["headers"]["Authorization"] == "Bearer test"


def test_validate_audio_duration_message() -> None:
    too_long = MagicMock()
    too_long.__len__ = lambda self: 45_000
    with patch("audio_utils.pydub.AudioSegment.from_file", return_value=too_long):
        with pytest.raises(VoiceException) as exc_info:
            validate_audio_file(b"x" * 100)
    assert exc_info.value.status_code == 400
    assert "must be 10-30 seconds" in exc_info.value.detail
    assert "45.00s" in exc_info.value.detail
