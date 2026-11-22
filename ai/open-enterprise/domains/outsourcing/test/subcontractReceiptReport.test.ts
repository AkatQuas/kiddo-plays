import type { ExecutionCommand, PlannerBillSnapshot, PlannerContext } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import { planners } from "../modules/subcontractReceipt/index.js";
import { planSubcontractReceiptReportCommands } from "../modules/subcontractReceipt/confirmPlanner.js";

const snapshot = (
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot => ({ id, revision: 1, header, lines });

/** Confirming a subcontract receipt moves the pending-review subcontract work reports created with that receipt. */
function confirmContext(
  options: {
    readonly lines?: readonly Readonly<Record<string, unknown>>[];
    readonly receiptDate?: string | null;
    readonly remark?: string | null;
    readonly linkedReports?: readonly { readonly id: string; readonly status: string }[];
    readonly reportHeader?: Readonly<Record<string, unknown>>;
  } = {},
): PlannerContext {
  const receiptDate = options.receiptDate === undefined ? "2026-09-17" : options.receiptDate;
  const lines = options.lines ?? [
    {
      productionTaskId: "task-1",
      productId: "prod-1",
      unit: "pc",
      unitFactor: 2,
      qty: 30,
      qualifiedQty: 26,
      defectQty: 4,
      defectTypeIds: JSON.stringify(["defect-dimension"]),
      taxPrice: 10,
    },
  ];
  const linkedReports = options.linkedReports ?? [{ id: "report-pending-1", status: "pendingReview" }];
  return {
    module: "subcontractReceipt",
    transition: "confirm",
    bill: snapshot("sub-receipt-1", {
      status: "awaitingReceipt",
      code: "SCRCV-20260917-001",
      supplierId: "supplier-1",
      ...(receiptDate === null ? {} : { receiptDate }),
      ...(options.remark === undefined ? {} : { remark: options.remark }),
    }, {
      lines,
    }),
    params: {},
    read: {
      getBill: async (module, id) => {
        if (module === "processReport") {
          return snapshot(id, {
            productionTaskId: String(lines[0]?.["productionTaskId"] ?? "task-1"),
            qualifiedQty: Number(lines[0]?.["qualifiedQty"] ?? lines[0]?.["qty"] ?? 0),
            defectQty: Number(lines[0]?.["defectQty"] ?? 0),
            workHours: 0,
            reportedAt: "2026-09-17T08:00:00.000Z",
            ...options.reportHeader,
          });
        }
        if (module === "processAssignment") {
          return snapshot(id, { status: "inProduction" });
        }
        if (module === "productionTask") {
          return snapshot(id, { status: "inProduction", plannedQty: 10000, approvedQualifiedQty: 0 });
        }
        throw new Error(`unexpected read ${module}:${id}`);
      },
      listBills: async (module) => module === "processReport"
        ? { rows: linkedReports, total: linkedReports.length }
        : { rows: [], total: 0 },
      invariantBillSummary: async () => { throw new Error("The subcontract receipt planner must not read an invariant aggregate"); },
      invariantLineSummary: async () => { throw new Error("The subcontract receipt planner must not read a line aggregate"); },
    },
  };
}

const created = (commands: readonly ExecutionCommand[], index = 0): ExecutionCommand => {
  const bills = commands.filter((command) => command.type === "createBill");
  const hit = bills[index];
  if (hit === undefined) throw new Error(`There is no new document ${index + 1}`);
  return hit;
};

const reportCommands = (
  lines: readonly Readonly<Record<string, unknown>>[],
): readonly ExecutionCommand[] => planSubcontractReceiptReportCommands({
  receiptId: "sub-receipt-1",
  receiptCode: "SCRCV-20260917-001",
  supplierId: "supplier-1",
  processAssignmentId: null,
  remark: null,
  lines: lines.map((line) => ({
    assignedQty: line["assignedQty"] ?? line["qty"] ?? 30,
    plannedStartDate: line["plannedStartDate"] ?? "2026-09-17",
    plannedEndDate: line["plannedEndDate"] ?? "2026-09-20",
    assignedAt: line["assignedAt"] ?? "2026-09-17",
    cumulativeReportedQty: line["cumulativeReportedQty"] ?? line["qty"] ?? 30,
    ...line,
  })),
});

describe("Subcontract receipt drives production work reports", () => {
  it("confirm is refused when the receipt has no original pending-review work report, and a second work report is not created", async () => {
    await expect(planners.confirm(confirmContext({ linkedReports: [] })))
      .rejects.toThrow(/no work report awaiting approval/);
  });

  it("approving the receipt only moves the linked pending-review subcontract work reports to completed", async () => {
    const plan = await planners.confirm(confirmContext({
      linkedReports: [
        { id: "report-pending-1", status: "pendingReview" },
        { id: "report-pending-2", status: "pendingReview" },
      ],
    }));
    expect(plan.commands).toEqual([
      {
        type: "setStatus",
        commandId: "sync-approve-subcontract-report-001",
        target: { kind: "existing", module: "processReport", id: "report-pending-1" },
        transition: "syncApprove",
        expectedStatus: "pendingReview",
      },
      {
        type: "setStatus",
        commandId: "sync-approve-subcontract-report-002",
        target: { kind: "existing", module: "processReport", id: "report-pending-2" },
        transition: "syncApprove",
        expectedStatus: "pendingReview",
      },
    ]);
    expect(plan.commands.some((command) => command.type === "createBill")).toBe(false);
  });

  it("completing an operation-subcontract work report also records progress on the source assignment", async () => {
    const plan = await planners.confirm(confirmContext({
      reportHeader: { processAssignmentId: "assignment-1" },
    }));
    expect(plan.commands.find((command) => command.type === "appendTargetLines")).toMatchObject({
      commandId: "record-subcontract-progress-001",
      target: { kind: "existing", module: "processAssignment", id: "assignment-1" },
      table: "progressLines",
      rows: [{
        sourceProcessReportId: "report-pending-1",
        qualifiedQty: 26,
        defectQty: 4,
        workHours: 0,
        recordedAt: "2026-09-17T08:00:00.000Z",
      }],
      expectedStatus: "inProduction",
    });
  });

  it("qualified quantity uses the receipt line's qualified quantity, and defect quantity is converted separately", () => {
    const commands = reportCommands([{
      productionTaskId: "task-1",
      productId: "prod-1",
      unit: "pc",
      unitFactor: 2,
      qty: 30,
      qualifiedQty: 26,
      defectQty: 4,
      defectTypeIds: JSON.stringify(["defect-dimension"]),
      taxPrice: 10,
    }]);
    const report = created(commands);
    if (report.type !== "createBill") throw new Error("expected createBill");
    expect(report.header["qualifiedQty"]).toBe(26);
    expect(report.header["defectQty"]).toBe(4);
    expect(report.header["unitFactor"]).toBe(2);
    expect(report.header["baseQualifiedQty"]).toBe(52);
    expect(report.header["baseDefectQty"]).toBe(8);
  });

  it("a receipt of 100 with 2 defects records a qualified quantity of 98 on the operation work report", () => {
    const commands = reportCommands([{
      productionTaskId: "task-1",
      productId: "prod-1",
      unit: "pc",
      unitFactor: 1,
      qty: 100,
      qualifiedQty: 98,
      defectQty: 2,
      processLineId: "process-line-1",
      defectTypeIds: JSON.stringify(["defect-dimension"]),
      taxPrice: 10,
    }]);
    const report = created(commands);
    if (report.type !== "createBill") throw new Error("expected createBill");
    expect(report.header).toMatchObject({ qualifiedQty: 98, defectQty: 2 });
    expect(report.lines["sourceLines"]).toEqual([{
      processLineId: "process-line-1",
      qualifiedQty: 98,
      defectQty: 2,
    }]);
  });

  it("one receipt of several tasks creates one work report per line", () => {
    const commands = reportCommands([
      { productionTaskId: "task-1", productId: "prod-1", unit: "pc", unitFactor: 1, qty: 10, taxPrice: 10 },
      { productionTaskId: "task-2", productId: "prod-2", unit: "pc", unitFactor: 1, qty: 20, taxPrice: 10 },
    ]);
    const bills = commands.filter((command) => command.type === "createBill");
    expect(bills).toHaveLength(2);
    expect(bills.map((bill) => bill.type === "createBill" ? bill.header["productionTaskId"] : null))
      .toEqual(["task-1", "task-2"]);
    expect(commands.filter((command) => command.type === "setStatus")).toHaveLength(0);
  });

  it("only the work-report fact is created: no payroll document, and the production task is not advanced", () => {
    const commands = reportCommands([
      { productionTaskId: "task-1", productId: "prod-1", unit: "pc", unitFactor: 1, qty: 30, taxPrice: 10 },
    ]);
    // The subcontract reporter is the supplier. It goes to payables, not payroll.
    expect(commands.some((command) => command.type === "createBill" && command.module === "performanceSettlement")).toBe(false);
    // Production progress is the receipt's own stock and quantity constraints. The work report does not advance it again.
    expect(commands.some((command) => command.type === "appendTargetLines" || command.type === "appendSourceLines")).toBe(false);
  });

  it("the subcontract work-report time is the moment this receipt is executed", () => {
    const commands = reportCommands([
      { productionTaskId: "task-1", productId: "prod-1", unit: "pc", unitFactor: 1, qty: 30, taxPrice: 10 },
    ]);
    const report = created(commands);
    if (report.type !== "createBill") throw new Error("expected createBill");
    expect(report.header["reportedAt"]).toEqual({ kind: "executionTime" });
  });

  it("an operation-subcontract work report inherits the source assignment", () => {
    const [report] = planSubcontractReceiptReportCommands({
      receiptId: "receipt-1",
      receiptCode: "SCRCV-001",
      supplierId: "supplier-1",
      processAssignmentId: "assignment-1",
      remark: null,
      lines: [{
        productionTaskId: "task-1",
        productId: "prod-1",
        unit: "pc",
        unitFactor: 1,
        qty: 5,
        assignedQty: 10,
        plannedStartDate: "2026-09-01",
        plannedEndDate: "2026-09-10",
        assignedAt: "2026-09-01T08:00:00.000Z",
        cumulativeReportedQty: 5,
      }],
    });
    expect(report).toMatchObject({
      type: "createBill",
      header: {
        processAssignmentId: "assignment-1",
        subcontractReceiptId: "receipt-1",
        assignedQty: 10,
        plannedStartDate: "2026-09-01T00:00:00.000Z",
        plannedEndDate: "2026-09-10T00:00:00.000Z",
        assignedAt: "2026-09-01T08:00:00.000Z",
        cumulativeReportedQty: 5,
      },
    });
  });

  it("a subcontract work report freezes assigned quantity and times from the order", () => {
    const commands = reportCommands([
      {
        productionTaskId: "task-1",
        productId: "prod-1",
        unit: "pc",
        unitFactor: 1,
        qty: 30,
        assignedQty: 100,
        plannedStartDate: "2026-09-17",
        plannedEndDate: "2026-09-25",
        assignedAt: "2026-09-17T12:00:00.000Z",
        cumulativeReportedQty: 30,
        taxPrice: 10,
      },
    ]);
    const report = created(commands);
    if (report.type !== "createBill") throw new Error("expected createBill");
    expect(report.header).toMatchObject({
      assignedQty: 100,
      plannedStartDate: "2026-09-17T00:00:00.000Z",
      plannedEndDate: "2026-09-25T00:00:00.000Z",
      assignedAt: "2026-09-17T12:00:00.000Z",
      cumulativeReportedQty: 30,
    });
  });

  it("a receipt with no lines creates no work report", async () => {
    const plan = await planners.confirm(confirmContext({ lines: [] }));
    expect(plan.commands).toEqual([]);
  });

  it("cancelling the receipt cancels only work reports that have not been approved, and leaves completed work reports", async () => {
    const ctx: PlannerContext = {
      module: "subcontractReceipt",
      transition: "cancel",
      bill: snapshot("sub-receipt-1", { status: "awaitingReceipt", supplierId: "supplier-1" }),
      params: {},
      read: {
        getBill: async (module, id) => { throw new Error(`unexpected read ${module}:${id}`); },
        listBills: async (module) => module === "processReport" ? ({
          rows: [
            { id: "report-pending", status: "pendingReview" },
            { id: "report-done", status: "completed" },
          ],
          total: 2,
        }) : ({ rows: [], total: 0 }),
        invariantBillSummary: async () => { throw new Error("Must not read an invariant aggregate"); },
        invariantLineSummary: async () => { throw new Error("Must not read a line aggregate"); },
      },
    };
    const plan = await planners.cancel(ctx);
    expect(plan.commands).toEqual([
      {
        type: "setStatus",
        commandId: "sync-cancel-subcontract-report-001",
        target: { kind: "existing", module: "processReport", id: "report-pending" },
        transition: "syncCancel",
        expectedStatus: "pendingReview",
      },
    ]);
  });

  it("when linked work reports exceed the query limit, the update is refused instead of treating the first N rows as the full set", async () => {
    const ctx: PlannerContext = {
      module: "subcontractReceipt",
      transition: "cancel",
      bill: snapshot("sub-receipt-1", { status: "awaitingReceipt", supplierId: "supplier-1" }),
      params: {},
      read: {
        getBill: async (module, id) => { throw new Error(`unexpected read ${module}:${id}`); },
        listBills: async (module) => module === "processReport"
          ? { rows: [{ id: "report-1", status: "pendingReview" }], total: 101 }
          : { rows: [], total: 0 },
        invariantBillSummary: async () => { throw new Error("Must not read an invariant aggregate"); },
        invariantLineSummary: async () => { throw new Error("Must not read a line aggregate"); },
      },
    };
    await expect(planners.cancel(ctx)).rejects.toThrow(/safe limit/);
  });

  it("a subcontract work report writes the actual end only when every operation has reached its plan, and does not overwrite a value already set", async () => {
    const reached = confirmContext({
      lines: [{ productionTaskId: "task-1", productId: "prod-1", unit: "pc", unitFactor: 1, qty: 80, taxPrice: 10 }],
    });
    const onlyOneProcess = await planners.confirm({
      ...reached,
      read: {
        ...reached.read,
        getBill: async (module, id) => {
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", plannedQty: 100, approvedQualifiedQty: 30 }, {
              processLines: [
                { id: "line-cut", plannedQty: 100, approvedQualifiedQty: 20 },
                { id: "line-iron", plannedQty: 100, approvedQualifiedQty: 0 },
              ],
            });
          }
          if (module === "processReport") {
            const bill = await reached.read.getBill(module, id);
            return {
              ...bill,
              lines: { ...bill.lines, sourceLines: [{ processLineId: "line-cut", qualifiedQty: 80, defectQty: 0 }] },
            };
          }
          return reached.read.getBill(module, id);
        },
      },
    });
    expect(onlyOneProcess.commands.some((command) => command.type === "setGeneratedHeader")).toBe(false);

    const plan = await planners.confirm({
      ...reached,
      read: {
        ...reached.read,
        getBill: async (module, id) => {
          if (module === "productionTask") {
            return snapshot(id, { status: "inProduction", plannedQty: 100, approvedQualifiedQty: 30 }, {
              processLines: [
                { id: "line-cut", plannedQty: 100, approvedQualifiedQty: 20 },
                { id: "line-iron", plannedQty: 100, approvedQualifiedQty: 100 },
              ],
            });
          }
          if (module === "processReport") {
            const bill = await reached.read.getBill(module, id);
            return {
              ...bill,
              lines: { ...bill.lines, sourceLines: [{ processLineId: "line-cut", qualifiedQty: 80, defectQty: 0 }] },
            };
          }
          return reached.read.getBill(module, id);
        },
      },
    });
    expect(plan.commands.find((command) => command.type === "setGeneratedHeader")).toMatchObject({
      commandId: "stamp-task-end-task-1",
      patch: { actualEndAt: { kind: "executionTime" } },
      expectedStatus: "inProduction",
    });

    const filled = await planners.confirm({
      ...reached,
      read: {
        ...reached.read,
        getBill: async (module, id) => {
          if (module === "productionTask") {
            return snapshot(id, {
              status: "inProduction",
              plannedQty: 100,
              approvedQualifiedQty: 30,
              actualEndAt: "2026-09-01T00:00:00.000Z",
            }, {
              processLines: [
                { id: "line-cut", plannedQty: 100, approvedQualifiedQty: 20 },
                { id: "line-iron", plannedQty: 100, approvedQualifiedQty: 100 },
              ],
            });
          }
          if (module === "processReport") {
            const bill = await reached.read.getBill(module, id);
            return {
              ...bill,
              lines: { ...bill.lines, sourceLines: [{ processLineId: "line-cut", qualifiedQty: 80, defectQty: 0 }] },
            };
          }
          return reached.read.getBill(module, id);
        },
      },
    });
    expect(filled.commands.some((command) => command.type === "setGeneratedHeader")).toBe(false);
  });
});
