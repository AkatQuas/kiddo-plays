import { describe, expect, it } from "vitest";
import { normalizeExecutionPlan, type PlannerBillSnapshot, type PlannerContext } from "@open-erp/metamodel";
import { planners } from "../modules/productionOrder/index.js";

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot {
  return { id, revision: 1, header: { id, ...header }, lines };
}

function context(transition: "complete" | "cancel", status: string): PlannerContext {
  const rows: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {
    processAssignment: [
      { id: "asg-review", status: "pendingReview" },
      { id: "asg-approved", status: "awaitingProduction" },
      { id: "asg-running", status: "inProduction" },
    ],
    productionTask: [
      { id: "task-review", status: "pendingReview" },
      { id: "task-pending", status: "awaitingLaunch" },
      { id: "task-running", status: "inProduction" },
      { id: "task-done", status: "completed" },
    ],
    subcontractOrder: [
      { id: "sub-linked", status: "processing" },
      { id: "sub-complete", status: "completed" },
      { id: "sub-unrelated", status: "awaitingOutsource" },
    ],
    productionOrder: [],
  };
  return {
    module: "productionOrder",
    transition,
    bill: snapshot("po-1", { status, salesOrderId: "so-1" }),
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "subcontractOrder" && id === "sub-linked") {
          return snapshot(id, { status: "processing" }, { lines: [{ productionTaskId: "task-done" }] });
        }
        if (module === "subcontractOrder" && id === "sub-unrelated") {
          return snapshot(id, { status: "awaitingOutsource" }, { lines: [{ productionTaskId: "other-task" }] });
        }
        if (module === "subcontractOrder" && id === "sub-complete") {
          return snapshot(id, { status: "completed" }, { lines: [{ productionTaskId: "task-done" }] });
        }
        if (module === "salesOrder" && id === "so-1") {
          return snapshot(id, { status: "inProduction" }, { lines: [{ baseQty: 10, shippedBaseQty: 0 }] });
        }
        throw new Error(`unexpected getBill ${module}:${id}`);
      },
      async listBills(module, query) {
        let found = rows[module] ?? [];
        const where = query.where;
        const applyCond = (field: string, op: string, value: unknown): void => {
          if (field.includes(".")) return;
          // When a fixture row has no relation key, do not filter on that condition (same as the previous behavior that only matched status in).
          if (!found.some((row) => Object.prototype.hasOwnProperty.call(row, field))) return;
          if (op === "eq") {
            found = found.filter((row) => row[field] === value);
          } else if (op === "in" && Array.isArray(value)) {
            found = found.filter((row) => value.includes(row[field]));
          }
        };
        if (where?.kind === "group") {
          for (const child of where.children) {
            if (child.kind === "cond") applyCond(child.field, child.op, child.value);
          }
        } else if (where?.kind === "cond") {
          applyCond(where.field, where.op, where.value);
        }
        return { rows: found, total: found.length };
      },
      async invariantBillSummary() { throw new Error("must not read invariants"); },
      async invariantLineSummary() { throw new Error("must not read invariants"); },
    },
  };
}

/** For each setStatus in the plan: who it pushes, which action, and from which status. */
function setStatusTargets(plan: ReturnType<typeof normalizeExecutionPlan>) {
  return plan.commands.map((command) => {
    if (command.type !== "setStatus" || command.target.kind !== "existing") throw new Error(`Unexpected command ${command.type}`);
    return [command.target.module, command.target.id, command.transition, command.expectedStatus];
  });
}

describe("Production order close cascade", () => {
  it("force complete closes assignments, subcontract orders, and tasks at zero output and creates no output documents", async () => {
    const plan = normalizeExecutionPlan(await planners.complete(context("complete", "inProduction")));
    expect(setStatusTargets(plan)).toEqual([
      ["processAssignment", "asg-review", "forceComplete", "pendingReview"],
      ["processAssignment", "asg-approved", "forceComplete", "awaitingProduction"],
      ["processAssignment", "asg-running", "forceComplete", "inProduction"],
      ["subcontractOrder", "sub-linked", "forceComplete", "processing"],
      ["productionTask", "task-review", "forceComplete", "pendingReview"],
      ["productionTask", "task-pending", "forceComplete", "awaitingLaunch"],
      ["productionTask", "task-running", "forceComplete", "inProduction"],
    ]);
  });

  it("completing an order stuck on the old reported status closes only itself and does not touch downstream tasks or assignments", async () => {
    const plan = normalizeExecutionPlan(await planners.complete(context("complete", "reported")));
    expect(plan.commands).toEqual([]);
  });

  it.each(["awaitingRelease", "releasing"])("%s cancel cascades to assignments, subcontract orders, and tasks, and a completed subcontract order also becomes cancelled", async (status) => {
    const plan = normalizeExecutionPlan(await planners.cancel(context("cancel", status)));
    expect(setStatusTargets(plan)).toEqual([
      ["processAssignment", "asg-review", "forceCancel", "pendingReview"],
      ["processAssignment", "asg-approved", "forceCancel", "awaitingProduction"],
      ["processAssignment", "asg-running", "forceCancel", "inProduction"],
      ["subcontractOrder", "sub-linked", "forceCancel", "processing"],
      ["subcontractOrder", "sub-complete", "forceCancel", "completed"],
      ["productionTask", "task-review", "forceCancel", "pendingReview"],
      ["productionTask", "task-pending", "forceCancel", "awaitingLaunch"],
      ["productionTask", "task-running", "forceCancel", "inProduction"],
    ]);
  });
});
