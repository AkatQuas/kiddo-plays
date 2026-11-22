import {
  defineModule,
  definePlanners,
  type PlanRecord,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlannerContext,
} from "@open-erp/metamodel";
import { assertReceiptQtyWithinAvailable } from "./availableInbound.ts";

/**
 * Confirming the receipt creates one already-approved product stock-in. Only the stock-in approve edge writes inventory.
 * The stock list can still see the source document, and completion receipt plus product stock-in are not both posted.
 */
async function confirmReceiptPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  await assertReceiptQtyWithinAvailable(ctx);
  const receiptCode = typeof ctx.bill.header["code"] === "string" ? ctx.bill.header["code"] : ctx.bill.id;
  const applicant = ctx.bill.header["handlerId"];
  const receiptDate = ctx.bill.header["receiptDate"];
  const productionTaskId = ctx.bill.header["productionTaskId"];
  if (typeof applicant !== "string" || applicant === "" || typeof receiptDate !== "string" || receiptDate === "" || typeof productionTaskId !== "string" || productionTaskId === "") {
    throw new Error("Completion receipt is missing the production task, receiver, or receipt date required to create the product stock-in");
  }
  const remark = `Source production receipt: ${receiptCode}`;
  const lines = ctx.bill.lines["lines"] ?? [];
  const commands: ExecutionCommand[] = [];

  for (const [index, line] of lines.entries()) {
    const warehouseId = line["warehouseId"];
    const productId = line["productId"];
    const unit = line["unit"];
    const quantity = line["qty"];
    if ([warehouseId, productId, unit, quantity].some((value) => value === null || value === undefined || value === "")) {
      throw new Error(`Production receipt row ${String(index + 1)} is missing the product, warehouse, unit, or quantity needed to create the goods receipt`);
    }
    const commandId = `stock-in-${String(index + 1).padStart(3, "0")}`;
    const header: PlanRecord = {
      type: "productionReceipt",
      warehouseId: warehouseId as string,
      applicant,
      applyTime: receiptDate,
      productionReceiptId: ctx.bill.id,
      productionTaskId,
      remark,
    };
    commands.push(
      {
        type: "createBill",
        commandId,
        module: "stockIn",
        header,
        lines: {
          lines: [{
            productId: productId as string,
            unit: unit as string,
            quantity: quantity as number,
            ...(typeof line["batchNo"] === "string" ? { batchNo: line["batchNo"] } : {}),
            remark,
          }],
        },
      },
      {
        type: "setStatus",
        commandId: `${commandId}-approve`,
        target: { kind: "createdId", commandId },
        transition: "approve",
        expectedStatus: "pending",
      },
    );
  }

  return { version: 1, commands };
}

export const planners = definePlanners({
  releaseDemand: confirmReceiptPlan,
});

