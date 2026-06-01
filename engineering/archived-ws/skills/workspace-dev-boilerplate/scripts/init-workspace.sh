#!/usr/bin/env bash
# Scaffold the four workspace files: .env, Procfile, Makefile, *.code-workspace
# Does NOT clone repos — place or clone them yourself, then wire paths in .env
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TEMPLATE_DIR="${SCRIPT_DIR}/templates"

TARGET_DIR="" NAME="" OPEN_FLAG=0

usage() {
  cat <<EOF
Usage: $(basename "$0") --dir <path> --name <workspace-name> [--open]

Creates in <path>:
  .env  Procfile  Makefile  <name>.code-workspace

Repos are not cloned. After running, edit .env and add your repo folders.

Options:
  --dir <path>    Orchestration root (created if missing)
  --name <name>   Base name for <name>.code-workspace
  --open          Open workspace in VS Code if \`code\` is available
  -h, --help      Show this help
EOF
  exit "${1:-0}"
}

die() { echo "error: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) TARGET_DIR="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --open) OPEN_FLAG=1; shift ;;
    -h|--help) usage 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$TARGET_DIR" && -n "$NAME" ]] || usage 1

mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd -P)"
CURRENT_DIR="$TARGET_DIR"

for f in Makefile Procfile; do
  [[ -f "${TARGET_DIR}/${f}" ]] && die "${TARGET_DIR}/${f} already exists (remove or pick another dir)"
done
[[ -f "${TARGET_DIR}/.env" ]] && die "${TARGET_DIR}/.env already exists"
[[ -f "${TARGET_DIR}/${NAME}.code-workspace" ]] && die "${TARGET_DIR}/${NAME}.code-workspace already exists"

patch() {
  sed -e "s|__CURRENT_DIR__|${CURRENT_DIR}|g" \
      -e "s|__WORKSPACE_NAME__|${NAME}|g" \
    < "$1" > "$2"
}

cp "${TEMPLATE_DIR}/Makefile" "${TARGET_DIR}/Makefile"
cp "${TEMPLATE_DIR}/Procfile" "${TARGET_DIR}/Procfile"
patch "${TEMPLATE_DIR}/env" "${TARGET_DIR}/.env"
patch "${TEMPLATE_DIR}/workspace.code-workspace" "${TARGET_DIR}/${NAME}.code-workspace"

echo "Created four files in: ${TARGET_DIR}"
echo "  .env"
echo "  Procfile"
echo "  Makefile"
echo "  ${NAME}.code-workspace"
echo ""
echo "Next:"
echo "  1. Clone or place repos under ${TARGET_DIR}"
echo "  2. Edit .env — set path vars for each repo"
echo "  3. Edit Procfile — add dev commands"
echo "  4. Edit ${NAME}.code-workspace — add folders for each repo"
echo "  5. make help && make dev"

[[ "$OPEN_FLAG" == 1 ]] && command -v code >/dev/null && code "${TARGET_DIR}/${NAME}.code-workspace"
