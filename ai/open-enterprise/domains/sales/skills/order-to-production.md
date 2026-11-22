---
name: order-to-production
description: Load when the user wants an approved sales order turned into production, wants to know whether that already happened, or wants to continue releasing production.
version: 1.1.6
triggerWords: [turn into production, notify the shop, prepare production, schedule production, make in house, we make this order, where does the production order come from]
---

# Sales order to production

## Fixed plan

1. Locate the unique order with `bill_list(module=salesOrder)`, then `bill_get` for status, this document's lines, and the actions available now.
   Cross-document line filters use `analysis_sql`.
2. Only a sales order in "awaitingShipment" has `to_production`. Before execute, look up live production orders:

```json
{"module":"productionOrder","query":{"where":{"kind":"group","join":"and","children":[{"kind":"cond","field":"salesOrderId","op":"eq","value":"<sales order id>"},{"kind":"cond","field":"status","op":"in","value":["pendingReview","awaitingRelease","releasing","inProduction","reported","finished"]}]}},"limit":2,"offset":0}
```

   If a live production order exists, return it. Do not convert a second time. A new conversion is allowed only after the original was cancelled.
3. When the user explicitly asks to convert, `bill_preview` the sales order's `to_production`, then execute if the preview passes. The action creates one production order per product (status "pendingReview", plant already chosen per line). The sales order leaves "awaitingShipment" and enters the fulfillment status "inProduction". It cannot ship during that period.
   The sales order returns to "awaitingShipment" only after every linked live production order is received as complete, or all of them are cancelled. The shop's eight statuses are on the related documents in the detail rail.
   Do not stamp "production progress" or "completed" on the sales order.

## Real boundaries of draft review, approval, and release

- Every line must name a production plant at conversion time. Only the plant level may be chosen. A "pendingReview" document also needs a BOM that belongs to that product on each line. Do not guess the version.
- Planned start and planned end are not production-order header fields. Together with this release quantity, BOM, routing, and issue warehouse, they are per-line parameters of `release` (the production schedule). The completion warehouse is optional.
- A make-in-house schedule that includes `processLines` (the second screen assigns team, equipment, mold, and start or end from the routing) creates `materialRequirement` and `productionTask` in the same transaction. Operations are written on the task subtable.
  Without `processLines`, only the material requirement and the production task exist. Do not report that operations were generated.
  Assignment onto a person is `productionTask.assign`, one dispatch per person. It is not another pass through the task page's `launch*`.

On submit, approve, or release, confirm the current action from `bill_get.availableOperations`, then preview and execute only the step the user asked for.
To add quantity, `release` the existing production order again ("awaitingRelease", "releasing", and "inProduction" are the same action).
Do not run sales-order conversion again.

## Stop

- After this plan hits, do not call `modules_search` or read metadata preventively.
- If a planned call is rejected by schema or contract, one targeted `module_describe` is allowed. Do not retry the same arguments under a synonym field.
