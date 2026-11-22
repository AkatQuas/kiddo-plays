import { describe, expect, it } from "vitest";
import { bomImpactsOf, nextBomVersion, upgradedBomDraft, type BomImpactSnapshot } from "../modules/bom/impact.js";

const bom = (id: string, productId: string, lines: readonly Readonly<Record<string, unknown>>[], version = "V1.0"): BomImpactSnapshot => ({
  id, productId, version, status: "active", lines,
});

describe("BOM impact analysis and version copy", () => {
  it("finds direct and indirect parents by component product", () => {
    const rows = [
      bom("b-motor", "motor", [{ componentProductId: "shaft" }]),
      bom("b-shaft", "shaft", [{ componentProductId: "steel" }]),
      bom("b-pump", "pump", [{ componentProductId: "motor" }]),
      bom("b-old", "old", [{ componentProductId: "other" }]),
    ];
    expect(bomImpactsOf(rows, "b-shaft")).toEqual([
      { bomId: "b-motor", productId: "motor", distance: 1, productPath: ["shaft", "motor"], direct: true },
      { bomId: "b-pump", productId: "pump", distance: 2, productPath: ["shaft", "motor", "pump"], direct: false },
    ]);
  });

  it("the version number increments only from versions that already exist, and does not accept a user-defined one", () => {
    expect(nextBomVersion([])).toBe("V1.0");
    expect(nextBomVersion(["V1.0", "V1.2", "V2.0"])).toBe("V2.1");
    expect(nextBomVersion(["legacy", "V3.9"])).toBe("V3.10");
  });

  it("copy clears platform line coordinates and the retired childBomId", () => {
    const pointer = { kind: "createdId", commandId: "new-child" } as const;
    const result = upgradedBomDraft(
      bom("b-motor", "motor", [{ id: "line-1", lineNo: 1, componentProductId: "shaft", unitQty: 1, childBomId: "old-pin" }]),
      "V1.1",
      new Map(),
      "shaft",
      pointer,
    );
    expect(result.header).toEqual({ productId: "motor", version: "V1.1", remark: null });
    const copied = result.lines["lines"] ?? [];
    expect(copied[0]).toMatchObject({ componentProductId: "shaft", unitQty: 1 });
    expect(copied[0]).not.toHaveProperty("id");
    expect(copied[0]).not.toHaveProperty("lineNo");
    expect(copied[0]).not.toHaveProperty("childBomId");
  });
});
