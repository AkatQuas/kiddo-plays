import { sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import processReportDraft, { planners as processReportPlanners } from "../modules/processReport/index.js";

const processReport = sealModule(processReportDraft, { code: "processReport", domain: "productionProcess" });

describe("The only edge a person can take on a work report is approve", () => {
  it("completed is terminal; cancelled only follows subcontract-receipt cancellation, and a person has no undo", () => {
    // The old rule was that a work report has no revoked status. After subcontract receipt creates the report, cancelling the receipt must take the report it created with it,
    // so cancelled was added. It hangs only on the internal syncCancel, and a person cannot click it.
    expect(processReport.lifecycle.statuses.map((status) => status.key)).toEqual(["pendingReview", "completed", "cancelled"]);
    expect(processReport.lifecycle.statuses.find((status) => status.key === "completed")?.terminal).toBe(true);
    expect(processReport.lifecycle.statuses.find((status) => status.key === "cancelled")?.terminal).toBe(true);
    expect(processReport.lifecycle.transitions.map((edge) => edge.code).sort())
      .toEqual(["approve", "syncApprove", "syncCancel"]);
    // The only edge a person can click is approve. The other two are system sync.
    const human = processReport.lifecycle.transitions.filter((edge) => edge.internal !== true);
    expect(human.map((edge) => edge.code)).toEqual(["approve"]);
    expect(processReportPlanners).not.toHaveProperty("revokeApproved");
  });
});
