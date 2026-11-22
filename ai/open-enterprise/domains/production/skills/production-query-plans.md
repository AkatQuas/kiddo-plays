---
name: production-query-plans
description: Production orders, output, worker reports, release to the shop, and operations.
version: 1.5.2
triggerWords: [orders in production, today's output, worker reports this month, cannot start, what release needs, new production order, dispatch a production task, completion receipt]
---

# Narrow production queries and release preparation

## How many production orders are in production now

One `bill_list`. Answer with `total`:

```json
{"module":"productionOrder","query":{"where":{"kind":"cond","field":"status","op":"in","value":["releasing","inProduction","reported"]}},"limit":1,"offset":0}
```

## How much was planned to finish today, and how much actually finished

Two `analysis_sql` calls in parallel, both grouped by product:

```json
{"sql":"SELECT product_id, SUM(base_planned_qty) AS planned_qty FROM oe_production_task WHERE date(planned_end_date) = current_date GROUP BY product_id LIMIT 20"}
```

```json
{"sql":"SELECT product_id, SUM(base_qualified_qty) AS completed_qty FROM oe_process_report WHERE status = $1 AND date(reported_at) = current_date GROUP BY product_id LIMIT 20","params":["completed"]}
```

Today's output is qualified quantity on approved reports. Do not filter the backfillable `actualEndAt` on the production task and then add the task's cumulative completion.
Do not add quantities of different products into one "plant completion". Receipt into stock is `productionReceipt`, not output.

## Worker report data this month

Two `analysis_sql` calls in parallel. Do not call `insight_brief` first, do not search or describe modules, do not read report lines or the full person table, and do not add operation, team, or product distributions by default.

The person is header `worker_id` on the report. There is no per-person report line. Both the total and the per-person figures sum the header. Count only status "completed" (approval completes the report; receipt into stock does not change the report status).

Plant total:

```json
{"sql":"SELECT COUNT(*) AS total_reports, SUM(base_qualified_qty) AS total_qualified, SUM(base_defect_qty) AS total_defect, SUM(work_hours) AS total_work_hours FROM oe_process_report WHERE status = $1 AND date_trunc('month', reported_at) = date_trunc('month', current_timestamp) LIMIT 1","params":["completed"]}
```

Per person:

```json
{"sql":"SELECT worker_id, SUM(base_qualified_qty) AS qualified_qty, SUM(base_defect_qty) AS defect_qty, SUM(work_hours) AS work_hours FROM oe_process_report WHERE status = $1 AND date_trunc('month', reported_at) = date_trunc('month', current_timestamp) GROUP BY worker_id ORDER BY qualified_qty DESC LIMIT 20","params":["completed"]}
```

Count only reports whose report time is this month and whose status is completed. Pending review is excluded. Pay is also computed only when the report is completed, independent of stock receipt.
Header `totalReports` is the number of report documents. If any result has `truncated=true`, say the person groups are incomplete. Do not state a full-population conclusion.

## Why a production task cannot start

A make-in-house schedule (order list "Schedule production", with `processLines`) already wrote operations onto the production-task subtable in the same transaction.
Approval of that task is `approveScheduled`, which enters production. Do not also run `launch*`.
Assignment onto a person is `productionTask.assign`: after the operation lines are expanded, each person gets one `processAssignment` (initial status pending review).

For a named production task, `bill_get` first. Answer only from status, whether subtable `processLines` has rows, and `availableOperations`:

- Pending review and operations already scheduled: if the user explicitly asks, `bill_preview` `approveScheduled`.
- Waiting to release and `processLines` is empty: that is `launchAll` (schedule operations). If the user explicitly asks, `bill_preview` the current action. Do not rename it to pass the gate. One release must cover the task's full planned quantity. At release, also fix a complete valid routing and a team for each operation. Equipment and molds follow the action contract. Planned start and end come from the production task. Do not ask the user for a second pair of times.

## Stop

- After this plan hits, do not start with `modules_search`, `ops_search`, or a preventive `module_describe`.
- A planned call rejected by schema or contract allows one targeted `module_describe`. Do not retry the same arguments.

## Where a write starts (bottom buttons)

"Pending review", "waiting to release", "waiting to dispatch", and "not reported today" are each already one `bill_list` on the agent's resident route table.
**Do not query them again because this skill loaded.** The table below only fixes which module a write starts from:

| The user says | Start |
|---|---|
| Create a production order | `productionOrder`. Find the product first. If it is missing, ask. **Do not create a product record for the user** |
| Dispatch a production task | `productionTask.assign`. `processLineId` and `assignmentPieceRate` are required. For named people, pass `assignmentDraftLines` (one row per person: `workerId` and `assignedQty`). Each person gets one dispatch. To use the default team, omit that parameter. The system creates one team dispatch for the operation's undispatched remainder. There is no `reassign` or `allocationMethod` |
| Receive a completed order into stock | `productionReceipt` (completion receipt). Receipt is against the production task. Approved qualified quantity during production can be received. The task does not have to wait for a "ready to receive" status |

## Shortage versus quantity still to issue

When the user asks which tasks are short of material, or which are not kitted, call `erp brief {scenario:"material_shortage"}` first.
That definition subtracts on-hand stock of **the same product and the same warehouse** from frozen pending issue on unfinished tasks (declared issue reservations already deducted).
`pendingIssueBaseQty > 0` only means quantity still to issue. It is not a shortage by itself. Completed and cancelled tasks are not demand.
The receipt is a gap summarized by product and warehouse. Do not invent a per-task stoppage cause. If the data was not fetched, say so. Do not say "there is no shortage".
