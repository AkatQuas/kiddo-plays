#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.user.auto-web-auth"
PLIST_SRC="$SCRIPT_DIR/launchd/$LABEL.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [[ ! -f "$SCRIPT_DIR/auth.env" ]]; then
  echo "请先创建 auth.env:"
  echo "  cp $SCRIPT_DIR/auth.env.example $SCRIPT_DIR/auth.env"
  echo "  然后编辑填入 AUTH_USERNAME / AUTH_PASSWORD"
  exit 1
fi

chmod +x "$SCRIPT_DIR/auth.sh"

sed "s|__SCRIPT_DIR__|$SCRIPT_DIR|g" "$PLIST_SRC" >"$PLIST_DST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "已安装 launchd 定时任务: $LABEL"
echo "  plist: $PLIST_DST"
echo "  日志:  $SCRIPT_DIR/auth.log"
echo ""
echo "常用命令:"
echo "  launchctl print gui/$(id -u)/$LABEL   # 查看状态"
echo "  launchctl kickstart gui/$(id -u)/$LABEL  # 立即执行一次"
echo "  launchctl bootout gui/$(id -u)/$LABEL    # 卸载"
