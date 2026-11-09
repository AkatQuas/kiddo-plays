#!/usr/bin/env bash
# Fetch the pinned open-source CEF build (macOS arm64) from https://cef-builds.spotifycdn.com/index.html.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/third_party/cef"
URL='https://cef-builds.spotifycdn.com/cef_binary_156.0.26%2Bg8ea0c73%2Bchromium-156.0.8078.88_macosarm64.tar.bz2'
ARCHIVE_NAME='cef_binary_156.0.26+g8ea0c73+chromium-156.0.8078.88_macosarm64.tar.bz2'

mkdir -p "${ROOT}/third_party"
TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

echo "[fetch-cef] ${URL}"
curl -L --fail --progress-bar -o "${TMP}/${ARCHIVE_NAME}" "${URL}"

echo "[fetch-cef] extracting…"
tar -xjf "${TMP}/${ARCHIVE_NAME}" -C "${TMP}"
EXTRACTED="$(find "${TMP}" -maxdepth 1 -type d -name 'cef_binary_*' | head -1)"
if [[ -z "${EXTRACTED}" ]]; then
  echo "[fetch-cef] could not find extracted cef_binary_* directory" >&2
  exit 1
fi

rm -rf "${DEST}"
mv "${EXTRACTED}" "${DEST}"
echo "[fetch-cef] ready at ${DEST}"
echo "[fetch-cef] next: ./scripts/build-cef-wrapper.sh"
