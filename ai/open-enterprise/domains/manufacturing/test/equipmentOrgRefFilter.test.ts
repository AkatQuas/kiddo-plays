import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import equipmentDraft from "../modules/equipment.js";

const equipment = sealModule(equipmentDraft, { code: "equipment", domain: "manufacturing" });

describe("Equipment production organization lists only the line level", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(equipment).errors).toEqual([]);
  });

  // The candidate filter is a declaration, not a screen behavior. Deleting it does not error.
  // The dropdown just lists the whole organization tree again. The live miss was this cell
  // lacking `orgType: "line"`. Pinned here: without that sentence, factory, workshop, and team can be chosen again.
  it("the production organization candidate and the write use the same line filter", () => {
    const field = equipment.fields.find((item) => item.key === "productionOrgId");
    expect(field).toMatchObject({
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "line" },
    });
  });
});
