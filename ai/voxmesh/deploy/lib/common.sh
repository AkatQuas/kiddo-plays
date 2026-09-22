# shellcheck shell=bash
# Shared helpers for VoxMesh deploy scripts.
# Usage (from deploy/*.sh):
#   source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
#   deploy_init
#   load_env
#   resolve_python

set -euo pipefail

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${_LIB_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/.." && pwd)"

PYTHON=""

deploy_init() {
  : "${DEPLOY_DIR:?}" "${REPO_ROOT:?}"
}

load_env() {
  local env_file="${REPO_ROOT}/.env"
  if [[ -f "${env_file}" ]]; then
    echo "Loading environment from ${env_file}"
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
}

resolve_python() {
  if command -v python3 >/dev/null 2>&1; then
    PYTHON=python3
  elif command -v python >/dev/null 2>&1; then
    PYTHON=python
  else
    echo "Error: python3 or python not found in PATH" >&2
    exit 1
  fi
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Error: required command not found: ${cmd}" >&2
    exit 1
  fi
}

require_file() {
  local path="$1"
  local label="${2:-file}"
  if [[ ! -f "${path}" ]]; then
    echo "Error: ${label} not found: ${path}" >&2
    exit 1
  fi
}

require_input_path() {
  if [[ -z "${INPUT_PATH:-}" ]]; then
    echo "Error: INPUT_PATH is not set." >&2
    echo "Copy .env.example to .env or run: export INPUT_PATH=./models" >&2
    exit 1
  fi
  if [[ ! -d "${INPUT_PATH}" ]]; then
    echo "Warning: INPUT_PATH does not exist yet: ${INPUT_PATH}" >&2
    echo "Download models before starting inference services." >&2
  fi
}

setup_platform() {
  local platform="${1:-NV}"
  case "${platform}" in
    HW)
      echo "Setting up Huawei Ascend environment..."
      export PATH="/usr/local/python3.11.10/bin:${PATH}"
      export LD_LIBRARY_PATH="/usr/local/Ascend/driver/lib64/driver:${LD_LIBRARY_PATH:-}"
      local ascend_scripts=(
        /usr/local/Ascend/ascend-toolkit/set_env.sh
        /usr/local/Ascend/nnal/atb/set_env.sh
        /usr/local/Ascend/mindie/set_env.sh
        /usr/local/Ascend/llm_model/set_env.sh
      )
      local script
      for script in "${ascend_scripts[@]}"; do
        if [[ -f "${script}" ]]; then
          # shellcheck disable=SC1090
          source "${script}"
        else
          echo "Warning: ${script} not found" >&2
        fi
      done
      export HW_ENABLE=1
      echo "Huawei Ascend environment configured"
      ;;
    MX)
      echo "Setting up MetaX environment..."
      export MX_ENABLE=1
      echo "MetaX environment configured"
      ;;
    NV)
      echo "Using NVIDIA GPU environment (default)"
      ;;
    *)
      echo "Warning: unknown platform '${platform}', using NVIDIA defaults" >&2
      ;;
  esac
}

bool_is_true() {
  case "${1}" in
    true|TRUE|1|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

read_pid_file() {
  local pid_file="$1"
  if [[ ! -f "${pid_file}" ]]; then
    return 1
  fi
  local pid
  pid="$(<"${pid_file}")"
  if [[ -z "${pid}" ]]; then
    return 1
  fi
  echo "${pid}"
}

is_running() {
  local pid="$1"
  kill -0 "${pid}" >/dev/null 2>&1
}

run_python_service() {
  local service_name="$1"
  local entrypoint="$2"
  local pid_file="$3"
  local log_file="$4"
  local background="$5"
  shift 5

  if [[ -z "${PYTHON}" ]]; then
    resolve_python
  fi

  require_file "${entrypoint}" "service entrypoint"

  local -a cmd=("${PYTHON}" "${entrypoint}")
  if (($# > 0)); then
    cmd+=("$@")
  fi

  echo "Starting ${service_name}"
  echo "  command: ${cmd[*]}"

  if bool_is_true "${background}"; then
    mkdir -p "$(dirname "${pid_file}")" "$(dirname "${log_file}")"

    if pid="$(read_pid_file "${pid_file}" 2>/dev/null)" && is_running "${pid}"; then
      echo "Error: ${service_name} already running (PID ${pid}, ${pid_file})" >&2
      exit 1
    fi

    nohup "${cmd[@]}" >>"${log_file}" 2>&1 &
    local new_pid=$!
    echo "${new_pid}" >"${pid_file}"
    echo "${service_name} started in background"
    echo "  PID: ${new_pid}"
    echo "  PID file: ${pid_file}"
    echo "  Log file: ${log_file}"
  else
    exec "${cmd[@]}"
  fi
}

stop_service() {
  local service_name="$1"
  local pid_file="$2"
  local legacy_pid_file="${3:-}"

  local pid=""
  if pid="$(read_pid_file "${pid_file}" 2>/dev/null)"; then
    :
  elif [[ -n "${legacy_pid_file}" ]] && pid="$(read_pid_file "${legacy_pid_file}" 2>/dev/null)"; then
    pid_file="${legacy_pid_file}"
  else
    echo "${service_name}: not running (no PID file)"
    return 0
  fi

  if ! is_running "${pid}"; then
    echo "${service_name}: stale PID file (${pid}), removing"
    rm -f "${pid_file}"
    return 0
  fi

  echo "Stopping ${service_name} (PID ${pid})"
  kill "${pid}" 2>/dev/null || true
  sleep 1
  if is_running "${pid}"; then
    echo "  sending SIGTERM again..."
    kill "${pid}" 2>/dev/null || true
    sleep 2
  fi
  if is_running "${pid}"; then
    echo "  forcing SIGKILL"
    kill -9 "${pid}" 2>/dev/null || true
  fi
  rm -f "${pid_file}"
  echo "${service_name}: stopped"
}

status_service() {
  local service_name="$1"
  local pid_file="$2"
  local legacy_pid_file="${3:-}"

  local pid=""
  if pid="$(read_pid_file "${pid_file}" 2>/dev/null)"; then
    :
  elif [[ -n "${legacy_pid_file}" ]] && pid="$(read_pid_file "${legacy_pid_file}" 2>/dev/null)"; then
    pid_file="${legacy_pid_file}"
  else
    echo "${service_name}: stopped"
    return 0
  fi

  if is_running "${pid}"; then
    echo "${service_name}: running (PID ${pid}, ${pid_file})"
  else
    echo "${service_name}: stopped (stale PID file: ${pid_file})"
  fi
}

default_log_dir() {
  echo "${LOG_DIR:-./logs}"
}

streaming_pid_file() {
  echo "$(default_log_dir)/streaming-asr.pid"
}

http_pid_file() {
  echo "$(default_log_dir)/http-asr.pid"
}

wakeup_pid_file() {
  echo "$(default_log_dir)/wakeup.pid"
}

legacy_streaming_pid_file() {
  echo "$(default_log_dir)/server.pid"
}

legacy_http_pid_file() {
  echo "${TEMP_DIR:-temp_dir/}/asr_http_server.pid"
}

legacy_wakeup_pid_file() {
  echo "$(default_log_dir)/wakeup/wakeup_server.pid"
}
