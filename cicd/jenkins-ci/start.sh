#!/bin/bash
set -eu

# Resolve files relative to this script, not the caller's working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
WORK_DIR="$HOME/jenkins-ci"
LOG_FILE="$WORK_DIR/jenkins-agent.log"
PID_FILE="$WORK_DIR/jenkins-agent.pid"
mkdir -p "$WORK_DIR"
cd "$SCRIPT_DIR"

# Detach all terminal streams and ignore hangups when the terminal closes.
nohup java -jar "$SCRIPT_DIR/jenkins-agent.jar" \
  -jnlpUrl 'http://jenkins.custom.com:8080/computer/agent%2Dnode/jenkins-agent.jnlp' \
  -secret "@$SCRIPT_DIR/jenkins-secret" \
  -workDir "$WORK_DIR" \
  </dev/null >>"$LOG_FILE" 2>&1 &

AGENT_PID=$!
printf '%s\n' "$AGENT_PID" >"$PID_FILE"
printf 'Jenkins agent launched in background (PID: %s).\nLog: %s\nPID file: %s\n' "$AGENT_PID" "$LOG_FILE" "$PID_FILE"
