#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

cmd="${1:-}"
shift || true

case "$cmd" in
  generate|install|show)
    npm run "cert:$cmd" -- "$@"
    ;;
  *)
    echo "T-Proxy 证书脚本"
    echo ""
    echo "用法: scripts/cert.sh <generate|install|show> [options]"
    echo ""
    echo "  generate [--force]   重新生成根证书"
    echo "  install [--remote]   安装到系统信任库"
    echo "  show                 显示证书路径"
    exit 1
    ;;
esac
