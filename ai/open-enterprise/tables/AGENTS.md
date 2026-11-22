# tables

Do not edit these files by hand. Business tables are generated from `domains/`. Framework tables stay in `packages/storage-pg`.

`node --import tsx packages/builder/src/cli.ts gen:db` writes `tables/src/*.ts`, `tables/analysis-catalog.json`, and `tables/hatches.json`. Cleanup deletes only `tables/src/*.ts` files that start with the generated banner. A file without that banner is left in place and will not be updated.

If a declaration and the generated files disagree, `npm run test:engine` fails in `packages/builder/test/gate.test.ts` and `packages/builder/test/codegen.test.ts`.

A wide generated diff must be explained by the source change that produced it. This repository does not ship a migration runner.
