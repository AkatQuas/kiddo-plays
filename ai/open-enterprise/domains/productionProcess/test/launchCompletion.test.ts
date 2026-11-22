import { plannerCreateTargetsOf, sealModule } from "@open-erp/metamodel";
import type { ActionPreparerContext, PlannerBillSnapshot, PlannerContext } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import productionTaskDraft, { actionPreparers, planners } from "../modules/productionTask/index.js";
import { planners as processReportPlanners } from "../modules/processReport/index.js";
import { planners as processAssignmentPlanners } from "../modules/processAssignment/index.js";

const productionTask = sealModule(productionTaskDraft, { code: "productionTask", domain: "productionProcess" });

const NOW = new Date("2026-08-06T08:00:00.000Z");

describe("Production task views and the simplified inbound contract", () => {
  it("no longer references the removed stockIn inbound summary fields", () => {
    const viewFields = [
      ...productionTask.views.list.columns,
      ...productionTask.views.form.flatMap((group) => group.fields),
    ];

    expect(viewFields).not.toEqual(expect.arrayContaining(["receivedQty", "pendingReceiptQty", "receiptableQty"]));
  });
});

const snapshot = (
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot => ({ id, revision: 1, header, lines });

function launchContext(mode: "Sequential production" | "Unordered production", qty: number, transition = "launchAll"): PlannerContext {
  return {
    module: "productionTask",
    transition,
    bill: snapshot("task-1", {
      status: "awaitingLaunch",
      productionOrderId: "order-1",
      routingId: "routing-v1",
      unit: "piece",
      unitFactor: 1,
      plannedQty: 100,
      basePlannedQty: 100,
      plannedStartDate: "2026-08-06T08:00:00.000Z",
      plannedEndDate: "2026-08-07T08:00:00.000Z",
      remark: "Customer requirement",
    }),
    params: {
      launchQty: qty,
      productionMode: mode,
      launchedAt: NOW.toISOString(),
      launchProcessLines: [
        { operationId: "op-1", sequence: 10, teamId: "team-1" },
        { operationId: "op-2", sequence: 20, teamId: "team-2" },
      ],
    },
    read: {
      getBill: async (module, id) => {
        if (module === "routing") return snapshot(id, {}, { lines: [
          { operationId: "op-1", sequence: 10, defaultTeamId: "team-default-1", pieceRate: 1, outsourcingMode: "No subcontract", standardTimePerPiece: 30 },
          { operationId: "op-2", sequence: 20, defaultTeamId: "team-default-2", pieceRate: 2, outsourcingMode: "No subcontract", standardTimePerPiece: 1 },
        ] });
        if (module === "operation") return snapshot(id, { standardTimeUnit: id === "op-1" ? "Per minute" : "Per hour" });
        throw new Error(`unexpected ${module}`);
      },
      listBills: async () => ({ rows: [], total: 0 }),
      invariantBillSummary: async () => {
        throw new Error("the launch planner must not aggregate invariants");
      },
      invariantLineSummary: async () => {
        throw new Error("the launch planner must not aggregate invariant lines");
      },
    },
  };
}

describe("Scheduling operations on a production task", () => {
  it("opening schedule operations fills planned quantity, unordered mode, and the default team from the frozen routing", async () => {
    const context = launchContext("Unordered production", 100);
    const params = await actionPreparers.launchAll({
      module: context.module,
      transition: context.transition,
      bill: context.bill,
      read: context.read,
      now: NOW,
    });
    expect(params).toEqual({
      launchQty: 100,
      productionMode: "Unordered production",
      launchedAt: NOW.toISOString(),
      /**
       * 3.5.0: the preparer also supplies planned start and end for each operation.
       * This routing has no `processType` (legacy data), so it is treated as Sequential production.
       * The task window (08:00 on 8/6 to 08:00 on 8/7, 24 hours) is split into two back-to-back segments.
       * Split evenly rather than copying the whole window onto every operation. The latter would start the second operation at the same instant the first one ends,
       * and the sequence gate would reject it immediately. That would be a default that is doomed the moment the dialog opens.
       */
      launchProcessLines: [
        {
          operationId: "op-1", sequence: 10, teamId: "team-default-1",
          plannedStartDate: "2026-08-06T08:00:00.000Z",
          plannedEndDate: "2026-08-06T20:00:00.000Z",
        },
        {
          operationId: "op-2", sequence: 20, teamId: "team-default-2",
          plannedStartDate: "2026-08-06T20:00:00.000Z",
          plannedEndDate: "2026-08-07T08:00:00.000Z",
        },
      ],
    });
  });

  it("after per-operation scheduling, Sequential production does not allow a later operation to start before an earlier one", async () => {
    const context = launchContext("Sequential production", 100);
    await expect(planners.launchAll({
      ...context,
      params: {
        ...context.params,
        launchProcessLines: [
          { operationId: "op-1", sequence: 10, teamId: "team-1", plannedStartDate: "2026-08-06T08:00:00.000Z", plannedEndDate: "2026-08-06T20:00:00.000Z" },
          // The second operation finishes two hours before the first. That is a bad schedule under Sequential production.
          { operationId: "op-2", sequence: 20, teamId: "team-2", plannedStartDate: "2026-08-06T18:00:00.000Z", plannedEndDate: "2026-08-07T08:00:00.000Z" },
        ],
      },
    })).rejects.toThrow(/Sequential production/);
  });

  /**
   * A datetime in the parameters is already a `Date` when it reaches the planner (`normalizeField` does that),
   * not the string on the wire. The cases above used string fixtures, so they never showed this.
   * The first real schedule in production returned 500. `optionalText` only accepted a string, so a correctly filled
   * schedule threw "operation 1 start time must be non-empty text", and the client only saw "internal server error".
   * This case passes the real runtime shape and pins that path.
   */
  it("per-operation start and end are accepted when they are Date objects, the real runtime shape", async () => {
    const context = launchContext("Sequential production", 100);
    const plan = await planners.launchAll({
      ...context,
      params: {
        ...context.params,
        launchProcessLines: [
          {
            operationId: "op-1", sequence: 10, teamId: "team-1",
            plannedStartDate: new Date("2026-08-06T08:00:00.000Z"),
            plannedEndDate: new Date("2026-08-06T20:00:00.000Z"),
          },
          {
            operationId: "op-2", sequence: 20, teamId: "team-2",
            plannedStartDate: new Date("2026-08-06T20:00:00.000Z"),
            plannedEndDate: new Date("2026-08-07T08:00:00.000Z"),
          },
        ],
      },
    });
    const appended = plan.commands.find((command) => command.type === "appendSourceLines" && command.table === "processLines");
    expect(appended?.type === "appendSourceLines" ? appended.rows.map((row) => row["plannedStartDate"]) : null).toEqual([
      "2026-08-06T08:00:00.000Z",
      "2026-08-06T20:00:00.000Z",
    ]);
  });

  it("per-operation scheduling writes each operation's own start and end onto the task operation line, instead of sharing the header pair", async () => {
    const context = launchContext("Sequential production", 100);
    const plan = await planners.launchAll({
      ...context,
      params: {
        ...context.params,
        launchProcessLines: [
          { operationId: "op-1", sequence: 10, teamId: "team-1", plannedStartDate: "2026-08-06T08:00:00.000Z", plannedEndDate: "2026-08-06T20:00:00.000Z" },
          { operationId: "op-2", sequence: 20, teamId: "team-2", plannedStartDate: "2026-08-06T20:00:00.000Z", plannedEndDate: "2026-08-07T08:00:00.000Z" },
        ],
      },
    });
    const appended = plan.commands.find((command) => command.type === "appendSourceLines" && command.table === "processLines");
    expect(appended?.type === "appendSourceLines" ? appended.rows.map((row) => row["plannedStartDate"]) : null).toEqual([
      "2026-08-06T08:00:00.000Z",
      "2026-08-06T20:00:00.000Z",
    ]);
    expect(appended?.type === "appendSourceLines" ? appended.rows.map((row) => row["plannedEndDate"]) : null).toEqual([
      "2026-08-06T20:00:00.000Z",
      "2026-08-07T08:00:00.000Z",
    ]);
  });

  it("an operation with no equipment type cannot carry production equipment", async () => {
    const context = launchContext("Unordered production", 100);
    await expect(planners.launchAll({
      ...context,
      params: {
        ...context.params,
        launchProcessLines: [
          { operationId: "op-1", sequence: 10, teamId: "team-1" },
          { operationId: "op-2", sequence: 20, teamId: "team-2", equipmentId: "equipment-2" },
        ],
      },
    })).rejects.toThrow(/has no equipment type/);
  });

  it("scheduling operations only appends task operation lines and does not create any other document", async () => {
    const plan = await planners.launchAll(launchContext("Sequential production", 100));
    expect(plan.commands.every((command) => command.type !== "createBill")).toBe(true);
    const appended = plan.commands.find((command) => command.type === "appendSourceLines" && command.table === "processLines");
    expect(appended?.type === "appendSourceLines" ? appended.rows.map((row) => row["plannedQty"]) : null).toEqual([100, 100]);
  });

  it("unordered scheduling also writes each operation onto the task operation lines", async () => {
    const plan = await planners.launchAll(launchContext("Unordered production", 100));
    const appended = plan.commands.find((command) => command.type === "appendSourceLines" && command.table === "processLines");
    expect(appended?.type === "appendSourceLines" ? appended.rows.map((row) => row["plannedQty"]) : null).toEqual([100, 100]);
  });

  it("after storage normalizes the task plan window to Date, scheduling every operation can still write the operation lines", async () => {
    const base = launchContext("Unordered production", 100, "launchAll");
    const plan = await planners.launchAll({
      ...base,
      bill: snapshot("task-1", {
        ...base.bill.header,
        plannedStartDate: new Date("2026-08-06T08:00:00.000Z"),
        plannedEndDate: new Date("2026-08-07T08:00:00.000Z"),
      }),
    });
    const appended = plan.commands.find((command) => command.type === "appendSourceLines" && command.table === "processLines");
    expect(appended?.type === "appendSourceLines" ? appended.rows[0]?.["plannedStartDate"] : null).toBe("2026-08-06T08:00:00.000Z");
  });
});

describe("Finished-goods subcontract on a production task", () => {
  it("closing an assignment only links existing subcontract orders and does not mark a subcontract order as system-generated", () => {
    expect(plannerCreateTargetsOf(processAssignmentPlanners)).toEqual({
      report: ["processReport", "performanceSettlement"],
    });
  });
  it("a production task no longer pushes a subcontract order; a subcontract order is created by hand", () => {
    // There used to be a `create_subcontract_order` planner edge. One click created
    // a subcontract order that only carried this task. It forced one task to one order, so a batch sent out together
    // was split into N documents, and each one negotiated supplier, warehouse, and delivery date on its own.
    expect(Object.keys(planners)).not.toContain("create_subcontract_order");
    expect(productionTask.lifecycle.transitions.map((edge) => edge.code)).not.toContain("create_subcontract_order");
  });

  it("the remaining startSubcontract only reacts to subcontract order approval and creates no document itself", () => {
    const edge = productionTask.lifecycle.transitions.find((candidate) => candidate.code === "startSubcontract");
    expect(edge).toMatchObject({ from: "awaitingLaunch", to: "inProduction" });
    expect(edge?.push).toBeNull();
    const fromReview = productionTask.lifecycle.transitions.find((candidate) => candidate.code === "startSubcontractFromReview");
    expect(fromReview).toMatchObject({ from: "pendingReview", to: "inProduction", internal: true });
    expect(Object.keys(planners)).not.toContain("startSubcontract");
    expect(Object.keys(planners)).not.toContain("startSubcontractFromReview");
    // Clicking it by hand must be blocked. The gate requires an approved subcontract order (awaitingOutsource or processing),
    // and that order's coordinate moved from the header to the line, so related_agg goes through "lines".
    const gate = productionTask.preconditions.find((rule) => rule.id === "subcontract_order_approved");
    expect(gate).toMatchObject({ onTransition: "startSubcontract", level: "block" });
    expect(gate?.check).toMatchObject({ primitive: "related_agg" });
    const reviewGate = productionTask.preconditions.find((rule) => rule.id === "subcontract_order_approved_from_review");
    expect(reviewGate).toMatchObject({ onTransition: "startSubcontractFromReview", level: "block" });
    // The subcontract order's production task coordinate moved from the header to the line, so the aggregate must count through the child table.
    expect(JSON.stringify(gate?.check)).toContain("subcontractOrder");
    expect(JSON.stringify(gate?.check)).toContain("lines");
    expect(productionTask.lifecycle.transitions.filter((edge) => edge.from === "inProduction").map((edge) => edge.code)).toEqual(
      expect.arrayContaining(["markSubcontractReady", "autoCompleteSubcontract", "resumeAfterSubcontractClose"]),
    );
  });

  it("the production task no longer depends on the simplified stockIn inbound summary fields", () => {
    const removed = new Set(["internalReceivedBaseQty", "subcontractReceivedBaseQty", "receivedBaseQty"]);
    expect(productionTask.fields.map((field) => field.key).filter((field) => removed.has(field))).toEqual([]);
  });
});

describe("The qualified shortfall on a task operation line is no longer turned into a supply document", () => {
  it("approving a work report only creates a pay slip and does not create a completion supply", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-2",
        qualifiedQty: 5,
        defectQty: 0,
        workHours: 0,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        getBill: async (module, id) => {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 100,
              approvedQualifiedQty: 0,
            }, { sourceLines: [{ processLineId: "line-2", assignedQty: 100 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", unitFactor: 1 }, {
              processLines: [
                { id: "line-1", plannedQty: 100, approvedQualifiedQty: 10 },
                { id: "line-2", plannedQty: 100, approvedQualifiedQty: 0 },
              ],
            });
          }
          throw new Error(`unexpected ${module}`);
        },
        listBills: async () => ({ rows: [], total: 0 }),
        invariantBillSummary: async (module) => module === "processAssignment"
          ? { total: 0, value: 0 }
          : { total: 0, value: null },
        invariantLineSummary: async () => {
          throw new Error("work-report approval must not aggregate lines");
        },
      },
    };
    const commands = (await processReportPlanners.approve(ctx)).commands;
    expect(commands.some((candidate) => candidate.type === "createBill" && candidate.module === "productionCompletion")).toBe(false);
    expect(commands.find((candidate) => candidate.type === "createBill")?.module).toBe("performanceSettlement");
  });

  it("the production task does not store a receivable shortfall; inbound occupancy and completed receipts are separate columns", () => {
    expect(productionTask.fields.find((candidate) => candidate.key === "baseCompletedQty")).toBeUndefined();
    expect(productionTask.fields.find((candidate) => candidate.key === "pendingInboundQty")).toBeUndefined();
    expect(productionTask.fields.find((candidate) => candidate.key === "inboundOccupiedQty")).toBeUndefined();
    expect(productionTask.fields.find((candidate) => candidate.key === "inboundReceivedQty")?.derive)
      .toMatchObject({
        kind: "rollup",
        from: "productionReceipt",
        match: "productionTaskId",
        where: { status: "completed" },
      });
  });

  it("reported defect quantity of finished goods is the sum of approved report defectQty and excludes pending review", () => {
    expect(productionTask.fields.find((candidate) => candidate.key === "approvedDefectQty")?.derive)
      .toMatchObject({
        kind: "rollup",
        from: "processReport",
        match: "productionTaskId",
        measure: "defectQty",
        where: { status: "completed" },
      });
  });
});

