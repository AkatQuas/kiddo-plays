/**
 * formula (dive.kind = = "formula").
 *
 * three things have been nailed to each other: ** Shape gate (normalizeExpr), ** Simulation gate**
 * (ForMULA* for Validate Modeule),** for running period** (evaluateFormula).
 * three layers are different — shapes that are not quoted correctly, and quotations that are not counted.
 */
import { describe, expect, it } from "vitest";
import {
  describeFormula,
  evaluateFormula,
  evaluateFormulaOrNull,
  normalizeExpr,
  normalizeFixtureModule,
  validateModule,
  type Expr,
} from "../src/index.js";

/*:: Real formula for sales order lines: quantity x unit price x (1 - discount %100) and discount space not to be played Decline */
const LINE_AMOUNT: Expr = {
  op: "mul",
  args: [
    { field: "qty" },
    { field: "price" },
    {
      op: "sub",
      args: [
        { value: 1 },
        { op: "div", args: [{ orElse: { of: { field: "discount" }, whenEmpty: 0 } }, { value: 100 }] },
      ],
    },
  ],
};

// model: report obtained from the gate and not thrown —
//
// in the last few years, I’ve been able to use the word ‘normalize’ Modeule + validateModule instead of defineFixture Module: the latter is dropped in the first place.
// here's a complete list of the “which gates did the statement step on”.

const LIFECYCLE = {
  statuses: [
    { key: "draft", label: "draft", color: "gray", initial: true },
    { key: "completed", label: "completed", color: "green", terminal: true },
  ],
  transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
};

const VIEWS = {
  list: { columns: ["code"], filters: [], searchable: ["code"] },
  form: [{ title: "Basics", fields: ["code"] }],
};

/*:: Build a module with only tablehead fields and return the code list from the gate */
function codesOf(fields: readonly Record<string, unknown>[]): readonly string[] {
  const module = normalizeFixtureModule({
    code: "demoFormula",
    label: "Formula demo",
    domain: "sales",
    fields: [{ key: "code", label: "Document number", type: "string", required: true, primary: true }, ...fields],
    lifecycle: LIFECYCLE,
    views: VIEWS,
  });
  return validateModule(module).errors.map((e) => e.code);
}

/*:: Ibid., but fields are placed in the column of the table */
function lineCodesOf(columns: readonly Record<string, unknown>[]): readonly string[] {
  const module = normalizeFixtureModule({
    code: "demoFormula",
    label: "Formula demo",
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", required: true, primary: true },
      { key: "totalQty", label: "Total quantity", type: "number" },
      { key: "lines", label: "Lines", type: "subtable", ref: "demoFormulaLine", fields: columns },
    ],
    lifecycle: LIFECYCLE,
    views: VIEWS,
  });
  return validateModule(module).errors.map((e) => e.code);
}

const money = (key: string, expr: Expr): Record<string, unknown> => ({
  key,
  label: key,
  type: "money",
  derive: { kind: "formula", expr },
});

// for the purposes of —

