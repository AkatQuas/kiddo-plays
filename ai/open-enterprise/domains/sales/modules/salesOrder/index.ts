import {
  defineModule,
  definePlanners,
  normalizeField,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlannerContext,
  requireText,
} from "@open-erp/metamodel";

const shipLineField = normalizeField(
  {
    key: "shipLines",
    label: "This shipment",
    type: "subtable",
    ref: "salesOrderShipDraftLine",
    required: false,
    fields: [
      { key: "orderLineId", label: "Order line", type: "string", required: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qtyOrdered", label: "Ordered", type: "number", required: true },
      { key: "releasedQty", label: "Released", type: "number", required: true },
      { key: "openQty", label: "Open qty", type: "number", required: true },
      { key: "qty", label: "This time", type: "number", required: true },
    ],
  },
  "salesOrder.ship.params.shipLines",
);

/** Production-order statuses that still hold a release slot. Cancelled is not in the list, so a withdrawn order can be released again. The sales order does not care about shop-floor reporting. "reported" is a leftover and still holds a slot. */
const LIVE_PRODUCTION_STATUSES = ["pendingReview", "awaitingRelease", "releasing", "inProduction", "reported", "finished"] as const;

const shipLinesParam = {
  key: "shipLines",
  label: "This shipment",
  type: "billLines" as const,
  required: false,
  lineField: shipLineField,
  fixedRows: true,
  readOnlyColumns: ["productId", "qtyOrdered", "releasedQty", "openQty"],
  hiddenColumns: ["orderLineId"],
  seed: {
    from: "lines",
    columns: {
      orderLineId: "id",
      productId: "productId",
      qtyOrdered: "qty",
      releasedQty: "occupyingQty",
      openQty: "openQty",
      qty: "openQty",
    },
    skipNonPositive: "openQty",
  },
};

/**
 * 3.5.x action params for a partial release to production. Same shape as the shipment
 * params (`shipLinesParam`). The remaining quantity is "releasable to production".
 *
 * The pairing column must be named `salesOrderLineId`. Push pairs on the refLine column
 * on the target lines that points back at this module (`productionOrder.lines.salesOrderLineId`).
 * Naming it `orderLineId` here matches nothing, and the user sees "no matching line on the pushed document".
 */
const toProductionLineField = normalizeField(
  {
    key: "productionLines",
    label: "This production release",
    type: "subtable",
    ref: "salesOrderProductionDraftLine",
    required: false,
    help: "Each product becomes its own production order. The default BOM and routing come from the product record and cannot be changed here. Delete lines you are not releasing this time. Lines come from this order and cannot be added by hand.",
    fields: [
      { key: "salesOrderLineId", label: "Order line", type: "string", required: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qtyOrdered", label: "Ordered", type: "number", required: true },
      { key: "producingQty", label: "Released to production", type: "number", required: true },
      { key: "openProductionQty", label: "Releasable", type: "number", required: true },
      { key: "qty", label: "Release this time", type: "number", required: true },
      {
        key: "productionOrgId",
        label: "Plant",
        type: "ref",
        ref: "orgUnit",
        required: true,
        refFilter: { orgType: "factory" },
      },
      {
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        required: true,
        refFilter: { productId: { from: "$line.productId" }, status: "active" },
        refPreselectSole: true,
        help: "The product's current active BOM. It cannot be changed when releasing to production",
      },
      {
        key: "routingId",
        label: "Routing",
        type: "ref",
        ref: "routing",
        required: true,
        refFilter: { productId: { from: "$line.productId" }, status: "active" },
        refPreselectSole: true,
        help: "The product's current active routing. It cannot be changed when releasing to production",
      },
    ],
  },
  "salesOrder.to_production.params.productionLines",
);

/**
 * A sales delivery starts at "pendingReview". The complete and reject gates filter on that stored value.
 *
 * Use `invariant_related_agg`, not `related_agg`. This is a cross-document invariant, so a pending-review
 * issue created by someone else must still be visible. Ordinary related_agg uses the current actor's data
 * scope, and a self scope treats a colleague's pending-review document as absent. The invariant primitive
 * does not accept count. Existence is "sum of pending-review line baseQty is 0".
 */
const pendingReviewDeliveryAgg = {
  primitive: "invariant_related_agg" as const,
  from: "salesDelivery",
  through: "lines",
  match: "orderId",
  on: "id",
  agg: "sum" as const,
  measure: "baseQty",
  where: { status: "pendingReview" },
  plus: null,
};

const shippedDeliveryAgg = {
  primitive: "invariant_related_agg" as const,
  from: "salesDelivery",
  through: "lines",
  match: "orderId",
  on: "id",
  agg: "sum" as const,
  measure: "baseQty",
  where: { status: "shipped" },
  plus: null,
};

/** A pending-review delivery blocks complete and reject. */
const noPendingReviewDelivery = (transition: string, message: string, why: string) => ({
  id: `no_pending_review_delivery_on_${transition}`,
  onTransition: transition,
  source: "invariant" as const,
  level: "block" as const,
  message,
  why,
  check: {
    ...pendingReviewDeliveryAgg,
    op: "eq" as const,
    right: { value: 0 },
  },
});

/** Issued stock that has not been reversed blocks reject. */
const noShippedDeliveryOnUnapprove = {
  id: "no_shipped_delivery_on_unapprove",
  onTransition: "unapprove",
  source: "invariant" as const,
  level: "block" as const,
  message: "This order already has issued deliveries. Reverse those issue documents before rejecting.",
  why: "Issued deliveries are posted (stock and receivables). Rejecting returns the order to pending review and would leave the books ahead of the document, so the issue facts must be reversed first",
  check: {
    ...shippedDeliveryAgg,
    op: "eq" as const,
    right: { value: 0 },
  },
};

const toProductionLinesParam = {
  key: "productionLines",
  label: "This production release",
  type: "billLines" as const,
  required: false,
  lineField: toProductionLineField,
  // Rows are seeded from this order's releasable lines. Do not add products by hand (a blank row matches no order line).
  // Deleting a row is allowed: drop a product you are not releasing this time (no default BOM or routing yet) and leave the remainder on this order.
  fixedRows: false,
  readOnlyColumns: ["productId", "qtyOrdered", "producingQty", "openProductionQty", "bomId", "routingId"],
  hiddenColumns: ["salesOrderLineId"],
  // The plant is chosen on the row and is not a read-only column. Seed does not prefill it. Which plant gets this release is decided now. Guessing one would look like a fact.
  seed: {
    from: "lines",
    columns: {
      salesOrderLineId: "id",
      productId: "productId",
      qtyOrdered: "qty",
      producingQty: "producingQty",
      openProductionQty: "openProductionQty",
      // Default is to release the rest, matching the old whole-order release. Reduce the quantity to release less.
      qty: "openProductionQty",
    },
    // A line that is fully released (or fully reserved by shipment) does not enter the dialog.
    // A zero row for the user to delete is worse than leaving it off "what to do this time".
    skipNonPositive: "openProductionQty",
  },
};

/**
 * Sales order — the document shape.
 *
 * Covers: a full state machine / lines / cross-module derivation (quantity issued) / push to downstream documents /
 * preconditions from three sources / three kinds of handoff.
 *
 * ── This document does not post ─────────────────────────────────────────
 * Zero `effects` is a decision, not an omission. An order is a promise, not a fact that has happened.
 * The real books are written on fulfillment: the sales delivery confirms `ar in` (receivable)
 * and per-line `stock out` (inventory).
 *
 * So every edge in this module (including `unapprove` / `finish` / `close`) has `postsToLedger` false,
 * and the confirm dialog is not earned by posting. Edges into a terminal state, and edges that send the
 * document back, must set `confirm: true` themselves. That is what `confirm` means: ask even though nothing posts.
 */
export default defineModule({
  label: "Sales order",
  // Custom fields are open to the tenant: this table gets a `custom jsonb` column and a GIN index.
  // The chain product → sales order → production order → production task → dispatch / delivery
  // is where industry-specific fields most often need to travel, so it is opened first. To open another table, add the same line and ship.
  customFields: true,
  // The sequence is continuous only within a day, so the code carries a date segment (XS-20260729-0001). seqScope is required and has no default
  numbering: { prefix: "XS", seqScope: "day" },

  fields: [
    // auto: the platform assigns the number on create. A person must not type it. Do not set required — a system value has no user entry.
    //
    // `help` is not decoration. On a new form this cell is an empty `SystemValue` dashed box,
    // and a blank is read as "this cell is broken". The reference product shows the number when the dialog opens
    // via `/order/preview-no`. Do not copy that: a preview can disagree with the stored number (it scans the max
    // plus a name lock). The number here is taken in `assignAutoNumbers` and exists only at save, which is the better rule.
    // What is missing is saying so.
    { key: "code", label: "Order no.", type: "string", primary: true, auto: true, help: "Assigned on save, for example XS-20260803-0001" },
    // Same criterion as the approve edge `customer_active`, at two moments, and both are required. The filter governs entry
    // (the dropdown has no disabled customer; the candidate surface and the write surface share one condition, so an API call with a disabled customer id is also rejected).
    // The gate governs approval (a customer disabled while the draft sat still blocks). Do not add another gate on save or submit, and do not remove the approve edge.
    {
      key: "customerId",
      label: "Customer",
      type: "ref",
      ref: "customer",
      required: true,
      refFilter: { status: "active" },
    },
    {
      key: "orderDate",
      label: "Order date",
      type: "date",
      required: true,
      createDefault: "today",
      help: "Defaults to today in the deployment's business time zone, and can be changed",
    },
    // "Optional while pending review, required before approval" (see `approve_fields_required` below).
    // "Phoned in, promise date not set" is a real shape. `required` becomes a NOT NULL column, so that pending-review order cannot be stored.
    //
    // This cell used to stay `required` on purpose: it is the left operand of `promise_date_sane` (a `gte` order comparison),
    // an order comparison throws on empty (`orderable` in `primitives.ts`), and `evaluateTransition` did not isolate
    // one rule. One warn-level rule turned the whole approve edge into "evaluation throws" (no verdict, no checks, plan dropped).
    // That premise is gone. The kernel isolates each rule. A rule that cannot be computed is an `unevaluated` failure,
    // and the edge still returns a verdict. This cell was relaxed with that. An empty value hitting `promise_date_sane`
    // is a readable warn, not a 500.
    // Do not mark this cell `required`. Here "required" means required at save, including pending review (a NOT NULL column).
    // Its own help says the opposite: a phone order may leave it blank. "Required before approval" is `approve_fields_required`
    // on the approve edge, which is the layer it belongs on.
    // A paired test pins this relaxation against per-rule isolation. See
    // `test/modules.test.ts`, "after the promise date is no longer required, an empty value against promise_date_sane is a readable failure".
    { key: "promiseDate", label: "Promise date", type: "date", help: "A phone order may leave this blank. It must be filled before approval" },
    // The ship-from warehouse is genuinely optional: not `required`, and approval does not block on it.
    // At order time the warehouse is often unknown (it waits on warehouse scheduling). The reference product does not
    // set the warehouse on the order at all. It is chosen at shipment. A one-sentence AI order cannot name a warehouse, and approval must not deadlock on it.
    //
    // Optional only until Ship, not all the way down. On the issue document pushed by `ship`,
    // `salesDelivery.warehouseId` is `required`, and `buildPushDraft` copies this cell as-is. Empty cannot be copied,
    // so that issue document cannot be created. The schedule for this cell is three moments:
    // optional at save (not `required`) → optional at approval (`approve_fields_required` does not include it) →
    // required at ship (`ship_warehouse_required` below). The in-progress whitelist also releases it,
    // so a warehouse decided after scheduling can be filled in place. Drop either of the last two and the user sees
    // "no required marker, but a required constraint", with no way out.
    { key: "warehouseId", label: "Ship-from warehouse", type: "ref", ref: "warehouse", help: "May be left blank at order time and filled while in progress after the warehouse is scheduled. It must have a value before Ship" },
    {
      // Order source / sales channel: a list column, a filter, and a grouping dimension on sales reports.
      key: "orderSource",
      label: "Order source",
      type: "enum",
      choiceSet: "sales.orderSource",
    },
    {
      // `contract` (the attachment) does not replace this. The contract number is what customers quote and what reconciliation uses.
      // The attachment is evidence. Without the number, a customer who calls with a contract number finds nothing.
      key: "contractNo",
      label: "Contract no.",
      type: "string",
    },
    {
      // A role is not a person. `handoff.to = 'sales-representative'` answers "which role does this work",
      // not "who owns this document". The platform field `createdBy` is not the same either
      // (the person who keys the order is often back office, not the salesperson who follows it).
      // Commission, follow-up, and collection all hang on this cell. It references a system account, and the value is the platform userId.
      key: "salesperson",
      label: "Salesperson",
      type: "ref",
      ref: "subject",
      refFilter: { status: "active" },
      person: { role: "owner", via: "self" },
    },
    // Amounts add across products. Quantities do not. `10 kg + 5 pcs` has no business reading of "15",
    // so only amount totals live here. Quantity progress stays on each product line.
    // The total is line `amount`, which is itself that line's formula (quantity × price × discount).
    // Stacked, that is the most common ERP chain: line formula → header total
    {
      // Gross total (before discount). Paired with `totalAmount` (after discount) below.
      // Showing only one looks like "the header says 2470 and the line prices multiply to 2650". Both numbers are right, and nothing says where the gap is
      key: "grossTotalAmount",
      label: "Gross total",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(grossAmount)" },
    },
    { key: "totalAmount", label: "Net total", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
    {
      key: "lines",
      label: "Order lines",
      type: "subtable",
      ref: "salesOrderLine",
      // Line columns. Spec is contract content stored on the line. Unit is chosen from the product's primary and alternate candidates and the conversion fact is frozen.
      fields: [
        // Only finished goods and semi-finished goods can be sold. The value set looks like manufacturing's
        // (`bom.productId` and the rest) but it is not the same sentence. That side says "can this be made".
        // This side says "can this be sold to a customer". They coincide today. A future "resell a purchased part"
        // opens this site only. Do not change the BOM value set in the same edit, so each side writes its own and they do not share a constant.
        //
        // The criterion is not new. The inventory seed's classification says finished goods are what is sold to customers.
        // This line turns that definition into a gate. Raw material and packaging are for issue and packing.
        // Putting them on a sales order sells the "in" of inventory as the "out".
        //
        // This and `order_product_sellable` below are the same criterion at two moments, and both are required
        // (the candidate-filter shape in AGENTS.md). The filter governs what the dropdown shows at entry.
        // The precondition governs whether the document stands at approval. `productType` is in product's
        // editableFields, so it can still change after selection, and an existing order does not re-run write validation by itself.
        //
        // `status: "active"` is safe, and it matches the bom.ts header note ("only on records that freeze").
        // The candidate surface and the write surface share one condition, so narrowing candidates narrows save.
        // Only pendingReview lines are writable on this document. The in-progress whitelist does not include `lines`,
        // so a patch cannot carry lines, `refSitesOf` does not see the line column, and disabling an in-flight product
        // does not freeze the remark. Blocking pending review is correct: that line had to be replaced before approval anyway.
        {
          key: "productId",
          label: "Product",
          type: "ref",
          ref: "product",
          required: true,
          refFilter: { canSell: true, status: "active" },
        },
        // productId already points at a SKU. After selection it brings that SKU's required spec, and this order may still freeze a display value.
        { key: "spec", label: "Spec", type: "string", refDefault: { from: "product", match: "productId", through: null, field: "spec" } },
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "unit", label: "Unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number", hidden: true },
        { key: "baseQty", label: "Primary-unit qty", type: "number", hidden: true, calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "price", label: "List price", type: "money", required: true },
        {
          // This cell is percent of list collected, not points off. The two readings are close, and the money is opposite:
          // 85% of list is 85 (collect 85%). 15 is read as "collect 15%".
          // The declaration already says `netPrice = price × discount/100`, but only the formula can say it.
          // The person filling the cell, and the model filling it for them, cannot see the formula. Blank means no discount (treated as 100).
          // Only a line that actually has a discount is affected. 0 is free.
          key: "discount",
          label: "Discount %",
          type: "percent",
          help: "Enter percent of list collected, not points off: 85% of list is 85, 90% is 90, no discount stays blank (treated as 100). 0 is free.",
        },
        {
          // Net price (after discount). Downstream uses this as the unit price, not `price`.
          //
          // The agreed unit price is the discounted price: the customer negotiated 4.05. The 4.5 on `price` is list.
          // Settling the issue document on `price` was measured: a full issue posted `ar in = 2650` while the order
          // reserved and released 2470. The 180 gap is the discount. The customer was billed 2650 and had agreed 2470.
          // Both bills looked legal, both balances were legal numbers, and the same customer did not net.
          //
          // Why not "add discount on the issue line": discount is a commercial term on the order.
          // The warehouse clerk should not see it on the issue document, and must not be able to change it. The net price is a fact already set.
          key: "netPrice",
          label: "Net price",
          type: "money",
          help: "List price × discount % / 100. Downstream settles on this",
          // Hidden from the line UI only. The column stays, and downstream (issue, receivable, primary-unit basis) still consumes it.
          hidden: true,
          derive: {
            kind: "formula",
            expr: {
              op: "mul",
              args: [
                { field: "price" },
                {
                  op: "div",
                  args: [{ orElse: { of: { field: "discount" }, whenEmpty: 100 } }, { value: 100 }],
                },
              ],
            },
          },
        },
        {
          key: "baseNetPrice",
          label: "Primary-unit net price",
          type: "money",
          help: "Net price ÷ unit factor. Downstream keeps the contract amount when the unit changes",
          // A handoff value for the downstream basis. It means nothing on the line grid (net price is already there).
          // Hidden from the form and the line UI. The column stays and a unit switch still consumes it. It just stays out of the user's view.
          hidden: true,
          calculate: { op: "div", args: [{ field: "netPrice" }, { field: "unitFactor" }] },
        },
        {
          /**
           * Gross amount = quantity × list price (before discount), rounded to cents.
           *
           * `amount` below (net amount) is a different commercial basis, and the business wants both:
           * list times quantity is "what list says to collect", and the discounted figure is "what is actually due".
           * Keeping only one means sales multiplies again on a calculator while quoting.
           *
           * Built on `price`, not backed out of `netPrice`. Backing out divides by the discount,
           * and a discount of 0 divides by zero. Two algorithms for one number means one of them will drift.
           */
          key: "grossAmount",
          label: "Gross amount",
          type: "money",
          help: "Quantity × list price, before discount",
          derive: {
            kind: "formula",
            expr: { op: "mul", args: [{ field: "qty" }, { field: "price" }] },
          },
        },
        {
          key: "amount",
          label: "Net amount",
          // The type is money (the real type). The formula lives in derive.
          // Line amount is not a stored column. It is computed at query time, the same discipline as "do not store a balance":
          // store a copy and, after the discount basis changes, historical lines never match the formula again
          type: "money",
          help: "Gross amount × discount % / 100. A blank discount is no discount. The receivable uses this",
          derive: {
            kind: "formula",
            // Built on `netPrice`. Do not write the discount formula a second time.
            //
            // Two copies mean a change of discount basis (for example a tiered discount) changes only one,
            // and the symptom is "line amount" a little off "net price × quantity". Both numbers claim to be right,
            // and nothing says which is wrong. Same discipline as one criterion, one source.
            // A blank discount is a legal fact (no discount). The default is already declared on netPrice.
            expr: { op: "mul", args: [{ field: "qty" }, { field: "netPrice" }] },
          },
        },
        {
          // "How much was given off" is the number sales quotes to the customer. If it is missing from the line grid, the business notices immediately.
          //
          // Built on `amount` (gross total minus net amount). Do not write the discount formula a second time.
          // Writing `qty × price × discount/100` means a change of discount basis (for example a tiered discount)
          // changes only one place. The symptom is "allowance" not matching "list price minus net price". Both numbers claim to be right,
          // and nothing says which is wrong. Same discipline as `amount` built on `netPrice`.
          //
          // With no discount it is 0 (`netPrice` already treats an empty discount explicitly), not blank.
          key: "discountAmount",
          label: "Allowance",
          type: "money",
          help: "Quantity × list price − amount, the money given off on this line",
          derive: {
            kind: "formula",
            expr: {
              op: "sub",
              args: [{ op: "mul", args: [{ field: "qty" }, { field: "price" }] }, { field: "amount" }],
            },
          },
        },
        {
          // Line rollup: how much of this line has actually been issued.
          //
          // There is no header quantity issued. Quantities of different products or units cannot be added. Shipment complete and over-issue hold only per line.
          // Counts issued sales deliveries (status=shipped)
          key: "shippedBaseQty",
          label: "Issued (primary unit)",
          type: "number",
          help: "Summed from issued sales deliveries by order line. Not editable",
          hidden: true,
          derive: {
            kind: "rollup",
            from: "salesDelivery",
            through: "lines",
            match: "orderLineId",
            measure: "sum(baseQty)",
            where: { status: "shipped" },
          },
        },
        {
          key: "shippedQty",
          label: "Issued",
          type: "number",
          help: "Shown in the business unit chosen on this order line",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "shippedBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          // SM-28: open quantity = ordered − pending-review reservation − shipped. Warehouse-shipping and ended statuses are no longer included.
          // Pending-review issue documents plus issued quantity = effective reservation
          key: "occupyingBaseQty",
          label: "Reserved (primary unit)",
          type: "number",
          hidden: true,
          help: "This quantity on pending-review issue documents plus issued quantity",
          derive: {
            kind: "rollup",
            from: "salesDelivery",
            through: "lines",
            match: "orderLineId",
            measure: "sum(baseQty)",
            where: { status: ["pendingReview", "shipped"] },
          },
        },
        {
          key: "openBaseQty",
          label: "Open qty (primary unit)",
          type: "number",
          hidden: true,
          derive: {
            kind: "formula",
            expr: {
              op: "sub",
              args: [
                { field: "baseQty" },
                { orElse: { of: { field: "occupyingBaseQty" }, whenEmpty: 0 } },
              ],
            },
          },
        },
        {
          key: "occupyingQty",
          label: "Released",
          type: "number",
          help: "Quantity on this line already reserved by a pending-review issue or by an issued delivery, shown in this line's unit",
          hidden: true,
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "occupyingBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          key: "openQty",
          label: "Open qty",
          type: "number",
          help: "Ordered − effective reservation. The Ship button and this batch's default quantity read only this cell",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "openBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          // 3.5.x partial release to production: how much of this line has already been handed to the shop.
          //
          // Summed by line (`through: "lines"` + `match: "salesOrderLineId"`), not by header.
          // A header total only answers "has this order been released to production", which was the old one-shot gate.
          // The floor needs "300 of 1000 go to production, 700 ship from stock".
          //
          // `where` lists live production orders (including finished). Cancelled is excluded, so withdrawing the original lets it be released again.
          // List every non-cancelled live status instead of "not equal to cancelled". When a new status is added,
          // missing it from this list under-counts released quantity (releasable looks too big, and that is visible),
          // while missing it from an exclusion list over-counts (releasable looks too small and silently blocks normal work)
          key: "producingBaseQty",
          label: "Released to production (base unit)",
          type: "number",
          hidden: true,
          derive: {
            kind: "rollup",
            from: "productionOrder",
            through: "lines",
            match: "salesOrderLineId",
            measure: "sum(baseQty)",
            where: { status: [...LIVE_PRODUCTION_STATUSES] },
          },
        },
        {
          key: "producingQty",
          label: "Released to production",
          type: "number",
          help: "Quantity already covered by production orders (cancelled orders excluded), in this line's unit",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "producingBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          key: "canProduce",
          label: "Producible",
          type: "bool",
          hidden: true,
          derive: { kind: "lookup", from: "product", match: "productId", field: "canProduce" },
        },
        {
          // Releasable = max(0, ordered − shipment reservation − already released) × can produce.
          //
          // Shipment reservation is subtracted too: the part already shipped from stock does not need to be made.
          // Subtracting only what was released would still show 1000 releasable after 200 shipped from a 1000 order,
          // and the shop would make 200 extra with no order quantity left to issue them against.
          //
          // Raw material and packaging cannot open a production order. When can-produce is false this cell is 0.
          // The release dialog's `skipNonPositive` omits them, and when the whole order cannot be produced the button disappears.
          //
          // After finished goods that were already released are shipped, the two cumulative facts can cover the same quantity.
          // The subtraction basis stays. Remaining releasable quantity floors at zero, so the user is not shown a negative to-do.
          key: "openProductionBaseQty",
          label: "Releasable to production (base unit)",
          type: "number",
          hidden: true,
          derive: {
            kind: "formula",
            expr: {
              op: "mul",
              args: [
                {
                  op: "max",
                  args: [
                    { value: 0 },
                    {
                      op: "sub",
                      args: [
                        { field: "openBaseQty" },
                        { orElse: { of: { field: "producingBaseQty" }, whenEmpty: 0 } },
                      ],
                    },
                  ],
                },
                { orElse: { of: { field: "canProduce" }, whenEmpty: 0 } },
              ],
            },
          },
        },
        {
          key: "openProductionQty",
          label: "Releasable to production",
          type: "number",
          help: "Ordered minus shipment commitment minus already released to production, floored at 0. Raw materials and packaging are 0. The release-to-production action reads only this field",
          hidden: true,
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "openProductionBaseQty" }, { field: "unitFactor" }] } },
        },
      ],
    },
    {
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "customer", match: "customerId", field: "name" },
    },
    // The value is a list (`AttachmentRef[]`), not one file: a stack of contract scans,
    // a signed change order, and a stamped acknowledgement are several documents. One file is a list of length 1.
    //
    // Not required. A contract is not a precondition of ordering (verbal, email, and PO orders that add the contract later are normal),
    // and `required` means required at save, including pending review. That would close "open the order, attach the contract later".
    // "A contract is required before approval" belongs as a `required_fields` precondition on `approve`, not as required on this cell.
    { key: "contract", label: "Contract files", type: "attachment", help: "Scans, change orders, and stamped receipts. Multiple files allowed" },
    { key: "remark", label: "Remark", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pending review. Do not set editable: "none": pending review must be editable, or the form cannot be filled.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      // One fulfillment status after approval. Shipment progress is line quantity. In-production is the downstream production order. Neither occupies a header status.
      //
      // Letting `contract` through is a decision: a contract scan is evidence of the commercial terms, not the terms.
      // The signed scan almost always arrives after approval. Blocking it would stuff the contract into the remark.
      // Replacing the contract after approval is invisible to audit (`billRepo.save` does not keep a trail).
      //
      // `warehouseId` is on the whitelist: the warehouse is a logistics decision and is often unset at order time. Locking it closes the path that fills it in.
      // Price, quantity, customer, and lines are not on the whitelist.
      {
        key: "inProgress",
        label: "inProgress",
        color: "blue",
        editable: "whitelist",
        editableFields: ["promiseDate", "warehouseId", "remark", "contract"],
      },
      { key: "completed", label: "completed", color: "green", terminal: true },
      // Pending review can be deleted (it is the initial state). In progress uses the cancel edge, not delete.
      // There is no draft, no submit, and no withdraw. Create starts at pending review. Pending review has no cancel edge. The matrix only offers delete.
      { key: "cancelled", label: "cancelled", color: "red", terminal: true },
    ],
    transitions: [
      { code: "approve", from: "pendingReview", to: "inProgress", action: "Approve", primary: true },
      /**
       * Named Reject, not Unapprove. It returns the order to pending review.
       * Live downstream documents are cancelled by the UI CascadeAction before reject. Issued stock that has not been reversed is blocked by a gate.
       */
      { code: "unapprove", from: "inProgress", to: "pendingReview", action: "Reject", confirm: true },
      {
        code: "ship",
        from: "inProgress",
        to: "inProgress",
        action: "Ship",
        push: "salesDelivery",
        primary: true,
        remaining: "lines.openQty",
        params: [shipLinesParam],
      },
      /**
       * Complete is a commercial close, not "fully shipped". A short shipment may still be completed. There must be no pending-review issue.
       * Downstream production, tasks, dispatches, and subcontract orders are completed in one cascade by this module's planner (a subcontract order can still be received after complete).
       */
      { code: "complete", from: "inProgress", to: "completed", action: "Complete", confirm: true },
      /**
       * Cancel closes the order. Downstream documents are cancelled or closed in one cascade by this module's planner.
       */
      { code: "cancelRunning", from: "inProgress", to: "cancelled", action: "Cancel", confirm: true },
      /**
       * Release to production is a self-loop plus a push. One order can become several production orders in batches. What is left is released the next time the same action is used.
       * `productionType` is fixed to the production-domain option "standardProduction". The plant is chosen per line in the dialog.
       */
      {
        code: "to_production",
        from: "inProgress",
        to: "inProgress",
        action: "Release to production",
        push: "productionOrder",
        pushDefaults: { productionType: "standardProduction" },
        remaining: "lines.openProductionQty",
        params: [toProductionLinesParam],
      },
    ],
  },

  preconditions: [
    {
      // The standard shape of "optional while pending review, required before approval" (the validation section of AGENTS.md,
      // the same shape as `salesDelivery.delivery_date_required`).
      //
      // That is a different layer from declaring these cells `required`. `required` governs save
      // (including pending review, as a NOT NULL column). This governs the moment the document moves forward.
      // Do not make `required` mean "required depending on status". That is the job of preconditions.
      // Mixing the two concepts into one key fights itself.
      // This blocks only the promise date, not the ship-from warehouse. The warehouse is required on the issue document.
      // When the order leaves it empty, the left operand of the warehouse comparison is empty, and confirm issue falls to a warn (a person must confirm) instead of silently deducting the wrong warehouse.
      id: "approve_fields_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The promise date is the only start of overdue reminders and delay judgment. Without it this order is never chased. A phone order may be saved as pending review, but approval requires a promise date. The ship-from warehouse is left out on purpose: it is often unknown at order time, and its moment is the ship edge (ship_warehouse_required)",
      check: { primitive: "required_fields", fields: ["promiseDate"] },
    },
    {
      // "Optional at order time, required at ship" — the second moment of the same discipline as `approve_fields_required`
      // (the validation section of AGENTS.md: an optional field plus `required_fields` on that edge).
      //
      // This gate adds no new restriction. What it blocks, `salesDelivery.warehouseId` (`required`) already blocked.
      // What changes is the moment and the coordinate: from an HTTP 400 after Ship, when the pushed issue document fails to be created
      // (`path: warehouseId`, naming a cell on the issue document while the user is standing on the sales order, which has no cell called "issue warehouse"),
      // forward to evaluation time, naming this order's ship-from warehouse.
      // The in-progress whitelist also releases that cell, so the cell that turns red is a cell the user can edit.
      //
      id: "ship_warehouse_required",
      onTransition: "ship",
      source: "invariant",
      level: "block",
      why: "Ship pushes an issue document, and that document's warehouse is required (stock is booked by warehouse, and without one the posting has no coordinate). The warehouse may be unknown at order time, but it must be set when Ship is pressed. Otherwise the failure lands on the downstream pending-review issue, and no cell turns red on the order page",
      check: { primitive: "required_fields", fields: ["warehouseId"] },
    },
    {
      id: "lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A sales order with no lines expresses no sales intent. Sending it into approval only wastes the approver's time",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "amount_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "An order with a zero or negative amount is a data-entry error, and it should be stopped as early as possible",
      check: { primitive: "field_compare", left: { ref: "$bill.totalAmount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "order_line_qty_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Order quantity must be greater than zero on every line. A positive header total does not rule out one negative line cancelled by other positive lines, and downstream shipment and stock control hold per line",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "order_line_net_price_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The amount that actually takes effect is the discounted net price, not the typed list price. It must be greater than zero on every line, so a zero or negative line is not hidden by other positive lines",
      check: { primitive: "lines_all", left: { ref: "$line.netPrice" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "order_product_active",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A disabled product must not enter a new sales fulfillment chain. Product status is read again on the approve edge, where the order actually takes effect, so a product disabled during pending review cannot still be approved",
      check: {
        primitive: "ref_field_compare",
        via: "$line.productId",
        entity: "product",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
    {
      // Same value as the line `refFilter`, and neither may be deleted.
      // The moments differ: the filter governs entry, this governs approval. The material type is editable (it is in product's
      // editableFields). An order that selected a product and then sat in pending review does not re-run write validation
      // when the product is changed so it can no longer be sold. Only this gate catches that. It sits on approve, next to
      // `order_product_active`: read again at the moment the order actually takes effect.
      id: "order_product_sellable",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A sales order can sell only finished goods and semi-finished goods. Raw material and packaging are for issue and packing. Selling them makes a BOM component and a product for sale the same stock, while material issue and shipment are each legal and neither reports an error. The material type can still change after selection, so it is read again on the approve edge, where the order actually takes effect",
      check: {
        primitive: "ref_field_compare",
        via: "$line.productId",
        entity: "product",
        field: "canSell",
        op: "eq",
        right: { value: true },
      },
    },
    {
      id: "customer_active",
      onTransition: "approve",
      source: "gate",
      level: "block",
      why: "A disabled customer cannot take another order. This sits on approval because the customer may be disabled while the order is pending review",
      check: {
        primitive: "ref_field_compare",
        via: "customerId",
        entity: "customer",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
    { ...noPendingReviewDelivery(
      "complete",
      "Pending-review sales deliveries are still open, so this order cannot be completed. Confirm issue or cancel those deliveries first.",
      "A pending-review delivery has not become an issue fact, but it still holds order quantity. Completing now would leave unprocessed deliveries behind a completed order. Cancelled or reversed deliveries are not pending review and do not block",
    ) },
    { ...noPendingReviewDelivery(
      "unapprove",
      "Pending-review sales deliveries are still open, so this order cannot be rejected. Confirm or cancel those deliveries first.",
      "Rejecting while pending-review issue documents still hang off this order would leave downstream documents and reservations out of line",
    ) },
    noShippedDeliveryOnUnapprove,
    {
      id: "ship_has_open_qty",
      onTransition: "ship",
      source: "gate",
      level: "block",
      message: "Open quantity is already 0, so there is nothing left to ship",
      why: "Open quantity is ordered minus pending-review reservation minus shipped. When every line is 0 the button should disappear. This gate blocks a direct API call (and a double-click on the self-loop)",
      check: {
        primitive: "lines_any",
        left: { ref: "$line.openBaseQty" },
        op: "gt",
        right: { value: 0 },
      },
    },
    {
      // Partial release to production: the remainder is on the line (openProductionQty), not "release once for the life of the order".
      // This release needs at least one line that can still move.
      id: "has_open_production_qty_to_production",
      onTransition: "to_production",
      source: "gate",
      level: "block",
      message: "This order has no quantity left to release to production: every line is already fully released, already reserved by shipment, or is a product that cannot be produced (raw material or packaging). To add quantity, cancel the related production order or change the order quantity",
      why: "This release must have at least one line with releasable quantity. Releasable quantity is max(0, ordered − shipment reservation − already released) times can-produce (cancelled production orders do not count; raw material and packaging are 0). Letting an all-zero order through would push a production order with no lines",
      check: {
        primitive: "lines_any",
        left: { ref: "$line.openProductionQty" },
        op: "gt",
        right: { value: 0 },
      },
    },
    {
      id: "promise_date_sane",
      onTransition: "approve",
      source: "gate",
      level: "warn",
      message: "The promise date is earlier than the order date. Please confirm",
      why: "A backwards promise date is usually a typing error, but it is legitimate when backfilling history, so this warns instead of blocking",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.promiseDate" },
        op: "gte",
        right: { ref: "$bill.orderDate" },
      },
    },
  ],

  handoff: [
    {
      id: "notify_approver",
      kind: "todo",
      onStatus: "pendingReview",
      to: "sales-manager",
      title: "Sales order waiting for review",
      why: "A document sitting in pending review must have someone explicitly assigned, or it piles up in silence",
    },
    {
      id: "chase_overdue",
      kind: "remind",
      onStatus: "inProgress",
      to: "sales-representative",
      title: "Sales-order promise date is near. Follow up on shipment",
      due: "1d",
      why: "A late delivery does not announce itself. The overdue reminder is the only way the delay is found",
    },
    {
      id: "notify_warehouse",
      kind: "notify",
      onTransition: "approve",
      to: "warehouse-clerk",
      title: "A sales order was approved. Prepare to ship",
      why: "The warehouse needs to know what will go out so it can arrange picking and people",
    },
    {
      id: "notify_planner_to_production",
      kind: "todo",
      onTransition: "to_production",
      to: "production-planner",
      title: "A production order from a sales order is waiting to be scheduled",
      why: "Each product is one pending-review production order, and the plant is already chosen. The planner still has to fill the BOM and routing and submit for review, or it will not move on its own",
    },
  ],

  views: {
    list: {
      columns: ["code", "customerName", "orderDate", "promiseDate", "orderSource", "salesperson", "grossTotalAmount", "totalAmount"],
      filters: ["status", "customerId", "orderSource", "salesperson"],
      // Contract number is searchable: the customer quotes the contract number, not our order number
      searchable: ["code", "customerName", "contractNo"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Basics", fields: ["code", "customerId", "orderDate", "promiseDate", "warehouseId", "orderSource", "salesperson", "contractNo"] },
      { title: "Order lines", fields: ["lines"] },
      { title: "Amount and progress", fields: ["grossTotalAmount", "totalAmount"] },
      // `contract` is kept out of `list.columns` on purpose. That cell renders as a string of file names,
      // and a list scan wants customer, amount, and progress. When the business needs "does this order have a contract",
      // that is a yes/no column, which is a different thing from the attachment itself (the old system hid that column by default too)
      { title: "Other", fields: ["contract", "remark"] },
    ],
  },
});

// ---------------------------------------------------------------------------
// Sales-order close cascade. complete / cancelRunning closes downstream in one planner pass.
//
// setStatus does not nest the target edge's planner, so this must emit the force* commands for
// dispatch, task, subcontract, and production order itself. Do not only setStatus(productionOrder, complete).
// Do not call releaseSalesAfterProductionSettled. That pushes sales fulfillment after a production order closes itself.
// ---------------------------------------------------------------------------

const OPEN_PRODUCTION_ORDER_STATUSES = ["pendingReview", "awaitingRelease", "releasing", "inProduction", "reported"] as const;
const OPEN_ASSIGNMENT_STATUSES = ["pendingReview", "awaitingProduction", "inProduction"] as const;
const OPEN_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction"] as const;
const ALL_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction", "completed", "cancelled"] as const;

/** Statuses a subcontract order is pushed through when a sales order closes. Complete leaves already-completed orders alone. Cancel withdraws completed ones too. */
const SUBCONTRACT_COMPLETE_STATUSES = ["pendingReview", "awaitingOutsource", "processing"] as const;
const SUBCONTRACT_CANCEL_STATUSES = ["pendingReview", "awaitingOutsource", "processing", "completed"] as const;

/**
 * Which action cancels a production order with the sales order. A pending-review production order has its own
 * system edge (`forceCancelFromReview`). That is not the same action as "cancel with the sales order" on the other statuses.
 */
function productionOrderCancelAction(status: string): string {
  return status === "pendingReview" ? "forceCancelFromReview" : "forceCancel";
}

async function listAllHeaders(
  ctx: PlannerContext,
  module: string,
  field: string,
  value: string,
  statuses: readonly string[],
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const rows: Readonly<Record<string, unknown>>[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills(module, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field, op: "eq", value },
          { kind: "cond", field: "status", op: "in", value: [...statuses] },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length < limit) return rows;
  }
}

/** Sales order to every linked production order (including finished): header salesOrderId, then reference lineage if something is missing. */
async function listLinkedProductionOrders(
  ctx: PlannerContext,
  salesOrderId: string,
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const byField: Readonly<Record<string, unknown>>[] = [];
  const seen = new Set<string>();
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills("productionOrder", {
      where: { kind: "cond", field: "salesOrderId", op: "eq", value: salesOrderId },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });
    for (const row of page.rows) {
      const id = String(row["id"] ?? "");
      if (id === "" || seen.has(id)) continue;
      seen.add(id);
      byField.push(row);
    }
    if (page.rows.length < limit || offset + page.rows.length >= page.total) break;
  }
  if (byField.length > 0 || ctx.read.listReferencedBills === undefined) return byField;

  const referenced = await ctx.read.listReferencedBills("salesOrder", salesOrderId, "productionOrder", 100);
  for (const hit of referenced.rows) {
    const id = requireText(hit.id, "production order id");
    if (seen.has(id)) continue;
    const bill = await ctx.read.getBill("productionOrder", id);
    seen.add(id);
    byField.push({
      id,
      status: requireText(bill.header["status"], "production order status"),
      salesOrderId,
    });
  }
  return byField;
}

async function subcontractCommandsForTasks(
  ctx: PlannerContext,
  taskIds: ReadonlySet<string>,
  completing: boolean,
): Promise<readonly ExecutionCommand[]> {
  if (taskIds.size === 0) return [];
  const statuses = completing ? SUBCONTRACT_COMPLETE_STATUSES : SUBCONTRACT_CANCEL_STATUSES;
  const taskIdList = [...taskIds];
  const rows: Readonly<Record<string, unknown>>[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills("subcontractOrder", {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "status", op: "in", value: [...statuses] },
          { kind: "cond", field: "lines.productionTaskId", op: "in", value: taskIdList },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length < limit) break;
  }

  const verb = completing ? "complete" : "cancel";
  const commands: ExecutionCommand[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = requireText(row["id"], "subcontract order id");
    if (seen.has(id)) continue;
    seen.add(id);
    const status = requireText(row["status"], "subcontract order status");
    const bill = await ctx.read.getBill("subcontractOrder", id);
    const linked = (bill.lines["lines"] ?? []).some((line) => {
      const taskId = line["productionTaskId"];
      return typeof taskId === "string" && taskIds.has(taskId);
    });
    if (!linked) continue;
    commands.push({
      type: "setStatus",
      commandId: `${verb}-subcontract-order-${id}`,
      target: { kind: "existing", module: "subcontractOrder", id },
      transition: completing ? "forceComplete" : "forceCancel",
      expectedStatus: status,
    });
  }
  return commands;
}

/**
 * Link chain:
 *   sales order --salesOrderId--> production order
 *         --productionOrderId--> production task
 *         --productionTaskId--> dispatch / subcontract order (line)
 *
 * A dispatch has a productionOrderId snapshot, but the business key is productionTaskId. Looking up by order id misses documents.
 *
 * Subcontract close must cover subcontract orders still open under a finished production order. Someone may complete the
 * production order by hand first. If that role cannot read subcontract orders, or the cascade missed them, completing the
 * sales order while scanning only open production orders leaves those subcontract orders out forever.
 */
async function settleSalesOrder(ctx: PlannerContext): Promise<ExecutionPlan> {
  const completing = ctx.transition === "complete";
  const salesOrderId = requireText(ctx.bill.id, "sales order id");
  const commands: ExecutionCommand[] = [];
  const linkedOrders = await listLinkedProductionOrders(ctx, salesOrderId);
  const openOrders = linkedOrders.filter((order) =>
    (OPEN_PRODUCTION_ORDER_STATUSES as readonly string[]).includes(String(order["status"] ?? "")),
  );

  const allTaskIds = new Set<string>();
  for (const order of linkedOrders) {
    const orderId = requireText(order["id"], "production order id");
    for (const task of await listAllHeaders(ctx, "productionTask", "productionOrderId", orderId, ALL_TASK_STATUSES)) {
      allTaskIds.add(requireText(task["id"], "production task id"));
    }
  }
  commands.push(...await subcontractCommandsForTasks(ctx, allTaskIds, completing));

  for (const order of openOrders) {
    const orderId = requireText(order["id"], "production order id");
    const orderStatus = requireText(order["status"], "production order status");

    const allTasks = await listAllHeaders(ctx, "productionTask", "productionOrderId", orderId, ALL_TASK_STATUSES);
    const openTasks = allTasks.filter((task) =>
      OPEN_TASK_STATUSES.includes(task["status"] as typeof OPEN_TASK_STATUSES[number]),
    );

    // Dispatch: look up by task, not by the production-order snapshot.
    for (const task of openTasks) {
      const taskId = requireText(task["id"], "production task id");
      const assignments = await listAllHeaders(
        ctx,
        "processAssignment",
        "productionTaskId",
        taskId,
        OPEN_ASSIGNMENT_STATUSES,
      );
      for (const row of assignments) {
        const id = requireText(row["id"], "dispatch id");
        const status = requireText(row["status"], "dispatch status");
        commands.push({
          type: "setStatus",
          commandId: `${completing ? "complete" : "cancel"}-process-assignment-${id}`,
          target: { kind: "existing", module: "processAssignment", id },
          transition: completing ? "forceComplete" : "forceCancel",
          expectedStatus: status,
        });
      }
    }

    for (const row of openTasks) {
      const id = requireText(row["id"], "production task id");
      const status = requireText(row["status"], "production task status");
      commands.push({
        type: "setStatus",
        commandId: `${completing ? "complete" : "cancel"}-production-task-${id}`,
        target: { kind: "existing", module: "productionTask", id },
        transition: completing ? "forceComplete" : "forceCancel",
        expectedStatus: status,
      });
    }

    commands.push({
      type: "setStatus",
      commandId: `${completing ? "complete" : "cancel"}-production-order-${orderId}`,
      target: { kind: "existing", module: "productionOrder", id: orderId },
      transition: completing ? "forceComplete" : productionOrderCancelAction(orderStatus),
      expectedStatus: orderStatus,
    });
  }

  return { version: 1, commands };
}

export const planners = definePlanners({
  complete: settleSalesOrder,
  cancelRunning: settleSalesOrder,
});
