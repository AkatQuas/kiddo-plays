import {
  EXECUTION_TIME,
  requireText,
  type ExecutionCommand,
  type PlannerBillSnapshot,
} from "@open-erp/metamodel";

export function blankActualEndStamp(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * The task's reports are complete only when every operation's approved qualified quantity
 * (including this increment) has reached that operation's planned quantity.
 *
 * Do not compare header `approvedQualifiedQty` (the sum of reports across operations) with
 * the header plan. Two operations planned at 50 each would look complete as soon as the
 * first one reports 50, and the actual end time would be stamped too early.
 */
export function allProcessLinesReachedPlan(
  processLines: readonly Readonly<Record<string, unknown>>[],
  additionsByProcessLineId: ReadonlyMap<string, number> = new Map(),
): boolean {
  if (processLines.length === 0) return false;
  for (const line of processLines) {
    const planned = Number(line["plannedQty"] ?? 0);
    if (!(Number.isFinite(planned) && planned > 0)) return false;
    const id = String(line["id"] ?? "");
    const current = Number(line["approvedQualifiedQty"] ?? 0);
    const added = id === "" ? 0 : (additionsByProcessLineId.get(id) ?? 0);
    const approved = (Number.isFinite(current) ? Math.max(0, current) : 0) + added;
    if (approved < planned) return false;
  }
  return true;
}

/** When there are no operation lines, fall back to the header (whole-order subcontract and similar). */
export function taskHeaderReachedPlan(
  header: Readonly<Record<string, unknown>>,
  addedQualified: number,
): boolean {
  const planned = header["plannedQty"];
  if (typeof planned !== "number" || !Number.isFinite(planned) || planned <= 0) return false;
  const current = typeof header["approvedQualifiedQty"] === "number" ? header["approvedQualifiedQty"] : 0;
  return current + addedQualified >= planned;
}

/**
 * Write the actual end time once reported quantity reaches the plan. An existing value is not overwritten.
 * With operation lines, every operation must reach its plan. Without them, header qualified quantity must reach the plan.
 * If the stamp is already set but the task is not complete, and the task is not formally completed, clear the mistaken actual end time.
 */
export function stampTaskActualEndIfReached(args: {
  readonly task: PlannerBillSnapshot;
  readonly additionsByProcessLineId?: ReadonlyMap<string, number>;
  readonly headerAddedQualified?: number;
}): ExecutionCommand | null {
  const { task, additionsByProcessLineId = new Map(), headerAddedQualified = 0 } = args;
  const processLines = task.lines["processLines"] ?? [];
  const reached = processLines.length > 0
    ? allProcessLinesReachedPlan(processLines, additionsByProcessLineId)
    : taskHeaderReachedPlan(task.header, headerAddedQualified);
  const taskId = requireText(task.id, "Production task id");
  const status = requireText(task.header["status"], "Production task status");
  if (reached) {
    if (!blankActualEndStamp(task.header["actualEndAt"])) return null;
    return {
      type: "setGeneratedHeader",
      commandId: `stamp-task-end-${taskId}`,
      target: { kind: "existing", module: "productionTask", id: taskId },
      patch: { actualEndAt: EXECUTION_TIME },
      expectedStatus: status,
      expectedRevision: task.revision,
    };
  }
  if (blankActualEndStamp(task.header["actualEndAt"]) || status === "completed") return null;
  return {
    type: "setGeneratedHeader",
    commandId: `clear-task-end-${taskId}`,
    target: { kind: "existing", module: "productionTask", id: taskId },
    patch: { actualEndAt: null },
    expectedStatus: status,
    expectedRevision: task.revision,
  };
}
