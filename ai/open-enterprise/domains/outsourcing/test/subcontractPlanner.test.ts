import type { ExecutionCommand, PlannerBillSnapshot, PlannerContext } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import { planners } from "../modules/subcontractOrder/index.js";

const snapshot = (
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot => ({ id, revision: 1, header, lines });

type Edge = "approve" | "unapprove" | "issue" | "receive" | "finish" | "close" | "close_processing";

/** Fake production tasks: two tasks share one BOM shape, with different quantities, so the per-task explosion is visible. */
const TASKS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  "task-1": { status: "inProduction", plannedQty: 100, basePlannedQty: 100, unitFactor: 1, unit: "pc", productId: "product-1", productionOrderId: "order-1", bomId: "bom-1", completionMode: "manual" },
  "task-2": { status: "inProduction", plannedQty: 20, basePlannedQty: 20, unitFactor: 1, unit: "pc", productId: "product-2", productionOrderId: "order-2", bomId: "bom-1", completionMode: "automatic" },
};

function context(
  transition: Edge,
  options: {
    readonly status?: "awaitingOutsource" | "processing" | "completed";
    readonly taskIds?: readonly string[];
    readonly receivedByTask?: Readonly<Record<string, number>>;
  } = {},
): PlannerContext {
  const taskIds = options.taskIds ?? ["task-1"];
  // Receipt is the same action on awaiting subcontract, processing, and completed. The test names the starting status.
  const status = transition === "approve"
    ? "pendingReview"
    : options.status ?? (["finish", "close_processing"].includes(transition) ? "processing" : "awaitingOutsource");
  return {
    module: "subcontractOrder",
    transition,
    bill: snapshot("sub-order-1", {
      status,
      code: "SCORD-20260920-001",
      sourceType: "Whole-order subcontract",
      supplierId: "supplier-1",
      issueWarehouseId: "warehouse-issue",
      receiptWarehouseId: "warehouse-receipt",
      orderDate: "2026-09-20",
      plannedDeliveryDate: "2026-09-25",
      createdAt: "2026-09-20T08:00:00.000Z",
    }, {
      lines: taskIds.map((taskId, index) => ({
        id: `sub-order-line-${index + 1}`,
        productionTaskId: taskId,
        taxPrice: 12,
        qty: TASKS[taskId]?.["plannedQty"] ?? 100,
        plannedDeliveryDate: "2026-09-25",
      })),
    }),
    params: {},
    read: {
      getBill: async (module, id) => {
        if (module === "productionTask") {
          const header = TASKS[id];
          if (header === undefined) throw new Error(`unexpected task ${id}`);
          // On approve the task has not been moved yet and is still awaiting launch
          return snapshot(id, transition === "approve" ? { ...header, status: "awaitingLaunch" } : header);
        }
        if (module === "productionOrder" && ["order-1", "order-2"].includes(id)) {
          return snapshot(id, { status: "releasing" });
        }
        if (module === "bom" && id === "bom-1") {
          return snapshot(id, {}, {
            lines: [
              { id: "bom-line-1", unit: "ea", unitQty: 2, lossRate: 0, unitFactor: 1 },
              { id: "bom-line-2", unit: "item", unitQty: 4, lossRate: 2, unitFactor: 1 },
            ],
          });
        }
        throw new Error(`unexpected read ${module}:${id}`);
      },
      listBills: async (module) => module === "warehouse"
        ? { rows: [{ id: "warehouse-subcontract", name: "Subcontract WIP warehouse (gross, before consumption)" }], total: 1 }
        : { rows: [], total: 0 },
      invariantBillSummary: async () => { throw new Error("The subcontract planner must not read an invariant aggregate"); },
      invariantLineSummary: async (_module, _through, filters, summary) => {
        if (summary.field !== "baseQty") throw new Error("The subcontract planner must not read an unknown invariant line aggregate");
        const lineId = String(filters["orderLineId"]);
        const lineIndex = Number(lineId.replace("sub-order-line-", "")) - 1;
        const taskId = taskIds[lineIndex] ?? "";
        const received = options.receivedByTask?.[taskId] ?? 0;
        return { total: received === 0 ? 0 : 1, value: received || null };
      },
    },
  };
}

function createBillOf(commands: readonly ExecutionCommand[]) {
  return commands.find(
    (command): command is Extract<ExecutionCommand, { readonly type: "createBill" }> =>
      command.type === "createBill",
  );
}

