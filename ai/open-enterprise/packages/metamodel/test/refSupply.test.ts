// ---------------------------------------------------------------------------
// ** Quoted ** ** ** ** ** ** ** **
//
// this axis was forced out of a 500, using the 500 shape as an example:
//
//   Accounts payable are to be reconciled with an upstream bill of receipt**, unit number and date**. Only the coordinates are entered. `receiptLineId`
//  (Line citation is the only input) with a single number/date hanging on the companion** ref**(`receiptId`Go on.
//   the values of the accompanying column are added by join in the first jump resolution - the first jump does not see it (not writing body),
//   the second jump didn't recognize it (it wasn't snapshot), so the two rows were empty on PG's NOT NULL.
//   Save Change `HTTP 500`And the user did nothing wrong.
//
// The timing was once assumed to be hidden.** `chainOk` This post is part of our special coverage Global Voices 2011.
// The assumptions vary from one place to another, and the gap falls out of 500 above. Only now. `refSupplyOf` One.
// read it around -- the following is an example of how to nail "it's the same".
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  chainedRefSitesOf,
  normalizeFixtureModule,
  refSitesOf,
  refSupplyOf,
  snapshotColumnNotNull,
  validateModule,
  type Field,
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

/**
 * the smallest "invoicing": the first supplier on the table, line** line quote + companion ref**.
 * the examples used are only a breakdown and one test.
 */
function statement(lines: unknown[]): Raw {
  return structuredClone({
    code: "payableStatementFixture",
    label: "Statement",
    domain: "procurement",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
      { key: "lines", label: "Lines", type: "subtable", ref: "payableStatementFixtureLine", fields: lines },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "done", label: "Confirmed", color: "green", terminal: true },
      ],
      transitions: [{ code: "confirm", from: "draft", to: "done", action: "Confirm", primary: true }],
    },
    views: { list: { columns: ["code", "supplierId"] } },
  });
}

/*:: Line-level reference + companion ref this pair (entry coordinates for accounts payable) */
const RECEIPT_PAIR = [
  { key: "receiptId", label: "Goods receipt", type: "ref", ref: "purchaseReceipt", required: true },
  {
    key: "receiptLineId",
    label: "Receipt line",
    type: "refLine",
    ref: "purchaseReceipt",
    through: "lines",
    required: true,
  },
];

/** Freeze from the top of ** watch ** ref -- that's the two columns that fell in the suture */
const HEADER_SNAPSHOTS = [
  {
    key: "documentNo",
    label: "Business number",
    type: "string",
    snapshot: { from: "purchaseReceipt", match: "receiptId", through: null, field: "code" },
  },
  {
    key: "businessDate",
    label: "Business date",
    type: "date",
    snapshot: { from: "purchaseReceipt", match: "receiptId", through: null, field: "receiptDate" },
  },
];

/** From ** upstream ** freeze (metch finger refLine) — this is a former good box for comparison */
const LINE_SNAPSHOT = {
  key: "productId",
  label: "Product",
  type: "ref",
  ref: "product",
  snapshot: { from: "purchaseReceipt", match: "receiptLineId", through: "lines", field: "productId" },
};

