---
name: procurement-query-plans
description: Purchase plans pending my review, suppliers, plans not yet turned into orders, shortages, and purchase suggestions.
version: 2.0.1
triggerWords: [purchase plans pending my review, all suppliers, purchase plans not yet orders, material shortage, kit complete]
---

# Narrow purchase queries

"Not finished", "arriving soon", and "already overdue" already live on the agent's resident route table, each as one `bill_list`.
**Do not query them again because this skill loaded.** Use `purchase-overdue-triage` only to separate "the supplier has not shipped" from "the goods arrived and nobody confirmed".

## Where a write starts (bottom buttons)

| The user says | Start |
|---|---|
| Create a purchase plan | `purchasePlan` |
| Create a purchase order | `purchaseOrder`. Find the supplier and the product. If either is missing, ask. Do not create master records for the user |
| Create a purchase receipt | `purchaseReceipt`. Confirming receipt is `stock in` (pending review, then received) |
| Return a purchase order | `purchaseReturn`. Confirm the goods were received. What was never received cannot be returned |

Overdue purchase orders that are not fully received use `purchase-overdue-triage`.
Do not load this skill for those dedicated questions.

There is no supplier quotation in this system: no quote document and no price comparison. If the user asks for a quote, a comparison, or "which supplier is cheaper", say the system does not have that function. Do not answer with historical purchase prices as if they were quotes.

## Shortage and purchase suggestions for released production orders

**First decide whether the question is plant-wide.** "Which materials are short" or "what should we buy in the next few days", with **no named document**, is already executed by the server. One `quick_ask` returns the figures (`material_shortage` or `purchase_requirement`).
The definition matches the steps below verbatim. **Do not rebuild it.** That is slower, and the definition gets reinvented each time.

The steps below are **only for a production order the user named**. The server scenario does not take an order id, so the query has to be narrowed.

This is a fixed orchestration of the general meta-tools. It does not depend on a dedicated tool. If the user gives only a production-order number, resolve the unique id first:

```json
{"module":"productionOrder","query":{"search":"<number>"},"limit":2,"offset":0}
```

- Find production tasks created by release with `bill_list(productionTask)`, and continue on `nextOffset` for the range you need.
  Filter `materialLines` with `analysis_sql`. Net demand is `pendingIssueBaseQty`.
  Sum by `componentProductId` and `defaultIssueWarehouseId`. If there is no task, the only answer is "not released, so kit completeness cannot be judged".

```json
{"module":"productionTask","query":{"where":{"kind":"cond","field":"productionOrderId","op":"eq","value":"<production order id>"}},"limit":100,"offset":0}
```

- On-hand stock in warehouses **visible to the current identity**, with `ledger_query`:

```json
{"target":"stock","mode":"aggregate","groupBy":["subjectId","scopeId"],"measures":[{"key":"net","fn":"net"}],"limit":100,"offset":0}
```

  Do not set `acrossScopes=true`. Subtract on the same product-plus-warehouse coordinate. Continue only when `nextOffset` is non-null and a needed coordinate is not covered yet.
- Open purchase candidates with `bill_list(purchaseOrder)`, continuing on `nextOffset`. Sum `baseQty` with `analysis_sql` by order `warehouseId` and line `productId`.
  An incomplete fetch cannot be reported as a complete gap.
  The order line already has `receivedBaseQty` (receipt confirmed). In transit per line is `baseQty - receivedBaseQty`. Do not treat a pending-review receipt as received.
  "receiving" only means a receipt was pushed.

```json
{"module":"purchaseOrder","query":{"where":{"kind":"cond","field":"status","op":"in","value":["awaitingReceipt","receiving"]}},"limit":100,"offset":0}
```

- For each product and warehouse: `gap = max(0, net demand - visible on-hand - visible in transit)`. The answer must say "computed within the current identity's visible scope".
  Do not present a partial scope as a company-wide kit result.
- A purchase suggestion answers only **what to buy and how much** (`max(gap, minimum order quantity)`). It does not answer who to buy from or at what price.
  There is no supplier quotation and no price fact to cite.

An unreleased order has no frozen material demand. The only answer is that it cannot be judged. A shortage or suggestion assembled by the model from several tool results has no single source evidence.
Do not borrow one query's trace id for an evidence card. Use a short paragraph or a Markdown table. A purchase suggestion is read-only. It is not a created or confirmed purchase.

## Purchase plans pending my review

"Pending my review" is a todo for the current identity, not a tenant-wide status list. One call:

```json
{"module":"purchasePlan","kind":"todo","limit":100,"offset":0}
```

Those are `inbox_list` arguments. An empty result means this identity has no such todo. It does not mean the system has no purchase plan pending review.
The `inbox_list` **receipt includes `open-bill-table`** (`total=0` is that card's empty state). The host renders it.
Do not emit another ```open-agent-ui fence of the same name, and do not copy `total` or `rows`. That is a second copy of the same page, and copying is where `module` gets dropped and `total` becomes the page length.
Do not use `open-staged-queue` here. That card is only for drafts from `bill_propose`.

## All suppliers

`bill_list` on `supplier` directly. Do not `modules_search` first. The first page:

```json
{"module":"supplier","limit":100,"offset":0}
```

When the user says "all", continue on `nextOffset` until it is null. If the fetch is incomplete, say only the part returned so far.

## Purchase plans not fully turned into orders

Query plans in status "approved":

```json
{"module":"purchasePlan","query":{"where":{"kind":"cond","field":"status","op":"eq","value":"approved"}},"limit":100,"offset":0}
```

Then compare `orderedBaseQty < baseQty` on the same line. Only a smaller ordered quantity means that line still has quantity not converted. Do not add quantities of different products.
Do not replace the line cumulative with the header status. The list only gives document handles. Continue on `nextOffset`. Unconverted quantity at line level uses `analysis_sql`.
If the fetch is incomplete, say "the part returned so far".

## Stop

- After this plan hits, do not start with `modules_search`, `ops_search`, or `module_describe`.
- Every `bill_list` continues only on the returned `nextOffset`. The next call keeps the other arguments and replaces `offset`. Do not reread an old page. Do not guess paging from `total > rows.length`.
- A planned read rejected for a schema or contract error allows one targeted `module_describe`. If that fails, stop.
- A miss must distinguish "nothing returned in this identity's scope" from "the business fact does not exist". Do not switch tools to get around authorization.

## Purchase orders that are not finished

Keep the shortcut's definition. "Not finished" means approved orders in `awaitingReceipt` or `receiving`. It does not include pending review, completed, or cancelled.
Widen to pending review only when the user explicitly asks to include it, and say that the scope changed. If the user says "everything still open, including drafts" without naming statuses, confirm the scope. Do not substitute your own status reading for the shortcut's definition.
