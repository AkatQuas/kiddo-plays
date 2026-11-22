import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Subcontract return",
  numbering: { prefix: "SCRET", seqScope: "day" },
  fields: [
    { key: "code", label: "Goods return no.", type: "string", primary: true, auto: true },
    { key: "receiptId", label: "Subcontract receipt", type: "ref", ref: "subcontractReceipt", required: true },
    // The production task lives only on the line (the receipt header no longer has one): one receipt can take finished goods for several tasks,
    // and only the line can say which task each returned row belongs to.
    { key: "supplierId", label: "Subcontract supplier", type: "ref", ref: "supplier", snapshot: { from: "subcontractReceipt", match: "receiptId", through: null, field: "supplierId" } },
    { key: "warehouseId", label: "Return warehouse", type: "ref", ref: "warehouse", required: true, refDefault: { from: "subcontractReceipt", match: "receiptId", through: null, field: "warehouseId" } },
    { key: "returnDate", label: "Return date", type: "date", createDefault: "today" },
    {
      key: "lines",
      label: "Return lines",
      type: "subtable",
      ref: "subcontractReturnLine",
      fields: [
        { key: "receiptId", label: "Subcontract receipt", type: "ref", ref: "subcontractReceipt", required: true },
        { key: "receiptLineId", label: "Subcontract receipt line", type: "refLine", ref: "subcontractReceipt", through: "lines", required: true },
        { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", snapshot: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "orderId" } },
        { key: "orderLineId", label: "Subcontract order line", type: "refLine", ref: "subcontractOrder", through: "lines", snapshot: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "orderLineId" } },
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", snapshot: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "productionTaskId" } },
        { key: "productId", label: "Finished goods", type: "ref", ref: "product", snapshot: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "productId" } },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "qty", label: "Return quantity", type: "number", required: true },
        { key: "baseQty", label: "Goods-return quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "receiptLineBaseQty", label: "Original receipt quantity (main unit)", type: "number", derive: { kind: "lookup", from: "subcontractReceipt", through: "lines", match: "receiptLineId", field: "baseQty" } },
        { key: "taxPrice", label: "Tax-inclusive process price", type: "money", required: true, refDefault: { from: "subcontractReceipt", match: "receiptLineId", through: "lines", field: "taxPrice" }, pushFrom: "taxPrice" },
        { key: "baseUnitPrice", label: "Tax-inclusive process price in main unit", type: "money", calculate: { op: "div", args: [{ field: "taxPrice" }, { field: "unitFactor" }] } },
        { key: "amount", label: "Payable reversal amount", type: "money", derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "taxPrice" }] } } },
        { key: "reason", label: "Return reason", type: "text" },
      ],
    },
    { key: "totalAmount", label: "Payable reversal amount", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
    { key: "requestedBaseQty", label: "Requested quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(baseQty)" } },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      // Create and push start at awaiting return. Do not set editable: "none": awaiting return must stay editable, or the form cannot be filled.
      { key: "awaitingReturn", label: "awaitingReturn", color: "amber", initial: true },
      { key: "returnedGoods", label: "returnedGoods", color: "green", terminal: true, editable: "whitelist", editableFields: ["remark"] },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "confirm", from: "awaitingReturn", to: "returnedGoods", action: "Confirm goods return", primary: true, effects: [{ target: "stock", op: "out", subject: "$line.productId", scope: "$bill.warehouseId", amount: "{$line.baseQty}", reverseOn: [] }, { target: "ap", op: "out", subject: "$bill.supplierId", amount: "{totalAmount}", reverseOn: [] }] },
      { code: "cancel", from: "awaitingReturn", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    { id: "lines_required", onTransition: "confirm", source: "invariant", level: "block", why: "A goods return must name the receipt line", check: { primitive: "lines_not_empty" } },
    { id: "date_required", onTransition: "confirm", source: "invariant", level: "block", why: "An actual date is required before confirming the goods return", check: { primitive: "required_fields", fields: ["returnDate"] } },
    { id: "qty_positive", onTransition: "confirm", source: "invariant", level: "block", why: "Return quantity must be positive", check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } } },
    { id: "receipt_posted", onTransition: "confirm", source: "gate", level: "block", why: "Only finished goods from a completed receipt can be returned", check: { primitive: "ref_field_compare", via: "receiptId", entity: "subcontractReceipt", field: "status", op: "eq", right: { value: "received" } } },
    { id: "lines_match_receipt", onTransition: "confirm", source: "invariant", level: "block", why: "Each return line must belong to the receipt on the header", check: { primitive: "lines_all", left: { ref: "$line.receiptId" }, op: "eq", right: { ref: "$bill.receiptId" } } },
    { id: "stock_available", onTransition: "confirm", source: "gate", level: "block", why: "A goods return cannot drive stock negative", check: { primitive: "available_sufficient", target: "stock", subject: "$line.productId", scope: "$bill.warehouseId", need: "$line.baseQty" } },
    { id: "not_over_return", onTransition: "confirm", source: "gate", level: "block", why: "Cumulative returns cannot exceed the received quantity", check: { primitive: "related_agg", from: "subcontractReturn", through: "lines", match: "receiptLineId", on: "$line.receiptLineId", agg: "sum", measure: "baseQty", where: { status: ["returnedGoods"] }, op: "lte", right: { ref: "$line.receiptLineBaseQty" }, plus: { ref: "$line.baseQty" } } },
  ],
  handoff: [
    { id: "notify_finance", kind: "notify", onTransition: "confirm", to: "finance", title: "Subcontract return completed", why: "Confirming the return reduces accounts payable" },
  ],
  views: {
    list: { columns: ["code", "receiptId", "returnDate", "supplierId", "warehouseId", "totalAmount", "status"], filters: ["status", "receiptId", "supplierId", "warehouseId", "returnDate"], searchable: ["code"], defaultSort: { field: "createdAt", desc: true } },
    form: [{ title: "Goods return", fields: ["code", "receiptId", "supplierId", "warehouseId", "returnDate"] }, { title: "Return lines", fields: ["lines", "totalAmount"] }, { title: "Other", fields: ["remark"] }],
  },
});
