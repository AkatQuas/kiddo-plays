import {
  defineActionPreparers,
  defineModule,
  definePlanners,
  roundToScale,
  schemaFail,
  type ActionPreparerContext,
  type CreatedIdValue,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlanRecord,
  type PlannerContext,
  EXECUTION_TIME,
  requireText,
  requireNumber,
} from "@open-erp/metamodel";
import { performanceSettlementCreateCommand } from "../processReport/performanceSettlementCreate.ts";
import { resolveWorkerPricingCoefficient } from "../processReport/resolvePricingCoefficient.ts";
import { stampTaskActualEndIfReached } from "../productionTask/taskActualEnd.ts";

const defectDraftLineField = {
  key: "defectDraftLines",
  label: "Defect reason",
  type: "subtable" as const,
  ref: "processAssignmentDefectDraftLine",
  required: false,
  fields: [
    { key: "defectTypeId", label: "Defect reason", type: "ref" as const, ref: "defectType", required: true },
  ],
};

function number(value: unknown, label: string, allowZero = false): number {
  const normalized = roundToScale(requireNumber(value, label), "number", label);
  if (allowZero ? normalized < 0 : normalized <= 0) {
    throw new Error(`${label} must be ${allowZero ? "at least" : "greater than"} 0`);
  }
  return normalized;
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return number(value, label, true);
}

function rowsOf(value: unknown, label: string, required = true): readonly Readonly<Record<string, unknown>>[] {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    if (required) schemaFail(`${label} needs at least one line`);
    return [];
  }
  if (!Array.isArray(value)) schemaFail(`${label} is not in the right shape`);
  return value.map((row, index) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      schemaFail(`${label} row ${String(index + 1)} is not in the right shape`);
    }
    return row as Readonly<Record<string, unknown>>;
  });
}

/** Reporting worker: prefer this selection. An old client that omits it falls back to the assigned worker. A changed selection must still belong to this team and be active. */
async function resolveReportWorker(ctx: PlannerContext): Promise<string> {
  const assigned = ctx.bill.header["workerId"];
  const picked = ctx.params["reportWorkerId"];
  if (typeof picked !== "string" || picked.trim() === "") {
    if (typeof assigned === "string" && assigned.trim() !== "") return assigned.trim();
    schemaFail("This assignment is for the whole team. Choose the reporting worker when reporting work");
  }
  const workerId = (picked as string).trim();
  const teamId = requireText(ctx.bill.header["teamId"], "Assignment team");
  const worker = await ctx.read.getBill("worker", workerId);
  if (worker.header["productionOrgId"] !== teamId || worker.header["status"] !== "active") {
    schemaFail("The reporting worker is not on this assignment's team, or is no longer active. Choose again");
  }
  return workerId;
}

