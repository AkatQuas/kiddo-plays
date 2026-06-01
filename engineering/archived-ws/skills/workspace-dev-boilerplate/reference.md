# Four-file workspace pattern

Reference for [`GUIDE.md`](GUIDE.md). The orchestration root is **not** a git repo requirement — it is wherever you keep the four files while repos live underneath (or elsewhere, via absolute paths in `.env`).

## File responsibilities

### `.env`

- Loaded by Overmind when running Procfile processes
- Use **absolute paths** for `CURRENT_DIR` and each repo root
- Name variables after directories: `APP_DIR`, `MONO_DIR`, `TOOLKIT_DIR`

```bash
CURRENT_DIR=${HOME}/workspace/my-feature
APP_DIR=${CURRENT_DIR}/app
```

Keep secrets out of committed `.env` files; use `.env.local` or gitignore if needed.

### `Procfile`

Format: `process_name: shell command` (one per line).

- `#` comments and blank lines allowed
- Reference `.env` vars as `$APP_DIR`, `$TOOLKIT_DIR`
- Process names are what you pass to `overmind start -l name1,name2`
- Long-running watchers first; consumers use `until [ -f … ]` guards when needed

### `Makefile`

Human-facing CLI over the same processes.

Conventions from `archived-ws/`:

| Target | Purpose |
|--------|---------|
| `help` | List targets (`##` doc comments) |
| `groupdhelp` | Grouped by `##@ Section` |
| `proc_list` | Print Procfile process names |
| `gfo` | `git fetch` in configured repos |
| `*_setup` | Install deps in a repo dir |
| `dev` / `ide` / `start-*` | `overmind start -l …` |

Standard header:

```make
SHELL:=/bin/bash
.DEFAULT_GOAL:=help
.SILENT: $(targets)
.PHONY: $(targets)
```

Useful macros: `ensure_yarn`, `fetch_latest`, `_check-docker` — copy from examples as needed.

### `*.code-workspace`

VS Code multi-root workspace JSON.

| Key | Purpose |
|-----|---------|
| `folders` | One entry per repo + optional `ROOT` at `./` |
| `settings` | Shared formatter, `search.exclude`, spell words |
| `extensions.recommendations` | Prettier, EditorConfig, Procfile, vscode-env |
| `tasks` | Optional shell tasks (git fetch/rebase, docker wait) |

`folders[].path` must match how repos sit on disk relative to the workspace file.

## Data flow

```
┌─────────────────┐
│  .code-workspace │  editor: multi-root, settings, tasks
└────────┬────────┘
         │ same paths as
┌────────▼────────┐
│      .env       │  CURRENT_DIR, APP_DIR, …
└────────┬────────┘
         │ read by
┌────────▼────────┐     ┌──────────────┐
│    Procfile     │────►│   Overmind   │
└────────┬────────┘     └──────────────┘
         │ started by
┌────────▼────────┐
│    Makefile     │  make dev, make help, …
└─────────────────┘
```

## Variants (content only)

| Variant | Examples in archived-ws | Makefile focus | Procfile focus |
|---------|-------------------------|----------------|----------------|
| minimal | `search-template` | `mono_setup`, `gfo` | few or commented processes |
| ide | `maide`, `tila-v2` | link_local, clean output | watch + guarded `ide` |
| services | `ws-mobile` | docker redis/mongo, `start-*` | one process per app |
| dual-mono | `fire` | two mono dirs, lint diff | prefix-filtered overmind |

## Examples in archived-ws

| Workspace | Good reference for |
|-----------|-------------------|
| `search-template/` | Minimal four-file set + Makefile macros |
| `maide/`, `tila-v2/` | Multi-repo IDE, Procfile guards |
| `ws-mobile/` | Multiple parallel dev servers |
| `fire/` | Two monorepos, workspace tasks |

Clone scripts under `search-template/` (`create_space_fast.sh`, etc.) are **optional convenience** — not part of the core pattern.

## Design principles

1. **Four files at the shell root** — everything else is your repo layout.
2. **One `make` target** replaces juggling terminals.
3. **Procfile is the source of truth** for what runs; Makefile selects subsets.
4. **Workspace JSON mirrors `.env` paths** so search and tasks stay consistent.

## Requirements

- `make`, `bash`
- [Overmind](https://github.com/DarthSim/overmind) for Procfile (`brew install overmind`)
- VS Code or Cursor for `.code-workspace`

Porting notes: some archived Makefiles use macOS Chrome paths; replace or remove on Linux.
