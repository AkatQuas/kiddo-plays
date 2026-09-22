#!/usr/bin/env bash
# Stop VoxMesh services started with --background.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env

TARGET="${1:-all}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [SERVICE]

Stop background VoxMesh services.

Services:
  all          Stop streaming-asr, http-asr, and wakeup (default)
  streaming    Streaming ASR WebSocket
  http         HTTP ASR + embedding
  wakeup       Voice wakeup WebSocket

Examples:
  $(basename "$0")
  $(basename "$0") streaming
EOF
}

case "${TARGET}" in
  all)
    stop_service "streaming-asr" "$(streaming_pid_file)" "$(legacy_streaming_pid_file)"
    stop_service "http-asr" "$(http_pid_file)" "$(legacy_http_pid_file)"
    stop_service "wakeup" "$(wakeup_pid_file)" "$(legacy_wakeup_pid_file)"
    ;;
  streaming|streaming-asr)
    stop_service "streaming-asr" "$(streaming_pid_file)" "$(legacy_streaming_pid_file)"
    ;;
  http|http-asr)
    stop_service "http-asr" "$(http_pid_file)" "$(legacy_http_pid_file)"
    ;;
  wakeup)
    stop_service "wakeup" "$(wakeup_pid_file)" "$(legacy_wakeup_pid_file)"
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "Unknown service: ${TARGET}" >&2
    usage >&2
    exit 1
    ;;
esac
