# @open-erp/loader

This package is the only disk scan that builds a catalog. Do not add a second scanner.

Load ledgers and call `activateLedgerCatalog` before scanning domains. A missing `ledgers/` directory installs an empty catalog, not null.

`createEngineRegistry()` keeps more than one loaded pack in one process. `run(id, fn)` selects that pack's ledger catalog for the call. Module codes stay unique inside one engine.

- `DOMAIN_MENU_ORDER` orders `catalog.domains`. Unlisted domains still load, appended by code. Sidebar groups come from `navigation.ts`, which must exist for a product root.
- A directory that looks like a domain but has no `package.json`, no `domain.ts`, or `modules: false` while `modules/` contains files fails the load. Do not skip it.
- `insights/` and `ledgers/` are not business domains. The only allowed files there are `insights.ts` and `ledgers.ts`.
- A module export that is not already a draft is passed through `defineModule` and then sealed. Do not run `defineModule` again on a module that already carries derived keys. A surface, insight, or ledger without the kernel symbol is rejected.
- `planners`, `actionPreparers`, `batchActions`, and `surfaces` are named exports from `modules/<code>/index.ts` only.
- An agent is one `<id>.md` file. An unknown key fails the load.
- Flows are scanned after every domain is loaded. `fatal` fails the load. `gap` is recorded. A missing `flows/` directory yields an empty list in this package.
- A missing `quick-asks/` directory yields an empty list. If the directory exists, a broken `generic-tokens.json` or a broken `asks/*.json` fails the load. This repository does not ship a `quick-asks/` tree.
- This package does not load demo rows. `domainsRoot()` is the only domains-path algorithm.
