// ---------------------------------------------------------------------------
// Candidate Default Selection`refPreselect`– "BOM automatically falls into the default version of the product after selection and can still switch."
//
// The only danger to this ability is not "not self-filled," but ** filled in an unfilled **: It's a relay. `refDefault`
// the second then goes to write the user's path, and it's not wrong — it's a perfectly legal quote.
// so the nails are all "in violation of what looks perfectly normal":
//
//   I. Only one of the candidate lists - the default must be `refFilter` Picking out the pack. Here's another one:
//      "There's no record of Lower Larry that's been filled in," and the user can't find it.
//   none of the articles — 0 / > 1 — is filled out exactly in one article. First is to be sorted first, and the "default version" is therefore
//      it'll change the answer with the data. Both answers are legal.
//   iii. Coverable - The value given by the user is kept as it is. It turns into snapshot.
//      this post is part of our special coverage Syria Protests 2011.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  SchemaError,
  checkNewBill,
  normalizeField,
  normalizeFixtureModule,
  refPreselectSitesOf,
  resolveRefPreselect,
  validateModule,
  type ModuleSchema,
} from "../src/index.js";

const bomRef = (extra: Record<string, unknown> = {}): unknown => ({
  key: "bomId",
  label: "BOM",
  type: "ref",
  ref: "bom",
  refFilter: { productId: { from: "$bill.productId" }, status: "active" },
  ...extra,
});

describe("declaring shapes: violation of patterns that do not miss, rejection of article by article during modelling period", () => {
  it("static markers and arrays are collected (values are the same as refFilter word for word - It's a filter added to the list.", () => {
    const field = normalizeField(bomRef({ refPreselect: { isDefault: true, grade: ["A", "B"] } }));
    expect(field.refPreselect).toEqual({ isDefault: true, grade: ["A", "B"] });
  });

  it("🔴 Dynamic Operator Number Rejected: The condition to follow the current value is the pool of candidates (refFilter), written here is the second candidate. Set", () => {
    expect(() =>
      normalizeField(bomRef({ refPreselect: { productId: { from: "$bill.productId" } } })),
    ).toThrow(/opens a second candidate set/);
  });

  it("🔴 Only meaningful for ref: there are no candidate lists for other types, and there is no way to pick the \"default\"", () => {
    expect(() =>
      normalizeField({ key: "note", label: "Remark", type: "string", refPreselect: { isDefault: true } }),
    ).toThrow(SchemaError);
  });

  it("🔴 Empty Object / Empty Numeric Photo RefFilter rejected - None of the conditions equals the \"single one\" of the entire list", () => {
    expect(() => normalizeField(bomRef({ refPreselect: {} }))).toThrow(/is an empty object/);
    expect(() => normalizeField(bomRef({ refPreselect: { grade: [] } }))).toThrow(/is an empty array/);
  });

  it("🔴 Extrusion with snapshot: one is a non-written system supply and one is a user value that can be covered", () => {
    expect(() =>
      normalizeField(
        bomRef({
          refPreselect: { isDefault: true },
          snapshot: { from: "product", match: "productId", through: null, field: "defaultBomId" },
        }),
      ),
    ).toThrow(/system-supplied/);
  });

  it("🔴 With refDefault: both are filled only when this slot is empty, and both sources are declared to be empty. White", () => {
    expect(() =>
      normalizeField(
        bomRef({
          refPreselect: { isDefault: true },
          refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "bomId" },
        }),
      ),
    ).toThrow(/mutually exclusive/);
  });
});

describe("refPresectSole: the only candidate is automatically filled with another caliber of the peer of refPresect", () => {
  it("ref only meaningful: no candidate for any other type Set", () => {
    expect(() =>
      normalizeField({ key: "note", label: "Remark", type: "string", refPreselectSole: true }),
    ).toThrow(SchemaError);
  });

  it("🔴 With refPreselect: only one pre-selected calibre in the same cell", () => {
    expect(() => normalizeField(bomRef({ refPreselect: { isDefault: true }, refPreselectSole: true }))).toThrow(
      /mutually exclusive/,
    );
  });

  it("🔴 RefDefault: Both are filled only when this slot is empty", () => {
    expect(() =>
      normalizeField(
        bomRef({
          refPreselectSole: true,
          refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "bomId" },
        }),
      ),
    ).toThrow(/mutually exclusive/);
  });

  it("normal form: leave the boolean.", () => {
    const field = normalizeField(bomRef({ refPreselectSole: true }));
    expect(field.refPreselectSole).toBe(true);
    expect(field.refPreselect).toBeNull();
  });

  it("if you don't write it, it's false.", () => {
    expect(normalizeField(bomRef()).refPreselectSole).toBe(false);
  });
});

// 

