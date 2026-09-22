#!/usr/bin/env bash
# Show status of VoxMesh background services.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env

echo "VoxMesh service status (LOG_DIR=${LOG_DIR:-./logs})"
echo ""

status_service "streaming-asr" "$(streaming_pid_file)" "$(legacy_streaming_pid_file)"
status_service "http-asr" "$(http_pid_file)" "$(legacy_http_pid_file)"
status_service "wakeup" "$(wakeup_pid_file)" "$(legacy_wakeup_pid_file)"
