#!/usr/bin/env bash
set -euo pipefail

cd /app

CONFIG_PATH="${CONFIG_PATH:-config/config.docker.json}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-36800}"

exec uv run python src/main.py --host "${HOST}" --port "${PORT}" --config-path "${CONFIG_PATH}"
