#!/usr/bin/env bash
# Start the HTTP ASR + embedding service.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

deploy_init
load_env
resolve_python
require_input_path

DEFAULT_PORT=36008
DEFAULT_TEMP_DIR="temp_dir/"
DEFAULT_DEVICE="cuda:0"
DEFAULT_LOG_DIR="./logs"
DEFAULT_PLATFORM="NV"
DEFAULT_BACKGROUND=false
DEFAULT_MODEL_TYPE="campplus"
DEFAULT_MIN_DURATION=3.0

PORT="${ASR_HTTP_PORT:-$DEFAULT_PORT}"
ASR_MODEL="${ASR_MODEL:-${INPUT_PATH}/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch}"
ENGLISH_ASR_MODEL="${ENGLISH_ASR_MODEL:-${INPUT_PATH}/Whisper-large-v3}"
VAD_MODEL="${VAD_MODEL:-${INPUT_PATH}/speech_fsmn_vad_zh-cn-16k-common-pytorch}"
PUNC_MODEL="${PUNC_MODEL:-${INPUT_PATH}/punc_ct-transformer_cn-en-common-vocab471067-large}"
SPK_MODEL="${SPK_MODEL:-${INPUT_PATH}/speech_campplus_sv_zh-cn_16k-common}"
EMBEDDING_MODEL_DIR="${EMBEDDING_MODEL_DIR:-${INPUT_PATH}/speech_campplus_sv_zh-cn_16k-common}"
MODEL_TYPE="${MODEL_TYPE:-$DEFAULT_MODEL_TYPE}"
MIN_DURATION="${MIN_DURATION:-$DEFAULT_MIN_DURATION}"
SEGMENTATION_MODEL_PATH="${SEGMENTATION_MODEL_PATH:-${INPUT_PATH}/segmention/segmention.bin}"
HOTWORD_API_URL="${HOTWORD_API_URL:-${LLM_API_URL:-http://localhost:11434/v1}}"
HOTWORD_API_KEY="${HOTWORD_API_KEY:-${LLM_API_KEY:-ollama}}"
HOTWORD_MODEL="${HOTWORD_MODEL:-${LLM_MODEL:-qwen2.5:7b}}"
TEMP_DIR="${TEMP_DIR:-$DEFAULT_TEMP_DIR}"
DEVICE="${DEVICE:-$DEFAULT_DEVICE}"
LOG_DIR="${LOG_DIR:-$DEFAULT_LOG_DIR}"
PLATFORM="${PLATFORM:-$DEFAULT_PLATFORM}"
BACKGROUND="${BACKGROUND:-$DEFAULT_BACKGROUND}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start VoxMesh HTTP ASR with speaker embedding.

Options:
  --port PORT                     Server port (default: ${DEFAULT_PORT})
  --asr_model PATH                Chinese ASR model directory
  --english_asr_model PATH        English ASR model directory
  --vad_model PATH                VAD model directory
  --punc_model PATH               Punctuation model directory
  --spk_model PATH                Speaker model directory
  --embedding_model_dir PATH      Embedding model directory
  --model_type TYPE               Embedding backend (default: ${DEFAULT_MODEL_TYPE})
  --min_duration SECONDS          Min audio duration for embedding (default: ${DEFAULT_MIN_DURATION})
  --segmentation_model_path PATH  Segmentation model for embedding
  --hotword_api_url URL           Hotword correction LLM URL
  --hotword_api_key KEY           Hotword correction API key
  --hotword_model MODEL           Hotword correction model name
  --temp_dir DIR                  Async task temp directory (default: ${DEFAULT_TEMP_DIR})
  --device DEVICE                 Inference device (default: ${DEFAULT_DEVICE})
  --log_dir DIR                   Log directory (default: ${DEFAULT_LOG_DIR})
  --platform PLATFORM             NV, HW, or MX (default: ${DEFAULT_PLATFORM})
  --background                    Run in background (logs + PID file)
  -h, --help                      Show this help

Environment:
  INPUT_PATH (required), ASR_HTTP_PORT, ASR_MODEL, VAD_MODEL, PUNC_MODEL, SPK_MODEL,
  EMBEDDING_MODEL_DIR, HOTWORD_*, TEMP_DIR, DEVICE, LOG_DIR, PLATFORM, BACKGROUND
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --asr_model) ASR_MODEL="$2"; shift 2 ;;
    --english_asr_model) ENGLISH_ASR_MODEL="$2"; shift 2 ;;
    --vad_model) VAD_MODEL="$2"; shift 2 ;;
    --punc_model) PUNC_MODEL="$2"; shift 2 ;;
    --spk_model) SPK_MODEL="$2"; shift 2 ;;
    --embedding_model_dir) EMBEDDING_MODEL_DIR="$2"; shift 2 ;;
    --model_type) MODEL_TYPE="$2"; shift 2 ;;
    --min_duration) MIN_DURATION="$2"; shift 2 ;;
    --segmentation_model_path) SEGMENTATION_MODEL_PATH="$2"; shift 2 ;;
    --hotword_api_url) HOTWORD_API_URL="$2"; shift 2 ;;
    --hotword_api_key) HOTWORD_API_KEY="$2"; shift 2 ;;
    --hotword_model) HOTWORD_MODEL="$2"; shift 2 ;;
    --temp_dir) TEMP_DIR="$2"; shift 2 ;;
    --device) DEVICE="$2"; shift 2 ;;
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
mkdir -p "${TEMP_DIR}" "${LOG_DIR}"

ENTRYPOINT="${REPO_ROOT}/services/offline_asr/asr_http_server.py"
PID_FILE="$(http_pid_file)"
LOG_FILE="${LOG_DIR}/http-asr.log"

HTTP_ARGS=(
  --port "${PORT}"
  --asr_model "${ASR_MODEL}"
  --english_asr_model "${ENGLISH_ASR_MODEL}"
  --vad_model "${VAD_MODEL}"
  --punc_model "${PUNC_MODEL}"
  --spk_model "${SPK_MODEL}"
  --embedding_model_dir "${EMBEDDING_MODEL_DIR}"
  --model_type "${MODEL_TYPE}"
  --min_duration "${MIN_DURATION}"
  --segmentation_model_path "${SEGMENTATION_MODEL_PATH}"
  --hotword_api_url "${HOTWORD_API_URL}"
  --hotword_api_key "${HOTWORD_API_KEY}"
  --hotword_model "${HOTWORD_MODEL}"
  --temp_dir "${TEMP_DIR}"
  --device "${DEVICE}"
  --log_dir "${LOG_DIR}"
)

run_python_service "http-asr" "${ENTRYPOINT}" "${PID_FILE}" "${LOG_FILE}" "${BACKGROUND}" \
  "${HTTP_ARGS[@]}"
