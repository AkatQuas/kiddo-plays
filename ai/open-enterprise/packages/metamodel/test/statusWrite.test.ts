// ---------------------------------------------------------------------------
// uniqueDefaultWithin / stampOnFirstEnter - key lock + shape gate + setstatus contrast
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  normalizeFixtureModule,
  statusWritePlan,
  validateModule,
  type ModuleSchema,
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

/*:: Plugin module: isDefault/effictiveDate, but neither status is written in the declaration. */
function jig(): Raw {
  return structuredClone({
    code: "jig",
    label: "Fixture",
    domain: "manufacturing",
    numbering: { prefix: "JJ", seqScope: "tenant" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "productId", label: "Product", type: "string", required: true },
      { key: "isDefault", label: "Default version", type: "bool", required: true },
      { key: "effectiveDate", label: "Effective date", type: "date", systemGenerated: true },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "active", label: "In effect" },
        { key: "disabled", label: "Disabled" },
      ],
      transitions: [
        { code: "activate", from: "draft", to: "active", action: "Take effect" },
        { code: "disable", from: "active", to: "disabled", action: "Disable" },
        { code: "enable", from: "disabled", to: "active", action: "Re-enable" },
      ],
    },
    views: { list: { columns: ["code", "productId"] } },
  });
}

function withPolicies(): Raw {
  const raw = jig();
  raw.code = "versioned";
  raw.label = "Version record";
  const fields = raw.fields as Record<string, unknown>[];
  Object.assign(fields.find((field) => field["key"] === "isDefault") ?? {}, {
    uniqueDefaultWithin: { within: ["productId"], status: "active" },
  });
  Object.assign(fields.find((field) => field["key"] === "effectiveDate") ?? {}, {
    stampOnFirstEnter: { status: "active" },
  });
  return raw;
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((error) => error.code);
}

function withHeaderField(raw: Raw, key: string, patch: Record<string, unknown>): Raw {
  const fields = raw.fields as Record<string, unknown>[];
  const hit = fields.find((field) => field["key"] === key);
  if (!hit) throw new Error(`fixture: no field "${key}"`);
  Object.assign(hit, patch);
  return raw;
}

function applyPlan(
  rows: Map<string, Record<string, unknown>>,
  id: string,
  from: string,
  to: string,
  schema: ModuleSchema,
  now: Date,
  timeZone: string,
  failOn: "none" | "status" = "none",
): void {
  const snapshot = structuredClone([...rows.entries()]);
  try {
    const row = rows.get(id);
    if (!row) throw new Error("missing this document");
    const plan = statusWritePlan(schema, from, to, row, now, timeZone);
    for (const demote of plan.demote) {
      for (const [otherId, other] of rows) {
        if (otherId === id) continue;
        if (other["status"] !== demote.status || other[demote.field] !== true) continue;
        if (Object.entries(demote.within).every(([key, value]) => other[key] === value)) {
          other[demote.field] = false;
        }
      }
    }
    if (failOn === "status") throw new Error("status update failed");
    row["status"] = to;
    Object.assign(row, plan.stamp);
  } catch (error) {
    rows.clear();
    for (const [key, value] of snapshot) rows.set(key, value);
    throw error;
  }
}

describe("closed Key: Two status writing statements are on Field", () => {
  it("legitimate declaration of closed bonds and semantic gates", () => {
    expect(errorCodes(withPolicies())).toEqual([]);
  });

  it("misspelled unique DefaultWithin", () => {
    expect(() => normalizeFixtureModule(withHeaderField(jig(), "isDefault", { uniqueDefaultWithn: { within: ["productId"], status: "active" } })))
      .toThrow(/uniqueDefaultWithn/);
  });

  it("spell error", () => {
    expect(() => normalizeFixtureModule(withHeaderField(jig(), "effectiveDate", { stampOnFirstEntrer: { status: "active" } })))
      .toThrow(/stampOnFirstEntrer/);
  });

  it("one more key on the spot.", () => {
    expect(() =>
      normalizeFixtureModule(withHeaderField(jig(), "isDefault", {
        uniqueDefaultWithin: { within: ["productId"], status: "active", extra: true },
      })),
    ).toThrow(/extra/);
    expect(() =>
      normalizeFixtureModule(withHeaderField(jig(), "effectiveDate", {
        stampOnFirstEnter: { status: "active", when: "draft" },
      })),
    ).toThrow(/when/);
  });
});