export default defineModule({
  label: "Completion receipt",
  numbering: { prefix: "FGIN", seqScope: "day" },

  fields: [
    { key: "code", label: "Receipt no.", type: "string", primary: true, auto: true },
    { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", required: true },
    {
      key: "productionTaskId",
      label: "Production task",
      type: "ref",
      ref: "productionTask",
      required: true,
      refFilter: {
        productionOrderId: { from: "$bill.productionOrderId" },
        status: ["inProduction", "completed"],
      },
      help: "It can be received once there is approved qualified quantity, including while the task is still inProduction. Available to receive = the shortfall of approved qualified quantity across operations, minus quantity already received (including pendingReview).",
    },
    {
      key: "productId",
      label: "Finished goods",
      type: "ref",
      ref: "product",
      snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productId" },
    },
    {
      key: "productName",
      label: "Product name",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "name" },
    },
    {
      key: "spec",
      label: "Specification",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "spec" },
    },
    {
      key: "skuCode",
      label: "SKU code",
      type: "string",
      // SKU code is the product barcode. `product.code` is the product serial (Product-…), so it is not shown as the SKU.
      snapshot: { from: "product", match: "productId", through: null, field: "barcode", optional: true },
    },
    {
      key: "specRemark",
      label: "Specification note",
      type: "text",
      snapshot: { from: "product", match: "productId", through: null, field: "remark", optional: true },
    },
    { key: "receiptDate", label: "Receipt date", type: "date", createDefault: "today" },
    {
      // References a system account. The value is the platform userId. via:self means the value is already the account.
      key: "handlerId", label: "Received by", type: "ref", ref: "subject", required: true,
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    },
    {
      key: "warehouseId",
      label: "Receipt warehouse",
      type: "ref",
      ref: "warehouse",
      required: true,
      refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "completionWarehouseId" },
      help: "Defaults to the task completion warehouse. Adjust it to the warehouse that actually receives this shipment",
    },
    { key: "batchNo", label: "Receipt lot", type: "string", help: "Recorded only. It does not enter the stock calculation. The ledger coordinate stops at the warehouse; stock by lot is not supported yet" },
    { key: "inboundQty", label: "Receipt quantity", type: "number", required: true },
    {
      key: "lines",
      label: "Receipt lines",
      type: "subtable",
      ref: "productionReceiptLine",
      hidden: true,
      fields: [
        {
          key: "productionTaskId",
          label: "Production task",
          type: "ref",
          ref: "productionTask",
          required: true,
        },
        {
          key: "productId",
          label: "Finished goods",
          type: "ref",
          ref: "product",
          snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productId" },
        },
        {
          key: "warehouseId",
          label: "Receipt warehouse",
          type: "ref",
          ref: "warehouse",
          required: true,
        },
        { key: "qty", label: "Receipt quantity", type: "number", required: true },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseQty", label: "Receipt quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "baseUnitPrice", label: "Business price in main unit", type: "money", hidden: true, derive: { kind: "formula", expr: { value: 0 } } },
        { key: "batchNo", label: "Lot number", type: "string" },
      ],
    },
    { key: "requestedBaseQty", label: "Requested quantity in main unit", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(baseQty)" } },
    { key: "remark", label: "Receipt remark", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // There is no draft-to-submit state. A new receipt is created as pendingReview
      // (requirement wiki 244431994, section 4.5: pendingReview is the new row, with edit and confirm).
      // The receipt is filled against a production task and then waits for confirmation.
      // There is no intermediate "save for later". Stock moves only when the warehouse confirms.
      // pendingReview already occupies available-to-receive (the rollup counts it as received). It is not a second reservation column.
      // A wrong receipt is deleted (initial state plus creatable.manual). Do not cancel it.
      {
        key: "pendingReview",
        label: "pendingReview",
        color: "amber",
        initial: true,
        editable: "whitelist",
        editableFields: ["productionTaskId", "inboundQty", "warehouseId", "batchNo", "handlerId", "receiptDate", "remark"],
      },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "releaseDemand",
        from: "pendingReview",
        to: "completed",
        action: "Confirm stock-in",
        primary: true,
        // Stock is written only by the approve edge of the product stock-in the planner creates, so the quantity is not posted twice.
        effects: [],
      },
    ],
  },

  preconditions: [
    {
      id: "receipt_lines_required",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "A completion receipt must list the finished goods actually received. An empty line list cannot increase stock",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "receipt_qty_positive",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "The completion receipt quantity must be positive. Do not correct a receipt with a negative quantity",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "receipt_qty_header_positive",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "The header receipt quantity must be positive. Do not correct a receipt with a negative quantity",
      check: { primitive: "field_compare", left: { ref: "$bill.inboundQty" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "receipt_facts_required",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "Date, receiver, warehouse, task, and quantity are required before confirming stock-in",
      check: { primitive: "required_fields", fields: ["receiptDate", "handlerId", "warehouseId", "productionTaskId", "inboundQty"] },
    },
    {
      id: "receipt_order_matches_task",
      onTransition: "releaseDemand",
      source: "invariant",
      level: "block",
      why: "A completion receipt must belong to the production order on the header. Do not mix in tasks from another order",
      check: {
        primitive: "ref_field_compare",
        via: "productionTaskId",
        entity: "productionTask",
        field: "productionOrderId",
        op: "eq",
        right: { ref: "$bill.productionOrderId" },
      },
    },
    {
      id: "receipt_task_completed",
      onTransition: "releaseDemand",
      source: "gate",
      level: "block",
      why: "A completion receipt is limited by the approved qualified shortfall of the production task. A task in production can be received as soon as it has qualified quantity. It does not have to wait until every operation is closed, and it does not have to fill the plan",
      message: "There is no approved qualified quantity, so this cannot be received. Report the work and approve it, then receive once there is qualified quantity. A task still in inProduction can be received. It does not have to wait until the whole task is done.",
      check: {
        primitive: "ref_field_compare",
        via: "productionTaskId",
        entity: "productionTask",
        field: "status",
        op: "in",
        right: { value: ["inProduction", "completed"] },
      },
    },
    {
      id: "receipt_product_matches_task",
      onTransition: "releaseDemand",
      source: "gate",
      level: "block",
      why: "The received finished good must be the product frozen on that production task. Do not swap the product and rewrite the stock fact",
      check: {
        primitive: "ref_field_compare",
        via: "productionTaskId",
        entity: "productionTask",
        field: "productId",
        op: "eq",
        right: { ref: "$bill.productId" },
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "receiptDate", "inboundQty", "warehouseId", "handlerId", "batchNo", "remark", "productionTaskId", "productName", "spec", "skuCode", "specRemark", "status"],
      filters: ["status", "receiptDate", "productionTaskId"],
      searchable: ["code", "productName", "skuCode"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Receipt", fields: ["code", "productionOrderId", "productionTaskId", "productId", "productName", "spec", "skuCode", "specRemark", "receiptDate", "handlerId", "warehouseId", "batchNo", "inboundQty"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