describe("Starting piece rate on an assignment", () => {
  function assignPrepareContext(opts?: {
    readonly params?: Readonly<Record<string, unknown>>;
    readonly lines?: readonly Readonly<Record<string, unknown>>[];
  }): ActionPreparerContext {
    const lines = opts?.lines ?? [
      { id: "line-cut", operationId: "op-cut", unassignedQty: 50, pieceRate: 3.5 },
      { id: "line-press", operationId: "op-press", unassignedQty: 50, pieceRate: 8 },
    ];
    return {
      module: "productionTask",
      transition: "assign",
      bill: snapshot("task-1", { status: "inProduction", routingId: "routing-1" }, { processLines: lines }),
      now: NOW,
      ...(opts?.params === undefined ? {} : { params: opts.params }),
      read: {
        getBill: async (module, id) => {
          if (module === "routing") {
            return snapshot(id, {}, { lines: [
              { operationId: "op-cut", sequence: 10, pieceRate: 3.5 },
              { operationId: "op-press", sequence: 20, pieceRate: 8 },
            ] });
          }
          if (module === "operation") {
            return snapshot(id, { pieceRate: id === "op-cut" ? 4.2 : 9 });
          }
          throw new Error(`unexpected ${module}`);
        },
        listBills: async () => ({ rows: [], total: 0 }),
        invariantBillSummary: async () => ({ total: 0, value: null }),
        invariantLineSummary: async () => ({ total: 0, value: null }),
      },
    };
  }

  it("when several operations are unassigned, params.processLineId brings that task operation's frozen rate", async () => {
    const cut = await actionPreparers.assign(assignPrepareContext({
      params: { processLineId: "line-cut" },
    }));
    expect(cut["assignmentPieceRate"]).toBe(3.5);
    const press = await actionPreparers.assign(assignPrepareContext({
      params: { processLineId: "line-press" },
    }));
    expect(press["assignmentPieceRate"]).toBe(8);
  });

  it("with exactly one unassigned operation and no processLineId, that operation's rate is still filled", async () => {
    const params = await actionPreparers.assign(assignPrepareContext({
      lines: [
        { id: "line-cut", operationId: "op-cut", unassignedQty: 50, pieceRate: 3.5 },
        { id: "line-press", operationId: "op-press", unassignedQty: 0, pieceRate: 8 },
      ],
    }));
    expect(params["assignmentPieceRate"]).toBe(3.5);
  });

  it("after the routing or operation master changes price, the task operation's frozen rate is still used", async () => {
    const params = await actionPreparers.assign(assignPrepareContext({
      params: { processLineId: "line-cut" },
      lines: [{ id: "line-cut", operationId: "op-cut", unassignedQty: 50, pieceRate: 6.6 }],
    }));
    expect(params["assignmentPieceRate"]).toBe(6.6);
  });

  it("with several unassigned operations and no processLineId, assignmentPieceRate is not filled", async () => {
    const params = await actionPreparers.assign(assignPrepareContext());
    expect(params).not.toHaveProperty("assignmentPieceRate");
  });
});
