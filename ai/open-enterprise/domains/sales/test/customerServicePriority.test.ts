import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { normalizeQuery, relationsOf, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const customer = requireModule(catalog, "customer").schema;
const allModules = [...catalog.modules.values()].map((loaded) => loaded.schema);

function field(key: string) {
  const found = customer.fields.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`customer is missing field ${key}`);
  return found;
}

describe("customer service-priority fact", () => {
  it("the module passes the semantic gates, and priority is a nullable closed enum with no hidden default", () => {
    expect(validateModule(customer).errors).toEqual([]);
    expect(field("servicePriority")).toMatchObject({
      type: "enum",
      options: null,
      choiceSet: "sales.customerServicePriority",
      required: false,
      derive: null,
      lineAgg: null,
      auto: false,
    });
    expect(field("servicePriority").help).toContain("Empty means not yet assessed");
  });

  it("priority is on the customer list and filters, and not on the form", () => {
    expect(customer.views.list.columns).toContain("servicePriority");
    expect(customer.views.list.filters).toContain("servicePriority");
    const allFormFields = customer.views.form.flatMap((section) => section.fields);
    expect(allFormFields).not.toContain("servicePriority");
  });

  it("a general query can select key and urgent customers, and an unassessed customer is not treated as normal", () => {
    const prioritized = normalizeQuery(customer, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "status", op: "eq", value: "active" },
          { kind: "cond", field: "servicePriority", op: "in", value: ["key", "urgent"] },
        ],
      },
      sort: [{ field: "code", desc: false }],
      limit: 100,
    });
    expect(prioritized.where).toMatchObject({ kind: "group", join: "and" });

    const unassessed = normalizeQuery(customer, {
      where: { kind: "cond", field: "servicePriority", op: "is_empty", value: null },
      sort: [],
      limit: 100,
    });
    expect(unassessed.where).toMatchObject({ kind: "cond", field: "servicePriority", op: "is_empty" });
  });

  it("a shortage impact analysis can read service priority along production order, sales order, and customer", () => {
    const productionToSales = relationsOf(allModules, "productionOrder").outbound.find(
      (relation) => relation.field === "salesOrderId",
    );
    const salesToCustomer = relationsOf(allModules, "salesOrder").outbound.find(
      (relation) => relation.field === "customerId",
    );
    expect(productionToSales).toMatchObject({ to: "salesOrder", via: "bill", toLevel: "bill" });
    expect(salesToCustomer).toMatchObject({ to: "customer", via: "bill", toLevel: "bill" });
    expect(field("servicePriority")).toMatchObject({ type: "enum" });
  });
});
