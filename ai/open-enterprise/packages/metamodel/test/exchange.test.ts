// ---------------------------------------------------------------------------
// import / Export ** Decision** (which columns, what name, how value becomes a cell)
//
// This is a bad document, CSV. `packages/server/test/csv.test.ts`I don't know. The reason why this knife is here.
// and that's what this test's about to nail: the day it turns to xlsx, each of the following must be set up as it is.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  cellOf,
  exportColumnsOf,
  needsLabel,
  importCandidateSourceOf,
  importColumnsOf,
  importExampleRow,
  importSubtableColumnsOf,
  importTemplateColumnsOf,
  matchImportHeader,
  normalizeFixtureModule,
  parseCell,
  coerceWriteBool,
  coerceWriteValue,
  resolveListColumns,
  type ExchangeColumn,
} from "../src/index.js";

function salesOrder(): Record<string, unknown> {
  return structuredClone({
    code: "salesOrder",
    label: "Sales order",
    domain: "sales",
    numbering: { prefix: "XS", seqScope: "day" },
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true, auto: true },
      { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
      { key: "orderDate", label: "Order date", type: "date", required: true },
      { key: "urgent", label: "Urgent", type: "bool" },
      { key: "discount", label: "Discount", type: "percent" },
      { key: "remark", label: "Remark", type: "text" },
      { key: "totalAmount", label: "Order amount", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "salesOrderLine",
        fields: [
          { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
          { key: "qty", label: "Quantity", type: "number", required: true },
          { key: "amount", label: "Amount", type: "money" },
        ],
      },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "completed", label: "completed", terminal: true },
      ],
      transitions: [{ code: "finish", from: "draft", to: "completed", action: "Complete", primary: true }],
    },
    views: { list: { columns: ["code", "customerId", "totalAmount"] } },
  });
}

const schema = normalizeFixtureModule(salesOrder());
const ALL = (): boolean => true;

function schemaWithChoiceSet() {
  const raw = salesOrder();
  const fields = raw["fields"] as Array<Record<string, unknown>>;
  fields.splice(3, 0, {
    key: "orderSource",
    label: "Order source",
    type: "enum",
    choiceSet: "sales.orderSource",
  });
  (raw["views"] as { list: { columns: string[] } }).list.columns.push("orderSource");
  return normalizeFixtureModule(raw);
}

describe("export column = views.list, no new declaration", () => {
  it("default columns are those that are displayed on the list page at this time, and the header is Chinese label", () => {
    const visible = resolveListColumns(schema, []).columns.map((c) => c.field);
    const columns = exportColumnsOf(schema, visible, ALL);
    // Order follows the list page word for word (`status` Plugged by planListColumns after master identifier)-
    // "It's what I see" includes the sequences, and the rows will be out of control.
    expect(columns.map((c) => c.label)).toEqual([
      "Document number",
      "Status",
      "Customer",
      "Order amount",
      "Created by",
      "Created at",
      "Updated by",
      "Last updated at",
    ]);
    expect(columns.map((c) => c.path)).toEqual([
      "code",
      "status",
      "customerId",
      "totalAmount",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt",
    ]);
  });

  it("🔴 The Chinese name of the platform field is PLATFORM QUERY FIELDS, that one, not a table in the export", () => {
    const columns = exportColumnsOf(schema, ["status", "createdAt", "createdBy"], ALL);
    expect(columns.map((c) => c.label)).toEqual(["Status", "Created at", "Created by"]);
    // platform field does not have Field - value as text without checking a non-existent type
    expect(columns.every((c) => c.field === null)).toBe(true);
  });

  it("🔴 Unread columns do not appear in files - canExposeField", () => {
    const columns = exportColumnsOf(schema, ["code", "totalAmount"], (path) => path !== "totalAmount");
    expect(columns.map((c) => c.path)).toEqual(["code"]);
  });

  it("a name that does not appear in the list column (obsolete stock view) does not allow the entire output to be exported", () => {
    const columns = exportColumnsOf(schema, ["code", "gone", "lines.qty"], ALL);
    expect(columns.map((c) => c.path)).toEqual(["code", "lines.qty"]);
  });
});

