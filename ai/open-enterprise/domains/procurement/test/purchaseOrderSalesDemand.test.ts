import { defineFixtureModule, isReverseQueryable, planListColumns, relationsOf, sealModule, singleState, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseOrderDraft from "../modules/purchaseOrder.js";

const purchaseOrder = sealModule(purchaseOrderDraft, { code: "purchaseOrder", domain: "procurement" });

/**
 * Minimal stubs for the modules this order points at.
 *
 * `relationsOf` checks that every ref points at a known module (a hole in the
 * module table is a real error and must not pass), so this case has to feed in
 * every module purchaseOrder points at. Stubs are used instead of the real catalog:
 * the case pins whether the edge exists on purchaseOrder, which does not depend on
 * what other modules declare. Loading the real catalog would turn red whenever an
 * unrelated module changes.
 */
const stub = (code: string, label: string, domain: string) =>
  defineFixtureModule({
    code,
    label,
    domain,
    fields: [{ key: "code", label: `${label} code`, type: "string", primary: true, required: true }],
    lifecycle: singleState("active", "Active", "green"),
    views: {
      list: { columns: ["code"], searchable: ["code"] },
      form: [{ title: label, fields: ["code"] }],
    },
  });

const salesOrder = stub("salesOrder", "Sales order", "sales");
const referenced = [
  salesOrder,
  stub("supplier", "Supplier", "procurement"),
  stub("product", "Product", "inventory"),
  stub("warehouse", "Warehouse", "inventory"),
  stub("purchasePlan", "Purchase plan", "procurement"),
  stub("subject", "System account", "platform"),
];

describe("purchase order sales-demand source", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(purchaseOrder).errors).toEqual([]);
  });

  it("a direct sales demand can store a stable sales-order reference, and a general replenishment can still leave it empty", () => {
    const source = purchaseOrder.fields.find((field) => field.key === "salesOrderId");
    expect(source).toMatchObject({
      type: "ref",
      ref: "salesOrder",
      required: false,
      derive: null,
    });
    expect(purchaseOrder.views.list.columns).toContain("salesOrderId");
    expect(purchaseOrder.views.list.columns).not.toContain("createdBy");
    const { defaults } = planListColumns(
      purchaseOrder.views.list.columns,
      purchaseOrder.views.list.hideStatus,
      purchaseOrder.views.list.hideAudit,
    );
    expect(defaults.slice(-4)).toEqual(["createdBy", "createdAt", "updatedBy", "updatedAt"]);
    expect(purchaseOrder.views.list.filters).toContain("salesOrderId");
  });

  it("the relation graph reads the sales source from the purchase order and looks up purchase progress from the sales order", () => {
    const modules = [purchaseOrder, ...referenced];
    expect(relationsOf(modules, "purchaseOrder").outbound).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "salesOrderId",
          to: "salesOrder",
          via: "bill",
        }),
      ]),
    );
    const back = relationsOf(modules, "salesOrder").inbound;
    expect(back).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "purchaseOrder",
          field: "salesOrderId",
          via: "bill",
          toLevel: "bill",
        }),
      ]),
    );
    // Reverse lookup is derived from `toLevel`, not a field on Relation.
    // Opening a sales order has to list which purchase orders were placed for it, and this edge is what does that.
    const edge = back.find((r) => r.from === "purchaseOrder" && r.field === "salesOrderId");
    expect(edge && isReverseQueryable(edge)).toBe(true);
  });
});
