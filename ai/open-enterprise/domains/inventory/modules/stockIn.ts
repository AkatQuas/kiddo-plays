import { defineModule } from "@open-erp/metamodel";


export default defineModule({
  label: "Stock in",
  numbering: { prefix: "SI", seqScope: "day" },
  fields: [
    { key: "code", label: "Stock-in no.", type: "string", primary: true, auto: true },
    /**
     * Bound to the choice set, not three hardcoded options.
     *
     * This cell used to be static `options`, while the `inventory.stockInType` dictionary
     * already existed — the list filter reads that dictionary. An operator could add
     * "Raw material receipt" and see it in the filter but not in the create dialog. Each
     * side looked fine on its own.
     *
     * Switching is a zero-data migration: the old values (inventoryGain / sampleReturn / other)
     * are character-for-character the dictionary codes, so the database already stored those codes.
     */
    { key: "type", label: "Stock-in type", type: "enum", choiceSet: "inventory.stockInType", required: true },
    { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse", required: true },
    {
      key: "applicant",
      label: "Applicant",
      type: "string",
      required: true,
      person: { role: "receiver", via: "self" },
    },
    { key: "applyTime", label: "Applied on", type: "date", createDefault: "today" },
    { key: "productionReceiptId", label: "Source completion receipt", type: "ref", ref: "productionReceipt", hidden: true },
    {
      key: "productionTaskId",
      label: "Production task",
      type: "ref",
      ref: "productionTask",
      refFilter: { status: ["inProduction", "completed"] },
      help: "Required when the stock-in type is production completion receipt. Other stock-in types leave it empty.",
    },
    {
      key: "lines",
      label: "Stock-in lines",
      type: "subtable",
      ref: "stockInLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "productCode", label: "Product code", type: "string", snapshot: { from: "product", match: "productId", field: "code" } },
        { key: "productName", label: "Product name", type: "string", snapshot: { from: "product", match: "productId", field: "name" } },
        { key: "unit", label: "Unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number", hidden: true },
        { key: "quantity", label: "Stock-in quantity", type: "number", required: true },
        { key: "baseQty", label: "Primary-unit stock-in quantity", type: "number", hidden: true, calculate: { op: "mul", args: [{ field: "quantity" }, { field: "unitFactor" }] } },
        { key: "batchNo", label: "Batch no.", type: "string", help: "Recorded only. It does not enter the stock calculation. The ledger coordinate stops at the warehouse, and stock by batch is not supported yet" },
        { key: "remark", label: "Remarks", type: "text" },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      // Created as pending review. Do not set editable: "none". Pending review must be editable, or the form cannot be filled.
      { key: "pending", label: "pendingReview", color: "amber", initial: true },
      { key: "approved", label: "reviewed", color: "green", editable: "none" },
      { key: "voided", label: "voided", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "approve",
        from: "pending",
        to: "approved",
        action: "Approve",
        primary: true,
        effects: [
          {
            target: "stock",
            op: "in",
            subject: "$line.productId",
            scope: "$bill.warehouseId",
            amount: "{$line.baseQty}",
            reverseOn: ["void"],
          },
        ],
      },
      { code: "void", from: "approved", to: "voided", action: "Void", confirm: true },
    ],
  },
  preconditions: [
    {
      id: "production_task_required_for_receipt",
      onTransition: "approve",
      when: { primitive: "field_compare", left: { ref: "$bill.type" }, op: "eq", right: { value: "productionReceipt" } },
      source: "invariant",
      level: "block",
      why: "A production completion receipt must name the production task",
      check: { primitive: "required_fields", fields: ["productionTaskId"] },
    },
    {
      id: "production_receipt_product_matches_task",
      onTransition: "approve",
      when: { primitive: "field_compare", left: { ref: "$bill.type" }, op: "eq", right: { value: "productionReceipt" } },
      source: "invariant",
      level: "block",
      why: "The product on a production completion receipt must match the finished goods on the production task",
      check: {
        primitive: "ref_field_compare",
        via: "productionTaskId",
        entity: "productionTask",
        field: "productId",
        op: "eq",
        right: { ref: "$line.productId" },
      },
    },
    { id: "lines_required", onTransition: "approve", source: "invariant", level: "block", why: "A stock-in document must have product lines", check: { primitive: "lines_not_empty" } },
    { id: "quantity_positive", onTransition: "approve", source: "invariant", level: "block", why: "Stock-in quantity must be greater than zero", check: { primitive: "lines_all", left: { ref: "$line.quantity" }, op: "gt", right: { value: 0 } } },
    { id: "void_stock_available", onTransition: "void", source: "gate", level: "block", message: "Goods received by this document have already been used. Voiding it would drive stock negative. Deal with the quantity already used first.", why: "Voiding a stock-in removes stock from the receiving warehouse. Warehouses no longer offer a negative-stock switch, so enough on-hand quantity must still be there", check: { primitive: "available_sufficient", target: "stock", subject: "$line.productId", scope: "$bill.warehouseId", need: "$line.baseQty" } },
  ],
  views: {
    list: { columns: ["status", "code", "type", "warehouseId", "applicant", "applyTime"], filters: ["status", "type", "warehouseId", "applicant", "applyTime"], searchable: ["code"], defaultSort: { field: "createdAt", desc: true } },
    form: [
      { title: "Stock-in", fields: ["code", "type", "productionTaskId", "warehouseId", "applicant", "applyTime"] },
      { title: "Lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
