import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analysisCatalogOf,
  analysisJoinExampleFromCatalog,
  analysisJoinExampleFromModules,
  businessTableName,
  defineFixtureModule,
  type ModuleSchema,
} from "../src/index.js";

function stubRef(code: string, label: string): ModuleSchema {
  return defineFixtureModule({
    code,
    label,
    domain: "demo",
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, required: true },
      { key: "name", label: "Name", type: "string", required: true },
    ],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code", "name"] }] },
  });
}

const header = defineFixtureModule({
  code: "demoOrder",
  label: "Demo order",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "partnerId", label: "Counterparty", type: "ref", ref: "demoPartner", required: true },
    { key: "totalAmount", label: "Amount", type: "money", required: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "demoOrderLine",
      fields: [
        { key: "itemId", label: "Product", type: "ref", ref: "demoItem", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", color: "gray", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code", "partnerId"], filters: ["status"], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "partnerId", "totalAmount", "lines"] }],
  },
});

describe("analyzing SQL examples generated from directory real tables", () => {
  it("example table name from the analytical directory with at least two tables INNER JOIN", () => {
    const modules = [header, stubRef("demoPartner", "Counterparty"), stubRef("demoItem", "Product")];
    const catalog = analysisCatalogOf(modules);
    const example = analysisJoinExampleFromCatalog(catalog);
    expect(example, "the catalog has a header-to-archive ref, so a JOIN example should be generated").not.toBeNull();
    const names = new Set(catalog.relations.map((relation) => relation.name));
    expect(names.has(example!.fromTable)).toBe(true);
    expect(names.has(example!.toTable)).toBe(true);
    expect(example!.fromTable).not.toBe(example!.toTable);
    expect(example!.sql).toMatch(/INNER JOIN/);
    expect(example!.sql).toContain(example!.fromTable);
    expect(example!.sql).toContain(example!.toTable);
    expect(example!.sql).not.toContain("oe_sales_order");
    expect(example!.fromTable).toBe(businessTableName("demoOrder"));
    expect(example!.toTable).toBe(businessTableName("demoPartner"));
  });

  it("the module table is returned to the header/detail when the file is quoted, and remains the true two tables, JOIN", () => {
    const example = analysisJoinExampleFromModules([header]);
    expect(example).not.toBeNull();
    expect(example!.sql).toMatch(/INNER JOIN/);
    expect(example!.fromTable).toBe(businessTableName("demoOrder", "lines"));
    expect(example!.toTable).toBe(businessTableName("demoOrder"));
    expect(example!.sql).not.toContain("oe_sales_order");
  });

  it("the gate and example generator source is not written dead", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = (file: string) => readFileSync(path.join(here, "../src", file), "utf8");
    expect(src("derive/analysisExample.ts")).not.toContain("oe_sales_order");
    expect(src("normalize/analysisSql.ts")).not.toContain("oe_sales_order");
  });
});
