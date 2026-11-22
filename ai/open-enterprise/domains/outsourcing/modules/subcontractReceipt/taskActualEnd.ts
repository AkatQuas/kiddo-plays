import {
  EXECUTION_TIME,
  requireText,
  type ExecutionCommand,
  type PlannerBillSnapshot,
} from "@open-erp/metamodel";

function blankActualEndStamp(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Every operation's approved qualified quantity, including this increment, must reach that operation's planned quantity before the task's work reports are complete.
 * Same rule as productionProcess `taskActualEnd`: do not compare the header's reported total with the plan.
 */
function allProcessLinesReachedPlan(
  processLines: readonly Readonly<Record<string, unknown>>[],
  additionsByProcessLineId: ReadonlyMap<string, number>,
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

function taskHeaderReachedPlan(
  header: Readonly<Record<string, unknown>>,
  addedQualified: number,
): boolean {
  const planned = header["plannedQty"];
  if (typeof planned !== "number" || !Number.isFinite(planned) || planned <= 0) return false;
  const current = typeof header["approvedQualifiedQty"] === "number" ? header["approvedQualifiedQty"] : 0;
  return current + addedQualified >= planned;
}

function stampTaskActualEndIfReached(args: {
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

export type ProcessLineAddition = {
  readonly taskId: string;
  readonly processLineId: string | null;
  readonly qualified: number;
};

/** Add the work reports that will become completed, by operation. Write the actual end only when every operation has reached its plan. Do not overwrite a value that is already set. */
export async function taskEndStamps(
  ctx: { readonly read: { getBill(module: string, id: string): Promise<PlannerBillSnapshot> } },
  additions: readonly ProcessLineAddition[],
): Promise<readonly ExecutionCommand[]> {
  const byTask = new Map<string, { headerAdded: number; byLine: Map<string, number> }>();
  for (const item of additions) {
    let bucket = byTask.get(item.taskId);
    if (bucket === undefined) {
      bucket = { headerAdded: 0, byLine: new Map() };
      byTask.set(item.taskId, bucket);
    }
    bucket.headerAdded += item.qualified;
    if (item.processLineId !== null && item.processLineId !== "") {
      bucket.byLine.set(item.processLineId, (bucket.byLine.get(item.processLineId) ?? 0) + item.qualified);
    }
  }
  const commands: ExecutionCommand[] = [];
  for (const [taskId, bucket] of byTask) {
    const task = await ctx.read.getBill("productionTask", taskId);
    const stamp = stampTaskActualEndIfReached({
      task,
      additionsByProcessLineId: bucket.byLine,
      headerAddedQualified: bucket.headerAdded,
    });
    if (stamp !== null) commands.push(stamp);
  }
  return commands;
}