describe("importing columns of the template = those that the user can fill", () => {
  const columns = importColumnsOf(schema);
  const paths = columns.map((c) => c.path);

  it("🔴 All the lines of the system's supply -- let the user fill out a grid that doesn't count.", () => {
    // code is auto, totalAmount is lineAggg: both say it hit the key gate 400
    expect(paths).not.toContain("code");
    expect(paths).not.toContain("totalAmount");
  });

  it("🔴 subtable unplayed -- one line does not lay \"one single N line\" and does not pretend to guide", () => {
    expect(paths).not.toContain("lines");
    expect(paths.some((p) => p.includes("."))).toBe(false);
  });

  it("platform field is not released: status is determined by the status machine (imported in initial draft) and audited field by frame Write", () => {
    expect(paths).not.toContain("status");
    expect(paths).not.toContain("createdBy");
  });

  it("all the users can fill it out.", () => {
    expect(paths).toEqual(["customerId", "orderDate", "urgent", "discount", "remark"]);
    expect(columns.map((c) => c.label)).toEqual(["Customer", "Order date", "Urgent", "Discount", "Remark"]);
  });

  it("🔴 has nothing to do with the views.list - the list can only show 3 columns, while the absence of a field in a column will make every line fail", () => {
    const listed = new Set(schema.views.list.columns);
    expect(paths.some((p) => !listed.has(p))).toBe(true);
  });

  it("🔴 Template with an example of a row of columns aligned to the table header in a form that passes through parseCell", () => {
    const example = importExampleRow(columns);
    expect(example).toHaveLength(columns.length);
    expect(example[paths.indexOf("orderDate")]).toBe("2026-08-04");
    expect(example[paths.indexOf("urgent")]).toBe("yes");
    expect(example[paths.indexOf("customerId")]).toMatch(/Customer/);
    // example again parse cannot become undefined at once -- empty example equals no sign Example
    for (const [i, column] of columns.entries()) {
      const cell = example[i] ?? "";
      expect(cell.trim().length).toBeGreaterThan(0);
      expect(parseCell(column, cell)).not.toBeUndefined();
    }
  });
});

describe("exchange contract for choiceset", () => {
  const choiceSchema = schemaWithChoiceSet();

  it("export and import both to enable stable coding + current name of two columns without dynamic label impersonating business Value", () => {
    const exported = exportColumnsOf(choiceSchema, ["orderSource"], ALL);
    expect(exported.map(({ path, label, kind }) => ({ path, label, kind }))).toEqual([
      { path: "orderSource", label: "Order source code", kind: "choiceCode" },
      { path: "orderSource", label: "Order source name", kind: "choiceLabel" },
    ]);
    const imported = importColumnsOf(choiceSchema).filter((column) => column.path === "orderSource");
    expect(imported.map((column) => column.kind)).toEqual(["choiceCode", "choiceLabel"]);
    expect(matchImportHeader(imported, ["Order source name", "Order source code"]).map((column) => column.kind)).toEqual([
      "choiceLabel",
      "choiceCode",
    ]);
  });

  it("🔴 Templates are only sent by name column: code is the internal key, and the texter fills it. `cutting`（KDocs #190）", () => {
    const template = importTemplateColumnsOf(choiceSchema).filter((column) => column.path === "orderSource");
    expect(template.map(({ label, kind }) => ({ label, kind }))).toEqual([
      { label: "Order source name", kind: "choiceLabel" },
    ]);
  });

  it("🔴 Template does not send encoder bar, import still recognizes it - old template / export changed returned file cannot be rejected as a whole", () => {
    const accepted = matchImportHeader(importColumnsOf(choiceSchema), ["Order source code", "Order source name"]);
    expect(accepted.map((column) => column.kind)).toEqual(["choiceCode", "choiceLabel"]);
  });

  it("the name column has the usual candidates to pull down - remove the coding column and not let the user guess the name", () => {
    const [name] = importTemplateColumnsOf(choiceSchema).filter((column) => column.path === "orderSource");
    if (!name) throw new Error("The template should have a name column");
    expect(importCandidateSourceOf(name)).toEqual({ kind: "choiceSet", code: "sales.orderSource", want: "label" });
  });

  it("encoding column always output raw code, name column calling the tenant's current label", () => {
    const [code, label] = exportColumnsOf(choiceSchema, ["orderSource"], ALL);
    if (!code || !label) throw new Error("a choice set should expand to two columns");
    const display = () => "Livestream commerce";
    expect(cellOf(code, "LIVE", "Asia/Shanghai", display)).toBe("LIVE");
    expect(cellOf(label, "LIVE", "Asia/Shanghai", display)).toBe("Livestream commerce");
    expect(needsLabel(code)).toBe(false);
    expect(needsLabel(label)).toBe(true);
  });
});

