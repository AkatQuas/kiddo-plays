#!/usr/bin/env bash
set -euo pipefail

LABEL="com.user.auto-web-auth"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$PLIST_DST"

echo "已卸载 launchd 定时任务: $LABEL"
