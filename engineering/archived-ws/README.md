# archived-ws

Personal **workspace shells** for multi-repo local development. Each folder is a template or example orchestration root (not application source).

## Quick start

1. Create a folder and put your repos in it (any layout you prefer):
   ```bash
   mkdir -p ~/workspace/my-feature && cd ~/workspace/my-feature
   git clone git@github.com:org/app.git app   # your choice
   ```
2. Scaffold the **four files** (`.env`, `Procfile`, `Makefile`, `*.code-workspace`):
   ```bash
   bash skills/workspace-dev-boilerplate/scripts/init-workspace.sh \
     --dir . --name my-feature --open
   ```
3. Edit `.env` and `Procfile` for your paths and commands; add repo folders to the workspace JSON. Run `make help`.

Or copy a complete example from `search-template/` and adapt.

## Agent guides (`skills/`)

Reusable workflow docs under [`skills/`](skills/) for **any coding agent** or human. Not tied to a single IDE or vendor.

### Available guides

| Guide | Path | Use when |
|-------|------|----------|
| **workspace-dev-boilerplate** | [`skills/workspace-dev-boilerplate/GUIDE.md`](skills/workspace-dev-boilerplate/GUIDE.md) | Creating the four-file shell: `.env`, `Procfile`, `Makefile`, `*.code-workspace` |

Each guide folder has:

- **`GUIDE.md`** — primary, agent-agnostic instructions
- `reference.md`, `templates/`, `scripts/` — supporting assets
- `SKILL.md` — optional thin adapter for Cursor skill discovery only

### Reuse with your agent

**In chat** — reference the guide path:

```
Follow archived-ws/skills/workspace-dev-boilerplate/GUIDE.md to create workspace search-foo.
```

**In repo rules** — link `GUIDE.md` from `AGENTS.md`, `CLAUDE.md`, or `.cursor/rules/`.

**Without an agent** — scaffold the four files, then wire paths yourself:

```bash
bash skills/workspace-dev-boilerplate/scripts/init-workspace.sh \
  --dir ~/workspace/my-feature --name my-feature --open
```

Clone repos before or after; the script does not run `git clone`.

Templates: [`skills/workspace-dev-boilerplate/templates/`](skills/workspace-dev-boilerplate/templates/).

Deep dive: [`skills/workspace-dev-boilerplate/reference.md`](skills/workspace-dev-boilerplate/reference.md).

### Optional: Cursor skill install

Only needed if you want Cursor to auto-discover the guide via its skills system:

```bash
ln -sf "$(pwd)/skills/workspace-dev-boilerplate" ~/.cursor/skills/workspace-dev-boilerplate
```

Cursor loads `SKILL.md` for metadata; the actual workflow is in `GUIDE.md`. Other agents should use `GUIDE.md` directly — see [`skills/README.md`](skills/README.md).

### Add a new guide

1. Create `skills/<name>/GUIDE.md` (when to use, steps, checklist).
2. Add `reference.md`, `templates/`, or `scripts/` as needed.
3. Optionally add `SKILL.md` with YAML frontmatter for Cursor users.
4. Register in [`skills/README.md`](skills/README.md) and the table above.

## Layout

| Path | Role |
|------|------|
| `search-template/` | Canonical template + clone scripts |
| `maide/`, `tila-v1/`, `tila-v2/` | IDE stack examples (toolkit + platform repos) |
| `fire/` | Dual-monorepo example |
| `ws-mobile/`, `ws-compass/` | Multi-app + docker services |
| [`skills/`](skills/) | Agent-agnostic guides + templates |

## Requirements

- `make`, `bash`, [Overmind](https://github.com/DarthSim/overmind)
- `yarn` or `npm` per sub-repo
- Optional: Docker for redis/mongo helpers in some Makefiles

Set paths in each workspace `.env` (`CURRENT_DIR`, repo dirs).