describe("tablehead matches: Chinese label, throw if you can't recognize it.", () => {
  const columns = importColumnsOf(schema);

  it("line up in any order, press label.", () => {
    const matched = matchImportHeader(columns, ["Remark", "Customer", "Order date"]);
    expect(matched.map((c) => c.path)).toEqual(["remark", "customerId", "orderDate"]);
  });

  it("the blanks on both sides of the table do not count.", () => {
    expect(matchImportHeader(columns, ["  Customer  "]).map((c) => c.path)).toEqual(["customerId"]);
  });

  it("🔴 Unrecognized watch throws, and lists available listings -- a silent column will show \"all success\"", () => {
    expect(() => matchImportHeader(columns, ["Customer", "Customer grade"])).toThrow(/column 2/);
    expect(() => matchImportHeader(columns, ["Customer", "Customer grade"])).toThrow(/Available columns/);
  });

  it("the Chinese name of the system feed bar is also unknown -- it's not in the template at all.", () => {
    expect(() => matchImportHeader(columns, ["Document number"])).toThrow(/is not a field of this module/);
  });
});

describe("value ↔ Cell", () => {
  const col = (path: string): ExchangeColumn => {
    const hit = importColumnsOf(schema).find((c) => c.path === path);
    if (!hit) throw new Error(`no column ${path}`);
    return hit;
  };
  const platform: ExchangeColumn = { path: "status", label: "Status", kind: "value", field: null };

  it("🔴 The empty value is an empty space, not a \"null\" -- the string comes back and becomes content.", () => {
    for (const blank of [null, undefined, ""]) {
      expect(cellOf(platform, blank, "Asia/Shanghai")).toBe("");
    }
  });

  it("bool Yes/No; yes/no; yes/no", () => {
    expect(cellOf(col("urgent"), true, "Asia/Shanghai")).toBe("yes");
    expect(parseCell(col("urgent"), "yes")).toBe(true);
    expect(parseCell(col("urgent"), "TRUE")).toBe(true);
    expect(parseCell(col("urgent"), "0")).toBe(false);
  });

  it("object does not flatten [object object] -- that's a lie", () => {
    expect(cellOf(platform, [{ key: "k", name: "contract.pdf" }], "Asia/Shanghai")).toContain("contract.pdf");
  });

  it("create/modify time to export to seconds according to Beijing time without displaying UTC ISO and milliseconds", () => {
    const createdAt: ExchangeColumn = { path: "createdAt", label: "Created at", kind: "value", field: null };
    const updatedAt: ExchangeColumn = { path: "updatedAt", label: "Last modified", kind: "value", field: null };
    expect(cellOf(createdAt, "2026-09-22T03:00:00.456Z", "Asia/Shanghai")).toBe("2026-09-22 11:00:00");
    expect(cellOf(updatedAt, new Date("2026-09-22T04:05:06Z"), "Asia/Shanghai")).toBe("2026-09-22 12:05:06");
  });

  it("business datetime field also follows the same Beijing time format", () => {
    const raw = salesOrder();
    (raw["fields"] as Array<Record<string, unknown>>).push({
      key: "appointmentAt", label: "Appointment time", type: "datetime",
    });
    const datetimeSchema = normalizeFixtureModule(raw);
    const [appointmentAt] = exportColumnsOf(datetimeSchema, ["appointmentAt"], ALL);
    if (!appointmentAt) throw new Error("There should be an appointment-time export column");
    expect(cellOf(appointmentAt, "2026-09-22T03:00:00Z", "Asia/Shanghai")).toBe("2026-09-22 11:00:00");
  });

  it("space solved to undefined (no value given in this column), not empty string", () => {
    expect(parseCell(col("remark"), "   ")).toBeUndefined();
  });

  it("🔴 The unsolved number of originals is handed over and not thrown here -- the value gate gives a field-by-field conclusion with field coordinates", () => {
    expect(parseCell(col("discount"), "abc")).toBe("abc");
    expect(parseCell(col("discount"), "12.5")).toBe(12.5);
  });

  it("i can't recognize it, Bool.", () => {
    expect(parseCell(col("urgent"), "Maybe")).toBe("Maybe");
  });

  it("writing side coerceWriteBool Yes/ No, 1/0, True/false, unrecognized", () => {
    expect(coerceWriteBool("false")).toBe(false);
    expect(coerceWriteBool(1)).toBe(true);
    expect(coerceWriteBool(0)).toBe(false);
    expect(coerceWriteBool("Maybe")).toBe("Maybe");
    expect(coerceWriteValue(col("urgent").field!, "no")).toBe(false);
    expect(coerceWriteValue(col("remark").field!, "No")).toBe("No");
  });
});


