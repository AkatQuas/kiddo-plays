from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from file_utils import S3_PREFIX, delete_file, save_file_bytes


@pytest.mark.asyncio
async def test_save_file_bytes_returns_s3_uri() -> None:
    mock_client = MagicMock()
    payload = b"fake-audio-bytes"

    with patch("file_utils._get_minio_client", return_value=mock_client):
        path = await save_file_bytes(payload, filename="sample.wav")

    assert path.startswith(S3_PREFIX)
    assert path.endswith(".wav")
    mock_client.put_object.assert_called_once()
    call_kwargs = mock_client.put_object.call_args.kwargs
    assert call_kwargs["length"] == len(payload)
    assert call_kwargs["content_type"] == "audio/wav"


@pytest.mark.asyncio
async def test_save_file_bytes_uses_default_extension() -> None:
    mock_client = MagicMock()

    with patch("file_utils._get_minio_client", return_value=mock_client):
        path = await save_file_bytes(b"abc", filename="noext")

    assert path.endswith(".wav")


@pytest.mark.asyncio
async def test_save_file_bytes_raises_on_failure() -> None:
    with patch("file_utils._get_minio_client", side_effect=RuntimeError("minio down")):
        with pytest.raises(RuntimeError, match="minio down"):
            await save_file_bytes(b"abc")


@pytest.mark.asyncio
async def test_delete_file_removes_minio_object() -> None:
    mock_client = MagicMock()
    path = "s3://voices/voices/abc123.wav"

    with patch("file_utils._get_minio_client", return_value=mock_client):
        await delete_file(path)

    mock_client.remove_object.assert_called_once_with("voices", "voices/abc123.wav")


@pytest.mark.asyncio
async def test_delete_file_missing_or_empty_path_is_ok() -> None:
    mock_client = MagicMock()

    with patch("file_utils._get_minio_client", return_value=mock_client):
        await delete_file("")
        await delete_file("not-a-valid-s3-uri")

    mock_client.remove_object.assert_not_called()
