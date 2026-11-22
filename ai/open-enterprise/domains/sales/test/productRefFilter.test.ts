import { sealModule } from "@open-erp/metamodel";
import type { Field, ModuleSchema } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import customerDraft from "../modules/customer.js";
import salesDeliveryDraft from "../modules/salesDelivery.js";
import salesInvoiceDraft from "../modules/salesInvoice.js";
import salesOrderDraft from "../modules/salesOrder/index.js";

const customer = sealModule(customerDraft, { code: "customer", domain: "sales" });
const salesDelivery = sealModule(salesDeliveryDraft, { code: "salesDelivery", domain: "sales" });
const salesInvoice = sealModule(salesInvoiceDraft, { code: "salesInvoice", domain: "sales" });
const salesOrder = sealModule(salesOrderDraft, { code: "salesOrder", domain: "sales" });

const MODULES: readonly ModuleSchema[] = [customer, salesDelivery, salesInvoice, salesOrder];

/** Every product reference in the domain: `<module>.<field>` / `<module>.<lines>.<column>`, header and line columns together. */
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

const refAt = (at: string): Field => {
  const hit = productRefs.find((ref) => ref.at === at);
  if (!hit) throw new Error(`sales has no product reference at ${at}`);
  return hit.field;
};

/** The sellable set. It is not the same sentence as manufacturing `MAKEABLE` (see the note on the sales-order line). */
describe("sales product references: only SKUs that are explicitly sellable", () => {
  // A listed assertion, not a count. One more product reference must be written down here,
  // which also asks which set that cell should narrow to. Same shape as the manufacturing list.
  it("every sales product reference is on the list", () => {
    expect(productRefs.map((ref) => ref.at).sort()).toEqual([
      "salesDelivery.lines.productId",
      "salesOrder.lines.productId",
    ]);
  });

  it("an order line picks only a sellable, active SKU", () => {
    expect(refAt("salesOrder.lines.productId").refFilter).toEqual({
      canSell: true,
      status: "active",
    });
  });

  // refFilter does not replace the precondition. The material type is editable (it is in product's
  // editableFields), and an order that selected a product and then sat in pending review does not re-run write validation.
  // The two criteria must be the same value, or "allowed at entry, rejected at approval" shows up on one document.
  it("the gate at approval and the candidate filter are the same value, and both are present", () => {
    const rule = salesOrder.preconditions.find((pc) => pc.id === "order_product_sellable");
    expect(rule, "salesOrder is missing order_product_sellable").toBeTruthy();
    expect(rule?.level).toBe("block");
    expect(rule?.onTransition).toBe("approve");
    expect(rule?.check).toMatchObject({
      primitive: "ref_field_compare",
      params: {
        via: { from: "line", field: "productId" },
        entity: "product",
        field: "canSell",
        op: "eq",
        right: { value: true },
      },
    });
    // One value set: written once on the filter and once on the criterion. If they drift,
    // the dropdown can select what approval rejects, which is the failure candidate filtering exists to remove
    expect(refAt("salesOrder.lines.productId").refFilter?.["canSell"]).toBe(true);
  });

  // The issue line deliberately has no candidate filter. That is not an omission.
  //
  // This cell already has a stronger criterion: `delivery_product_matches_source_line`
  // says the issue-line product must equal the product on the order line `orderLineId` points at. That order line
  // is already narrowed by the two gates above, so the criterion is inherited and does not need a weaker copy here.
  //
  // A second copy has a real cost. A refFilter's candidate surface and write surface share one condition.
  // Adding `status: "active"` means that after a selling model is disabled, the rest of an in-flight order cannot be issued
  // (a pushed issue document goes through `createGenerated` and the same write validation). Finishing in-flight orders
  // for a discontinued model is normal. Narrowing what a cell can pick assumes a person freely picks it. This cell is not that.
  it("the issue line does not add a weaker filter; its product is pinned by the source order line", () => {
    expect(refAt("salesDelivery.lines.productId").refFilter).toBeNull();
    const pinned = salesDelivery.preconditions.find((pc) => pc.id === "delivery_product_matches_source_line");
    expect(pinned, "the comparison of issue-line product to source order line is gone, so the premise of that filter no longer holds").toBeTruthy();
    expect(pinned?.level).toBe("block");
  });

  // Written down: the criterion says lines cannot be edited outside pending review, which is what makes `status: "active"` safe.
  // If someone puts lines on a whitelist, disabling a product would make that in-flight order unable to save even its remark.
  it("only pending review can edit lines, which is why an order line may filter on active", () => {
    for (const status of salesOrder.lifecycle.statuses) {
      if (status.key === "pendingReview") {
        // Pending review does not declare editable, so the platform default is fully writable, and lines are included
        expect(status.editable).toBe("full");
        continue;
      }
      if (status.editable !== "whitelist") continue;
      expect(status.editableFields, `${status.key} whitelist contains lines`).not.toContain("lines");
    }
  });
});
