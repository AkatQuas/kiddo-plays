#!/usr/bin/env bash
# First-time developer setup for voxmesh open-source tree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> voxmesh setup"

if ! command -v python3 &>/dev/null; then
  echo "Error: python3 not found (need 3.10+)"
  exit 1
fi

PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "Python $PY_VER"

if ! python3 -c 'import sys; exit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "Warning: Python 3.10+ recommended"
fi

# Config templates
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

CFG="services/streaming_asr/common/config.json"
if [[ ! -f "$CFG" ]]; then
  cp services/streaming_asr/common/config.json.example "$CFG"
  echo "Created $CFG from example"
fi

mkdir -p logs sessions temp_dir models

echo ""
echo "Install PyTorch for your platform first:"
echo "  https://pytorch.org/get-started/locally/"
echo ""
echo "Then install monorepo deps (PyTorch first — see above):"
echo "  ./scripts/sync-deps.sh"
echo "  # or: uv sync --all-packages"
echo ""
echo "Optional — generate local TLS certs (for HTTPS web test page):"
echo "  cd ssl && openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj '/CN=localhost'"
echo ""
echo "Done."
