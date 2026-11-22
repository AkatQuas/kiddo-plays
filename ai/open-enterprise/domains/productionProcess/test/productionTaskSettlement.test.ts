import { describe, expect, it } from "vitest";
import { normalizeExecutionPlan, type PlannerBillSnapshot, type PlannerContext } from "@open-erp/metamodel";
import { planners } from "../modules/productionTask/index.js";

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot {
  return { id, revision: 1, header: { id, ...header }, lines };
}

function context(
  transition: "complete" | "cancel" | "rejectRunning",
  status: string,
  downstream = true,
): PlannerContext {
  const rows: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = downstream ? {
    processAssignment: [
      { id: "asg-review", status: "pendingReview", productionTaskId: "task-1" },
      { id: "asg-approved", status: "awaitingProduction", productionTaskId: "task-1" },
      { id: "asg-running", status: "inProduction", productionTaskId: "task-1" },
      { id: "asg-other", status: "inProduction", productionTaskId: "task-other" },
      { id: "asg-done", status: "completed", productionTaskId: "task-1" },
    ],
    subcontractOrder: [
      { id: "sub-linked", status: "processing" },
      { id: "sub-review", status: "pendingReview" },
      { id: "sub-complete", status: "completed" },
      { id: "sub-unrelated", status: "awaitingOutsource" },
    ],
  } : {};
  return {
    module: "productionTask",
    transition,
    bill: snapshot("task-1", { status, processLineCount: 1 }),
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "subcontractOrder" && id === "sub-linked") {
          return snapshot(id, { status: "processing" }, { lines: [{ productionTaskId: "task-1" }] });
        }
        if (module === "subcontractOrder" && id === "sub-review") {
          return snapshot(id, { status: "pendingReview" }, { lines: [{ productionTaskId: "task-1" }] });
        }
        if (module === "subcontractOrder" && id === "sub-unrelated") {
          return snapshot(id, { status: "awaitingOutsource" }, { lines: [{ productionTaskId: "other-task" }] });
        }
        if (module === "subcontractOrder" && id === "sub-complete") {
          return snapshot(id, { status: "completed" }, { lines: [{ productionTaskId: "task-1" }] });
        }
        throw new Error(`unexpected getBill ${module}:${id}`);
      },
      async listBills(module, query) {
        const found = rows[module] ?? [];
        const where = query.where;
        let filtered = found;
        const applyCond = (field: string, op: string, value: unknown): void => {
          if (field.includes(".")) return;
          if (op === "eq") {
            filtered = filtered.filter((row) => row[field] === value);
          } else if (op === "in" && Array.isArray(value)) {
            filtered = filtered.filter((row) => value.includes(row[field]));
          }
        };
        if (where !== null && where !== undefined && where.kind === "group") {
          for (const child of where.children) {
            if (child.kind === "cond") applyCond(child.field, child.op, child.value);
          }
        } else if (where !== null && where !== undefined && where.kind === "cond") {
          applyCond(where.field, where.op, where.value);
        }
        return { rows: filtered, total: filtered.length };
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

describe("Production task close cascade", () => {
  it("complete force-completes open downstream assignments and open subcontract orders by productionTaskId", async () => {
    const plan = normalizeExecutionPlan(await planners.complete(context("complete", "inProduction")));
    expect(setStatusTargets(plan)).toEqual([
      ["processAssignment", "asg-review", "forceComplete", "pendingReview"],
      ["processAssignment", "asg-approved", "forceComplete", "awaitingProduction"],
      ["processAssignment", "asg-running", "forceComplete", "inProduction"],
      ["subcontractOrder", "sub-linked", "forceComplete", "processing"],
      ["subcontractOrder", "sub-review", "forceComplete", "pendingReview"],
    ]);
  });

  it.each([
    ["cancel", "awaitingLaunch"],
    ["cancel", "inProduction"],
    ["rejectRunning", "inProduction"],
  ] as const)("%s (%s): force-cancels open downstream assignments and closes related open subcontract orders", async (transition, status) => {
    const plan = normalizeExecutionPlan(await planners[transition](context(transition, status)));
    expect(setStatusTargets(plan)).toEqual([
      ["processAssignment", "asg-review", "forceCancel", "pendingReview"],
      ["processAssignment", "asg-approved", "forceCancel", "awaitingProduction"],
      ["processAssignment", "asg-running", "forceCancel", "inProduction"],
      ["subcontractOrder", "sub-linked", "forceCancel", "processing"],
      ["subcontractOrder", "sub-review", "forceCancel", "pendingReview"],
      ["subcontractOrder", "sub-complete", "forceCancel", "completed"],
    ]);
  });

  // A pending-review task has not been dispatched and cannot be selected onto a subcontract order (subcontract lines accept only awaiting-launch or in-production tasks),
  // so Cancel on pending review runs the same planner and gets an empty plan. It only changes this document's status.
  it("cancel while pending review: no downstream assignment or subcontract, and the plan is empty", async () => {
    const plan = normalizeExecutionPlan(await planners.cancel(context("cancel", "pendingReview", false)));
    expect(plan.commands).toEqual([]);
  });
});
