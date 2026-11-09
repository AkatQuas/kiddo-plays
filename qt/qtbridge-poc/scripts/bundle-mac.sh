#!/usr/bin/env bash
# Assemble a minimal macOS .app for multi-process CEF (with Helper apps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CEF_ROOT="${CEF_ROOT:-${ROOT}/third_party/cef}"
OUT_DIR="${ROOT}/dist"
APP="${OUT_DIR}/qtbridge-poc.app"
EXE_SRC="${1:-}"

if [[ -z "${EXE_SRC}" ]]; then
  for c in \
    "${ROOT}/build/qtbridge-poc.app/Contents/MacOS/qtbridge-poc" \
    "${ROOT}/qtbridge-poc.app/Contents/MacOS/qtbridge-poc" \
    "${ROOT}/qtbridge-poc" \
    "${ROOT}/app/qtbridge-poc.app/Contents/MacOS/qtbridge-poc" \
    "${ROOT}/app/qtbridge-poc"
  do
    if [[ -x "${c}" ]]; then EXE_SRC="${c}"; break; fi
  done
fi

HELPER_SRC=""
for c in \
  "${ROOT}/build/helper/qtbridge-helper" \
  "${ROOT}/helper/qtbridge-helper" \
  "${ROOT}/helper/qtbridge-helper.app/Contents/MacOS/qtbridge-helper"
do
  if [[ -x "${c}" ]]; then HELPER_SRC="${c}"; break; fi
done

if [[ -z "${EXE_SRC}" || ! -x "${EXE_SRC}" ]]; then
  echo "[bundle] main binary not found — pass path: ./scripts/bundle-mac.sh /path/to/qtbridge-poc" >&2
  exit 1
fi
if [[ -z "${HELPER_SRC}" || ! -x "${HELPER_SRC}" ]]; then
  echo "[bundle] helper binary not found — build helper/ first" >&2
  exit 1
fi

FRAMEWORK="${CEF_ROOT}/Release/Chromium Embedded Framework.framework"
if [[ ! -d "${FRAMEWORK}" ]]; then
  echo "[bundle] missing framework: ${FRAMEWORK}" >&2
  exit 1
fi

rm -rf "${APP}"
mkdir -p "${APP}/Contents/MacOS"
mkdir -p "${APP}/Contents/Frameworks"
mkdir -p "${APP}/Contents/Resources"

cp "${EXE_SRC}" "${APP}/Contents/MacOS/qtbridge-poc"
cp -R "${ROOT}/web" "${APP}/Contents/Resources/web"
cp -R "${FRAMEWORK}" "${APP}/Contents/Frameworks/"

# CEF macOS expects helper app names derived from the main app name.
make_helper() {
  local suffix="$1"
  local helper_app="${APP}/Contents/Frameworks/qtbridge-poc Helper${suffix}.app"
  mkdir -p "${helper_app}/Contents/MacOS"
  cp "${HELPER_SRC}" "${helper_app}/Contents/MacOS/qtbridge-poc Helper${suffix}"
  cat > "${helper_app}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>qtbridge-poc Helper${suffix}</string>
  <key>CFBundleIdentifier</key><string>dev.qtbridge.poc.helper${suffix}</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>LSUIElement</key><true/>
</dict></plist>
EOF
}

make_helper ""
make_helper " (GPU)"
make_helper " (Plugin)"
make_helper " (Renderer)"

cat > "${APP}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>qtbridge-poc</string>
  <key>CFBundleIdentifier</key><string>dev.qtbridge.poc</string>
  <key>CFBundleName</key><string>qtbridge-poc</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
EOF

echo "[bundle] ${APP}"
