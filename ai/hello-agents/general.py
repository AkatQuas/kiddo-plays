import json
import subprocess
import sys

data = json.load(sys.stdin)
cwd = data.get("cwd", "UNKNOWN CWD")
hook_event_name = data.get("hook_event_name", "UNKNOWN HOOK")
message = data.get("message", "")
title = data.get("title", "Attention for Claude Code")
notification_type = data.get("notification_type", "task running")

def show_claude_notification():
    script = f'''
        display notification "Hook: {hook_event_name}\nDirectory: {cwd}\nMessage: {message}" ¬
        with title "{title}" ¬
        subtitle "{notification_type}" ¬
        sound name "default"
    '''
    try:
        subprocess.run(
            ["osascript", "-e", script.strip()],
            check=True,       # Raise error if command fails
            capture_output=True,
            text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Notification failed: {e.stderr}")

show_claude_notification()