async function reportPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const qualified = number(ctx.params["reportQualifiedQty"], "Qualified quantity", true);
  const defect = number(ctx.params["reportDefectQty"], "Defect quantity", true);
  if (qualified + defect <= 0) schemaFail("Enter a qualified quantity or a defect quantity greater than 0");
  const defects = rowsOf(ctx.params["defectDraftLines"], "Defect reason", false);
  const defectTypeIds = defects.map((line, index) => requireText(line["defectTypeId"], `Row ${String(index + 1)} defect reason`));
  if (defect <= 0) {
    if (defectTypeIds.length > 0) schemaFail("There is no defect quantity. Do not enter a defect reason");
  } else if (defectTypeIds.length === 0) {
    schemaFail("There is a defect quantity. Select a defect reason");
  }
  if (new Set(defectTypeIds).size !== defectTypeIds.length) {
    schemaFail("Do not select the same defect reason twice");
  }

  const workerId = await resolveReportWorker(ctx);
  const workHours = optionalNumber(ctx.params["reportWorkHours"], "Hours") ?? 0;
  const occurredAt = requireText(ctx.params["reportOccurredAt"], "Reported at");
  const processLineId = requireText((ctx.bill.lines["sourceLines"] ?? [])[0]?.["processLineId"], "Operation line");
  const operationId = requireText(ctx.bill.header["operationId"], "Operation");
  const unitFactor = number(ctx.bill.header["unitFactor"] ?? 1, "Unit factor", true);

  const reportCommand: ExecutionCommand = {
    type: "createBill",
    commandId: "process-report",
    module: "processReport",
    header: {
      reportType: "In-house",
      processAssignmentId: ctx.bill.id,
      // The in-house path does not set subcontract coordinates.
      subcontractReceiptId: null,
      subcontractSupplierId: null,
      // The source number of an in-house report is this assignment number (the list's assignment-number column).
      sourceBillCode: requireText(ctx.bill.header["code"], "Assignment no."),
      workerId,
      // productId / unit / unitFactor / base*Qty / productionTaskId are plannerSupplied and must be given explicitly.
      productionTaskId: requireText(ctx.bill.header["productionTaskId"], "Production task"),
      productionOrderId: typeof ctx.bill.header["productionOrderId"] === "string" && ctx.bill.header["productionOrderId"].trim() !== ""
        ? ctx.bill.header["productionOrderId"].trim()
        : null,
      productId: requireText(ctx.bill.header["productId"], "Product"),
      operationId,
      unit: requireText(ctx.bill.header["unit"], "Assignment unit"),
      unitFactor,
      // The planner freezes assignment facts explicitly. The subcontract path has no processAssignmentId to snapshot.
      // The fallback uses the remaining quantity and the report time. A real assignment has these columns. Test fixtures sometimes omit them.
      assignedQty: number(
        ctx.bill.header["assignedQty"]
          ?? ctx.bill.header["remainingQualifiedQty"]
          ?? (qualified + defect),
        "Assigned quantity",
        true,
      ),
      // The postgres driver already turns datetime fields into ISO strings in decodeRow,
      // so requireText is enough here.
      plannedStartDate: requireText(
        ctx.bill.header["plannedStartDate"] ?? ctx.bill.header["assignedAt"] ?? occurredAt,
        "Assignment start",
      ),
      plannedEndDate: requireText(
        ctx.bill.header["plannedEndDate"]
          ?? ctx.bill.header["plannedStartDate"]
          ?? ctx.bill.header["assignedAt"]
          ?? occurredAt,
        "Assignment end",
      ),
      assignedAt: requireText(
        ctx.bill.header["assignedAt"] ?? ctx.bill.header["plannedStartDate"] ?? occurredAt,
        "Assigned at",
      ),
      cumulativeReportedQty: roundToScale(
        (optionalNumber(ctx.bill.header["cumulativeReportedQty"], "Cumulative reported quantity") ?? 0) + qualified + defect,
        "number",
        "Cumulative reported quantity",
      ),
      baseQualifiedQty: roundToScale(qualified * unitFactor, "number", "Qualified quantity in main unit"),
      baseDefectQty: roundToScale(defect * unitFactor, "number", "Defect quantity in main unit"),
      qualifiedQty: qualified,
      defectQty: defect,
      workHours,
      reportedAt: occurredAt,
      remark: typeof ctx.params["reportRemark"] === "string" ? ctx.params["reportRemark"] : null,
    },
    lines: {
      sourceLines: [{ processLineId, qualifiedQty: qualified, defectQty: defect }],
      defects: defectTypeIds.map((defectTypeId): PlanRecord => ({ defectTypeId })),
    },
  };

  // Whether a report needs approval was frozen from the routing line into `requiresReportApproval` when the assignment was created
  // (the same operation can be overridden per product). Only that frozen cell is read. Do not read the operation master again.
  // Reading it again would ignore a change made on the routing.
  if (ctx.bill.header["requiresReportApproval"] !== false) {
    return { version: 1, commands: [reportCommand] };
  }

  // When the operation does not need approval, the report is approved in the same atomic plan, and every consequence of a manual approval is flattened in:
  // sync approve, record progress on the assignment, and create the pay slip. A report does not replace an explicit start or finish.
  const reportRef: CreatedIdValue = { kind: "createdId", commandId: "process-report" };
  const assignmentStatus = requireText(ctx.bill.header["status"], "Assignment status");
  const taskId = requireText(ctx.bill.header["productionTaskId"], "Production task");
  const task = await ctx.read.getBill("productionTask", taskId);

  const commands: ExecutionCommand[] = [
    reportCommand,
    {
      type: "setStatus",
      commandId: "auto-approve-report",
      target: reportRef,
      transition: "syncApprove",
      expectedStatus: "pendingReview",
    },
    {
      type: "appendTargetLines",
      commandId: "record-auto-approved-progress",
      target: { kind: "existing", module: "processAssignment", id: ctx.bill.id },
      table: "progressLines",
      rows: [{
        sourceProcessReportId: reportRef,
        qualifiedQty: qualified,
        defectQty: defect,
        workHours,
        recordedAt: occurredAt,
      }],
      expectedStatus: assignmentStatus,
    },
  ];
  const endStamp = stampTaskActualEndIfReached({
    task,
    additionsByProcessLineId: new Map([[processLineId, qualified]]),
    headerAddedQualified: qualified,
  });
  if (endStamp !== null) commands.push(endStamp);

  const workerForCoef = await ctx.read.getBill("worker", workerId);
  const settlement = performanceSettlementCreateCommand(
    reportRef,
    "performance-settlement",
    resolveWorkerPricingCoefficient(workerForCoef, operationId),
  );
  commands.push(settlement);

  return { version: 1, commands };
}

