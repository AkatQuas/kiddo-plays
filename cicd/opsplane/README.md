# Opsplane

Agent-first **ops control plane**: tasks with locks, pluggable build mechanisms, and Kubernetes service monitoring.

- **License:** MIT
- **Package manager:** npm only (no yarn)
- **Auth:** none — do not expose to the public internet

## Quick start

```bash
cp .env.example .env
npm install
npm test
npm start
```

Server defaults to `http://127.0.0.1:43200`.

Ask an agent to start with:

```bash
curl -s http://127.0.0.1:43200/catalog | jq .
```

## What it does

1. **Tasks** — create a work unit with one or more steps; engine kicks providers; `summary` is derived.
2. **Locks** — per-task and per-target exclusivity so agents cannot double-fire builds.
3. **Providers** — `mock`, `jenkins`, `docker`, plus a registry for custom CI.
4. **K8s monitor** — `/monitor/overview`, `/monitor/services/:id`, `/monitor/gate-check`.

## Configuration

See [`.env.example`](.env.example). Field layout is inspired by common ops deploy configs (database, Jenkins, Docker, K8s, Prometheus/logs bases) but uses only placeholders and example.com hosts.

Service/env facts live under [`catalog/examples/`](catalog/examples/).

## Docs

- [Architecture](docs/architecture.md)
- [Providers](docs/providers.md)

## Safety

This process has **no authentication**. Bind to loopback, a private network, or your own gateway. Production writes should still require explicit `confirm=true` from the calling agent where the API demands it.
