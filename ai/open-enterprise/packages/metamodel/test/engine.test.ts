// ---------------------------------------------------------------------------
// engine - value for value versus billing
//
// it's a hard border ** mechanism**: a bank account is not allowed to fall before the user sees it.
// the premise is: ** Any path ** can go to the confirmation window, and Plan counts.
// once upon a time, the absence of the required parameters shorted the entire evaluateTransation, and Plan went with it.
// so there's only one word in the window that's "not counting yet," and the point is to be sure that it's going down in one breath.
// and Plan doesn't depend on parameters.
//
// using synthesizing modules instead of models in domains: models grow/leave parameters because of business adjustments.
// this non-variant has nothing to do with any specific business. Hanging on the template is putting the frame gate on the business statement.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  SchemaError,
  defineFixtureModule,
  evaluateTransition,
  evaluateCreatePreconditions,
  lineContextDemands,
  reversalSourceTransitions,
  transitionsReaching,
  type RuleQuery,
} from "../src/index.js";

const NO_DATA: RuleQuery = {
  get: async () => null,
  list: async () => [],
  balance: async () => {
    throw new Error("this case must not query a balance");
  },
};

const NOW = new Date("2026-07-29T00:00:00Z");

describe("create precondition", () => {
  const module = defineFixtureModule({
    code: "createGate",
    label: "Create-gate test document",
    domain: "demo",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "accountingMode", label: "Posting mode", type: "enum", required: true, options: [{ value: "total", label: "General ledger" }, { value: "detail", label: "Lines" }] },
      { key: "lines", label: "Lines", type: "subtable", ref: "createGateLine", fields: [{ key: "name", label: "Name", type: "string" }] },
    ],
    lifecycle: { statuses: [{ key: "new", label: "Create", initial: true, terminal: true }], transitions: [] },
    preconditions: [{
      id: "lines_required", onTransition: "*", onCreate: true, source: "invariant", level: "block",
      why: "Lines are required", check: { primitive: "lines_not_empty" },
    }],
    views: { list: { columns: ["code"] } },
  });
  it("the ledger and the details are blocked.", async () => {
    const blocked = await evaluateCreatePreconditions({ module, bill: { accountingMode: "detail" }, lines: [], actor: {}, now: NOW, query: NO_DATA });
    expect(blocked.verdict).toMatchObject({ pass: false, level: "block" });
    expect(blocked.checks[0]).toMatchObject({ id: "lines_required", ok: false });
    const allowed = await evaluateCreatePreconditions({ module, bill: { accountingMode: "total" }, lines: [], actor: {}, now: NOW, query: NO_DATA });
    expect(allowed.verdict).toMatchObject({ pass: false, level: "block" });
  });
});

