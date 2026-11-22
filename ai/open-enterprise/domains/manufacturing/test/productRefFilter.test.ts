import { sealModule } from "@open-erp/metamodel";
import type { Field, ModuleSchema } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import bomDraft from "../modules/bom/index.js";
import defectTypeDraft from "../modules/defectType.js";
import equipmentDraft from "../modules/equipment.js";
import moldDraft from "../modules/mold.js";
import operationDraft from "../modules/operation.js";
import orgUnitDraft from "../modules/orgUnit.js";
import routingDraft from "../modules/routing.js";
import workerDraft from "../modules/worker.js";

const bom = sealModule(bomDraft, { code: "bom", domain: "manufacturing" });
const defectType = sealModule(defectTypeDraft, { code: "defectType", domain: "manufacturing" });
const equipment = sealModule(equipmentDraft, { code: "equipment", domain: "manufacturing" });
const mold = sealModule(moldDraft, { code: "mold", domain: "manufacturing" });
const operation = sealModule(operationDraft, { code: "operation", domain: "manufacturing" });
const orgUnit = sealModule(orgUnitDraft, { code: "orgUnit", domain: "manufacturing" });
const routing = sealModule(routingDraft, { code: "routing", domain: "manufacturing" });
const worker = sealModule(workerDraft, { code: "worker", domain: "manufacturing" });

const MODULES: readonly ModuleSchema[] = [
  bom,
  defectType,
  equipment,
  mold,
  operation,
  orgUnit,
  routing,
  worker,
];

/** Every product-reference coordinate in this domain: `<module>.<field>` / `<module>.<line table>.<column>`. Header and line columns are both scanned. */
interface ProductRef {
  readonly at: string;
  readonly field: Field;
}

const productRefs: readonly ProductRef[] = MODULES.flatMap((module) =>
  module.fields.flatMap((field): ProductRef[] => {
    if (field.type === "ref" && field.ref === "product") {
      return [{ at: `${module.code}.${field.key}`, field }];
    }
    if (field.type !== "subtable") return [];
    return (field.fields ?? [])
      .filter((column) => column.type === "ref" && column.ref === "product")
      .map((column) => ({ at: `${module.code}.${field.key}.${column.key}`, field: column }));
  }),
);

const filterOf = (at: string): Readonly<Record<string, unknown>> => {
  const hit = productRefs.find((ref) => ref.at === at);
  if (!hit) throw new Error(`Manufacturing has no product reference at "${at}"`);
  const filter = hit.field.refFilter;
  if (!filter) throw new Error(`"${at}" has no candidate filter`);
  return filter;
};

describe("Product-reference candidate filters: the candidate side and the criterion side are the same", () => {
  // A listed assertion, not a count. One more product-reference coordinate has to be written down here,
  // and that person is asked which levels this cell should narrow to. A zero-tolerance "no new ones"
  // rule gets routed around, and a counter nobody looks at stops nothing.
  it("every manufacturing product-reference coordinate is on the list, and each one declares a candidate filter", () => {
    expect(productRefs.map((ref) => ref.at).sort()).toEqual([
      "bom.lines.componentProductId",
      "bom.productId",
      "mold.applicableProducts.productId",
      "routing.productId",
    ]);
    for (const ref of productRefs) {
      expect(ref.field.refFilter, `"${ref.at}" has no candidate filter`).toBeTruthy();
    }
  });

  // The BOM header no longer uses canProduce / bom_product_makeable. The routing still accepts only makeable items.
  // The entry filter and the activation gate are still the same canProduce.
  it("the BOM header does not filter canProduce; the routing still accepts only makeable items", () => {
    expect(filterOf("bom.productId")["canProduce"]).toBeUndefined();
    expect(bom.preconditions.some((pc) => pc.id === "bom_product_makeable")).toBe(false);
    expect(filterOf("routing.productId")["canProduce"]).toBe(true);
  });

  // refFilter does not replace the precondition. Product use can change, and an existing route
  // does not rerun write validation because the product type changed. The entry filter and the activation gate must be the same value, word for word.
  it("the routing activation gate and the candidate filter are the same value, word for word", () => {
    const rule = routing.preconditions.find((pc) => pc.id === "routing_product_makeable");
    expect(rule, "routing is missing routing_product_makeable").toBeTruthy();
    expect(rule?.level).toBe("block");
    expect(rule?.onCreate).toBe(true);
    expect(rule?.onTransition).toBe("*");
    expect(rule?.check).toMatchObject({
      primitive: "ref_field_compare",
      params: {
        via: { from: "bill", field: "productId" },
        entity: "product",
        field: "canProduce",
        op: "eq",
        right: { value: true },
      },
    });
  });

  // Components and the header are complementary. finished is not someone else's component.
  // rawMaterial and packaging appear only on the component side.
  // semiFinished is on both sides. That is the only place a multi-level BOM is expressed (see bomMultiLevel.test.ts).
  it("the component side accepts purchased items and semiFinished, and does not accept finished", () => {
    expect(filterOf("bom.lines.componentProductId")["productType"]).toEqual(["rawMaterial", "semiFinished", "packaging"]);
  });

  // This pins a judgment, not a value. The candidate side and the write side of refFilter share one condition,
  // so `status: "active"` means "a document that references a disabled product can no longer be saved".
  // After a BOM is active, `editable` is "none". After a routing is active the whitelist does not include productId or lines,
  // so the header product reference stays frozen and can carry the status filter.
  // Customization info is single-state master data, always `editable: "full"`. Adding the filter would reject
  // even a change of owner on every file that once referenced a product after that product is disabled. That pins existing records.
  // Molds (disable exists since 3.5.0) do not carry a status filter: a disabled mold should not appear as a candidate on a new document,
  // but an existing mold file that is already referenced should not become uneditable because it was disabled.
  it("records that freeze carry an active-status filter; single-state master data that stays editable does not", () => {
    expect(filterOf("bom.productId")["status"]).toBe("active");
    expect(filterOf("bom.lines.componentProductId")["status"]).toBe("active");
    expect(filterOf("routing.productId")["status"]).toBe("active");

    expect(bom.lifecycle.statuses.find((s) => s.key === "active")?.editable).toBe("none");
    const routingActive = routing.lifecycle.statuses.find((s) => s.key === "active");
    // After activation only remark can change. productId and lines must stay locked
    expect(routingActive?.editable).toBe("whitelist");
    expect(routingActive?.editableFields).toEqual(["remark"]);
    expect(routingActive?.editableFields).not.toContain("productId");
    expect(routingActive?.editableFields).not.toContain("lines");

    expect(filterOf("mold.applicableProducts.productId")["status"]).toBeUndefined();
  });

  it("a mold applies only to makeable items", () => {
    expect(filterOf("mold.applicableProducts.productId")["canProduce"]).toBe(true);
  });
});