describe("🔴 Export something that you can read.", () => {
  const col = (path: string): ExchangeColumn => {
    const hit = exportColumnsOf(schema, [path], ALL)[0];
    if (!hit) throw new Error(`no column ${path}`);
    return hit;
  };

  it("quoted columns and status to translate; normal enum unturned -- its value is itself Chinese", () => {
    expect(needsLabel(col("customerId"))).toBe(true);
    expect(needsLabel(col("status"))).toBe(true);
    // `normal / key / urgent` — a second map is a second cross-check for the same word.
    expect(needsLabel(col("discount"))).toBe(false);
    expect(needsLabel(col("code"))).toBe(false);
  });

  it("🔴 Write a name if you can flip it -- one line of uuid and one line of activity are not readable, let alone filled out.", () => {
    const display = (c: ExchangeColumn, v: unknown): string | undefined =>
      c.path === "customerId" && v === "c-1" ? "Sample Apparel Co." : undefined;
    expect(cellOf(col("customerId"), "c-1", "Asia/Shanghai", display)).toBe("Sample Apparel Co.");
  });

  it("🔴 Unable to turn out ** original value appears**, not blank -- the blank will be read as \"This Unfilled Cell\"", () => {
    expect(cellOf(col("customerId"), "c-9", "Asia/Shanghai", () => undefined)).toBe("c-9");
  });

  it("empty values remain empty: translation does not change \"no or no\"", () => {
    expect(cellOf(col("customerId"), null, "Asia/Shanghai", () => "Should not be called")).toBe("");
  });

  it("the behavior of not giving display is the same word by word -- this ability is added, not changed.", () => {
    expect(cellOf(col("code"), "XS-0001", "Asia/Shanghai")).toBe("XS-0001");
    expect(cellOf(col("customerId"), "c-1", "Asia/Shanghai")).toBe("c-1");
  });
});

