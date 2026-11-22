import { describe, expect, it } from "vitest";
import { evaluateCheck, normalizeCheck, type RuleContext } from "../src/derive/primitives.js";

describe("recursive_ref_free", () => {
  it("requires a child BOM snapshot for half-finished components", async () => {
    const check = normalizeCheck({
      primitive: "line_ref_required_if_ref_field", refField: "childBomId", via: "componentProductId", entity: "product", targetField: "productType", whenValues: ["semi"],
    });
    const ctx: RuleContext = {
      bill: {}, lines: [{ componentProductId: "semi", childBomId: null }, { componentProductId: "raw", childBomId: null }], params: {}, actor: {},
      labels: { bill: {}, line: { childBomId: "Child BOM version", componentProductId: "Component product" }, param: {} }, now: new Date(),
      query: { get: async (_entity, id) => String(id) === "semi" ? { productType: "semi" } : { productType: "raw" }, list: async () => [], balance: async () => 0 },
    };
    const result = await evaluateCheck(check, ctx);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("line 1");
    expect(result.detail).toContain("Child BOM version");
  });

  it("blocks an indirect A → B → A BOM cycle", async () => {
    const check = normalizeCheck({
      primitive: "recursive_ref_free", entity: "bom", root: "productId", lines: "lines",
      component: "componentProductId", child: null, activeStatus: "active",
    });
    const records: Record<string, Readonly<Record<string, unknown>>> = {
      b: { id: "b", productId: "B", status: "active", lines: [{ componentProductId: "A" }] },
    };
    const ctx: RuleContext = {
      bill: { productId: "A", lines: [{ componentProductId: "B" }] }, lines: [], params: {}, actor: {},
      labels: { bill: {}, line: {}, param: {} }, now: new Date(),
      query: {
        get: async (_entity, id) => records[String(id)] ?? null,
        list: async (_entity, where) => where["productId"] === "B" ? [{ id: "b", ...records["b"] }] : [],
        balance: async () => 0,
      },
    };
    const result = await evaluateCheck(check, ctx);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("cyclic reference");
  });

  it("follows the explicit child BOM version, and does not pick another version at random from the component product", async () => {
    const check = normalizeCheck({
      primitive: "recursive_ref_free", entity: "bom", root: "productId", lines: "lines",
      component: "componentProductId", child: "childBomId", activeStatus: "active",
    });
    const records: Record<string, Readonly<Record<string, unknown>>> = {
      "b-safe": { id: "b-safe", productId: "B", status: "active", lines: [{ componentProductId: "C" }] },
      "b-cycle": { id: "b-cycle", productId: "B", status: "active", lines: [{ componentProductId: "A", childBomId: "a-old" }] },
      "a-old": { id: "a-old", productId: "A", status: "disabled", lines: [{ componentProductId: "B", childBomId: "b-cycle" }] },
    };
    const ctx: RuleContext = {
      bill: { productId: "A", lines: [{ componentProductId: "B", childBomId: "b-cycle" }] }, lines: [], params: {}, actor: {},
      labels: { bill: {}, line: {}, param: {} }, now: new Date(),
      query: {
        get: async (_entity, id) => records[String(id)] ?? null,
        list: async () => [{ id: "b-safe", ...records["b-safe"] }],
        balance: async () => 0,
      },
    };
    const result = await evaluateCheck(check, ctx);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("cyclic reference");
  });
});
