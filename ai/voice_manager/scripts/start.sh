#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-36800}"
HOST="${HOST:-0.0.0.0}"
CONFIG_PATH="${CONFIG_PATH:-$ROOT/config/config.json}"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Error: config file not found: $CONFIG_PATH"
    exit 1
fi

echo "Starting Voice Manager API on ${HOST}:${PORT} (config: ${CONFIG_PATH})"
export PYTHONPATH="$ROOT/src${PYTHONPATH:+:$PYTHONPATH}"
exec uv run python "$ROOT/src/main.py" --host "$HOST" --port "$PORT" --config-path "$CONFIG_PATH"
