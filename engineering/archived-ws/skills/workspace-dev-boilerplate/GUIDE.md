# Workspace Dev Boilerplate

Instructions for humans and coding agents to create a **workspace shell**: a folder that orchestrates one or more existing repos for local development.

## The pattern (four files)

Every workspace shell is defined by exactly these files at the **orchestration root** (the folder you open in your editor):

| File | Role |
|------|------|
| **`.env`** | Absolute paths to repo roots and shared variables |
| **`Procfile`** | Named dev processes (Overmind reads `.env`) |
| **`Makefile`** | CLI entry point: setup, dev, git helpers |
| **`<name>.code-workspace`** | VS Code multi-root layout, settings, tasks |

```
my-workspace/
├── .env
├── Procfile
├── Makefile
├── my-workspace.code-workspace
├── app/          ← your repos (clone however you like)
└── lib/
```

**How they connect**

```
.env (paths)
  ↓
Procfile (processes use $APP_DIR, $LIB_DIR, …)
  ↓
Makefile (make dev → overmind start -l watch,server)
  ↓
*.code-workspace (folders[] mirror the same repo roots)
```

Repo layout and cloning are **your choice** — git clone, sparse checkout, symlinks, or monorepo subfolders. The skill only defines the four orchestration files.

## When to use

- You have (or will place) repos under one parent folder and want one command to run dev
- You want VS Code multi-root with shared formatter/search settings
- You are copying patterns from `archived-ws/` examples

## Create a workspace

### 1. Pick the root directory

```bash
mkdir -p ~/workspace/my-feature
cd ~/workspace/my-feature
```

Place or clone your repos here. Example:

```bash
git clone git@github.com:org/app.git app
git clone git@github.com:org/lib.git lib
```

### 2. Scaffold the four files

**Option A — init script** (writes templates only):

```bash
bash /path/to/archived-ws/skills/workspace-dev-boilerplate/scripts/init-workspace.sh \
  --dir ~/workspace/my-feature \
  --name my-feature \
  --open
```

**Option B — copy templates** from [`templates/`](templates/):

```bash
cp templates/Makefile templates/Procfile .
cp templates/env .env
cp templates/workspace.code-workspace my-feature.code-workspace
```

**Option C — copy an example** from `archived-ws/search-template/` or another workspace folder.

### 3. Wire `.env`

Set `CURRENT_DIR` to the absolute orchestration root. Add one variable per repo you orchestrate:

```bash
CURRENT_DIR=/Users/you/workspace/my-feature
APP_DIR=${CURRENT_DIR}/app
LIB_DIR=${CURRENT_DIR}/lib
```

### 4. Wire `Procfile`

One process per line: `name: command`. Use variables from `.env`:

```procfile
watch: cd $APP_DIR && npm run watch
server: cd $APP_DIR && npm run dev
lib: cd $LIB_DIR && npm run build -- --watch
```

Dependent processes can wait for artifacts:

```procfile
ide: until [ -f $APP_DIR/dist/index.js ]; do sleep 3; done && cd $APP_DIR && npm start
```

### 5. Wire `Makefile`

Minimum targets: `help`, `proc_list`, and at least one dev target:

```make
dev: proc_list
	overmind start -l watch,server
```

Add setup (`app_setup`), git sync (`gfo`), and grouped sections with `##@` — see [reference.md](reference.md).

### 6. Wire `*.code-workspace`

Set `folders` to match your repo roots plus a `ROOT` entry for the shell:

```json
"folders": [
  { "name": "ROOT", "path": "./" },
  { "path": "app" },
  { "path": "lib" }
]
```

Tune `settings`, `extensions.recommendations`, and optional `tasks`.

### 7. Verify

```bash
make help
make proc_list
make dev    # or your primary target
code my-feature.code-workspace
```

## Checklist

- [ ] Orchestration root exists; repos are in place (any layout you prefer)
- [ ] `.env` — `CURRENT_DIR` set; path var per repo root
- [ ] `Procfile` — real commands; names match `overmind start -l` in Makefile
- [ ] `Makefile` — `help`, `proc_list`, primary dev target
- [ ] `*.code-workspace` — `folders` match repo directories
- [ ] `make dev` (or equivalent) starts expected processes

## Variants

Same four files; content differs by stack:

| Variant | Typical `.env` vars | Typical Procfile |
|---------|---------------------|------------------|
| **minimal** | one `APP_DIR` | single `dev` process |
| **multi-repo** | `APP_DIR`, `LIB_DIR`, … | watch + server per repo |
| **ide** | `TOOLKIT_DIR`, `PLATFORM_DIR` | watch, build guard, electron |
| **services** | `APP_DIR` + docker vars | several `start-*` processes |

Examples in `archived-ws/`: [reference.md#examples-in-archived-ws](reference.md#examples-in-archived-ws).

## Point your agent at this guide

| Tool | Setup |
|------|--------|
| Any agent | *Follow `archived-ws/skills/workspace-dev-boilerplate/GUIDE.md`* |
| Repo rules | Link from `AGENTS.md`, `CLAUDE.md`, or `.cursor/rules/` |
| Cursor | Optional: [SKILL.md](SKILL.md) shim — [skills/README.md](../README.md) |

Templates: [`templates/`](templates/). Deep dive: [`reference.md`](reference.md).
