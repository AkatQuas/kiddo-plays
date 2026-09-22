#!/usr/bin/env bash
# Scan the repo for likely secrets before release or CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'sk-[a-zA-Z0-9]{20,}'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
)

EXCLUDES=(
  '.git'
  '.env'
  'node_modules'
  '__pycache__'
  '.venv'
  'venv'
  'models'
  'logs'
  'sessions'
  'temp_dir'
)

RG_ARGS=(--glob '!.env' --glob '!.env.*' --glob '!*.example' --glob '!*.svg')

for dir in "${EXCLUDES[@]}"; do
  RG_ARGS+=(--glob "!${dir}/**")
done

FOUND=0

echo "==> Sensitive content scan (VoxMesh)"

for pattern in "${PATTERNS[@]}"; do
  if rg -n "${RG_ARGS[@]}" -e "${pattern}" . 2>/dev/null; then
    FOUND=1
  fi
done

# Hardcoded cloud keys in source (allow .example and docs placeholders)
if rg -n "${RG_ARGS[@]}" \
  -e 'api[_-]?secret\s*=\s*["\x27][^"\x27]{8,}["\x27]' \
  -e 'password\s*=\s*["\x27][^"\x27]{8,}["\x27]' \
  --glob '*.py' --glob '*.sh' --glob '*.json' . 2>/dev/null; then
  FOUND=1
fi

if [[ "${FOUND}" -eq 1 ]]; then
  echo ""
  echo "FAIL: Possible secrets detected. Remove or move to .env (never commit .env)."
  exit 1
fi

echo "PASS: No obvious secrets found."
