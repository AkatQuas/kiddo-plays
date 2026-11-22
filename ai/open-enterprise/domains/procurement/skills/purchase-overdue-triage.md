---
name: purchase-overdue-triage
description: Purchase orders that are late and not fully received, short receipts, and where receipt execution is stuck.
version: 1.1.3
triggerWords: [purchase overdue, should have arrived, not fully received, chase the supplier, late arrival, short receipt, purchase progress]
---

# Which purchase orders are late and not fully received

The overdue test is on the purchase-order line: `planArrivalDate < today` and `receivedBaseQty < baseQty`. A list only locates documents.
It has no lines, so shortfall cannot be computed from `bill_list` rows.

## 1. Orders that may still be short

```json
{"module":"purchaseOrder","query":{"where":{"kind":"cond","field":"status","op":"in","value":["awaitingReceipt","receiving"]}},"limit":100,"offset":0}
```

Continue only on the returned `nextOffset`. Header plus this document's lines use `bill_get` (at most 20 lines). The shortfall line set uses `analysis_sql`
for `planArrivalDate < today` and `receivedBaseQty < baseQty`.
For each line, give the product, `baseQty - receivedBaseQty`, the primary unit, and `planArrivalDate`.
Primary-unit quantities of different products must not be summed into one order quantity.

## 2. Where receipt execution stands

For each hit, query related receipts:

```json
{"module":"purchaseReceipt","query":{"where":{"kind":"cond","field":"lines.orderId","op":"eq","value":"<purchase order id>"}},"limit":100,"offset":0}
```

Continue on `nextOffset` the same way. `bill_get` a receipt for header plus this document's lines. Cross-document matching uses `analysis_sql`
on `lines.orderLineId`.
Status means only the current fact:

- No receipt: the order has not pushed a receipt yet.
- `pendingReview`: the receipt exists and is not confirmed.
- `received`: receipt is confirmed into stock, and the quantity is on the order line's `receivedBaseQty`.
- `cancelled`: it does not hold a quantity still to receive.

Do not treat a pending-review receipt as received into stock.
Do not invent "last action", "cancellation in progress", or whether the supplier has shipped. The general read tools do not have those audit or logistics facts.

## 3. An executable conclusion

- **How much is short**: only the order line's `baseQty - receivedBaseQty`.
- **How late**: the line's `planArrivalDate`, not the header purchase date.
- **Where it is stuck**: only the verified statuses above. Do not write a guess as a fact.
- When the business confirms the remainder will not be received, `finish` or `close` may be available only while the order is `receiving`. Whether it can run is that order's `availableOperations`.

`ledger_query` has no planned arrival date, so it cannot answer overdue. Open purchase commitment on the supplier record is the order's total exposure.
It does not subtract quantity already received, so it is not the shortfall amount. `purchaseOrder.totalAmount` includes quantity already received. It is not the shortfall amount either.
No tool returns a server-computed shortfall amount, so do not label the order total, a model sum of lines, or their combination as "shortfall amount" or "overdue unreceived amount".
If the user explicitly asks for an amount, say that definition is missing, and still give the verified shortfall quantity per line.

A full list or an overall conclusion requires every order page and every order's receipt pages to reach `nextOffset=null`. Otherwise say the answer covers only the part already fetched.
After this plan hits, do not call `module_describe` preventively.
