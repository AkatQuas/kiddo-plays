"""Object storage seam.

Two adapters, both local to how this pod publishes results:
- ``S3Store`` talks to any S3-compatible endpoint (AWS, MinIO, R2, ...).
- ``LocalStore`` writes under a directory inside the pod.

``put`` returns a result reference the caller can hand back: a presigned
URL, or an absolute path. The scheduler does not care which.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from imgrelay.constants import PRESIGN_SECONDS, S3_CREATE_BUCKET


class StorageError(RuntimeError):
    """The object could not be written."""


class ObjectStore(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes and return a reference another caller can use."""


class S3Store:
    def __init__(
        self,
        endpoint_url: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        region: str,
        create_bucket: bool = S3_CREATE_BUCKET,
    ):
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
            config=Config(s3={"addressing_style": "path"}),
        )
        if create_bucket:
            self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.client.create_bucket(Bucket=self.bucket)
            except ClientError as exc:
                raise StorageError(f"cannot create bucket {self.bucket}: {exc}") from exc

    def put(self, key: str, data: bytes, content_type: str) -> str:
        key = key.lstrip("/")
        try:
            self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=PRESIGN_SECONDS,
            )
        except ClientError as exc:
            raise StorageError(str(exc)) from exc


class LocalStore:
    """Pod-local files. Other pods cannot read these paths."""

    def __init__(self, root: str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, data: bytes, content_type: str) -> str:
        del content_type
        path = self.root / key.lstrip("/")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return str(path.resolve())
