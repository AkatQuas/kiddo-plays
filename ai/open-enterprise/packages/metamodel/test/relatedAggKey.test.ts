// ---------------------------------------------------------------------------
// `related_agg.on` - "Who's on top of this stretch?" must be an **--
//
// "How much is left in the upstream line?"
//(procurement arrival, bulk billing, write-off of receipts, receipt of refunds, out-of-court receipt, production issuance...),
// It is always written `on: "$line.<refLine column>"`. That reading has always been the right one.
//
//   · `on` Once only "is this one in?", no one looked "is it an id?"
//   · `on` and `match` Whether or not it fell on the same group id**, the whole was unproven.
//
// The symptoms of both gaps are exactly the same and are shown only in ** Release**:`list()` Take an order, id.
// order** row** id column (or take a quantity to compare id column) and none of the rows match ⇒ ** ** ** ** ** **
// "Accumulation must not exceed the ceiling" has been passed on and passed on every single sheet.`verdict = pass`。
//
// The half of the cross-module is in `packages/loader` In the CheckCrossReferences,
// Common kernel with this document `keySpaceOf`- Don't write a rule on either side.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  describeCheck,
  evaluateTransition,
  fieldLabelsOf,
  normalizeFixtureModule,
  validateModule,
  type ModuleSchema,
  type RuleQuery,
} from "../src/index.js";

const NOW = new Date("2026-08-05T00:00:00Z");

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  preconditions: unknown[];
  views: unknown;
  [key: string]: unknown;
}

/*:: Production orders: a line with an upstream order in each line and a cumulative order not exceeding that line Volume */
function release(on: string = "$line.sourceLineId"): Raw {
  return structuredClone({
    code: "release",
    label: "Release document",
    domain: "production",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      {
        key: "lines",
        label: "Release lines",
        type: "subtable",
        ref: "releaseLine",
        fields: [
          { key: "sourceLineId", label: "Source order line", type: "refLine", ref: "order", through: "lines", required: true },
          { key: "sourceOrderId", label: "Source order", type: "ref", ref: "order", required: true },
          { key: "orderQty", label: "Order quantity", type: "number" },
          { key: "releaseQty", label: "Quantity released this time", type: "number", required: true },
        ],
      },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "released", label: "Released", terminal: true },
      ],
      transitions: [{ code: "release", from: "draft", to: "released", action: "Release" }],
    },
    preconditions: [
      {
        id: "qty_within_order_line",
        onTransition: "release",
        source: "gate",
        level: "block",
        why: "The release cap is the part of the source order line not yet scheduled onto a task",
        check: {
          primitive: "related_agg",
          from: "task",
          through: "allocations",
          match: "sourceLineId",
          on,
          agg: "sum",
          measure: "allocatedQty",
          where: null,
          op: "lte",
          right: { ref: "$line.orderQty" },
          plus: { ref: "$line.releaseQty" },
        },
      },
    ],
    views: { list: { columns: ["code"] } },
  }) as Raw;
}

function codesOf(raw: Raw): readonly string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

describe("relaid agg.on:refLine column is a valid correlation key", () => {
  it("a $line refLine column stays green — the main form must not miss it", () => {
    expect(validateModule(normalizeFixtureModule(release())).errors).toEqual([]);
  });

  it("`$line.id`(house itself) with `id`It's the same as usual.", () => {
    expect(codesOf(release("$line.id"))).not.toContain("PRECONDITION_ON_NOT_KEY");
    // `on: "id"` It's a single caliber.`plus` You're going to have to follow it back to your watch - to nail it with a non-line statement.
    const raw = release("id");
    const check = (raw.preconditions[0] as { check: Record<string, unknown> }).check;
    check["right"] = { value: 0 };
    check["plus"] = null;
    expect(codesOf(raw)).not.toContain("PRECONDITION_ON_NOT_KEY");
  });

  it("A companion of a fellow. `ref` Columns (indicating upstream** header**) are also identity coordinates - different particle sizes but all id", () => {
    expect(codesOf(release("$line.sourceOrderId"))).not.toContain("PRECONDITION_ON_NOT_KEY");
  });
});

