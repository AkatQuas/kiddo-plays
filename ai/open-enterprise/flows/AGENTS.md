# Flows

Edit `flows/<domain>/*.ts` and `flows/_composites/*.ts` only. Do not change `domains/`, `packages/`, or `tables/` to make a diagram connect.

When two steps both name real edges but do not connect, keep the later step. Deleting it hides the gap. An edge that does not exist, or an `internal` edge, fails the load.

Flow files do not execute documents. A directory whose name starts with `_` is not loaded as a domain. Composite flows live only in `flows/_composites/`.

From the repo root, `npx vitest run packages/loader/test/loader.test.ts` checks that the manufacturing catalog loads. `packages/metamodel/test/flow.test.ts` uses fixtures and does not read this directory.
