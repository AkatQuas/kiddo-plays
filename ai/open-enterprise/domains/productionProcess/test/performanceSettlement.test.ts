import { plannerCreateTargetsOf, sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import processAssignmentDraft from "../modules/processAssignment/index.js";
import { planners as processReportPlanners } from "../modules/processReport/index.js";
import { performanceSettlementCreateCommand } from "../modules/processReport/performanceSettlementCreate.js";
import processReportDraft from "../modules/processReport/index.js";

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

describe("A pay slip is created from a valid work report", () => {
  it("a pending-review report quantity already occupies the assignment remainder and only remark and photos can change; a pending-review assignment can still change the rate", () => {
    const reportDraft = processReport.lifecycle.statuses.find((status) => status.key === "pendingReview");
    expect(reportDraft?.editableFields).toEqual(["remark", "photos"]);
    expect(reportDraft?.editableFields).not.toContain("pieceRate");
    const assignmentDraft = processAssignment.lifecycle.statuses.find((status) => status.key === "pendingReview");
    expect(assignmentDraft?.editableFields).toContain("pieceRate");
  });

  it("assignment cumulative reported quantity sums storable qualified and defect quantities, excluding cancelled", () => {
    expect(processAssignment.fields.find((field) => field.key === "cumulativeQualifiedQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "processReport",
      match: "processAssignmentId",
      agg: "sum",
      measure: "qualifiedQty",
      where: { status: ["pendingReview", "completed"] },
    });
    expect(processAssignment.fields.find((field) => field.key === "cumulativeDefectQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "processReport",
      match: "processAssignmentId",
      agg: "sum",
      measure: "defectQty",
      where: { status: ["pendingReview", "completed"] },
    });
    expect(processAssignment.fields.find((field) => field.key === "cumulativeReportedQty")?.derive).toEqual({
      kind: "formula",
      expr: {
        op: "add",
        args: [{ field: "cumulativeQualifiedQty" }, { field: "cumulativeDefectQty" }],
      },
    });
  });

  it("the report no longer has settleLines that existed only for the old createFrom", () => {
    expect(processReport.fields.find((candidate) => candidate.key === "settleLines")).toBeUndefined();
    expect(processReport.fields.find((candidate) => candidate.key === "settledPieceQty")).toBeUndefined();
    expect(processReport.fields.find((candidate) => candidate.key === "openSettleQty")).toBeUndefined();
  });

  it("every completed in-house report creates a pay slip; a blank coefficient is stored as 1", () => {
    expect(performanceSettlementCreateCommand("report-1", "performance-settlement")).toEqual({
      type: "createBill",
      commandId: "performance-settlement",
      module: "performanceSettlement",
      header: { processReportId: "report-1", pricingCoefficient: 1 },
      lines: {},
    });
    expect(performanceSettlementCreateCommand("report-1", "performance-settlement", 1.5)).toEqual({
      type: "createBill",
      commandId: "performance-settlement",
      module: "performanceSettlement",
      header: { processReportId: "report-1", pricingCoefficient: 1.5 },
      lines: {},
    });
  });

  it("approving a report that is only defects also creates a pay slip; syncApprove has no planner", async () => {
    expect(plannerCreateTargetsOf(processReportPlanners)).toEqual({
      approve: ["performanceSettlement"],
    });
    expect("syncApprove" in processReportPlanners).toBe(false);
    const ctx = {
      module: "processReport",
      transition: "approve",
      bill: snapshot("report-1", {
        processAssignmentId: "asg-1",
        qualifiedQty: 0,
        defectQty: 10,
        workHours: 2,
        reportedAt: NOW,
      }),
      params: {},
      read: {
        async getBill(module: string, id: string) {
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
    const plan = await processReportPlanners.approve(ctx);
    expect(plan.commands.find((command) => command.type === "createBill" && command.module === "performanceSettlement")).toMatchObject({
      header: { processReportId: "report-1" },
    });
  });

  it("the pay-slip target hangs only on report approval, not on assignment completion", () => {
    expect(plannerCreateTargetsOf(processReportPlanners)).toEqual({
      approve: ["performanceSettlement"],
    });
  });
});
