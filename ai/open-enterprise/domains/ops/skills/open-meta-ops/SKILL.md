---
name: open-meta-ops
description: Unfamiliar reads, creates, edits, approvals, and posting. Load when no leaf plan applies.
version: 1.1.11
triggerWords: [query, document, approve, post, ledger, create, edit, module, transition, meta tool, ERP]
---

# Meta-tool handling

This is the safety gate for unfamiliar business, general read-only exploration, and writes. Keep intent, objects, and protocols already confirmed in this session. This turn's host capabilities, permissions, and tool results override history. History is not a current fact. This is also the exploration path when a narrow skill does not cover the variant. It is not a refusal and not a quality fallback.

## Choose a lane first

- A broad operating question starts with `insight_brief`. Do not use this skill to discover it.
- Customer sales totals or rankings use `analysis_sql` (`INNER JOIN oe_customer` for `name`, `SUM` of header `total_amount`). Not `insight_brief`, and not mental math on `bill_list`. "How are sales this month" is still `insight_brief(sales_month)`. "Who is owed the most" is still `sales_receivable`.
- An `insight_brief` schema, a leaf skill, or a plan already described this turn: emit the calls. Do not discover again.
- A narrow read of a known module: list records, a few columns, or a check with `bill_list` + `fields` + `nextOffset`. Not `analysis_sql`. `code`, `status`, and dates also go straight to `bill_list` or `bill_get`. After a schema rejection, at most one targeted `module_describe`.
  Header plus this document's lines use `bill_get` (at most 20 lines). Cross-document line filters, ranks, and weights use `analysis_sql`.
- An unknown module, an uncertain field, or any write: follow discovery, contract, preview, then execute below. Do not replace the gate with "try, then change the arguments".

## General read-only exploration when there is no narrow query

No exact leaf skill, a leaf skill that misses this variant, or an unavailable plan does not mean stop, and does not mean a nearby metric may stand in. Decide in this order:

1. Confirm the business fact, time range, grain, and the full population of people or documents. If one missing coordinate would change the answer, ask one minimal question.
2. If the current module declaration and query contract already prove the answer is a **single-module** list or aggregate with a clear field definition and full coverage, explore: fetch only that module's `query` or `analysis` contract if needed, then `bill_list` or `analysis_sql`. Aggregates finish in the database. Do not hand one page to the model to stitch, zero-fill, or add.
3. If the question needs a cross-module join, a dispatch or report relationship, a derived metric, every person including zeros, or the business word has no single definition in the current declaration, decide whether the declared relations and tools can prove the result. If they cannot, state the real gap, return facts already verified this turn when permission and the service allow it, say those facts are not the target metric, and offer a next step: add the relation or definition, supply the missing coordinate, or retry. Do not answer with task counts, order counts, report counts, or a nearby field. Do not refuse with zero calls.
4. `ops_search` and `ops_describe` discover **declared operation contracts**. They are not a data search or a quality fallback when a narrow query is missing. `modules_search` is called once, and only when the module is unknown. It does not replace a business read. No hit, or candidates that cannot be told apart: say so, or ask one minimal question.

Independent reads of the same question go out together. Ask one minimal question only when a business coordinate would materially change the answer.

## Fixed path for unfamiliar work and writes

1. Call `module_describe` with a single `section`: `fields` for create and edit, `lifecycle` for a status move, `query` for a lookup, `relations` for cross-document work. One section per step. `fields` and `query` start with the index. Fetch a field detail only when you must fill that enum, reference, or default. Do not pre-read every field.
2. `ops_search` then `ops_describe` for the operation contract. Pass `module` when it is known. Do not put the module name in the keyword.
3. To locate by business number or name, `bill_list` first and take the unique `id`. Do not mix `code`, name, and internal `id`. A `bill_list` before create resolves foreign-key ids only. It is not a duplicate check.
4. After the create envelope is assembled, show `open-create-confirm` (the filled draft). Call `bill_create` only after the user confirms. Do not create silently. Details are in `writes-transitions`.
5. A status action is `bill_get` for the operations actually available, then `bill_preview`, then `bill_execute` only under the current contract.
6. Cite only tool facts. Keep paging, truncation, missing relations, and gate reasons as returned.

## References, on demand

After this skill is loaded, read one reference only when that detail is required. Do not load all of them:

- `query-analysis`: lists, aggregates, relative time, ledgers, and name resolution.
- `writes-transitions`: create, edit, delete, preview, execute, idempotency, and failure gates. Create shows a confirm card, then `bill_create`.
- `attachments-relations`: attachment text, continued reads of long documents, and relation walks.

## Invariants

- No permission, missing identity, missing capability, a service error, and a missing business fact stay distinct. Do not switch entrances to get around 401 or 403.
- Amounts, balances, quantities, and completion rates use the tool's business definition. Do not calculate them in the model.
- A preview `block` stops. A `warn` is shown as returned. Do not change arguments to slip past the gate. `bill_propose` is a draft awaiting confirmation. It is not in effect.
- Do not rewrite a tool failure as success. Do not invent an evidence or trace id. The body shows names, numbers, and field labels a business user can read.
