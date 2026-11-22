import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, validateModule } from "../src/index.js";

function raw(workbenches: unknown) {
  return {
    code: "job",
    label: "Task",
    domain: "demo",
    numbering: { prefix: "RW", seqScope: "day" },
    fields: [{ key: "code", label: "Code", type: "string", primary: true, auto: true }],
    lifecycle: {
      statuses: [
        { key: "pending", label: "pending", initial: true },
        { key: "completed", label: "completed", terminal: true },
      ],
      transitions: [{ code: "finish", from: "pending", to: "completed", action: "Finish" }],
    },
    views: { list: { columns: ["code", "status"] }, workbenches },
  };
}

describe("views.workbenches", () => {
  it("defaults to empty, and normalizes a fixed status slice", () => {
    expect(normalizeFixtureModule(raw(undefined)).views.workbenches).toEqual([]);
    expect(normalizeFixtureModule(raw([{ code: "pending", label: "Pending workbench", statuses: ["pending"] }])).views.workbenches)
      .toEqual([{ code: "pending", label: "Pending workbench", statuses: ["pending"] }]);
  });

  it("rejects an unknown status at modeling time", () => {
    const report = validateModule(normalizeFixtureModule(raw([
      { code: "pending", label: "Pending workbench", statuses: ["missing"] },
    ])));
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VIEW_WORKBENCH_STATUS_UNKNOWN" }),
    ]));
  });
});
