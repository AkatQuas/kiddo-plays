import { defineModule } from "@open-erp/metamodel";

/**
 * Sales delivery — the downstream document shape. One delivery can issue several sales orders.
 *
 * Covers: line references (`refLine`) / line lookup and rollup / a real posting (stock down) /
 * per-line quantity control (cumulative issue must not exceed the order line) / a header total computed from the lines.
 *
 * ── Why the source reference lives on the line ──────────────────────────
 * Combined issue is normal: several orders for one customer on one truck, one pick, one month-end invoice.
 * Industry practice agrees (ERPNext `so_detail`, SAP VGBEL/VGPOS, multi-select push in domestic ERPs).
 * The shared point is that the source reference lives on the line, not the header. The header keeps only
 * what is still unique after the merge: customer, warehouse, issue date, carrier.
 *
 * A header `orderId` cannot merge. It pins one delivery to one order forever. That pin has no symptom.
 * The user only finds they must create three deliveries for one truck.
 *
 * ── Two references on the line, and neither can be dropped ──────────────
 *   `orderId`     → the order header (`ref`). Reverse lookup uses it: the "which deliveries" block on the
 *                   order detail can compare document ids only. Without it that panel is always empty,
 *                   and an empty panel is read as "this order has no downstream". Gate REF_LINE_NO_BILL_PARTNER covers this.
 *   `orderLineId` → one order line (`refLine`). Over-issue control and progress write-back use it.
 *                   "How much was issued" is true per order line, not per order.
 *
 * ── Split with the sales order ──────────────────────────────────────────
 * The sales order holds the promise: zero effects, no ledger entry. An order is "agreed to sell", not yet happened.
 * This module holds the sales issue fact: confirm posts immediately and deducts stock.
 *
 * ** SM-28: a fulfillment document posts on confirm **
 * The warehouse-job layer is gone. Confirming a delivery reduces stock. There is no "hand to the warehouse" step.
 * Statuses left: pendingReview, shipped, cancelled. Confirm issue has no approval step in between.
 */