describe("shapegate", () => {
  it("unique DefaultWithin can only be hung on the bool", () => {
    expect(() =>
      normalizeFixtureModule(withHeaderField(jig(), "productId", {
        uniqueDefaultWithin: { within: ["code"], status: "active" },
      })),
    ).toThrow(/may be attached only to a bool field/);
  });

  it("sTampOnFirstEnter can only be hung on date / datetime", () => {
    expect(() =>
      normalizeFixtureModule(withHeaderField(jig(), "isDefault", {
        stampOnFirstEnter: { status: "active" },
      })),
    ).toThrow(/may be attached only to a date or datetime field/);
  });

  it("with empty array / unknown status / self finger / rejection with unique", () => {
    expect(() =>
      normalizeFixtureModule(withHeaderField(jig(), "isDefault", {
        uniqueDefaultWithin: { within: [], status: "active" },
      })),
    ).toThrow(/must not be an empty array/);
    expect(errorCodes(withHeaderField(jig(), "isDefault", {
      uniqueDefaultWithin: { within: ["productId"], status: "published" },
    }))).toContain("FIELD_UNIQUE_DEFAULT_STATUS_UNKNOWN");
    expect(errorCodes(withHeaderField(jig(), "isDefault", {
      uniqueDefaultWithin: { within: ["isDefault"], status: "active" },
    }))).toContain("FIELD_UNIQUE_DEFAULT_WITHIN_SELF");
    expect(errorCodes(withHeaderField(jig(), "isDefault", {
      unique: true,
      uniqueDefaultWithin: { within: ["productId"], status: "active" },
    }))).toContain("FIELD_UNIQUE_DEFAULT_WITH_UNIQUE");
  });

  it("sTampOnFirstEnter must systemGenerate, state must exist", () => {
    const raw = jig();
    const fields = raw.fields as Record<string, unknown>[];
    const date = fields.find((field) => field["key"] === "effectiveDate");
    if (date) {
      delete date["systemGenerated"];
      date["stampOnFirstEnter"] = { status: "active" };
    }
    expect(errorCodes(raw)).toContain("FIELD_STAMP_NOT_SYSTEM_SUPPLIED");
    expect(errorCodes(withHeaderField(jig(), "effectiveDate", {
      stampOnFirstEnter: { status: "published" },
    }))).toContain("FIELD_STAMP_STATUS_UNKNOWN");
  });

  it("both keys in the column are rejected.", () => {
    const raw = withPolicies();
    (raw.fields as unknown[]).push({
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "jigLine",
      fields: [
        {
          key: "isDefault",
          label: "Line default",
          type: "bool",
          uniqueDefaultWithin: { within: ["productId"], status: "active" },
        },
        {
          key: "effectiveDate",
          label: "Line date",
          type: "date",
          systemGenerated: true,
          stampOnFirstEnter: { status: "active" },
        },
      ],
    });
    const codes = errorCodes(raw);
    expect(codes).toContain("FIELD_UNIQUE_DEFAULT_ON_LINE");
    expect(codes).toContain("FIELD_STAMP_ON_LINE");
  });
});

