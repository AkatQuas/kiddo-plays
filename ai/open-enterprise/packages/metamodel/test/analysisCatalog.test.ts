import { describe, expect, it } from "vitest";
import { analysisCatalogOf, analysisRelationOf, businessTableName, defineFixtureModule, type ModuleSchema } from "../src/index.js";

function stubRef(code: string): ModuleSchema {
  return defineFixtureModule({
    code,
    label: code,
    domain: "demo",
    fields: [{ key: "code", label: "Code", type: "string", primary: true, required: true }],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
  });
}

const order = defineFixtureModule({
  code: "purchaseOrder",
  label: "Purchase order",
  domain: "procurement",
  fields: [
    { key: "code", label: "Doc no.", type: "string", required: true, primary: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Qty", type: "number", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", color: "gray", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code", "supplierId"], filters: ["status"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "supplierId", "lines"] }],
  },
});

describe("the analysis catalog is projected from the declaration", () => {
  it("emits one relation for the header and one for the lines, joined through bill_id", () => {
    const catalog = analysisCatalogOf([order, stubRef("supplier"), stubRef("product")]);
    const header = analysisRelationOf(catalog, businessTableName("purchaseOrder"));
    const lines = analysisRelationOf(catalog, businessTableName("purchaseOrder", "lines"));
    expect(header?.grain).toBe("header");
    expect(lines?.grain).toBe("line");
    expect(header?.joins.some((join) => join.to === lines?.name && join.fanoutRisk)).toBe(true);
    expect(lines?.joins.some((join) => join.to === header?.name && join.fromColumns.includes("bill_id"))).toBe(true);
    expect(lines?.fields.some((field) => field.column === "qty")).toBe(true);
  });
});