const mutuallyExclusivePosting = defineFixtureModule({
  code: "exclusivePosting",
  label: "Mutually exclusive posting document",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    { key: "productId", label: "Product", type: "ref", ref: "product" },
    { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse" },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier" },
    { key: "amount", label: "Amount", type: "money", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "posted", label: "Posted", editable: "none" },
      { key: "reversed", label: "Reversed", terminal: true },
    ],
    transitions: [
      {
        code: "postReceivable",
        from: "draft",
        to: "posted",
        action: "Recognize receivable",
        effects: [{ target: "stock", op: "in", subject: "$bill.productId", scope: "$bill.warehouseId", amount: "{amount}", reverseOn: ["reverse"] }],
      },
      {
        code: "postPayable",
        from: "draft",
        to: "posted",
        action: "Recognize payable",
        effects: [{ target: "ap", op: "in", subject: "$bill.supplierId", amount: "{amount}", reverseOn: ["reverse"] }],
      },
      { code: "reverse", from: "posted", to: "reversed", action: "Reverse" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

describe("cross-checking of account branches: screening by real desk account source before deciphering reverse coordinates", () => {
  const base = { id: "x-1", status: "posted", code: "X-1", amount: 100 };

  it("the Declarion Level suggests which of the two sources should be checked.", () => {
    const reverse = mutuallyExclusivePosting.lifecycle.transitions.find((t) => t.code === "reverse");
    expect(reverse).toBeDefined();
    expect(reversalSourceTransitions(mutuallyExclusivePosting, reverse!)).toEqual([
      "postReceivable",
      "postPayable",
    ]);
  });

  it("the sales fact only resolves the branch receivable without touching the empty supplier coordinates.", async () => {
    const decision = await evaluateTransition(
      {
        module: mutuallyExclusivePosting,
        bill: { ...base, productId: "p-1", warehouseId: "wh-1", supplierId: null },
        lines: [],
        params: {},
        actor: {},
        now: NOW,
        query: NO_DATA,
        reversalSources: new Set(["postReceivable"]),
      },
      "reverse",
    );
    expect(decision.plan.reversals).toHaveLength(1);
    expect(decision.plan.reversals[0]).toMatchObject({
      fromTransition: "postReceivable",
      effect: { target: "stock", op: "out", subjectId: "p-1" },
    });
  });

  it("the fact of the procurement only analyzes the branch, not the client coordinates.", async () => {
    const decision = await evaluateTransition(
      {
        module: mutuallyExclusivePosting,
        bill: { ...base, productId: null, warehouseId: null, supplierId: "supplier-1" },
        lines: [],
        params: {},
        actor: {},
        now: NOW,
        query: NO_DATA,
        reversalSources: new Set(["postPayable"]),
      },
      "reverse",
    );
    expect(decision.plan.reversals).toHaveLength(1);
    expect(decision.plan.reversals[0]).toMatchObject({
      fromTransition: "postPayable",
      effect: { target: "ap", op: "out", subjectId: "supplier-1" },
    });
  });
});

/** A side with parameters and ** will pass ** — two conditions are missing, and this group of things cannot be measured. */
const withParams = defineFixtureModule({
  code: "shipment",
  label: "Shipping document",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "amount", label: "Amount", type: "money", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "done", label: "Shipped", terminal: true },
    ],
    transitions: [
      {
        code: "ship",
        from: "draft",
        to: "done",
        action: "Ship",
        params: [
          { key: "carrier", label: "Carrier", type: "text", required: true },
          { key: "occurredAt", label: "Occurred at", type: "text", required: true, hidden: true },
        ],
        effects: [{ target: "ap", op: "in", subject: "$bill.supplierId", amount: "{amount}", reverseOn: [] }],
      },
    ],
  },
  views: { list: { columns: ["code"] } },
});

const bill = { id: "s-1", status: "draft", code: "S-1", supplierId: "sup-1", amount: 3000 };

