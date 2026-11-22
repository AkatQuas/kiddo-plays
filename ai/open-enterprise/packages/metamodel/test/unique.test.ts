// ---------------------------------------------------------------------------
// Unique`Field.unique`) — Four gates on the Declaring Layer + list of coordinates to write paths to check
//
// the two must be nailed together: every non-constructive combination rejected from the declarative level, and once one of them is missing, it is not the fault that is given.
// it's the synonym "A" and "B" of the system, and the list of coordinates is missing.
// this is reflected in the weight of the field** remains silent** — the user filled in the library.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  FIELD_TYPES,
  checkBillPatch,
  checkNewBill,
  normalizeFixtureModule,
  uniqueRefusalOf,
  uniqueSitesOf,
  validateModule,
  type FieldType,
} from "../src/index.js";

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  views: unknown;
  [key: string]: unknown;
}

/** A statement of least available master data. One in one in each case and one in another. */
function goods(): Raw {
  return structuredClone({
    code: "goods",
    label: "Product",
    domain: "inventory",
    numbering: { prefix: "SP", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "barcode", label: "Barcode", type: "string", unique: true },
      { key: "name", label: "Name", type: "string", required: true },
      { key: "qty", label: "Quantity", type: "number" },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "goodsLine",
        fields: [
          { key: "spec", label: "Specification", type: "string" },
          { key: "count", label: "Piece count", type: "number" },
        ],
      },
    ],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code", "name"] } },
  });
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

/** Renumbering of a field in the header */
function withHeaderField(raw: Raw, key: string, patch: Record<string, unknown>): Raw {
  const fields = raw.fields as Record<string, unknown>[];
  const hit = fields.find((f) => f["key"] === key);
  if (!hit) throw new Error(`fixture: no field "${key}"`);
  Object.assign(hit, patch);
  return raw;
}

describe("closed key: unique is a box on Field, not a handwritten type", () => {
  it("`unique` We had a closed key check.", () => {
    expect(() => normalizeFixtureModule(goods())).not.toThrow();
  });

  it("Error spelling a letter (%1)`uniqe`On the spot - silent neglect would make people think the restriction is working.", () => {
    const raw = withHeaderField(goods(), "barcode", { uniqe: true });
    expect(() => normalizeFixtureModule(raw)).toThrow(/uniqe/);
  });

  it("regulated Boer, default false", () => {
    const schema = normalizeFixtureModule(goods());
    expect(schema.fields.find((f) => f.key === "barcode")?.unique).toBe(true);
    expect(schema.fields.find((f) => f.key === "name")?.unique).toBe(false);
  });
});

describe("declarion level: the kind that was set up.", () => {
  it("normal text field on the table is marked unique - none of the errors", () => {
    expect(errorCodes(goods())).toEqual([]);
  });

  it("ref can also be the only one: a client with only one file is established.", () => {
    const raw = goods();
    (raw.fields as unknown[]).push({ key: "customerId", label: "Customer", type: "ref", ref: "customer", unique: true });
    expect(errorCodes(raw)).toEqual([]);
  });
});

describe("fIELD UNIQUE SYSTEM SUPPLIED -- no one can be allowed to have three legs of system supply.", () => {
  it("delive without column, the only index is not available anywhere", () => {
    const raw = withHeaderField(goods(), "qty", {
      derive: { kind: "rollup", from: "salesOrder", match: "productId", measure: "sum(qty)" },
      unique: true,
    });
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_SYSTEM_SUPPLIED");
  });

  it("lineAgg falls, but the sum of the two sheets is the same as usual -- the only thing that'll turn off normal business.", () => {
    const raw = withHeaderField(goods(), "qty", {
      lineAgg: { of: "lines", measure: "sum(count)" },
      unique: true,
    });
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_SYSTEM_SUPPLIED");
  });

  it("the autumn number is the only one that's ever been taken, and it happened after the weighting -- the value can't be seen in the gravity structure.", () => {
    const raw = withHeaderField(goods(), "code", { unique: true, primary: false });
    // primary, take it off. It has to be the "system supply" article, not the one that folds.
    (raw.fields as Record<string, unknown>[])[2]!["primary"] = true;
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_SYSTEM_SUPPLIED");
  });
});

