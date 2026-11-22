import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import moldDraft from "../modules/mold.js";

const mold = sealModule(moldDraft, { code: "mold", domain: "manufacturing" });

describe("Mold production organization lists only the factory level", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(mold).errors).toEqual([]);
  });

  // The candidate filter is a declaration, not a screen behavior. Deleting it does not error.
  // The dropdown just lists the whole organization tree again. The live miss was this cell
  // lacking `orgType: "factory"`. Pinned here: without that sentence, workshop, line, and team can be chosen again.
  it("the production organization candidate and the write use the same factory filter", () => {
    const field = mold.fields.find((item) => item.key === "productionOrgId");
    expect(field).toMatchObject({
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "factory" },
    });
  });
});