describe("🔴 It's not a rejection of identity coordinates -- this kind of error is just a release.", () => {
  it("number of columns as associated keys ⇒PROCONDITION ON NOT KEY", () => {
    const report = validateModule(normalizeFixtureModule(release("$line.releaseQty")));
    expect(report.errors.map((e) => e.code)).toContain("PRECONDITION_ON_NOT_KEY");
    // it's a "symmetrical match," not a "negative type."
    // users need to know the consequences.
    const hit = report.errors.find((e) => e.code === "PRECONDITION_ON_NOT_KEY");
    expect(hit?.message).toContain("always passes");
    expect(hit?.path).toContain(".on");
  });

  it("🔴 `$line.lineNo` It's the same -- it's a platform column, the easiest to pass through between two gates.", () => {
    // line number is the only one in this list, not the only one: using it as a key counts in ** another ** line 1
    expect(codesOf(release("$line.lineNo"))).toContain("PRECONDITION_ON_NOT_KEY");
  });

  it("the column is only reported once when it does not exist (FIELD UNKNOWN), without a second NOT KEY", () => {
    const codes = codesOf(release("$line.sourceLineIdd"));
    expect(codes).toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
    expect(codes).not.toContain("PRECONDITION_ON_NOT_KEY");
  });
});

describe("the coordinates have to be out.", () => {
  it("🔴 Discribe says which alignment is by which -- \"cumulative\" is the sum of who, not a word before.", () => {
    const module: ModuleSchema = normalizeFixtureModule(release());
    const check = module.preconditions[0]?.check;
    expect(check).toBeTruthy();
    if (!check) return;
    const text = describeCheck(check, fieldLabelsOf(module, module.lifecycle.transitions[0]!));
    expect(text).toContain('aligned by "Source order line"');
    // the dimension of particle size is the same as usual.
    expect(text).toContain("Per detail line");
  });

  it("`$line.id` It's not about printing an interface. `id`", () => {
    const module = normalizeFixtureModule(release("$line.id"));
    const check = module.preconditions[0]?.check;
    if (!check) return;
    expect(describeCheck(check, fieldLabelsOf(module, module.lifecycle.transitions[0]!))).toContain("aligned by this line");
  });
});

describe("🔴 Coordinates are out of value", () => {
  const query: RuleQuery = {
    get: async () => null,
    list: async () => [],
    balance: async () => {
      throw new Error("this case must not query a balance");
    },
  };

  const decide = async (lines: readonly Record<string, unknown>[]) =>
    await evaluateTransition(
      {
        module: normalizeFixtureModule(release()),
        bill: { id: "r-1", status: "draft" },
        lines,
        params: {},
        actor: {},
        now: NOW,
        query,
      },
      "release",
    );

  it("refLine is empty and rejected and says which one.", async () => {
    const decision = await decide([{ id: "l-1", lineNo: 1, sourceLineId: null, orderQty: 10, releaseQty: 3 }]);
    const hit = decision.checks.find((c) => c.id === "qty_within_order_line");
    expect(hit?.ok).toBe(false);
    expect(hit?.detail).toContain("Source order line");
    expect(decision.verdict.pass).toBe(false);
  });

  it("it's always on the top parade.", async () => {
    const decision = await decide([{ id: "l-1", lineNo: 1, sourceLineId: "ol-1", orderQty: 10, releaseQty: 3 }]);
    const hit = decision.checks.find((c) => c.id === "qty_within_order_line");
    expect(hit?.ok).toBe(true);
  });

  it("this is a list that goes beyond the parade.", async () => {
    const decision = await decide([
      { id: "l-1", lineNo: 1, sourceLineId: "ol-1", orderQty: 10, releaseQty: 6 },
      { id: "l-2", lineNo: 2, sourceLineId: "ol-1", orderQty: 10, releaseQty: 6 },
    ]);
    const hit = decision.checks.find((c) => c.id === "qty_within_order_line");
    expect(hit?.ok).toBe(false);
  });
});