describe("fIELD UNIQUE TYPE -- those types that don't make sense.", () => {
  const cases: readonly { readonly type: FieldType; readonly why: string; readonly extra?: Record<string, unknown> }[] = [
    { type: "bool", why: "only two values, so unique in the tenant means the table has at most two rows" },
    { type: "enum", why: "the value set is closed, so unique means the row cap is the number of options", extra: { options: ["A", "B"] } },
    { type: "text", why: "long text is not a registration cell, and a btree index row has a length cap that throws only at insert" },
    { type: "attachment", why: "the value shape is not declared in the metamodel, so jsonb equality has no definition" },
  ];
  for (const { type, why, extra } of cases) {
    it(`${type} must not be unique — ${why}`, () => {
      const raw = withHeaderField(goods(), "qty", { type, unique: true, ...(extra ?? {}) });
      expect(errorCodes(raw)).toContain("FIELD_UNIQUE_TYPE");
    });
  }

  it("nor can subtable itself -- it doesn't build a column, it's another watch.", () => {
    const raw = withHeaderField(goods(), "lines", { unique: true });
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_TYPE");
  });

  it("🔴 Each field type has a clear judgement, not falling into the default branch.", () => {
    // FildType`Record<FieldType, string | null>`: Add one type less than one to compile
    // Error. This test runs half the time. It's out of date. `undefined` It'll be considered the only one.
    for (const type of FIELD_TYPES) {
      expect(uniqueRefusalOf(type), `type "${type}" has no uniqueness verdict`).not.toBeUndefined();
    }
  });
});

