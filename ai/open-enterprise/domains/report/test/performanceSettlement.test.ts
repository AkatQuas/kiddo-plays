import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import performanceSettlementDraft from "../modules/performanceSettlement.js";

const performanceSettlement = sealModule(performanceSettlementDraft, { code: "performanceSettlement", domain: "report" });

function field(key: string) {
  const hit = performanceSettlement.fields.find((candidate) => candidate.key === key);
  if (!hit) throw new Error(`Wage slip has no field "${key}"`);
  return hit;
}

describe("Wage report: one completed work report, one slip", () => {
  it("passes the semantic gate, with no manual create, no lines, and no createFrom", () => {
    expect(validateModule(performanceSettlement).errors).toEqual([]);
    expect(performanceSettlement.label).toBe("Wage report");
    expect(performanceSettlement.domain).toBe("report");
    expect(performanceSettlement.numbering?.prefix).toBe("WAGE");
    expect(performanceSettlement.fields.some((candidate) => candidate.type === "subtable")).toBe(false);
    expect(performanceSettlement.views.createFrom).toEqual([]);
  });

  it("the header hangs on the work report and is unique in the tenant; piece quantity comes from the work-report snapshot; the Planner writes the coefficient from the worker default operation", () => {
    expect(field("processReportId")).toMatchObject({
      type: "ref",
      ref: "processReport",
      required: true,
      unique: true,
    });
    expect(field("processReportCode").derive).toMatchObject({
      kind: "lookup",
      from: "processReport",
      match: "processReportId",
      field: "code",
    });
    expect(field("workerId").snapshot).toEqual({
      from: "processReport",
      match: "processReportId",
      through: null,
      field: "workerId",
    });
    expect(field("pieceRate").snapshot).toEqual({
      from: "processReport",
      match: "processReportId",
      through: null,
      field: "pieceRate",
    });
    expect(field("pricingCoefficient")).toMatchObject({
      type: "number",
      plannerSupplied: true,
      snapshot: null,
    });
    expect(field("pieceQty").snapshot).toEqual({
      from: "processReport",
      match: "processReportId",
      through: null,
      field: "qualifiedQty",
    });
  });

  it("settled wage = qualified quantity × frozen rate × frozen coefficient, a blank coefficient counts as 1, and defects are not paid by the piece", () => {
    expect(field("pieceWage")).toMatchObject({
      label: "Settled wage",
      derive: {
        kind: "formula",
        expr: {
          op: "mul",
          args: [
            { field: "pieceQty" },
            { field: "pieceRate" },
            { orElse: { of: { field: "pricingCoefficient" }, whenEmpty: 1 } },
          ],
        },
      },
    });
    for (const key of ["hourlyRate", "hourlyWage", "adjustmentAmount", "periodStart", "settlementLines"]) {
      expect(performanceSettlement.fields.some((candidate) => candidate.key === key), key).toBe(false);
    }
  });

  it("a valid work report can be settled as soon as it is formed, and there is no wage approval edge", () => {
    expect(performanceSettlement.lifecycle.statuses.map((status) => status.key)).toEqual([
      "pendingSettlement",
      "settled",
    ]);
    expect(performanceSettlement.lifecycle.statuses.find((status) => status.key === "pendingSettlement")).toMatchObject({
      initial: true,
      editable: "none",
    });
    expect(performanceSettlement.lifecycle.transitions.map((edge) => edge.code)).toEqual(["settle"]);
    expect(performanceSettlement.lifecycle.transitions.find((edge) => edge.code === "settle")).toMatchObject({
      from: "pendingSettlement",
      to: "settled",
      action: "Settle",
      primary: true,
      confirm: true,
    });
    expect(performanceSettlement.lifecycle.transitions.some((edge) => edge.code === "submit")).toBe(false);
    expect(performanceSettlement.lifecycle.transitions.some((edge) => edge.action === "Approved")).toBe(false);
  });

  it("the source work report must be completed before settle; the list can query worker, team, operation, and report time independently", () => {
    expect(performanceSettlement.preconditions).toEqual([
      expect.objectContaining({
        id: "source_report_approved",
        onTransition: "settle",
        check: expect.objectContaining({
          primitive: "ref_field_compare",
          params: expect.objectContaining({
            entity: "processReport",
            field: "status",
            via: { field: "processReportId", from: "bill" },
          }),
        }),
      }),
    ]);
    expect(performanceSettlement.views.list.filters).toEqual([
      "status",
      "reportedAt",
      "operationId",
      "workerId",
      "teamId",
    ]);
    expect(performanceSettlement.views.list.searchable).toEqual(["code", "processReportCode"]);
    expect(performanceSettlement.views.list.columns).toEqual(expect.arrayContaining([
      "code",
      "pieceRate",
      "pricingCoefficient",
      "pieceQty",
      "pieceWage",
      "workerId",
      "teamId",
      "processReportCode",
      "reportedAt",
      "defectQty",
      "operationId",
      "status",
    ]));
  });
});
