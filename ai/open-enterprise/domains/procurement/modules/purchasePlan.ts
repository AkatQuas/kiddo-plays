import { defineModule, normalizeField } from "@open-erp/metamodel";

/** Approved purchase orders that count as a commitment. Completing a plan and the over-order rollup recognize only these. Pending review is not yet a commitment. */
const APPROVED_ORDER_STATUSES = ["awaitingReceipt", "receiving", "completed"] as const;
/** Live orders that still hold quantity waiting to be ordered. Includes pending review, so two conversions in a row cannot fill the same remainder. Closed and cancelled do not hold it. */
const OCCUPYING_ORDER_STATUSES = ["pendingReview", ...APPROVED_ORDER_STATUSES] as const;

const toOrderLineField = normalizeField(
  {
    key: "orderLines",
    label: "Lines to order this time",
    type: "subtable",
    ref: "purchasePlanOrderDraftLine",
    required: false,
    help: "Each product can be ordered in part, and the rest waits for next time. Delete lines you are not ordering this time. Lines come from this plan and cannot be added by hand.",
    fields: [
      { key: "planLineRef", label: "Plan line", type: "string", required: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qtyPlanned", label: "Planned quantity", type: "number", required: true },
      { key: "occupyingQty", label: "Released", type: "number", required: true },
      { key: "remainingOrderQty", label: "Quantity still to order", type: "number", required: true },
      { key: "qty", label: "Order this time", type: "number", required: true },
    ],
  },
  "purchasePlan.to_order.params.orderLines",
);

/**
 * Quantity for this conversion on the "turn into a purchase order" dialog. The pairing column
 * must be named `planLineRef`. Push pairs by the refLine column on the target lines that points
 * back at this module (`purchaseOrder.lines.planLineRef`). Another name does not pair, and the
 * symptom is "no matching line on the pushed document" (lines to order this time, row N, the
 * source line did not land on a line of this document).
 */
const toOrderLinesParam = {
  key: "orderLines",
  label: "Lines to order this time",
  type: "billLines" as const,
  required: false,
  lineField: toOrderLineField,
  // Rows are seeded from this document's lines still to order. Adding a product by hand is not allowed.
  // Deleting a row is allowed: drop the goods that are not going to this supplier this time.
  fixedRows: false,
  readOnlyColumns: ["productId", "qtyPlanned", "occupyingQty", "remainingOrderQty"],
  hiddenColumns: ["planLineRef"],
  seed: {
    from: "lines",
    columns: {
      planLineRef: "id",
      productId: "productId",
      qtyPlanned: "qty",
      occupyingQty: "occupyingQty",
      remainingOrderQty: "remainingOrderQty",
      qty: "remainingOrderQty",
    },
    skipNonPositive: "remainingOrderQty",
  },
};

/** A purchase plan only states demand. The quantity actually ordered is rolled up from purchase-order lines. */
export default defineModule({
  label: "Purchase plan",
  numbering: { prefix: "PP", seqScope: "day" },

  fields: [
    { key: "code", label: "Plan no.", type: "string", primary: true, auto: true },
    {
      key: "planDate",
      label: "Plan date",
      type: "date",
      required: true,
      // Pushed from a material requirement, this starts as the required date. The buyer may change it while pending approval.
      pushFrom: "requiredDate",
    },
    {
      key: "planStartDate",
      label: "Plan start",
      type: "date",
      help: "Start of the purchasing window. Together with Planned arrival date on the line it says when to start preparing material and when it must arrive",
    },
    {
      key: "buyer",
      label: "Buyer",
      type: "ref",
      ref: "subject",
      refFilter: { status: "active" },
      // Not required: true. It is optional, and approve/resubmit hang required_fields on it.
      // A push from a material requirement does not know who will buy, so pending approval must
      // be able to save. A buyer must be named before approval, or the todo after approval has
      // nobody to receive it. The plan no longer has a supplier field. Do not invent a placeholder buyer.
      help: "The person who will execute this plan. It may be empty while pending approval, and it must be set before approval",
      person: { role: "receiver", via: "self" },
    },
    { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse", required: true, pushFrom: "issueWarehouseId" },
    {
      key: "materialRequirementId",
      label: "Source material requirement",
      type: "ref",
      ref: "materialRequirement",
      help: "Filled automatically when pushed from a production material requirement. A plan created by hand may leave it empty",
    },
    {
      key: "lines",
      label: "Plan lines",
      type: "subtable",
      ref: "purchasePlanLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true, refFilter: { status: "active" }, pushFrom: "componentProductId" },
        { key: "unit", label: "Unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" }, pushFrom: "unit" },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "qty", label: "Planned quantity", type: "number", required: true, pushFrom: "requiredQty" },
        {
          key: "baseQty",
          label: "Planned quantity (primary unit)",
          type: "number",
          calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] },
        },
        { key: "planArrivalDate", label: "Planned arrival date", type: "date", required: true, pushFrom: "requiredDate" },
        {
          key: "orderedBaseQty",
          label: "Ordered quantity (primary unit)",
          type: "number",
          help: "Sum of approved purchase orders by plan line. Pending review does not count. Completing the plan reads only this cell",
          derive: {
            kind: "rollup",
            from: "purchaseOrder",
            through: "lines",
            match: "planLineRef",
            measure: "sum(baseQty)",
            where: { status: [...APPROVED_ORDER_STATUSES] },
          },
        },
        {
          key: "occupyingBaseQty",
          label: "Released quantity (primary unit)",
          type: "number",
          hidden: true,
          help: "This-time quantity on unapproved orders plus approved orders. An unapproved order also holds quantity still to order, so two conversions in a row cannot fill the same remainder",
          derive: {
            kind: "rollup",
            from: "purchaseOrder",
            through: "lines",
            match: "planLineRef",
            measure: "sum(baseQty)",
            where: { status: [...OCCUPYING_ORDER_STATUSES] },
          },
        },
        {
          key: "remainingOrderBaseQty",
          label: "Quantity still to order (primary unit)",
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
          help: "Quantity on this line already held by an unapproved or approved order, shown in this line's unit",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "occupyingBaseQty" }, { field: "unitFactor" }] } },
        },
        {
          key: "remainingOrderQty",
          label: "Quantity still to order",
          type: "number",
          help: "Still to order = planned quantity − released (including unapproved orders). Order this time defaults to this cell and may be less",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "remainingOrderBaseQty" }, { field: "unitFactor" }] } },
        },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pending approval. Do not set editable: "none". Pending approval must be editable,
      // or the form cannot be filled and a buyer cannot be added after a material-requirement push.
      // Pending approval is writable by default (full).
      { key: "pendingApproval", label: "pendingApproval", color: "amber", initial: true },
      // Reject must not land back on pendingApproval. A plan that was never approved and a plan sent
      // back for correction are different work. Mixed on one list they cannot be filtered apart.
      // The reject reason stays in oe_audit_log (the reject edge parameter). The document does not store a second copy.
      { key: "rejected", label: "rejected", color: "red", editable: "full" },
      { key: "approved", label: "approved", color: "blue", editable: "whitelist", editableFields: ["remark"] },
      { key: "completed", label: "completed", color: "green", terminal: true },
      { key: "closedOut", label: "closedOut", color: "red", terminal: true },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      // Pending approval can be deleted (initial status, and it can be created by hand). A document that has taken an edge cannot.
      // There is no draft, no submit-for-approval, and no withdraw. Create is pending approval.
      // A push that wrote lineage still cannot be deleted at runtime, so the cancel edge stays.
      { code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel", confirm: true },
      {
        code: "reject",
        from: "pendingApproval",
        to: "rejected",
        action: "Reject",
        confirm: true,
        params: [{ key: "reason", label: "Reject reason", type: "text", required: true }],
      },
      { code: "resubmit", from: "rejected", to: "pendingApproval", action: "Resubmit after correction", primary: true },
      { code: "abandon", from: "rejected", to: "closedOut", action: "Abandon this demand", confirm: true },
      { code: "approve", from: "pendingApproval", to: "approved", action: "Approve", primary: true },
      {
        // A self-loop. Splitting one plan into several orders by supplier is normal, and one
        // conversion must not take the plan off approved. Same shape as the receive edge while a
        // purchase order is receiving (self-loop + push, no effects).
        // When the plan is finished is decided explicitly by `finish`. The criterion is `fully_ordered` (every line is fully ordered).
        code: "to_order",
        from: "approved",
        to: "approved",
        action: "Turn into purchase order",
        primary: true,
        push: "purchaseOrder",
        remaining: "lines.remainingOrderQty",
        params: [toOrderLinesParam],
        // Two source facts cannot come from a cell on the plan. Source type is inherent to this
        // edge (it is not copied from a plan field). The plan has no tax-inclusive price, so 0 is
        // a placeholder and the target module's `price_positive` rejects it at approval in business language.
        pushDefaults: { sourceType: "Purchase plan", "lines.taxPrice": 0 },
      },
      {
        // The primary button belongs to to_order. The daily action on an approved plan is to turn it into an order.
        // Complete is the close-out after the demand has all landed.
        code: "finish",
        from: "approved",
        to: "completed",
        action: "Complete plan",
      },
      { code: "close", from: "approved", to: "closedOut", action: "Close plan" },
    ],
  },

  preconditions: [
    {
      id: "lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A purchase plan with no lines has no demand that can be executed, so it cannot be approved",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "qty_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Purchase demand must be a positive number. Zero or a negative number creates a plan with no business meaning",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "buyer_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Approval must name a buyer. Otherwise the todo after approval has no owner, and the plan sits in the gap after approval",
      check: { primitive: "required_fields", fields: ["buyer"] },
    },
    // Resubmit after correction and approve must use the same entry gates, one for one.
    // Missing one lets a plan whose lines were deleted travel from rejected back to pending approval.
    {
      id: "resubmit_lines_required",
      onTransition: "resubmit",
      source: "invariant",
      level: "block",
      why: "Resubmit after correction and approve must use the same entry gates. Empty lines still cannot enter approval",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "resubmit_qty_positive",
      onTransition: "resubmit",
      source: "invariant",
      level: "block",
      why: "Resubmit after correction also requires positive demand. The reject path cannot be used to send zero or negative demand into approval",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "resubmit_buyer_required",
      onTransition: "resubmit",
      source: "invariant",
      level: "block",
      why: "Resubmit after correction and approve must use the same entry gates. The reject path cannot be used to send a plan with no buyer into approval",
      check: { primitive: "required_fields", fields: ["buyer"] },
    },
    {
      id: "has_orderable_line",
      onTransition: "to_order",
      source: "gate",
      level: "block",
      message: "Every plan line has already been released to a purchase order, so it cannot be converted again",
      why: "Turning into an order consumes remaining demand. Converting when nothing is left only produces an empty unapproved order or an over-allocation",
      check: {
        primitive: "lines_any",
        left: { ref: "$line.remainingOrderQty" },
        op: "gt",
        right: { value: 0 },
      },
    },
    {
      id: "fully_ordered",
      onTransition: "finish",
      source: "gate",
      level: "block",
      // Same shape as purchaseOrder.fully_received. Without a message the user reads the
      // self-describing text "every line's ordered quantity must be at least the planned quantity".
      // That sentence looks like an entry check, and ordered quantity is a rollup the form cannot
      // edit, so the person goes looking for an input that does not exist.
      message: "Some lines have not all been turned into purchase orders. Continue with Turn into purchase order, or Close plan to end this demand",
      why: "Completing a plan means the demand has all become effective purchase orders. Quantity not yet ordered must not be hidden by a status word",
      check: { primitive: "lines_all", left: { ref: "$line.orderedBaseQty" }, op: "gte", right: { ref: "$line.baseQty" } },
    },
  ],

  handoff: [
    {
      id: "notify_buyer",
      kind: "todo",
      onStatus: "approved",
      to: "buyer",
      title: "Purchase plan approved. Turn it into a purchase order",
      why: "After a plan is approved someone must own the purchasing, or the demand sits in the gap after approval",
    },
    {
      id: "notify_planner",
      kind: "notify",
      onTransition: "finish",
      to: "procurement-manager",
      title: "Purchase plan completed",
      why: "Closing a plan is the summary fact of purchase execution. The manager needs to know the demand has all been turned into orders",
    },
  ],

  views: {
    list: {
      columns: [
        "code",
        "planDate",
        "planStartDate",
        "buyer",
        "warehouseId",
      ],
      // The reference shows only the plan number. Without this pin, labelFieldsOf appends the
      // second list column planDate, and the purchase order's linked plan becomes "JH-… 2026-09-08".
      referenceLabel: ["code"],
      filters: ["status", "buyer", "warehouseId"],
      searchable: ["code", "buyer"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      {
        title: "Plan",
        fields: ["code", "planDate", "planStartDate", "buyer", "warehouseId", "materialRequirementId"],
      },
      { title: "Plan lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
