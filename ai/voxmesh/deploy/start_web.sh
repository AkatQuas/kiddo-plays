#!/usr/bin/env bash
# Serve the browser ASR test page (static HTTP/HTTPS).

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env
resolve_python

DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT=36004

HOST="${WEB_HOST:-$DEFAULT_HOST}"
PORT="${WEB_PORT:-$DEFAULT_PORT}"
USE_HTTPS=true

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Serve docs/guides/web-asr-client.html for browser microphone testing.

Options:
  --host HOST     Bind address (default: ${DEFAULT_HOST})
  --port PORT     Listen port (default: ${DEFAULT_PORT})
  --no-https      Use HTTP only (microphone works on localhost only)
  -h, --help      Show this help

Environment:
  WEB_HOST, WEB_PORT

After start, open the printed URL and point ASR WebSocket to ws://localhost:36005
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --no-https) USE_HTTPS=false; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

WEB_SERVER="${DEPLOY_DIR}/web_server.py"
WEB_PAGE="${REPO_ROOT}/docs/guides/web-asr-client.html"

require_file "${WEB_SERVER}" "web_server.py"
require_file "${WEB_PAGE}" "web test page"

echo "Starting web debug server..."
if bool_is_true "${USE_HTTPS}"; then
  echo "  URL: https://${HOST}:${PORT}/web-asr-client.html"
  echo "  Local: https://localhost:${PORT}/web-asr-client.html"
  HTTPS_FLAG=()
else
  echo "  URL: http://${HOST}:${PORT}/web-asr-client.html"
  echo "  Local: http://localhost:${PORT}/web-asr-client.html"
  echo "  Note: microphone access requires HTTPS except on localhost"
  HTTPS_FLAG=(--no-https)
fi

exec "${PYTHON}" "${WEB_SERVER}" --host "${HOST}" --port "${PORT}" "${HTTPS_FLAG[@]}"