describe("evaluateFormula", () => {
  it("correct value by declaration", () => {
    expect(evaluateFormula(LINE_AMOUNT, { qty: 200, price: 86.5, discount: 5 })).toBeCloseTo(16_435, 6);
  });

  it("empty values dropped by orElse as default -- discounts are not paid or discounts are not paid", () => {
    expect(evaluateFormula(LINE_AMOUNT, { qty: 1200, price: 3.2, discount: null })).toBeCloseTo(3840, 6);
    expect(evaluateFormula(LINE_AMOUNT, { qty: 1200, price: 3.2, discount: "" })).toBeCloseTo(3840, 6);
    // the key doesn't exist. It's the same as the visible nulla.
    expect(evaluateFormula(LINE_AMOUNT, { qty: 1200, price: 3.2 })).toBeCloseTo(3840, 6);
  });

  // ♪ This is the key decision of this one: no one will throw away outside or Else ♪ `?? 0`。
  // the result is that there's a normal zero on the books, and nothing's going to be reported. Wrong.
  it("fields are worthless and dropped without returning 0", () => {
    expect(() => evaluateFormula(LINE_AMOUNT, { price: 86.5, discount: 5 })).toThrow(/qty/);
    expect(() => evaluateFormula(LINE_AMOUNT, { qty: 1, price: null })).toThrow(/price/);
    expect(() => evaluateFormula(LINE_AMOUNT, { qty: 1, price: "" })).toThrow(/price/);
  });

  it("if it's not a number, throw it.", () => {
    expect(() => evaluateFormula(LINE_AMOUNT, { qty: 1, price: "Expensive" })).toThrow(/expected a number/);
    expect(() => evaluateFormula(LINE_AMOUNT, { qty: 1, price: { n: 1 } })).toThrow(/expected a number/);
  });

  it("boolean is 0/1 in the formula.", () => {
    const expr = { op: "mul" as const, args: [{ field: "qty" }, { field: "on" }] };
    expect(evaluateFormula(expr, { qty: 10, on: true })).toBe(10);
    expect(evaluateFormula(expr, { qty: 10, on: false })).toBe(0);
  });

  it("numeric columns are counted as string arrivals -- that is a difference, not a deficiency", () => {
    expect(evaluateFormula({ op: "mul", args: [{ field: "qty" }, { field: "price" }] }, { qty: "40", price: "128" })).toBe(5120);
  });

  it("the division counts as 0 in the run-up period and throws -- divided by zero without value, not zero, not infinite.", () => {
    const expr: Expr = { op: "div", args: [{ field: "a" }, { field: "b" }] };
    expect(() => evaluateFormula(expr, { a: 1, b: 0 })).toThrow(/divisor is 0/);
  });

  it("four calculations and max: add / Mul / max multiple, sub / div", () => {
    expect(evaluateFormula({ op: "add", args: [{ value: 1 }, { value: 2 }, { value: 3 }] }, {})).toBe(6);
    expect(evaluateFormula({ op: "sub", args: [{ value: 10 }, { value: 4 }] }, {})).toBe(6);
    expect(evaluateFormula({ op: "div", args: [{ value: 10 }, { value: 4 }] }, {})).toBe(2.5);
    expect(evaluateFormula({ op: "max", args: [{ value: 0 }, { value: -5000 }] }, {})).toBe(0);
  });
});

describe("evaluateFormulaOrNull", () => {
  // edit period: The newly added line qty / price is empty. The "uncountable" is not a mistake.
  // but it has to be full, not zero-zero, and it'll be combined as a real zero.
  it("enter to nul, no 0", () => {
    expect(evaluateFormulaOrNull(LINE_AMOUNT, { qty: null, price: null })).toBeNull();
    expect(evaluateFormulaOrNull(LINE_AMOUNT, { qty: 2, price: null })).toBeNull();
  });

  it("when you fill it out, it's the usual.", () => {
    expect(evaluateFormulaOrNull(LINE_AMOUNT, { qty: 40, price: 128, discount: 10 })).toBeCloseTo(4608, 6);
  });

  it("there's only one thing that's loose -- the type's wrong, the zero.", () => {
    expect(() => evaluateFormulaOrNull(LINE_AMOUNT, { qty: 1, price: "Expensive" })).toThrow(/expected a number/);
    expect(() => evaluateFormulaOrNull({ op: "div", args: [{ field: "a" }, { value: 0 }] }, { a: 1 })).toThrow();
  });
});

// the explanation, the explanation, the explanation, the explanation.

describe("describeFormula", () => {
  it("render adult words with brackets.", () => {
    expect(describeFormula(LINE_AMOUNT)).toBe("qty × price × (1 - discount (empty counts as 0) ÷ 100)");
  });

  it("subtracts from the same level / Except for Right Operations - a - (b - c) not a - b - c", () => {
    const expr: Expr = { op: "sub", args: [{ field: "a" }, { op: "sub", args: [{ field: "b" }, { field: "c" }] }] };
    expect(describeFormula(expr)).toBe("a - (b - c)");
  });

  it("high-priority sub-sets without redundant brackets", () => {
    const expr: Expr = { op: "add", args: [{ field: "a" }, { op: "mul", args: [{ field: "b" }, { field: "c" }] }] };
    expect(describeFormula(expr)).toBe("a + b × c");
  });

  it("maximum Render to Function Call", () => {
    const expr: Expr = { op: "max", args: [{ value: 0 }, { field: "outstanding" }] };
    expect(describeFormula(expr)).toBe("max(0, outstanding)");
  });
});

// shape gates (time of loading), —

