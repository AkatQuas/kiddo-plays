#!/usr/bin/env bash
# 演示一次「发新版」：先只跑 001 migration，再启用 002 并重建。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1) 首次启动（仅 001_init）"
mv migrator/migrations/002_add_status.sql migrator/migrations/002_add_status.sql.bak
docker compose down -v --remove-orphans 2>/dev/null || true
docker compose up --build -d
sleep 3
curl -s http://127.0.0.1:18080/readyz | tee /tmp/migrate-then-serve-readyz-v1.json
echo
curl -s http://127.0.0.1:18080/api/items | tee /tmp/migrate-then-serve-items-v1.json
echo

echo "== 2) 发版：加入 002 migration + bump APP_VERSION"
mv migrator/migrations/002_add_status.sql.bak migrator/migrations/002_add_status.sql
# bump api version in compose for demo visibility
perl -i -pe 's/APP_VERSION: "0\.1\.0"/APP_VERSION: "0.2.0"/' docker-compose.yml
docker compose up --build -d
sleep 3
curl -s http://127.0.0.1:18080/readyz | tee /tmp/migrate-then-serve-readyz-v2.json
echo
curl -s http://127.0.0.1:18080/api/items | tee /tmp/migrate-then-serve-items-v2.json
echo
echo "done — api 应显示 status 字段且 appVersion=0.2.0"
