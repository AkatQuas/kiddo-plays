# normalize

`compileSqlCell` does not understand surface-added `{{param}}`, `{{like}}`, `{{offset}}`, or `{{ledgerNet}}`. Do not merge those into one template. Neither side allows `tenant_id`, semicolons, or template interpolation. The executor injects the tenant.

A normal dynamic `refFilter` whose operand is missing is `pending`: the candidate list is empty and the write is rejected. Do not fall back to an unfiltered list. A `through` or `field` path skips that clause when the upstream value is empty. It does not become pending.

`listLedgerCodes` throws when no ledger catalog is installed. Do not keep a ledger-code list inside the kernel. The loader installs an empty catalog when `ledgers/` is missing, and the code list is then an empty array. `assertLedgerCatalog` requires quantity ledgers to have a scope and money ledgers to have none. `defineLedgers` does not call it. The stock read model expects exactly one ledger with `measure=quantity` and a non-empty `scope`.

When one insight cell fails, record `dataQuality.unavailable` and continue. Do not fail the whole insight. The failed cell's `value` is 0. That 0 is not a real zero.
