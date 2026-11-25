# Project status

## Intent

`data_analysis` is an **experimental** codebase for learning how to combine:

- Stateful in-memory sessions (DuckDB)
- Arrow-backed ingest
- Deterministic analysis operators
- Optional MCP exposure for agents

## Not for production

- Sessions are **process memory only** (TTL, restart, eviction).
- MCP transports other than stdio have **no API key** on the wire — treat as trusted-local only.
- Tests cover core operators, not full security or scale.

## Out of scope in this repo

- Signed host bridges, durable asset ledgers, and domain-specific order/discount tooling stay in separate internal products.

## Language

New docs, README, config, and example reports are **English**. Some dashboard UI strings copied from the upstream demo may still be non-English; treat them as cosmetic demo text, not API contracts.

## Environment

All settings use the `DATA_ANALYSIS_` prefix (see `.env.example`).