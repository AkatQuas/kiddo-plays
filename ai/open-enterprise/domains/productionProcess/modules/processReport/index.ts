import {
  defineModule,
  definePlanners,
  roundToScale,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlannerContext,
  requireText,
  requireNumber,
} from "@open-erp/metamodel";
import { stampTaskActualEndIfReached } from "../productionTask/taskActualEnd.ts";
import { performanceSettlementCreateCommand } from "./performanceSettlementCreate.ts";
import { resolveWorkerPricingCoefficient } from "./resolvePricingCoefficient.ts";

function quantity(value: unknown, label: string): number {
  const n = requireNumber(value, label);
  return roundToScale(n, "number", label);
}

function dateTime(value: unknown, label: string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) throw new Error(`${label} must be a valid time`);
    return value.toISOString();
  }
  const raw = requireText(value, label);
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.valueOf())) throw new Error(`${label} must be a valid time`);
  return parsed.toISOString();
}

async function approvePlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const assignmentId = requireText(ctx.bill.header["processAssignmentId"], "Assignment");
  const assignment = await ctx.read.getBill("processAssignment", assignmentId);
  const occurredAt = dateTime(ctx.bill.header["reportedAt"], "Reported at");
  const qualified = quantity(ctx.bill.header["qualifiedQty"], "Qualified quantity this time");
  const defect = quantity(ctx.bill.header["defectQty"], "Defect quantity this time");
  const workHours = quantity(ctx.bill.header["workHours"], "Hours this time");

  const commands: ExecutionCommand[] = [{
    type: "appendTargetLines",
    commandId: "record-assignment-progress",
    target: { kind: "existing", module: "processAssignment", id: assignmentId },
    table: "progressLines",
    rows: [{
      sourceProcessReportId: ctx.bill.id,
      qualifiedQty: qualified,
      defectQty: defect,
      workHours,
      recordedAt: occurredAt,
    }],
    expectedStatus: requireText(assignment.header["status"], "Assignment status"),
  }];
  const taskIdFromReport = typeof ctx.bill.header["productionTaskId"] === "string" ? ctx.bill.header["productionTaskId"].trim() : "";
  const taskIdFromAssignment = typeof assignment.header["productionTaskId"] === "string" ? assignment.header["productionTaskId"].trim() : "";
  const taskId = taskIdFromReport !== "" ? taskIdFromReport : taskIdFromAssignment;
  if (taskId !== "") {
    const task = await ctx.read.getBill("productionTask", taskId);
    const processLineIdRaw = (ctx.bill.lines["sourceLines"] ?? [])[0]?.["processLineId"];
    const processLineId = typeof processLineIdRaw === "string" ? processLineIdRaw.trim() : "";
    const endStamp = stampTaskActualEndIfReached({
      task,
      additionsByProcessLineId: processLineId === "" ? new Map() : new Map([[processLineId, qualified]]),
      headerAddedQualified: qualified,
    });
    if (endStamp !== null) commands.push(endStamp);
  }
  const workerIdRaw = ctx.bill.header["workerId"];
  let pricingCoefficient: number | null = null;
  if (typeof workerIdRaw === "string" && workerIdRaw.trim() !== "") {
    const worker = await ctx.read.getBill("worker", workerIdRaw.trim());
    pricingCoefficient = resolveWorkerPricingCoefficient(worker, ctx.bill.header["operationId"]);
  }
  const settlement = performanceSettlementCreateCommand(
    ctx.bill.id,
    "performance-settlement",
    pricingCoefficient,
  );
  commands.push(settlement);

  return { version: 1, commands };
}

// syncApprove has no planner. execute's setStatus does not recursively run the target edge's planner.
export const planners = definePlanners(
  {
    approve: approvePlan,
  },
  {
    approve: ["performanceSettlement"],
  },
  { approve: "latest" },
);

