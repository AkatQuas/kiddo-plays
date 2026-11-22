import {
  definePlanners,
  EXECUTION_TIME,
  roundToScale,
  type CreatedIdValue,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlanValue,
  type PlanRecord,
  type PlannerContext,
  requireText,
  requireNumber,
} from "@open-erp/metamodel";
import { taskEndStamps } from "./taskActualEnd.ts";

function quantity(value: unknown, label: string, allowZero = false): number {
  const n = roundToScale(requireNumber(value, label), "number", label);
  if (allowZero ? n < 0 : n <= 0) throw new Error(`${label} must be ${allowZero ? "at least" : "greater than"} 0`);
  return n;
}

function optionalQuantity(value: unknown, label: string): number {
  if (value === undefined || value === null || value === "") return 0;
  return quantity(value, label, true);
}

export type ReceiptReportLine = Readonly<Record<string, unknown>>;

/** A subcontract date is stored as a datetime snapshot on the work report. */
function dateAsDateTime(value: unknown, label: string): string {
  const text = requireText(value, label).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  return text;
}

/**
 * Flatten one "create a pending-review subcontract work report" command per receipt line.
 * Called when the subcontract order creates a receipt that is awaiting approval. After that, the work report's status follows only the receipt's approval or cancellation.
 */
export function planSubcontractReceiptReportCommands(input: {
  readonly receiptId: string | CreatedIdValue;
  readonly receiptCode: string | PlanValue;
  readonly supplierId: string;
  readonly processAssignmentId?: string | null;
  readonly remark: string | null;
  readonly lines: readonly ReceiptReportLine[];
}): readonly ExecutionCommand[] {
  const commands: ExecutionCommand[] = [];
  for (const [index, line] of input.lines.entries()) {
    const idx = String(index + 1).padStart(3, "0");
    const productionTaskId = requireText(line["productionTaskId"], `Row ${idx} production task`);
    const receiveQty = quantity(line["qty"], `Row ${idx} receipt quantity`);
    const defectQty = optionalQuantity(line["defectQty"], `Row ${idx} defect quantity`);
    // Qualified quantity on a subcontract receipt must subtract the defect quantity. The old logic used the receipt total,
    // so operation progress showed 100 qualified when the receipt was 100 with 2 defects.
    const qualifiedQty = line["qualifiedQty"] === undefined || line["qualifiedQty"] === null || line["qualifiedQty"] === ""
      ? roundToScale(receiveQty - defectQty, "number", `Row ${idx} qualified quantity`)
      : quantity(line["qualifiedQty"], `Row ${idx} qualified quantity`, true);
    if (qualifiedQty + defectQty > receiveQty) {
      throw new Error(`On row ${idx}, qualified quantity plus defect quantity cannot exceed the receipt quantity`);
    }
    if (qualifiedQty + defectQty <= 0) continue;

    const productId = requireText(line["productId"], `Row ${idx} finished goods`);
    const unit = requireText(line["unit"], `Row ${idx} unit`);
    const unitFactor = quantity(line["unitFactor"] ?? 1, `Row ${idx} unit conversion factor`);
    const productionOrderId = typeof line["productionOrderId"] === "string" && line["productionOrderId"].trim() !== ""
      ? line["productionOrderId"].trim()
      : null;
    const operationId = typeof line["operationId"] === "string" && line["operationId"].trim() !== ""
      ? line["operationId"].trim()
      : null;

    let defectTypeIds: string[] = [];
    const rawDefectIds = line["defectTypeIds"];
    if (typeof rawDefectIds === "string" && rawDefectIds.trim() !== "") {
      try {
        const parsed = JSON.parse(rawDefectIds) as unknown;
        if (Array.isArray(parsed)) {
          defectTypeIds = parsed.map((id, i) => requireText(id, `Row ${idx} defect reason ${String(i + 1)}`));
        }
      } catch {
        throw new Error(`The defect reason on row ${idx} is not valid JSON`);
      }
    } else if (Array.isArray(rawDefectIds)) {
      defectTypeIds = rawDefectIds.map((id, i) => requireText(id, `Row ${idx} defect reason ${String(i + 1)}`));
    }
    if (defectQty > 0 && defectTypeIds.length === 0) {
      throw new Error(`Select a defect reason on row ${idx} when there is a defect quantity`);
    }

    // Assignment fields are frozen from the subcontract order. Without a source assignment there is no snapshot to copy.
    const assignedQty = quantity(line["assignedQty"] ?? receiveQty, `Row ${idx} assigned quantity`);
    const plannedStartDate = dateAsDateTime(line["plannedStartDate"], `Row ${idx} assignment start`);
    const plannedEndDate = dateAsDateTime(line["plannedEndDate"], `Row ${idx} assignment end`);
    const assignedAt = dateAsDateTime(line["assignedAt"] ?? line["plannedStartDate"], `Row ${idx} assignment time`);
    const cumulativeReportedQty = quantity(
      line["cumulativeReportedQty"] ?? (qualifiedQty + defectQty),
      `Row ${idx} reported quantity to date`,
      true,
    );

    const reportCommandId = `subcontract-process-report-${idx}`;
    const header: PlanRecord = {
      reportType: "Sub-contract",
      processAssignmentId: input.processAssignmentId ?? (typeof line["processAssignmentId"] === "string" ? line["processAssignmentId"] : null),
      subcontractReceiptId: input.receiptId,
      sourceBillCode: input.receiptCode,
      subcontractSupplierId: input.supplierId,
      productionTaskId,
      productionOrderId,
      productId,
      operationId,
      // A subcontract work report has no worker. The responsible party is the supplier.
      workerId: null,
      unit,
      unitFactor,
      assignedQty,
      plannedStartDate,
      plannedEndDate,
      assignedAt,
      cumulativeReportedQty,
      qualifiedQty,
      defectQty,
      baseQualifiedQty: roundToScale(qualifiedQty * unitFactor, "number", `Row ${idx} qualified quantity after conversion`),
      baseDefectQty: roundToScale(defectQty * unitFactor, "number", `Row ${idx} defect quantity after conversion`),
      workHours: 0,
      reportedAt: EXECUTION_TIME,
      ...(input.remark === null ? {} : { remark: input.remark }),
    };

    const processLineId = typeof line["processLineId"] === "string" && line["processLineId"].trim() !== ""
      ? line["processLineId"].trim()
      : null;

    commands.push({
      type: "createBill",
      commandId: reportCommandId,
      module: "processReport",
      header,
      lines: {
        // productionTaskId is the companion column of processLineId (refLine) and cannot be written by hand.
        ...(processLineId === null
          ? {}
          : { sourceLines: [{ processLineId, qualifiedQty, defectQty }] }),
        defects: defectTypeIds.map((defectTypeId): PlanRecord => ({ defectTypeId })),
      },
    });
  }
  return commands;
}

