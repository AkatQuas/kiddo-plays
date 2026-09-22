#!/usr/bin/env bash
# Start core VoxMesh services in background (streaming + HTTP ASR).

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env

START_STREAMING=true
START_HTTP=true

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start streaming ASR and HTTP ASR in background, then print status.

Options:
  --no-http        Start streaming ASR only
  --no-streaming   Start HTTP ASR only
  -h, --help       Show this help

Requires INPUT_PATH for HTTP ASR. See .env.example.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-http) START_HTTP=false; shift ;;
    --no-streaming) START_STREAMING=false; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if bool_is_true "${START_STREAMING}"; then
  "${DEPLOY_DIR}/infer_streaming.sh" --background
fi

if bool_is_true "${START_HTTP}"; then
  "${DEPLOY_DIR}/infer_http_asr.sh" --background
fi

"${DEPLOY_DIR}/status.sh"
