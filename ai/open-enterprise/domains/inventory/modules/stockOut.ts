import { defineModule } from "@open-erp/metamodel";


export default defineModule({
  label: "Stock out",
  numbering: { prefix: "SO", seqScope: "day" },
  fields: [
    { key: "code", label: "Stock-out no.", type: "string", primary: true, auto: true },
    /**
     * Bound to the choice set (the same change as stock-in type; see that note on stockIn).
     *
     * Unlike stock-in, the old four values were written as `SO_INVENTORY_LOSS` and did not
     * match the dictionary codes (`inventoryLoss` / `scrap` / `sampleLoan` / `other`).
     * The switch therefore includes a data migration that rewrites stored values to the
     * dictionary codes (`0025_stock_out_type_to_choice_set.sql`, four fixed mappings).
     * Without that migration, a historical stock-out shows `SO_SCRAP` in the type cell
     * and the enum gate rejects the next edit. Neither failure is reported at publish time.
     */
    { key: "type", label: "Stock-out type", type: "enum", choiceSet: "inventory.stockOutType", required: true },
    { key: "warehouseId", label: "Issuing warehouse", type: "ref", ref: "warehouse", required: true },
    { key: "applicant", label: "Applicant", type: "string", required: true },
    { key: "applyTime", label: "Applied on", type: "date", createDefault: "today" },
    {
      key: "lines",
      label: "Stock-out lines",
      type: "subtable",
      ref: "stockOutLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "productCode", label: "Product code", type: "string", snapshot: { from: "product", match: "productId", field: "code" } },
        { key: "productName", label: "Product name", type: "string", snapshot: { from: "product", match: "productId", field: "name" } },
        { key: "unit", label: "Unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number", hidden: true },
        { key: "quantity", label: "Stock-out quantity", type: "number", required: true },
        { key: "baseQty", label: "Primary-unit stock-out quantity", type: "number", hidden: true, calculate: { op: "mul", args: [{ field: "quantity" }, { field: "unitFactor" }] } },
        { key: "baseUnitPrice", label: "Primary-unit price", type: "money", hidden: true },
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
            op: "out",
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
    { id: "lines_required", onTransition: "approve", source: "invariant", level: "block", why: "A stock-out document must have product lines", check: { primitive: "lines_not_empty" } },
    { id: "quantity_positive", onTransition: "approve", source: "invariant", level: "block", why: "Stock-out quantity must be greater than zero", check: { primitive: "lines_all", left: { ref: "$line.quantity" }, op: "gt", right: { value: 0 } } },
    { id: "stock_available", onTransition: "approve", source: "gate", level: "block", message: "Not enough stock to approve this issue. Replenish first, or reduce the quantity on this issue.", why: "Approving a stock-out deducts stock from the issuing warehouse. Warehouses no longer offer a negative-stock switch, so enough on-hand quantity must still be there", check: { primitive: "available_sufficient", target: "stock", subject: "$line.productId", scope: "$bill.warehouseId", need: "$line.baseQty" } },
  ],
  views: {
    list: { columns: ["status", "code", "type", "warehouseId", "applicant", "applyTime"], filters: ["status", "type", "warehouseId", "applicant", "applyTime"], searchable: ["code"], defaultSort: { field: "createdAt", desc: true } },
    form: [
      { title: "Stock-out", fields: ["code", "type", "warehouseId", "applicant", "applyTime"] },
      { title: "Lines", fields: ["lines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
