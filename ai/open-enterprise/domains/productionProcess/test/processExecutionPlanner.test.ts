import {
  normalizeExecutionPlan,
  normalizeTransitionParams,
  type PlannerContext,
  type Query,
  type QueryNode,
  sealModule,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import { batchActions as taskBatchActions, planners as taskPlanners } from "../modules/productionTask/index.js";
import productionTaskDraft from "../modules/productionTask/index.js";
import { actionPreparers as assignmentActionPreparers, planners as assignmentPlanners } from "../modules/processAssignment/index.js";
import processAssignmentDraft from "../modules/processAssignment/index.js";
import { planners as processReportPlanners } from "../modules/processReport/index.js";
import processReportDraft from "../modules/processReport/index.js";

const productionTask = sealModule(productionTaskDraft, { code: "productionTask", domain: "productionProcess" });
const processAssignment = sealModule(processAssignmentDraft, { code: "processAssignment", domain: "productionProcess" });
const processReport = sealModule(processReportDraft, { code: "processReport", domain: "productionProcess" });

const NOW = new Date("2026-08-06T04:00:00.000Z");

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
) {
  return { id, revision: 1, header, lines };
}

function queryExcludesId(query: Query, id: string): boolean {
  const walk = (node: QueryNode | null): boolean => {
    if (node === null) return false;
    if (node.kind === "cond") {
      if (node.field !== "id") return false;
      if (node.op === "ne") return node.value === id;
      return node.op === "not_in" && Array.isArray(node.value) && node.value.includes(id);
    }
    return node.children.some(walk);
  };
  return walk(query.where);
}

/** Open assignments still in the simulated store snapshot. Rows the query excluded do not count. */
function openAssignmentSummary(openIds: readonly string[]) {
  return async (module: string, query: Query) => {
    if (module !== "processAssignment") return { total: 0, value: null };
    const remaining = openIds.filter((id) => !queryExcludesId(query, id)).length;
    return { total: remaining, value: remaining === 0 ? null : remaining };
  };
}

function taskContext(overrides: Partial<PlannerContext> = {}): PlannerContext {
  return {
    module: "productionTask",
    transition: "assign",
    bill: snapshot("task-1", {
      status: "inProduction",
      unit: "piece",
      unitFactor: 1,
      routingId: "routing-1",
      assignableQty: 50,
    }, {
      processLines: [{
        id: "line-cut",
        operationId: "op-cut",
        sequence: 10,
        teamId: "team-1",
        plannedQty: 50,
        unassignedQty: 50,
        plannedStartDate: "2026-08-06T08:00:00.000Z",
        plannedEndDate: "2026-08-06T12:00:00.000Z",
      }],
    }),
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "worker") {
          return snapshot(id, { productionOrgId: "team-1", status: "active" });
        }
        if (module === "routing") {
          return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, hourlyRate: 10, requiresApproval: true }] });
        }
        if (module === "operation") {
          return snapshot(id, { pieceRate: 4, hourlyRate: 12, hourlyRateUnit: "Per hour" });
        }
        throw new Error(`unexpected get ${module}/${id}`);
      },
      async listBills() { return { rows: [], total: 0 }; },
      async invariantBillSummary() { return { total: 0, value: null }; },
      async invariantLineSummary() { return { total: 0, value: null }; },
    },
    ...overrides,
  };
}

function assignmentSettlementContext(
  transition: "complete" | "cancel",
  status: "pendingReview" | "awaitingProduction" | "inProduction",
  rows: readonly Readonly<Record<string, unknown>>[],
): PlannerContext {
  return {
    module: "processAssignment",
    transition,
    bill: snapshot("asg-1", { status }),
    params: {},
    read: {
      async getBill() { throw new Error("assignment close must not read subcontract details"); },
      async listBills(module, query) {
        if (module !== "subcontractOrder") return { rows: [], total: 0 };
        let selected = [...rows];
        if (query.where?.kind === "group") {
          for (const condition of query.where.children) {
            if (condition.kind !== "cond") continue;
            if (condition.op === "eq") selected = selected.filter((row) => row[condition.field] === condition.value);
            if (condition.op === "in" && Array.isArray(condition.value)) {
              const values: readonly unknown[] = condition.value;
              selected = selected.filter((row) => values.includes(row[condition.field]));
            }
          }
        }
        return { rows: selected, total: selected.length };
      },
      async invariantBillSummary() { throw new Error("assignment close must not read invariants"); },
      async invariantLineSummary() { throw new Error("assignment close must not read invariants"); },
    },
  };
}