function lineFieldsOf(schema: ModuleSchema): readonly Field[] {
  const table = schema.fields.find((f) => f.key === "lines");
  if (!table?.fields) throw new Error("fixture has no line table");
  return table.fields;
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

// the sentence itself —

describe("refSupplyof - third tranche, derived from statement, zero IO", () => {
  const schema = normalizeFixtureModule(statement([...RECEIPT_PAIR, ...HEADER_SNAPSHOTS, LINE_SNAPSHOT]));
  const lines = lineFieldsOf(schema);
  const by = (key: string): Field => lines.find((f) => f.key === key) ?? schema.fields.find((f) => f.key === key)!;

  it("user filled in = input file (first jump)", () => {
    expect(refSupplyOf(by("receiptLineId"), lines)).toMatchObject({ stage: "input", via: "input", guaranteed: true });
    expect(refSupplyOf(by("supplierId"), schema.fields)).toMatchObject({ stage: "input", via: "input" });
  });

  it("🔴 ResfLine's companion ref =resolved-value added in first jump resolution Let's go.", () => {
    // this is the point of the whole bug: the accompanying column is not in the body either.
    // i'm not a snapshot. It's a verdict.
    expect(refSupplyOf(by("receiptId"), lines)).toMatchObject({
      stage: "resolved",
      via: "companion",
      guaranteed: true,
    });
  });

  it("self also snapshot's ref=resolved.", () => {
    expect(refSupplyOf(by("productId"), lines)).toMatchObject({ stage: "resolved", via: "chain", guaranteed: true });
  });

  it("🔴 Deeper = unreachable -- that's a third jump and only two jumps for writing paths.", () => {
    const schema = normalizeFixtureModule(
      statement([
        ...RECEIPT_PAIR,
        LINE_SNAPSHOT,
        {
          key: "categoryId",
          label: "Product category",
          type: "ref",
          ref: "productCategory",
          // i'm gonna wait until the first jump.
          snapshot: { from: "product", match: "productId", through: null, field: "categoryId" },
        },
      ]),
    );
    const lines = lineFieldsOf(schema);
    const supply = refSupplyOf(lines.find((f) => f.key === "categoryId")!, lines);
    expect(supply).toMatchObject({ stage: "unreachable", via: "depth", guaranteed: false });
  });

  it("the nonref field has no answer on this axis.", () => {
    expect(refSupplyOf(by("documentNo"), lines)).toBeNull();
  });

  it("ringed snapshot chain undead", () => {
    // normalizeFixtureModule only determines shapes, half of the circle with loader's checkcrossReferences.
    const raw = statement([
      {
        key: "aId",
        label: "A",
        type: "ref",
        ref: "product",
        snapshot: { from: "product", match: "bId", through: null, field: "x" },
      },
      {
        key: "bId",
        label: "B",
        type: "ref",
        ref: "product",
        snapshot: { from: "product", match: "aId", through: null, field: "y" },
      },
    ]);
    const lines = lineFieldsOf(normalizeFixtureModule(raw));
    expect(refSupplyOf(lines[0]!, lines)?.stage).toBe("unreachable");
  });
});

// the consumer 12:1:2 jumps must cover each snapshot —

describe("🔴 The two jumps together over the cover -- the red one over, the red one is saved 500.", () => {
  const schema = normalizeFixtureModule(statement([...RECEIPT_PAIR, ...HEADER_SNAPSHOTS, LINE_SNAPSHOT]));
  const header = { supplierId: "sup-1" };
  /** Write body only refLine: companion ref is system supply, key is off the client Write It's... */
  const written = { lines: [{ receiptLineId: "rl-1" }] };
  /** The line after the applicationites: add up, line line snapshot freeze */
  const resolved = { lines: [{ receiptLineId: "rl-1", receiptId: "receipt-1", productId: "p-1" }] };

  const hop1 = refSitesOf(schema, header, written);
  const hop2 = chainedRefSitesOf(schema, header, resolved, new Set(hop1.map((s) => s.path)));

  it("first jump input only: companion ref not writing body, not receiving it", () => {
    expect(hop1.map((s) => s.path)).toEqual(["supplierId", "lines[0].receiptLineId"]);
    // snapshot on refLine goes first.
    expect(hop1.at(-1)?.snapshots.map((s) => s.target.field)).toEqual(["productId"]);
  });

  it("🔴 Second jump attendant, ref, and follow the documentation id to look up the table**", () => {
    expect(hop2).toHaveLength(1);
    expect(hop2[0]).toMatchObject({ path: "lines[0].receiptId", entity: "purchaseReceipt", through: null, id: "receipt-1" });
    expect(hop2[0]?.snapshots.map((s) => `${s.sourceField}→${s.target.field}`)).toEqual([
      "code→documentNo",
      "receiptDate→businessDate",
    ]);
  });

  it("🔴 Each snapshot has been asked for a value - the missing cell is a NOT NULL violation", () => {
    const covered = new Set<string>();
    for (const site of [...hop1, ...hop2]) for (const s of site.snapshots) covered.add(s.target.field);
    // before the fix was ["product Id"]: document No / businessDate, no one jumped to ask,
    // Drizzle on the library. `default`PG rejected HTTP 500
    expect([...covered].sort()).toEqual(["businessDate", "documentNo", "productId"]);
  });

  it("The second jump does not repeat the coordinates already checked for the first jump.`already`）", () => {
    const again = chainedRefSitesOf(schema, header, resolved, new Set([...hop1.map((s) => s.path), "lines[0].receiptId"]));
    expect(again).toEqual([]);
  });

  it("no coordinates, no undefined. Library", () => {
    expect(chainedRefSitesOf(schema, header, written, new Set(hop1.map((s) => s.path)))).toEqual([]);
  });
});

// consumer 3: Model Gate —

describe("modeling period gate: value materialize than snapshot", () => {
  it("🔴 Ref frozen upper surface field is ** legal and generally ** demand - not to be blocked by a gate", () => {
    // each statement of account and invoice must “take out a single number and date upstream”. It's the wrong answer to just stick the door open.
    expect(errorCodes(statement([...RECEIPT_PAIR, ...HEADER_SNAPSHOTS, LINE_SNAPSHOT]))).toEqual([]);
  });

  it("sNAPSHOT MATCH UNRESOLVED: watch until the second jump. It's...", () => {
    const raw = statement([
      ...RECEIPT_PAIR,
      LINE_SNAPSHOT,
      {
        key: "categoryId",
        label: "Product category",
        type: "ref",
        ref: "productCategory",
        snapshot: { from: "product", match: "productId", through: null, field: "categoryId" },
      },
      {
        key: "categoryName",
        label: "Category name",
        type: "string",
        snapshot: { from: "productCategory", match: "categoryId", through: null, field: "name" },
      },
    ]);
    const report = validateModule(normalizeFixtureModule(raw));
    const issue = report.errors.find((e) => e.code === "SNAPSHOT_MATCH_UNRESOLVED");
    expect(issue?.path).toBe("fields.lines.fields.categoryName.snapshot.match");
    // 🔴 It's not just "no."
    expect(issue?.message).toContain("no hop will ever evaluate the value");
    expect(issue?.message).toContain("root reference");
  });

  it("sNAPSHOT MATCH UNRESOLVED: Metch is the reference from the Deve not this jump on the writing path", () => {
    const raw = statement([
      ...RECEIPT_PAIR,
      {
        key: "orderId",
        label: "Purchase order",
        type: "ref",
        ref: "purchaseOrder",
        derive: { kind: "lookup", from: "purchaseReceipt", through: "lines", match: "receiptLineId", field: "orderId" },
      },
      {
        key: "orderNo",
        label: "Order number",
        type: "string",
        snapshot: { from: "purchaseOrder", match: "orderId", through: null, field: "code" },
      },
    ]);
    const issue = validateModule(normalizeFixtureModule(raw)).errors.find((e) => e.code === "SNAPSHOT_MATCH_UNRESOLVED");
    expect(issue?.message).toContain("derive.lookup");
  });

  it("🔴 SNAPSHOT MATCH OPTIONAL", () => {
    // the accompanying column does not use the label: its value comes from the join of the refLine.
    // the cost of saying the wrong grid is the user changing a statement that doesn't work.
    const raw = statement([
      { key: "receiptId", label: "Goods receipt", type: "ref", ref: "purchaseReceipt", required: true },
      { key: "receiptLineId", label: "Receipt line", type: "refLine", ref: "purchaseReceipt", through: "lines" },
      ...HEADER_SNAPSHOTS,
    ]);
    const issue = validateModule(normalizeFixtureModule(raw)).errors.find((e) => e.code === "SNAPSHOT_MATCH_OPTIONAL");
    expect(issue?.message).toContain("mark the paired refLine required");
  });

  it("input slots remain as reported SNAPSHOT MATCH OPTIONAL", () => {
    const raw = statement([
      { key: "productId", label: "Product", type: "ref", ref: "product" },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "unit" },
      },
    ]);
    expect(errorCodes(raw)).toContain("SNAPSHOT_MATCH_OPTIONAL");
  });

  it("snapshot.optional only lighten the clock; non-empty match still produces reference sites and carries frozen projection", () => {
    const schema = normalizeFixtureModule(
      statement([
        { key: "productId", label: "Product", type: "ref", ref: "product" },
        {
          key: "unit",
          label: "Unit",
          type: "string",
          snapshot: { from: "product", match: "productId", through: null, field: "unit", optional: true },
        },
      ]),
    );
    const empty = refSitesOf(schema, {}, { lines: [{}] });
    expect(empty).toEqual([]);

    const [site] = refSitesOf(schema, {}, { lines: [{ productId: "product-1" }] });
    expect(site).toMatchObject({ entity: "product", id: "product-1", through: null });
    expect(site?.snapshots).toEqual([
      {
        sourceField: "unit",
        target: expect.objectContaining({ table: "lines", row: 0, field: "unit" }),
      },
    ]);
  });
});