async function startProductionOrder(ctx: PlannerContext): Promise<ExecutionPlan> {
  const commands: ExecutionCommand[] = [];
  const taskId = requireText(ctx.bill.header["productionTaskId"], "Production task");
  const task = await ctx.read.getBill("productionTask", taskId);
  // Actual start follows assignment Start, not approval. The stamp must be ordered before the status move:
  // the status edge takes the task out of awaiting launch, and the stamp still checks the status and revision that were read.
  const started = task.header["actualStartAt"];
  if (started === null || started === undefined || started === "") {
    commands.push({
      type: "setGeneratedHeader",
      commandId: `stamp-task-start-${taskId}`,
      target: { kind: "existing", module: "productionTask", id: taskId },
      patch: { actualStartAt: EXECUTION_TIME },
      expectedStatus: requireText(task.header["status"], "Production task status"),
      expectedRevision: task.revision,
    });
  }
  if (task.header["status"] === "awaitingLaunch") {
    commands.push({
      type: "setStatus",
      commandId: `start-production-task-${taskId}`,
      target: { kind: "existing", module: "productionTask", id: taskId },
      transition: "startFromAssignment",
      expectedStatus: "awaitingLaunch",
    });
  } else if (task.header["status"] !== "inProduction") {
    schemaFail("The upstream production task cannot start yet. Approve the production task first");
  }
  const orderId = requireText(ctx.bill.header["productionOrderId"], "Production order");
  const order = await ctx.read.getBill("productionOrder", orderId);
  if (order.header["status"] === "releasing") {
    commands.push({
      type: "setStatus",
      commandId: `start-production-order-${orderId}`,
      target: { kind: "existing", module: "productionOrder", id: orderId },
      transition: "startProduction",
      expectedStatus: "releasing",
    });
  } else if (order.header["status"] !== "inProduction") {
    schemaFail("The upstream production order cannot start yet. Schedule production first");
  }
  return { version: 1, commands };
}

/** Status to push on a subcontract order when the assignment closes. Complete leaves an already completed order alone. Cancel withdraws a completed order too. */
const SUBCONTRACT_COMPLETE_STATUSES = ["pendingReview", "awaitingOutsource", "processing"] as const;
const SUBCONTRACT_CANCEL_STATUSES = ["pendingReview", "awaitingOutsource", "processing", "completed"] as const;