async function receiptReports(ctx: PlannerContext, receiptId: string): Promise<readonly { readonly id: string; readonly status: string }[]> {
  const page = await ctx.read.listBills("processReport", {
    where: { kind: "cond", field: "subcontractReceiptId", op: "eq", value: receiptId },
    search: null,
    sort: [{ field: "createdAt", desc: false }],
    limit: 101,
    offset: 0,
  });
  if (page.total > 100 || page.rows.length > 100) {
    throw new Error(`Subcontract receipt ${receiptId} is linked to more work reports than the safe limit, so they cannot be updated together`);
  }
  return page.rows.map((row, index) => ({
    id: requireText(row["id"], `Linked work report ${String(index + 1)} id`),
    status: requireText(row["status"], `Linked work report ${String(index + 1)} status`),
  }));
}

/** Approving a subcontract receipt only moves the pending-review subcontract work reports created with that receipt to "completed". */
async function confirmPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const receiptId = requireText(ctx.bill.id, "Receipt id");

  const lines = ctx.bill.lines["lines"] ?? [];
  if (!Array.isArray(lines) || lines.length === 0) {
    return { version: 1, commands: [] };
  }

  const linked = await receiptReports(ctx, receiptId);
  if (linked.length === 0) {
    throw new Error(`Subcontract receipt ${receiptId} has no work report awaiting approval. Check the receipt that was created`);
  }

  const commands: ExecutionCommand[] = [];
  const additions: { taskId: string; processLineId: string | null; qualified: number }[] = [];
  for (const [index, report] of linked.entries()) {
    if (report.status === "completed") continue;
    if (report.status !== "pendingReview") {
      throw new Error(`Work report ${report.id} on subcontract receipt ${receiptId} is "${report.status}", so it cannot be completed with the receipt`);
    }
    const bill = await ctx.read.getBill("processReport", report.id);
    const taskId = requireText(bill.header["productionTaskId"], "Production task");
    const qualified = quantity(bill.header["qualifiedQty"], "Qualified quantity", true);
    const defect = quantity(bill.header["defectQty"] ?? 0, "Defect quantity", true);
    const workHours = quantity(bill.header["workHours"] ?? 0, "Hours", true);
    const reportedAt = typeof bill.header["reportedAt"] === "string" && bill.header["reportedAt"].trim() !== ""
      ? bill.header["reportedAt"].trim()
      : EXECUTION_TIME;
    const processLineIdRaw = (bill.lines["sourceLines"] ?? [])[0]?.["processLineId"];
    const processLineId = typeof processLineIdRaw === "string" && processLineIdRaw.trim() !== ""
      ? processLineIdRaw.trim()
      : null;
    additions.push({ taskId, processLineId, qualified });
    commands.push({
      type: "setStatus",
      commandId: `sync-approve-subcontract-report-${String(index + 1).padStart(3, "0")}`,
      target: { kind: "existing", module: "processReport", id: report.id },
      transition: "syncApprove",
      expectedStatus: "pendingReview",
    });
    const assignmentId = typeof bill.header["processAssignmentId"] === "string"
      ? bill.header["processAssignmentId"].trim()
      : "";
    if (assignmentId !== "") {
      const assignment = await ctx.read.getBill("processAssignment", assignmentId);
      commands.push({
        type: "appendTargetLines",
        commandId: `record-subcontract-progress-${String(index + 1).padStart(3, "0")}`,
        target: { kind: "existing", module: "processAssignment", id: assignmentId },
        table: "progressLines",
        rows: [{
          sourceProcessReportId: report.id,
          qualifiedQty: qualified,
          defectQty: defect,
          workHours,
          recordedAt: reportedAt,
        }],
        expectedStatus: requireText(assignment.header["status"], "Assignment status"),
      });
    }
  }
  commands.push(...await taskEndStamps(ctx, additions));
  return { version: 1, commands };
}

/**
 * Cancel planner for a subcontract receipt: cancelling the receipt takes the work reports it created with it.
 * Only work reports that have not been approved are cancelled. A completed work report is already a fact and cannot be erased by cancelling the receipt.
 */
async function cancelPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const receiptId = requireText(ctx.bill.id, "Receipt id");
  const linked = await receiptReports(ctx, receiptId);
  const commands: ExecutionCommand[] = [];
  for (const [index, report] of linked.entries()) {
    if (report.status !== "pendingReview") continue;
    commands.push({
      type: "setStatus",
      commandId: `sync-cancel-subcontract-report-${String(index + 1).padStart(3, "0")}`,
      target: { kind: "existing", module: "processReport", id: report.id },
      transition: "syncCancel",
      expectedStatus: "pendingReview",
    });
  }
  return { version: 1, commands };
}

export const planners = definePlanners(
  { confirm: confirmPlan, cancel: cancelPlan },
  { confirm: ["processReport"], cancel: ["processReport"] },
  { confirm: "latest", cancel: "latest" },
);
