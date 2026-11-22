---
name: order-intake
description: One-sentence order entry. The order is find or create the customer, find the product, then create the sales order, with JSON that can be copied.
version: 1.4.0
triggerWords: [place an order, create an order, open a sales order, new sales order, create a sales order, a new customer ordering, customer not found, create an order from one sentence]
---

# Create one sales order from one sentence

This turn has two paths. **Do not mix them:**

1. **No attachment** (the user says "record a sales order" or taps the "new sales order" shortcut): **emit `open-form` (`module=salesOrder`) first**. Do not `submit_plan`. Do not start by asking for customer, product, and quantity. The form is the entry point. Empty cells are filled on the card.
2. **This turn has an attachment** (`[File ready]` on the user message, or they say "create from this contract or spreadsheet" with a file): **do not emit an empty form**. Read that body for customer, product, quantity, price, and promise date. Then `bill_list` against existing records in the order below. If a match fails, stop and ask. Then `bill_create`. **Do not create a pile of new master records from the sheet's raw text.**

If the user wants to upload but has no table yet, use `open-ask` with two options: "fill the form" and "paste the table into chat (or upload xlsx/csv)". Do not wait in silence.

## More than a couple of rows: ask the scope, then end this turn

This overrides "read, then match" in path 2. Take this branch if **any** of these is true. Do not weigh them:

- More than 5 extracted rows.
- A status column with more than one value ("completed", "cancelled", "shipped", "awaitingProduction" mixed together).
- The same material must land on more than one document.

Ask only about scope. "Of these 50 rows, 11 are awaitingProduction and the rest are completed, cancelled, or shipped. Create only the 11, or all 50?"

### How to ask

Emit one `open-ask` card in the body (`mode` is clarify). Each option has a complete, self-contained `send`.

| Cell | What to put | Example |
|---|---|---|
| component | `open-ask` | — |
| props.mode | `clarify` | — |
| props.question | One sentence that states the choice | This sheet has 51 rows. Statuses include awaitingProduction, inProduction, completed, and cancelled. Which should be created? |
| props.options[].label | The button text, with the **concrete value** | Only the 11 in awaitingProduction |
| props.options[].send | The **full sentence** sent as the user's next message | Create sales orders only for rows whose status is "awaitingProduction" |

**After the card, stop. Send no more tool calls this turn.** The turn ends because you stop calling tools.
This agent has no `ask_user` and no `function_call`. Sending those returns `unknown_tool`, and the user never sees a question.
If you need one more sentence, say "I'll continue after you choose."

Do not write "I need to confirm the scope with the user" and then keep going.
If you are going to ask, emit the card and stop. If you are not going to ask, finish under one definition and say which definition you used.
The worst case is saying you will ask and not asking. That collapses into the same `bill_list` a dozen times, then a repeat.

Ask one question, then stop. After the reply, continue **inside the scope of that reply**. Do not ask a second time.

This chain is **not atomic**. The customer record, the product record, and the order are three separate writes. A failure in the middle leaves the earlier writes.
The order cannot be reversed. Foreign keys must resolve to ids before the next document can be written.
The only reason to "look up first" is to get an id. It is **not** "check for duplicates". Duplicates are rejected by the write. Reading the list neither detects them nor avoids a round trip per row.

## Order (reversing it leaves junk records)

1. **Find the customer. Do not create first.** `bill_list(module=customer, query={search:<name or short name>}, limit=10, offset=0)`.
   - Found: keep the id and go to step 3.
   - Not found: **try one other keyword**. A full name miss should try the short name or the contact. `name`, `shortName`, and `contact` are searchable. People usually say the short name.
   - Two misses: step 2.

   This step gets `customerId`. It is not a duplicate scan. Without the id, `bill_create(salesOrder)` cannot succeed, so the lookup is required, and it is **only** that. Once the id is found, continue. Do not search again "to be sure it is unique", and do not pull the whole customer table.

   The full `name` is unique inside the tenant. The write side rejects a duplicate. It is not your job to scan first. Use an existing customer's id. Create only when the lookup misses. A name collision is rejected on write. Do not search a second time "to confirm there is no duplicate".

2. **Create the customer:** `bill_create(module=customer, header={ name })`.
   - Do not fill `code`. The platform assigns it (`KH-0001`).
   - Contact, phone, and the four invoice fields: fill them only when the material has them. **Do not invent them.** A wrong invoice block is printed on the invoice.

3. **Find the product:** `bill_list(module=product, query={search:<name or spec>, where:{kind:"group", join:"and", children:[{kind:"cond", field:"canSell", op:"eq", value:true},{kind:"cond", field:"status", op:"eq", value:"active"}]}}, limit=10, offset=0)`.

   That `where` is the same filter as the sales-order line `productId.refFilter` (sellable and active). Without it, a name hit can be a component or a casting, the create is rejected, and the list does not show "sellable". A batch `in` uses the same `where`.

   **Search by name first, not by the number on the material.** `product.code` is assigned by the platform (`SKU-20260701-0001`). A number on an external sheet, invoice, or contract **cannot** equal it. Looking it up that way always misses.

   The number is not useless. It may be on `barcode`, and `search` covers the barcode. So the order is **name first, number as fallback**. If the name misses, try the number once. That try is a barcode lookup.

   One `search` scans `code`, `name`, `spec`, and `barcode`. **Do not query different columns for the same product.** Change the **keyword**, not the column.

   **When the material has many products, ask for all of them once. Do not look them up one by one:**
   `bill_list(module=product, query={ where: { kind:"group", join:"and", children:[{kind:"cond", field:"name", op:"in", value:[name1, name2, …]},{kind:"cond", field:"canSell", op:"eq", value:true},{kind:"cond", field:"status", op:"eq", value:"active"}] } }, limit=50)`.
   `in` is exact equality. Hits come back together. **Misses** then use `search` one by one (fuzzy). One-by-one search costs N round trips, and N is the row count.

   - One keyword, several hits (specs of the same product): **ask the user**. Do not pick the first. Spec is what distinguishes a SKU. The wrong one makes price, quantity, and stock wrong on the whole order.
   - No hit at all: **ask. Do not create a product.** A new product needs unit, spec, and selling price. Those three cannot be invented, and they are frozen onto every later document (see "which cells are frozen").