describe("missing mandatory parameters: a block-level conclusion, not an anomaly", () => {
  it("do not throw -- return to decision-making as usual, verdict is block", async () => {
    const decision = await evaluateTransition(
      { module: withParams, bill, lines: [], params: {}, actor: { id: "u1" }, now: NOW, query: NO_DATA },
      "ship",
    );
    const verdict = decision.verdict;
    expect(verdict.pass).toBe(false);
    if (verdict.pass) throw new Error("unreachable");
    expect(verdict.level).toBe("block");
    expect(verdict.message).toContain("Carrier");
  });

  it("🔴 Plan, you can count it anyway -- make sure the bullet window is able to put out the bill.", async () => {
    const decision = await evaluateTransition(
      { module: withParams, bill, lines: [], params: {}, actor: { id: "u1" }, now: NOW, query: NO_DATA },
      "ship",
    );
    expect(decision.plan.forward).toHaveLength(1);
    expect(decision.plan.forward[0]?.amount).toBe(3000);
    expect(decision.plan.forward[0]?.subjectId).toBe("sup-1");
  });

  it("checks on the missing item.", async () => {
    const decision = await evaluateTransition(
      { module: withParams, bill, lines: [], params: {}, actor: { id: "u1" }, now: NOW, query: NO_DATA },
      "ship",
    );
    const miss = decision.checks.find((c) => c.id === "params.carrier");
    expect(miss?.ok).toBe(false);
    expect(miss?.level).toBe("block");
    expect(decision.checks.find((c) => c.id === "params.occurredAt")).toBeUndefined();
  });

  it("once the parameters are filled, pass.", async () => {
    const decision = await evaluateTransition(
      {
        module: withParams,
        bill,
        lines: [],
        params: { carrier: "SF Express" },
        actor: { id: "u1" },
        now: NOW,
        query: NO_DATA,
      },
      "ship",
    );
    expect(decision.verdict.pass).toBe(true);
  });

  it("empty string and nuld count as unfilled - the front end sends empty input boxes to normal", async () => {
    for (const value of ["", null]) {
      const decision = await evaluateTransition(
        {
          module: withParams,
          bill,
          lines: [],
          params: { carrier: value },
          actor: { id: "u1" },
          now: NOW,
          query: NO_DATA,
        },
        "ship",
      );
      expect(decision.verdict.pass).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// could not close temporary folder: %s
//
// the HTTP layer is divided by type (packages/server/src/http/app.ts): SchemaError Z400 and the rest Z500.
// "This card is empty" is the fault of the caller. Naked Error will make the same type of document data incomplete.
// half the error was recorded as service failure - and stock sufficient's route (primitives.ts' coord Id)
// and to the same thing, SchemaError, which side of the same bad list decides whether it's 400 or 500.
// ---------------------------------------------------------------------------
describe("the file data is incomplete.", () => {
  const run = (over: Record<string, unknown>) =>
    evaluateTransition(
      {
        module: withParams,
        bill: { ...bill, ...over },
        lines: [],
        params: { carrier: "SF Express" },
        actor: { id: "u1" },
        now: NOW,
        query: NO_DATA,
      },
      "ship",
    );

  it("the fields cited by the subject are worthless", async () => {
    await expect(run({ supplierId: null })).rejects.toBeInstanceOf(SchemaError);
  });

  it("amount quoted fields are worthless", async () => {
    await expect(run({ amount: "" })).rejects.toBeInstanceOf(SchemaError);
  });
});

// ---------------------------------------------------------------------------
// when the blocker is blocked, you can't cover your mouth if you can't figure it out.
//
// the supplier of the purchase order was "unnecessary field + approve with required fields".
// the waiting list has not yet been directed to anyone who buys it; it must be selected prior to the review. When the supplier "approval approval" was empty, it was the first time that it was approved.
// Block Gate `supplier_required` This paper "Missing assigned Fields: Vendors"
// the term “effects [0].subject” quoted by “$bil.supplierId” has been thrown out by the crash project.
// short-range the entire edge - verdict / checks. The user only sees errors that are not readable.
//
// restored boundary:** only verdict is block** swallows the planEffects' SchemaError empty
//(This side is not going to be executed at all. Empty subject when verdict is pass is real
// error, still throwing SchemaError.
// ---------------------------------------------------------------------------
const withBlockGate = defineFixtureModule({
  code: "purchaseLike",
  label: "Purchase document",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    // it's not necessary to fill in: the next slip can be dropped empty before the block gate is cleared.
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier" },
    { key: "amount", label: "Amount", type: "money", required: true },
],
  lifecycle: {
    statuses: [
      { key: "pendingReview", label: "pendingReview", initial: true },
  { key: "awaitingReceipt", label: "awaitingReceipt", terminal: true },
    ],
    transitions: [
 {
        code: "approve",
        from: "pendingReview",
        to: "awaitingReceipt",
        action: "Approve",
    effects: [{ target: "ap", op: "in", subject: "$bill.supplierId", amount: "{amount}", reverseOn: [] }],
      },
    ],
  },
  preconditions: [
    {
      id: "supplier_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "An order with no supplier cannot be approved and cannot reserve a payable commitment",
      check: { primitive: "required_fields", fields: ["supplierId"] },
    },
  ],
  views: { list: { columns: ["code"] } },
});

describe("when the block is blocked, pass the account.", () => {
  const run = (over: Record<string, unknown>) =>
    evaluateTransition(
      {
        module: withBlockGate,
        bill: { id: "p-1", status: "pendingReview", code: "P-1", amount: 3000, ...over },
        lines: [],
  params: {},
  actor: { id: "u1" },
      now: NOW,
        query: NO_DATA,
      },
      "approve",
);

  it("provider empty: do not throw, return block verdict to human, plan empty", async () => {
    const decision = await run({ supplierId: null });
    expect(decision.verdict.pass).toBe(false);
    if (decision.verdict.pass) throw new Error("unreachable");
    expect(decision.verdict.level).toBe("block");
    // users see "missing required fields: suppliers" and not a word for an account.
    expect(decision.checks.find((c) => c.id === "supplier_required")?.message).toContain("Supplier");
 // you can't do it. You don't have to put it out.
    expect(decision.plan.forward).toEqual([]);
  });

  it("vendor completed: normal billed plan", async () => {
    const decision = await run({ supplierId: "s-1" });
    expect(decision.verdict.pass).toBe(true);
    expect(decision.plan.forward).toHaveLength(1);
    expect(decision.plan.forward[0]).toMatchObject({ subjectId: "s-1", op: "in" });
  });
});

// ---------------------------------------------------------------------------
// the necessities of the line context are long on the edge** and not on the module
//
// "Models have stated a few schedules" and "Whether this is an unmistakable collection of values."
// the ex-services treated them as one: as long as the module had two schedules, the value was rejected.
// `productionCostSheet`(6 column chain of evidence + Operations 3 pure distribution, merger will create
// Half a column of a constant table) every time you throw a preview / execute -- and its rules are not quoted. `$line.`。
//
// The decision must be read out of the statement: the rule on the side of the original language.`lines_not_empty` It's not a single line.
// it's just a collection, and it's like PlanEffects on the other side.
// ---------------------------------------------------------------------------

/** A module that posts per line. `$line.` resolves only when there is exactly one line table, so this fixture has one. */
const perLinePosting = defineFixtureModule({
  code: "picking",
  label: "Pick list",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse", required: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "pickingLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "picked", label: "Picked", editable: "none" },
      { key: "closed", label: "closed", terminal: true, editable: "none" },
    ],
    transitions: [
      {
        code: "pick",
        from: "draft",
        to: "picked",
        action: "Pick",
        effects: [
          {
            // Use `out` No need. `reserve`：`EFFECT_TARGET_OPS` It was rejected during the modelling period.
            // `stock reserve`(There is no symbol defining reserv,
            // “The amount of money set aside, the amount available has increased.” This is an example of a line-by-line account.
            // it has nothing to do with promises or facts.
            target: "stock",
            op: "out",
            subject: "$line.productId",
            scope: "$bill.warehouseId",
            amount: "{$line.qty}",
            reverseOn: ["close"],
          },
        ],
      },
      { code: "close", from: "picked", to: "closed", action: "Close" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

/*:: Two breakdowns: a completely different structure, a consolidation that produces a half-line table */
const twoSubtables = defineFixtureModule({
  code: "costSheet",
  label: "Cost sheet",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true },
    {
      key: "materialLines",
      label: "Material cost",
      type: "subtable",
      ref: "costSheetMaterialLine",
      fields: [
        { key: "productId", label: "Material", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Quantity consumed", type: "number", required: true },
      ],
    },
    {
      key: "operatingLines",
      label: "Operating cost",
      type: "subtable",
      ref: "costSheetOperatingLine",
      fields: [{ key: "amount", label: "Allocated amount", type: "money", required: true }],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "Being costed", initial: true },
      { key: "confirmed", label: "Confirmed", editable: "none" },
      { key: "archived", label: "Archived", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "confirm", from: "draft", to: "confirmed", action: "Confirm cost" },
      { code: "archive", from: "confirmed", to: "archived", action: "Archive" },
    ],
  },
  preconditions: [
    {
      id: "has_lines",
      onTransition: "archive",
      source: "gate",
      level: "block",
      why: "Archiving must keep cost lines that can be reviewed",
      check: { primitive: "lines_not_empty" },
    },
  ],
  views: { list: { columns: ["code"] } },
});

describe("lineContextDemands: Do you read the line on this side?", () => {
  const pick = perLinePosting.lifecycle.transitions.find((t) => t.code === "pick")!;
  const close = perLinePosting.lifecycle.transitions.find((t) => t.code === "close")!;
  const archive = twoSubtables.lifecycle.transitions.find((t) => t.code === "archive")!;
  const confirm = twoSubtables.lifecycle.transitions.find((t) => t.code === "confirm")!;

  it("read it by line.", () => {
    expect(lineContextDemands(perLinePosting, pick)).toEqual(["this edge's effects[0] (posts per line)"]);
  });

  it("🔴 Zero effects for yourself, but to roll back to the line-by-line side.", () => {
    // just assume that "efficts" will miss the whole rolling side, and that's the kind of counter-censorship/closure. Side
    expect(lineContextDemands(perLinePosting, close)).toEqual([
      'edge "pick" effects[0] (declared to be reversed by this edge, per line)',
    ]);
  });

  it("🔴 Lines not empty is not quoted in any of the rows, but the verdict is a collection -- read it anyway.", () => {
    expect(lineContextDemands(twoSubtables, archive)).toEqual(['precondition "has_lines"']);
  });

  it("🔴 Two schedules plus neither line-by-line nor line-by-line side = no reading = such edges should not be rejected", () => {
    expect(lineContextDemands(twoSubtables, confirm)).toEqual([]);
  });

});

// ---------------------------------------------------------------------------
// one rule doesn't count. Only one won't pass.
//
// it's the same discipline as the "lack of mandatory parameters is a block-level conclusion, not an anomaly" above.
// the one tube parameter, the rule is worth it.
//
// there was no per-rule segregation in the previous rule cycle: any one of the rules was thrown out (the most common form — can crash empty fields)
// gt/gte/lt/lte, such sort of sorting comparison, the empty value is not comparable) will make evaluateTransion a whole short circuit.
// **verdict / checks / plan not together**. The result is more than just this click failure: the modeler's so
// it is no longer the case that the field should be downgraded to an optional filling, and the expected draft is common in real business.
// ---------------------------------------------------------------------------

/** The promise date is not earlier than the order date. `promiseDate` is optional, which is the premise of the case. */
function dateRule(level: "warn" | "block" | "route"): ReturnType<typeof defineFixtureModule> {
  const moduleCode = { warn: "datedWarn", block: "datedBlock", route: "datedRoute" }[level];
  return defineFixtureModule({
    code: moduleCode,
    label: "A document with a promise date",
    domain: "demo",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "orderDate", label: "Order date", type: "date", required: true },
      // 🔴 Selection: the draft phase is expected to be real business
      { key: "promiseDate", label: "Promise date", type: "date" },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "submitted", label: "Submitted" },
        { key: "exception", label: "Exception", terminal: true },
        { key: "done", label: "completed", terminal: true },
      ],
      transitions: [
        { code: "submit", from: "draft", to: "submitted", action: "Submit", primary: true,
          ...(level === "route" ? { } : {}) },
        { code: "submit_exception", from: "draft", to: "exception", action: "Exceptional submit" },
        { code: "finish", from: "submitted", to: "done", action: "Complete", primary: true },
      ],
    },
    preconditions: [
      {
        id: "promise_after_order",
        onTransition: "submit",
        source: "gate",
        level,
        ...(level === "route" ? { exit: "submit_exception" } : {}),
        message: "Promise date is before the order date",
        why: "A promise date before the order date is usually a typo",
        check: { primitive: "field_compare", left: { ref: "$bill.promiseDate" }, op: "gte", right: { ref: "$bill.orderDate" } },
      },
    ],
    views: { list: { columns: ["code"] } },
  });
}

