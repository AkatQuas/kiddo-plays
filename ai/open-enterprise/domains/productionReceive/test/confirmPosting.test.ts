import { sealModule } from "@open-erp/metamodel";
import type { ModuleSchema } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import materialIssueDraft from "../modules/materialIssue.js";
import materialReturnDraft from "../modules/materialReturn.js";
import productionReceiptDraft from "../modules/productionReceipt/index.js";

const materialIssue = sealModule(materialIssueDraft, { code: "materialIssue", domain: "productionReceive" });
const materialReturn = sealModule(materialReturnDraft, { code: "materialReturn", domain: "productionReceive" });
const productionReceipt = sealModule(productionReceiptDraft, { code: "productionReceipt", domain: "productionReceive" });

function edge(module: ModuleSchema, code: string) {
  const found = module.lifecycle.transitions.find((transition) => transition.code === code);
  if (!found) throw new Error(`${module.code} is missing ${code}`);
  return found;
}

describe("Production receive: confirming posts stock", () => {
  it("confirming a material issue posts stock and no longer hands the document to the warehouse", () => {
    expect(materialIssue.lifecycle.transitions.find((transition) => transition.code === "releaseDemand")).toBeUndefined();
    const confirm = edge(materialIssue, "confirm");
    expect(confirm).toMatchObject({ from: "pendingReview", to: "issued", primary: true, push: null });
    expect(confirm.effects.some((effect) => effect.target === "stock")).toBe(true);
  });

  it("a material return posts stock only on the public confirm edge", () => {
    const module = materialReturn;
    const release = edge(module, "releaseDemand");
    expect(release).toMatchObject({ from: "pendingReview", to: "completed", primary: true, push: null });
    expect(release.effects.some((effect) => effect.target === "stock")).toBe(true);

    for (const code of ["audit", "complete", "closeRemainder", "reopenAfterWarehouseReversal"]) {
      expect(module.lifecycle.transitions.find((transition) => transition.code === code), `${module.code}.${code}`).toBeUndefined();
    }
    expect(module.lifecycle.statuses.map((status) => status.key)).not.toContain("Awaiting work");
    expect(module.fields.find((field) => field.key === "postingModel")).toBeUndefined();
  });

  it("a completion receipt creates the goods receipt through a planner, and the source edge does not post stock again", () => {
    const release = edge(productionReceipt, "releaseDemand");
    expect(release).toMatchObject({ from: "pendingReview", to: "completed", primary: true, push: null, effects: [] });
    for (const code of ["audit", "complete", "closeRemainder", "reopenAfterWarehouseReversal"]) {
      expect(productionReceipt.lifecycle.transitions.find((transition) => transition.code === code), `productionReceipt.${code}`).toBeUndefined();
    }
    expect(productionReceipt.lifecycle.statuses.map((status) => status.key)).not.toContain("Awaiting work");
    expect(productionReceipt.fields.find((field) => field.key === "postingModel")).toBeUndefined();
  });

  it("demand lines share the quantity, warehouse, product, and amount pipeline; the amount is zero and is not entered on the floor", () => {
    for (const module of [materialReturn, productionReceipt]) {
      const lines = module.fields.find((field) => field.key === "lines");
      const fields = lines?.fields ?? [];
      for (const key of ["productId", "warehouseId", "qty", "baseQty", "baseUnitPrice"]) {
        expect(fields.some((field) => field.key === key), `${module.code}.lines.${key}`).toBe(true);
      }
      expect(fields.find((field) => field.key === "baseUnitPrice")).toMatchObject({
        hidden: true,
        derive: { kind: "formula", expr: { value: 0 } },
      });
    }
  });
});
