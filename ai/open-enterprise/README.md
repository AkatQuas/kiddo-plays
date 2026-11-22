# Open Enterprise

MIT-licensed monorepo for a schema-driven ERP engine, two domain packs (manufacturing + commerce showcase), and several small runnable services (catalog, reference write API, service-link demo).

A module declares fields, a lifecycle, handoffs, preconditions, and views. A transition is an edge. Posting effects on that edge append ledger rows. The engine does not name factory documents or shop documents. Those names live in a domain pack.

## Architecture

```text
domain pack (domains/, flows/, navigation)
        │  loadCatalog
        ▼
@open-erp/loader ── activates the ledger catalog for that load
        │
        ▼
@open-erp/metamodel     declaration language, no file or database IO
@open-erp/runtime-core  re-evaluate inside the transaction, then execute the edge
@open-erp/storage-pg    tenant scope, optimistic revision, append-only ledger rows
@open-erp/builder       catalog JSON and table generation into tables/
```

One process can register more than one domain pack. `createEngineRegistry()` in `@open-erp/loader` loads each pack into its own engine. `registry.run(id, fn)` enters that engine, so ledger lookups see that pack's books. Module codes are unique inside one engine. Two engines may both declare `product`. Physical table names are `oe_<module>` and do not include the engine id, so two packs must not write the same Postgres database.

The published ledger rules are `stock` (quantity, per warehouse, no negative balance) and `ap` (money, per supplier, with reserve, release, in, and out). Manufacturing defines them in `domains/ledgers/ledgers.ts`. Commerce defines the same two rules in `showcases/commerce/domains/ledgers/ledgers.ts`.

A **reference HTTP shell** (`packages/reference-server`) can create documents and run transitions against Postgres with a fixed demo identity — not a production ERP API. Identity gateway, object storage, and an external agent host are not in this repository.

## Open-source scope

This tree is meant to be **cloneable, testable, and runnable without private infrastructure**.

| Included | Not in this repo (integrate in your product) |
|---|---|
| Schema language, gates, manufacturing + commerce packs, reference write API | Full multi-tenant HTTP API (`packages/server` in the internal monorepo) |
| Generated `tables/`, `flows/`, `navigation.ts`, agent/skill prompts (English) | Product `quick-asks/` JSON (home-screen phrases → preflight); loader accepts an empty `quick-asks/` sibling |
| Service-link sample (`apps/api`, `apps/web`, `apps/agent`) + catalog showcase | Complete React console, hosted agent UI host |
| Docker Compose for Postgres + samples | Customer-specific identity gateway wiring |
| Reference schema via `drizzle-kit push` (`oe_*` from TypeScript) | Internal product SQL journal / backfill migrations |

**Verification:** `npm test` runs **2316** engine tests, service-link API tests, and an optional reference-server smoke test (skipped unless `DATABASE_URL` is set). Modeling gates live in `packages/builder/test/gate.test.ts`. The domain-swap proof (`packages/builder/test/domainSwap.gate.test.ts`) is intentionally excluded until minimal swap fixtures ship — see the file header.

**Integrator path:** study declarations and gates in-repo → run `npm run showcases` for read-only catalog → run `npm run reference` with Postgres to exercise create/transition → wire your own HTTP, identity, and ops around the same packages.

Agent prompts reference **`open-agent-ui`** fence cards (not a vendor-specific host name). UI card components use the `open-*` prefix (`open-bill-table`, `open-create-confirm`, …).

## What is in the tree

| Path | Role |
|---|---|
| `packages/metamodel` | Declaration language |
| `packages/loader` | Loads a domain pack. Registry for more than one pack in one process |
| `packages/builder` | `catalog` JSON and `gen:db` |
| `packages/runtime-core` | The only status-write path |
| `packages/storage-pg` | Postgres adapter and framework tables |
| `domains/`, `flows/`, `navigation.ts`, `tables/` | Manufacturing pack and its generated tables |
| `showcases/commerce` | Commerce pack: product, warehouse, supplier, customer, goods receipt (`stock.in`), shipment (`stock.out`) |
| `apps/api`, `apps/web`, `apps/agent` | Service-link sample. Its own orders table. It does not post `stock` or `ap` |
| `apps/catalog-api` | Loads both packs. `GET /api/manufacturing/catalog`, `GET /api/manufacturing/ledgers`, and the same paths under `/api/commerce` |
| `packages/reference-server`, `apps/reference-api` | Postgres + manufacturing pack: create bill, get bill, run transition (`/api/modules/...`). Demo tenant identity, no RBAC |
| `apps/web-manufacturing`, `apps/web-commerce` | Two pages. Each calls only its own path on the catalog API |