const blankDraft = { id: "d-1", status: "draft", code: "D-1", orderDate: "2026-08-04", promiseDate: null };

describe("🔴 Rule for value throws: the sentence is not passed and the whole side is not lost", () => {
  it("do not throw -- return to decision-making as usual", async () => {
    const decision = await evaluateTransition(
      { module: dateRule("warn"), bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    expect(decision.checks).toHaveLength(1);
    expect(decision.plan).toBeDefined();
  });

  it("🔴 It's not like it's going through.", async () => {
    const decision = await evaluateTransition(
      { module: dateRule("block"), bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    const hit = decision.checks[0];
    expect(hit?.ok).toBe(false);
    expect(decision.verdict.pass).toBe(false);
  });

  it("checks can tell which one, why not?", async () => {
    const decision = await evaluateTransition(
      { module: dateRule("warn"), bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    const hit = decision.checks[0];
    expect(hit?.id).toBe("promise_after_order");
    expect(hit?.detail).toContain("cannot be evaluated");
    // half: Unfilled, no original name, no field.
    expect(hit?.detail).toContain("\"Promise date\" is blank");
    expect(hit?.detail).not.toContain("promiseDate");
    expect(hit?.detail).not.toContain("field_compare");
  });

  it("🔴 `unevaluated` Dissociate \"no\" from \"no\"", async () => {
    const module = dateRule("warn");
    const broken = await evaluateTransition(
      { module, bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    expect(broken.checks[0]?.unevaluated).toBe(true);
    // when it really doesn't work, unevaluated must be false -- otherwise this tag is undisguised. Power
    const inverted = { ...blankDraft, promiseDate: "2026-07-01" };
    const real = await evaluateTransition(
      { module, bill: inverted, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    expect(real.checks[0]?.ok).toBe(false);
    expect(real.checks[0]?.unevaluated).toBe(false);
  });

  it("do not replace message when you can't figure it out -- the phrase says \"business failure.\"", async () => {
    const module = dateRule("warn");
    const broken = await evaluateTransition(
      { module, bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    expect(broken.checks[0]?.detail).not.toContain("Promise date is before the order date");
    // the other way around: when it really doesn't work, the business has to be there.
    const real = await evaluateTransition(
      { module, bill: { ...blankDraft, promiseDate: "2026-07-01" }, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    const verdict = real.verdict;
    if (verdict.pass) throw new Error("unreachable");
    expect(verdict.message).toBe("Promise date is before the order date");
  });

  it("🔴 Route does not count down to block -- don't translate \"I can't judge\" into \"go outside.\"", async () => {
    const module = dateRule("route");
    const broken = await evaluateTransition(
      { module, bill: blankDraft, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    expect(broken.checks[0]?.level).toBe("block");
    const verdict = broken.verdict;
    if (verdict.pass) throw new Error("unreachable");
    expect(verdict.level).toBe("block");

    // the reverse: Change the course when it's really set up -- this downgrading is only about failure. Expenditure
    const real = await evaluateTransition(
      { module, bill: { ...blankDraft, promiseDate: "2026-07-01" }, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      "submit",
    );
    const routed = real.verdict;
    if (routed.pass || routed.level !== "route") throw new Error("unreachable");
    expect(routed.exit).toBe("submit_exception");
  });

  it("fill in the dues and pass them as usual - Select fields no longer render the entire edge unusable", async () => {
    const decision = await evaluateTransition(
      {
        module: dateRule("block"),
        bill: { ...blankDraft, promiseDate: "2026-09-01" },
        lines: [],
        params: {},
        actor: {},
        now: NOW,
        query: NO_DATA,
      },
      "submit",
    );
    expect(decision.verdict.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 🔴 `transitionsReaching` - The other half of "candidacy demands that it be in a state": where to turn it into that state?
//
// g-01 hit the gold chain.
// "Stutus in progress" It exists, but it does not meet the conditions of this category. Please re-elect one."
// and the user does not have a second option — the real thing to do is go to the "process task" one time.
// this information has always come out, but no one has ever counted it.
// ---------------------------------------------------------------------------

const withStates = defineFixtureModule({
  code: "processTaskLike",
  label: "Operation task",
  domain: "demo",
  fields: [{ key: "code", label: "Document number", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "awaitingDispatch", label: "Awaiting assignment", initial: true },
      { key: "inProgress", label: "inProgress" },
      { key: "completed", label: "completed", terminal: true },
      { key: "cancelled", label: "cancelled", terminal: true },
    ],
    transitions: [
      { code: "assign", from: "awaitingDispatch", to: "inProgress", action: "Dispatch order operations" },
      { code: "reassign", from: "inProgress", to: "inProgress", action: "Reassign" },
      { code: "finish", from: "inProgress", to: "completed", action: "Complete" },
      { code: "cancel", from: "awaitingDispatch", to: "cancelled", action: "Cancel" },
    ],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code"] }] },
});

describe("transactions Reaching: the condition of the candidacy, which is where it will be met", () => {
  it("it's turning the record into the edge of that state.", () => {
    expect(transitionsReaching(withStates, ["inProgress"]).map((a) => a.transitions.map((t) => t.action))).toEqual([
      ["Dispatch order operations"],
    ]);
  });

  it("🔴 It doesn't count from the ring -- it can't move a record that's not there yet, and it's going to send people to a button he can't push. Let's go.", () => {
    // `reassign` Yes, in Progress → in Progress: for a record of a "work-in-worker" the button is not at all there.
    const actions = transitionsReaching(withStates, ["inProgress"])[0]?.transitions.map((t) => t.code) ?? [];
    expect(actions).not.toContain("reassign");
  });

  it("if you can't get there, you can't drop it.", () => {
    expect(transitionsReaching(withStates, ["awaitingDispatch"])).toEqual([{ status: "awaitingDispatch", transitions: [] }]);
  });

  it("it's a model error, check CrossReferences during the build period. Red", () => {
    expect(transitionsReaching(withStates, ["missingStatus"])).toEqual([{ status: "missingStatus", transitions: [] }]);
  });

  it("ask more than one state at a time and answer one by one (array = in)", () => {
    expect(transitionsReaching(withStates, ["inProgress", "completed"]).map((a) => a.status)).toEqual(["inProgress", "completed"]);
  });
});

// ---------------------------------------------------------------------------
// 🔴 "I can't go" has to be said with "what can I go now"?
//
// Symptoms on the scene (KDocs#144 / #146): angent three rounds in a row against the same list Fire! `submit`The service always returns.
// the starting point for the "submit" is "draft" and the document is currently in "pendingreview". That's right, but it's just negative.
// no direction -- the caller did not know which side to press, so he mistook the failure as his own id, retrace and hit again.
//
// you can go side by side in the same function, on the same statement. Quit saying that.
// in exchange, each state of discomfort goes around one more circle.
// ---------------------------------------------------------------------------
describe("assertTranstionAtStatus: Say where you can walk when you're in a bad state.", () => {
  const at = (status: string, code: string) =>
    evaluateTransition(
      { module: withStates, bill: { id: "t-1", status, code: "T-1" }, lines: [], params: {}, actor: {}, now: NOW, query: NO_DATA },
      code,
    );

  it("report the edges that can be pressed in the current state, with action names and code", async () => {
    // no finish on "to-be"; press assign and cancel
    await expect(at("awaitingDispatch", "finish")).rejects.toThrow(/What can be done now: "Dispatch order operations" \(assign\), "Cancel" \(cancel\)/);
  });

  it("turns out the negative was the same -- the new one was the next, not the other.", async () => {
    await expect(at("awaitingDispatch", "finish")).rejects.toThrow(/This document is "Awaiting assignment" and cannot "Complete" \(finish\)/);
  });

  it("🔴 Self-rounded in \"what can be done now\" -- it's a really moving button in this state.", async () => {
    await expect(at("inProgress", "assign")).rejects.toThrow(/What can be done now: "Reassign" \(reassign\), "Complete" \(finish\)/);
  });

  it("the final word for \"no walkable operation\" is not an empty \"what can be done now\"", async () => {
    await expect(at("completed", "assign")).rejects.toThrow(/This document has no actions available right now/);
  });
});