describe("reportSubtatable Columnsof — line of detail sheet", () => {
  it("returns the item with the point path and excludes systemSupplied", () => {
    // salesOrder's line is subtable, sub-fields: programId (ref), qty (nomber), amount (money, lineAgg at the top of the table)
    // amount is not lineAgg, lineAgg hangs on the watch head totalAmount -- amount is normal money column
    const columns = importSubtableColumnsOf(schema, "lines");
    expect(columns.map((c) => c.path)).toEqual(["lines.productId", "lines.qty", "lines.amount"]);
    expect(columns.map((c) => c.label)).toEqual(["Product", "Quantity", "Amount"]);
  });

  it("🔴 SystemGenerated fields do not enter templates - this writing path covers fields that should not be filled out by users", () => {
    // add a systemGenerated field to lines (e. g. barcode)
    const withBarcode = structuredClone(salesOrder()) as { fields: Array<{ key: string; fields?: Array<{ key: string; label: string; type: string; systemGenerated?: boolean }> }> };
    const lines = withBarcode.fields.find((f) => f.key === "lines");
    if (!lines || !lines.fields) throw new Error("lines subtable not found");
    lines.fields.push({ key: "barcode", label: "Barcode", type: "string", systemGenerated: true });
    const schema2 = normalizeFixtureModule(withBarcode);
    const columns = importSubtableColumnsOf(schema2, "lines");
    expect(columns.map((c) => c.path)).not.toContain("lines.barcode");
  });

  it("revert empty arrays when module does not specify subtable", () => {
    const columns = importSubtableColumnsOf(schema, "nonexistent");
    expect(columns).toEqual([]);
  });

  it("the field that is passed to it does not return empty (no drop) when it is available - the caller's responsibility", () => {
    const columns = importSubtableColumnsOf(schema, "customerId");
    expect(columns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Import template columns — what values are allowed (bug 9)
//
// Production-worker import must expose team, pricing type, and worker type as real dropdowns.
// A one-line example hid valid enum values; users guessed and only learned from import errors.
//
// 🔴 This test pins where candidates come from, not the spreadsheet encoding.
// Each assertion below must still hold whether validation is xlsx or something else.
// ---------------------------------------------------------------------------

/** Same field shape as domains/manufacturing/modules/worker.ts */
function workerLike() {
  return normalizeFixtureModule({
    code: "worker",
    label: "Production worker",
    domain: "manufacturing",
    numbering: { prefix: "WKR", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Person code", type: "string", primary: true, auto: true },
      { key: "name", label: "Name", type: "string", required: true },
      {
        key: "productionOrgId",
        label: "Team",
        type: "ref",
        ref: "orgUnit",
        required: true,
        refFilter: { status: "active", orgType: "team" },
      },
      { key: "priceType", label: "Pricing type", type: "enum", options: ["Piece", "Hourly", "Mixed"], required: true },
      { key: "workerType", label: "Worker type", type: "enum", options: ["Regular worker", "Temporary worker"], required: true },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "remark", label: "Remark", type: "text" },
    ],
    lifecycle: { statuses: [{ key: "active", label: "On duty", initial: true }], transitions: [] },
    views: { list: { columns: ["code", "name", "productionOrgId"] } },
  });
}

describe("import template candidate source (bug9)", () => {
  const workerSchema = workerLike();
  const workerColumns = importColumnsOf(workerSchema);
  const columnAt = (path: string): ExchangeColumn => {
    const found = workerColumns.find((column) => column.path === path);
    if (!found) throw new Error(`the template should have a column "${path}"`);
    return found;
  };

  it("🔴 \"Types of Valuation\" gives all the candidates for the statement, not just the one in the example.", () => {
    expect(importCandidateSourceOf(columnAt("priceType"))).toEqual({
      kind: "enum",
      values: ["Piece", "Hourly", "Mixed"],
    });
  });

  it("🔴 \"Types of Workers\" is the same - users can see that \"temporary workers\" can be filled in.", () => {
    expect(importCandidateSourceOf(columnAt("workerType"))).toEqual({
      kind: "enum",
      values: ["Regular worker", "Temporary worker"],
    });
  });

  it("🔴 The \"belonger\" with the refFilter bid -- the candidate side is the same function as writing side", () => {
    const source = importCandidateSourceOf(columnAt("productionOrgId"));
    expect(source?.kind).toBe("ref");
    if (source?.kind !== "ref") throw new Error("Should be a ref");
    expect(source.entity).toBe("orgUnit");
    // the statement is {status: "active", orgType: "team"}: both will be on the query.
    // the missing one is that the factory/shop/production line is also being pulled by the `belonger' and they can't be stored.
    expect([...source.filter].sort((a, b) => a.field.localeCompare(b.field))).toEqual([
      { field: "orgType", values: ["team"] },
      { field: "status", values: ["active"] },
    ]);
  });

  it("the candidate for the bool column is yes/ no", () => {
    const urgent = importColumnsOf(schema).find((column) => column.path === "urgent");
    if (!urgent) throw new Error("The urgent column should be in the template");
    expect(importCandidateSourceOf(urgent)).toEqual({ kind: "bool", values: ["yes", "no"] });
  });

  it("free Text / Date / Number No Candidate", () => {
    expect(importCandidateSourceOf(columnAt("name"))).toBeNull();
    expect(importCandidateSourceOf(columnAt("phone"))).toBeNull();
    expect(importCandidateSourceOf(columnAt("remark"))).toBeNull();
    const orderDate = importColumnsOf(schema).find((column) => column.path === "orderDate");
    if (!orderDate) throw new Error("The order-date column should be in the template");
    expect(importCandidateSourceOf(orderDate)).toBeNull();
  });

  it("two columns of choiceSet point back to the same tenant dictionary, taking different sides.", () => {
    const columns = importColumnsOf(schemaWithChoiceSet()).filter((column) => column.path === "orderSource");
    expect(columns.map((column) => importCandidateSourceOf(column))).toEqual([
      { kind: "choiceSet", code: "sales.orderSource", want: "value" },
      { kind: "choiceSet", code: "sales.orderSource", want: "label" },
    ]);
  });

  it("🔴 No candidate is given when the pool depends on the value of this single cell - the template is empty and the full return is fail-open", () => {
    const dependent = normalizeFixtureModule({
      code: "pickOrder",
      label: "Material issue",
      domain: "manufacturing",
      numbering: { prefix: "LL", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        // the candidate list depends on what's filled out at the moment at the top of the table.
        { key: "bomId", label: "BOM", type: "ref", ref: "bom", refFilter: { productId: { from: "$bill.productId" } } },
      ],
      lifecycle: { statuses: [{ key: "draft", label: "draft", initial: true }], transitions: [] },
      views: { list: { columns: ["code", "productId"] } },
    });
    const bom = importColumnsOf(dependent).find((column) => column.path === "bomId");
    if (!bom) throw new Error("The BOM column should be in the template");
    expect(importCandidateSourceOf(bom)).toBeNull();
    // the one on the same list doesn't depend on anyone else.
    const product = importColumnsOf(dependent).find((column) => column.path === "productId");
    if (!product) throw new Error("The product column should be in the template");
    expect(importCandidateSourceOf(product)).toEqual({ kind: "ref", entity: "product", filter: [] });
  });

  it("platform field (no Field) does not present a candidate and does not check a non-existent type", () => {
    expect(importCandidateSourceOf({ path: "status", label: "Status", kind: "value", field: null })).toBeNull();
  });
});
