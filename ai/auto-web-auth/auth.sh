#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${AUTH_ENV_FILE:-$SCRIPT_DIR/auth.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

AUTH_USERNAME="${AUTH_USERNAME:-}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"
AUTH_USER_IP="${AUTH_USER_IP:-}"
AUTH_URL="${AUTH_URL:-https://auth.google.net/}"
CHECK_URL="${CHECK_URL:-https://cn.bing.com}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-5}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/auth.log}"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" >>"$LOG_FILE"
}

get_local_ip() {
  local iface ip

  iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "${iface:-}" ]]; then
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      echo "$ip"
      return 0
    fi
  fi

  for iface in en0 en1; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      echo "$ip"
      return 0
    fi
  done

  return 1
}

is_network_accessible() {
  local http_code

  http_code="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      --connect-timeout "$CONNECT_TIMEOUT" \
      --max-time "$CONNECT_TIMEOUT" \
      -L "$CHECK_URL" 2>/dev/null || echo "000"
  )"

  [[ "$http_code" =~ ^[23] ]]
}

do_auth() {
  local user_ip response

  if [[ -z "$AUTH_USERNAME" || -z "$AUTH_PASSWORD" ]]; then
    log "ERROR: AUTH_USERNAME / AUTH_PASSWORD 未设置"
    return 1
  fi

  user_ip="$AUTH_USER_IP"
  if [[ -z "$user_ip" ]]; then
    if ! user_ip="$(get_local_ip)"; then
      log "ERROR: 无法自动获取本机 IP，请设置 AUTH_USER_IP"
      return 1
    fi
    log "自动获取本机 IP: $user_ip"
  fi

  log "开始认证 (user=$AUTH_USERNAME, ip=$user_ip)"

  response="$(
    curl -sS \
      --connect-timeout "$CONNECT_TIMEOUT" \
      --max-time 30 \
      "$AUTH_URL" \
      -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
      -H 'content-type: application/x-www-form-urlencoded' \
      -H 'origin: https://auth.google.net' \
      -H 'referer: https://auth.google.net/' \
      -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' \
      --data-urlencode "username=$AUTH_USERNAME" \
      --data-urlencode "password=$AUTH_PASSWORD" \
      --data-urlencode "user_ip=$user_ip" \
      --data-urlencode 'mac='
  )"

  if grep -q '验证通过，正在登录' <<<"$response"; then
    log "认证成功"
    return 0
  fi

  if grep -q '授权失败' <<<"$response"; then
    log "认证失败: 账号或密码错误"
    return 1
  fi

  log "认证结果未知，请检查日志或网络环境"
  return 1
}

main() {
  mkdir -p "$(dirname "$LOG_FILE")"

  if is_network_accessible; then
    log "网络正常 ($CHECK_URL 可访问)，跳过认证"
    exit 0
  fi

  log "网络不可达 ($CHECK_URL)，尝试认证..."
  if do_auth; then
    if is_network_accessible; then
      log "认证后网络已恢复"
      exit 0
    fi
    log "认证完成但网络仍未恢复"
    exit 1
  fi

  exit 1
}

main "$@"
