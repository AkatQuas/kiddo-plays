import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@open-erp/loader";
import { describe, expect, it } from "vitest";
import {
  isPushFillable,
  isSystemSupplied,
  normalizeFixtureModule,
  pushLineValues,
  pushSourceField,
  pushSourceTable,
  sourceBindingsOf,
  withPlannerExpansion,
  type CreationBinding,
  type CreationMapping,
  type Field,
  type FieldSelectBinding,
  type FieldValueBinding,
  type ModuleSchema,
  type SourceBinding,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const DOMAINS = path.join(ROOT, "domains");

const status = (key: string, initial = false) => ({
  key,
  label: key,
  color: "gray",
  initial,
  terminal: false,
  editable: "full",
});

function moduleOf(
  code: string,
  fields: readonly unknown[],
  options: {
    readonly transitions?: readonly unknown[];
    readonly createFrom?: readonly unknown[];
  } = {},
): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    fields,
    lifecycle: {
      statuses: [status("draft", true), status("done")],
      transitions: options.transitions ?? [],
    },
    views: {
      list: { columns: [(fields[0] as { key: string }).key] },
      form: [],
      createFrom: options.createFrom ?? [],
    },
  });
}

function simple(code: string, extra: readonly unknown[] = []): ModuleSchema {
  return moduleOf(code, [{ key: "name", type: "string" }, ...extra]);
}

function byKind<T extends SourceBinding["kind"]>(
  bindings: readonly SourceBinding[],
  kind: T,
): readonly Extract<SourceBinding, { readonly kind: T }>[] {
  return bindings.filter((binding): binding is Extract<SourceBinding, { readonly kind: T }> => binding.kind === kind);
}

function targetTable(module: ModuleSchema, key: string): Field {
  const found = module.fields.find((field) => field.key === key && field.type === "subtable");
  if (!found) throw new Error(`test module ${module.code} is missing line table ${key}`);
  return found;
}

function mappingAt(binding: CreationBinding | undefined, path: string): CreationMapping | undefined {
  return binding?.mappings.find((mapping) => mapping.target.path === path);
}

