#!/bin/bash
set -eu

WORK_DIR="$HOME/jenkins-ci"
PID_FILE="$WORK_DIR/jenkins-agent.pid"

if [ ! -f "$PID_FILE" ]; then
  printf 'PID file not found: %s\n' "$PID_FILE" >&2
  exit 1
fi

AGENT_PID="$(cat "$PID_FILE")"
case "$AGENT_PID" in
  ''|*[!0-9]*|0*)
    printf 'Invalid PID in %s: %s\n' "$PID_FILE" "$AGENT_PID" >&2
    exit 1
    ;;
esac
if [ "$AGENT_PID" = 1 ]; then
  printf 'Refusing to kill PID 1.\n' >&2
  exit 1
fi

kill "$AGENT_PID"
rm -f "$PID_FILE"
printf 'Stop signal sent to Jenkins agent (PID: %s).\n' "$AGENT_PID"
