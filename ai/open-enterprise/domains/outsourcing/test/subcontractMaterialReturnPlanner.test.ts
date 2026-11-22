import { sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import subcontractMaterialReturnDraft from "../modules/subcontractMaterialReturn/index.js";

const subcontractMaterialReturn = sealModule(subcontractMaterialReturnDraft, { code: "subcontractMaterialReturn", domain: "outsourcing" });

describe("Confirming subcontract leftover posts immediately", () => {
  it("both a return and a loss post at once and no longer create a warehouse job demand", () => {
    const release = subcontractMaterialReturn.lifecycle.transitions.find((edge) => edge.code === "releaseDemand");
    const loss = subcontractMaterialReturn.lifecycle.transitions.find((edge) => edge.code === "releaseLossDemand");
    expect(release).toMatchObject({
      from: "pending",
      to: "returned",
      primary: true,
      push: null,
      when: {
        primitive: "field_compare",
        params: { left: { ref: "$bill.handlingType" }, op: "eq", right: { value: "Return to warehouse" } },
      },
    });
    expect(release?.effects.some((effect) => effect.target === "stock")).toBe(true);
    expect(loss).toMatchObject({
      from: "pending",
      to: "lossConfirmed",
      primary: true,
      push: null,
      when: {
        primitive: "field_compare",
        params: { left: { ref: "$bill.handlingType" }, op: "eq", right: { value: "Confirm loss" } },
      },
    });
    expect(loss?.effects.some((effect) => effect.target === "stock")).toBe(true);
  });
});
