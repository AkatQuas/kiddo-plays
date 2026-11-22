# Reference schema

This directory is **not** a copy of the internal product migration journal.

The reference server applies schema with **`drizzle-kit push`** against:

- `packages/storage-pg/src/db/framework.ts` (engine tables, `oe_*`)
- `tables/src/*.ts` (module tables generated from `domains/`, `oe_*`)

That keeps one source of truth (TypeScript declarations) and avoids shipping:

- Incremental **business backfill** SQL
- Locale-specific SQL comments
- SQL whose table prefix does not match this repo (`oe_*` only)

Maintainers may add an optional squashed `.sql` here for air-gapped installs; the default open tree stays empty.