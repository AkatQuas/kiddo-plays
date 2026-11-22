import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Subcontract issue",
  numbering: { prefix: "SCISS", seqScope: "day" },
  fields: [
    { key: "code", label: "Issue-out no.", type: "string", primary: true, auto: true },
    { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", required: true },
    // The header has no production task: one subcontract order can cover several tasks, so "which task this material is for"
    // is true only on the line (`materialLines.productionTaskId`). Putting it on the header would mean picking one task
    // on a multi-task order, and the cumulative issue gate and return snapshots all pair on it. The number would stay right and the task would be wrong.
    { key: "supplierId", label: "Subcontract supplier", type: "ref", ref: "supplier", snapshot: { from: "subcontractOrder", match: "orderId", through: null, field: "supplierId" } },
    { key: "warehouseId", label: "Sending warehouse", type: "ref", ref: "warehouse", required: true, refDefault: { from: "subcontractOrder", match: "orderId", through: null, field: "issueWarehouseId" } },
    { key: "targetWarehouseId", label: "Subcontract WIP warehouse", type: "ref", ref: "warehouse", required: true },
    { key: "issueDate", label: "Issue-out date", type: "date", createDefault: "today" },
    {
      key: "materialLines",
      label: "BOM issue lines",
      type: "subtable",
      ref: "subcontractIssueLine",
      fields: [
        { key: "taskLineId", label: "Default BOM line", type: "refLine", ref: "bom", through: "lines", required: true },
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
        { key: "bomId", label: "Default BOM", type: "ref", ref: "bom", required: true },
        { key: "productId", label: "Raw material", type: "ref", ref: "product", snapshot: { from: "bom", match: "taskLineId", through: "lines", field: "componentProductId" } },
        // Once a subcontract issue exists, later consumption must settle on the task quantity and BOM that were approved then. A later master-data revision must not chase it.
        { key: "bomUnitQty", label: "Frozen BOM quantity per in main unit", type: "number", snapshot: { from: "bom", through: "lines", match: "taskLineId", field: "baseUnitQty" } },
        { key: "lossRate", label: "Frozen BOM scrap rate", type: "percent", snapshot: { from: "bom", through: "lines", match: "taskLineId", field: "lossRate" } },
        { key: "productionQty", label: "Frozen production-task quantity", type: "number", snapshot: { from: "productionTask", through: null, match: "productionTaskId", field: "plannedQty" } },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "bom", match: "taskLineId", through: "lines", field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "qty", label: "Issue-out quantity", type: "number", required: true },
        { key: "baseQty", label: "Issue-out quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "standardBaseQty", label: "Approved standard consumption", type: "number", derive: { kind: "formula", expr: { op: "mul", args: [{ field: "productionQty" }, { field: "bomUnitQty" }] } } },
        // A leftover-handling line keeps issueLineId. Its completed state can move only when the matching warehouse transfer or shipment moves,
        // and undoing that job reopens the handling document. Summing by the business document keeps the lineage and does not count "released" as "processed".
        { key: "returnedBaseQty", label: "Leftover already returned", type: "number", derive: { kind: "rollup", from: "subcontractMaterialReturn", through: "materialLines", match: "issueLineId", measure: "sum(baseQty)", where: { status: "returned" } } },
        { key: "confirmedLossBaseQty", label: "lossConfirmed", type: "number", derive: { kind: "rollup", from: "subcontractMaterialReturn", through: "materialLines", match: "issueLineId", measure: "sum(baseQty)", where: { status: "lossConfirmed" } } },
        // Leftover and unprocessed quantity use this line's issue quantity, not a second "actually issued" book.
        // It used to roll up from `warehouseDemand` (completed warehouse jobs), which was a second record of the same fact.
        // The `confirm` edge already posts stock (out of the sending warehouse, into the subcontract WIP warehouse). The issue document is the warehouse fact.
        // The warehouse-demand module was removed with the menu entry that had no screen, so the left side is back to the only source.
        { key: "unclosedBaseQty", label: "Unprocessed subcontract material", type: "number", derive: { kind: "formula", expr: { op: "sub", args: [{ field: "baseQty" }, { op: "add", args: [{ field: "returnedBaseQty" }, { field: "confirmedLossBaseQty" }] }] } } },
        { key: "returnQty", label: "Return opening quantity", type: "number", hidden: true, derive: { kind: "formula", expr: { value: 0 } } },
        { key: "baseUnitPrice", label: "Business price in main unit", type: "money", hidden: true, derive: { kind: "formula", expr: { value: 0 } } },
        {
          key: "requirementBaseQty",
          label: "BOM requirement in main unit",
          type: "number",
          derive: { kind: "formula", expr: {
            op: "mul",
            args: [
              { field: "productionQty" },
              { field: "bomUnitQty" },
              { op: "add", args: [{ value: 1 }, { op: "div", args: [{ field: "lossRate" }, { value: 100 }] }] },
            ],
          } },
        },
        { key: "batchNo", label: "Lot number", type: "string" },
        { key: "remark", label: "Line remark", type: "text" },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      // Create and push start at awaiting issue. Do not set editable: "none": awaiting issue must stay editable, or the form cannot be filled.
      { key: "awaitingIssueOut", label: "awaitingIssueOut", color: "amber", initial: true },
      { key: "issuedOut", label: "issuedOut", color: "green", editable: "whitelist", editableFields: ["remark"] },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "confirm",
        from: "awaitingIssueOut",
        to: "issuedOut",
        action: "Confirm material send",
        primary: true,
        effects: [
          { target: "stock", op: "out", subject: "$line.productId", scope: "$bill.warehouseId", amount: "{$line.baseQty}", reverseOn: [] },
          { target: "stock", op: "in", subject: "$line.productId", scope: "$bill.targetWarehouseId", amount: "{$line.baseQty}", reverseOn: [] },
        ],
      },
      { code: "create_return", from: "issuedOut", to: "issuedOut", action: "Create subcontract material return", push: "subcontractMaterialReturn" },
      { code: "cancel", from: "awaitingIssueOut", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    { id: "lines_required", onTransition: "confirm", source: "invariant", level: "block", why: "The issue must list the raw materials on the default BOM", check: { primitive: "lines_not_empty" } },
    { id: "header_required", onTransition: "confirm", source: "invariant", level: "block", why: "The subcontract WIP warehouse and the actual date are required before confirming the issue", check: { primitive: "required_fields", fields: ["targetWarehouseId", "issueDate"] } },
    { id: "qty_positive", onTransition: "confirm", source: "invariant", level: "block", why: "Issue quantity must be positive", check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } } },
    { id: "stock_available", onTransition: "confirm", source: "gate", level: "block", why: "An issue cannot drive stock negative", check: { primitive: "available_sufficient", target: "stock", subject: "$line.productId", scope: "$bill.warehouseId", need: "$line.baseQty" } },
    // This gate judges this document only. It does not accumulate across documents. The old `related_agg` was wrong:
    // its pair key `taskLineId` points at a **BOM line**, and a BOM is master data built per product.
    // Every production task for the same product shares those line ids. The left side then counted "material issued for every task"
    // and the right side `requirementBaseQty` counted "this task's requirement". They were not in the same coordinate system.
    // The second subcontract order for the same suit always collided (left 320 > right 120) even though the user changed no number.
    // The other cumulative gates in this warehouse all pair on a **document line** (order line, issue line, receipt line, or work-report line),
    // which already separates business events. Only this one pointed at master data.
    //
    // After the comparison is inside this document, cross-document accumulation has no guard in two shapes. That is a known gap:
    //   1. A second subcontract issue created by hand, not pushed from the order. Nothing stops it today.
    //   2. The order is closed, the task returns to "awaitingLaunch", a new order is opened, and material is issued again. That is not accumulated either.
    // On the normal path, cross-document accumulation is structurally impossible: `issue` leaves only from "awaitingOutsource" (there is no "issue more" edge),
    // and `no_other_active_order` keeps one task on only one active subcontract order.
    // Closing 1 and 2 means letting `related_agg.where` accept a dynamic operand such as `{ ref: "$line.productionTaskId" }`
    // (narrow the row set to this task first, then the pair key is in one coordinate system). That change is in packages/.
    { id: "not_over_bom", onTransition: "confirm", source: "invariant", level: "block", why: "The issue quantity cannot exceed this task's default BOM requirement", check: { primitive: "lines_all", left: { ref: "$line.baseQty" }, op: "lte", right: { ref: "$line.requirementBaseQty" } } },
    { id: "not_below_standard", onTransition: "confirm", source: "invariant", level: "block", why: "A subcontract issue must cover at least the frozen BOM's net standard consumption. Scrap rate only raises the material-preparation ceiling", check: { primitive: "lines_all", left: { ref: "$line.baseQty" }, op: "gte", right: { ref: "$line.standardBaseQty" } } },
    { id: "warehouses_differ", onTransition: "confirm", source: "invariant", level: "block", why: "The sending warehouse and the subcontract WIP warehouse cannot be the same", check: { primitive: "field_compare", left: { ref: "$bill.warehouseId" }, op: "ne", right: { ref: "$bill.targetWarehouseId" } } },
  ],
  handoff: [
    { id: "notify_production", kind: "notify", onTransition: "confirm", to: "production-planner", title: "Subcontract material issued", why: "Production must track processing at the supplier" },
  ],
  views: {
    list: { columns: ["code", "orderId", "issueDate", "supplierId", "warehouseId", "status"], filters: ["status", "orderId", "supplierId", "warehouseId", "issueDate"], searchable: ["code"], defaultSort: { field: "createdAt", desc: true } },
    form: [
      { title: "Issue-out", fields: ["code", "orderId", "supplierId", "warehouseId", "targetWarehouseId", "issueDate"] },
      { title: "BOM materials", fields: ["materialLines"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
