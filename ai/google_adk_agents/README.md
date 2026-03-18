# Google Agent Development Kit

[Google Agent Development Kit](https://google.github.io/adk-docs/)

## Get started

```bash
# create a virtual env
uv venv

# install adk dependencies, core dependency is `google-adk`
uv pip install -r requirements.txt
```

Then

1. Select `Tasks: Run Task` to run adk in web interface.
2. Or, Start agent standalone: `adk run xxx_agent`

From easy to complicated:

- `startup_agent`
- `multi_tool_agent`

Check `README.md` to play with those agents:

- `agent_team`
