#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDS_DIR="$SCRIPT_DIR/builds"
RUNTIME_VERSION="${RUNTIME_VERSION:-22.16.0}"
RUNTIME_IMAGE="${RUNTIME_IMAGE:-node:${RUNTIME_VERSION}-slim}"
DEFAULT_COMPILE_VERSIONS="22.21.0 22.21.1 22.22.0 22.22.1 22.22.2 22.22.3"
COMPILE_VERSIONS="${COMPILE_VERSIONS:-$DEFAULT_COMPILE_VERSIONS}"

SOURCE_FILE="$SCRIPT_DIR/example/index.source.js"

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

build_dir_for() {
  echo "$BUILDS_DIR/$1"
}

prepare_build() {
  local compile_version="$1"
  local build_dir
  build_dir="$(build_dir_for "$compile_version")"

  rm -rf "$build_dir"
  mkdir -p "$build_dir/example"

  cp "$SCRIPT_DIR/package.json" "$build_dir/package.json"
  cp "$SCRIPT_DIR/obfuscate.js" "$build_dir/obfuscate.js"
  cp "$SOURCE_FILE" "$build_dir/example/index.js"
}

run_obfuscate() {
  local compile_version="$1"
  local build_dir="/app/builds/${compile_version}"

  docker run --rm \
    -e CI=true \
    -v "$SCRIPT_DIR:/app" \
    -w "$build_dir" \
    "node:${compile_version}-slim" \
    bash -lc "corepack enable && pnpm install && node obfuscate.js"
}

run_runtime() {
  local compile_version="$1"
  local build_dir="/app/builds/${compile_version}"

  docker run --rm \
    -v "$SCRIPT_DIR:/app" \
    -w "$build_dir" \
    "$RUNTIME_IMAGE" \
    node example/index.js
}

echo "Node obfuscate compatibility matrix"
echo "Runtime target: ${RUNTIME_IMAGE}"
echo "Compile versions: ${COMPILE_VERSIONS}"
echo "Each compile version gets its own builds/<version>/ install; runtime only executes."
echo

mkdir -p "$BUILDS_DIR"

for compile_version in $COMPILE_VERSIONS; do
  echo "=== compile=${compile_version} runtime=${RUNTIME_VERSION} ==="
  prepare_build "$compile_version"

  if ! run_obfuscate "$compile_version"; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("compile=${compile_version} runtime=${RUNTIME_VERSION}  FAIL (obfuscate step)")
    echo
    continue
  fi

  output=""
  exit_code=0
  output="$(run_runtime "$compile_version" 2>&1)" || exit_code=$?

  if [[ "$exit_code" -eq 0 ]] && echo "$output" | grep -q 'RESULT:25'; then
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS+=("compile=${compile_version} runtime=${RUNTIME_VERSION}  PASS")
    echo "$output"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("compile=${compile_version} runtime=${RUNTIME_VERSION}  FAIL")
    echo "$output"
  fi
  echo
done

echo "=== Summary ==="
for result in "${RESULTS[@]}"; do
  echo "$result"
done
echo
echo "Passed: ${PASS_COUNT}  Failed: ${FAIL_COUNT}"
echo "Build artifacts: ${BUILDS_DIR}/<version>/"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
