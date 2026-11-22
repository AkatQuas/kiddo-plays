import { describe, expect, it } from "vitest";

import {
  hasColumn,
  checkNewBill,
  chainedRefSitesOf,
  creatableFields,
  enumCandidateSourceOf,
  isSystemSupplied,
  normalizeFixtureModule,
  resolveUnitChoice,
  unitChoiceIdentitiesOf,
  sourceBindingsOf,
  supplyOf,
  unacceptableWriteKeys,
  unitSetIssuesOf,
  validateModule,
  validateUnitChoiceSources,
  type ModuleSchema,
} from "../src/index.js";

function moduleOf(code: string, fields: readonly unknown[], unitSet?: unknown): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    ...(unitSet === undefined ? {} : { unitSet }),
    fields,
    lifecycle: {
      statuses: [{ key: "active", label: "Enabled", color: "green", initial: true, terminal: true, editable: "full" }],
      transitions: [],
    },
    views: { list: { columns: ["code"] }, form: [] },
  });
}

const product = (): ModuleSchema =>
  moduleOf(
    "product",
    [
      { key: "code", type: "string", primary: true },
      { key: "mainUnit", type: "string", required: true },
      { key: "auxUnit", type: "string" },
      { key: "unitRate", type: "number" },
    ],
    { main: "mainUnit", auxiliary: "auxUnit", conversionRate: "unitRate" },
  );

