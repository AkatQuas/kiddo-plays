// ---------------------------------------------------------------------------
// Conditional `Precondition.when` "A record to be passed, B not to be judged."
//
// Up here. `AGENTS.md` "The same category appears twice" and the production area ** hit three times:
//   • The workshop must be superior to the factory ** without a superior ** (forced to break into both sides)
//   • This is the way to report that the front track is cumulatively qualified and the first ** has no way forward **
//   • No change in the line of work that already exists... ..and no line of work.
//
// none of the three semantics can be reversed, and none of them ** have symptoms**:
//   I.`when` This gate is not applicable. `skipped` The pass -- not "through";
//   II.`when` ** Not counting** ** ** ** As usual**. It's the worst kind.
//      an unworthy guard will shut off the block gate quietly;
//   iII. Not applicable gates** still appear in checks**. "Sometimes it doesn't play."
//      and that doesn't have any symptoms, and the users have no expectations.
//
// The second half of the nail is... `$line.id`"Is every line of upstream consumed downstream?"
// previously, it had only been reduced to a single caliber - and that was not the same gate (one full, one single line, and one single line).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  evaluateTransition,
  fieldLabelsOf,
  gateOf,
  normalizeFixtureModule,
  resolvePreconditions,
  validateModule,
  type ModuleSchema,
  type RuleQuery,
} from "../src/index.js";

const NOW = new Date("2026-08-04T00:00:00Z");

const NO_DATA: RuleQuery = {
  get: async () => null,
  list: async () => [],
  balance: async () => {
    throw new Error("this case must not query a balance");
  },
};

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

/*:: Organization tree: the plant is root and has no superiors; the remaining three levels must be up and down. */
function org(when: unknown = { primitive: "field_compare", left: { ref: "$bill.orgType" }, op: "ne", right: { value: "factory" } }): Raw {
  return structuredClone({
    code: "org",
    label: "Production organization",
    domain: "manufacturing",
    fields: [
      { key: "code", label: "Code", type: "string", primary: true },
      { key: "name", label: "Name", type: "string" },
      { key: "orgType", label: "Organization type", type: "enum", options: [
        { value: "factory", label: "Plant" },
        { value: "workshop", label: "Workshop" },
        { value: "line", label: "Line" },
        { value: "team", label: "Team" },
      ], required: true },
      { key: "parentId", label: "Parent organization", type: "ref", ref: "org" },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "active", label: "Take effect", color: "green", terminal: true },
      ],
      transitions: [{ code: "activate", from: "draft", to: "active", action: "Take effect" }],
    },
    preconditions: [
      {
        id: "parent_required",
        onTransition: "activate",
        source: "invariant",
        level: "block",
        why: "The plant is the root of the organization tree; the other three levels must hang under the level above",
        // 🔴 The guard said, "When is this gate set up?"
        when,
        check: { primitive: "field_compare", left: { ref: "$bill.parentId" }, op: "ne", right: { value: null } },
      },
    ],
    views: { list: { columns: ["code", "name", "orgType"] } },
  }) as Raw;
}

function schemaOf(raw: Raw): ModuleSchema {
  const module = normalizeFixtureModule(raw);
  const report = validateModule(module);
  expect(report.errors).toEqual([]);
  return module;
}