describe("setStatus Contrast: Declared Driver, not if", () => {
  const now = new Date("2026-09-01T16:00:00.000Z");
  const tz = "Asia/Shanghai";

  it("the same product already has an active default → Another tag default and enter an active → old default into non-default", () => {
    const schema = normalizeFixtureModule(withPolicies());
    const rows = new Map<string, Record<string, unknown>>([
      ["old", { productId: "p-1", isDefault: true, effectiveDate: "2026-07-30", status: "active" }],
      ["next", { productId: "p-1", isDefault: true, effectiveDate: null, status: "draft" }],
    ]);
    applyPlan(rows, "next", "draft", "active", schema, now, tz);
    expect(rows.get("old")?.["isDefault"]).toBe(false);
    expect(rows.get("next")?.["isDefault"]).toBe(true);
    expect(rows.get("next")?.["status"]).toBe("active");
  });

  it("first driftactive writing effictiveDate; existing effictiveDate re-involved without overwrite", () => {
    const schema = normalizeFixtureModule(withPolicies());
    const first = statusWritePlan(
      schema,
      "draft",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: null },
      now,
      tz,
    );
    expect(first.stamp).toEqual({ effectiveDate: "2026-09-02" });

    const keep = statusWritePlan(
      schema,
      "draft",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: "2026-07-30" },
      now,
      tz,
    );
    expect(keep.stamp).toEqual({});
  });

  it("datetime entered first writing time, value not overwritten", () => {
    const raw = withHeaderField(jig(), "effectiveDate", {
      type: "datetime",
      stampOnFirstEnter: { status: "active" },
    });
    const schema = normalizeFixtureModule(raw);
    expect(statusWritePlan(
      schema,
      "draft",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: null },
      now,
      tz,
    ).stamp).toEqual({ effectiveDate: "2026-09-01T16:00:00.000Z" });
    expect(statusWritePlan(
      schema,
      "disabled",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: null },
      now,
      tz,
    ).stamp).toEqual({ effectiveDate: "2026-09-01T16:00:00.000Z" });
    expect(statusWritePlan(
      schema,
      "disabled",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: "2026-08-01T01:02:03.000Z" },
      now,
      tz,
    ).stamp).toEqual({});
  });

  it("rollback / Failed Path: Old Default Freeze", () => {
    const schema = normalizeFixtureModule(withPolicies());
    const rows = new Map<string, Record<string, unknown>>([
      ["old", { productId: "p-1", isDefault: true, effectiveDate: "2026-07-30", status: "active" }],
      ["next", { productId: "p-1", isDefault: true, effectiveDate: null, status: "draft" }],
    ]);
    expect(() => applyPlan(rows, "next", "draft", "active", schema, now, tz, "status")).toThrow(/status update failed/);
    expect(rows.get("old")?.["isDefault"]).toBe(true);
    expect(rows.get("next")?.["status"]).toBe("draft");
  });

  it("plugin module does not have two keys: same walk-in activity, neither old nor stamped", () => {
    const schema = normalizeFixtureModule(jig());
    expect(errorCodes(jig())).toEqual([]);
    const rows = new Map<string, Record<string, unknown>>([
      ["old", { productId: "p-1", isDefault: true, effectiveDate: "2026-07-30", status: "active" }],
      ["next", { productId: "p-1", isDefault: true, effectiveDate: null, status: "draft" }],
    ]);
    applyPlan(rows, "next", "draft", "active", schema, now, tz);
    expect(rows.get("old")?.["isDefault"]).toBe(true);
    expect(rows.get("next")?.["effectiveDate"]).toBeNull();
    expect(statusWritePlan(
      schema,
      "draft",
      "active",
      { productId: "p-1", isDefault: true, effectiveDate: null },
      now,
      tz,
    )).toEqual({ demote: [], supersede: [], stamp: {} });
  });

  it("do not lower old when this item is not indicated as default; default does not affect different products", () => {
    const schema = normalizeFixtureModule(withPolicies());
    const unmarked = statusWritePlan(
      schema,
      "draft",
      "active",
      { productId: "p-1", isDefault: false, effectiveDate: null },
      now,
      tz,
    );
    expect(unmarked.demote).toEqual([]);

    const otherProduct = new Map<string, Record<string, unknown>>([
      ["old", { productId: "p-1", isDefault: true, effectiveDate: "2026-07-30", status: "active" }],
      ["next", { productId: "p-2", isDefault: true, effectiveDate: null, status: "draft" }],
    ]);
    applyPlan(otherProduct, "next", "draft", "active", schema, now, tz);
    expect(otherProduct.get("old")?.["isDefault"]).toBe(true);
  });
});