describe("normalizeExpr", () => {
  it("there's only one of the four forms.", () => {
    expect(() => normalizeExpr({ field: "qty", value: 1 }, "e")).toThrow(/must be one of/);
    expect(() => normalizeExpr({}, "e")).toThrow(/must be one of/);
  });

  it("unknown algorithms are not allowed", () => {
    expect(() => normalizeExpr({ op: "pow", args: [{ value: 2 }, { value: 3 }] }, "e")).toThrow(/unknown/);
  });

  // there are two readings. Instead of choosing one, we should reject it during the modelling period.
  it("sub / div happens to be two dollars, add / Mul / max at least two dollars", () => {
    expect(() => normalizeExpr({ op: "sub", args: [{ value: 1 }, { value: 2 }, { value: 3 }] }, "e")).toThrow(/exactly/);
    expect(() => normalizeExpr({ op: "add", args: [{ value: 1 }] }, "e")).toThrow(/at least/);
    expect(() => normalizeExpr({ op: "max", args: [{ value: 1 }] }, "e")).toThrow(/at least/);
  });

  it("the font must be limited -- string expression is not an entry to the system", () => {
    expect(() => normalizeExpr({ value: "qty * price" }, "e")).toThrow(/finite number/);
    expect(() => normalizeExpr({ value: Number.POSITIVE_INFINITY }, "e")).toThrow(/finite number/);
  });

  it("the key of the orElse is closed, whereEmpty must be a number", () => {
    expect(() => normalizeExpr({ orElse: { of: { field: "d" } } }, "e")).toThrow(/finite number/);
    expect(() => normalizeExpr({ orElse: { of: { field: "d" }, whenEmpty: 0, extra: 1 } }, "e")).toThrow(/unknown key/);
  });
});

// 

describe("formula Gate", () => {
  it("quote numeric fields at the same level - legal declaration does not report any errors", () => {
    expect(
      lineCodesOf([
        { key: "qty", label: "Quantity", type: "number", required: true, primary: true },
        { key: "price", label: "Unit price", type: "money", required: true },
        { key: "discount", label: "Discount", type: "percent" },
        money("amount", LINE_AMOUNT),
      ]),
    ).toEqual([]);
  });

  it("references to non-existent fields rejected", () => {
    expect(codesOf([money("net", { op: "mul", args: [{ field: "ghost" }, { value: 2 }] })])).toContain(
      "FORMULA_FIELD_UNKNOWN",
    );
  });

  // 🔴 The formula is only for the same line. There's no basis for "qty from which line" when the header asks for value.
  it("cross-tiered references rejected: cross-references to table header fields", () => {
    expect(
      lineCodesOf([
        { key: "qty", label: "Quantity", type: "number", required: true, primary: true },
        money("bad", { op: "mul", args: [{ field: "totalQty" }, { value: 2 }] }),
      ]),
    ).toContain("FORMULA_FIELD_UNKNOWN");
  });

  it("cross-layered references rejected: table-head formula quote line", () => {
    const module = normalizeFixtureModule({
      code: "demoFormula",
      label: "Formula demo",
      domain: "sales",
      fields: [
        { key: "code", label: "Document number", type: "string", required: true, primary: true },
        money("bad", { op: "mul", args: [{ field: "qty" }, { value: 2 }] }),
        {
          key: "lines",
          label: "Lines",
          type: "subtable",
          ref: "demoFormulaLine",
          fields: [{ key: "qty", label: "Quantity", type: "number", required: true }],
        },
      ],
      lifecycle: LIFECYCLE,
      views: VIEWS,
    });
    expect(validateModule(module).errors.map((e) => e.code)).toContain("FORMULA_FIELD_UNKNOWN");
  });

  it("references to non-value fields rejected", () => {
    expect(
      codesOf([
        { key: "remark", label: "Remark", type: "text" },
        money("bad", { op: "mul", args: [{ field: "remark" }, { value: 2 }] }),
      ]),
    ).toContain("FORMULA_FIELD_NOT_NUMERIC");
  });

  it("boolean fields can be multiplied - 0/1 for value", () => {
    expect(
      lineCodesOf([
        { key: "qty", label: "Quantity", type: "number", required: true, primary: true },
        { key: "on", label: "Switch", type: "bool" },
        money("net", { op: "mul", args: [{ field: "qty" }, { field: "on" }] }),
      ]),
    ).toEqual([]);
  });

  // the formula calculates the number. The field carrying it was not a numerical type, so it went back to the disease of the year: it was worth nothing.
  it("the field of the load formula itself must be a numerical type", () => {
    expect(
      codesOf([
        { key: "qty", label: "Quantity", type: "number" },
        {
          key: "bad",
          label: "Text",
          type: "string",
          derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { value: 2 }] } },
        },
      ]),
    ).toContain("FORMULA_RESULT_NOT_NUMERIC");
  });

  it("self-reference rejected", () => {
    expect(codesOf([money("loop", { op: "mul", args: [{ field: "loop" }, { value: 2 }] })])).toContain(
      "FORMULA_SELF_REFERENCE",
    );
  });

  // a-Quote B, B-Quote A: None of the values in the ring can be counted and the claim never ends
  it("the ring is rejected.", () => {
    const codes = codesOf([
      money("a", { op: "mul", args: [{ field: "b" }, { value: 2 }] }),
      money("b", { op: "mul", args: [{ field: "a" }, { value: 3 }] }),
    ]);
    expect(codes).toContain("FORMULA_CYCLE");
  });

  it("it's legal to quote another formula field, but not a ring.", () => {
    const codes = codesOf([
      { key: "qty", label: "Quantity", type: "number" },
      money("a", { op: "mul", args: [{ field: "qty" }, { value: 2 }] }),
      money("b", { op: "mul", args: [{ field: "a" }, { value: 3 }] }),
    ]);
    expect(codes).toEqual([]);
  });

  it("we'll divide it by zero.", () => {
    expect(codesOf([money("bad", { op: "div", args: [{ value: 1 }, { value: 0 }] })])).toContain(
      "FORMULA_DIV_BY_ZERO",
    );
  });

  it("it's a deep-seated zero.", () => {
    const expr: Expr = {
      op: "add",
      args: [{ value: 1 }, { orElse: { of: { op: "div", args: [{ value: 5 }, { value: 0 }] }, whenEmpty: 0 } }],
    };
    expect(codesOf([money("bad", expr)])).toContain("FORMULA_DIV_BY_ZERO");
  });

  // the derivative field cannot be filled out by the user, the label is used only to kill the file card. Formula treated with rollup / lookup
  it("formula field label rejected", () => {
    const codes = codesOf([
      { key: "qty", label: "Quantity", type: "number" },
      { ...money("amount", { op: "mul", args: [{ field: "qty" }, { value: 2 }] }), required: true },
    ]);
    expect(codes).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });
});

