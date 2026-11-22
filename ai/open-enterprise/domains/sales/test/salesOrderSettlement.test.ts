import { describe, expect, it } from "vitest";
import { normalizeExecutionPlan, type PlannerBillSnapshot, type PlannerContext } from "@open-erp/metamodel";
import { planners } from "../modules/salesOrder/index.js";

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot {
  return { id, revision: 1, header: { id, ...header }, lines };
}

function context(transition: "complete" | "cancelRunning"): PlannerContext {
  const rows: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {
    productionOrder: [
      { id: "po-running", status: "inProduction", salesOrderId: "so-1" },
      { id: "po-pending", status: "awaitingRelease", salesOrderId: "so-1" },
      // Finished, but a subcontract order is still open: sales complete must close it, and must not scan only open production orders.
      { id: "po-done", status: "finished", salesOrderId: "so-1" },
      // A pending-review production order has its own system cancel action. It does not share "cancel with the sales order" used by the other statuses.
      { id: "po-review", status: "pendingReview", salesOrderId: "so-1" },
    ],
    processAssignment: [
      // Dispatch is linked by productionTaskId. productionOrderId is omitted on purpose, to cover "cascade from the task id alone".
      { id: "asg-review", status: "pendingReview", productionTaskId: "task-pending" },
      { id: "asg-running", status: "inProduction", productionTaskId: "task-running" },
    ],
    productionTask: [
      { id: "task-pending", status: "awaitingLaunch", productionOrderId: "po-running" },
      { id: "task-running", status: "inProduction", productionOrderId: "po-running" },
      { id: "task-done", status: "completed", productionOrderId: "po-running" },
      { id: "task-on-done-po", status: "completed", productionOrderId: "po-done" },
    ],
    subcontractOrder: [
      { id: "sub-linked", status: "processing" },
      { id: "sub-on-done-po", status: "awaitingOutsource" },
      { id: "sub-complete", status: "completed" },
      { id: "sub-unrelated", status: "awaitingOutsource" },
    ],
  };
  return {
    module: "salesOrder",
    transition,
    bill: snapshot("so-1", { status: "inProgress" }),
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "subcontractOrder" && id === "sub-linked") {
          return snapshot(id, { status: "processing" }, { lines: [{ productionTaskId: "task-done" }] });
        }
        if (module === "subcontractOrder" && id === "sub-on-done-po") {
          return snapshot(id, { status: "awaitingOutsource" }, { lines: [{ productionTaskId: "task-on-done-po" }] });
        }
        if (module === "subcontractOrder" && id === "sub-unrelated") {
          return snapshot(id, { status: "awaitingOutsource" }, { lines: [{ productionTaskId: "other-task" }] });
        }
        if (module === "subcontractOrder" && id === "sub-complete") {
          return snapshot(id, { status: "completed" }, { lines: [{ productionTaskId: "task-done" }] });
        }
        if (module === "productionOrder") {
          const row = (rows["productionOrder"] ?? []).find((item) => item["id"] === id);
          if (row !== undefined) return snapshot(id, row);
        }
        throw new Error(`unexpected getBill ${module}:${id}`);
      },
      async listBills(module, query) {
        const found = rows[module] ?? [];
        const where = query.where;
        let filtered = found;
        const applyCond = (field: string, op: string, value: unknown): void => {
          // Line conditions are interpreted in storage. This unit test checks the link again in getBill, and skips them here so the candidates are not filtered empty.
          if (field.includes(".")) return;
          if (op === "eq") {
            filtered = filtered.filter((row) => row[field] === value);
          } else if (op === "in" && Array.isArray(value)) {
            filtered = filtered.filter((row) => value.includes(row[field]));
          }
        };
        if (where !== null && where !== undefined && where.kind === "group") {
          for (const child of where.children) {
            if (child.kind !== "cond") continue;
            applyCond(child.field, child.op, child.value);
          }
        } else if (where !== null && where !== undefined && where.kind === "cond") {
          applyCond(where.field, where.op, where.value);
        }
        return { rows: filtered, total: filtered.length };
      },
      async listReferencedBills() {
        return { rows: [], total: 0, truncated: false };
      },
      async invariantBillSummary() { throw new Error("must not read an invariant"); },
      async invariantLineSummary() { throw new Error("must not read an invariant"); },
    },
  };
}

/** Each setStatus in the plan: who it pushes, which action, and from which status. */
function setStatusTargets(plan: ReturnType<typeof normalizeExecutionPlan>) {
  return plan.commands.map((command) => {
    if (command.type !== "setStatus" || command.target.kind !== "existing") throw new Error(`unexpected command ${command.type}`);
    return [command.target.module, command.target.id, command.transition, command.expectedStatus];
  });
}

describe("sales-order close cascade", () => {
  it("complete closes every linked subcontract order first, including those under a finished production order, then cascades the open production chain", async () => {
    const plan = normalizeExecutionPlan(await planners.complete(context("complete")));
    expect(setStatusTargets(plan)).toEqual([
      ["subcontractOrder", "sub-linked", "forceComplete", "processing"],
      ["subcontractOrder", "sub-on-done-po", "forceComplete", "awaitingOutsource"],
      ["processAssignment", "asg-review", "forceComplete", "pendingReview"],
      ["processAssignment", "asg-running", "forceComplete", "inProduction"],
      ["productionTask", "task-pending", "forceComplete", "awaitingLaunch"],
      ["productionTask", "task-running", "forceComplete", "inProduction"],
      ["productionOrder", "po-running", "forceComplete", "inProduction"],
      ["productionOrder", "po-pending", "forceComplete", "awaitingRelease"],
      ["productionOrder", "po-review", "forceComplete", "pendingReview"],
    ]);
  });

  it("cancel force-cancels or closes along the same link chain, and a pending-review production order uses its own cancel action", async () => {
    const plan = normalizeExecutionPlan(await planners.cancelRunning(context("cancelRunning")));
    expect(setStatusTargets(plan)).toEqual([
      ["subcontractOrder", "sub-linked", "forceCancel", "processing"],
      ["subcontractOrder", "sub-on-done-po", "forceCancel", "awaitingOutsource"],
      ["subcontractOrder", "sub-complete", "forceCancel", "completed"],
      ["processAssignment", "asg-review", "forceCancel", "pendingReview"],
      ["processAssignment", "asg-running", "forceCancel", "inProduction"],
      ["productionTask", "task-pending", "forceCancel", "awaitingLaunch"],
      ["productionTask", "task-running", "forceCancel", "inProduction"],
      ["productionOrder", "po-running", "forceCancel", "inProduction"],
      ["productionOrder", "po-pending", "forceCancel", "awaitingRelease"],
      ["productionOrder", "po-review", "forceCancelFromReview", "pendingReview"],
    ]);
  });
});