const order = (): ModuleSchema =>
  moduleOf("order", [
    { key: "code", type: "string", primary: true },
    { key: "productId", type: "ref", ref: "product", required: true },
    { key: "unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "unitFactor" } },
    { key: "unitFactor", type: "number" },
    { key: "baseQty", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
    { key: "qty", type: "number" },
  ]);

describe("two-unit metadata model", () => {
  it("unitSet is the product unit truth, unitChoice only keeps match/factorInto and generates canonical binding", () => {
    const source = product();
    const target = order();
    expect(validateModule(source).ok).toBe(true);
    expect(validateModule(target).ok).toBe(true);
    expect(validateUnitChoiceSources([source, target])).toEqual([]);

    const binding = sourceBindingsOf([target, source]).find((candidate) => candidate.kind === "unit-choice");
    expect(binding).toMatchObject({
      kind: "unit-choice",
      source: { module: "product" },
      target: { module: "order", field: "unit" },
      via: { module: "order", field: "productId" },
      main: { module: "product", field: "mainUnit" },
      auxiliary: { module: "product", field: "auxUnit" },
      conversionRate: { module: "product", field: "unitRate" },
      factorInto: { module: "order", field: "unitFactor" },
    });
  });

  it("uitChoice's candidate is the product of unitSet.main's choice of officeSet", () => {
    const source = moduleOf(
      "product",
      [
        { key: "code", type: "string", primary: true },
        { key: "mainUnit", type: "enum", required: true, choiceSet: "inventory.unit" },
        { key: "auxUnit", type: "enum", choiceSet: "inventory.unit" },
        { key: "unitRate", type: "number" },
      ],
      { main: "mainUnit", auxiliary: "auxUnit", conversionRate: "unitRate" },
    );
    const target = order();
    const unit = target.fields.find((field) => field.key === "unit");
    if (!unit) throw new Error("Missing the unit field");
    expect(enumCandidateSourceOf(unit, target.fields, (code) => (code === "product" ? source : undefined))).toBe(
      "inventory.unit",
    );
  });

  it("actorInto is also a system supply, calculate has a column and is also a system supply at the top of the table.", () => {
    const schema = order();
    const unitFactor = schema.fields.find((field) => field.key === "unitFactor");
    const baseQty = schema.fields.find((field) => field.key === "baseQty");
    if (!unitFactor || !baseQty) throw new Error("Test field is missing");
    expect(isSystemSupplied(unitFactor, schema.fields)).toBe(true);
    expect(supplyOf(unitFactor, schema.fields)).toBe("unitFactor");
    expect(creatableFields(schema)).not.toContain("unitFactor");
    expect(unacceptableWriteKeys(schema.fields, { unitFactor: 2 }, "header")).toEqual(["unitFactor"]);
    expect(isSystemSupplied(baseQty, schema.fields)).toBe(true);
    expect(supplyOf(baseQty, schema.fields)).toBe("calculate");
    expect(hasColumn(baseQty)).toBe(true);
  });

  it("the units will be allowed to be empty when the commodity coordinates exist, pending the default of the main unit after the service has been decrypted", () => {
    const withProduct = checkNewBill(order(), { code: "O-1", productId: "P-1", qty: 2 }, {});
    expect(withProduct.ok).toBe(true);
    if (withProduct.ok) expect(withProduct.header["unit"]).toBeNull();

    const withoutProduct = checkNewBill(order(), { code: "O-2", qty: 2 }, {});
    expect(withoutProduct.ok).toBe(false);
    if (!withoutProduct.ok) {
      expect(withoutProduct.issues.map((issue) => [issue.path, issue.code])).toEqual(
        expect.arrayContaining([
          ["productId", "REQUIRED_BLANK"],
          ["unit", "REQUIRED_BLANK"],
        ]),
      );
    }

    const downstream = moduleOf("downstream", [
      { key: "code", type: "string", primary: true },
      { key: "taskId", type: "ref", ref: "task", required: true },
      {
        key: "productId",
        type: "ref",
        ref: "product",
        snapshot: { from: "task", match: "taskId", through: null, field: "productId" },
      },
      { key: "factor", type: "number" },
      { key: "unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "factor" } },
    ]);
    const resolvedProductLater = checkNewBill(downstream, { code: "D-1", taskId: "T-1" }, {});
    expect(resolvedProductLater.ok).toBe(true);

    const secondHop = chainedRefSitesOf(
      downstream,
      { code: "D-1", taskId: "T-1", productId: "P-1" },
      {},
      new Set(["taskId"]),
    );
    expect(secondHop).toEqual([
      expect.objectContaining({ entity: "product", id: "P-1", path: "productId", snapshots: [] }),
    ]);

    const lineDownstream = moduleOf("lineDownstream", [
      { key: "code", type: "string", primary: true },
      {
        key: "lines",
        type: "subtable",
        ref: "lineDownstreamLine",
        fields: [
          { key: "taskLineId", type: "refLine", ref: "task", through: "lines", required: true },
          { key: "taskId", type: "ref", ref: "task", required: true },
          {
            key: "productId",
            type: "ref",
            ref: "product",
            snapshot: { from: "task", match: "taskLineId", through: "lines", field: "productId" },
          },
          { key: "factor", type: "number" },
          { key: "unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "factor" } },
          { key: "qty", type: "number" },
          { key: "baseQty", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "factor" }] } },
        ],
      },
    ]);
    expect(chainedRefSitesOf(
      lineDownstream,
      { code: "D-2" },
      { lines: [{ taskLineId: "TL-1", taskId: "T-1", productId: "P-1", qty: 2 }] },
      new Set(["lines[0].taskLineId"]),
    )).toEqual([
      expect.objectContaining({ entity: "product", id: "P-1", path: "lines[0].productId", snapshots: [] }),
    ]);
  });

  it("the primary unit combination value is determined at a single time by the generic importance check and is parsed by 1 plus = N", () => {
    const schema = product();
    expect(unitSetIssuesOf(schema, { mainUnit: "pcs", auxUnit: "box" }).map((issue) => issue.code)).toEqual([
      "UNIT_SET_PAIR_MISMATCH",
    ]);
    expect(
      unitSetIssuesOf(schema, { mainUnit: "pcs", auxUnit: "pcs", unitRate: 0 }).map((issue) => issue.code),
    ).toEqual(["UNIT_SET_DUPLICATE", "UNIT_SET_RATE_INVALID"]);
    const checked = checkNewBill(schema, { code: "P-1", mainUnit: "pcs", auxUnit: "box" }, {});
    expect(checked.ok ? [] : checked.issues.map((issue) => issue.code)).toContain("UNIT_SET_PAIR_MISMATCH");
    expect(resolveUnitChoice(schema, { mainUnit: "pcs", auxUnit: "box", unitRate: 12 }, null)).toEqual({
      value: "pcs",
      factor: 1,
      source: "main",
    });
    expect(resolveUnitChoice(schema, { mainUnit: "pcs", auxUnit: "box", unitRate: 12 }, "box")).toEqual({
      value: "box",
      factor: 12,
      source: "user",
    });
    expect(resolveUnitChoice(schema, { mainUnit: "pcs", auxUnit: "box", unitRate: 12 }, null, "box")).toEqual({
      value: "box",
      factor: 12,
      source: "refDefault",
    });
    expect(resolveUnitChoice(schema, { mainUnit: "pcs", auxUnit: "box", unitRate: 12 }, "pcs", "box")).toEqual({
      value: "pcs",
      factor: 1,
      source: "user",
    });
  });

  it("choiceSet's code is in the same unit as label, still in the original commodity file.", () => {
    const schema = product();
    const identities = [
      { code: "meter", label: "m" },
      { code: "roll", label: "roll" },
    ];
    expect(
      resolveUnitChoice(schema, { mainUnit: "meter", auxUnit: "roll", unitRate: 50 }, "m", null, identities),
    ).toEqual({ value: "meter", factor: 1, source: "user" });
    expect(
      resolveUnitChoice(schema, { mainUnit: "meter", auxUnit: "roll", unitRate: 50 }, "roll", null, identities),
    ).toEqual({ value: "roll", factor: 50, source: "user" });
    expect(
      resolveUnitChoice(schema, { mainUnit: "m", auxUnit: "roll", unitRate: 50 }, "meter", null, identities),
    ).toEqual({ value: "m", factor: 1, source: "user" });
    expect(() =>
      resolveUnitChoice(schema, { mainUnit: "meter", auxUnit: "roll", unitRate: 50 }, "chi", null, identities),
    ).toThrow(/unit "chi"/);
  });

  it("it's the dictionary that collects goods only.", () => {
    const source = moduleOf(
      "product",
      [
        { key: "code", type: "string", primary: true },
        { key: "mainUnit", type: "enum", choiceSet: "inventory.unit", required: true },
        { key: "auxUnit", type: "enum", choiceSet: "inventory.unit" },
        { key: "unitRate", type: "number" },
      ],
      { main: "mainUnit", auxiliary: "auxUnit", conversionRate: "unitRate" },
    );
    expect(
      unitChoiceIdentitiesOf(source, [
        { code: "inventory.unit", items: [{ code: "meter", label: "m" }, { code: "roll", label: "roll" }] },
        { code: "inventory.productCategory", items: [{ code: "fabric", label: "Fabric" }] },
      ]),
    ).toEqual([
      { code: "meter", label: "m" },
      { code: "roll", label: "roll" },
    ]);
    expect(unitChoiceIdentitiesOf(product(), [{ code: "inventory.unit", items: [{ code: "meter", label: "m" }] }])).toEqual([]);
  });

  it("unitChoice allows coexistence with refDefault: inherit upstream units over commodity main units", () => {
    const schema = moduleOf("receipt", [
      { key: "code", type: "string", primary: true },
      { key: "productId", type: "ref", ref: "product", required: true },
      { key: "orderId", type: "ref", ref: "order" },
      { key: "factor", type: "number" },
      {
        key: "unit",
        type: "enum",
        required: true,
        refDefault: { from: "order", match: "orderId", through: null, field: "unit" },
        unitChoice: { match: "productId", factorInto: "factor" },
      },
    ]);
    const unit = schema.fields.find((field) => field.key === "unit");
    expect(unit?.refDefault).not.toBeNull();
    expect(unit?.unitChoice).not.toBeNull();
  });

  it("closed keys, cross-repeated and cross-module sources failed during the modelling period and no compatible aliases are accepted", () => {
    const optional = moduleOf("optional", [
      { key: "code", type: "string", primary: true },
      { key: "productId", type: "ref", ref: "product", required: true },
      { key: "factor", type: "number" },
      { key: "unit", type: "string", unitChoice: { match: "productId", factorInto: "factor" } },
    ]);
    expect(validateModule(optional).errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["UNIT_CHOICE_NOT_ENUM", "UNIT_CHOICE_REQUIRED"]),
    );
    expect(() =>
      moduleOf("bad", [
        { key: "code", type: "string", primary: true },
        { key: "productId", type: "ref", ref: "product", required: true },
        { key: "factor", type: "number" },
        { key: "unit", type: "string", unitChoice: { match: "productId", factorInto: "factor", mainField: "x" } },
      ]),
    ).toThrow(/unknown key "mainField"/);
    expect(() =>
      moduleOf("bad", [
        { key: "code", type: "string", primary: true },
        { key: "productId", type: "ref", ref: "product", required: true },
        { key: "factor", type: "number" },
        {
          key: "unit",
          type: "enum",
          options: ["pcs"],
          unitChoice: { match: "productId", factorInto: "factor" },
        },
      ]),
    ).toThrow(/unitChoice and options are mutually exclusive/);
    const noUnitSet = moduleOf("plainProduct", [{ key: "code", type: "string", primary: true }]);
    const target = moduleOf("target", [
      { key: "code", type: "string", primary: true },
      { key: "productId", type: "ref", ref: "plainProduct", required: true },
      { key: "factor", type: "number" },
      { key: "unit", type: "enum", required: true, unitChoice: { match: "productId", factorInto: "factor" } },
    ]);
    expect(validateUnitChoiceSources([noUnitSet, target]).map((error) => error.code)).toEqual([
      "UNIT_CHOICE_SOURCE_NO_UNIT_SET",
    ]);
  });
});
