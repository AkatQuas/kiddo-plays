#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${1:-http://localhost:11204}"
TEST_IMAGE="${2:-/tmp/clip-embed-test.png}"
MAX_WAIT="${MAX_WAIT:-120}"

wait_for_health() {
  local i=0
  while (( i < MAX_WAIT )); do
    if response="$(curl -sf "${BASE_URL}/health" 2>/dev/null)"; then
      echo "$response"
      return 0
    fi
    sleep 2
    (( i += 2 ))
    echo "  waiting for ${BASE_URL}/health ... (${i}s)" >&2
  done
  echo "ERROR: service not reachable at ${BASE_URL}/health after ${MAX_WAIT}s" >&2
  echo "Check: docker compose ps && docker compose logs --tail=50" >&2
  return 1
}

echo "==> Health check"
wait_for_health | python3 -m json.tool

echo ""
echo "==> Create test image"
uv run python - <<'PY'
from PIL import Image
img = Image.new("RGB", (128, 128), color=(220, 80, 60))
img.save("/tmp/clip-embed-test.png")
print("saved /tmp/clip-embed-test.png")
PY

echo ""
echo "==> Image embedding (first request loads model, may take a minute on CPU)"
response="$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/image-embedding/" \
  -F "file=@${TEST_IMAGE}")"
body="${response%$'\n'*}"
code="${response##*$'\n'}"
if [[ "$code" != "200" ]]; then
  echo "ERROR: HTTP $code" >&2
  echo "$body" >&2
  exit 1
fi
echo "$body" | python3 -m json.tool

echo ""
echo "==> Add image to gallery"
curl -sf -X POST "${BASE_URL}/gallery/images/" \
  -F "file=@${TEST_IMAGE}" \
  -F "image_id=demo-red" \
  -F 'metadata={"tag":"test"}' | python3 -m json.tool

echo ""
echo "==> Search by image"
search_response="$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/image-search/?top_k=3" \
  -F "file=@${TEST_IMAGE}")"
search_body="${search_response%$'\n'*}"
search_code="${search_response##*$'\n'}"
if [[ "$search_code" != "200" ]]; then
  echo "ERROR: HTTP $search_code" >&2
  echo "$search_body" >&2
  exit 1
fi
echo "$search_body" | python3 -m json.tool