4. **Create the order:** `bill_create(module=salesOrder, header={...}, lines={lines:[{...}]})`.

## Closing a batch: each row stands alone, and the reply is one summary

When the material has more than one row (scope already confirmed above), all three of these hold:

1. **Resolve foreign keys in one call, not one round trip per row.** Customers and products use the batch form in steps 1 and 3 (`op:"in"` for the whole name list; misses then `search` one by one). N `bill_list` calls for N rows is the expensive path.

2. **Write each row independently. One failure does not stop the others.** On a `bill_create` error, **record that row's error text** and continue. Do not stop, do not roll back rows that succeeded, and do not look them up again "to be safe". Whether a row can be written is decided on the write (required fields, value gates, whether the ref exists, key gates). A read-side preview cannot answer it. A preview is slow and inaccurate.

3. **The close is only a summary.** N succeeded, M failed. For each failure, write "row number + the error text". **Do not read the successful rows back.** The user already has the material. Restating it is pure output, and that is where a long material starts to repeat.

## Cells required at create time

| Cell | Now | Note |
|---|---|---|
| `customerId` | **Required** | The id from steps 1 and 2 |
| `orderDate` | **Required** | Today. Do not ask |
| `promiseDate` | Required before approval | May be empty at create. If the user did not say it, **ask**. Do not fill today. That is a promise this system cannot keep |
| `warehouseId` | Optional | The whole order chain may leave it empty. The issue document sets the real ship-from warehouse |
| Line `productId` / `qty` / `price` | **Required** | If `price` was not given, use the product's selling price |
| Line `discount` | Optional | A commercial term. If the user did not say it, omit it. **The number is "how many percent of list", not a fraction.** See below |

**Do not send any other cell.** These are an immediate HTTP 400 (key gate), not ignored fields:

- `code` (order number). The platform assigns it at save.
- Line `unit` may be omitted (defaults to the product's primary unit) or set to another unit of that product. `spec` is still contract content and needs the user's confirmation.
- `totalAmount`. It is the sum of same-currency line amounts, computed at save. Quantities of different products are not totaled on the header.
- Line `unitFactor`, `baseQty`, and `baseNetPrice` freeze at save. `netPrice`, `amount`, and `discountAmount` are declared calculations. Fulfillment compares `shippedBaseQty / baseQty`. `shippedQty` is only the line's business-unit display.

## Discount is 85, not 0.85

When the user says "85% of list" or "15% off so they pay 85", `discount` is **85**. The cell means **percent of list collected**. `net unit price = price × discount / 100`. Ninety percent of list is 90. Seventy-five percent is 75. No discount is **left empty**. Free is 0.

- `0.85` means "collect 0.85 percent". A 1000 item collects 8.5, and every cell is still valid. Nothing turns red.
- `15` (read as "15 points off") means "collect 15 percent", the opposite of what the user said.

"Order discount 85" means every line is 85. The header has no discount cell. If the user named a discount on only some lines, fill only those lines.

## Which cells freeze (why you cannot "just copy one along")

At order time the business unit, conversion factor, and primary-unit quantity are saved. Later changes to the product record do not move this order.
An issue document inherits the order line's unit by default, and may switch to another unit of the same product. Cross-document settlement always compares primary-unit quantity.

So if the spec the user said does not match the product record, **do not edit the order line** (it cannot be edited that way). Confirm the product is the right one. If the product record is wrong, fix the product record first, then create the order.

## What a failure in the middle leaves behind

| Stopped after | Left behind | Clean it up? |
|---|---|---|
| Customer created, order failed | One customer record | **No.** Master data is meant to be reused on the next order |
| Order created, approval failed | One order in "pendingReview" | Fill the cell named in `checks`. Do not approve for the user |
| The order was entered wrong and must be withdrawn | An order in "pendingReview" | Pending review can be deleted (`bill_delete`), or `cancel` leaves an "cancelled" record. A document that has taken an edge cannot be deleted |

**Do not loosen a cell to make the call succeed.** A missing customer is created. A missing promise date is asked. A missing warehouse is stored as a pending-review order. Those three have an exit. An invented value makes the books wrong from that moment, and the document looks normal.

## A sales order has no draft and no submit-for-review

After `bill_create(module=salesOrder)` the document is "pendingReview". **Stop.** Do not look for a `submit` edge. There is none.
`approve` is a commercial commitment. It moves the document to "awaitingShipment". The warehouse picks from that, and the customer waits on that date.
That decision needs a person. It is not the last step of filling cells.

If approval does not pass, `bill_preview` and see which gate `checks` hit. Return that gate's **text** to the user. Do not wrap it in a generic explanation.
