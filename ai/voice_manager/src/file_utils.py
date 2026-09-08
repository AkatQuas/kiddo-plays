import asyncio
import io
import uuid
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from common.config import get_server_config
from common.log import logger

S3_PREFIX = "s3://"

_minio_client: Minio | None = None


def _get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        storage = get_server_config().storage_config
        _minio_client = Minio(
            storage.endpoint,
            access_key=storage.access_key,
            secret_key=storage.secret_key,
            secure=storage.secure,
        )
    return _minio_client


def reset_minio_client() -> None:
    global _minio_client
    _minio_client = None


def _build_object_key(filename: str) -> str:
    ext = Path(filename).suffix or ".wav"
    return f"voices/{uuid.uuid4().hex}{ext}"


def _to_s3_uri(bucket: str, object_key: str) -> str:
    return f"{S3_PREFIX}{bucket}/{object_key}"


def _parse_s3_uri(path: str) -> tuple[str, str] | None:
    if not path.startswith(S3_PREFIX):
        return None
    without_scheme = path[len(S3_PREFIX) :]
    bucket, _, object_key = without_scheme.partition("/")
    if not bucket or not object_key:
        return None
    return bucket, object_key


def _put_object(data: bytes, filename: str) -> str:
    storage = get_server_config().storage_config
    client = _get_minio_client()
    object_key = _build_object_key(filename)
    client.put_object(
        storage.bucket,
        object_key,
        data=io.BytesIO(data),
        length=len(data),
        content_type="audio/wav",
    )
    s3_uri = _to_s3_uri(storage.bucket, object_key)
    logger.info(f"Saved file to MinIO, path={s3_uri}, filename={filename}, size={len(data)}")
    return s3_uri


def _delete_file(path: str) -> None:
    parsed = _parse_s3_uri(path)
    if parsed is None:
        logger.warning(f"Invalid MinIO path when deleting, path={path}")
        return

    bucket, object_key = parsed
    client = _get_minio_client()
    try:
        client.remove_object(bucket, object_key)
        logger.info(f"Deleted MinIO object, path={path}")
    except S3Error as e:
        if e.code == "NoSuchKey":
            logger.warning(f"MinIO object not found when deleting, path={path}")
            return
        raise


async def save_file_bytes(data: bytes, filename: str = "audio.wav") -> str:
    """Save audio bytes to MinIO and return the s3:// URI."""
    try:
        return await asyncio.to_thread(_put_object, data, filename)
    except Exception as e:
        logger.error(f"Save bytes failed: {e}")
        raise


async def delete_file(path: str) -> None:
    """Delete stored audio from MinIO; missing objects are treated as success."""
    if not path:
        return
    try:
        await asyncio.to_thread(_delete_file, path)
    except Exception as e:
        logger.error(f"Delete file failed, path={path}: {e}")
        raise
