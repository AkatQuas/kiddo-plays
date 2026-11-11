# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, BinaryIO

import boto3
from botocore.client import Config
from loguru import logger

from agent_websearch.settings import Settings, get_settings


class S3Storage:
    """Object storage via boto3 against any S3-compatible endpoint."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = None

    def configured(self) -> bool:
        s = self.settings
        return bool(s.s3_access_key_id and s.s3_secret_access_key and s.s3_bucket)

    def _client_or_raise(self):
        if not self.configured():
            raise RuntimeError(
                "S3 is not configured; set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET"
            )
        if self._client is None:
            kwargs: dict[str, Any] = {
                "service_name": "s3",
                "aws_access_key_id": self.settings.s3_access_key_id,
                "aws_secret_access_key": self.settings.s3_secret_access_key,
                "region_name": self.settings.s3_region,
                "config": Config(
                    s3={"addressing_style": "path" if self.settings.s3_force_path_style else "auto"}
                ),
            }
            if self.settings.s3_endpoint_url:
                kwargs["endpoint_url"] = self.settings.s3_endpoint_url
            self._client = boto3.client(**kwargs)
        return self._client

    @property
    def bucket(self) -> str:
        return self.settings.s3_bucket

    def upload_bytes(
        self,
        object_key: str,
        body: bytes,
        content_type: str | None = None,
    ) -> str:
        client = self._client_or_raise()
        extra: dict[str, Any] = {}
        if content_type:
            extra["ContentType"] = content_type
        client.put_object(Bucket=self.bucket, Key=object_key, Body=body, **extra)
        logger.info(f"uploaded s3://{self.bucket}/{object_key} ({len(body)} bytes)")
        return object_key

    def upload_fileobj(
        self,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None = None,
    ) -> str:
        client = self._client_or_raise()
        extra: dict[str, Any] = {}
        if content_type:
            extra["ContentType"] = content_type
        client.upload_fileobj(fileobj, self.bucket, object_key, ExtraArgs=extra or None)
        logger.info(f"uploaded fileobj to s3://{self.bucket}/{object_key}")
        return object_key

    def download_bytes(self, object_key: str) -> bytes:
        client = self._client_or_raise()
        resp = client.get_object(Bucket=self.bucket, Key=object_key)
        return resp["Body"].read()

    def generate_presigned_url(
        self,
        object_key: str,
        *,
        expires_in: int = 3600,
        method: str = "get_object",
    ) -> str:
        client = self._client_or_raise()
        client_method = method if method in {"get_object", "put_object"} else "get_object"
        url = client.generate_presigned_url(
            ClientMethod=client_method,
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )
        return url