async function settleAssignmentSubcontracts(ctx: PlannerContext): Promise<ExecutionPlan> {
  const completing = ctx.transition === "complete";
  const statuses = completing ? SUBCONTRACT_COMPLETE_STATUSES : SUBCONTRACT_CANCEL_STATUSES;
  const commands: ExecutionCommand[] = [];
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills("subcontractOrder", {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "processAssignmentId", op: "eq", value: ctx.bill.id },
          { kind: "cond", field: "status", op: "in", value: [...statuses] },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });

    for (const row of page.rows) {
      const id = requireText(row["id"], "Subcontract order id");
      const status = requireText(row["status"], "Subcontract order status");
      commands.push({
        type: "setStatus",
        commandId: `${completing ? "complete" : "cancel"}-assignment-subcontract-${id}`,
        target: { kind: "existing", module: "subcontractOrder", id },
        transition: completing ? "forceComplete" : "forceCancel",
        expectedStatus: status,
      });
    }

    if (offset + page.rows.length >= page.total || page.rows.length < limit) break;
  }

  return { version: 1, commands };
}

export const planners = definePlanners(
  {
    start: startProductionOrder,
    report: reportPlan,
    complete: settleAssignmentSubcontracts,
    cancel: settleAssignmentSubcontracts,
  },
  {
    // When the operation does not need approval, report creates both the work report and the pay slip (auto-approved), so both targets must be declared.
    report: ["processReport", "performanceSettlement"],
  },
  {
    // The consequences of auto-approving a report, and the subcontract orders hit when the assignment closes, are recomputed from the latest facts inside the lock.
    report: "latest",
    complete: "latest",
    cancel: "latest",
  },
);

async function prepareReport(context: ActionPreparerContext) {
  let reportWorkerId: string | undefined;
  if ((context.bill.header["workerId"] === null || context.bill.header["workerId"] === undefined) && context.actor !== undefined) {
    const teamId = requireText(context.bill.header["teamId"], "Assignment team");
    const workers = await context.read.listBills("worker", {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "platformUserId", op: "eq", value: context.actor.userId },
          { kind: "cond", field: "productionOrgId", op: "eq", value: teamId },
          { kind: "cond", field: "status", op: "eq", value: "active" },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit: 2,
      offset: 0,
    });
    if (workers.total === 1 && workers.rows.length === 1) reportWorkerId = requireText(workers.rows[0]?.["id"], "Current operator's worker record");
  }
  const remainingQualifiedQty = roundToScale(
    requireNumber(context.bill.header["remainingQualifiedQty"], "Qualified quantity still reportable"),
    "number",
    "Qualified quantity still reportable",
  );
  return {
    reportOccurredAt: context.now.toISOString(),
    // A pendingReview report may already have driven the remainder negative. Over-reporting is allowed,
    // so the dialog default is only clamped at 0. A historical overage must not become an unclassified exception that makes parameter prepare return 500.
    reportQualifiedQty: Math.max(0, remainingQualifiedQty),
    reportDefectQty: 0,
    ...(reportWorkerId === undefined ? {} : { reportWorkerId }),
  };
}

export const actionPreparers = defineActionPreparers({
  report: prepareReport,
});

const reportParams = [
  { key: "reportOccurredAt", label: "Reported at", type: "text" as const, required: true, hidden: true },
  // A named-worker assignment can switch to another active worker on the same team at report time. An old client that omits it falls back to the original assigned worker.
  { key: "reportWorkerId", label: "Reporting worker", type: "ref" as const, ref: "worker", required: false },
  { key: "reportQualifiedQty", label: "Qualified quantity", type: "number" as const, required: true },
  { key: "reportDefectQty", label: "Defect quantity", type: "number" as const, required: true },
  { key: "reportWorkHours", label: "Hours", type: "number" as const, required: false },
  { key: "defectDraftLines", label: "Defect reason", type: "billLines" as const, required: false, lineField: defectDraftLineField },
  { key: "reportRemark", label: "Report remark", type: "text" as const, required: false },
];

