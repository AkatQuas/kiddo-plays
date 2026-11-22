import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import {
  editableFields,
  isReverseQueryable,
  normalizeQuery,
  relationsOf,
  reverseQueryFieldOf,
  validateModule,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const productionOrder = requireModule(catalog, "productionOrder").schema;
const allModules = [...catalog.modules.values()].map((loaded) => loaded.schema);

function field(key: string) {
  const found = productionOrder.fields.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`productionOrder missing field ${key}`);
  return found;
}

describe("Production order sales source", () => {
  // `productionType` says who makes the goods. It does not say why they are made.
  // The old options [make to order, make to stock, subcontract production] mixed two orthogonal axes in one field. The first two were demand source, and `salesOrderId` already says whether a sales order exists. Keeping them would be a second source of truth.
  // This assertion pins that source semantics no longer appear in this field.
  it("productionType says only who makes it; the source axis stays on salesOrderId and does not invent a second source type", () => {
    expect(validateModule(productionOrder).errors).toEqual([]);
    expect(field("productionType")).toMatchObject({ type: "enum", required: true });
    expect(field("productionType").options?.map((option) => option.value)).toEqual(["standardProduction", "subcontractProduction", "inHouseProcessing"]);
    // Source semantics must not return to this field
    for (const forbidden of ["Make to order", "Make to stock"]) {
      expect(field("productionType").options?.map((option) => option.value)).not.toContain(forbidden);
    }
    expect(productionOrder.fields.some((candidate) => candidate.key === "sourceNo")).toBe(false);
  });

  it("salesOrderId is an optional business fact, shown in the list, filters, and form; it cannot change after the pending-review row is stored (the source coordinate)", () => {
    expect(field("salesOrderId")).toMatchObject({
      type: "ref",
      ref: "salesOrder",
      required: false,
      derive: null,
      lineAgg: null,
      auto: false,
    });
    // Create and convert-to-production write through creatableFields. The pending-review edit whitelist deliberately excludes the source sales order.
    expect(editableFields(productionOrder, "pendingReview")).not.toContain("salesOrderId");
    // A production order has no draft. Creating the document puts it in pending review, and that is the initial status where fields can still change.
    const draft = productionOrder.lifecycle.statuses.find((s) => s.key === "pendingReview");
    expect(draft?.editable).toBe("whitelist");
    expect(draft?.editableFields).not.toContain("salesOrderId");
    expect(productionOrder.views.list.columns).toContain("salesOrderId");
    expect(productionOrder.views.list.filters).toContain("salesOrderId");
    expect(productionOrder.views.form.find((section) => section.title === "Order")?.fields).toContain("salesOrderId");
  });

  it("a generic query can find production orders and their current status by sales order, with no dedicated query tool", () => {
    const query = normalizeQuery(productionOrder, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "salesOrderId", op: "eq", value: "sales-order-1" },
          { kind: "cond", field: "status", op: "in", value: ["pendingReview", "awaitingRelease", "releasing", "inProduction", "finished"] },
        ],
      },
      sort: [{ field: "createdAt", desc: true }],
      limit: 100,
    });
    expect(query.where).toMatchObject({ kind: "group", join: "and" });
    expect(query.sort).toEqual([{ field: "createdAt", desc: true }]);
  });

  it("the sales order to production order relation is traversable both ways, and the sales order detail can look up every production progress", () => {
    const outbound = relationsOf(allModules, "productionOrder").outbound.find(
      (relation) => relation.field === "salesOrderId",
    );
    expect(outbound).toMatchObject({
      from: "productionOrder",
      to: "salesOrder",
      via: "bill",
      toLevel: "bill",
      through: null,
    });
    expect(outbound && isReverseQueryable(outbound)).toBe(true);
    expect(outbound ? reverseQueryFieldOf(outbound) : null).toBe("salesOrderId");

    const inbound = relationsOf(allModules, "salesOrder").inbound.find(
      (relation) => relation.from === "productionOrder" && relation.field === "salesOrderId",
    );
    expect(inbound).toEqual(outbound);
  });
});
