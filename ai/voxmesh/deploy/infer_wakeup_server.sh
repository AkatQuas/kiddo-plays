#!/usr/bin/env bash
# Start the voice wakeup WebSocket service.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env
resolve_python
require_input_path

DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT=34010
DEFAULT_DEVICE="cuda:0"
DEFAULT_KEYWORDS="你好助手"
DEFAULT_SIMILARITY_THRESHOLD=80
DEFAULT_LOG_DIR="./logs"
DEFAULT_PLATFORM="NV"
DEFAULT_BACKGROUND=false

HOST="${WAKEUP_HOST:-$DEFAULT_HOST}"
PORT="${WAKEUP_PORT:-$DEFAULT_PORT}"
ASR_MODEL="${ASR_MODEL:-${INPUT_PATH}/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch}"
VAD_MODEL="${VAD_MODEL:-${INPUT_PATH}/speech_fsmn_vad_zh-cn-16k-common-pytorch}"
DEVICE="${DEVICE:-$DEFAULT_DEVICE}"
KEYWORDS="${WAKEUP_KEYWORDS:-$DEFAULT_KEYWORDS}"
SIMILARITY_THRESHOLD="${WAKEUP_SIMILARITY_THRESHOLD:-$DEFAULT_SIMILARITY_THRESHOLD}"
LOG_DIR="${LOG_DIR:-$DEFAULT_LOG_DIR}"
PLATFORM="${PLATFORM:-$DEFAULT_PLATFORM}"
BACKGROUND="${BACKGROUND:-$DEFAULT_BACKGROUND}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start VoxMesh voice wakeup (WebSocket).

Options:
  --host HOST                   Bind address (default: ${DEFAULT_HOST})
  --port PORT                   Server port (default: ${DEFAULT_PORT})
  --asr_model PATH              ASR model directory
  --vad_model PATH              VAD model directory
  --device DEVICE               Inference device (default: ${DEFAULT_DEVICE})
  --keywords TEXT               Wake word(s) (default: ${DEFAULT_KEYWORDS})
  --similarity_threshold N      Fuzzy match threshold 0-100 (default: ${DEFAULT_SIMILARITY_THRESHOLD})
  --log_dir DIR                 Log directory (default: ${DEFAULT_LOG_DIR})
  --platform PLATFORM           NV, HW, or MX (default: ${DEFAULT_PLATFORM})
  --background                  Run in background (logs + PID file)
  -h, --help                    Show this help

Environment:
  INPUT_PATH (required), WAKEUP_HOST, WAKEUP_PORT, WAKEUP_KEYWORDS,
  WAKEUP_SIMILARITY_THRESHOLD, ASR_MODEL, VAD_MODEL, DEVICE, LOG_DIR, PLATFORM, BACKGROUND
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --asr_model) ASR_MODEL="$2"; shift 2 ;;
    --vad_model) VAD_MODEL="$2"; shift 2 ;;
    --device) DEVICE="$2"; shift 2 ;;
    --keywords) KEYWORDS="$2"; shift 2 ;;
    --similarity_threshold) SIMILARITY_THRESHOLD="$2"; shift 2 ;;
    --log_dir) LOG_DIR="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
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
mkdir -p "${LOG_DIR}"

ENTRYPOINT="${REPO_ROOT}/services/wakeup/wakeup_server.py"
PID_FILE="$(wakeup_pid_file)"
LOG_FILE="${LOG_DIR}/wakeup.log"

run_python_service "wakeup" "${ENTRYPOINT}" "${PID_FILE}" "${LOG_FILE}" "${BACKGROUND}" \
  --host "${HOST}" \
  --port "${PORT}" \
  --asr_model "${ASR_MODEL}" \
  --vad_model "${VAD_MODEL}" \
  --device "${DEVICE}" \
  --keywords "${KEYWORDS}" \
  --similarity_threshold "${SIMILARITY_THRESHOLD}" \
  --log_dir "${LOG_DIR}"
