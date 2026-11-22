import { describe, expect, it } from "vitest";
import {
  allProcessLinesReachedPlan,
  stampTaskActualEndIfReached,
  taskHeaderReachedPlan,
} from "../modules/productionTask/taskActualEnd.js";

describe("Production task actual-end stamp", () => {
  it("the set is complete only when every operation reaches its plan; one full operation is not enough", () => {
    const lines = [
      { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 50 },
      { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
    ];
    expect(allProcessLinesReachedPlan(lines)).toBe(false);
    expect(allProcessLinesReachedPlan(lines, new Map([["line-iron", 50]]))).toBe(true);
  });

  it("with no operation lines, fall back to header qualified quantity reaching the plan", () => {
    expect(taskHeaderReachedPlan({ plannedQty: 100, approvedQualifiedQty: 30 }, 70)).toBe(true);
    expect(taskHeaderReachedPlan({ plannedQty: 100, approvedQualifiedQty: 30 }, 69)).toBe(false);
  });

  it("an existing actual end time is not written again", () => {
    const stamp = stampTaskActualEndIfReached({
      task: {
        id: "task-1",
        revision: 1,
        header: { status: "inProduction", actualEndAt: "2026-09-01T00:00:00.000Z" },
        lines: {
          processLines: [{ id: "line-cut", plannedQty: 50, approvedQualifiedQty: 50 }],
        },
      },
    });
    expect(stamp).toBeNull();
  });

  it("clears a mistaken stamp when the set is not complete, and does not clear a completed task", () => {
    const clear = stampTaskActualEndIfReached({
      task: {
        id: "task-1",
        revision: 2,
        header: { status: "inProduction", actualEndAt: "2026-09-01T00:00:00.000Z" },
        lines: {
          processLines: [
            { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 50 },
            { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
          ],
        },
      },
    });
    expect(clear).toMatchObject({
      commandId: "clear-task-end-task-1",
      patch: { actualEndAt: null },
    });

    const keep = stampTaskActualEndIfReached({
      task: {
        id: "task-1",
        revision: 3,
        header: { status: "completed", actualEndAt: "2026-09-01T00:00:00.000Z" },
        lines: {
          processLines: [
            { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 50 },
            { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
          ],
        },
      },
    });
    expect(keep).toBeNull();
  });
});
