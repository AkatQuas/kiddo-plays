import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import bomDraft from "../modules/bom/index.js";

const bom = sealModule(bomDraft, { code: "bom", domain: "manufacturing" });

const field = (key: string) => {
  const hit = bom.fields.find((f) => f.key === key);
  if (!hit) throw new Error(`The BOM has no "${key}"`);
  return hit;
};

const lineField = (key: string) => {
  const table = field("lines");
  const hit = table.fields?.find((f) => f.key === key);
  if (!hit) throw new Error(`BOM lines have no "${key}"`);
  return hit;
};

describe("Multi-level BOM: parent and child are parentLineNo on the same document", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(bom).errors).toEqual([]);
  });

  it("lines no longer declare a child BOM version; parent and child use parentLineNo", () => {
    const table = field("lines");
    const refs = (table.fields ?? []).filter((f) => f.type === "ref" || f.type === "refLine");
    expect(refs.map((f) => f.key).sort()).toEqual(["componentProductId", "defaultIssueWarehouseId"]);
    expect(lineField("componentProductId").ref).toBe("product");
    expect(lineField("parentLineNo").type).toBe("number");
    expect(table.fields?.some((f) => f.key === "childBomId")).toBe(false);
    expect(bom.views.explosion?.childBom).toBeNull();
  });
});