// $actor quotes —, —
//
// 🔴 `$bill.` There's Precondition FIELD UNKNOWN round.`$actor.` There was no search.
// wrong key to undefined, more constant, a block-level rule** never passed**--
// and it looks like "business has got the rules in place" and doesn't spell it wrong.

describe("$actor key", () => {
  const withCheck = (check: Record<string, unknown>): readonly string[] => {
    const module = normalizeFixtureModule({
      code: "demoActor",
      label: "Operator demo",
      domain: "sales",
      fields: [
        { key: "code", label: "Document number", type: "string", required: true, primary: true },
        {
          key: "lines",
          label: "Lines",
          type: "subtable",
          ref: "demoActorLine",
          fields: [{ key: "qty", label: "Quantity", type: "number" }],
        },
      ],
      lifecycle: LIFECYCLE,
      preconditions: [
        { id: "who", onTransition: "done", source: "gate", level: "block", why: "Only a supervisor can press this", check },
      ],
      views: VIEWS,
    });
    return validateModule(module).errors.map((e) => e.code);
  };

  it("$actor.roll rejected -- identity group rolls, no single value", () => {
    expect(
      withCheck({ primitive: "field_compare", left: { ref: "$actor.role" }, op: "eq", right: { value: "warehouse-manager" } }),
    ).toContain("PRECONDITION_ACTOR_KEY_UNKNOWN");
  });

  it("check the correct description of the post: a post belongs to an active.roll", () => {
    expect(
      withCheck({ primitive: "field_compare", left: { value: "warehouse-manager" }, op: "in", right: { ref: "$actor.roles" } }),
    ).toEqual([]);
  });

  it("the keys to the quarantine axis are released.", () => {
    expect(
      withCheck({ primitive: "field_compare", left: { ref: "$actor.userId" }, op: "ne", right: { value: "" } }),
    ).toEqual([]);
  });

  it("the same thing can be found in the lines all.", () => {
    expect(
      withCheck({ primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { ref: "$actor.quota" } }),
    ).toContain("PRECONDITION_ACTOR_KEY_UNKNOWN");
  });

  it("lines any Walks the same $line field static verification", () => {
    expect(
      withCheck({ primitive: "lines_any", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } }),
    ).not.toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
    expect(
      withCheck({ primitive: "lines_any", left: { ref: "$line.unknownQty" }, op: "gt", right: { value: 0 } }),
    ).toContain("PRECONDITION_LINE_FIELD_UNKNOWN");
  });
});
