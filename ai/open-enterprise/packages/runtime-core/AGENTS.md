# @open-erp/runtime-core

Status changes go through one path: `evaluate` again inside the transaction, then execute. Create, draft save, and delete enter through this package. They are not transitions.

- `setStatus` names the target edge, not the target status. Do not add a repository method that writes status directly. A target edge must not carry its own planner. Two-level commands flatten into one plan. A warning the caller has not seen rolls the group back. Do not forward another edge's confirmation text.
- A preview does not replace the evaluation inside the transaction. A warning confirmation must match the sentence the caller saw.
- Reversal posts by reconciling the ledger. Preview and execute share that calculation. A preview must not invent the posting period.
- Authorization runs before idempotent replay. Replay runs before business gates. An empty `idempotencyKey` does not replay. Do not invent a default key.
- A conditional write carries the caller's expected revision. Zero rows means the revision is stale. Do not retry with a revision just read.
- `exact` and `latest` follow the declared consistency. Do not infer it from whether a fingerprint is present. A blocked call has fingerprint `null`, not an empty string. `latest` does not check the fingerprint. When the caller sent an expected revision, a mismatched source revision is still rejected.
- Hand the whole lock-coordinate set out once. Do not sort each batch on its own.
- A rule query that exceeds the row cap throws. Do not truncate.
- `$actor` has no single `role` value. `agentId` comes from the request identity. An unknown agent must not be stored as `null` to mean "not an agent".
- Each execution resolves the posting period once per book. A reversal uses that period, not the period on the reversed row.
