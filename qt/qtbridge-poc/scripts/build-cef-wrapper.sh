#!/usr/bin/env bash
# Build libcef_dll_wrapper against the pinned CEF tree.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CEF_ROOT="${CEF_ROOT:-${ROOT}/third_party/cef}"
BUILD_DIR="${CEF_ROOT}/build_wrapper"

if [[ ! -f "${CEF_ROOT}/CMakeLists.txt" ]]; then
  echo "[wrapper] missing ${CEF_ROOT}/CMakeLists.txt — run ./scripts/fetch-cef.sh first" >&2
  exit 1
fi

mkdir -p "${BUILD_DIR}"
cmake -S "${CEF_ROOT}" -B "${BUILD_DIR}" \
  -DCMAKE_BUILD_TYPE=Release \
  -DPROJECT_ARCH=arm64
cmake --build "${BUILD_DIR}" --target libcef_dll_wrapper -j"$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"

# Common layout: wrapper .a lands under build_wrapper/libcef_dll_wrapper/
WRAPPER_A="$(find "${BUILD_DIR}" -name 'libcef_dll_wrapper.a' | head -1)"
if [[ -z "${WRAPPER_A}" ]]; then
  echo "[wrapper] libcef_dll_wrapper.a not found under ${BUILD_DIR}" >&2
  exit 1
fi

mkdir -p "${CEF_ROOT}/Release"
cp -f "${WRAPPER_A}" "${CEF_ROOT}/Release/libcef_dll_wrapper.a"
echo "[wrapper] installed ${CEF_ROOT}/Release/libcef_dll_wrapper.a"