describe("fIELD UNIQUE ON LINE -- the only way in the line is two readings: only one that is clear.", () => {
  it("detailed indicator unique is red", () => {
    const raw = goods();
    const lines = (raw.fields as Record<string, unknown>[]).find((f) => f["key"] === "lines");
    ((lines as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["unique"] = true;
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_ON_LINE");
  });
});

describe("fIELD UNIQUE WITH Primary - unique, not repeat declaration", () => {
  it("primary relabeled unique sentence: 2nd index issued, with 2 declarations only", () => {
    // primary is also auto, so both will be reported... There's only one word for it.
    const raw = withHeaderField(goods(), "code", { unique: true });
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_WITH_PRIMARY");
  });

  it("the non-systemic delivery of the Primary is also denied.", () => {
    const raw = withHeaderField(goods(), "code", { unique: true, auto: false });
    delete (raw as Record<string, unknown>)["numbering"];
    const codes = errorCodes(raw);
    expect(codes).toContain("FIELD_UNIQUE_WITH_PRIMARY");
    expect(codes).not.toContain("FIELD_UNIQUE_SYSTEM_SUPPLIED");
  });
});

// the list of coordinates of the path —

const schema = normalizeFixtureModule(goods());

describe("uniqueSitesof - \"What to look for\" was introduced from the statement, and not by sserver itself", () => {
  it("only fields with values are on the list, and path and label (issues to mark in that cell)", () => {
    expect(uniqueSitesOf(schema, { barcode: "6901234567892", name: "Bolt" })).toEqual([
      { key: "barcode", path: "barcode", label: "Barcode", value: "6901234567892", with: [] },
    ]);
  });

  it("🔴 The empty value is not the only one - a batch of uncoded goods must be stored. Down", () => {
    // none of the three unfilled forms produced coordinates: Null.
    expect(uniqueSitesOf(schema, { barcode: null, name: "Bolt" })).toEqual([]);
    expect(uniqueSitesOf(schema, { barcode: undefined, name: "Bolt" })).toEqual([]);
    expect(uniqueSitesOf(schema, { name: "Bolt" })).toEqual([]);
  });

  it("🔴 The key closes the empty string to full -- otherwise the \"unfilled\" is degraded to \"all filled with the same value\"", () => {
    // this one is linked to the previous one: an empty string just as it is, two uncoded items are in the vault.
    // Two lines. `''`, the only index will be rejected in the second line and the user will not fill in anything.
    const check = checkNewBill(schema, { barcode: "   ", name: "Bolt" }, { lines: [] });
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.header["barcode"]).toBeNull();
    expect(uniqueSitesOf(schema, check.header)).toEqual([]);
  });

  it("patch semantics are natural correct: undetected keys -- the value hasn't moved, Curly's line is the only one that's satisfied.", () => {
    const check = checkBillPatch(schema, { name: "Rename" }, null);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(uniqueSitesOf(schema, check.header)).toEqual([]);
  });

  it("non-single fields do not appear in the list - recheck not \"Check all fields\"", () => {
    expect(uniqueSitesOf(schema, { name: "Bolt", qty: 3 })).toEqual([]);
  });

  it("🔴 Fail-fast, skipping silently when lined with unique -- statement written and no running is the worst", () => {
    // fIELD UNIQUE ON LINE should have stopped first; when you bypassed the gate (handwritten schema, sticker JSON)
    // the alternative form is "The Modeller thinks there is no limit to it."
    const raw = goods();
    const lines = (raw.fields as Record<string, unknown>[]).find((f) => f["key"] === "lines");
    ((lines as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["unique"] = true;
    const bad = normalizeFixtureModule(raw);
    expect(() => uniqueSitesOf(bad, { barcode: "X" })).toThrow(/line column/);
  });
});

// ─ UniqueWith —

describe("uniqueWith - Composite Coordinates, not degraded into a separate column too strict", () => {
  it("version + productId: no repetition of the next version of the same product; different products can be used in the same name version", () => {
    const raw = withHeaderField(goods(), "barcode", {
      key: "version",
      label: "Version",
      unique: true,
      uniqueWith: ["name"],
      required: true,
    });
    expect(errorCodes(raw)).toEqual([]);
    const schema = normalizeFixtureModule(raw);
    expect(uniqueSitesOf(schema, { version: "V1.0", name: "Motor" })).toEqual([
      {
        key: "version",
        path: "version",
        label: "Version",
        value: "V1.0",
        with: [{ key: "name", value: "Motor", label: "Name" }],
      },
    ]);
  });

  it("the entire station skips when the accompanying column is missing - not rechecking the coordinates will miscalculate the \"unselected product\" Version", () => {
    const raw = withHeaderField(goods(), "barcode", {
      key: "version",
      label: "Version",
      unique: true,
      uniqueWith: ["name"],
      required: true,
    });
    const schema = normalizeFixtureModule(raw);
    expect(uniqueSitesOf(schema, { version: "V1.0" })).toEqual([]);
    expect(uniqueSitesOf(schema, { version: "V1.0", name: null })).toEqual([]);
  });

  it("no unique, but write uniquewith, uniquewild UNIQUE WITH WITHOUT UNIQUE", () => {
    const raw = withHeaderField(goods(), "name", { uniqueWith: ["barcode"] });
    expect(errorCodes(raw)).toContain("FIELD_UNIQUE_WITH_WITHOUT_UNIQUE");
  });

  it("uniqueWith / unknown field / empty array rejected", () => {
    expect(
      errorCodes(withHeaderField(goods(), "barcode", { uniqueWith: ["barcode"] })),
    ).toContain("FIELD_UNIQUE_WITH_SELF");
    expect(
      errorCodes(withHeaderField(goods(), "barcode", { uniqueWith: ["noSuch"] })),
    ).toContain("FIELD_UNIQUE_WITH_UNKNOWN");
    expect(() =>
      normalizeFixtureModule(withHeaderField(goods(), "barcode", { uniqueWith: [] })),
    ).toThrow(/must not be an empty array/);
  });
});
