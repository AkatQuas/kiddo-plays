---
name: warehouse-query-plans
description: Warehouse work queue and receipt or issue jobs.
version: 1.0.1
triggerWords: [warehouse queue, query stock, create a stock-in, create a stock-out, add a product]
---

# Warehouse

## Four shortcut questions already live on the resident route table

"Arrived but not received", "issue orders pending review", "issue orders not yet issued", and "production tasks ready to receive" are each **one `bill_list`**.
Arguments are on the agent's resident table. **Do not query them again because this skill loaded.**
This skill is for the definitions below, or for a write.

## Receipt and issue facts land on the business document

Sales issue, purchase receipt, production issue and return, completion receipt, and subcontract movements post when that document is confirmed.
A transfer between warehouses is posted by the source document itself (for example a subcontract issue).

`stockIn` and `stockOut` are only manual facts with no business source: inventory gain, inventory loss, scrap, sample loan or return, and other movements.
Their statuses are `pendingReview`, `reviewed`, and `voided`. Create starts at pending review. Stock is recorded on approve. Void reverses it.

"Purchase material arrived but not received" is `purchaseReceipt` in pending review. Confirming the receipt posts stock directly.

## Two questions about material-issue orders

An issue order still in pending review has not created a stock fact. Confirming the issue reduces stock immediately. In the current model, "not yet approved" and "not yet issued" both query issue orders that are not confirmed.

## Why "ready to receive" looks at the production task, not the completion receipt

Receipt is against the production task. There is no task status called "awaitingInbound".
A task in production or completed, whose approved qualified quantity across operations exceeds quantity already received, can complete into stock.
Receivable quantity is min(approved qualified quantity of each operation) minus quantity already received. A pending-review receipt also reserves that quantity.

Confirming a completion receipt posts stock. There is no extra warehouse job waiting after that.

## Where a write starts (bottom buttons)

Only the starting module and order are fixed here. Entry and preview still follow each tool's effect and confirm contract:

| The user says | Start |
|---|---|
| Check stock | The home button already ran `stock_onhand` through `quick_ask`. The receipt includes `open-bill-table`. If the identity cannot view the modules stock query needs, say so. **Do not fake stock by summing documents**, and do not use a generic `table` |
| Create a stock-in | `stockIn`, only for inventory gain, sample return, or other stock-in with no source |
| Create a stock-out | `stockOut`, only for inventory loss, scrap, sample loan, or other stock-out with no source |
| Add a product | `product`. Unit, spec, and selling price cannot be invented. If they are missing, ask. Do not fill defaults |

## Stop

- A stock answer's receipt **already includes `open-bill-table`**. The host renders it. Do not emit another ```open-agent-ui fence of the same name, and do not rewrite the rows as a Markdown table. If you must compose a card, use only `open-bill-table`, not a generic `table`.
- After the plan hits, do not start with `modules_search`, `ops_search`, or `module_describe`.
- A planned read rejected for a schema or contract error allows one targeted `module_describe`. If that fails, stop and name the gap.
- Say the result is partial only when `nextOffset` is non-null. A miss must distinguish "nothing in this identity's data scope" from "the business fact does not exist".

## Stock totals

A non-zero stock coordinate is a product-by-warehouse balance after ledger posts and reversals, where the balance is not zero. It is not a count of ledger lines, and it is not a count of distinct products. The `stock_onhand` table may show only the first 8 rows. The total is `table.total`. The number shown is `table.rows.length`. Do not claim there are 8 stock items because 8 rows were shown. A by-warehouse count uses the same non-zero coordinates.