describe("Production execution loop: task operation line to multi-person assignments to approved qualified quantity", () => {
  it("single-task dispatch requires the quantity on the server, and batch dispatch keeps the existing parameter contract", () => {
    const edge = productionTask.lifecycle.transitions.find((candidate) => candidate.code === "batchAssign");
    expect(edge?.params).toEqual(expect.arrayContaining([expect.objectContaining({ key: "assignmentQty", required: false })]));
  });

  it("starting an assignment moves the awaiting-production task and order into production", async () => {
    const plan = normalizeExecutionPlan(await assignmentPlanners.start({
      module: "processAssignment",
      transition: "start",
      bill: snapshot("asg-1", { status: "awaitingProduction", productionTaskId: "task-1", productionOrderId: "po-1" }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "productionTask" && id === "task-1") return snapshot(id, { status: "awaitingLaunch" });
          if (module === "productionOrder" && id === "po-1") return snapshot(id, { status: "releasing" });
          throw new Error(`unexpected get ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands).toEqual([
      {
        type: "setGeneratedHeader",
        commandId: "stamp-task-start-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        patch: { actualStartAt: { kind: "executionTime" } },
        expectedStatus: "awaitingLaunch",
        expectedRevision: 1,
      },
      {
        type: "setStatus",
        commandId: "start-production-task-task-1",
        target: { kind: "existing", module: "productionTask", id: "task-1" },
        transition: "startFromAssignment",
        expectedStatus: "awaitingLaunch",
      },
      {
        type: "setStatus",
        commandId: "start-production-order-po-1",
        target: { kind: "existing", module: "productionOrder", id: "po-1" },
        transition: "startProduction",
        expectedStatus: "releasing",
      },
    ]);
  });

  it("a scheduled production task carries an operation subtable and no longer creates operation tasks", () => {
    expect(productionTask.fields.some((field) => field.key === "processLines")).toBe(true);
    expect(productionTask.views.list.defaultSort).toEqual({ field: "createdAt", desc: true });
    expect(productionTask.lifecycle.transitions.some((edge) => edge.code === "assign" && edge.action === "Dispatch")).toBe(true);
    expect(processAssignment.label).toBe("Production assignment");
    expect(processReport.label).toBe("Work report");
  });

  it("the assignment detail hides the header operation line and shows the operation name on the assignment operation lines", () => {
    expect(processAssignment.views.form.flatMap((section) => section.fields)).not.toContain("processLineId");

    const sourceLines = processAssignment.fields.find((field) => field.key === "sourceLines")?.fields ?? [];
    expect(sourceLines.map((field) => field.key)[0]).toBe("operationName");
    expect(sourceLines.find((field) => field.key === "operationName")).toMatchObject({
      label: "Operation name",
      type: "string",
      snapshot: {
        from: "productionTask",
        match: "processLineId",
        through: "processLines",
        field: "operationName",
      },
    });
  });

  it("qualified quantity still reportable on an assignment is not below zero", () => {
    const remaining = processAssignment.fields.find((field) => field.key === "remainingQualifiedQty");
    expect(remaining?.derive).toMatchObject({
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
    });
  });

  it("the assignment factory is frozen from the production task and does not depend on a team ancestor in the org tree", () => {
    expect(processAssignment.fields.find((field) => field.key === "factoryOrgId")?.snapshot).toEqual({
      from: "productionTask",
      match: "productionTaskId",
      through: null,
      field: "productionOrgId",
    });
  });

  it("a user completing the task cascades to close downstream assignments, and there is no inbound status", () => {
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "complete")).toMatchObject({
      from: "inProduction",
      to: "completed",
      action: "Complete",
    });
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "reopenAfterReportCorrection")).toMatchObject({
      from: "completed",
      to: "inProduction",
    });
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "markSubcontractReady")).toMatchObject({
      from: "inProduction",
      to: "completed",
    });
    expect(productionTask.lifecycle.statuses.map((status) => status.key)).toEqual([
      "pendingReview",
      "awaitingLaunch",
      "inProduction",
      "completed",
      "cancelled",
    ]);
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "markReady")).toBeUndefined();
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "confirmComplete")).toBeUndefined();
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "autoComplete")).toBeUndefined();
    expect(productionTask.lifecycle.transitions.some((edge) => edge.to === "awaitingInbound" || edge.from === "awaitingInbound")).toBe(false);
    expect(productionTask.lifecycle.transitions.some((edge) => edge.to === "Completion pending confirmation" || edge.from === "Completion pending confirmation")).toBe(false);
  });

  it("completing a production task force-closes open assignments at zero output and no longer blocks on qualified quantity per operation", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.complete(taskContext({
      transition: "complete",
      bill: snapshot("task-1", { status: "inProduction" }, {
        processLines: [
          { plannedQty: 100, approvedQualifiedQty: 150 },
          { plannedQty: 100, approvedQualifiedQty: 50 },
        ],
      }),
      read: {
        async getBill() {
          throw new Error("must not read the document");
        },
        async listBills(module, query) {
          if (module !== "processAssignment") return { rows: [], total: 0 };
          const where = query.where;
          let rows: Readonly<Record<string, unknown>>[] = [
            { id: "asg-1", status: "inProduction", productionTaskId: "task-1" },
            { id: "asg-2", status: "pendingReview", productionTaskId: "task-1" },
          ];
          if (where !== null && where !== undefined && where.kind === "group") {
            for (const child of where.children) {
              if (child.kind !== "cond") continue;
              if (child.op === "eq") rows = rows.filter((row) => row[child.field] === child.value);
              if (child.op === "in" && Array.isArray(child.value)) {
                rows = rows.filter((row) => (child.value as unknown[]).includes(row[child.field]));
              }
            }
          }
          return { rows, total: rows.length };
        },
        async invariantBillSummary() { throw new Error("must not read invariants"); },
        async invariantLineSummary() { throw new Error("must not read invariants"); },
      },
    })));
    expect(plan.commands.filter((command) => command.type === "setStatus").map((command) => [
      command.transition,
      command.expectedStatus,
    ])).toEqual([
      ["forceComplete", "inProduction"],
      ["forceComplete", "pendingReview"],
    ]);
  });

  it("completed occupancy counts approved qualified quantity, and unreported remainder returns to assignable after the assignment is finished", () => {
    const processLines = productionTask.fields.find((field) => field.key === "processLines");
    expect(processLines?.type).toBe("subtable");
    if (processLines?.type !== "subtable") throw new Error("processLines must be a subtable");
    const cols = processLines.fields ?? [];
    const occupied = cols.find((field) => field.key === "completedOccupiedQty");
    // Completed occupancy is approvedQualifiedQty, not assignedQty. Identity goes through sourceLines.processLineId,
    // and the measure is approved qualified quantity on the assignment header (child table maxRows: 1).
    expect(occupied?.derive).toMatchObject({
      kind: "rollup",
      from: "processAssignment",
      match: "processLineId",
      through: "sourceLines",
      agg: "sum",
      measure: "approvedQualifiedQty",
      where: { status: "completed" },
    });
    const unassigned = cols.find((field) => field.key === "unassignedQty");
    expect(unassigned?.derive).toMatchObject({
      kind: "formula",
      expr: { op: "max", args: [{ value: 0 }, { op: "sub" }] },
    });
    const assignable = productionTask.fields.find((field) => field.key === "assignableQty");
    expect(assignable?.derive).toMatchObject({
      kind: "formula",
      expr: { op: "max", args: [{ value: 0 }, { op: "sub" }] },
    });
    const assigned = cols.find((field) => field.key === "completedAssignedQty");
    expect(assigned?.derive).toMatchObject({
      kind: "rollup",
      from: "processAssignment",
      agg: "sum",
      measure: "assignedQty",
      where: { status: "completed" },
    });
  });

  it("operation lines return approved defect quantity so the task list can convert it by the assignment ratio", () => {
    const processLines = productionTask.fields.find((field) => field.key === "processLines");
    if (processLines?.type !== "subtable") throw new Error("processLines must be a subtable");
    const defect = (processLines.fields ?? []).find((field) => field.key === "approvedDefectQty");
    expect(defect?.derive).toMatchObject({
      kind: "rollup",
      from: "processReport",
      match: "processLineId",
      through: "sourceLines",
      agg: "sum",
      measure: "defectQty",
      where: { status: "completed" },
    });
  });

  it("dispatching two people creates two pending-review assignments, not one document with two person lines", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
        assignmentDraftLines: [
          { workerId: "w1", assignedQty: 20 },
          { workerId: "w2", assignedQty: 30 },
        ],
      },
    })));
    const created = plan.commands.filter((command) => command.type === "createBill");
    expect(created).toHaveLength(2);
    expect(created.every((command) => command.type === "createBill" && command.module === "processAssignment")).toBe(true);
    expect(created.map((command) => command.type === "createBill" ? command.header["workerId"] : null)).toEqual(["w1", "w2"]);
    expect(created.map((command) => command.type === "createBill" ? command.header["assignedQty"] : null)).toEqual([20, 30]);
    expect(created.map((command) => command.type === "createBill" ? command.header["processLineId"] : null)).toEqual(["line-cut", "line-cut"]);
    expect(plan.commands.some((command) => command.type === "setStatus")).toBe(false);
  });

  it("a named assignment uses the team on the worker record and is not blocked by a stale team on the task line", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        assignmentMode: "dispatch",
        assignmentQty: 50,
        assignmentLines: [{
          productionTaskId: "task-1",
          processLineId: "line-cut",
          operationId: "op-cut",
          workshopOrgId: "workshop-1",
          productionLineOrgId: "line-1",
          // Simulates the stale team the dialog brought back. The named worker actually belongs to team-1.
          teamId: "team-old",
          workerId: "w1",
          assignedQty: 50,
          requiresReportApproval: true,
          pieceRate: 3.5,
          plannedStartDate: "2026-08-06T08:00:00.000Z",
          plannedEndDate: "2026-08-06T12:00:00.000Z",
          assignedAt: NOW.toISOString(),
        }],
      },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active" });
          if (module === "routing") return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, requiresApproval: true }] });
          throw new Error(`unexpected get ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    const created = plan.commands.find((command) => command.type === "createBill");
    expect(created).toMatchObject({
      module: "processAssignment",
      header: { workerId: "w1", teamId: "team-1" },
    });
  });

  it("splitting one operation across several people lets each person use their own assignment settings", async () => {
    const base = {
      productionTaskId: "task-1",
      processLineId: "line-cut",
      operationId: "op-cut",
      workshopOrgId: "workshop-1",
      productionLineOrgId: "line-1",
      assignedQty: 10,
    };
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        assignmentMode: "dispatch",
        assignmentQty: 20,
        assignmentLines: [
          {
            ...base,
            workerId: "w1",
            teamId: "team-1",
            requiresReportApproval: true,
            pieceRate: 3.5,
            equipmentId: "equipment-1",
            plannedStartDate: "2026-08-06T08:00:00.000Z",
            plannedEndDate: "2026-08-06T10:00:00.000Z",
            assignedAt: "2026-08-06T04:00:00.000Z",
          },
          {
            ...base,
            workerId: "w2",
            teamId: "team-2",
            requiresReportApproval: false,
            pieceRate: 4.5,
            moldId: "mold-2",
            plannedStartDate: "2026-08-06T09:00:00.000Z",
            plannedEndDate: "2026-08-06T12:00:00.000Z",
            assignedAt: "2026-08-06T05:00:00.000Z",
          },
        ],
      },
      read: {
        async getBill(module, id) {
          if (module === "worker" && id === "w1") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "worker" && id === "w2") return snapshot(id, { productionOrgId: "team-2", status: "active" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && (id === "team-1" || id === "team-2")) return snapshot(id, { orgType: "team", status: "active" });
          if (module === "routing") return snapshot(id, { processType: "Parallel production" });
          throw new Error(`unexpected get ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));

    const created = plan.commands.filter((command) => command.type === "createBill");
    expect(created).toHaveLength(2);
    expect(created.map((command) => command.type === "createBill" ? command.header : null)).toEqual([
      expect.objectContaining({
        workerId: "w1", teamId: "team-1", requiresReportApproval: true, pieceRate: 3.5,
        equipmentId: "equipment-1", plannedStartDate: "2026-08-06T08:00:00.000Z",
      }),
      expect.objectContaining({
        workerId: "w2", teamId: "team-2", requiresReportApproval: false, pieceRate: 4.5,
        moldId: "mold-2", plannedStartDate: "2026-08-06T09:00:00.000Z",
      }),
    ]);
  });

  it("a named assignment may be below or above the current remaining quantity", async () => {
    const plan = await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
        assignmentDraftLines: [
          { workerId: "w1", assignedQty: 20 },
          { workerId: "w2", assignedQty: 20 },
        ],
      },
    }));
    expect(plan.commands.filter((command) => command.type === "createBill")).toHaveLength(2);
  });

  it("when the operation report needs no approval, the new assignment is approved in sync and goes straight to awaiting production", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
        assignmentDraftLines: [{ workerId: "w1", assignedQty: 50 }],
      },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "routing") {
            return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, requiresApproval: false }] });
          }
          throw new Error(`unexpected get ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    expect(plan.commands).toEqual([
      expect.objectContaining({
        type: "createBill",
        commandId: "process-assignment-001",
        module: "processAssignment",
        header: expect.objectContaining({ requiresReportApproval: false }),
      }),
      {
        type: "setStatus",
        commandId: "approve-process-assignment-001",
        target: { kind: "createdId", commandId: "process-assignment-001" },
        transition: "syncApprove",
        expectedStatus: "pendingReview",
      },
    ]);
  });

  it("batch dispatch covers every unassigned operation on the task and freezes this run's settings", async () => {
    expect(taskBatchActions["dispatchProduction"]?.transition).toBe("batchAssign");
    const lines = [
      { id: "line-cut", operationId: "op-cut", operationName: "Cutting", sequence: 10, unassignedQty: 30, plannedStartDate: "2026-08-06T08:00:00.000Z", plannedEndDate: "2026-08-06T10:00:00.000Z" },
      { id: "line-press", operationId: "op-press", operationName: "Pressing", sequence: 20, unassignedQty: 20, plannedStartDate: "2026-08-06T10:00:00.000Z", plannedEndDate: "2026-08-06T12:00:00.000Z" },
    ];
    const assignmentLines = lines.map((line, index) => ({
      productionTaskId: "task-1",
      processLineId: line.id,
      operationId: line.operationId,
      workshopOrgId: "workshop-1",
      productionLineOrgId: "line-1",
      teamId: "team-1",
      assignedQty: line.unassignedQty,
      requiresReportApproval: index === 0,
      pieceRate: index === 0 ? 3.5 : 4.5,
      plannedStartDate: line.plannedStartDate,
      plannedEndDate: line.plannedEndDate,
      assignedAt: NOW.toISOString(),
    }));
    const plan = normalizeExecutionPlan(await taskPlanners.batchAssign(taskContext({
      transition: "batchAssign",
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines: lines }),
      params: { assignmentMode: "dispatchAll", assignmentLines },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "orgUnit") {
            if (id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
            if (id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
            if (id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    const created = plan.commands.filter((command) => command.type === "createBill");
    expect(created).toHaveLength(2);
    expect(created.map((command) => command.type === "createBill" ? command.header : null)).toEqual([
      expect.objectContaining({ processLineId: "line-cut", assignedQty: 30, requiresReportApproval: true, workshopOrgId: "workshop-1", productionLineOrgId: "line-1" }),
      expect.objectContaining({ processLineId: "line-press", assignedQty: 20, requiresReportApproval: false, workshopOrgId: "workshop-1", productionLineOrgId: "line-1" }),
    ]);
    expect(plan.commands.filter((command) => command.type === "setStatus")).toEqual([{
      type: "setStatus",
      commandId: "approve-process-assignment-002",
      target: { kind: "createdId", commandId: "process-assignment-002" },
      transition: "syncApprove",
      expectedStatus: "pendingReview",
    }]);
    expect(plan.commands.some((command) => command.type === "setGeneratedHeader")).toBe(false);
    const partialDispatchPlan = await taskPlanners.batchAssign(taskContext({
      transition: "batchAssign",
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines: lines }),
      params: { assignmentMode: "dispatchAll", assignmentLines: [{ ...assignmentLines[0]!, assignedQty: 10 }] },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(partialDispatchPlan.commands.some((command) =>
      command.type === "createBill" && command.header["assignedQty"] === 10,
    )).toBe(true);

    const excessDispatchPlan = await taskPlanners.batchAssign(taskContext({
      transition: "batchAssign",
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, {
        processLines: [{ ...lines[0]!, unassignedQty: 3000 }],
      }),
      params: {
        assignmentMode: "dispatchAll",
        assignmentLines: [{ ...assignmentLines[0]!, assignedQty: 6000 }],
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(excessDispatchPlan.commands.some((command) =>
      command.type === "createBill" && command.header["assignedQty"] === 6000,
    )).toBe(true);

    await expect(taskPlanners.assign(taskContext({
      transition: "assign",
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines: [lines[0]!] }),
      params: {
        assignmentMode: "dispatch",
        assignmentQty: 30,
        assignmentLines: [
          { ...assignmentLines[0]!, workerId: "w1", assignedQty: 10 },
          { ...assignmentLines[0]!, workerId: "w2", assignedQty: 10 },
        ],
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }))).rejects.toThrow(/operation ratio 30.*current total is 20/);
  });

  it("sequential production rechecks assignment times on the server so a later operation cannot start early", async () => {
    const processLines = [
      { id: "line-cut", operationId: "op-cut", operationName: "Cutting", sequence: 10, unassignedQty: 30, plannedStartDate: "2026-08-06T08:00:00.000Z", plannedEndDate: "2026-08-06T10:00:00.000Z" },
      { id: "line-press", operationId: "op-press", operationName: "Pressing", sequence: 20, unassignedQty: 20, plannedStartDate: "2026-08-06T10:00:00.000Z", plannedEndDate: "2026-08-06T12:00:00.000Z" },
    ];
    const row = {
      productionTaskId: "task-1", processLineId: "line-press", operationId: "op-press",
      workshopOrgId: "workshop-1", productionLineOrgId: "line-1", teamId: "team-1",
      assignedQty: 10, requiresReportApproval: true, pieceRate: 4.5,
      plannedStartDate: "2026-08-06T09:00:00.000Z", plannedEndDate: "2026-08-06T11:00:00.000Z",
      assignedAt: NOW.toISOString(),
    };
    await expect(taskPlanners.assign(taskContext({
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines }),
      params: { assignmentMode: "dispatch", assignmentQty: 10, assignmentLines: [row] },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }))).rejects.toThrow(/cannot start before the previous operation ends/);

    await expect(taskPlanners.assign(taskContext({
      bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines }),
      params: {
        assignmentMode: "dispatch",
        assignmentQty: 20,
        assignmentLines: [
          { ...row, workerId: "w1" },
          {
            ...row,
            workerId: "w2",
            plannedStartDate: "2026-08-06T10:00:00.000Z",
            plannedEndDate: "2026-08-06T12:00:00.000Z",
          },
        ],
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") return snapshot(id, { processType: "Sequential production" });
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
          if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
          if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }))).rejects.toThrow(/cannot start before the previous operation ends/);
  });

  it("Sequential production groups by operation sequence, and the next operation takes the previous group's latest end", async () => {
    const processLines = [
      { id: "line-long", operationId: "op-long", operationName: "Parallel operation A", sequence: 10, unassignedQty: 20, plannedStartDate: "2026-08-06T08:00:00.000Z", plannedEndDate: "2026-08-06T11:00:00.000Z" },
      { id: "line-short", operationId: "op-short", operationName: "Parallel operation B", sequence: 10, unassignedQty: 20, plannedStartDate: "2026-08-06T08:30:00.000Z", plannedEndDate: "2026-08-06T10:00:00.000Z" },
      { id: "line-next", operationId: "op-next", operationName: "Next operation", sequence: 20, unassignedQty: 20, plannedStartDate: "2026-08-06T11:00:00.000Z", plannedEndDate: "2026-08-06T12:00:00.000Z" },
    ];
    const dispatch = async (
      processType: "Sequential production" | "Parallel production" | "Unordered production",
      processLineId: string,
      plannedStartDate: string,
      plannedEndDate: string,
    ) => {
      const line = processLines.find((candidate) => candidate.id === processLineId);
      if (line === undefined) throw new Error(`missing line ${processLineId}`);
      return await taskPlanners.assign(taskContext({
        bill: snapshot("task-1", { status: "inProduction", unit: "piece", routingId: "routing-1" }, { processLines }),
        params: {
          assignmentMode: "dispatch",
          assignmentQty: 10,
          assignmentLines: [{
            productionTaskId: "task-1", processLineId, operationId: line.operationId,
            workshopOrgId: "workshop-1", productionLineOrgId: "line-1", teamId: "team-1",
            assignedQty: 10, requiresReportApproval: true, pieceRate: 4.5,
            plannedStartDate, plannedEndDate, assignedAt: NOW.toISOString(),
          }],
        },
        read: {
          async getBill(module, id) {
            if (module === "routing") return snapshot(id, { processType });
            if (module === "orgUnit" && id === "workshop-1") return snapshot(id, { orgType: "workshop", status: "active" });
            if (module === "orgUnit" && id === "line-1") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-1" });
            if (module === "orgUnit" && id === "team-1") return snapshot(id, { orgType: "team", status: "active", parentOrgId: "line-1" });
            throw new Error(`unexpected ${module}/${id}`);
          },
          async listBills() { return { rows: [], total: 0 }; },
          async invariantBillSummary() { return { total: 0, value: null }; },
          async invariantLineSummary() { return { total: 0, value: null }; },
        },
      }));
    };

    await expect(dispatch(
      "Sequential production", "line-short", "2026-08-06T09:00:00.000Z", "2026-08-06T10:00:00.000Z",
    )).resolves.toBeDefined();
    await expect(dispatch(
      "Sequential production", "line-next", "2026-08-06T10:30:00.000Z", "2026-08-06T12:00:00.000Z",
    )).rejects.toThrow(/cannot start before the previous operation ends/);
    await expect(dispatch(
      "Sequential production", "line-next", "2026-08-06T11:00:00.000Z", "2026-08-06T12:00:00.000Z",
    )).resolves.toBeDefined();
    await expect(dispatch(
      "Parallel production", "line-next", "2026-08-06T10:30:00.000Z", "2026-08-06T12:00:00.000Z",
    )).resolves.toBeDefined();
    await expect(dispatch(
      "Unordered production", "line-next", "2026-08-06T10:30:00.000Z", "2026-08-06T12:00:00.000Z",
    )).resolves.toBeDefined();
  });

  it("dispatch with no person assigns the whole document to the operation team, and the assignment stores no workerId", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
        assignmentDraftLines: [{ assignedQty: 40 }],
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") {
            return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, requiresApproval: true }] });
          }
          throw new Error("dispatch with no person must not read the worker record");
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    const created = plan.commands.filter((command) => command.type === "createBill");
    expect(created).toHaveLength(1);
    const first = created[0];
    const header = first?.type === "createBill" ? first.header : {};
    expect(header["teamId"]).toBe("team-1");
    expect("workerId" in header).toBe(false);
  });

  it("choosing the default team does not require assignment worker lines", async () => {
    const edge = productionTask.lifecycle.transitions.find((candidate) => candidate.code === "assign");
    if (edge === undefined) throw new Error("the production task is missing the dispatch edge");
    const checked = normalizeTransitionParams(edge, {
      processLineId: "line-cut",
      assignmentMode: "Default team",
      assignmentOccurredAt: NOW.toISOString(),
      assignmentPieceRate: 3.5,
    });
    expect(checked.issues).toEqual([]);

    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentMode: "Default team",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") {
            return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, requiresApproval: true }] });
          }
          throw new Error("default-team dispatch must not read the worker record");
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    const created = plan.commands.filter((command) => command.type === "createBill");
    expect(created).toHaveLength(1);
    const first = created[0];
    const header = first?.type === "createBill" ? first.header : {};
    expect(header).toMatchObject({ teamId: "team-1", teamAssignmentOrgId: "team-1", assignedQty: 50 });
    expect("workerId" in header).toBe(false);
  });

  it("an assignment given to a whole team must pick a specific reporting worker when reporting", async () => {
    await expect(assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-team", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        remainingQualifiedQty: 50,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: {
        reportOccurredAt: NOW.toISOString(),
        reportQualifiedQty: 20,
        reportDefectQty: 0,
      },
      read: {
        async getBill() { throw new Error("a missing worker must be rejected before the operation is read"); },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })).rejects.toThrow(/Choose the reporting worker when reporting work/);
  });

  it("the team-assignment report dialog defaults to the current operator's only on-duty worker record in this team", async () => {
    const params = await assignmentActionPreparers.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-team", { teamId: "team-1", remainingQualifiedQty: 20 }),
      actor: { userId: "user-1" },
      now: NOW,
      read: {
        async getBill() { throw new Error("must not read by id"); },
        async listBills(module, query) {
          expect(module).toBe("worker");
          expect(query.where).toMatchObject({ kind: "group", join: "and" });
          return { rows: [{ id: "worker-1" }], total: 1 };
        },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    expect(params["reportWorkerId"]).toBe("worker-1");
  });

  it("when a pending-review report has already driven remaining qualified quantity negative, the report dialog starts at 0 instead of returning 500", async () => {
    const params = await assignmentActionPreparers.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-over-reported", {
        workerId: "worker-1",
        remainingQualifiedQty: -100,
      }),
      actor: { userId: "user-1" },
      now: NOW,
      read: {
        async getBill() { throw new Error("an assignment that already names a worker must not read the worker record"); },
        async listBills() { throw new Error("an assignment that already names a worker must not query worker records"); },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    expect(params).toMatchObject({
      reportOccurredAt: NOW.toISOString(),
      reportQualifiedQty: 0,
      reportDefectQty: 0,
    });
  });

  it("the person chosen on a report must belong to the assignment team, be on duty, and be written onto the report", async () => {
    const bad = assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-team", {
        code: "DISP-20260917-001",
        status: "awaitingProduction", unit: "piece", operationId: "op-cut", teamId: "team-1",
        productionTaskId: "task-1", productId: "prod-1", remainingQualifiedQty: 50,
        workerId: "w-assigned",
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: { reportOccurredAt: NOW.toISOString(), reportQualifiedQty: 20, reportDefectQty: 0, reportWorkerId: "w-other" },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-other", status: "active" });
          throw new Error(`unexpected ${module}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    await expect(bad).rejects.toThrow(/team|no longer active/);

    const plan = normalizeExecutionPlan(await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-team", {
        code: "DISP-20260917-001",
        status: "awaitingProduction", unit: "piece", operationId: "op-cut", teamId: "team-1",
        productionTaskId: "task-1", productId: "prod-1", remainingQualifiedQty: 50,
        requiresReportApproval: true, workerId: "w-assigned",
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: { reportOccurredAt: NOW.toISOString(), reportQualifiedQty: 20, reportDefectQty: 0, reportWorkerId: "w1" },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          throw new Error(`unexpected ${module}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands).toEqual([expect.objectContaining({
      type: "createBill",
      module: "processReport",
      header: expect.objectContaining({ processAssignmentId: "asg-team", workerId: "w1" }),
    })]);
  });

  it("when the operation needs no approval, the report passes in the same plan: create the document, sync-approve, record progress, and create the pay slip", async () => {
    const plan = normalizeExecutionPlan(await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        assignedQty: 50,
        approvedQualifiedQty: 0,
        remainingQualifiedQty: 50,
        workerId: "w1",
        requiresReportApproval: false,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: { reportOccurredAt: NOW.toISOString(), reportQualifiedQty: 20, reportDefectQty: 0 },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "operation") return snapshot(id, {});
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction" }, { processLines: [{ id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 }] });
          }
          throw new Error(`unexpected ${module}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 1, value: 30 }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    // Create the report, sync-approve it, record progress on the assignment, then create the pay slip. It is not fully reported, so the assignment goes to inProduction.
    expect(plan.commands.find((c) => c.type === "createBill" && c.module === "processReport")).toBeDefined();
    expect(plan.commands.find((c) => c.type === "setStatus" && c.transition === "syncApprove")).toMatchObject({ expectedStatus: "pendingReview" });
    expect(plan.commands.find((c) => c.type === "appendTargetLines")).toMatchObject({ table: "progressLines" });
    expect(plan.commands.find((c) => c.type === "createBill" && c.module === "performanceSettlement")).toMatchObject({
      header: { pricingCoefficient: 1 },
    });
    expect(plan.commands.some((c) => c.type === "setStatus" && c.transition === "startRunning")).toBe(false);
    expect(plan.commands.some((c) => c.type === "setStatus" && c.transition === "completeByQty")).toBe(false);
  });

  it("when the operation needs no approval and one report fills the qualified quantity, the assignment still needs an explicit complete", async () => {
    const plan = normalizeExecutionPlan(await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction", unit: "piece", operationId: "op-cut", teamId: "team-1",
        productionTaskId: "task-1", productId: "prod-1", assignedQty: 50, approvedQualifiedQty: 0, remainingQualifiedQty: 50, workerId: "w1",
        requiresReportApproval: false,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: { reportOccurredAt: NOW.toISOString(), reportQualifiedQty: 50, reportDefectQty: 0 },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "operation") return snapshot(id, {});
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction" }, { processLines: [{ id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 }] });
          }
          throw new Error(`unexpected ${module}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        // Other assignments are still open, so the production task is not completed in this step, which avoids a read that would complete the order.
        async invariantBillSummary() { return { total: 1, value: 10 }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands.some((c) => c.type === "setStatus" && c.transition === "completeByQty")).toBe(false);
    expect(plan.commands.some((c) => c.type === "setStatus" && c.transition === "startRunning")).toBe(false);
    // This task still has other open assignments, so the production task is not completed in this step.
    expect(plan.commands.some((c) => c.type === "setStatus" && c.transition === "reportDone")).toBe(false);
  });

  it("the production task actual start is written only when an assignment starts, and an existing value is not written again", async () => {
    const start = (actualStartAt: string | null, taskStatus: string) => assignmentPlanners.start({
      module: "processAssignment",
      transition: "start",
      bill: snapshot("asg-1", { status: "awaitingProduction", productionTaskId: "task-1", productionOrderId: "po-1" }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "productionTask") {
            return snapshot(id, {
              status: taskStatus,
              ...(actualStartAt === null ? {} : { actualStartAt }),
            });
          }
          if (module === "productionOrder") return snapshot(id, { status: "inProduction" });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    const stamped = await start(null, "inProduction");
    expect(stamped.commands).toEqual([{
      type: "setGeneratedHeader",
      commandId: "stamp-task-start-task-1",
      target: { kind: "existing", module: "productionTask", id: "task-1" },
      patch: { actualStartAt: { kind: "executionTime" } },
      expectedStatus: "inProduction",
      expectedRevision: 1,
    }]);
    expect((await start("2026-09-01T00:00:00.000Z", "inProduction")).commands).toEqual([]);
    expect("approve" in assignmentPlanners).toBe(false);
  });

  it("a report that needs no approval writes actual end only when every operation reaches its plan, and an existing value is not written again", async () => {
    const report = (
      actualEndAt: string | null,
      qualified: number,
      processLines: readonly Readonly<Record<string, unknown>>[],
    ) => assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        assignedQty: 50,
        remainingQualifiedQty: 50,
        workerId: "w1",
        requiresReportApproval: false,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: { reportOccurredAt: NOW.toISOString(), reportQualifiedQty: qualified, reportDefectQty: 0 },
      read: {
        async getBill(module, id) {
          if (module === "worker") return snapshot(id, { productionOrgId: "team-1", status: "active" });
          if (module === "operation") return snapshot(id, {});
          if (module === "productionTask") {
            return snapshot(id, {
              status: "inProduction",
              plannedQty: 50,
              approvedQualifiedQty: 0,
              ...(actualEndAt === null ? {} : { actualEndAt }),
            }, { processLines: [...processLines] });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    const onlyCut = await report(null, 50, [
      { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 },
      { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
    ]);
    expect(onlyCut.commands.some((command) => command.type === "setGeneratedHeader" && command.commandId.startsWith("stamp-task-end-"))).toBe(false);

    const allReached = await report(null, 50, [
      { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 },
      { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 50 },
    ]);
    expect(allReached.commands.find((command) => command.type === "setGeneratedHeader")).toMatchObject({
      commandId: "stamp-task-end-task-1",
      patch: { actualEndAt: { kind: "executionTime" } },
    });

    const short = await report(null, 20, [
      { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 },
    ]);
    expect(short.commands.some((command) => command.type === "setGeneratedHeader")).toBe(false);

    const filled = await report("2026-09-01T00:00:00.000Z", 50, [
      { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 },
    ]);
    expect(filled.commands.some((command) => command.type === "setGeneratedHeader")).toBe(false);
  });

  it("an assigned worker does not have to belong to the operation team; being employed is enough", async () => {
    const plan = normalizeExecutionPlan(await taskPlanners.assign(taskContext({
      params: {
        processLineId: "line-cut",
        assignmentOccurredAt: NOW.toISOString(),
        assignmentPieceRate: 3.5,
        assignmentDraftLines: [{ workerId: "w-other", assignedQty: 10 }],
      },
      read: {
        async getBill(module, id) {
          if (module === "routing") {
            return snapshot(id, {}, { lines: [{ operationId: "op-cut", sequence: 10, pieceRate: 3.5, requiresApproval: true }] });
          }
          if (module === "worker") return snapshot(id, { productionOrgId: "team-other", status: "active" });
          throw new Error(`unexpected ${module}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })));
    const created = plan.commands.find((command) => command.type === "createBill");
    expect(created).toMatchObject({
      module: "processAssignment",
      header: { workerId: "w-other" },
    });
  });

  it("reporting on an assignment creates one report hanging on that assignment; when the operation needs approval it lands in pending review, and the worker is the person already named on the assignment", async () => {
    const plan = normalizeExecutionPlan(await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        remainingQualifiedQty: 50,
        workerId: "w1",
        requiresReportApproval: true,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: {
        reportOccurredAt: NOW.toISOString(),
        reportQualifiedQty: 40,
        reportDefectQty: 10,
        defectDraftLines: [{ defectTypeId: "defect-dimension" }],
      },
      read: {
        async getBill() { throw new Error("a report that needs approval must not read other documents"); },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands).toEqual([expect.objectContaining({
      type: "createBill",
      module: "processReport",
      header: expect.objectContaining({
        processAssignmentId: "asg-1",
        workerId: "w1",
        qualifiedQty: 40,
        defectQty: 10,
      }),
    })]);
  });

  it("reported qualified quantity may exceed the assignment's current remaining quantity", async () => {
    const plan = await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        remainingQualifiedQty: 50,
        workerId: "w1",
        requiresReportApproval: true,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: {
        reportOccurredAt: NOW.toISOString(),
        reportQualifiedQty: 80,
        reportDefectQty: 0,
      },
      read: {
        async getBill() { throw new Error("a report that needs approval must not read other documents"); },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });
    expect(plan.commands[0]).toMatchObject({
      type: "createBill",
      module: "processReport",
      header: expect.objectContaining({ qualifiedQty: 80, defectQty: 0 }),
    });
  });

  it("a report cannot be filed when defect quantity is greater than 0 and there is no reason", async () => {
    await expect(assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        remainingQualifiedQty: 50,
        workerId: "w1",
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: {
        reportOccurredAt: NOW.toISOString(),
        reportQualifiedQty: 0,
        reportDefectQty: 5,
      },
      read: {
        async getBill() { throw new Error("reporting must not read other documents"); },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    })).rejects.toThrow(/defect reason/);
  });

  it("selecting several reasons for defects writes them onto the report defect subtable", async () => {
    const plan = normalizeExecutionPlan(await assignmentPlanners.report({
      module: "processAssignment",
      transition: "report",
      bill: snapshot("asg-1", {
        code: "DISP-20260917-001",
        status: "awaitingProduction",
        unit: "piece",
        operationId: "op-cut",
        teamId: "team-1",
        productionTaskId: "task-1",
        productId: "prod-1",
        remainingQualifiedQty: 50,
        workerId: "w1",
        requiresReportApproval: true,
      }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] }),
      params: {
        reportOccurredAt: NOW.toISOString(),
        reportQualifiedQty: 0,
        reportDefectQty: 5,
        defectDraftLines: [
          { defectTypeId: "defect-dimension" },
          { defectTypeId: "defect-surface" },
        ],
      },
      read: {
        async getBill() { throw new Error("a report that needs approval must not read other documents"); },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands).toEqual([expect.objectContaining({
      type: "createBill",
      module: "processReport",
      header: expect.objectContaining({
        processAssignmentId: "asg-1",
        qualifiedQty: 0,
        defectQty: 5,
      }),
      lines: expect.objectContaining({
        defects: [
          { defectTypeId: "defect-dimension" },
          { defectTypeId: "defect-surface" },
        ],
      }),
    })]);
  });

  it("when pending-review qualified quantity already exceeds the assigned quantity, approval can still record actual report progress", async () => {
    const plan = normalizeExecutionPlan(await processReportPlanners.approve({
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-1",
        qualifiedQty: 1,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") return snapshot(id, { status: "inProduction", remainingQualifiedQty: -1 });
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    }));
    expect(plan.commands.find((command) => command.type === "appendTargetLines")).toMatchObject({
      table: "progressLines",
      rows: [expect.objectContaining({ sourceProcessReportId: "report-2", qualifiedQty: 1 })],
    });
    expect(plan.commands.find((command) => command.type === "createBill" && command.module === "performanceSettlement")).toBeDefined();
  });

  it("qualified quantity counts on the assignment only after the report is approved, and defects do not stand in for qualified quantity", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-1", {
        processAssignmentId: "asg-1",
        qualifiedQty: 40,
        defectQty: 10,
        workHours: 2,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "awaitingProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 0,
            }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", unitFactor: 1 }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 0 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
              ],
            });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 0, value: null }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.find((command) => command.type === "appendTargetLines")).toMatchObject({
      table: "progressLines",
      rows: [expect.objectContaining({ qualifiedQty: 40, defectQty: 10 })],
    });
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "processAssignment")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "completeByQty")).toBe(false);
  });

  it("after two reports bring approved qualified quantity up to the assigned quantity, the assignment stays in production", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-1",
        qualifiedQty: 10,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 40,
            }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", unitFactor: 1 }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 40 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 50 },
              ],
            });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        invariantBillSummary: openAssignmentSummary(["asg-1"]),
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "processAssignment")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "reportDone")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "syncComplete")).toBe(false);
  });

  it("after the last task is fully reported, only the task is completed and the production order waits for an explicit complete", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-1",
        qualifiedQty: 10,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 40,
            }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, {
              status: "inProduction",
              productionOrderId: "po-1",
              unitFactor: 1,
            }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 40 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 50 },
              ],
              allocations: [{ sourceOrderId: "po-1" }],
            });
          }
          if (module === "productionOrder") {
            return snapshot(id, { status: "inProduction", salesOrderId: "so-1" });
          }
          if (module === "salesOrder") {
            return snapshot(id, { status: "inProduction" }, {
              lines: [{ id: "sol-1", baseQty: 10, shippedBaseQty: 0 }],
            });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        invariantBillSummary: openAssignmentSummary(["asg-1"]),
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "reportDone")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "productionOrder")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "salesOrder")).toBe(false);
  });

  it("the order is not closed while the same order still has an unfinished task", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-1",
        qualifiedQty: 10,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 40,
            }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, {
              status: "inProduction",
              productionOrderId: "po-1",
              unitFactor: 1,
            }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 40 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 50 },
              ],
            });
          }
          if (module === "productionOrder") {
            return snapshot(id, { status: "inProduction", salesOrderId: "so-1" });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills(module) {
          if (module === "productionTask") return { rows: [{ id: "task-2", status: "inProduction" }], total: 1 };
          return { rows: [], total: 0 };
        },
        invariantBillSummary: openAssignmentSummary(["asg-1"]),
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "reportDone")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "syncComplete")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "salesOrder")).toBe(false);
  });

  it("when a full report auto-closes the assignment, the task stays in production if other assignments are still open", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-2", {
        processAssignmentId: "asg-1",
        qualifiedQty: 10,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 40,
            }, { sourceLines: [{ processLineId: "line-cut", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", unitFactor: 1 }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 40 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 50 },
              ],
            });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        invariantBillSummary: openAssignmentSummary(["asg-1", "asg-2"]),
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.some((command) => command.type === "setStatus" && command.target.kind === "existing" && command.target.module === "processAssignment")).toBe(false);
    expect(plan.commands.some((command) => command.type === "setStatus" && command.transition === "reportDone")).toBe(false);
  });

  it("approving a report no longer creates a completion supply document, and qualified quantity stays on the operation line", async () => {
    const ctx: PlannerContext = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-iron", {
        processAssignmentId: "asg-iron",
        qualifiedQty: 5,
        defectQty: 0,
        workHours: 1,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "processAssignment") {
            return snapshot(id, {
              status: "inProduction",
              productionTaskId: "task-1",
              assignedQty: 50,
              approvedQualifiedQty: 0,
            }, { sourceLines: [{ processLineId: "line-iron", assignedQty: 50 }] });
          }
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", unitFactor: 1 }, {
              processLines: [
                { id: "line-cut", plannedQty: 50, approvedQualifiedQty: 10 },
                { id: "line-iron", plannedQty: 50, approvedQualifiedQty: 0 },
              ],
            });
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary(module) {
          if (module === "processAssignment") return { total: 1, value: 10 };
          return { total: 0, value: null };
        },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    };
    const plan = normalizeExecutionPlan(await processReportPlanners.approve(ctx));
    expect(plan.commands.some((command) => command.type === "createBill" && command.module === "productionCompletion")).toBe(false);
    expect(plan.commands.find((command) => command.type === "createBill" && command.module === "performanceSettlement")).toMatchObject({
      header: { processReportId: "report-iron" },
    });
  });

  it("finishing an assignment completes only the open subcontract order that this assignment is linked to", async () => {
    const complete = processAssignment.lifecycle.transitions.find((edge) => edge.code === "complete");
    expect(complete?.action).toBe("Finish operation");
    expect(complete?.from).toBe("inProduction");
    expect(complete?.to).toBe("completed");
    expect(complete?.primary).toBe(true);
    const plan = await assignmentPlanners.complete(assignmentSettlementContext("complete", "inProduction", [
      { id: "sub-review", status: "pendingReview", processAssignmentId: "asg-1" },
      { id: "sub-processing", status: "processing", processAssignmentId: "asg-1" },
      { id: "sub-done", status: "completed", processAssignmentId: "asg-1" },
      { id: "sub-other", status: "awaitingOutsource", processAssignmentId: "asg-2" },
    ]));
    expect(plan.commands).toEqual([
      expect.objectContaining({ transition: "forceComplete", expectedStatus: "pendingReview", target: expect.objectContaining({ id: "sub-review" }) }),
      expect.objectContaining({ transition: "forceComplete", expectedStatus: "processing", target: expect.objectContaining({ id: "sub-processing" }) }),
    ]);
    expect(processAssignment.preconditions.some((rule) => rule.onTransition === "complete")).toBe(false);
    expect(processAssignment.lifecycle.statuses.find((status) => status.key === "inProduction")).toMatchObject({
      editable: "none",
    });
  });

  it("pendingReview, awaiting production, and in production can all be cancelled, and the old report block and reject are gone", () => {
    expect(processAssignment.lifecycle.transitions
      .filter((edge) => edge.code === "cancel")
      .map((edge) => [edge.from, edge.to, edge.action])).toEqual([
      ["pendingReview", "cancelled", "Cancel"],
      ["awaitingProduction", "cancelled", "Cancel"],
      ["inProduction", "cancelled", "Cancel"],
    ]);
    expect(processAssignment.lifecycle.transitions.some((edge) => edge.code === "reject" || edge.code === "rejectRunning")).toBe(false);
    expect(processAssignment.preconditions.some((rule) => rule.onTransition === "cancel")).toBe(false);
  });

  it.each(["pendingReview", "awaitingProduction", "inProduction"] as const)("cancel the assignment from %s and close open and completed subcontract orders linked to it", async (status) => {
    const plan = await assignmentPlanners.cancel(assignmentSettlementContext("cancel", status, [
      { id: "sub-review", status: "pendingReview", processAssignmentId: "asg-1" },
      { id: "sub-pending", status: "awaitingOutsource", processAssignmentId: "asg-1" },
      { id: "sub-processing", status: "processing", processAssignmentId: "asg-1" },
      { id: "sub-done", status: "completed", processAssignmentId: "asg-1" },
      { id: "sub-closed", status: "closedOut", processAssignmentId: "asg-1" },
      { id: "sub-other", status: "processing", processAssignmentId: "asg-2" },
    ]));
    expect(plan.commands.map((command) => command.type === "setStatus" && command.target.kind === "existing"
      ? [command.target.id, command.transition, command.expectedStatus]
      : null)).toEqual([
      ["sub-review", "forceCancel", "pendingReview"],
      ["sub-pending", "forceCancel", "awaitingOutsource"],
      ["sub-processing", "forceCancel", "processing"],
      ["sub-done", "forceCancel", "completed"],
    ]);
  });
});
