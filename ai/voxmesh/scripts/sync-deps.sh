#!/usr/bin/env bash
# Install monorepo dependencies (shared lib + one or all services).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-all}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [TARGET]

Install VoxMesh monorepo Python dependencies.

Targets:
  all              Shared lib + all services (default)
  lib              voxmesh shared library only
  streaming        streaming ASR service
  offline          HTTP ASR + embedding service
  wakeup           voice wakeup service
  tts              TTS service

Requires PyTorch installed separately:
  https://pytorch.org/get-started/locally/

Examples:
  $(basename "$0")
  $(basename "$0") streaming
  uv sync --package voxmesh-streaming-asr   # equivalent with uv
EOF
}

package_for_target() {
  case "$1" in
    lib) echo "voxmesh" ;;
    streaming) echo "voxmesh-streaming-asr" ;;
    offline) echo "voxmesh-offline-asr" ;;
    wakeup) echo "voxmesh-wakeup" ;;
    tts) echo "voxmesh-tts" ;;
    *) return 1 ;;
  esac
}

if [[ "${TARGET}" == "-h" || "${TARGET}" == "--help" ]]; then
  usage
  exit 0
fi

if command -v uv >/dev/null 2>&1; then
  echo "==> Using uv workspace"
  if [[ "${TARGET}" == "all" ]]; then
    uv sync --all-packages
  else
    pkg="$(package_for_target "${TARGET}")" || {
      echo "Unknown target: ${TARGET}" >&2
      usage >&2
      exit 1
    }
    uv sync --package "${pkg}"
  fi
  exit 0
fi

echo "==> uv not found; using pip editable installs"
pip install -e ".[dev]"

install_service() {
  local dir="$1"
  echo "  -> ${dir}"
  pip install -e "${dir}"
}

case "${TARGET}" in
  all)
    install_service "services/streaming_asr"
    install_service "services/offline_asr"
    install_service "services/wakeup"
    install_service "services/tts"
    ;;
  lib)
    ;;
  streaming) install_service "services/streaming_asr" ;;
  offline) install_service "services/offline_asr" ;;
  wakeup) install_service "services/wakeup" ;;
  tts) install_service "services/tts" ;;
  *)
    echo "Unknown target: ${TARGET}" >&2
    usage >&2
    exit 1
    ;;
esac

echo "Done."
