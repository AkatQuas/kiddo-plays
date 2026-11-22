---
name: writes-transitions
description: Create, edit, void or cancel history, status actions, preview, execute, and failure gates.
version: 1.0.6
---

# Writes and status actions

The current identity has no permissions of its own. Follow this turn's tool effect, confirm, permission, and status contract.

## Create, edit, and history

- Create: `module_describe(section="fields")` first, for the writable field index of the current identity. Fetch a field detail only for an enum, reference, or default you will actually fill. `bill_list` resolves a unique foreign-key or reference `id` (order intake and similar). Do not scan the list to prevent duplicates. After the model assembles the envelope, show `open-create-confirm` (the filled draft). Call `bill_create` only after the user confirms. Do not create silently. Leave a cell empty when the material does not contain it. Do not invent a tax id or guess a phone number. On `UNIQUE_DUPLICATE`, show the existing record. Do not pre-read every field. Do not send system fields, codes, status, or derived totals that are absent from the index.
- Edit: `bill_get` and read `editableFields`. Put only fields the user explicitly asked to change in `patch`. Omit `lines` when lines are unchanged. Sending `lines` replaces the whole set.
- The general assistant does not hard-delete a business fact. When the user says "delete", `bill_get` the actions available now, then `ops_search` / `ops_describe` for that module's void, cancel, reversal, or disable contract. If none is declared, say this assistant does not delete. Do not guess a tool name or write the status field.
- `code` is the document number. Write APIs want `id`. Resolve customer, supplier, and product refs to a unique `id`. Do not put a display name into a ref.

## Status actions

1. `ops_search` then `ops_describe` for one operation contract: parameters, business gates, posting, push, and handoff after execute.
2. `bill_get` to confirm the operations this document can take now.
3. `bill_preview` the edge. Keep the returned checks, `fingerprint`, and idempotency coordinate.
4. `bill_execute` only when the user explicitly asked to execute and the current contract allows it.

A preview `block` stops. Explain the reason as returned. A `warn` is shown as returned and the warning is sent back per the contract. Do not change arguments to slip past the gate. `bill_propose` only creates a draft. It does not change status or post. After the call, say it is not in effect. Do not `bill_update` the `status` field.

Retries of the same business intent reuse a stable `idempotency_key`. Do not hide a duplicate execution by changing the key.

## Failure

- `401` or missing identity: stop.
- `403`: this identity or data scope does not allow it. Stop. Do not switch tools to get around it.
- `404` or an unknown operation: `ops_search` again, precisely. One `modules_search` if the module is unknown. If it is still missing, report a capability gap.
- A schema, state-machine, or precondition error: state the field, status, or business gate as returned. Do not loop on guessed arguments.
- Keep `checks` verbatim. Do not compress them into a useless "failed".

A write receipt has coordinates only (`executed`, `outcome`, `from`, `to`, new `id`). It does not include the whole document, the gate, or the audit. Lines come from `bill_get`. Gates come from `bill_preview`. Say whether the result is `executed=true`, `replayed`, preview only, or awaiting confirmation. Every number must point at a real tool fact.