export default defineModule({
  label: "Sales delivery",
  // Custom fields are open to the tenant: this table gets a `custom jsonb` column and a GIN index.
  // The chain product → sales order → production order → production task → dispatch / delivery
  // is where industry-specific fields most often need to travel, so it is opened first. To open another table, add the same line and ship.
  customFields: true,
  numbering: { prefix: "CK", seqScope: "day" },

  fields: [
    { key: "code", label: "Issue no.", type: "string", primary: true, auto: true },
    // The customer stays on the header: a merge assumes one customer (the receivable is on the header; one document owes one party).
    // A cross-customer merge has no reading — there is no answer for whose receivable it is
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    // The issue warehouse stays on the header: it is the stock-posting scope. Issuing one document from two warehouses
    // is two deliveries. Moving `scope` onto the line would ask "is this warehouse enough" once per line,
    // which is its own modeling decision and should not be done in passing
    { key: "warehouseId", label: "Issue warehouse", type: "ref", ref: "warehouse", required: true },
    // Not `required`. It is "optional while pending review, required before confirm issue", expressed by the
    // `required_fields` precondition on confirm (the shape AGENTS.md specifies).
    //
    // Why not `required`: `required` means required at save (a NOT NULL column), including pending review.
    // The main source of this document is a push from a sales order. The order has no issue-date field.
    // `buildPushDraft` copies only same-key, same-type fields, so a pending-review document is missing this cell
    // and Ship returns 400 (`REQUIRED_BLANK`). That was measured: the main path broke here.
    //
    // The issue date is not known at order time. It is the day the warehouse actually issues.
    // "Optional while pending review, required before confirm" is the real meaning, not a workaround.
    { key: "deliveryDate", label: "Issue date", type: "date", createDefault: "today" },
    {
      key: "lines",
      label: "Issue lines",
      type: "subtable",
      ref: "salesDeliveryLine",
      fields: [
        // Two source references. `orderId` is for reverse lookup (related documents on the order).
        // `orderLineId` is for over-issue control and progress write-back. Without the first, that panel stays empty.
        // Without the second, "cumulative issue must not exceed the order" cannot be computed on a merged document
        {
          key: "orderId",
          label: "Sales order",
          type: "ref",
          ref: "salesOrder",
          required: true,
          refFilter: {
            customerId: { from: "$bill.customerId" },
            status: "inProgress",
          },
        },
        {
          key: "orderLineId",
          label: "Order line",
          type: "refLine",
          ref: "salesOrder",
          through: "lines",
          required: true,
        },
        {
          key: "productId",
          label: "Product",
          type: "ref",
          ref: "product",
          // The product is not a second free choice: the order line already names what to issue.
          // Snapshotted from the order line, so create does not load every product, and a mismatch is not discovered only at confirm issue.
          snapshot: { from: "salesOrder", match: "orderLineId", through: "lines", field: "productId" },
        },
        // Spec is frozen from the order line. Unit defaults from the order line and may still switch among that product's primary and alternate units.
        { key: "spec", label: "Spec", type: "string", snapshot: { from: "salesOrder", match: "orderLineId", through: "lines", field: "spec" } },
        { key: "qty", label: "This issue qty", type: "number", required: true },
        {
          key: "unit",
          label: "Unit",
          type: "enum",
          required: true,
          refDefault: { from: "salesOrder", match: "orderLineId", through: "lines", field: "unit" },
          unitChoice: { match: "productId", factorInto: "unitFactor" },
        },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseQty", label: "Primary-unit qty", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "batchNo", label: "Batch no.", type: "string", help: "Recorded only. It does not enter stock math — the ledger coordinate stops at the warehouse, and stock by batch is not supported yet" },
        {
          key: "baseUnitPrice",
          label: "Primary-unit net price",
          type: "money",
          snapshot: { from: "salesOrder", match: "orderLineId", through: "lines", field: "baseNetPrice" },
        },
        {
          key: "price",
          label: "Net price",
          type: "money",
          help: "Converted from the order's frozen primary-unit net price into this line's unit",
          calculate: { op: "mul", args: [{ field: "baseUnitPrice" }, { field: "unitFactor" }] },
        },
        {
          key: "amount",
          label: "Amount",
          // An issue line has no discount: the price brought down is already the net price. Discount is a commercial term on the order.
          // The warehouse clerk should neither see it nor be able to change it.
          // So there is no orElse: qty and price are required. A blank is an incomplete entry and should throw
          type: "money",
          help: "Quantity × price (the price is already the discounted net price)",
          derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "price" }] } },
        },
        {
          // Line lookup: the over-issue ceiling is this order line's primary-unit quantity.
          // It must not use a header total, and it must not use the switchable business qty.
          key: "orderLineBaseQty",
          label: "Ordered primary-unit qty",
          type: "number",
          derive: { kind: "lookup", from: "salesOrder", through: "lines", match: "orderLineId", field: "baseQty" },
        },
        {
          // The type is `ref`, not `string`. This cell holds a warehouse record id.
          // Declared as string, the UI shows a raw uuid (`displayText` prints a string as text;
          // a `ref` replaces the id from `refOptions`). The user would see "order warehouse 9f79327e-...".
          //
          // The value is still the id copied from `salesOrder.warehouseId`, for display and to trace the order's original warehouse.
          // Stock always posts against this document's header `warehouseId`. A mismatch does not block confirm issue.
          //
          // A derived ref is a computed copy, not a reference this document owns. `relationsOf` does not project it,
          // so the warehouse detail does not grow a reverse panel for this cell. The edge from this document to the order
          // is `orderId` (→ `salesOrder`), named by `derive.match`.
          key: "orderWarehouseId",
          label: "Order warehouse",
          type: "ref",
          ref: "warehouse",
          derive: { kind: "lookup", from: "salesOrder", match: "orderId", field: "warehouseId" },
        },
        {
          key: "orderCode",
          label: "Order no.",
          type: "string",
          derive: { kind: "lookup", from: "salesOrder", match: "orderId", field: "code" },
        },
      ],
    },
    {
      key: "totalAmount",
      label: "Issue total",
      type: "money",
      // The receivable records this number. It has a column (lineAgg is stored on save), so it passes EFFECT_AMOUNT_NOT_STORED.
      // A derived field (computed at query time) must not be posted. That is the one thing an append-only ledger cannot hold
      lineAgg: { of: "lines", measure: "sum(amount)" },
    },
    { key: "carrier", label: "Carrier", type: "string" },
    { key: "trackingNo", label: "Tracking no.", type: "string" },
    {
      // The list shows the customer name, not `customerId`. A ref in a table can only render an id.
      // Two ways to show a name: look up once per row (N+1), or declare a lookup like this.
      // The query compiler turns the latter into one correlated subquery, with no extra round trip
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "customer", match: "customerId", field: "name" },
    },
    {
      // How many orders this document touches. After a combined issue, "source" is no longer one value.
      // The list must say whether this is a merge, or the user opens it and only then sees three orders
      key: "orderCount",
      label: "Order line count",
      type: "number",
      help: "How many order lines this document's lines touch",
      lineAgg: { of: "lines", measure: "count()" },
    },
    { key: "remark", label: "Remark", type: "text" },
  ],

  lifecycle: {
    statuses: [
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      // After posting, narrow explicitly. A non-terminal status defaults to `editable: "full"`.
      // Copying that default would leave posting coordinates (customerId / warehouseId) editable while the ledger still hangs on them.
      // Change a coordinate and the posting no longer matches the document (EFFECT_COORD_FIELD_EDITABLE)
      { key: "shipped", label: "shipped", color: "green", terminal: true, editable: "whitelist", editableFields: ["carrier", "trackingNo", "remark"] },
      // Pending review can be deleted. A document that has taken an edge cannot. Cancel leaves a "cancelled" record.
      // A runtime that wrote lineage still cannot delete (lineage only grows), so cancel stays.
      { key: "cancelled", label: "cancelled", color: "red", terminal: true },
    ],
    transitions: [
      // `confirm: true`: this edge has zero effects and is not listed in any effect's `reverseOn`,
      // so `postsToLedger` is always false and it does not get the free "posting needs a confirm".
      // `cancelled` is terminal. Omitting confirm does not error. One mis-click pushes the delivery into a terminal state
      { code: "cancel", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
      {
        // Confirm issue posts. Stock is deducted directly. There is no warehouse job in between.
        code: "confirm",
        from: "pendingReview",
        to: "shipped",
        action: "Confirm issue",
        primary: true,
        effects: [
          {
            target: "stock",
            op: "out",
            subject: "$line.productId",
            scope: "$bill.warehouseId",
            amount: "{$line.baseQty}",
            reverseOn: [],
          },
        ],
      },
    ],
  },

  preconditions: [
    {
      id: "lines_required",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "A delivery with no lines cannot say what was issued. The header total is computed from the lines, and an empty detail sums to 0. A zero-amount delivery cannot confirm issue",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "qty_positive",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "Issue quantity must be positive. A negative issue is a return, which is another document, not a negative on this one",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      // The standard shape of "optional while pending review, required before confirm issue".
      // That is a different layer from declaring `deliveryDate` as `required`: `required` governs save (including pending review).
      // This governs the moment the document moves forward. A pushed pending-review document can be stored, and a document with no date cannot reach confirm.
      //
      // Do not make `required` mean "required depending on status". That is the job of preconditions.
      // Mixing the two concepts into one key fights itself (AGENTS.md, validation).
      id: "delivery_date_required",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "The issue date is on the shipping papers and is the fact date of the stock posting. A pushed pending-review document may omit it (the order has no such field, and the warehouse has not scheduled the issue), but it must be filled before confirm issue. Without a date there is no traceable stock fact",
      check: { primitive: "required_fields", fields: ["deliveryDate"] },
    },
    {
      // 3.5.x: relaxed from "must equal awaiting shipment" to "must not be terminal".
      //
      // It used to require `eq awaitingShipment`, while a sales order in inProduction and shipping could already ship
      // (`shipInProduction` self-loop, `shipMore`). The push created a pending-review delivery, then confirm issue
      // hit this gate. The user saw a refusal that contradicted the system, and the only move on the floor was to void and re-enter.
      //
      // What stays: a terminal order still must not issue. Issuing against completed or cancelled creates a stock
      // reduction and a receivable for an order that is already settled or withdrawn.
      // That is posting a promise that does not exist, so this layer still blocks.
      //
      // "Must not over-issue" is `not_over_ship`, judged on cumulative quantity. That is the real gate.
      // This status rule only blocks terminal states.
      id: "source_order_open_for_delivery",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      message: "The source sales order is already completed or cancelled, so issue cannot be confirmed. Confirm issue or cancel pending-review deliveries before you complete the sales order. An order that has already ended cannot issue again.",
      why: "A completed or cancelled sales order cannot issue again: that would create a stock reduction and a receivable for an order that is already settled or withdrawn. An order still in progress can ship. Pending-review issues must be handled before the order is completed. After completion they can only be cancelled, not confirmed",
      check: {
        primitive: "ref_field_compare",
        via: "$line.orderId",
        entity: "salesOrder",
        field: "status",
        op: "not_in",
        right: { value: ["completed", "cancelled"] },
      },
    },
    {
      id: "delivery_customer_matches_source",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "This header customer is copied onto the pushed receivable and becomes the ar subject. It must equal the customer on every source order, or goods from party A's order are booked to party B. The receivable side can only compare against this delivery, not against the order, so this hop is judged here",
      check: {
        primitive: "ref_field_compare",
        via: "$line.orderId",
        entity: "salesOrder",
        field: "customerId",
        op: "eq",
        right: { ref: "$bill.customerId" },
      },
    },
    {
      id: "delivery_product_matches_source_line",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "Stock posts by the issue-line product. The product must come from the order line that orderLineId points at. Changing only productId must not issue some other product",
      check: {
        primitive: "ref_field_compare",
        via: "$line.orderLineId",
        entity: "salesOrder",
        through: "lines",
        field: "productId",
        op: "eq",
        right: { ref: "$line.productId" },
      },
    },
    {
      id: "delivery_price_matches_source_line",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "This document's totalAmount is quantity times price on the issue lines, and that total is the pushed receivable amount (`pushFrom: totalAmount`). Price must stay pinned to the order line's net price. A delivery must not rewrite what the customer owes",
      check: {
        primitive: "ref_field_compare",
        via: "$line.orderLineId",
        entity: "salesOrder",
        through: "lines",
        field: "baseNetPrice",
        op: "eq",
        right: { ref: "$line.baseUnitPrice" },
      },
    },
    {
      id: "not_over_ship",
      onTransition: "confirm",
      source: "gate",
      level: "block",
      why: "Cumulative issue above the order quantity means a wrong pick or a wrong entry. Both must be checked before issue. Once issued, stock has moved, and a receivable is pushed for the over-issued amount",
      check: {
        primitive: "related_agg",
        from: "salesDelivery",
        // Sum the lines, not the header. After a combined issue, "how much of this order line was issued"
        // is no longer "the header totals of a few deliveries" — the delivery header has no order field.
        // A header sum would take the whole merged document (including other order lines).
        // That number is too big, looks normal, and would block a legitimate issue
        through: "lines",
        match: "orderLineId",
        // Per line: `$line.` runs this rule once per detail line. Three lines of a merged document belong to
        // different order lines. "Cumulative must not exceed the order" holds only at the line on that document
        on: "$line.orderLineId",
        agg: "sum",
        measure: "baseQty",
        // The filter still sits on the header (a line has no state machine). Without it, pending-review lines
        // are included in the cumulative — a number that is too big and blocks a legitimate issue.
        // SM-28: only "shipped" counts. There is no warehouse-shipping status
        where: { status: ["shipped"] },
        op: "lte",
        // The right side is the ordered quantity of the order line this row points at (brought in by a line lookup)
        right: { ref: "$line.orderLineBaseQty" },
        // This line must be included. `where` limits to "shipped", and at evaluation this document is still "pendingReview"
        // (setStatus happens after the gate), so the left side is history only. Without this line,
        // "cumulative must not exceed the order" always passes the first over-issue, and verdict stays pass
        plus: { ref: "$line.baseQty" },
      },
    },
    {
      id: "stock_available",
      onTransition: "confirm",
      source: "gate",
      level: "block",
      message: "Not enough stock to confirm issue. Replenish or reduce this issue quantity.",
      why: "Confirming issue deducts stock from the issue warehouse. The warehouse no longer offers a negative-stock switch, so on-hand quantity must cover the issue",
      check: { primitive: "available_sufficient", target: "stock", subject: "$line.productId", scope: "$bill.warehouseId", need: "$line.baseQty" },
    },
  ],

  views: {
    list: {
      // Order line count is on the list: after a combined issue, "is this a merge" is something the user needs on the list
      columns: ["code", "status", "customerName", "deliveryDate", "orderCount", "totalAmount", "trackingNo"],
      filters: ["status", "warehouseId", "customerId"],
      searchable: ["code", "customerName", "trackingNo"],
      defaultSort: { field: "createdAt", desc: true },
    },
    // Form "add lines" uses SourceLinePicker: filter in-progress orders by the header customer, then expand and pick order lines.
    // productId is a snapshot and must not go through product bulk-add (that leaves dead lines with no orderId/orderLineId).
    createFrom: [{
      path: "lines.orderLineId",
      label: "Add lines",
      sourceStatuses: ["inProgress"],
      sourceRemaining: { header: null, line: "lines.openBaseQty" },
    }],
    form: [
      { title: "Basics", fields: ["code", "customerId", "warehouseId", "deliveryDate"] },
      { title: "Issue lines", fields: ["lines"] },
      { title: "Totals", fields: ["totalAmount", "orderCount"] },
      { title: "Logistics", fields: ["carrier", "trackingNo"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
