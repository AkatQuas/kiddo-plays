import { describe, expect, it } from "vitest";
import { defineReport, DIMENSION_FULL, INTERNAL_FULL_SCORE, isDefinedReport, REPORT_SNAPSHOT_ROLE } from "../src/index.js";

describe("defineReport", () => {
  it("registers the snapshot module and narrative domains", () => {
    const report = defineReport({
      snapshotModule: "dailyReport",
      narrativeDomains: [
        { key: "sales", label: "Sales" },
        { key: "finance", label: "Receipts and payments" },
      ],
    });
    expect(isDefinedReport(report)).toBe(true);
    expect(report.snapshotModule).toBe("dailyReport");
    expect(report.snapshotRole).toBe(REPORT_SNAPSHOT_ROLE);
    expect(report.narrativeDomains.map((domain) => domain.key)).toEqual(["sales", "finance"]);
  });
});

describe("daily-report dimension full scores", () => {
  it("the five DIMENSION_FULL scores sum to 100", () => {
    expect(
      DIMENSION_FULL.salesDelivery +
        DIMENSION_FULL.production +
        DIMENSION_FULL.material +
        DIMENSION_FULL.warehouse +
        DIMENSION_FULL.workflow,
    ).toBe(100);
    expect(INTERNAL_FULL_SCORE).toBe(100);
  });
});
