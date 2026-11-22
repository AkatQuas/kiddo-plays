import { defineModule } from "@open-erp/metamodel";
export { planners } from "./confirmPlanner.ts";

export default defineModule({
  label: "Receive subcontract",
  numbering: { prefix: "SCRCV", seqScope: "day" },
  fields: [
    { key: "code", label: "Receipt no.", type: "string", primary: true, auto: true },
    // Same shape as a subcontract issue: the header holds the order, and the production task is on the line. One subcontract order can cover several tasks,
    // so one receipt can also take finished goods for several tasks.
    { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", required: true },
    { key: "supplierId", label: "Subcontract supplier", type: "ref", ref: "supplier", required: true },
    { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse", required: true, refDefault: { from: "subcontractOrder", match: "orderId", through: null, field: "receiptWarehouseId" } },
    { key: "receiptDate", label: "Receipt date", type: "date", createDefault: "today" },
    {
      key: "lines",
      label: "Receipt lines",
      type: "subtable",
      ref: "subcontractReceiptLine",
      fields: [
        // Receipt progress has to land on the specific subcontract line. Summing only by productionTaskId would pull in
        // other subcontract orders and other operations on the same task.
        { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", required: true },
        { key: "orderLineId", label: "Subcontract order line", type: "refLine", ref: "subcontractOrder", through: "lines" },
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
        { key: "processLineId", label: "Operation line", type: "string" },
        { key: "operationName", label: "Operation name", type: "string" },
        { key: "productId", label: "Finished goods", type: "ref", ref: "product", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productId" } },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "qty", label: "Receipt quantity", type: "number", required: true, refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "plannedQty" } },
        { key: "qualifiedQty", label: "Qualified quantity", type: "number" },
        { key: "defectQty", label: "Defect quantity", type: "number" },
        { key: "defectDeduction", label: "Defect deduction", type: "money" },
        // A line cannot nest another subtable: a multi-select of defect reasons is stored as a JSON string, for the record only.
        { key: "defectTypeIds", label: "Defect reason", type: "string" },
        { key: "baseQty", label: "Receipt quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "taskBaseQty", label: "Task quantity in main unit", type: "number", derive: { kind: "lookup", from: "productionTask", through: null, match: "productionTaskId", field: "basePlannedQty" } },
        { key: "taxPrice", label: "Tax-inclusive process price", type: "money", required: true, pushFrom: "taxPrice" },
        { key: "baseUnitPrice", label: "Tax-inclusive process price in main unit", type: "money", calculate: { op: "div", args: [{ field: "taxPrice" }, { field: "unitFactor" }] } },
        { key: "amount", label: "Process amount payable", type: "money", derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "taxPrice" }] } } },
        { key: "batchNo", label: "Lot number", type: "string" },
      ],
    },
    { key: "totalAmount", label: "Process amount payable", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
    { key: "requestedBaseQty", label: "Requested quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(baseQty)" } },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      // Create and push start at awaiting receipt. Do not set editable: "none": awaiting receipt must stay editable, or the form cannot be filled.
      { key: "awaitingReceipt", label: "awaitingReceipt", color: "amber", initial: true },
      { key: "received", label: "received", color: "green", editable: "whitelist", editableFields: ["remark"] },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "confirm",
        from: "awaitingReceipt",
        to: "received",
        action: "Confirm goods receipt",
        primary: true,
        effects: [
          { target: "stock", op: "in", subject: "$line.productId", scope: "$bill.warehouseId", amount: "{$line.baseQty}", reverseOn: [] },
          { target: "ap", op: "in", subject: "$bill.supplierId", amount: "{totalAmount}", reverseOn: [] },
        ],
      },
      // The order's receive dialog confirms in one step. confirm already has a planner, so it cannot nest setStatus.
      // After the work-report commands are flattened into the order plan, this edge moves the status and posts stock and payables.
      {
        code: "syncConfirm",
        from: "awaitingReceipt",
        to: "received",
        action: "Sync confirm receipt",
        internal: true,
        effects: [
          { target: "stock", op: "in", subject: "$line.productId", scope: "$bill.warehouseId", amount: "{$line.baseQty}", reverseOn: [] },
          { target: "ap", op: "in", subject: "$bill.supplierId", amount: "{totalAmount}", reverseOn: [] },
        ],
      },
      { code: "create_return", from: "received", to: "received", action: "Push subcontract return", push: "subcontractReturn" },
      { code: "cancel", from: "awaitingReceipt", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    { id: "lines_required", onTransition: "confirm", source: "invariant", level: "block", why: "The receipt must list the finished goods", check: { primitive: "lines_not_empty" } },
    { id: "date_required", onTransition: "confirm", source: "invariant", level: "block", why: "An actual date is required before confirming receipt", check: { primitive: "required_fields", fields: ["receiptDate"] } },
    { id: "qty_positive", onTransition: "confirm", source: "invariant", level: "block", why: "Receipt quantity must be positive", check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } } },
    { id: "sync_lines_required", onTransition: "syncConfirm", source: "invariant", level: "block", why: "The receipt must list the finished goods", check: { primitive: "lines_not_empty" } },
    { id: "sync_date_required", onTransition: "syncConfirm", source: "invariant", level: "block", why: "An actual date is required before confirming receipt", check: { primitive: "required_fields", fields: ["receiptDate"] } },
    { id: "sync_qty_positive", onTransition: "syncConfirm", source: "invariant", level: "block", why: "Receipt quantity must be positive", check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } } },
    // There is no cumulative over-receipt gate. The product requirement is that receipt quantity is not hard-checked and may exceed the quantity still due.
  ],
  handoff: [
    { id: "notify_finance", kind: "notify", onTransition: "confirm", to: "finance", title: "Subcontract receipt completed", why: "Confirming receipt creates the payable" },
    { id: "notify_finance_sync", kind: "notify", onTransition: "syncConfirm", to: "finance", title: "Subcontract receipt completed", why: "Confirming receipt creates the payable" },
  ],
  views: {
    list: {
      columns: ["code", "orderId", "receiptDate", "supplierId", "warehouseId", "totalAmount", "status"],
      filters: ["status", "orderId", "supplierId", "warehouseId", "receiptDate"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
      // A subcontract receipt used as a reference shows only the stable document number. The receipt date is a list column.
      // Putting it in the reference label would stop an export template from matching the document number on import.
      referenceLabel: ["code"],
    },
    form: [{ title: "Receipt", fields: ["code", "orderId", "supplierId", "warehouseId", "receiptDate"] }, { title: "Receipt lines", fields: ["lines", "totalAmount"] }, { title: "Other", fields: ["remark"] }],
  },
});
