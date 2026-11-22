---
name: order-delivery-assessment
description: Sales-order promise date, quantity still to ship, and delivery progress.
version: 1.1.4
triggerWords: [promise date, late, chase the order, shipping progress, deliver on time, how much is still unshipped, ship this, issue this from stock]
---

# Sales-order delivery and shipping

## Fixed read plan

1. Locate orders with `bill_list(module=salesOrder)` by number, customer, or promise date. Open orders are fixed as:

```json
{"module":"salesOrder","query":{"where":{"kind":"cond","field":"status","op":"in","value":["awaitingShipment","inProduction","shipping"]}},"limit":100,"offset":0}
```

   For a specific number, replace `query` with `{"search":"<number>"}`. A full list continues on `nextOffset`. Do not reload the skill or reread an old page.
2. `bill_get` each hit for the header, this document's lines, and available actions. The line gap is `openQty` on the line (ordered minus pending-review reservation minus issued).
   Do not use the ordered quantity as this shipment's quantity, and do not add quantities of different products. When `openQty` is 0,
   `ship`, `shipMore`, and `shipInProduction` are absent from the available actions.
3. Related sales deliveries, with this filter. Cross-document line filters use `analysis_sql`:

```json
{"module":"salesDelivery","query":{"where":{"kind":"cond","field":"lines.orderId","op":"eq","value":"<sales order id>"}},"limit":100,"offset":0}
```

4. Read status on the current public chain:
   - Sales delivery "pendingReview": generated from the sales order, stock not confirmed yet.
   - "shipped": confirm-issue has posted, and it counts in the order's `shippedBaseQty`.
   - "cancelled" is not pending review, and it does not block the sales order from finishing shipment.
5. Whether stock is enough is the sales delivery `confirm` preview. There is no separate warehouse job.

## When the user explicitly asks to execute

- A sales order in "awaitingShipment" (approved on screen) uses `ship`. "shipping" adds a batch with `shipMore`. "inProduction" uses `shipInProduction`.
  They only create a delivery in "pendingReview". `shipLines.qty` is this batch's quantity and defaults to that line's `openQty`.
  Success means "a pending-review delivery was created", not that stock has issued.
- A pending-review delivery uses `confirm` (confirm issue): stock is reduced and the receivable is formed immediately.
- If the remainder will not ship, the sales order uses `finish` or `finishShipping` (shipment complete). Any delivery still in "pendingReview" must be confirmed or cancelled first. Do not complete the order and then issue.
- When every line is fully shipped, confirm-issue closes the order automatically ("awaitingShipment", "shipping", and "inProduction" alike, ignoring production orders). A first batch that is short does not auto-close. "inProduction" has no public "shipment complete" button.

Each step confirms the current action from `bill_get.availableOperations`, then `bill_preview`. Execute only the step the user asked for and the preview allows.
Do not merge "created a pending-review delivery" and "confirmed issue" into one success.

## How to answer

- Say which line is still short, then whether it is stuck in pending-review issue or already issued.
- A ledger balance is explained for one product and one warehouse. If the order has no warehouse, use the warehouse on the delivery requirement. If that is also missing, ask the user to confirm the warehouse.
- When the customer will take less and the rest will not ship, use the sales order's "Complete". Handle pending-review deliveries first, then complete. A completed order cannot confirm issue again.
- A planned call rejected by schema or contract allows one targeted `module_describe`. Do not retry the same arguments.
