# @open-erp/storage-pg

Connect as the database owner. This package does not use row-level security. A forgotten scope returns extra rows. It does not throw.

- Read module tables with `moduleScopedWhere` (tenant plus that module's data scope). Read framework tables with `scopedWhere` (tenant only). Do not use `scopedWhere` on a module table. `refLabels` and `refLineLabels` are tenant-only and only for display. Their ids must already have been read under scope.
- A null identity throws `IdentityMissingError`. Do not touch `identity.roles` first and turn that into a TypeError. Writes use `scopedValues`. A caller-supplied `tenantId` or `orgId` is ignored.
- Predicates inside a scope group are AND. Groups are OR. With no `groups`, each predicate is its own group, then OR. `all` must be the only group and must have no predicates. An unknown or empty policy returns zero rows, not the whole table. A predicate field must be a real header column.
- Derived fields have no column. Do not drop a condition on one quietly.
- Lines are reached through the header. Modules do not reference each other with foreign keys. The only foreign key is a line `billId` cascading to that module's header.
- A conditional write carries the expected status and revision. Zero rows means stale. Do not retry with the current row.
- The global lock order is `compareLockKeys` only. Balance lock keys use `JSON.stringify`. Do not join them with NUL. Timeouts use `SET LOCAL` inside the transaction. Do not `SET` on a pooled connection.
- Ledger rows are append-only. Signed sums use the kernel implementation only. `nonNegative` follows the ledger contract. Do not branch on ledger code. A scoped ledger cannot be totaled without its scope.
- There is no period-close write barrier. A filled `posting_period` is not a closed period. Do not open a period during posting. A reversal uses the period resolved for this execution.
