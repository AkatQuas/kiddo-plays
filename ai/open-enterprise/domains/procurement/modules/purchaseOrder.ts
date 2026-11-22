import { defineModule, normalizeField } from "@open-erp/metamodel";

const receiveLineField = normalizeField(
  {
    key: "receiveLines",
    label: "Lines to receive this time",
    type: "subtable",
    ref: "purchaseOrderReceiveDraftLine",
    required: false,
    fields: [
      { key: "orderLineId", label: "Order line", type: "string", required: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qtyOrdered", label: "Purchase quantity", type: "number", required: true },
      { key: "occupyingQty", label: "Released", type: "number", required: true },
      { key: "remainingReceiveQty", label: "Quantity still to receive", type: "number", required: true },
      { key: "qty", label: "Receive this time", type: "number", required: true },
    ],
  },
  "purchaseOrder.receive.params.receiveLines",
);

/**
 * Quantity for this receipt on the receive dialog. The pairing column must be named
 * `orderLineId`. Push pairs by the refLine column on the target lines that points back
 * at this module (`purchaseReceipt.lines.orderLineId`). Another name does not pair, and
 * the symptom is "no matching line on the pushed document".
 */
const receiveLinesParam = {
  key: "receiveLines",
  label: "Lines to receive this time",
  type: "billLines" as const,
  required: false,
  lineField: receiveLineField,
  fixedRows: true,
  readOnlyColumns: ["productId", "qtyOrdered", "occupyingQty", "remainingReceiveQty"],
  hiddenColumns: ["orderLineId"],
  seed: {
    from: "lines",
    columns: {
      orderLineId: "id",
      productId: "productId",
      qtyOrdered: "qty",
      occupyingQty: "occupyingQty",
      remainingReceiveQty: "remainingReceiveQty",
      qty: "remainingReceiveQty",
    },
    skipNonPositive: "remainingReceiveQty",
  },
};

/**
 * A purchase order carries two timelines. Order status is the transfer of responsibility.
 * Line-level receivedBaseQty is the fact that receipt has been confirmed.
 * "receiving" only means at least one receipt has been pushed. Partial pushes use the same
 * self-loop edge. Push count is not treated as received quantity.
 */
export default defineModule({
  label: "Purchase order",
  numbering: { prefix: "PO", seqScope: "day" },

  fields: [
    { key: "code", label: "Purchase order no.", type: "string", primary: true, auto: true },
    { key: "sourceType", label: "Source type", type: "enum", options: ["Purchase plan", "Replenishment demand", "Manual"], required: true },
    { key: "sourceNo", label: "Source no.", type: "string" },
    {
      key: "purchasePlanId",
      label: "Linked purchase plan",
      type: "ref",
      ref: "purchasePlan",
      // Optional. A purchase order can be created by hand with no plan. After a plan is chosen,
      // the form brings its purchase lines across and they can still be added, removed, or edited
      // by hand. It is in the schema so "which plan this order came from" can be looked up later,
      // not only as a one-time UI input. refFilter uses the same rule as line-level planId:
      // an approved plan for this warehouse.
      help: "Optional. After a plan is chosen, its purchase lines are brought across and can still be added, removed, or edited by hand",
      refFilter: { status: "approved", warehouseId: { from: "$bill.warehouseId" } },
    },
    {
      key: "salesOrderId",
      label: "Linked sales order",
      type: "ref",
      ref: "salesOrder",
      help: "Record this when the purchase serves one sales order, for due-date attribution and shortage impact. General replenishment may leave it empty",
    },
    { key: "purchaseDate", label: "Purchase date", type: "date", required: true, pushFrom: "planDate" },
    {
      // References a system account. The value is the platform userId. via:self means the value is already an account.
      key: "buyer", label: "Buyer", type: "ref", ref: "subject", required: true,
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    },
    {
      key: "supplierId",
      label: "Supplier",
      type: "ref",
      ref: "supplier",
      // Not required: true. It is optional, and approve hangs required_fields on it.
      // An order turned from a plan has not yet decided who to buy from, so pending review must
      // be able to save. A supplier must be chosen before approval.
      // The plan only says what to buy. The order says who to buy it from.
      help: "An order turned from a plan may leave this empty. A supplier must be chosen before approval. The plan only says what to buy. The order says who to buy it from",
      // Same rule as the approval edges `supplier_active` / `plan_supplier_active`, applied at entry.
      // The dropdown and the write both accept only an active supplier. The approval edge still
      // has to stay: a supplier disabled while the draft sits is only stopped there.
      refFilter: { status: "active" },
    },
    { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse", required: true },
    {
      key: "totalAmount",
      label: "Order amount",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(amount)" },
    },
    {
      key: "totalTaxAmount",
      label: "Tax total",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(taxAmount)" },
    },
    {
      key: "totalNetAmount",
      label: "Amount excl. tax total",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(netAmount)" },
    },
    {
      key: "lines",
      label: "Purchase lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [
        {
          key: "planId",
          label: "Purchase plan",
          type: "ref",
          ref: "purchasePlan",
          hidden: true, // Hidden. It is not shown on the line table.
          // Temporarily optional, to get around a permission problem. Long term: restore required when permission sync runs.
          // required: true,
          // The candidate list uses the same rule as plan_order_sources_approved and
          // plan_order_warehouses_match_plans on approve_plan (both require approved and the same warehouse).
          // Those two gates no longer load the referenced plan through planId. planId has been optional
          // since fd0b0769 and hidden since 7b4b9335. A pushed order line has an empty planId, and
          // loading the plan through it false-reports "Purchase plan is blank". The gates load the
          // plan through the system companion column planLineRefBill. The refLine relationship always
          // brings it, and the approve_plan entry gate plan_order_lines_carry_plan_lines already
          // guarantees every line carries planLineRef. refFilter here still narrows the planId dropdown to the same rule.
          refFilter: { status: "approved", warehouseId: { from: "$bill.warehouseId" } },
          defaultFrom: { header: "purchasePlanId" },
        },
        // planLineRef: the order line's refLine back to the source plan line. The convert-to-order
        // push pairs this-time quantity on this column. preconditions, refDefault, lookup, and
        // related_agg all use it as the coordinate.
        // refOwner must point at the dedicated companion column planLineRefBill, not at the
        // user-entered column planId. refLinePairs marks the column refOwner points at as a
        // companion ref, so isSystemSupplied=true and the user can no longer write that column.
        // planId is chosen by the user and must never be a companion column.
        // Do not add plannerSupplied. It sets isSystemSupplied=true, and push then skips the whole
        // column in pushLineValues. A refLine back to the source module is supposed to be filled
        // by the push with the source line id. After the skip the draft line's planLineRef is empty,
        // pushBillLines cannot find a matching line, and it reports "Lines to order this time, row N,
        // Order this time has no matching line on the push draft".
        // planId is already kept from being mistaken for a companion by the explicit refOwner, which
        // has nothing to do with plannerSupplied. This workspace also has no Planner whose target is
        // a purchase order, so plannerSupplied would have no producer and would only be a burden.
        {
          key: "planLineRef",
          label: "Plan line",
          type: "refLine",
          ref: "purchasePlan",
          through: "lines",
          refOwner: "planLineRefBill",
          hidden: true,
        },
        // planLineRefBill: the dedicated header companion of planLineRef. Storage writes it from
        // the refLine ownership, and it stores the plan document id (the same value as planId).
        // The column exists so the related-documents panel can look up by document id.
        // Do not add plannerSupplied. It is filled by the refOwner companion mechanism
        // (refLinePairs), not supplied directly by a planner. Adding it only hits the codegen
        // branch plannerSupplied → NOT NULL and makes the column non-null. The planId it mirrors
        // is currently optional, real rows contain null, and a NOT NULL migration will fail
        // (it was patched by hand in tables before, and every gen:db put the failure back).
        // Companion identity already makes isSystemSupplied=true (the user cannot write it).
        // When planId becomes required again, restore this column with required: true, not plannerSupplied.
        {
          key: "planLineRefBill",
          label: "Plan that owns the plan line",
          type: "ref",
          ref: "purchasePlan",
          hidden: true,
        },
        {
          key: "productId",
          label: "Product",
          type: "ref",
          ref: "product",
          required: true,
          // No plan: an active product. A plan is attached: narrow further to the product on that plan line.
          // An empty line scope is skipped, not left pending. Otherwise a hand-entered order would be forced to pick a plan first.
          refFilter: {
            status: "active",
            id: { from: "$line.planId", through: "lines", field: "productId" },
          },
          refDefault: { from: "purchasePlan", match: "planLineRef", through: "lines", field: "productId" },
        },
        {
          key: "unit",
          label: "Unit",
          type: "enum",
          required: true,
          refDefault: { from: "purchasePlan", match: "planLineRef", through: "lines", field: "unit" },
          unitChoice: { match: "productId", factorInto: "unitFactor" },
          pushFrom: "unit",
        },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        {
          key: "qty",
          label: "Purchase quantity",
          type: "number",
          required: true,
          // Quantity still to order is a formula on the plan line. It has no column, so refDefault cannot point at it.
          // The push covers this-time quantity from the plan edge remaining + billLines (default is still-to-order, and it may be reduced).
          help: "When turned from a plan, this defaults to the quantity still to order and may be reduced. Quantity not yet converted stays on the plan for next time",
        },
        {
          key: "baseQty",
          label: "Purchase quantity (primary unit)",
          type: "number",
          calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] },
        },
        { key: "taxPrice", label: "Tax-inclusive price", type: "money", required: true },
        {
          key: "baseUnitPrice",
          label: "Tax-inclusive price (primary unit)",
          type: "money",
          calculate: { op: "div", args: [{ field: "taxPrice" }, { field: "unitFactor" }] },
        },
        {
          // Purchasing quotes tax-inclusive prices and deducts input tax. The buyer must be able to see how much this order can deduct at order time.
          // Name it by the business meaning. Do not copy the reference workspace: its DB column is tax_amount_excl ("amount excl. tax"),
          //    but it stores the tax amount, and the column header also says "Tax". A column name with the opposite meaning, copied back,
          //    would only make the two systems unable to talk to each other. Here taxAmount = tax, netAmount = amount excl. tax.
          key: "taxRate",
          label: "Tax rate %",
          type: "percent",
          help: "Enter a percent. 13% is 13. Blank is treated as 0 (no deduction)",
        },
        { key: "planArrivalDate", label: "Planned arrival date", type: "date", required: true },
        {
          key: "planLineBaseQty",
          label: "Planned quantity (primary unit)",
          type: "number",
          derive: { kind: "lookup", from: "purchasePlan", through: "lines", match: "planLineRef", field: "baseQty" },
        },
        {
          key: "amount",
          label: "Amount incl. tax",
          type: "money",
          help: "Purchase quantity × tax-inclusive price",
          derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "taxPrice" }] } },
        },
        {
          key: "taxAmount",
          label: "Tax",
          type: "money",
          help: "Amount incl. tax − amount incl. tax ÷ (1 + tax rate % / 100). A blank tax rate is 0, and the tax is then 0",
          derive: {
            kind: "formula",
            expr: {
              op: "sub",
              args: [
                { field: "amount" },
                {
                  op: "div",
                  args: [
                    { field: "amount" },
                    {
                      op: "add",
                      args: [
                        { value: 1 },
                        // 🔴 orElse must wrap the denominator side. When the tax rate is blank the denominator must be 1,
                        // not let evaluation throw on "field has no value". That would make a whole old order fail to open.
                        { op: "div", args: [{ orElse: { of: { field: "taxRate" }, whenEmpty: 0 } }, { value: 100 }] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          key: "netAmount",
          label: "Amount excl. tax",
          type: "money",
          help: "Amount incl. tax − tax",
          derive: {
            kind: "formula",
            expr: { op: "sub", args: [{ field: "amount" }, { field: "taxAmount" }] },
          },
        },
        {
          key: "receivedBaseQty",
          label: "Received quantity (primary unit)",
          type: "number",
          help: "Rolled up from received purchase receipts by order line. It cannot be edited by hand",
          derive: {
            kind: "rollup",
            from: "purchaseReceipt",
            through: "lines",
            match: "orderLineId",
            measure: "sum(baseQty)",
            where: { status: "received" },
          },
        },
        {
          key: "occupyingBaseQty",
          label: "Released quantity (primary unit)",
          type: "number",
          hidden: true,
          help: "This-time quantity on receipts pending review plus receipts already received. Unconfirmed quantity also holds what is still to receive, so two receipts in a row cannot fill the same remainder",
          derive: {
            kind: "rollup",
            from: "purchaseReceipt",
            through: "lines",
            match: "orderLineId",
            measure: "sum(baseQty)",
            where: { status: ["pendingReview", "received"] },
          },
        },
        {
          key: "remainingReceiveBaseQty",
          label: "Quantity still to receive (primary unit)",
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
          key: "receivedQty",
          label: "Received",
          type: "number",
          help: "Shown in the business unit selected on this order line",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "receivedBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          key: "occupyingQty",
          label: "Released",
          type: "number",
          help: "Quantity on this line already held by a receipt pending review or a received receipt, shown in this line's unit",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "occupyingBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          key: "remainingReceiveQty",
          label: "Quantity still to receive",
          type: "number",
          help: "Still to receive = purchase quantity − released (including receipts pending review). Receive this time defaults to this cell and may be less",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "remainingReceiveBaseQty" }, { field: "unitFactor" }] } },
        },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pending review. Do not set editable: "none". Pending review must be editable, or the form cannot be filled.
      // Pending review is writable by default (full). After approval, a whitelist while awaiting receipt still locks commercial terms.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      { key: "awaitingReceipt", label: "awaitingReceipt", color: "blue", editable: "whitelist", editableFields: ["remark"] },
      { key: "receiving", label: "receiving", color: "purple", editable: "whitelist", editableFields: ["remark"] },
      { key: "completed", label: "completed", color: "green", terminal: true },
      { key: "closedOut", label: "closedOut", color: "red", terminal: true },
      // Pending review can be deleted (initial status, and it can be created by hand). A document that has taken an edge cannot.
      // There is no draft, no submit, and no withdraw. Create and push are pending review.
      // The cancel edge keeps a cancelled record and is not merged with closed. Closed is an early stop after approval
      // (`close` is in reverseOn of the ap reserve posted by approve, and taking it releases the exposure).
      // Cancelled means the document never took effect and never held any money. After merging them, the "closed orders"
      // bucket would hold two different facts, and a report could not tell them apart.
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "approve",
        from: "pendingReview",
        to: "awaitingReceipt",
        action: "Approve",
        primary: true,
        effects: [
          {
            target: "ap",
            op: "reserve",
            subject: "$bill.supplierId",
            amount: "{totalAmount}",
            reverseOn: ["unapprove", "finish", "close"],
          },
        ],
      },
      {
        code: "approve_plan",
        from: "pendingReview",
        to: "awaitingReceipt",
        action: "Approve against purchase plan",
        effects: [
          {
            target: "ap",
            op: "reserve",
            subject: "$bill.supplierId",
            amount: "{totalAmount}",
            reverseOn: ["unapprove", "finish", "close"],
          },
        ],
      },
      { code: "unapprove", from: "awaitingReceipt", to: "pendingReview", action: "Unapprove" },
      {
        code: "receive",
        from: "awaitingReceipt",
        to: "receiving",
        action: "Receive",
        primary: true,
        push: "purchaseReceipt",
        remaining: "lines.remainingReceiveQty",
        params: [receiveLinesParam],
      },
      {
        code: "receive",
        from: "receiving",
        to: "receiving",
        action: "Receive",
        primary: true,
        push: "purchaseReceipt",
        remaining: "lines.remainingReceiveQty",
        params: [receiveLinesParam],
      },
      { code: "finish", from: "receiving", to: "completed", action: "Finish" },
      { code: "close", from: "awaitingReceipt", to: "closedOut", action: "Close order" },
      { code: "close", from: "receiving", to: "closedOut", action: "Close order" },
      // A pending-review document whose push wrote lineage cannot be deleted at runtime
      // (`purchasePlan.to_order` pushes into this module). The push writes one `oe_reference`,
      // and the lineage branch of `billRepo.assertRemovable` refuses deletion forever
      // (lineage only grows). A pending-review document created by hand can be deleted. One that has taken an edge cannot.
      // `approve` sits behind a string of block-level gates, so an empty push created by mistake cannot be approved.
      // The cancel edge therefore stays. The way out cannot be a looser approve. It can only be an edge that carries no business fact.
      //
      // It does not move the reachability gate on the ap reserve posted by `approve` / `approve_plan`.
      // That gate starts at "arrives at awaitingReceipt" and walks around reverseOn (unapprove / finish / close).
      // The only statuses it can reach are awaitingReceipt and receiving. It cannot reach cancel.
      // unapprove is in reverseOn. Taking it releases the exposure first, then returns to pending review.
      // `confirm: true` cannot be omitted. This edge has zero effects, so it does not get the free confirm from `postsToLedger`.
      // Leaving it out means one mis-click drives the document into a terminal status.
      { code: "cancel", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },

  preconditions: [
    {
      id: "lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "With no purchase lines there is no purchase fact to approve. An empty order cannot hold a supplier payable commitment",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "qty_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Purchase quantity must be positive. A return uses its own return document, not a negative number on the order",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "price_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A tax-inclusive price of zero or less makes the purchase-commitment amount meaningless",
      check: { primitive: "lines_all", left: { ref: "$line.taxPrice" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "supplier_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "An order with no supplier cannot be approved and cannot hold a payable commitment",
      check: { primitive: "required_fields", fields: ["supplierId"] },
    },
    {
      id: "arrival_date_sane",
      onTransition: "approve",
      source: "gate",
      level: "warn",
      message: "A line has a planned arrival date earlier than the purchase date. Confirm it.",
      why: "An inverted date can be legal when back-entering a historical purchase, but it usually means the plan was entered wrong, so the operator must confirm",
      check: { primitive: "lines_all", left: { ref: "$line.planArrivalDate" }, op: "gte", right: { ref: "$bill.purchaseDate" } },
    },
    {
      id: "plan_orders_use_plan_approval",
      onTransition: "approve",
      source: "invariant",
      level: "route",
      exit: "approve_plan",
      message: "Lines on this document are linked to purchase-plan lines. Use Approve against purchase plan (it checks plan status, warehouse, product, and the cumulative quantity)",
      why:
        "An order that consumes purchase-plan quantity must take the approval edge that checks plan status, product, warehouse, and the quantity cap. It cannot slip past the source gate on the manual approval edge." +
        "The criterion is a structural fact (whether the line is linked to a plan line), not the self-reported sourceType. " +
        "The two cells are independent. A hand-built order with sourceType='Manual' can still attach planLineRef through the plan-line picker, " +
        "and it would then pass this edge, which has no cumulative gate. The purchasePlan.orderedQty rollup matches only planLineRef and ignores sourceType, " +
        "so it still counts toward quantity ordered. The plan is over-purchased, and the verdict stays pass the whole way",
      check: {
        primitive: "lines_all",
        left: { ref: "$line.planLineRef" },
        op: "eq",
        right: { value: null },
      },
    },
    {
      id: "supplier_active",
      onTransition: "approve",
      source: "gate",
      level: "block",
      why: "A disabled supplier cannot take on a new purchase commitment. Approval checks again so a status change during drafting is covered",
      check: {
        primitive: "ref_field_compare",
        via: "supplierId",
        entity: "supplier",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
    {
      id: "plan_order_lines_carry_plan_lines",
      onTransition: "approve_plan",
      source: "invariant",
      level: "block",
      message: "Some lines are not linked to a purchase-plan line. Split into two documents: lines that consume plan quantity use Approve against purchase plan, and the rest use Approve",
      why:
        "Every gate on the plan-approval edge (plan status, matching product, matching warehouse, plan quantity cap) is coordinated by which plan line this line came from. " +
        "A line with no source makes those gates fail open for that line, and it still enters quantity ordered. This is the other face of the same structural rule as plan_orders_use_plan_approval: " +
        "all empty takes manual approval, all linked takes plan approval, and a mix must be split first",
      check: {
        primitive: "lines_all",
        left: { ref: "$line.planLineRef" },
        op: "ne",
        right: { value: null },
      },
    },
    {
      id: "plan_supplier_active",
      onTransition: "approve_plan",
      source: "gate",
      level: "block",
      why: "A plan-sourced order must also recheck supplier status at approval. The dedicated approval edge cannot bypass supplier admission",
      check: {
        primitive: "ref_field_compare",
        via: "supplierId",
        entity: "supplier",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
    {
      id: "plan_order_sources_approved",
      onTransition: "approve_plan",
      source: "invariant",
      level: "block",
      why: "Every line of a plan-sourced order must carry an approved purchase plan that is not yet completed or closed",
      // The coordinate is planLineRefBill (the header companion of planLineRef), not the user-entered planId.
      // planId has been temporarily optional since fd0b0769 and hidden since 7b4b9335. On a pushed order line it may be empty.
      // Reading planId then hits the "not filled" empty-reference branch and blocks a legal plan order on approve_plan.
      // planLineRefBill is system-supplied from the refLine ownership, holds the same value as planId, and the approve_plan
      // entry gate plan_order_lines_carry_plan_lines already guarantees every line has planLineRef, so the companion column has a value.
      check: {
        primitive: "ref_field_compare",
        via: "$line.planLineRefBill",
        entity: "purchasePlan",
        through: null,
        field: "status",
        op: "eq",
        right: { value: "approved" },
      },
    },
    {
      id: "plan_order_warehouses_match_plans",
      onTransition: "approve_plan",
      source: "invariant",
      level: "block",
      why: "The receiving warehouse on a plan-sourced order must match every purchase plan. The same plan must not silently change warehouse at execution",
      // Same coordinate as plan_order_sources_approved: the planLineRefBill companion, not the optional hidden planId.
      check: {
        primitive: "ref_field_compare",
        via: "$line.planLineRefBill",
        entity: "purchasePlan",
        through: null,
        field: "warehouseId",
        op: "eq",
        right: { ref: "$bill.warehouseId" },
      },
    },
    {
      id: "plan_order_products_match_plan_lines",
      onTransition: "approve_plan",
      source: "invariant",
      level: "block",
      why: "The order product must match the source plan line. The plan-line reference cannot be kept while purchasing a different product",
      check: {
        primitive: "ref_field_compare",
        via: "$line.planLineRef",
        entity: "purchasePlan",
        through: "lines",
        field: "productId",
        op: "eq",
        right: { ref: "$line.productId" },
      },
    },
    {
      id: "plan_order_qty_within_plan_lines",
      onTransition: "approve_plan",
      source: "gate",
      level: "block",
      why: "Cumulative effective purchase quantity on one plan line cannot exceed the planned quantity. Closed orders leave the cumulative measure",
      check: {
        primitive: "related_agg",
        from: "purchaseOrder",
        through: "lines",
        match: "planLineRef",
        on: "$line.planLineRef",
        agg: "sum",
        measure: "baseQty",
        where: { status: ["awaitingReceipt", "receiving", "completed"] },
        op: "lte",
        right: { ref: "$line.planLineBaseQty" },
        plus: { ref: "$line.baseQty" },
      },
    },
    {
      id: "receive_has_remaining",
      onTransition: "receive",
      source: "gate",
      level: "block",
      message: "Every line has already been released to a receipt or is fully received, so it cannot be received again",
      why: "Pushing when nothing remains to receive only produces an empty document or an over-allocation",
      check: {
        primitive: "lines_any",
        left: { ref: "$line.remainingReceiveQty" },
        op: "gt",
        right: { value: 0 },
      },
    },
  ],

  handoff: [
    {
      id: "notify_approver",
      kind: "todo",
      onStatus: "pendingReview",
      to: "procurement-manager",
      title: "A purchase order is pending review",
      why: "A purchase commitment holds supplier payable exposure, so someone must explicitly own the approval",
    },
    {
      id: "notify_receiver",
      kind: "todo",
      onStatus: "awaitingReceipt",
      to: "warehouse-clerk",
      title: "A purchase order is waiting to be received",
      why: "The warehouse needs to prepare receipt against the planned arrival date, so a purchase commitment is not left with nobody to receive it",
    },
    {
      id: "notify_finance",
      kind: "notify",
      onTransition: "finish",
      to: "finance",
      title: "Purchase order finished. The commitment is released",
      why: "Releasing a purchase commitment changes supplier payable exposure, and finance needs to know about this status change",
    },
  ],

  views: {
    list: {
      columns: [
        "code",
        "sourceType",
        "sourceNo",
        "purchasePlanId",
        "salesOrderId",
        "purchaseDate",
        "supplierId",
        "warehouseId",
        "totalAmount",
      ],
      // The reference shows only the purchase-order number. Without this pin, labelFieldsOf appends the
      // second list column sourceType, and the purchase order on a payable edit becomes "CG-… Manual".
      referenceLabel: ["code"],
      filters: ["status", "supplierId", "warehouseId", "buyer", "sourceType", "salesOrderId", "purchasePlanId"],
      searchable: ["code", "sourceNo", "buyer"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      {
        title: "Source and basics",
        fields: [
          "code",
          "sourceType",
          "sourceNo",
          "salesOrderId",
          "purchaseDate",
          "buyer",
          "supplierId",
          "warehouseId",
          "purchasePlanId",
        ],
      },
      { title: "Purchase lines", fields: ["lines"] },
      {
        title: "Amounts and receipt progress",
        fields: ["totalAmount", "totalTaxAmount", "totalNetAmount"],
      },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