export default defineModule({
  label: "Production assignment",
  // Custom fields are open to the tenant, so this table has a `custom jsonb` column and a GIN index.
  // The chain product → sales order → production order → production task → assignment / shipment
  // is where industry-specific fields are most often passed through, so it is opened first. Open another table by adding this line and shipping a release.
  customFields: true,
  numbering: { prefix: "DISP", seqScope: "day" },
  fields: [
    { key: "code", label: "Assignment no.", type: "string", primary: true, auto: true },
    { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
    // Same coordinate as sourceLines.processLineId (a header cannot declare refLine). Occupation is summed on the line-level refLine.
    // The detail drawer and the full detail page do not show this cell (it is a UUID). See fieldOverrides.processAssignment.processLineId.
    { key: "processLineId", label: "Operation line", type: "string", required: true },
    { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productionOrderId" } },
    { key: "productId", label: "Product", type: "ref", ref: "product", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productId" } },
    { key: "productName", label: "Product name", type: "string", snapshot: { from: "product", match: "productId", through: null, field: "name" } },
    { key: "spec", label: "Specification", type: "string", snapshot: { from: "product", match: "productId", through: null, field: "spec" } },
    { key: "taskQty", label: "Task quantity", type: "number", snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "plannedQty" } },
    { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
    { key: "unitFactor", label: "Unit factor", type: "number", hidden: true },
    {
      key: "sourceLines",
      label: "Assigned operation",
      type: "subtable",
      ref: "processAssignmentSourceLine",
      maxRows: 1,
      fields: [
        // Operation name comes first. The detail line is read as the name, then the operation-line reference and the quantity.
        { key: "operationName", label: "Operation name", type: "string", snapshot: { from: "productionTask", match: "processLineId", through: "processLines", field: "operationName" } },
        { key: "processLineId", label: "Operation line", type: "refLine", ref: "productionTask", through: "processLines", required: true },
        { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
        { key: "assignedQty", label: "Assigned quantity", type: "number", required: true },
      ],
    },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true, refFilter: { status: "active" } },
    { key: "operationName", label: "Operation name", type: "string", snapshot: { from: "operation", match: "operationId", through: null, field: "name" } },
    { key: "requiresReportApproval", label: "Report approval", type: "bool", required: true },
    { key: "teamId", label: "Team", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "team" }, person: { role: "receiver", via: { members: "worker", by: "productionOrgId", field: "platformUserId" } } },
    // Written only for a whole-team assignment. A named-worker assignment must leave it empty so data scope can tell the two responsibility modes apart.
    { key: "teamAssignmentOrgId", label: "Team assignment scope", type: "ref", ref: "orgUnit", required: false, refFilter: { orgType: "team" } },
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", refFilter: { status: "active" } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", refFilter: { status: "active" } },
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", refFilter: { status: "active", productionOrgId: { from: "$bill.teamId" } }, person: { role: "receiver", via: { ref: "worker", field: "platformUserId" } } },
    { key: "plannedStartDate", label: "Start time", type: "datetime", required: true },
    { key: "plannedEndDate", label: "End time", type: "datetime", required: true },
    { key: "assignedQty", label: "Assigned quantity", type: "number", required: true },
    { key: "baseAssignedQty", label: "Assigned quantity in main unit", type: "number", hidden: true, calculate: { op: "mul", args: [{ field: "assignedQty" }, { field: "unitFactor" }] } },
    { key: "assignedAt", label: "Assigned at", type: "datetime", required: true },
    { key: "pieceRate", label: "Piece rate", type: "money", required: true },
    { key: "hourlyRate", label: "Hourly rate", type: "money", snapshot: { from: "operation", match: "operationId", through: null, field: "hourlyRate", optional: true } },
    { key: "hourlyRateUnit", label: "Hourly-rate unit", type: "string", snapshot: { from: "operation", match: "operationId", through: null, field: "hourlyRateUnit" } },
    {
      key: "progressLines",
      label: "Confirmed work reports",
      type: "subtable",
      ref: "processAssignmentProgressLine",
      hidden: true,
      fields: [
        { key: "sourceProcessReportId", label: "Source work report", type: "ref", ref: "processReport", required: true },
        { key: "qualifiedQty", label: "Qualified quantity", type: "number", required: true },
        { key: "defectQty", label: "Defect quantity", type: "number", required: true },
        { key: "workHours", label: "Hours", type: "number", required: true },
        { key: "recordedAt", label: "Progress booked at", type: "datetime", required: true },
      ],
    },
    { key: "approvedQualifiedQty", label: "Approved qualified quantity", type: "number", lineAgg: { of: "progressLines", measure: "sum(qualifiedQty)" } },
    { key: "approvedDefectQty", label: "Approved defect quantity", type: "number", lineAgg: { of: "progressLines", measure: "sum(defectQty)" } },
    { key: "pendingQualifiedQty", label: "Qualified quantity pending review", type: "number", derive: { kind: "rollup", from: "processReport", match: "processAssignmentId", measure: "sum(qualifiedQty)", where: { status: "pendingReview" } } },
    { key: "cumulativeQualifiedQty", label: "Cumulative qualified quantity reported", type: "number", hidden: true, derive: { kind: "rollup", from: "processReport", match: "processAssignmentId", measure: "sum(qualifiedQty)", where: { status: ["pendingReview", "completed"] } } },
    { key: "cumulativeDefectQty", label: "Cumulative defect quantity reported", type: "number", hidden: true, derive: { kind: "rollup", from: "processReport", match: "processAssignmentId", measure: "sum(defectQty)", where: { status: ["pendingReview", "completed"] } } },
    {
      key: "cumulativeReportedQty",
      label: "Cumulative reported quantity",
      type: "number",
      derive: {
        kind: "formula",
        expr: {
          op: "add",
          args: [{ field: "cumulativeQualifiedQty" }, { field: "cumulativeDefectQty" }],
        },
      },
    },
    {
      key: "remainingQualifiedQty",
      label: "Qualified quantity still reportable",
      type: "number",
      derive: {
        kind: "formula",
        expr: {
          op: "max",
          args: [
            { value: 0 },
            { op: "sub", args: [
              { field: "assignedQty" },
              { op: "add", args: [
                { orElse: { of: { field: "approvedQualifiedQty" }, whenEmpty: 0 } },
                { orElse: { of: { field: "pendingQualifiedQty" }, whenEmpty: 0 } },
              ] },
            ] },
          ],
        },
      },
    },
    { key: "remark", label: "Remarks", type: "text" },

    // Intermediate snapshot fields the work-report list columns need.
    // They exist so a processReport snapshot can read them with a single from hop.
    // They are not part of the assignment's own views or form.
    {
      key: "productBarcode",
      label: "SKU code",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "barcode" },
    },
    {
      key: "productRemark",
      label: "Specification note",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "remark" },
    },
    {
      key: "productionLineOrgId",
      label: "Production line",
      type: "ref",
      ref: "orgUnit",
      required: false,
    },
    {
      key: "workshopOrgId",
      label: "Workshop",
      type: "ref",
      ref: "orgUnit",
      required: false,
    },
    {
      key: "factoryOrgId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      // The factory is the production subject frozen when the production task took the production order. Do not infer it again from the team organization tree.
      // If the team level has no ancestor coordinate, assignments on the same task would lose the factory.
      snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productionOrgId" },
    },
  ],
  lifecycle: {
    statuses: [
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true, editable: "whitelist", editableFields: ["assignedQty", "pieceRate", "remark"] },
      { key: "awaitingProduction", label: "awaitingProduction", color: "gray", editable: "none" },
      { key: "inProduction", label: "inProduction", color: "blue", editable: "none" },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingReview", to: "awaitingProduction", action: "Approve", primary: true },
      // "Approve immediately when the report does not need approval" inside the assignment plan cannot setStatus(approve), or the nested plan has no fingerprint.
      // The production task's actual start is not written at approval. It is written when the assignment starts.
      { code: "syncApprove", from: "pendingReview", to: "awaitingProduction", action: "Sync approve", internal: true },
      { code: "cancel", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
      { code: "start", from: "awaitingProduction", to: "inProduction", action: "Start", primary: true, confirm: true },
      {
        code: "report", from: "awaitingProduction", to: "awaitingProduction", action: "Report work",
        params: reportParams,
      },
      {
        code: "report", from: "inProduction", to: "inProduction", action: "Report work",
        params: reportParams,
      },
      { code: "complete", from: "inProduction", to: "completed", action: "Finish operation", primary: true, confirm: true },
      { code: "forceComplete", from: "pendingReview", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "awaitingProduction", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "inProduction", to: "completed", action: "Complete with production order", internal: true },
      { code: "cancel", from: "awaitingProduction", to: "cancelled", action: "Cancel", confirm: true },
      { code: "cancel", from: "inProduction", to: "cancelled", action: "Cancel", confirm: true },
      { code: "forceCancel", from: "pendingReview", to: "cancelled", action: "Cancel with production order", internal: true },
      { code: "forceCancel", from: "awaitingProduction", to: "cancelled", action: "Cancel with production order", internal: true },
      { code: "forceCancel", from: "inProduction", to: "cancelled", action: "Cancel with production order", internal: true },
    ],
  },
  preconditions: [],
  handoff: [
    { id: "approve_assignment", kind: "todo", onStatus: "pendingReview", to: "production-manager", title: "Review assignment", why: "Dispatch decides who does this operation, how much, and at what piece rate, and that settles straight into wages, so someone has to confirm it" },
    { id: "start_assignment", kind: "todo", onStatus: "awaitingProduction", to: "production-reporter", title: "Start this assignment", why: "After start, the assignment and the upstream production documents move to in production" },
    { id: "report_assignment_running", kind: "todo", onStatus: "inProduction", to: "production-reporter", title: "Continue reporting", why: "Enter this report's qualified and defect quantities. After approval they count toward production progress" },
  ],
  views: {
    workbenches: [{ code: "dispatch", label: "Assignment", statuses: ["pendingReview", "awaitingProduction", "inProduction"] }],
    list: {
      columns: ["code", "operationName", "workerId", "teamId", "assignedQty", "approvedQualifiedQty", "unit", "equipmentId", "moldId", "factoryOrgId", "productionTaskId", "productName", "spec", "productBarcode", "productRemark", "requiresReportApproval", "pieceRate", "plannedStartDate", "plannedEndDate", "status"],
      filters: ["status", "productionTaskId", "operationId", "teamId", "workerId"],
      searchable: ["code", "operationName", "productName"],
      defaultSort: { field: "createdAt", desc: true },
      // A document reference uses the stable assignment number. Inferring it from the list columns would join "number + operation name".
      // The import template would then send that display text as the reference value, and a renamed operation could no longer be matched.
      referenceLabel: ["code"],
    },
    form: [
      { title: "Dispatch", fields: ["code", "productionTaskId", "productionOrderId", "productId", "productName", "spec", "taskQty", "unit", "operationId", "teamId", "equipmentId", "moldId", "workerId"] },
      { title: "Quantity and time", fields: ["assignedQty", "cumulativeReportedQty", "approvedQualifiedQty", "pendingQualifiedQty", "remainingQualifiedQty", "pieceRate", "assignedAt", "plannedStartDate", "plannedEndDate"] },
      { title: "Remarks", fields: ["remark"] },
    ],
  },
});