// consumer 4: emptiness on the side of the table —

describe("snapshotColumnNotNull: beyond existence, look at timing", () => {
  /*:: A false module that always has assurance on the side of the source, which puts the variable in the "time" dimension Let's go. */
  const resolve = (code: string): ModuleSchema | undefined =>
    code === "purchaseReceipt"
      ? normalizeFixtureModule({
          code: "purchaseReceipt",
          label: "Goods receipt",
          domain: "procurement",
          fields: [
            { key: "code", label: "Document number", type: "string", primary: true, auto: true },
            { key: "receiptDate", label: "Receipt date", type: "date", required: true },
          ],
          numbering: { prefix: "SH", seqScope: "day" },
          lifecycle: { statuses: [{ key: "draft", label: "draft", initial: true }], transitions: [] },
          views: { list: { columns: ["code"] } },
        })
      : undefined;

  it("time to set up + Source to fill in the NOT NULL column.", () => {
    const lines = lineFieldsOf(normalizeFixtureModule(statement([...RECEIPT_PAIR, ...HEADER_SNAPSHOTS])));
    for (const key of ["documentNo", "businessDate"]) {
      expect(snapshotColumnNotNull(lines.find((f) => f.key === key)!, lines, resolve)).toBe(true);
    }
  });

  it("snapshot.optional match is empty, so even if the source is filled, the target column must be empty.", () => {
    const lines = lineFieldsOf(
      normalizeFixtureModule(
        statement([
          { key: "receiptId", label: "Goods receipt", type: "ref", ref: "purchaseReceipt" },
          {
            key: "documentNo",
            label: "Business number",
            type: "string",
            snapshot: {
              from: "purchaseReceipt",
              match: "receiptId",
              through: null,
              field: "code",
              optional: true,
            },
          },
        ]),
      ),
    );
    expect(snapshotColumnNotNull(lines.find((f) => f.key === "documentNo")!, lines, resolve)).toBe(false);
  });

  it("🔴 It's not a good time.", () => {
    // but it's fail-open: a group of worthy businesses will remain silent and the statement says "freeze with source".
    // i can't throw it on the normal path; it's the day when the gate was removed — a simulator accident at this warehouse.
    const lines = lineFieldsOf(
      normalizeFixtureModule(
        statement([
          ...RECEIPT_PAIR,
          LINE_SNAPSHOT,
          {
            key: "categoryId",
            label: "Product category",
            type: "ref",
            ref: "productCategory",
            snapshot: { from: "product", match: "productId", through: null, field: "categoryId" },
          },
          {
            key: "categoryName",
            label: "Category name",
            type: "string",
            snapshot: { from: "productCategory", match: "categoryId", through: null, field: "name" },
          },
        ]),
      ),
    );
    expect(() => snapshotColumnNotNull(lines.find((f) => f.key === "categoryName")!, lines, resolve)).toThrow(
      /is never resolved by any hop/,
    );
  });

  it("not snapshot field constant true - this function answers only snapshot this dimension", () => {
    const lines = lineFieldsOf(normalizeFixtureModule(statement([...RECEIPT_PAIR])));
    expect(snapshotColumnNotNull(lines.find((f) => f.key === "receiptId")!, lines, resolve)).toBe(true);
  });
});
