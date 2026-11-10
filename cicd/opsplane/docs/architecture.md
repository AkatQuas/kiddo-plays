# Opsplane architecture

Opsplane is an **agent-first ops control plane**: a small HTTP API that Coding Agents call to create tasks, respect locks, and inspect Kubernetes service health. There is **no built-in authentication** — bind to loopback or place it behind your own gateway.

## Pieces

| Piece | Role |
|-------|------|
| Verb catalog (`GET /catalog`) | Machine-readable API surface for agents |
| Task engine | Create → kick → resume / retry with derived `summary` |
| Lock manager | Process-local exclusivity; optional Postgres advisory locks |
| Build providers | Pluggable mechanisms: `mock`, `jenkins`, `docker`, or custom |
| K8s monitor | Overview / service detail / gate-check |

## Task semantics

- **kick** — start or continue execution
- **resume** — re-attach / continue without clearing upstream refs
- **retry** — only after upstream is confirmed terminal failure; requires `confirm=true`
- **unconfirmed** — unknown beats a wrong guess; retry is refused until inspected

`summary` is derived from steps (`running` / `ready` / `blocked` / `unconfirmed`), never stored as a separate source of truth.

## Concurrency

- One in-process run per `task_id`
- `withTaskLock` / `withTargetLock` prevent double triggers
- Deploy with `replicas=1` unless you wire Postgres advisory locks

## Build mechanisms

Providers register by id. Agents discover them via `GET /providers`. See [providers.md](./providers.md).

## Trust model

No AuthN/AuthZ in-process. Dangerous mutations use explicit boolean confirms (`confirm=true`) only as an agent foot-gun guard, not as identity.