async function decide(bill: Record<string, unknown>, raw: Raw = org()): ReturnType<typeof evaluateTransition> {
  return await evaluateTransition(
    { module: schemaOf(raw), bill, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
    "activate",
  );
}

describe("precondition.whon: Conditional", () => {
  it("guards are for real justice as usual. The workshop didn't fill in.", async () => {
    const decision = await decide({ id: "o-1", status: "draft", orgType: "workshop", parentId: null });
    const hit = decision.checks.find((check) => check.id === "parent_required");
    expect(hit?.ok).toBe(false);
    expect(hit?.skipped).toBe(false);
    expect(decision.verdict.pass).toBe(false);
  });

  it("🔴 The guards are fakes not applicable. The factory has no superiors, and it's working. Side", async () => {
    const decision = await decide({ id: "o-2", status: "draft", orgType: "factory", parentId: null });
    const hit = decision.checks.find((check) => check.id === "parent_required");
    expect(hit?.skipped).toBe(true);
    expect(decision.verdict.pass).toBe(true);
  });

  it("Not applicable`skipped` and `ok` Break it up, detail.", async () => {
    const decision = await decide({ id: "o-2", status: "draft", orgType: "factory", parentId: null });
    const hit = decision.checks.find((check) => check.id === "parent_required");
    // okay, true. But Skipped said "no amount at all."
    expect(hit?.ok).toBe(true);
    expect(hit?.detail).toContain("Not applicable this time");
    // what does the guard figure out?
    expect(hit?.detail).toContain("factory");
  });

  it("🔴 The unapplicable gates are still in checks, not disappear.", async () => {
    const decision = await decide({ id: "o-2", status: "draft", orgType: "factory", parentId: null });
    expect(decision.checks.map((check) => check.id)).toContain("parent_required");
    // rule, you have to say the terms or the readers will think it's unconditional.
    const hit = decision.checks.find((check) => check.id === "parent_required");
    expect(hit?.rule).toContain("Only when");
    expect(hit?.rule).toContain("Organization type");
  });

  it("🔴 Guards can't count, ** as usual**, not skip.", async () => {
    // `gte` The impact value will be thrown.`orderable` It's not gonna work.
    const raw = org({ primitive: "field_compare", left: { ref: "$bill.name" }, op: "gte", right: { value: 1 } });
    const decision = await decide({ id: "o-3", status: "draft", orgType: "workshop", parentId: null, name: null }, raw);
    const hit = decision.checks.find((check) => check.id === "parent_required");
    expect(hit?.skipped).toBe(false);
    expect(hit?.ok).toBe(false);
    expect(decision.verdict.pass).toBe(false);
  });

  it("the contract level also needs to state the terms - ex plain / tool catalogue / interface 3", () => {
    const module = schemaOf(org());
    const [resolved] = resolvePreconditions(module, "activate");
    expect(resolved).toBeDefined();
    if (!resolved) return;
    const gate = gateOf(resolved.rule, null, fieldLabelsOf(module, module.lifecycle.transitions[0]!));
    expect(gate.rule.startsWith("Only when ")).toBe(true);
    expect(gate.rule).toContain(": ");
    // labels: The contract says "organization type", not "orgType"
    expect(gate.rule).toContain("Organization type");
  });

  it("no, when the locks remain the same.", () => {
    const raw = org();
    (raw.preconditions[0] as Record<string, unknown>)["when"] = null;
    const module = schemaOf(raw);
    const [resolved] = resolvePreconditions(module, "activate");
    if (!resolved) return;
    expect(gateOf(resolved.rule, null, fieldLabelsOf(module, module.lifecycle.transitions[0]!)).rule).not.toContain("Only when");
  });
});

describe("🔴 `when` Closed set: accept zero IO field compare", () => {
  it("the original language will be rejected and the reason given.", () => {
    expect(() =>
      normalizeFixtureModule(
        org({
          primitive: "ref_field_compare",
          via: "parentId",
          entity: "org",
          through: null,
          field: "orgType",
          op: "eq",
          right: { value: "factory" },
        }),
      ),
    ).toThrow(/when accepts only field_compare/);
  });

  it("give it to me when and without checking and rejecting it.", () => {
    const raw = org();
    delete (raw.preconditions[0] as Record<string, unknown>)["check"];
    expect(() => normalizeFixtureModule(raw)).toThrow(/guarding a door that does not exist/);
  });

  it("🔴 The name of the guard's field is also subject to static verification -- a misspelled gate that never works.", () => {
    const raw = org({ primitive: "field_compare", left: { ref: "$bill.orgTyp" }, op: "ne", right: { value: "factory" } });
    const report = validateModule(normalizeFixtureModule(raw));
    expect(report.errors.map((error) => error.code)).toContain("PRECONDITION_FIELD_UNKNOWN");
    // What's your location? `.when` Nope. `.check` - The wrong place is the right thing to do.
    expect(report.errors.some((error) => error.path.endsWith(".when"))).toBe(true);
  });

  it("guards are not allowed to quote $line.", () => {
    expect(() =>
      normalizeFixtureModule(org({ primitive: "field_compare", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } })),
    ).toThrow(/\$line/);
  });
});

// Platform line fields:`$line.id` ───────────────────────────────────────────────────

describe("🔴 `$line.id` / `$line.lineNo` You can do the bond key for the compressor.", () => {
  /** "Is every line upstream consumed downstream?" * Previously, it had to be a whole caliber */
  function upstream(on: string): Raw {
    return structuredClone({
      code: "upOrder",
      label: "Upstream document",
      domain: "sales",
      fields: [
        { key: "code", label: "Number", type: "string", primary: true },
        {
          key: "lines",
          label: "Lines",
          type: "subtable",
          ref: "upOrderLine",
          fields: [
            { key: "productId", label: "Product", type: "ref", ref: "upOrder", required: true },
            { key: "qty", label: "Quantity", type: "number", required: true },
          ],
        },
      ],
      lifecycle: {
        statuses: [
          { key: "draft", label: "draft", initial: true },
          { key: "done", label: "completed", color: "green", terminal: true },
        ],
        transitions: [{ code: "finish", from: "draft", to: "done", action: "Complete" }],
      },
      preconditions: [
        {
          id: "each_line_consumed",
          onTransition: "finish",
          source: "gate",
          level: "block",
          why: "Every line must be consumed downstream",
          check: {
            primitive: "related_agg",
            from: "upOrder",
            through: "lines",
            match: "productId",
            on,
            agg: "sum",
            measure: "qty",
            where: null,
            op: "gte",
            right: { ref: "$line.qty" },
            plus: null,
          },
        },
      ],
      views: { list: { columns: ["code"] } },
    }) as Raw;
  }

  const codesOf = (on: string): string[] => validateModule(normalizeFixtureModule(upstream(on))).errors.map((e) => e.code);

  it("`$line.id` Validate by static -- it's a platform line field that by definition is not allowed to declare, but both are in the reading model.", () => {
    expect(codesOf("$line.id")).not.toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
  });

  it("`$line.lineNo` Also adopted", () => {
    expect(codesOf("$line.lineNo")).not.toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
  });

  it("🔴 The mouth is closed only: misspelled columns are still rejected, and only the two platform line fields are mentioned", () => {
    expect(codesOf("$line.nosuch")).toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
    const report = validateModule(normalizeFixtureModule(upstream("$line.nosuch")));
    const hit = report.errors.find((error) => error.code === "PRECONDITION_LINE_FIELD_UNKNOWN");
    expect(hit?.message).toContain("nosuch");
    expect(hit?.message).toContain("id / lineNo");
  });

  it("🔴 `$line.billId` It's not in the list -- it's a conduit, and it's judged on every line.", () => {
    expect(codesOf("$line.billId")).toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
  });
});
