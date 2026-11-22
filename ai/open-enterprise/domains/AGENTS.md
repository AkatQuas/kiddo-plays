# domains/

Business declarations live in this tree. Change a document here. Do not edit `packages/` or hand-edit `tables/` to make a document appear.

This tree is the manufacturing pack. The commerce pack is `showcases/commerce` and is loaded separately.

Module escape hatches must not write status or ledger rows outside `evaluate` then `execute`. Use a precondition, `derive`, `lineAgg`, or `handoff` before adding `modules/<code>/index.ts`. Change `packages/` only when the same hatch shows up a second time. After a new hatch, regenerate tables so `tables/hatches.json` matches. Do not add a handwritten allow-list in `packages/builder/test/gate.test.ts`.

## Where the rules live

- Declaration language: `packages/metamodel/src/schema/AGENTS.md`
- Surfaces, insights, SQL cells: `packages/metamodel/src/normalize/AGENTS.md`
- Load: `packages/loader/AGENTS.md`
- Catalog and table generation: `packages/builder/AGENTS.md`
- Writes: `packages/runtime-core/AGENTS.md`
- Scope and locks: `packages/storage-pg/AGENTS.md`
- Generated tables: `tables/AGENTS.md`
- Flows: `flows/AGENTS.md`

This repository does not include the HTTP authorization service or the agent tool host. Those rules are not restated here.

## Modeling

Leave `help` off a field unless the declaration cannot express the fact and a caller would do the wrong thing without it.

Write `message` on a precondition. Otherwise the caller sees the primitive `detail`.

`required` means required on every stored row, including the initial status. A field required only on the next edge belongs on that edge's precondition.

`moduleSettings` options are defined in code. A tenant database stores the selected value only. Every option needs an implemented, tested branch.

Adding a ledger is a product decision. `defineLedgers` and `assertLedgerCatalog` check shape. They do not cap the number of books. The manufacturing pack publishes `stock` and `ap` only.

Do not require a quantity to equal the primary unit. Ten boxes is a legal auxiliary quantity. Comparing it as ten pieces is wrong.