export default defineModule({
  label: "Work report",
  numbering: { prefix: "RPT", seqScope: "day" },

  fields: [
    { key: "code", label: "Work report no.", type: "string", primary: true, auto: true },
    { key: "reportType", label: "Report type", type: "enum", options: [{ value: "In-house", label: "In-house" }, { value: "Sub-contract", label: "Sub-contract" }], plannerSupplied: true },
    { key: "processAssignmentId", label: "Assignment", type: "ref", ref: "processAssignment", required: false, refFilter: { status: ["awaitingProduction", "inProduction"] } },
    // The path is optional: in-house has an assignment, subcontract has a receipt and a supplier.
    // It cannot be plannerSupplied. When the two paths leave the other side blank, the freeze gate would block it.
    // The import template also drops these two columns. People download the production report template. The subcontract source is written by the receipt planner.
    { key: "subcontractReceiptId", label: "Subcontract receipt", type: "ref", ref: "subcontractReceipt" },
    // The list's assignment-number column: in-house stores the assignment number, subcontract stores the subcontract receipt number (the column is filled with the receipt number for subcontract).
    // The planner supplies it. The two paths have different source documents, and each freezes its own source code.
    { key: "sourceBillCode", label: "Assignment no.", type: "string", plannerSupplied: true },
    { key: "subcontractSupplierId", label: "Subcontract supplier", type: "ref", ref: "supplier" },
    { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", plannerSupplied: true },
    // A whole-order or other subcontract may have no operation. The production order coordinate may also be empty for other subcontract. The path is optional. The planner writes it when it has a value.
    { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder" },
    // productId must be plannerSupplied. In-house reads it from the assignment, subcontract reads it from the receipt line, so unitChoice.match has a value.
    { key: "productId", label: "Product", type: "ref", ref: "product", plannerSupplied: true },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation" },
    {
      key: "sourceLines",
      label: "Reported operation",
      type: "subtable",
      ref: "processReportSourceLine",
      hidden: true,
      fields: [
        { key: "processLineId", label: "Operation line", type: "refLine", ref: "productionTask", through: "processLines", required: true },
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
        // Qualified and defect quantities are both written on the line. An operation-line rollup through sourceLines reads the line measure,
        // so a header quantity is not added once per child row (the gate requires maxRows: 1 for a header measure).
        { key: "qualifiedQty", label: "Qualified quantity", type: "number", required: true },
        { key: "defectQty", label: "Defect quantity", type: "number", required: true },
      ],
    },
    // The worker is empty for subcontract (the supplier is subcontractSupplierId). In-house is written by the assignment planner.
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", person: { role: "receiver", via: { ref: "worker", field: "platformUserId" } } },
    {
      key: "teamId",
      label: "Team",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "teamId", optional: true },
    },
    // Layer 2: assignment snapshot. In-house is written by the assignment planner. Subcontract is written by the receipt planner from the subcontract order.
    { key: "assignedQty", label: "Assigned quantity", type: "number", plannerSupplied: true },
    { key: "pieceRate", label: "Piece rate", type: "money", snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "pieceRate", optional: true } },
    { key: "hourlyRate", label: "Hourly rate", type: "money", snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "hourlyRate", optional: true } },
    { key: "hourlyRateUnit", label: "Hourly-rate unit", type: "string", snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "hourlyRateUnit", optional: true } },
    { key: "qualifiedQty", label: "Qualified quantity", type: "number", required: true },
    { key: "defectQty", label: "Defect quantity", type: "number", required: true },
    { key: "reportedQty", label: "Quantity reported this time", type: "number", calculate: { op: "add", args: [{ field: "qualifiedQty" }, { field: "defectQty" }] } },
    // unit / unitFactor / baseQualifiedQty / baseDefectQty are supplied by the planner.
    // In-house reads them from the assignment, subcontract from the receipt line. unitChoice and plannerSupplied are mutually exclusive, so the type is string.
    { key: "unit", label: "Unit", type: "string", plannerSupplied: true },
    { key: "unitFactor", label: "Unit factor", type: "number", hidden: true, plannerSupplied: true },
    { key: "baseQualifiedQty", label: "Qualified quantity in main unit", type: "number", hidden: true, plannerSupplied: true },
    { key: "baseDefectQty", label: "Defect quantity in main unit", type: "number", hidden: true, plannerSupplied: true },
    { key: "workHours", label: "Hours", type: "number", required: true },
    {
      key: "defects",
      label: "Defect reason",
      type: "subtable",
      ref: "processReportDefectLine",
      fields: [
        { key: "defectTypeId", label: "Defect reason", type: "ref", ref: "defectType", required: true },
        { key: "defectName", label: "Reason name", type: "string", snapshot: { from: "defectType", match: "defectTypeId", through: null, field: "name" } },
        { key: "defectCategory", label: "Reason category", type: "string", snapshot: { from: "defectType", match: "defectTypeId", through: null, field: "category" } },
      ],
    },
    { key: "defectReasonCount", label: "Reason count", type: "number", hidden: true, lineAgg: { of: "defects", measure: "count()" } },
    { key: "reportedAt", label: "Reported at", type: "datetime", required: true, createDefault: "now" },
    { key: "photos", label: "Report photos", type: "attachment" },
    { key: "remark", label: "Remarks", type: "text" },

    // Layer 2 display fields. Subcontract has no assignment, so these cannot be copied from an assignment.
    // Product name, specification, specification note, and task quantity exist on the production task for both paths, so freeze the values already frozen on the task.
    { key: "productName", label: "Product name", type: "string", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productName", optional: true } },
    { key: "spec", label: "Specification", type: "string", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "spec", optional: true } },
    { key: "taskQty", label: "Task quantity", type: "number", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "plannedQty", optional: true } },
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "equipmentId", optional: true } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "moldId", optional: true } },
    // In-house copies the assignment. Subcontract is written by the receipt planner from the subcontract date, planned delivery date, and line quantity.
    { key: "plannedStartDate", label: "Assignment start", type: "datetime", plannerSupplied: true },
    { key: "plannedEndDate", label: "Assignment end", type: "datetime", plannerSupplied: true },
    { key: "assignedAt", label: "Assigned at", type: "datetime", plannerSupplied: true },
    // Cumulative reported quantity: in-house copies the assignment's current total. Subcontract is written by the receipt planner as the quantity already received on this line, including this receipt.
    { key: "cumulativeReportedQty", label: "Cumulative reported quantity", type: "number", plannerSupplied: true },

    // SKU freezes the product barcode directly. A subcontract report has no assignment, so it cannot be copied from one. The product is written on both paths.
    { key: "productBarcode", label: "SKU code", type: "string", snapshot: { from: "product", match: "productId", through: null, field: "barcode", optional: true } },
    { key: "productRemark", label: "Specification note", type: "string", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productRemark", optional: true } },

    // Layer 4: organization ancestor snapshot. It is complete only when the tree happens to be factory → … → team. It is not validated.
    // ancWorkshopId / ancFactoryId are computed on orgUnit.
    // processAssignment snapshots them through teamId, and this is the second-level snapshot.
    {
      key: "workshopOrgId",
      label: "Workshop",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "workshopOrgId", optional: true },
    },
    {
      key: "factoryOrgId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "factoryOrgId", optional: true },
    },
    // Direct parent: teamId's parentOrgId. It is a production line only when the tree happens to be factory → … → team. workshopOrgId cannot read this cell.
    // A framework snapshot cannot hop twice, so processAssignment carries the intermediate field productionLineOrgId.
    {
      key: "productionLineOrgId",
      label: "Production line",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "processAssignment", match: "processAssignmentId", through: null, field: "productionLineOrgId", optional: true },
    },
  ],

  lifecycle: {
    statuses: [
      // The quantity already occupies the assignment remainder when the report is created. It cannot be edited while pendingReview, so the quantity does not drift during approval.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true, editable: "whitelist", editableFields: ["remark", "photos"] },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingReview", to: "completed", action: "Approve", primary: true, confirm: true, when: { primitive: "field_compare", left: { ref: "$bill.reportType" }, op: "eq", right: { value: "In-house" } } },
      { code: "syncApprove", from: "pendingReview", to: "completed", action: "Sync approve", internal: true },
      { code: "syncCancel", from: "pendingReview", to: "cancelled", action: "Sync cancel", internal: true },
    ],
  },

  preconditions: [
    { id: "own_report_manual_approval", onTransition: "approve", source: "gate", level: "block", why: "A subcontract work report must follow its subcontract receipt", message: "A subcontract work report cannot be approved on its own. Approve the matching subcontract receipt.", check: { primitive: "field_compare", left: { ref: "$bill.reportType" }, op: "eq", right: { value: "In-house" } } },
    { id: "report_total_positive", onTransition: "approve", source: "invariant", level: "block", why: "Qualified quantity and defect quantity on one report cannot both be zero", message: "Qualified quantity and defect quantity cannot both be 0. Enter at least one number greater than 0.", check: { primitive: "field_compare", left: { ref: "$bill.reportedQty" }, op: "gt", right: { value: 0 } } },
    { id: "report_defect_reasons_required", onTransition: "approve", source: "invariant", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.defectQty" }, op: "gt", right: { value: 0 } }, why: "A defect reason is required when the defect quantity is greater than zero", message: "This report includes defects. Select a defect reason.", check: { primitive: "field_compare", left: { ref: "$bill.defectReasonCount" }, op: "gt", right: { value: 0 } } },
    { id: "report_defect_reasons_empty", onTransition: "approve", source: "invariant", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.defectQty" }, op: "eq", right: { value: 0 } }, why: "Do not fill a defect reason when the defect quantity is zero", message: "Do not fill a defect reason when no defects were reported.", check: { primitive: "field_compare", left: { ref: "$bill.defectReasonCount" }, op: "eq", right: { value: 0 } } },
    { id: "sync_report_total_positive", onTransition: "syncApprove", source: "invariant", level: "block", why: "Qualified quantity and defect quantity on one report cannot both be zero", message: "Qualified quantity and defect quantity cannot both be 0.", check: { primitive: "field_compare", left: { ref: "$bill.reportedQty" }, op: "gt", right: { value: 0 } } },
    { id: "sync_report_defect_reasons_required", onTransition: "syncApprove", source: "invariant", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.defectQty" }, op: "gt", right: { value: 0 } }, why: "A defect reason is required when the defect quantity is greater than zero", message: "This report includes defects. Select a defect reason.", check: { primitive: "field_compare", left: { ref: "$bill.defectReasonCount" }, op: "gt", right: { value: 0 } } },
    { id: "sync_report_defect_reasons_empty", onTransition: "syncApprove", source: "invariant", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.defectQty" }, op: "eq", right: { value: 0 } }, why: "Do not fill a defect reason when the defect quantity is zero", message: "Do not fill a defect reason when no defects were reported.", check: { primitive: "field_compare", left: { ref: "$bill.defectReasonCount" }, op: "eq", right: { value: 0 } } },
  ],

  handoff: [
    { id: "approve_process_report", kind: "todo", onStatus: "pendingReview", to: "team-leader", title: "Confirm the report after checking qualified and defect quantities", why: "Approval completes the work report. Only qualified quantity counts toward progress and wages. Delete a pending report that was filled in wrong" },
  ],

  views: {
    list: {
      columns: [
        // Identity
        "code", "reportedAt", "reportType",
        // Quantities
        "qualifiedQty", "defectQty",
        // Remark and unit
        "remark", "unit",
        // Source document number: in-house shows the assignment number, subcontract shows the receipt number (one column, as required)
        "sourceBillCode",
        // Product (layer 2 snapshot)
        "productName", "spec", "productBarcode", "productRemark",
        // Task quantity (layer 2 snapshot)
        "taskQty",
        // Production task / order
        "productionTaskId", "productionOrderId",
        // Operation and people (workerId is empty for subcontract; the supplier is subcontractSupplierId)
        "operationId", "workerId", "subcontractSupplierId",
        // Equipment and mold (layer 2 snapshot, usually empty for subcontract)
        "equipmentId", "moldId",
        // Assignment times (written by the planner for both in-house and subcontract)
        "plannedStartDate", "plannedEndDate", "assignedQty", "assignedAt", "cumulativeReportedQty",
        // Organization ancestors (layer 4 snapshot)
        "factoryOrgId", "workshopOrgId", "productionLineOrgId", "teamId",
        "status",
      ],
      filters: ["status", "reportType", "operationId", "teamId", "workerId", "reportedAt"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
      referenceLabel: ["code"],
    },
    form: [
      { title: "Report source", fields: ["code", "reportType", "processAssignmentId", "subcontractReceiptId", "subcontractSupplierId", "productionTaskId", "productionOrderId", "productId", "operationId", "workerId", "teamId", "assignedQty"] },
      { title: "Quantity and hours", fields: ["qualifiedQty", "defectQty", "reportedQty", "unit", "workHours", "reportedAt"] },
      { title: "Defect reason", fields: ["defects"] },
      { title: "Pricing snapshot", fields: ["pieceRate", "hourlyRate", "hourlyRateUnit"] },
      { title: "Shop-floor evidence", fields: ["photos", "remark"] },
      { title: "Product snapshot", fields: ["productName", "spec", "productBarcode", "productRemark", "taskQty"] },
      { title: "Assignment snapshot", fields: ["plannedStartDate", "plannedEndDate", "assignedAt", "assignedQty", "cumulativeReportedQty", "equipmentId", "moldId"] },
      { title: "Production organization snapshot", fields: ["factoryOrgId", "workshopOrgId", "productionLineOrgId"] },
    ],
  },
});
