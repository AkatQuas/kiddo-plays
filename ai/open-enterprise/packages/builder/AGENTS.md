# @open-erp/builder

`catalog` prints JSON. `--module`, `--domain`, `--around`, and `--need` are mutually exclusive. Do not add a human-readable renderer or a `--json` flag.

`validate` and `genDbDrift` are functions. The check is `npm run test:engine`. Do not add a second command people must remember to run.

Domain root resolution is `OE_DOMAINS`, then a walk upward from the working directory for a `domains/` directory, then a path relative to this package. Do not replace that with a fixed number of parent directories.

`node --import tsx packages/builder/src/cli.ts gen:db` writes business module tables to the repo-root `tables/` directory. Framework tables stay in `packages/storage-pg`. Cleanup deletes only generated files that carry the generated banner.
