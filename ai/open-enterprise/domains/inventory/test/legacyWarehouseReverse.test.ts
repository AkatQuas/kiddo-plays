import { sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import stockOutDraft from "../modules/stockOut.js";

const stockOut = sealModule(stockOutDraft, { code: "stockOut", domain: "inventory" });

describe("Simplified stock-out lifecycle", () => {
  it("uses void instead of the old delivery reversal", () => {
    expect(stockOut.lifecycle.transitions.find((transition) => transition.code === "void")).toMatchObject({
      from: "approved",
      to: "voided",
    });
    expect(stockOut.lifecycle.transitions.some((transition) => transition.code === "reverse")).toBe(false);
  });
});