describe("Subcontract order planner", () => {
  it("approval moves every production task on the lines, and its production order, to inProduction, and creates no document", async () => {
    const plan = await planners.approve(context("approve", { taskIds: ["task-1", "task-2"] }));
    expect(plan.commands).toEqual([
      {
        type: "setStatus",
        commandId: "start-subcontract-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        transition: "startSubcontract",
        expectedStatus: "awaitingLaunch",
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-task-2",
        target: { kind: "existing", module: "productionTask", id: "task-2" },
        transition: "startSubcontract",
        expectedStatus: "awaitingLaunch",
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-order-order-1",
        target: { kind: "existing", module: "productionOrder", id: "order-1" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-order-order-2",
        target: { kind: "existing", module: "productionOrder", id: "order-2" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
    ]);
  });

  it("whole-order subcontract approval allows a task already in production and also moves an order that is still releasing", async () => {
    const base = context("approve", { taskIds: ["task-1"] });
    const plan = await planners.approve({
      ...base,
      read: {
        ...base.read,
        getBill: async (module: string, id: string) => module === "productionTask"
          ? snapshot(id, { ...TASKS[id], status: "inProduction" })
          : base.read.getBill(module, id),
      },
    });
    expect(plan.commands).toEqual([{
      type: "setStatus",
      commandId: "start-subcontract-order-order-1",
      target: { kind: "existing", module: "productionOrder", id: "order-1" },
      transition: "startProduction",
      expectedStatus: "releasing",
    }]);
  });

  it("whole-order subcontract approval allows a pending-review task and moves it straight into production", async () => {
    const base = context("approve", { taskIds: ["task-1"] });
    const plan = await planners.approve({
      ...base,
      read: {
        ...base.read,
        getBill: async (module: string, id: string) => module === "productionTask"
          ? snapshot(id, { ...TASKS[id], status: "pendingReview" })
          : base.read.getBill(module, id),
      },
    });
    expect(plan.commands).toEqual([
      {
        type: "setStatus",
        commandId: "start-subcontract-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        transition: "startSubcontractFromReview",
        expectedStatus: "pendingReview",
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-order-order-1",
        target: { kind: "existing", module: "productionOrder", id: "order-1" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
    ]);
  });

  it("two lines for the same production task on one order are rejected, or the same task quantity would be promised twice", async () => {
    await expect(planners.approve(context("approve", { taskIds: ["task-1", "task-1"] })))
      .rejects.toThrow(/same production task appears on more than one subcontract line/);
  });

  it("operation subcontract approval moves a task awaiting production into production, and leaves a task already in production", async () => {
    const pending = {
      ...context("approve", { taskIds: ["task-1"] }),
      bill: snapshot("sub-order-1", {
        status: "pendingReview",
        sourceType: "Operation subcontract",
        supplierId: "supplier-1",
        issueWarehouseId: "warehouse-issue",
        receiptWarehouseId: "warehouse-receipt",
      }, {
        lines: [{ productionTaskId: "task-1", processLineId: "pl-1", taxPrice: 12, qty: 50 }],
      }),
    };
    const pendingPlan = await planners.approve(pending);
    expect(pendingPlan.commands).toEqual([
      {
        type: "setGeneratedHeader",
        commandId: "stamp-subcontract-task-start-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        patch: { actualStartAt: { kind: "executionTime" } },
        expectedStatus: "awaitingLaunch",
        expectedRevision: 1,
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        transition: "startSubcontract",
        expectedStatus: "awaitingLaunch",
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-order-order-1",
        target: { kind: "existing", module: "productionOrder", id: "order-1" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
    ]);

    const running = {
      ...pending,
      read: {
        ...pending.read,
        getBill: async (module: string, id: string) => {
          if (module === "productionTask") {
            return snapshot(id, { ...TASKS[id], status: "inProduction" });
          }
          return pending.read.getBill(module, id);
        },
      },
    };
    const runningPlan = await planners.approve(running);
    expect(runningPlan.commands).toEqual([
      {
        type: "setGeneratedHeader",
        commandId: "stamp-subcontract-task-start-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        patch: { actualStartAt: { kind: "executionTime" } },
        expectedStatus: "inProduction",
        expectedRevision: 1,
      },
      {
        type: "setStatus",
        commandId: "start-subcontract-order-order-1",
        target: { kind: "existing", module: "productionOrder", id: "order-1" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
    ]);

    const started = {
      ...running,
      read: {
        ...running.read,
        getBill: async (module: string, id: string) => {
          if (module === "productionTask") {
            return snapshot(id, { ...TASKS[id], status: "inProduction", actualStartAt: "2026-09-01T00:00:00.000Z" });
          }
          return running.read.getBill(module, id);
        },
      },
    };
    const startedPlan = await planners.approve(started);
    expect(startedPlan.commands).toEqual([{
      type: "setStatus",
      commandId: "start-subcontract-order-order-1",
      target: { kind: "existing", module: "productionOrder", id: "order-1" },
      transition: "startProduction",
      expectedStatus: "releasing",
    }]);
  });

  it("when several production tasks belong to one production order, the order is moved only once", async () => {
    const base = context("approve", { taskIds: ["task-1", "task-2"] });
    const plan = await planners.approve({
      ...base,
      read: {
        ...base.read,
        getBill: async (module: string, id: string) => {
          if (module === "productionTask") {
            return snapshot(id, { ...TASKS[id], productionOrderId: "order-1", status: "awaitingLaunch" });
          }
          return base.read.getBill(module, id);
        },
      },
    });
    expect(plan.commands.filter((command) => command.commandId === "start-subcontract-order-order-1")).toHaveLength(1);
  });

  it("issue explodes each production task's default BOM, and the plan does not write companion references or snapshot fields", async () => {
    const plan = await planners.issue(context("issue", { taskIds: ["task-1", "task-2"] }));
    const create = createBillOf(plan.commands);
    expect(create?.module).toBe("subcontractIssue");
    // The header no longer writes productionTaskId. It has moved down to the line.
    expect(create?.header).toEqual({ orderId: "sub-order-1", warehouseId: "warehouse-issue", targetWarehouseId: "warehouse-subcontract" });
    expect(create?.lines["materialLines"]).toEqual([
      { taskLineId: "bom-line-1", productionTaskId: "task-1", unit: "ea", qty: 200 },
      { taskLineId: "bom-line-2", productionTaskId: "task-1", unit: "item", qty: 408 },
      { taskLineId: "bom-line-1", productionTaskId: "task-2", unit: "ea", qty: 40 },
      { taskLineId: "bom-line-2", productionTaskId: "task-2", unit: "item", qty: 81.6 },
    ]);
    expect(JSON.stringify(create)).not.toMatch(/productId|baseQty|requirementBaseQty/);
  });

  it("the receiving warehouse chosen on the dialog overrides the order header", async () => {
    const base = context("receive", { taskIds: ["task-1"] });
    const plan = await planners.receive({
      ...base,
      bill: snapshot(base.bill.id, { ...base.bill.header, receiptWarehouseId: "" }, base.bill.lines),
      params: { warehouseId: "warehouse-picked" },
    });
    expect(createBillOf(plan.commands)?.header).toMatchObject({ warehouseId: "warehouse-picked" });
  });

  it("one receipt covers every task, defaults to each task quantity, and carries the order's supplier, warehouse, and processing price", async () => {
    const plan = await planners.receive(context("receive", { taskIds: ["task-1", "task-2"] }));
    const create = createBillOf(plan.commands);
    expect(create?.module).toBe("subcontractReceipt");
    expect(create?.header).toEqual({
      orderId: "sub-order-1",
      supplierId: "supplier-1",
      warehouseId: "warehouse-receipt",
    });
    expect(create?.lines["lines"]).toEqual([
      { orderLineId: "sub-order-line-1", productionTaskId: "task-1", qty: 100, taxPrice: 12, qualifiedQty: 100, defectQty: 0, defectDeduction: 0, defectTypeIds: "" },
      { orderLineId: "sub-order-line-2", productionTaskId: "task-2", qty: 20, taxPrice: 12, qualifiedQty: 20, defectQty: 0, defectDeduction: 0, defectTypeIds: "" },
    ]);
    const reports = plan.commands.filter((command) => command.type === "createBill" && command.module === "processReport");
    expect(reports).toHaveLength(2);
    expect(reports.map((command) => command.type === "createBill" ? command.header : null)).toEqual([
      expect.objectContaining({
        reportType: "Sub-contract",
        productionTaskId: "task-1",
        sourceBillCode: { kind: "createdField", commandId: "subcontract-receipt", field: "code" },
        subcontractReceiptId: { kind: "createdId", commandId: "subcontract-receipt" },
        assignedQty: 100,
        plannedStartDate: "2026-09-20T00:00:00.000Z",
        plannedEndDate: "2026-09-25T00:00:00.000Z",
        assignedAt: "2026-09-20T08:00:00.000Z",
        cumulativeReportedQty: 100,
      }),
      expect.objectContaining({
        reportType: "Sub-contract",
        productionTaskId: "task-2",
        sourceBillCode: { kind: "createdField", commandId: "subcontract-receipt", field: "code" },
        subcontractReceiptId: { kind: "createdId", commandId: "subcontract-receipt" },
        assignedQty: 20,
        cumulativeReportedQty: 20,
      }),
    ]);
    expect(plan.commands.some((command) => command.type === "setStatus")).toBe(false);
  });

  it("another receipt while processing uses the remaining quantity per task, and a task that is full is skipped instead of blocking the whole order", async () => {
    const plan = await planners.receive(
      context("receive", { status: "processing", taskIds: ["task-1", "task-2"], receivedByTask: { "task-1": 100, "task-2": 5 } }),
    );
    const create = createBillOf(plan.commands);
    expect(create?.lines["lines"]).toEqual([
      { orderLineId: "sub-order-line-2", productionTaskId: "task-2", qty: 15, taxPrice: 12, qualifiedQty: 15, defectQty: 0, defectDeduction: 0, defectTypeIds: "" },
    ]);
  });

  it("another receipt is refused only when every task is fully received, and the message says they are all full", async () => {
    await expect(planners.receive(
      context("receive", { status: "processing", taskIds: ["task-1", "task-2"], receivedByTask: { "task-1": 100, "task-2": 20 } }),
    )).rejects.toThrow(/fully received/);
  });

  it("after completion a receipt is still allowed for the remaining quantity", async () => {
    const plan = await planners.receive(
      context("receive", { status: "completed", taskIds: ["task-1", "task-2"], receivedByTask: { "task-1": 100, "task-2": 5 } }),
    );
    const create = createBillOf(plan.commands);
    expect(create?.lines["lines"]).toEqual([
      { orderLineId: "sub-order-line-2", productionTaskId: "task-2", qty: 15, taxPrice: 12, qualifiedQty: 15, defectQty: 0, defectDeduction: 0, defectTypeIds: "" },
    ]);
  });

  it("a historical source assignment that is no longer valid must not block Receive subcontract", async () => {
    const base = context("receive", { status: "completed", taskIds: ["task-1"], receivedByTask: { "task-1": 5 } });
    const plan = await planners.receive({
      ...base,
      bill: snapshot("sub-order-1", {
        ...base.bill.header,
        processAssignmentId: "sample source assignment",
      }, base.bill.lines),
    });
    const reports = plan.commands.filter(
      (command): command is Extract<ExecutionCommand, { readonly type: "createBill" }> =>
        command.type === "createBill" && command.module === "processReport",
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]?.header["processAssignmentId"]).toBeNull();
  });

  it.each([
    ["unapprove", "resumeAfterSubcontractClose"],
    ["close", "resumeAfterSubcontractClose"],
    ["close_processing", "cancel"],
  ] as const)("%s moves every source production task to %s in the same transaction", async (source, target) => {
    const plan = await planners[source](context(source, { taskIds: ["task-1", "task-2"] }));
    expect(plan.commands).toEqual(["task-1", "task-2"].map((taskId) => ({
      type: "setStatus",
      commandId: `close-production-task-${taskId}`,
      target: { kind: "existing", module: "productionTask", id: taskId },
      transition: target,
      expectedStatus: "inProduction",
    })));
  });

  it("completing the subcontract follows the task's frozen completion mode: both manual and automatic end at completed", async () => {
    const plan = await planners.finish(context("finish", { taskIds: ["task-1", "task-2"] }));
    expect(plan.commands).toEqual([
      {
        type: "setStatus",
        commandId: "close-production-task-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        transition: "markSubcontractReady",
        expectedStatus: "inProduction",
      },
      {
        type: "setStatus",
        commandId: "close-production-task-task-2",
        target: { kind: "existing", module: "productionTask", id: "task-2" },
        transition: "autoCompleteSubcontract",
        expectedStatus: "inProduction",
      },
    ]);
  });

  it("completion is refused while an issue still has unfinished standard consumption, a return, or a loss to confirm", async () => {
    await expect(planners.finish({
      module: "subcontractOrder",
      transition: "finish",
      bill: snapshot("sub-order-1", { status: "processing" }, { lines: [{ productionTaskId: "task-1" }] }),
      params: {},
      read: {
        getBill: async (module, id) => {
          if (module === "subcontractIssue" && id === "issue-1") {
            return snapshot(id, { code: "SCISS-001" }, { materialLines: [{ unclosedBaseQty: 2 }] });
          }
          throw new Error(`unexpected read ${module}:${id}`);
        },
        listBills: async (module) => module === "subcontractIssue"
          ? { rows: [{ id: "issue-1", status: "issuedOut" }], total: 1 }
          : { rows: [], total: 0 },
        invariantBillSummary: async () => { throw new Error("Must not aggregate the header"); },
        invariantLineSummary: async () => { throw new Error("Must not aggregate lines"); },
      },
    })).rejects.toThrow(/still has 2 main-unit material open.*Return the leftover.*confirm the loss/);
  });
});
