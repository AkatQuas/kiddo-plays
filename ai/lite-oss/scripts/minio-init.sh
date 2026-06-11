#!/bin/sh
set -eu

echo "Waiting for MinIO..."
until mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 2
done

if ! mc ls "local/$MINIO_BUCKET" >/dev/null 2>&1; then
  mc mb "local/$MINIO_BUCKET"
fi

mc anonymous set public "local/$MINIO_BUCKET"

echo "MinIO bucket '$MINIO_BUCKET' is ready."
