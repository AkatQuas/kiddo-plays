# Agent guides

Workflow docs for the **four-file workspace shell**:

| File | Purpose |
|------|---------|
| `.env` | Paths to repo roots |
| `Procfile` | Dev processes (Overmind) |
| `Makefile` | CLI: `make dev`, setup, git helpers |
| `*.code-workspace` | VS Code multi-root + settings |

Repo cloning and layout are **not** prescribed — only how to wire these four files.

## Guides

| Guide | Entry point | Summary |
|-------|-------------|---------|
| workspace-dev-boilerplate | [GUIDE.md](workspace-dev-boilerplate/GUIDE.md) | Create and wire the four files |

Each guide folder:

| File | Purpose |
|------|---------|
| **`GUIDE.md`** | Primary instructions (any coding agent) |
| `reference.md` | Per-file deep dive + archived-ws examples |
| `templates/` | Starter `.env`, Procfile, Makefile, workspace |
| `scripts/init-workspace.sh` | Writes the four files only (no git clone) |
| `SKILL.md` | Optional Cursor discovery shim |

## Quick start (no agent)

```bash
mkdir -p ~/workspace/my-feature && cd ~/workspace/my-feature
# clone or place your repos here

bash /path/to/archived-ws/skills/workspace-dev-boilerplate/scripts/init-workspace.sh \
  --dir . --name my-feature --open

# then edit .env, Procfile, folders in *.code-workspace
make help
```

## Use with any coding agent

```
Follow archived-ws/skills/workspace-dev-boilerplate/GUIDE.md.
Create the four files for workspace my-feature. I will clone repos myself.
```

Link `GUIDE.md` from `AGENTS.md`, `CLAUDE.md`, or `.cursor/rules/`.

## Optional: Cursor

```bash
ln -sf "$(pwd)/skills/workspace-dev-boilerplate" ~/.cursor/skills/workspace-dev-boilerplate
```

## Contributing

1. Add `skills/<name>/GUIDE.md` centered on the four-file pattern.
2. Add `templates/` and optional `scripts/`.
3. Register here and in [../README.md](../README.md).
