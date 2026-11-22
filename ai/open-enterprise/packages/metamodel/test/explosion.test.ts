import { describe, expect, it } from "vitest";
import { walkExplosion } from "../src/derive/structure.js";
import type { ExplosionView } from "../src/schema/views.js";

const view: ExplosionView = {
  entity: "productId", lines: "lines", component: "componentProductId", qty: "qty", loss: "loss",
  childBom: null, stop: null, activeStatus: "active", preferred: "isDefault", label: "version",
};

describe("walkExplosion", () => {
  it("reports missing root entity instead of walking an empty path", async () => {
    const result = await walkExplosion({
      record: async () => ({ header: {}, lines: { lines: [] } }),
      list: async () => [],
    }, view, "root", { at: "BOM", deep: true });
    expect(result.root).toBe("invalidEntity");
    expect(result.nodes).toHaveLength(0);
  });

  it("walks nested BOMs depth-first and compounds loss", async () => {
    const snapshotView = { ...view, childBom: "childBomId" };
    const records: Record<string, { header: Record<string, unknown>; lines: Record<string, readonly Record<string, unknown>[]> }> = {
      root: { header: { productId: "A" }, lines: { lines: [{ componentProductId: "B", childBomId: "child", qty: 2, loss: 10 }] } },
      child: { header: { productId: "B", status: "active", version: "V1", isDefault: true }, lines: { lines: [{ componentProductId: "C", qty: 3, loss: 0 }] } },
    };
    const result = await walkExplosion({
      record: async (id) => records[id]!,
      list: async (query) => {
        const children = query.where?.kind === "group" ? query.where.children : [];
        const product = children?.find((condition) => condition.kind === "cond" && condition.field === "productId");
        const status = children?.find((condition) => condition.kind === "cond" && condition.field === "status");
        return product && status && product.kind === "cond" && status.kind === "cond" && product.value === "B" && status.value === "active"
          ? [{ id: "child", ...records["child"]!.header }]
          : [];
      },
    }, snapshotView, "root", { at: "BOM", deep: true });
    expect(result.root).toBe("ok");
    expect(result.nodes[0]?.state).toBe("expanded");
    expect(result.nodes[0]?.children[0]?.effective).toBeCloseTo(6.6);
    expect(result.nodes[0]?.children[0]?.loss).toBe(0);
  });

  it("uses an explicit child BOM version without falling back to the default", async () => {
    const explicitView = { ...view, childBom: "childBomId" };
    const records = {
      root: { header: { productId: "A" }, lines: { lines: [{ componentProductId: "B", childBomId: "v2", qty: 1, loss: 0 }] } },
      // A child version disabled later does not change an expansion that already froze the parent BOM snapshot.
      v2: { header: { productId: "B", status: "disabled", version: "V2", isDefault: false }, lines: { lines: [{ componentProductId: "C", qty: 4, loss: 0 }] } },
    } as const;
    const result = await walkExplosion({
      record: async (id) => records[id as keyof typeof records]!,
      list: async (query) => {
        const children = query.where?.kind === "group" ? query.where.children : [];
        const product = children.find((condition) => condition.kind === "cond" && condition.field === "productId");
        return product?.kind === "cond" && product.value === "B"
          ? [{ id: "wrong-default", productId: "B", status: "active", isDefault: true }]
          : [];
      },
    }, explicitView, "root", { at: "BOM", deep: true });
    expect(result.nodes[0]?.childRecordId).toBe("v2");
    expect(result.nodes[0]?.children[0]?.effective).toBe(4);
  });

  it("does not follow a newly introduced default when the snapshot is empty", async () => {
    const explicitView = { ...view, childBom: "childBomId" };
    const result = await walkExplosion({
      record: async () => ({ header: { productId: "A" }, lines: { lines: [{ componentProductId: "B", childBomId: null, qty: 1, loss: 0 }] } }),
      list: async () => [{ id: "new-default", productId: "B", status: "active", isDefault: true }],
    }, explicitView, "root", { at: "BOM", deep: true });
    expect(result.nodes[0]?.childRecordId).toBeNull();
    expect(result.nodes[0]?.state).toBe("leaf");
  });
});
