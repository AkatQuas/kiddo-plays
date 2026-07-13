# Agent Small Team

> **MVP** — A multi-agent team collaboration system built on [`@openai/agents`](https://github.com/openai/openai-agents-js).
> One-shot CLI input → automated team workflow → structured output.

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env: set OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_DEFAULT_MODEL

# Build & run
pnpm build
node dist/index.js "Analyze the project's source code structure and list all exported interfaces"
```

Full trace log is saved to `.agent-team-logs/trace-<id>.log` after every run.

## Architecture

```
                     ┌─────────────────────┐
                     │  Team Orchestrator  │  (non-LLM — state machine)
                     │  plan → execute →   │
                     │  review → retry →   │
                     │  report             │
                     └─────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────┐   ┌──────────────────┐   ┌──────────────┐
   │ Planner  │   │  Worker × N      │   │  Reviewer    │
   │ (LLM)    │   │  (LLM, isolated) │   │  (LLM)       │
   │          │   │                  │   │              │
   │breaks    │   │calls tools,      │   │checks output │
   │down tasks│   │produces output   │   │vs criteria   │
   └──────────┘   └──────────────────┘   └──────────────┘
                          │                     │
                          ▼                     ▼
                   ┌──────────────────┐   ┌──────────────┐
                   │  Reporter        │   │  Retry loop  │
                   │  (LLM)           │   │  (max 2×)    │
                   │  aggregates into │   └──────────────┘
                   │  final report    │
                   └──────────────────┘
```

### The Team Loop (Naive)

The current loop is straightforward but **naive** in several ways:

1. **Planner** decomposes the user request into atomic sub-tasks, each with explicit acceptance criteria, required tools, and dependency relationships.
2. **Orchestrator** runs each task sequentially (respecting `dependsOn`), passing predecessor outputs to dependent workers via context injection.
3. Each **Worker** receives its task description, predecessor data, and a scoped set of tools. It calls tools to produce output.
4. **Reviewer** batch-checks all worker results against the Planner's acceptance criteria. Tasks are marked `passed` or `failed` with a rejection reason and correction requirements.
5. Failed tasks are **retried** (up to `maxRetries: 2`), with the previous output and rejection reason injected into the retry prompt.
6. Once all tasks pass, **Reporter** aggregates the results into a structured final report (natural language summary + structured details + execution summary).

**Known naivety:**

- Workers are fully independent — no shared state between them except predecessor data
- Review is a single LLM call that re-evaluates **all** tasks each loop, including previously passed ones — no incremental review
- Retry always re-executes the full batch of failed tasks, even if the fix is trivial
- No prioritization, no streaming, no partial results
- The Reviewer may re-evaluate passed tasks and change its mind (inconsistent criteria)

### Agent Roles

| Role             | Type                                  | Responsibility                                                          |
| ---------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| **Planner**      | LLM (Zod output)                      | Decompose user request into atomic tasks with acceptance criteria       |
| **Worker**       | LLM (text output, `maxTokens: 16000`) | Execute one sub-task using scoped tools, produce raw output             |
| **Reviewer**     | LLM (Zod output)                      | Batch-check all results against acceptance criteria, return pass/fail   |
| **Reporter**     | LLM (Zod output)                      | Aggregate passed results into natural language + structured report      |
| **Orchestrator** | Non-LLM (TypeScript)                  | Drive state machine, manage parallelism, retries, tracing, data passing |

### Tools

| Tool             | Parameters                             | Description                    |
| ---------------- | -------------------------------------- | ------------------------------ |
| `list_directory` | `dirPath` (string)                     | List files/dirs in a directory |
| `read_file`      | `filePath` (string)                    | Read file contents             |
| `write_file`     | `filePath`, `content` (both strings)   | Write content to a file        |
| `run_command`    | `command` (string), `timeout` (number) | Execute a shell command        |
| `search_web`     | `query` (string)                       | Simulated web search           |

Tools use `strict: false` with `additionalProperties: true` for maximum compatibility with non-OpenAI Chat Completions APIs (DeepSeek, proxies, etc.).

## Project Structure

```
src/
├── types.ts              # Shared type definitions (Task, TraceLog, FinalReport, etc.)
├── context.ts            # GlobalContext + RoleContext (dual-layer context + trace logging)
├── tools/index.ts        # Global tool pool (5 tools)
├── agents/
│   ├── planner.ts        # Planner — task decomposition with Zod-structured output
│   ├── worker.ts         # Worker factory — per-task isolated agent instances
│   ├── reviewer.ts       # Reviewer — batch quality check against acceptance criteria
│   └── reporter.ts       # Reporter — aggregates results into NL + structured report
├── orchestrator.ts       # Team Orchestrator — state machine, drives the full workflow
├── provider.ts           # Model provider configuration (Chat Completions API)
└── index.ts              # CLI entry point + .env loader + trace file output
```

## Configuration

All via `.env` file:

```env
# Required: API key for the LLM provider
OPENAI_API_KEY=sk-your-key-here

# Required: Base URL for Chat Completions API
# For OpenAI:  https://api.openai.com/v1
# For DeepSeek: https://api.deepseek.com/v1
OPENAI_BASE_URL=https://api.deepseek.com/v1

# Required: Model name
OPENAI_DEFAULT_MODEL=deepseek-v4-flash
```

## Output

The CLI prints:

- **Final Report** — natural language summary + structured details + execution summary
- **Trace Logs** — timeline of all phases with duration, status, and input/output summaries

A full trace file is saved to `.agent-team-logs/trace-<id>.log` with **complete raw data** (tool outputs, worker summaries, review results) — not truncated.

## Known Limitations

- **Single-pass review**: Reviewer re-evaluates all tasks each loop, including previously passed ones. A passed task can become "failed" on a subsequent review if the LLM changes its mind.
- **No incremental retry**: The entire failed batch is retried, not just the specific failing task.
- **No partial results**: If any task exceeds max retries, the entire workflow fails.
- **No streaming**: Everything runs synchronously via LLM calls.
- **No session persistence**: Context is lost after each run.
- **Worker context window**: Long outputs may hit token limits. Current `maxTokens: 16000` mitigates this but doesn't eliminate it.
- **Tool calling depends on model**: The `deepseek-v4-flash` model (and proxies) may not support function calling reliably. Tools use `strict: false` for broader compatibility.

## Full Specification

See [`DESIGN.md`](./DESIGN.md) for the complete PRD.
