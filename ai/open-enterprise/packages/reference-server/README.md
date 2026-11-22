# Reference server

A **minimal integrator sample**, not a production API.

| Property | Behavior |
|---|---|
| Catalog | Manufacturing pack (`domains/`, default loader roots) |
| Identity | Fixed tenant/org/user (`OE_REFERENCE_*` env vars) |
| Authorization | Allow-all authorizer; no RBAC, no gateway |
| Schema | **`drizzle-kit push`** from `framework.ts` + `@open-erp/tables` (`oe_*` only) |

There is **no** checked-in SQL migration chain. The open tree does not ship internal product backfills or non-English DDL comments.

## Commands

From the repo root:

```bash
export DATABASE_URL=postgres://app:app@127.0.0.1:5432/open_enterprise
npm run reference:migrate   # runs drizzle-kit push
npm run reference
```

| Variable | Effect |
|---|---|
| `OE_REFERENCE_MIGRATE=0` | Skip schema apply on listen |
| `OE_REFERENCE_SCHEMA=off` | Same as above for the migrate script |
| `OE_REFERENCE_SCHEMA=push` | Explicit push (default) |

## HTTP surface

See the root [README](../../README.md#reference-write-api-postgres).

## Tests

`test/smoke.test.ts` runs only when `DATABASE_URL` is set.

## What this is not

For the full product HTTP shell (agent routes, attachments, notifications, identity gateway, custom fields), integrate your own host on `@open-erp/runtime-core`.