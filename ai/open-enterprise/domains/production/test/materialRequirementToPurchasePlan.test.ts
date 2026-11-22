import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { isPushFillable, isSystemSupplied, type Field } from "@open-erp/metamodel";
import { buildPushDraft } from "@open-erp/runtime-core";
import { describe, expect, it } from "vitest";

/**
 * Material requirement to purchase plan. The pin is not whether the edge exists. It is that the pushed draft can be stored:
 * warehouse, product, quantity, and arrival date come from the requirement, the buyer may be blank on the draft, and the plan date carries the requirement date.
 */
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const materialRequirement = requireModule(catalog, "materialRequirement").schema;
const purchasePlan = requireModule(catalog, "purchasePlan").schema;
const edge = materialRequirement.lifecycle.transitions.find((one) => one.code === "toPurchasePlan");

describe("Material requirement push to purchase plan", () => {
  it("a self-loop push stores the draft on the purchase plan", () => {
    expect(edge).toMatchObject({
      from: "awaitingIssue",
      to: "awaitingIssue",
      push: "purchasePlan",
    });
  });

  it("every required field on the purchase plan can be filled", () => {
    const pinned = new Set(Object.keys(edge?.pushDefaults ?? {}));
    const missingHeader = purchasePlan.fields
      .filter((field) => field.required && !pinned.has(field.key) && !isPushFillable(materialRequirement, field, null, isSystemSupplied))
      .map((field) => field.key);
    expect(missingHeader, `The pushed draft cannot fill required header fields: ${missingHeader.join(", ")}`).toEqual([]);

    const targetTable = purchasePlan.fields.find((one) => one.key === "lines") as Field;
    const missingLine = (targetTable.fields ?? [])
      .filter(
        (field) =>
          field.required &&
          !pinned.has(`lines.${field.key}`) &&
          !isPushFillable(materialRequirement, field, targetTable, isSystemSupplied),
      )
      .map((field) => field.key);
    expect(missingLine, `The pushed draft cannot fill required line fields: ${missingLine.join(", ")}`).toEqual([]);
  });

  it("buildPushDraft carries warehouse, product, quantity, and arrival date, and leaves the buyer blank", () => {
    const draft = buildPushDraft(
      materialRequirement,
      purchasePlan,
      {
        id: "mr-1",
        revision: 1,
        header: {
          issueWarehouseId: "wh-sh",
          requiredDate: "2026-09-10",
          productId: "p-shaft",
        },
        lines: {
          lines: [
            {
              id: "mr-1-line-1",
              componentProductId: "p-brg-608",
              unit: "meter",
              unitFactor: 1,
              requiredQty: 20,
            },
          ],
        },
      },
      edge?.pushDefaults ?? null,
    );
    expect(draft.header["warehouseId"]).toBe("wh-sh");
    expect(draft.header["planDate"]).toBe("2026-09-10");
    expect(draft.header["materialRequirementId"]).toBe("mr-1");
    expect(draft.header["buyer"]).toBeUndefined();
    expect(draft.lines["lines"]?.[0]).toMatchObject({
      productId: "p-brg-608",
      unit: "meter",
      qty: 20,
      planArrivalDate: "2026-09-10",
    });
  });
});
