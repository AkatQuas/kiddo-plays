# repo-report

AI daily commit analysis and team report push system. Automatically collects incremental commits from multiple Git repositories, analyzes changes via Claude Code CLI, and pushes a unified daily report to collaboration webhooks.

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/)
- Git 2.0+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` in PATH)
- SSH keys configured for private remotes (if applicable)

## Quick start

```bash
cd repo-report
uv sync --extra dev
cp config/config.yaml.example config/config.yaml
# Edit config/config.yaml: repos, push channels, paths
uv run repo-report run --config config/config.yaml --dry-run
```

## Configuration

Single file `config/config.yaml` with sections:

| Section | Purpose |
|---------|---------|
| `global` | Paths, concurrency, log retention, disk threshold |
| `ai` | Engine, timeout, retries |
| `push` | Channel list and retry policy |
| `repos` | Repository list (name, url, branch, enabled) |

Copy from [`config/config.yaml.example`](config/config.yaml.example).

### Local repository

Set `url` to an absolute path of an existing Git repo; the tool clones it into `global.repos_root/{name}` on first run.

## CLI

```bash
uv run repo-report run --config config/config.yaml
uv run repo-report run --config config/config.yaml --since 2026-05-20 --until 2026-05-27
uv run repo-report run --config config/config.yaml --dry-run
```

- `--dry-run`: runs full pipeline including AI, but skips webhook push and cursor updates
- `--since` / `--until`: manual date range for commit collection

## Crontab (daily 23:00)

```cron
0 23 * * * cd /path/to/repo-report && /path/to/uv run repo-report run --config ./config/config.yaml >> ./log/cron.log 2>&1
```

Suggested crontab expression is also in `global.cron_expression` (documentation only).

## Logs

Logs are written to `global.log_dir` as `repo-report-YYYY-MM-DD.log`. The full generated daily report is written to this log on every run (in addition to webhook push). Files older than `log_retention_days` are deleted automatically.

## Cursor files

Append-only cursor logs in `global.cursor_dir`:

```
{timestamp}|{commit_sha}
```

The last line is the incremental scan starting point. To rescan history, delete or edit the cursor file manually.

## AI prompt

All AI engines use the bundled template at [`prompts/analyze_repo.txt`](prompts/analyze_repo.txt) (next to `src/`). It is not configurable. To change analysis behavior, edit that file in the repository.

## Push channel extension

1. Subclass `PushChannel` in `src/repo_report/push/`
2. Register in `PUSH_REGISTRY` in `src/repo_report/push/factory.py`
3. Add entry under `push.channels` in config:

```yaml
push:
  channels:
    - type: mychannel
      enabled: true
      webhook_url: "https://..."
```

## Repository operations

| Action | Steps |
|--------|-------|
| Add repo | Add entry under `repos`, set `enabled: true` |
| Pause repo | Set `enabled: false` |
| Remove repo | Delete config entry; stale dirs are archived to `/tmp/repo-report-archive/` on next run |
| Rescan history | Delete cursor file for that repo/branch |

## Development

```bash
uv run pytest
```

## Architecture

- **Orchestrator**: lock → validate → archive stale → parallel repo workers → report → push → cursors
- **AI**: `AIAgent` base class + `claude-code` adapter with retry (401/429/500/timeout, max 3)
- **Push**: `PushChannel` base class + config-driven factory + per-channel retry wrapper
