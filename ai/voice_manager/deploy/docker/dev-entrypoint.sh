#!/usr/bin/env bash
set -euo pipefail

cd /app

if ! command -v uv >/dev/null 2>&1; then
  pip install --no-cache-dir uv
fi

uv sync

export PYTHONPATH=/app/src

CONFIG_PATH="${CONFIG_PATH:-config/config.docker.json}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-36800}"

if [ "${UVICORN_RELOAD:-1}" = "1" ]; then
  exec uv run uvicorn main:app --app-dir src --host "${HOST}" --port "${PORT}" --reload
fi

exec uv run python src/main.py --host "${HOST}" --port "${PORT}" --config-path "${CONFIG_PATH}"
