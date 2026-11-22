import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import equipmentDraft from "../modules/equipment.js";
import moldDraft from "../modules/mold.js";

const equipment = sealModule(equipmentDraft, { code: "equipment", domain: "manufacturing" });
const mold = sealModule(moldDraft, { code: "mold", domain: "manufacturing" });

describe("Mold disable and enable lifecycle", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(mold).errors).toEqual([]);
  });

  it("same shape as equipment: two states can switch back and forth, disabled cannot be edited, and it is not an enabled bool", () => {
    expect(mold.fields.some((field) => field.key === "enabled")).toBe(false);
    expect(mold.lifecycle.statuses).toEqual(equipment.lifecycle.statuses);
    expect(mold.lifecycle.transitions).toEqual(equipment.lifecycle.transitions);
    expect(mold.views.list?.filters).toContain("status");
  });
});