describe("canonical SourceBinding IR", () => {
  it("visible push.line allows the only pair with an alias and no refLine to share the same source coordinates", () => {
    const source = moduleOf("source", [
      { key: "name", type: "string" },
      { key: "ignored", type: "subtable", ref: "ignoredLine", fields: [{ key: "qty", type: "number" }] },
      { key: "requestLines", type: "subtable", ref: "requestLine", fields: [{ key: "qty", type: "number" }] },
    ], {
      transitions: [{
        code: "generate",
        from: "draft",
        to: "done",
        action: "Generate",
        push: { module: "target", line: { source: "requestLines", target: "operationLines" } },
      }],
    });
    const target = moduleOf("target", [
      { key: "name", type: "string" },
      { key: "operationLines", type: "subtable", ref: "operationLine", fields: [{ key: "qty", type: "number" }] },
      { key: "ignored", type: "subtable", ref: "targetIgnoredLine", fields: [{ key: "qty", type: "number" }] },
    ]);

    const binding = byKind(sourceBindingsOf([source, target]), "creation")[0];
    expect(mappingAt(binding, "operationLines.qty")?.source).toMatchObject({
      kind: "field",
      coordinate: { module: "source", table: "requestLines", field: "qty", path: "requestLines.qty" },
    });
    expect(mappingAt(binding, "ignored.qty")).toBeUndefined();
  });

  it("expressing a cross-record source without impersonating auto/formula/rollup/lineAgg as a FieldSupply full collection", () => {
    const source = simple("source", [{ key: "value", type: "number" }]);
    const target = moduleOf("target", [
      { key: "code", type: "string", primary: true, auto: true },
      { key: "sourceId", type: "ref", ref: "source" },
      { key: "live", type: "number", derive: { kind: "lookup", from: "source", match: "sourceId", field: "value" } },
      { key: "formula", type: "number", derive: { kind: "formula", expr: { value: 1 } } },
      {
        key: "lines",
        type: "subtable",
        ref: "targetLine",
        fields: [{ key: "qty", type: "number" }],
      },
      { key: "total", type: "number", lineAgg: { of: "lines", measure: "sum(qty)" } },
    ]);

    const bindings = sourceBindingsOf([target, source]);
    expect(bindings.every((binding) => binding.scope === "cross-record")).toBe(true);
    expect(byKind(bindings, "field-value").map((binding) => binding.target.field)).toEqual(["live"]);
    expect(JSON.stringify(bindings)).not.toMatch(/formula|lineAgg|auto/);
  });

  it("project/line live field-select, keep field and regularize condition values as canonical set", () => {
    const product = moduleOf("product", [
      { key: "name", type: "string" },
      { key: "productType", type: "enum", options: ["Finished goods", "Raw material"] },
      { key: "isDefault", type: "bool" },
    ]);
    const order = moduleOf("order", [
      { key: "code", type: "string" },
      { key: "lines", type: "subtable", ref: "orderLine", fields: [{ key: "qty", type: "number" }] },
    ]);
    const target = moduleOf("target", [
      { key: "kind", type: "enum", options: ["make", "buy"] },
      {
        key: "productId",
        type: "ref",
        ref: "product",
        refFilter: {
          status: ["draft", "draft"],
          productType: { from: "$bill.kind", map: { buy: ["Raw material", "Raw material"], make: "Finished goods" } },
        },
        refPreselect: { isDefault: [true, true] },
      },
      {
        key: "lines",
        type: "subtable",
        ref: "targetLine",
        fields: [
          { key: "kind", type: "enum", options: ["make", "buy"] },
          { key: "productId", type: "ref", ref: "product", refFilter: { productType: { from: "$line.kind" } } },
          { key: "sourceOrderId", type: "ref", ref: "order" },
          { key: "sourceOrderLineId", type: "refLine", ref: "order", through: "lines" },
        ],
      },
    ]);

    const selects = byKind(sourceBindingsOf([target, order, product]), "field-select");
    const header = selects.find((binding) => binding.target.field === "productId" && binding.target.table === null);
    const line = selects.find((binding) => binding.target.field === "sourceOrderLineId");
    const companion = selects.find((binding) => binding.target.field === "sourceOrderId");

    expect(header).toMatchObject<FieldSelectBinding>({
      id: expect.any(String),
      kind: "field-select",
      scope: "cross-record",
      mode: "live",
      mechanism: "ref",
      source: { module: "product", level: "record", table: null },
      target: { module: "target", level: "record", table: null, field: "productId", path: "productId" },
      selectable: true,
      filter: [
        {
          field: "productType",
          operand: {
            kind: "dynamic",
            from: "$bill.kind",
            map: [
              { source: "buy", values: ["Raw material"] },
              { source: "make", values: ["Finished goods"] },
            ],
          },
        },
        { field: "status", operand: { kind: "literal", values: ["draft"] } },
      ],
      preselect: [{ field: "isDefault", operand: { kind: "literal", values: [true] } }],
      explain: expect.any(String),
    });
    expect(line).toMatchObject({
      mechanism: "refLine",
      source: { module: "order", level: "line", table: "lines" },
      target: {
        module: "target",
        level: "line",
        table: "lines",
        field: "sourceOrderLineId",
        path: "lines.sourceOrderLineId",
      },
      selectable: true,
    });
    expect(companion?.selectable).toBe(false);
  });

  it("unified projection, lookup/live, snapshot, refDefault and keep record/line coordinates", () => {
    const product = moduleOf("product", [
      { key: "name", type: "string" },
      { key: "unit", type: "string" },
    ]);
    const order = moduleOf("order", [
      { key: "code", type: "string" },
      { key: "lines", type: "subtable", ref: "orderLine", fields: [{ key: "qty", type: "number" }] },
    ]);
    const target = moduleOf("target", [
      { key: "productId", type: "ref", ref: "product" },
      { key: "productName", type: "string", derive: { kind: "lookup", from: "product", match: "productId", field: "name" } },
      { key: "frozenUnit", type: "string", snapshot: { from: "product", match: "productId", through: null, field: "unit" } },
      { key: "suggestedUnit", type: "string", refDefault: { from: "product", match: "productId", through: null, field: "unit" } },
      {
        key: "lines",
        type: "subtable",
        ref: "targetLine",
        fields: [
          { key: "sourceOrderId", type: "ref", ref: "order" },
          { key: "sourceOrderLineId", type: "refLine", ref: "order", through: "lines" },
          { key: "liveQty", type: "number", derive: { kind: "lookup", from: "order", match: "sourceOrderLineId", through: "lines", field: "qty" } },
          { key: "frozenQty", type: "number", snapshot: { from: "order", match: "sourceOrderLineId", through: "lines", field: "qty" } },
          { key: "defaultQty", type: "number", refDefault: { from: "order", match: "sourceOrderLineId", through: "lines", field: "qty" } },
        ],
      },
    ]);

    const values = byKind(sourceBindingsOf([target, order, product]), "field-value");
    const value = (path: string): FieldValueBinding | undefined => values.find((binding) => binding.target.path === path);

    expect(value("productName")).toMatchObject({
      mode: "live",
      mechanism: "lookup",
      source: { kind: "field", coordinate: { module: "product", level: "record", field: "name", path: "name" } },
      via: { module: "target", level: "record", field: "productId", path: "productId" },
    });
    expect(value("frozenUnit")).toMatchObject({ mode: "snapshot", mechanism: "snapshot" });
    expect(value("suggestedUnit")).toMatchObject({ mode: "default", mechanism: "refDefault" });
    expect(value("lines.liveQty")).toMatchObject({
      mode: "live",
      source: { kind: "field", coordinate: { module: "order", level: "line", table: "lines", field: "qty", path: "lines.qty" } },
      via: { module: "target", level: "line", table: "lines", field: "sourceOrderLineId" },
    });
    expect(value("lines.frozenQty")?.mode).toBe("snapshot");
    expect(value("lines.defaultQty")?.mode).toBe("default");
  });

  it("create-fram reuse scenario", () => {
    const warehouse = simple("warehouse");
    const product = simple("product");
    const order = moduleOf(
      "order",
      [
        { key: "code", type: "string" },
        { key: "warehouseId", type: "ref", ref: "warehouse" },
        { key: "remainingQty", type: "number" },
        {
          key: "orderLines",
          type: "subtable",
          ref: "orderLine",
          fields: [
            { key: "productId", type: "ref", ref: "product" },
            { key: "qty", type: "number" },
            { key: "remainingQty", type: "number" },
            { key: "netPrice", type: "money" },
          ],
        },
      ],
      { transitions: [{ code: "ship", from: "draft", to: "done", action: "Ship", push: "delivery" }] },
    );
    const delivery = moduleOf(
      "delivery",
      [
        { key: "code", type: "string" },
        { key: "sourceOrderId", type: "ref", ref: "order" },
        { key: "warehouseId", type: "ref", ref: "warehouse" },
        {
          key: "lines",
          type: "subtable",
          ref: "deliveryLine",
          fields: [
            { key: "sourceOrderId", type: "ref", ref: "order" },
            { key: "sourceOrderLineId", type: "refLine", ref: "order", through: "orderLines" },
            { key: "productId", type: "ref", ref: "product" },
            { key: "qty", type: "number" },
            { key: "price", type: "money", pushFrom: "netPrice" },
          ],
        },
      ],
      {
        createFrom: [{
          path: "lines.sourceOrderLineId",
          label: "Create a shipment from order lines",
          sourceStatuses: ["draft"],
          sourceRemaining: { header: "remainingQty", line: "orderLines.remainingQty" },
        }],
      },
    );

    const bindings = sourceBindingsOf([product, delivery, warehouse, order]);
    const creates = byKind(bindings, "creation");
    const pushed = creates.find((binding) => binding.mechanism === "push");
    const createFrom = creates.find((binding) => binding.mechanism === "create-from");
    expect(createFrom).toMatchObject({
      label: "Create a shipment from order lines",
      source: { module: "order", level: "line", table: "orderLines" },
      target: { module: "delivery", path: "lines.sourceOrderLineId" },
      sourceRemaining: {
        header: { module: "order", field: "remainingQty", path: "remainingQty" },
        line: { module: "order", table: "orderLines", field: "remainingQty", path: "orderLines.remainingQty" },
      },
    });
    expect(pushed).toMatchObject({
      mechanism: "push",
      label: "Ship",
      transition: { module: "order", code: "ship" },
    });

    const sourceRow = {
      id: "order-line-1",
      productId: "product-1",
      qty: 3,
      remainingQty: 2,
      netPrice: 9.5,
    };
    const runtime = pushLineValues(order, targetTable(delivery, "lines"), "order-1", sourceRow, isSystemSupplied);
    const runtimeTargets = Object.keys(runtime).sort();
    const createFromTargets = (createFrom?.mappings ?? []).map((mapping) => mapping.target.field).sort();
    const pushLineTargets = (pushed?.mappings ?? [])
      .filter((mapping) => mapping.target.table === "lines")
      .map((mapping) => mapping.target.field)
      .sort();
    expect(createFromTargets).toEqual(runtimeTargets);
    expect(pushLineTargets).toEqual(runtimeTargets);
    expect(mappingAt(createFrom, "lines.sourceOrderLineId")).toMatchObject({
      mechanism: "source-line",
      source: { kind: "identity", entity: { module: "order", table: "orderLines" } },
    });
    expect(mappingAt(createFrom, "lines.price")).toMatchObject({
      mechanism: "pushFrom",
      source: { kind: "field", coordinate: { module: "order", table: "orderLines", field: "netPrice" } },
    });
    expect(mappingAt(createFrom, "lines.sourceOrderId")).toBeUndefined();

    const lineOnlyDelivery = moduleOf(
      "lineOnlyDelivery",
      delivery.fields,
      {
        createFrom: [{
          path: "lines.sourceOrderLineId",
          sourceRemaining: { line: "orderLines.remainingQty" },
        }],
      },
    );
    const lineOnly = byKind(
      sourceBindingsOf([product, delivery, lineOnlyDelivery, warehouse, order]),
      "creation",
    ).find((binding) => binding.mechanism === "create-from" && binding.target.module === "lineOnlyDelivery");
    expect(lineOnly?.sourceRemaining).toMatchObject({
      header: null,
      line: { module: "order", table: "orderLines", field: "remainingQty" },
    });
  });

  it("pushFrom refLine corresponds to the original language of running relations", () => {
    const source = moduleOf("source", [
      { key: "code", type: "string" },
      {
        key: "rows",
        type: "subtable",
        ref: "sourceRow",
        fields: [
          { key: "copiedLineId", type: "refLine", ref: "source", through: "rows" },
          { key: "qty", type: "number", derive: { kind: "formula", expr: { value: 7 } } },
        ],
      },
    ], { transitions: [{ code: "go", from: "draft", to: "done", action: "Generate", push: "target" }] });
    const target = moduleOf("target", [
      { key: "code", type: "string" },
      {
        key: "lines",
        type: "subtable",
        ref: "targetRow",
        fields: [
          { key: "sourceLineId", type: "refLine", ref: "source", through: "rows" },
          { key: "copiedAgain", type: "refLine", ref: "source", through: "rows", pushFrom: "copiedLineId" },
          { key: "explicitDerivedQty", type: "number", pushFrom: "qty" },
        ],
      },
    ]);

    const table = targetTable(target, "lines");
    const sourceTable = pushSourceTable(source, table);
    const explicit = table.fields?.find((field) => field.key === "copiedAgain");
    const derived = table.fields?.find((field) => field.key === "explicitDerivedQty");
    if (!explicit || !derived) throw new Error("test target column is missing");
    expect(sourceTable?.key).toBe("rows");
    expect(isPushFillable(source, explicit, table, isSystemSupplied)).toBe(true);
    expect(pushSourceField(source, explicit, table)?.key).toBe("copiedLineId");
    expect(isPushFillable(source, derived, table, isSystemSupplied)).toBe(true);
    expect(pushSourceField(source, derived, table)?.key).toBe("qty");

    const runtime = pushLineValues(
      source,
      table,
      "source-1",
      { id: "row-1", copiedLineId: "row-old", qty: 7 },
      isSystemSupplied,
    );
    const push = byKind(sourceBindingsOf([target, source]), "creation").find((binding) => binding.mechanism === "push");
    expect(runtime).toEqual({ sourceLineId: "row-1", copiedAgain: "row-old", explicitDerivedQty: 7 });
    expect(mappingAt(push, "lines.copiedAgain")).toMatchObject({
      mechanism: "pushFrom",
      source: { kind: "field", coordinate: { module: "source", table: "rows", field: "copiedLineId" } },
    });
    expect(mappingAt(push, "lines.explicitDerivedQty")).toMatchObject({
      mechanism: "pushFrom",
      source: { kind: "field", coordinate: { module: "source", table: "rows", field: "qty" } },
    });
    expect((push?.mappings ?? []).filter((mapping) => mapping.target.table === "lines").map((mapping) => mapping.target.field).sort())
      .toEqual(Object.keys(runtime).sort());
  });

  it("planner is an unknown activity, creation operation", () => {
    const base = moduleOf(
      "release",
      [{ key: "code", type: "string" }],
      { transitions: [{ code: "release", from: "draft", to: "done", action: "Release" }] },
    );
    const expanded = withPlannerExpansion(base, new Set(["release"]));
    const bindings = sourceBindingsOf([expanded]);
    expect(byKind(bindings, "creation")).toEqual([]);
    expect(byKind(bindings, "planner-execution")).toEqual([
      expect.objectContaining({
        kind: "planner-execution",
        source: { module: "release", level: "record", table: null },
        transition: { module: "release", code: "release" },
        targets: { kind: "dynamic" },
      }),
    ]);
  });

  it("JSON tuple id reserves the line boundary of the valid lowerCamel coordinates, with output sorted by code-unit", () => {
    const ref = simple("ref");
    const modules = [
      // If the tuple is dropped, the first two groups will become the same. `abc`。
      moduleOf("ab", [{ key: "c", type: "ref", ref: "ref" }]),
      moduleOf("a", [{ key: "bc", type: "ref", ref: "ref" }]),
      // case after the first character is part of the valid coordinates and must also be sorted by code unit stable.
      moduleOf("aB", [{ key: "cD", type: "ref", ref: "ref" }]),
      moduleOf("aC", [{ key: "bD", type: "ref", ref: "ref" }]),
      ref,
    ];
    const first = sourceBindingsOf(modules);
    const second = sourceBindingsOf([...modules].reverse());
    expect(first).toEqual(second);
    expect(new Set(first.map((binding) => binding.id)).size).toBe(first.length);
    expect(first.map((binding) => binding.id)).toEqual([...first.map((binding) => binding.id)].sort());
    const selects = byKind(first, "field-select");
    expect(selects.map((binding) => binding.target.field).sort()).toEqual(["bD", "bc", "c", "cD"]);
  });

  it("unknown module, unknown cross-record path and visible", () => {
    const unknownModule = moduleOf("bad", [
      { key: "code", type: "string" },
      { key: "ghostId", type: "ref", ref: "ghost" },
    ]);
    expect(() => sourceBindingsOf([unknownModule])).toThrow(/unknown source module "ghost"/);

    const source = simple("source", [{ key: "value", type: "number" }]);
    const badSnapshot = moduleOf("badSnapshot", [
      { key: "sourceId", type: "ref", ref: "source" },
      { key: "copy", type: "number", snapshot: { from: "source", match: "sourceId", through: null, field: "missing" } },
    ]);
    expect(() => sourceBindingsOf([source, badSnapshot])).toThrow(/unknown or non-unique source path "source.missing"/);

    const pushSource = moduleOf(
      "pushSource",
      [{ key: "code", type: "string" }],
      { transitions: [{ code: "go", from: "draft", to: "done", action: "Generate", push: "pushTarget" }] },
    );
    const pushTarget = moduleOf("pushTarget", [
      { key: "code", type: "string" },
      { key: "qty", type: "number", pushFrom: "missingQty" },
    ]);
    // sourceBindings no longer write a second push judgement; relations are found to be unfillable, and IR does not actually create mapping.
    const pushed = byKind(sourceBindingsOf([pushTarget, pushSource]), "creation")[0];
    expect(mappingAt(pushed, "qty")).toBeUndefined();
  });

  it("do not define malformations in detail as silent downgrades to empty sources.", () => {
    const valid = moduleOf("target", [
      { key: "code", type: "string" },
      { key: "lines", type: "subtable", ref: "targetLine", fields: [{ key: "qty", type: "number" }] },
    ]);
    const malformed = {
      ...valid,
      fields: valid.fields.map((field) => field.key === "lines" ? { ...field, fields: null } : field),
    } satisfies ModuleSchema;

    expect(() => sourceBindingsOf([malformed])).toThrow(/target\.lines did not resolve to a fully declared line table/);
  });

  it("many refLines do not write another judgment and follow the pushsourcetable/pushLineValues", () => {
    const source = moduleOf(
      "source",
      [
        { key: "code", type: "string" },
        { key: "first", type: "subtable", ref: "firstLine", fields: [{ key: "qty", type: "number" }] },
        { key: "second", type: "subtable", ref: "secondLine", fields: [{ key: "qty", type: "number" }] },
      ],
      { transitions: [{ code: "go", from: "draft", to: "done", action: "Generate", push: "target" }] },
    );
    const target = moduleOf("target", [
      { key: "code", type: "string" },
      {
        key: "lines",
        type: "subtable",
        ref: "targetLine",
        fields: [
          { key: "firstSourceLineId", type: "refLine", ref: "source", through: "first" },
          { key: "secondSourceLineId", type: "refLine", ref: "source", through: "second" },
          { key: "qty", type: "number" },
        ],
      },
    ]);
    const table = targetTable(target, "lines");
    expect(pushSourceTable(source, table)?.key).toBe("first");
    const runtime = pushLineValues(source, table, "source-1", { id: "first-1", qty: 4 }, isSystemSupplied);
    const push = byKind(sourceBindingsOf([source, target]), "creation")[0];
    expect((push?.mappings ?? []).filter((mapping) => mapping.target.table === "lines").map((mapping) => mapping.target.field).sort())
      .toEqual(Object.keys(runtime).sort());
  });

  it("real catalog can be fully extrapolated, sequenced and Planner does not mix into creation", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const modules = [...catalog.modules.values()].map((module) => module.schema);
    const first = sourceBindingsOf(modules);
    const second = sourceBindingsOf([...modules].reverse());
    expect(first).toEqual(second);
    expect(byKind(first, "creation").every((binding) => binding.target.module.length > 0)).toBe(true);
  });

  it("sourceBinding of the real stockout module can be extrapolated and the unit conversion field provided by the declaration", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const stockOut = catalog.modules.get("stockOut")?.schema;
    expect(stockOut).toBeDefined();
    if (!stockOut) throw new Error("the real catalog is missing the stockOut module");

    const stockOutLines = stockOut.fields.find((field) => field.key === "lines" && field.type === "subtable");
    const baseUnitPrice = stockOutLines?.fields?.find((field) => field.key === "baseUnitPrice");
    expect(baseUnitPrice).toMatchObject({
      key: "baseUnitPrice",
      type: "money",
      hidden: true,
    });
    expect(stockOutLines?.fields?.find((field) => field.key === "baseQty")).toMatchObject({
      key: "baseQty",
      type: "number",
      hidden: true,
      calculate: { op: "mul", args: [{ field: "quantity" }, { field: "unitFactor" }] },
    });

    const modules = new Map(catalog.modules);
    const required = new Set(["stockOut"]);
    for (const code of required) {
      const module = modules.get(code)?.schema;
      expect(module).toBeDefined();
      if (!module) throw new Error(`the real catalog is missing module ${code}`);
      for (const field of module.fields) {
        if ((field.type === "ref" || field.type === "refLine") && field.ref) required.add(field.ref);
        if (field.type === "subtable") {
          for (const lineField of field.fields ?? []) {
            if ((lineField.type === "ref" || lineField.type === "refLine") && lineField.ref) required.add(lineField.ref);
          }
        }
      }
    }
    const stockOutClosure = [...required].map((code) => modules.get(code)?.schema);
    expect(stockOutClosure.every(Boolean)).toBe(true);
    const stockOutModules = stockOutClosure.filter((module): module is NonNullable<typeof module> => Boolean(module));

    const bindings = sourceBindingsOf(stockOutModules);
    expect(bindings).toEqual(sourceBindingsOf(stockOutModules));
    expect(JSON.stringify(bindings)).not.toContain("baseQty");
    expect(JSON.stringify({ field: baseUnitPrice?.key, bindings })).toContain("baseUnitPrice");
  });
});
