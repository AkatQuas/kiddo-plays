import { describe, expect, it } from "vitest";
import { planUnknownCatalogRoleGrantRemoval } from "../src/repo/localRbacCatalogRepo.js";

describe("planUnknownCatalogRoleGrantRemoval", () => {
  it("drops unknown module rows and unknown system keys, and keeps a known module row", () => {
    const plan = planUnknownCatalogRoleGrantRemoval({
      catalogModules: new Set(["task"]),
      catalogSystemKeys: new Set(["system:rbac:manage"]),
      stored: [
        { id: "g-old-system", roleId: "r-admin", roleCode: "tenant-admin", module: null, systemKey: "system:removed" },
        // A known module row stays. A stale action, button, or field is not on this plan, so the row is not deleted for that.
        { id: "g-known-module", roleId: "r-admin", roleCode: "tenant-admin", module: "task", systemKey: null },
        { id: "g-known-system", roleId: "r-custom", roleCode: "custom", module: null, systemKey: "system:rbac:manage" },
        { id: "g-unknown-module", roleId: "r-custom", roleCode: "custom", module: "removed", systemKey: null },
        { id: "g-both", roleId: "r-custom", roleCode: "custom", module: "task", systemKey: "system:rbac:manage" },
        { id: "g-neither", roleId: "r-custom", roleCode: "custom", module: null, systemKey: null },
      ],
    });
    expect(plan).toEqual({
      removeIds: ["g-both", "g-neither", "g-old-system", "g-unknown-module"],
    });
  });

  it("does not invent grants for missing product-template keys", () => {
    const plan = planUnknownCatalogRoleGrantRemoval({
      catalogModules: new Set(["task"]),
      catalogSystemKeys: new Set(["system:new"]),
      stored: [],
    });
    expect(plan).toEqual({ removeIds: [] });
  });
});
