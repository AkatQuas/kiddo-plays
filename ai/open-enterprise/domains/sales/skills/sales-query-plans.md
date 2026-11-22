---
name: sales-query-plans
description: Sales orders, customer sales totals, and collections.
version: 1.3.3
triggerWords: [new sales order, sales delivery, sales issue, sales orders pending review, a customer's orders, a customer's collections, query sales orders, sort sales orders by amount, sales by customer, sales ranking, customer sales ranking]
---

# Narrow sales queries

`insight_brief` still answers "how are sales this month" (`sales_month`).
Sales totals or rankings **by customer** are not an insight, and they are not mental math on `bill_list`.

## Sales totals or rankings by customer

When the user asks for sales by customer, a sales ranking, or who ordered the most, call `analysis_sql` once.
Definition: order amount is header `total_amount` (not a derived line amount). Returns need not be subtracted. A status or time window may be added.
The name must be the declared customer name. Customers with zero sales are excluded. No `LEFT JOIN`. Do not write the derived column `customerName`. Do not rank by adding `rows` across pages.

```json
{"sql":"SELECT c.name AS customer_name, SUM(h.total_amount) AS sales FROM oe_sales_order h INNER JOIN oe_customer c ON h.customer_id = c.id GROUP BY c.id, c.name ORDER BY sales DESC LIMIT 20"}
```

Names come only from `oe_customer.name`. A time window uses `h.order_date` or `date_trunc`. Status uses `h.status`.
Do not `bill_list` and then add. Do not `bill_get` to translate a name.

## Sales-order amount

The sales-order amount field is `totalAmount`. After this skill loads, the next call is the single `bill_list` below that matches the user's conditions.
Do not call `module_describe` until that call is rejected by schema or contract.

No date filter, amount descending:

```json
{"module":"salesOrder","query":{"sort":[{"field":"totalAmount","desc":true}]},"limit":100,"offset":0,"aggregates":[{"field":"totalAmount","fn":"sum"}]}
```

The user gave a date, lines only:

```json
{"module":"salesOrder","query":{"where":{"kind":"cond","field":"orderDate","op":"between","value":["<start date>","<end date>"]},"sort":[{"field":"orderDate","desc":true}]},"limit":100,"offset":0,"aggregates":[{"field":"totalAmount","fn":"sum"}]}
```

The user gave a date and asked for amount descending:

```json
{"module":"salesOrder","query":{"where":{"kind":"cond","field":"orderDate","op":"between","value":["<start date>","<end date>"]},"sort":[{"field":"totalAmount","desc":true}]},"limit":100,"offset":0,"aggregates":[{"field":"totalAmount","fn":"sum"}]}
```

Add a `where` only when the user explicitly gave a date, status, or customer. Do not invent "this month" or ask for a range the user did not request.
On one paging chain, `query`, `limit`, and `aggregates` stay verbatim. Change only `offset`.

### What a line list and a sort may answer

Output only these two facts, then stop:

1. Orders, one row at a time, in the tool's order.
2. `total` documents, and the amount in `aggregates["totalAmount:sum"]`.

Do not derive a status breakdown, status amounts, a ranking of customers, salespeople, or warehouses, min or max amounts, promise-date analysis, or any other sentence from `rows`, even after every page is fetched.
If the user then asks for one of those, compute it in the database with `analysis_sql` on that dimension. Without an analysis result, do not output it. Do not add page amounts in the model.

## Sales orders pending review

A sales order has no draft and no submit-for-review edge. Create starts at pending review.

```json
{"module":"salesOrder","query":{"where":{"kind":"cond","field":"status","op":"eq","value":"pendingReview"}},"limit":100,"offset":0}
```

The count is `total`. If the user wants every line and `nextOffset` is non-null, continue the same query.

## One customer's orders

1. Find the customer with `bill_list(module=customer)` and `search`. Zero rows: say so. Several rows: let the user pick by business name. Use the id only on a unique hit.
2. Orders for that customer:

```json
{"module":"salesOrder","query":{"where":{"kind":"cond","field":"customerId","op":"eq","value":"<customer id>"}},"limit":100,"offset":0,"aggregates":[{"field":"totalAmount","fn":"sum"}]}
```

The order total cites only `aggregates["totalAmount:sum"]`. Order amount is not receivables and not collections.

## Stop

- After this plan hits, do not start with `modules_search`, `ops_search`, or `module_describe`.
- One targeted `module_describe` is allowed only when a planned call is rejected by schema or contract. If that fails, stop.
- A full list continues on `nextOffset`. Do not reload the skill, reread an old offset, or shrink `limit` and refetch a page that already succeeded.

## Where a write starts (bottom buttons)

"Created today", "pending approval", and "promise date soon" are each already one `bill_list` on the agent's resident route table.
"How are sales this month" is `insight_brief` scenario `sales_month`. **Do not query any of those again in this skill.**

| The user says | Start |
|---|---|
| Create a sales order | `order-intake`. That chain looks up before it creates. Do not start a second chain here |
| Look up sales orders | `bill_list` on `salesOrder`. If the user gave no filter, ask which set (pending review, ready to ship, or one customer). Do not pull the full list by default |
| Ship this | Sales order `ship`, `shipMore`, or `shipInProduction`, which creates a delivery in "pendingReview". Confirm the order is `awaitingShipment` (approved on screen), `shipping`, or `inProduction` |
| Issue from stock | List sales deliveries in "pendingReview" (`where` status = `pendingReview`) and run `confirm`. A completed order cannot confirm issue again |

## "Released" and not-finished sales deliveries

"Which sales deliveries are already released" keeps the existing shortcut's definition. Do not change its meaning.
If the user also asks for "released and not finished", do not treat `pendingReview` as already released. A delivery has only pending review, issued, and cancelled.
There is no separate "released but not issued" status. State that boundary and ask whether they want "pending review, not yet issued" or "issue confirmed".
Do not widen or narrow the status set yourself, do not claim an unissued document is released, and do not treat cancelled as still to be fulfilled.