Manufacturing assistant scripts under `domains/**/skills` and `domains/**/agents` are runtime prompts for that pack. They are English. Status values stored on documents are English identifiers such as `pendingReview` and `awaitingShipment`. They are not the project guide.

## Develop

Node.js 22 or newer.

```bash
npm install
npm test
```

`npm test` runs the engine suite and the service-link tests. Narrow runs:

```bash
npm run test:engine
npm run test:link
```

Regenerate manufacturing tables after a module declaration change:

```bash
node --import tsx packages/builder/src/cli.ts gen:db
```

`catalog` prints JSON only. `validate` is not a command. The check is `npm run test:engine` (`packages/builder/test/gate.test.ts`).

`OE_DOMAINS`, when set, selects the domains directory for the loader default. `OE_TIMEZONE` is the business timezone for numbering and relative dates. `OE_TABLES_MODULE` overrides the generated-tables module. None of these have a silent default that points at another database.

## Run

### Service-link sample

Needs Postgres. Compose also starts the catalog API and both showcase pages because they share `docker-compose.yml`.

```bash
docker compose up --build
```

| URL | Process |
|---|---|
| http://localhost:8088 | Service-link desk |
| http://localhost:8091 | Catalog API |
| http://localhost:8092 | Manufacturing page |
| http://localhost:8093 | Commerce page |
| http://localhost:8094 | Reference write API (Postgres) |

Sample users on port 8088: `clerk@sample.test` and `manager@sample.test`, password `demo-pass`. A clerk can stage an order. A manager confirms it. The optional agent calls back with `X-Service-Token` and `X-Acting-User`. Its reply is a summary and an evidence id. `RELEASE_ENV=prod` refuses `IDENTITY_ISSUER=local`. Attachments are stored only when `ATTACHMENT_BACKEND=file`.

Source mounts for the service-link services:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Showcase pages without the service-link stack

```bash
npm run showcases
WEB_PORT=8092 API_UPSTREAM=http://127.0.0.1:8091 node apps/web-manufacturing/src/server.js
WEB_PORT=8093 API_UPSTREAM=http://127.0.0.1:8091 node apps/web-commerce/src/server.js
```

The catalog API listens on 8091. Each page proxies `/api/...` to that process. The pages list modules and ledger rules. They do not insert documents.

Commerce inbound and shipment declare stock postings. Those effects are checked when the pack loads. This API does not execute them.

### Reference write API (Postgres)

On startup, applies schema with **`drizzle-kit push`** (framework + generated `tables/`, `oe_*` only — no checked-in business backfill SQL), then exposes a small JSON API for the manufacturing pack.

```bash
# Postgres required (Compose brings it up on 5432)
export DATABASE_URL=postgres://app:app@127.0.0.1:5432/open_enterprise
npm run reference:migrate   # optional; `npm run reference` migrates by default
npm run reference           # listens on 8094
```

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz`, `/readyz` | Liveness |
| `GET` | `/api/catalog` | Module list |
| `POST` | `/api/modules/:module/bills` | Create (`{ "header": { ... }, "lines": { ... } }`) |
| `GET` | `/api/modules/:module/bills/:id` | Read one bill |
| `POST` | `/api/modules/:module/bills/:id/transitions/:code` | Run an edge |

Example (warehouse master, no transition):

```bash
curl -sS -X POST http://127.0.0.1:8094/api/modules/warehouse/bills \
  -H 'content-type: application/json' \
  -d '{"header":{"name":"Main warehouse"}}'
```

`OE_REFERENCE_MIGRATE=0` skips schema apply on listen. `OE_REFERENCE_SCHEMA=off` skips push in `reference:migrate`. `OE_REFERENCE_TENANT_ID`, `OE_REFERENCE_ORG_ID`, `OE_REFERENCE_USER_ID` override the fixed demo identity.

First connect creates framework and module tables from declarations (not from a copied internal migration chain). The service-link sample uses the same Compose Postgres instance but **different application tables**; sharing one `DATABASE_URL` is supported for local demos only.

Details: [`packages/reference-server/README.md`](packages/reference-server/README.md).

## License

This repository is [MIT](LICENSE). Database shape for the reference API comes from in-repo TypeScript (`packages/storage-pg`, `tables/`); apply it with `npm run reference:migrate` (drizzle-kit push), not from a product migration journal.
