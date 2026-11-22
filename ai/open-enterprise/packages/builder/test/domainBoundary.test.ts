// ---------------------------------------------------------------------------
// A removed module must not come back as the same document.
//
// This does not enumerate future demand by module name. A real new fact still
// has to be justified by the modeling brief. This only pins historical
// documents that were deleted from the catalog and must not return under the
// original code.
// ---------------------------------------------------------------------------

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@open-erp/loader";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const DOMAINS = path.join(ROOT, "domains");

describe("product boundary: a removed module must not return as the same document", () => {
  it("a removed module must not return under its original code", async () => {
    // The input of `productionRelease` is only the transient params of productionOrder.release; the execution fact is the production task.
    // `processTask` used to make "which operations" its own document; that is now the production-task operation subtable.
    // `processAssignment` now has its own responsibility fact: who owns which operation and how many good pieces, one sheet per person.
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const forbidden = [
      "productionRelease",
      "processTask",
      "customization",
      "salesReturn",
      "stockMove",
      "productionPlanAdjustment",
      "warehouseDemand",
    ] as const;
    const restored = forbidden.filter((code) => catalog.modules.has(code));

    expect(
      restored,
      "A removed module must not return under its original code. " +
        "processAssignment stays: it records who owns which operation and how many good pieces, and it is not a restatement of the task lines.",
    ).toEqual([]);
    expect(catalog.modules.has("processAssignment")).toBe(true);
  });
});
