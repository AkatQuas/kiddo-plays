#!/usr/bin/env bash
# Start the streaming ASR WebSocket service.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env
resolve_python

DEFAULT_MAX_CLIENT=4
DEFAULT_PORT=36005
DEFAULT_LOG_DIR="./logs"
DEFAULT_DEVICE="cuda"
DEFAULT_PLATFORM="NV"
DEFAULT_BACKGROUND=false
DEFAULT_SESSION_DIR="./sessions"

MAX_CLIENT="${MAX_CLIENT:-$DEFAULT_MAX_CLIENT}"
PORT="${ASR_STREAM_PORT:-$DEFAULT_PORT}"
LOG_DIR="${LOG_DIR:-$DEFAULT_LOG_DIR}"
DEVICE="${DEVICE:-$DEFAULT_DEVICE}"
PLATFORM="${PLATFORM:-$DEFAULT_PLATFORM}"
BACKGROUND="${BACKGROUND:-$DEFAULT_BACKGROUND}"
SESSION_DIR="${SESSION_DIR:-$DEFAULT_SESSION_DIR}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start VoxMesh streaming ASR (WebSocket).

Options:
  --port PORT           Server port (default: ${DEFAULT_PORT})
  --max_clients NUM     Maximum concurrent clients (default: ${DEFAULT_MAX_CLIENT})
  --log_dir DIR         Log directory (default: ${DEFAULT_LOG_DIR})
  --device DEVICE       Inference device (default: ${DEFAULT_DEVICE})
  --platform PLATFORM   Hardware platform: NV, HW, MX (default: ${DEFAULT_PLATFORM})
  --session_dir DIR     Session persistence directory (default: ${DEFAULT_SESSION_DIR})
  --background          Run in background (logs + PID file)
  -h, --help            Show this help

Environment:
  ASR_STREAM_PORT, MAX_CLIENT, LOG_DIR, DEVICE, PLATFORM, BACKGROUND, SESSION_DIR
  See .env.example at repo root.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --max_clients) MAX_CLIENT="$2"; shift 2 ;;
    --log_dir) LOG_DIR="$2"; shift 2 ;;
    --device) DEVICE="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --session_dir) SESSION_DIR="$2"; shift 2 ;;
    --background) BACKGROUND=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

setup_platform "${PLATFORM}"
mkdir -p "${LOG_DIR}" "${SESSION_DIR}"

ENTRYPOINT="${REPO_ROOT}/services/streaming_asr/websocket_asr_server.py"
PID_FILE="$(streaming_pid_file)"
LOG_FILE="${LOG_DIR}/streaming-asr.log"

run_python_service "streaming-asr" "${ENTRYPOINT}" "${PID_FILE}" "${LOG_FILE}" "${BACKGROUND}" \
  --port "${PORT}" \
  --log_dir "${LOG_DIR}" \
  --max_clients "${MAX_CLIENT}" \
  --device "${DEVICE}" \
  --session_dir "${SESSION_DIR}"