const moduleWith = (field: Record<string, unknown>): ModuleSchema =>
  normalizeFixtureModule({
    code: "preselectProbe",
    label: "Preselect probe",
    domain: "production",
    numbering: { prefix: "PP", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      field,
    ],
    lifecycle: {
      // Single-state master data form (same) `singleState()`): Initial + triminal, so that the probe does not bring itself out of the unrelated gate
      statuses: [{ key: "Take effect", label: "Take effect", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
  });

const codesOf = (field: Record<string, unknown>): readonly string[] =>
  validateModule(moduleWith(field)).errors.map((e) => e.code);

describe("declaring level semantics: Candidates must be the refFilter one.", () => {
  it("🔴 Without refFilter, no: otherwise the only one is for the whole number of tenants, the early data is just as close to someone else's BOM.", () => {
    expect(codesOf({ key: "bomId", label: "BOM", type: "ref", ref: "bom", refPreselect: { isDefault: true } }))
      .toContain("REF_PRESELECT_WITHOUT_FILTER");
  });

  it("on both sides of the same column, the condition is rejected: and get up either redundant or permanent, and the space is \"the default never worked.\"", () => {
    expect(
      codesOf({
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        refFilter: { status: "active" },
        refPreselect: { status: "draft" },
      }),
    ).toContain("REF_PRESELECT_KEY_SHADOWS_FILTER");
  });

  it("nothing is reported in normal form.", () => {
    expect(
      codesOf({
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        refFilter: { productId: { from: "$bill.productId" }, status: "active" },
        refPreselect: { isDefault: true },
      }),
    ).toEqual([]);
  });

  it("🔴 No refFilter either: otherwise the only one is the number of tenants.", () => {
    expect(codesOf({ key: "bomId", label: "BOM", type: "ref", ref: "bom", refPreselectSole: true })).toContain(
      "REF_PRESELECT_SOLE_WITHOUT_FILTER",
    );
  });

  it("🔴 RefPrefectSole + refFilter does not report a single error in normal form", () => {
    expect(
      codesOf({
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        refFilter: { productId: { from: "$bill.productId" }, status: "active" },
        refPreselectSole: true,
      }),
    ).toEqual([]);
  });
});

// request: for a set of candidates, default terms —

describe("resolve RefPreselect: Default condition added to the pool, not another query", () => {
  const filter = { productId: { from: "$bill.productId" }, status: "active" } as const;

  it("and there's a lot of them on the terms.", () => {
    const resolved = resolveRefPreselect(filter, { isDefault: true }, false, { productId: "p-1" }, null);
    expect(resolved?.conditions).toEqual([
      { field: "productId", values: ["p-1"] },
      { field: "status", values: ["active"] },
      { field: "isDefault", values: [true] },
    ]);
    expect(resolved?.pending).toEqual([]);
  });

  it("return without a statement -- and \"no one can be single\" is two things: the former does not have that ability, the latter is its conclusion.", () => {
    expect(resolveRefPreselect(filter, null, false, { productId: "p-1" }, null)).toBeNull();
  });

  it("🔴 The upper one is unfilled.", () => {
    const resolved = resolveRefPreselect(filter, { isDefault: true }, false, {}, null);
    expect(resolved?.pending).toEqual(["$bill.productId"]);
  });

  it("🔴 RefPrefectSole: Conditional set is the candidate, without the default", () => {
    const resolved = resolveRefPreselect(filter, null, true, { productId: "p-1" }, null);
    expect(resolved?.conditions).toEqual([
      { field: "productId", values: ["p-1"] },
      { field: "status", values: ["active"] },
    ]);
    expect(resolved?.pending).toEqual([]);
  });

  it("🔴 {\\cHFFFFFF}{\\cH00FFFF} refPresectSole unfilled, pending, non-conditional", () => {
    const resolved = resolveRefPreselect(filter, null, true, {}, null);
    expect(resolved?.pending).toEqual(["$bill.productId"]);
  });
});

// push the coordinates: which levels —

const schema = normalizeProbe();

function normalizeProbe(): ModuleSchema {
  return normalizeFixtureModule({
    code: "preselectProbe",
    label: "Preselect probe",
    domain: "production",
    numbering: { prefix: "PP", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        required: true,
        refFilter: { productId: { from: "$bill.productId" }, status: "active" },
        refPreselect: { isDefault: true },
      },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "preselectProbeLine",
        fields: [
          { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
          {
            key: "routingId",
            label: "Routing",
            type: "ref",
            ref: "routing",
            refFilter: { productId: { from: "$line.productId" }, status: "active" },
            refPreselect: { isDefault: true },
          },
        ],
      },
    ],
    lifecycle: {
      // Single-state master data form (same) `singleState()`): Initial + triminal, so that the probe does not bring itself out of the unrelated gate
      statuses: [{ key: "Take effect", label: "Take effect", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
  });
}

describe("i'm sorry, but I'm sorry, but I'm sorry, but I'm sorry.", () => {
  it("the tableheads and the details are separated. The terms are the same as the goods on the floor.", () => {
    const sites = refPreselectSitesOf(
      schema,
      { productId: "p-1", bomId: null },
      { lines: [{ productId: "p-2", routingId: null }] },
    );
    expect(sites.map((s) => s.target.path)).toEqual(["bomId", "lines[0].routingId"]);
    expect(sites[0]?.conditions).toEqual([
      { field: "productId", values: ["p-1"] },
      { field: "status", values: ["active"] },
      { field: "isDefault", values: [true] },
    ]);
    // 🔴 The condition on the line is to take the goods of this line**, not the head of the watch: the wrong layer fills each line with the same BOM
    expect(sites[1]?.conditions[0]).toEqual({ field: "productId", values: ["p-2"] });
    expect(sites[1]?.target).toEqual({
      table: "lines",
      row: 0,
      field: "routingId",
      path: "lines[0].routingId",
      label: "Lines line 1 · Routing",
    });
  });

  it("🔴 The other half of the cells that already have value doesn't come in -- they can switch.", () => {
    const sites = refPreselectSitesOf(
      schema,
      { productId: "p-1", bomId: "Chosen by the user" },
      { lines: [{ productId: "p-2", routingId: "Also chosen by hand" }] },
    );
    expect(sites).toEqual([]);
  });

  it("🔴 The candidate group Pending will not come in: Picking one is a guess.", () => {
    const sites = refPreselectSitesOf(schema, { bomId: null }, { lines: [{ routingId: null }] });
    expect(sites).toEqual([]);
  });

  it("line number and line order are carried as they are - Rewrite the wrong line of coordinates, the default of line A is written in line B and both lines are normal", () => {
    const sites = refPreselectSitesOf(schema, { productId: "p-1", bomId: "Present" }, {
      lines: [
        { productId: "p-2", routingId: null },
        { productId: "p-3", routingId: "Chosen by hand" },
        { productId: "p-4", routingId: null },
      ],
    });
    expect(sites.map((s) => s.target.row)).toEqual([0, 2]);
    expect(sites.map((s) => s.conditions[0]?.values)).toEqual([["p-2"], ["p-4"]]);
  });

  it("🔴 RefPreselectSole also enters, subject to a candidate's candidacy.", () => {
    const soleSchema = normalizeFixtureModule({
      code: "soleProbe",
      label: "Sole-candidate probe",
      domain: "production",
      numbering: { prefix: "SP", seqScope: "tenant" },
      fields: [
        { key: "code", label: "Code", type: "string", primary: true, auto: true },
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        {
          key: "bomId",
          label: "BOM",
          type: "ref",
          ref: "bom",
          refFilter: { productId: { from: "$bill.productId" }, status: "active" },
          refPreselectSole: true,
        },
      ],
      lifecycle: {
        statuses: [{ key: "Take effect", label: "Take effect", color: "green", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
    });
    const sites = refPreselectSitesOf(soleSchema, { productId: "p-1", bomId: null }, {});
    expect(sites.map((s) => s.target.path)).toEqual(["bomId"]);
    expect(sites[0]?.conditions).toEqual([
      { field: "productId", values: ["p-1"] },
      { field: "status", values: ["active"] },
    ]);
  });
});

describe("bond: Fill in + Default Selection = Conclusion comes down late, not relaxing.", () => {
  it("the goods are filled, the BOM is empty.", () => {
    const checked = checkNewBill(schema, { productId: "p-1" }, { lines: [] });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.header["bomId"]).toBeNull();
  });

  it("🔴 There's nothing to fill in.", () => {
    const checked = checkNewBill(schema, {}, { lines: [] });
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues.map((i) => i.path).sort()).toEqual(["bomId", "productId"]);
    }
  });
});

describe("bond: refPreselectSole also pushes the mandatory conclusion to the supplementary value", () => {
  const soleSchema = normalizeFixtureModule({
    code: "soleGateProbe",
    label: "Sole-candidate gate probe",
    domain: "production",
    numbering: { prefix: "SG", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "bomId",
        label: "BOM",
        type: "ref",
        ref: "bom",
        required: true,
        refFilter: { productId: { from: "$bill.productId" }, status: "active" },
        refPreselectSole: true,
      },
    ],
    lifecycle: {
      statuses: [{ key: "Take effect", label: "Take effect", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
  });

  it("the goods are filled, the BOM is empty, so let go of the nudity.", () => {
    const checked = checkNewBill(soleSchema, { productId: "p-1" }, {});
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.header["bomId"]).toBeNull();
  });

  it("🔴 Two articles in the local press: the candidates were not accused, and the only one could not be filled out.", () => {
    const checked = checkNewBill(soleSchema, {}, {});
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues.map((i) => i.path).sort()).toEqual(["bomId", "productId"]);
    }
  });
});
