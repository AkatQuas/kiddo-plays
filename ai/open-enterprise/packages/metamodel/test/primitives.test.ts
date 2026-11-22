import { describe, expect, it } from "vitest";
import {
  checkDependencies,
  compare,
  describeCheck,
  evaluateCheck,
  normalizeCheck,
  type FieldLabels,
  type RuleContext,
  type RuleQuery,
} from "../src/index.js";

// this group uses only examples of compare / field compare, and none of them should be checked for balance.
// `balance` It's not about giving it away. `async () => 0`: Returns 0 will make errors like "superstock released"
// it's done in the test.
const NO_DATA: RuleQuery = {
  get: async () => null,
  list: async () => [],
  balance: async () => {
    throw new Error("this case must not query a balance");
  },
};

/**
 * This list of examples. It's true. `fieldLabelsOf` Calculating from the module statement; here handwritten,
 * It's used to nail "the word on the form is wrong" *`required_fields` Previously reported fields.
 * the key that is not in the table returns to the key itself: platform fields (status / orgId) do not have labels written by the modeler, but they are not written by the modeler.
 :: Reporting `status` The right answer, not the cover.
 */
const LABELS: FieldLabels = {
  bill: { warehouseId: "Shipping warehouse", promiseDate: "Promise date", totalAmount: "Order amount" },
  line: { qty: "Quantity", productId: "Product" },
  param: { reason: "Rejection reason" },
};

function ctxOf(bill: Record<string, unknown>): RuleContext {
  return {
    bill,
    lines: [],
    params: {},
    actor: { id: "u1" },
    labels: LABELS,
    now: new Date("2026-07-29T00:00:00Z"),
    query: NO_DATA,
  };
}

describe("the details are empty.", () => {
  it("just because there's no detail in the structure, there's no way you're gonna get around it.", async () => {
    const check = normalizeCheck({ primitive: "lines_empty" });
    await expect(evaluateCheck(check, ctxOf({}))).resolves.toMatchObject({ ok: true });

    const withOffsettingLines: RuleContext = {
      ...ctxOf({}),
      lines: [{ amount: 100 }, { amount: -100 }],
    };
    await expect(evaluateCheck(check, withOffsettingLines)).resolves.toMatchObject({
      ok: false,
      detail: "still has 2 detail lines",
    });
    expect(describeCheck(check, LABELS)).toBe("Detail lines must be left empty");
  });
});

describe("the fact that you have to fill out the details.", () => {
  const check = normalizeCheck({
    primitive: "lines_required_if_ref_field",
    via: "payableId",
    entity: "purchasePayable",
    field: "accountingMode",
    values: ["detail"],
  });

  const context = (
    accountingMode: string | null,
    lines: readonly Readonly<Record<string, unknown>>[] = [],
    payableId: unknown = "payable-1",
  ): RuleContext => ({
    ...ctxOf({ payableId }),
    lines,
    query: {
      ...NO_DATA,
      get: async () => accountingMode === null ? null : { accountingMode },
    },
  });

  it("disclaimer when detailed settlement is not made, pass when detailed", async () => {
    await expect(evaluateCheck(check, context("detail"))).resolves.toMatchObject({
      ok: false,
      detail: expect.stringContaining("There are no detail lines"),
    });
    await expect(evaluateCheck(check, context("detail", [{ orderId: "order-1" }]))).resolves.toMatchObject({
      ok: true,
    });
  });

  it("total settlement allows no details of payments", async () => {
    await expect(evaluateCheck(check, context("total"))).resolves.toMatchObject({ ok: true });
  });

  it("could not close temporary folder: %s", async () => {
    await expect(evaluateCheck(check, context("detail", [], null))).resolves.toMatchObject({ ok: false });
    await expect(evaluateCheck(check, context(null))).resolves.toMatchObject({ ok: false });
    await expect(evaluateCheck(check, {
      ...context("detail"),
      query: { ...NO_DATA, get: async () => ({ accountingMode: null }) },
    })).resolves.toMatchObject({ ok: false });
  });

  it("reliance on projection to both state the reference, external field and line Set", () => {
    expect(checkDependencies(check)).toMatchObject({
      billFields: ["payableId"],
      externalFields: [{ module: "purchasePayable", field: "accountingMode" }],
      usesLines: true,
    });
  });
});

describe("size comparison: date by time value, not Number() ratio", () => {
  // this is the real form of value extraction in production: the date of Postgres is read by Drizzle-orm/postgres-js.
  it("\"YYYY-MM-DD\" string on both sides", () => {
    expect(compare("2026-02-10", "gte", "2026-02-01")).toBe(true);
    expect(compare("2026-02-10", "gte", "2026-02-10")).toBe(true);
    expect(compare("2026-01-31", "gte", "2026-02-01")).toBe(false);
    expect(compare("2026-01-31", "lt", "2026-02-01")).toBe(true);
    expect(compare("2026-02-01", "gt", "2026-02-01")).toBe(false);
    expect(compare("2026-02-01", "lte", "2026-02-01")).toBe(true);
  });

  it("undegraded throughout the year into string or numerical comparisons", () => {
    // number() is both NAN; the dictionary is right on both of them, so the real rule is the next example.
    expect(compare("2026-01-05", "lt", "2026-11-05")).toBe(true);
    expect(compare("2025-12-31", "lt", "2026-01-01")).toBe(true);
  });

  it("iSO Timestamps: Orders between different moments of the same day", () => {
    expect(compare("2026-02-10T09:00:00Z", "lt", "2026-02-10T17:30:00Z")).toBe(true);
    expect(compare("2026-02-10T17:30:00.500Z", "gt", "2026-02-10T17:30:00Z")).toBe(true);
    // time zone deviation: 08:00 + 08:00 is the same time as 00:00 Z, not the same time
    expect(compare("2026-02-10T08:00:00+08:00", "lte", "2026-02-10T00:00:00Z")).toBe(true);
    expect(compare("2026-02-10T08:00:00+08:00", "gte", "2026-02-10T00:00:00Z")).toBe(true);
  });

  it("date Object Sides", () => {
    expect(compare(new Date("2026-02-10"), "gte", new Date("2026-02-01"))).toBe(true);
    expect(compare(new Date("2026-01-31"), "gte", new Date("2026-02-01"))).toBe(false);
  });

  it("date can be compared to a string -- it's normal to meet in the same rule for both values.", () => {
    expect(compare(new Date("2026-02-10"), "gte", "2026-02-01")).toBe(true);
    expect(compare("2026-02-10", "gte", new Date("2026-02-10"))).toBe(true);
    expect(compare("2026-01-31", "gt", new Date("2026-02-01"))).toBe(false);
    expect(compare(new Date("2026-02-10T09:00:00Z"), "lt", "2026-02-10T17:00:00Z")).toBe(true);
  });

  it("the numbers are still on the same page.", () => {
    expect(compare(100, "gt", 0)).toBe(true);
    expect(compare(9, "gt", 10)).toBe(false);
    expect(compare("100.5", "gte", 100)).toBe(true);
    expect(compare(-1, "lt", 0)).toBe(true);
  });
});

describe("fail-fast border for size comparison", () => {
  it("date versus number -- silent conversion only produces meaningless truths.", () => {
    expect(() => compare("2026-02-10", "gte", 0)).toThrow(/cannot be compared/);
    expect(() => compare(100, "lt", new Date("2026-02-10"))).toThrow(/cannot be compared/);
  });

  it("it looks like a date, but it can't be solved.", () => {
    expect(() => compare("2026-13-45", "gte", "2026-02-01")).toThrow(/is not a valid date/);
    expect(() => compare(new Date("nonsense"), "gte", "2026-02-01")).toThrow(/is not a valid date/);
  });

  it("wrong: Say \"not numbers\" and bring the actual value.", () => {
    expect(() => compare("abc", "gt", 1)).toThrow(/is not a number \(actual "abc"\)/);
    // "2026" is not a date form: There's no day in a pure year when numbers compare to the only way it makes sense.
    expect(compare("2026", "gt", 2025)).toBe(true);
  });

  /**
   * 🔴 Empty and non-number**. The effect of combining the words "not numbers" is that:
   * an empty value field (the most common input omission) is reported as a type error, and the next step for the user is to
   * go fill that out, not check the data type. The two categories of next steps are different and cannot be combined -
   :: With `UNIQUE_DUPLICATE`(400) / `UniqueViolationError`(409) is the same discipline.
   */
  it("no: \"Not filled in,\" not \"not numbers.\"", () => {
    for (const blank of [null, undefined, ""]) {
      expect(() => compare(blank, "gte", 0)).toThrow(/is blank/);
      expect(() => compare(blank, "gte", 0)).not.toThrow(/is not a number/);
    }
  });

  it("🔴 eq/ne Null press is EmttyValue: Empty string is the same as null Yes.", () => {
    // an empty plan with a detailed manual order in UI might be ""and the library is "nuld" -- and it's wrong to say "done."
    expect(compare("", "eq", null)).toBe(true);
    expect(compare(undefined, "eq", null)).toBe(true);
    expect(compare(null, "eq", null)).toBe(true);
    expect(compare("plan-line-1", "eq", null)).toBe(false);
    expect(compare("", "ne", null)).toBe(false);
    expect(compare("plan-line-1", "ne", null)).toBe(true);
  });
});

describe("date comparison on field compare", () => {
  const check = normalizeCheck({
    primitive: "field_compare",
    left: { ref: "$bill.promiseDate" },
    op: "gte",
    right: { ref: "$bill.orderDate" },
  });

  it("not earlier than the date of the order", async () => {
    const outcome = await evaluateCheck(check, ctxOf({ orderDate: "2026-02-01", promiseDate: "2026-02-10" }));
    expect(outcome.ok).toBe(true);
  });

  it("no, and detail has two actual dates", async () => {
    const outcome = await evaluateCheck(check, ctxOf({ orderDate: "2026-02-10", promiseDate: "2026-02-01" }));
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("2026-02-01");
    expect(outcome.detail).toContain("2026-02-10");
  });
});

describe("ref field compare: In the same language overwhelm tablehead references and line source facts", () => {
  it("line by Line Read destination details and bind right value to the current line", async () => {
    const calls: Array<readonly [string, unknown, string | null | undefined]> = [];
    const sourceLines: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
      "sol-1": { productId: "p-1", netPrice: 12.5 },
      "sol-2": { productId: "p-2", netPrice: 8 },
    };
    const query: RuleQuery = {
      get: async (entity, id, through) => {
        calls.push([entity, id, through]);
        return sourceLines[String(id)] ?? null;
      },
      list: async () => [],
      balance: async () => {
        throw new Error("this case must not query a balance");
      },
    };
    const check = normalizeCheck({
      primitive: "ref_field_compare",
      via: "$line.orderLineId",
      entity: "salesOrder",
      through: "lines",
      field: "productId",
      op: "eq",
      right: { ref: "$line.productId" },
    });
    const ctx: RuleContext = {
      ...ctxOf({}),
      lines: [
        { orderLineId: "sol-1", productId: "p-1" },
        { orderLineId: "sol-2", productId: "p-tampered" },
      ],
      query,
    };

    const outcome = await evaluateCheck(check, ctx);
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("line 2");
    expect(outcome.detail).toContain('"p-2"');
    expect(outcome.detail).toContain('"p-tampered"');
    expect(calls).toEqual([
      ["salesOrder", "sol-1", "lines"],
      ["salesOrder", "sol-2", "lines"],
    ]);
  });

  it("line-by-line zero-closed instead of empty cycle constant", async () => {
    const check = normalizeCheck({
      primitive: "ref_field_compare",
      via: "$line.orderLineId",
      entity: "salesOrder",
      through: "lines",
      field: "netPrice",
      op: "eq",
      right: { ref: "$line.price" },
    });
    const outcome = await evaluateCheck(check, ctxOf({}));
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("has no detail lines");
  });

  it("old nud field via is still read with a header reference", async () => {
    const query: RuleQuery = {
      get: async (entity, id, through) => {
        expect([entity, id, through]).toEqual(["customer", "c-1", null]);
        return { status: "Enabled" };
      },
      list: async () => [],
      balance: async () => {
        throw new Error("this case must not query a balance");
      },
    };
    const check = normalizeCheck({
      primitive: "ref_field_compare",
      via: "customerId",
      entity: "customer",
      field: "status",
      op: "eq",
      right: { value: "Enabled" },
    });
    const outcome = await evaluateCheck(check, { ...ctxOf({ customerId: "c-1" }), query });
    expect(outcome.ok).toBe(true);
  });
});

describe("🔴 In / not in's failed case, do not turn the claim against the facts.", () => {
  /**
   * every role/post gate in this warehouse is this pattern: I got a group of ** rolls, no single value,
   * So it says, "Is he the head of the warehouse?" `"warehouse-manager" ∈ $actor.roles`—
   * the left is requested**, the right is a fact**, contrary to the rest of the comparator.
   */
  const roleGate = normalizeCheck({
    primitive: "field_compare",
    left: { value: "warehouse-manager" },
    op: "in",
    right: { ref: "$actor.roles" },
  });

  it("it says, \"You're asked to have a store manager and you're actually a salesman,\" not the other way around.", async () => {
    const ctx = { ...ctxOf({}), actor: { userId: "u1", roles: ["salesperson"] } };
    const outcome = await evaluateCheck(roleGate, ctx);
    expect(outcome.ok).toBe(false);
    // the fact that that half had to hang on rolls. The old "warehouse-manager" is actually "warehouse-manager".
    // the claim belongs to ["salesperson"] -- it turns it into a fact, and it reads, "What is needed is a salesman."
    expect(outcome.detail).toBe(
      'requires "warehouse-manager" in "Actor roles", while "Actor roles" is actually ["salesperson"]',
    );
  });

  it("not in homogeneity: who is on the black list?", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { value: "blocked" },
      op: "not_in",
      right: { ref: "$actor.roles" },
    });
    const outcome = await evaluateCheck(check, { ...ctxOf({}), actor: { roles: ["blocked"] } });
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("not in");
    expect(outcome.detail).toContain("is actually");
  });

  it("the shape of the rest of the comparator remains unchanged - in / not in, the fixation narrows itself (all names go labels)", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.totalAmount" },
      op: "lte",
      right: { value: 100 },
    });
    const outcome = await evaluateCheck(check, ctxOf({ totalAmount: 200 }));
    expect(outcome.detail).toBe("Order amount is 200, required not greater than 100");
  });
});

describe("🔴 The original name is not allowed in the error report, and the field is not allowed - the user cannot find the two words on the interface", () => {
  /** A nullable number hitting `> 0`: the most common missed cell on a completion-receipt line. */
  const positiveQty = normalizeCheck({
    primitive: "lines_all",
    left: { ref: "$line.qty" },
    op: "gt",
    right: { value: 0 },
  });

  it("the empty numerics say, \"What's in the line? \"", async () => {
    const ctx = { ...ctxOf({}), lines: [{ qty: 5 }, { qty: null }] };
    // two generations of old writing: "lines all left is not a number, not a comparison."
    // 2 "qty" in line 2 is not filled in.
    await expect(evaluateCheck(positiveQty, ctx)).rejects.toThrow(/line 2 "Quantity" is blank/);
    await expect(evaluateCheck(positiveQty, ctx)).rejects.not.toThrow(/qty/);
    await expect(evaluateCheck(positiveQty, ctx)).rejects.not.toThrow(/lines_all/);
  });

  it("\"Unfilled\" is separated from \"misfilled\" -- the next move is not the same.", async () => {
    const ctx = { ...ctxOf({}), lines: [{ qty: "three" }] };
    await expect(evaluateCheck(positiveQty, ctx)).rejects.toThrow(/is not a number \(actual "three"\)/);
  });

  it("table header field homogeneity: not to mention field name", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.totalAmount" },
      op: "gt",
      right: { value: 0 },
    });
    await expect(evaluateCheck(check, ctxOf({ totalAmount: null }))).rejects.toThrow(
      /"Order amount" is blank/,
    );
    await expect(evaluateCheck(check, ctxOf({ totalAmount: null }))).rejects.not.toThrow(/field_compare/);
  });

  it("when the date is not the same as the date, the name of each side is the same.", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.promiseDate" },
      op: "gte",
      right: { value: 3 },
    });
    await expect(evaluateCheck(check, ctxOf({ promiseDate: "2026-08-04" }))).rejects.toThrow(
      /"Promise date" is a date, and the value compared with "Promise date" is a non-date/,
    );
  });
});

describe("lines any: At least one line meets the same line-by-line comparison compact", () => {
  const hasPositiveQty = normalizeCheck({
    primitive: "lines_any",
    left: { ref: "$line.qty" },
    op: "gt",
    right: { value: 0 },
  });

  it("any line passed, indicating which line to hit.", async () => {
    const outcome = await evaluateCheck(hasPositiveQty, {
      ...ctxOf({}),
      lines: [{ qty: 0 }, { qty: 3 }, { qty: -1 }],
    });
    expect(outcome).toEqual({ ok: true, detail: "line 2 satisfies: Quantity must be greater than 0" });
  });

  it("no hits and empty details", async () => {
    await expect(evaluateCheck(hasPositiveQty, {
      ...ctxOf({}),
      lines: [{ qty: 0 }, { qty: -1 }],
    })).resolves.toEqual({ ok: false, detail: "No detail line satisfies: Quantity must be greater than 0" });
    await expect(evaluateCheck(hasPositiveQty, ctxOf({}))).resolves.toEqual({
      ok: false,
      detail: "No detail line satisfies: Quantity must be greater than 0",
    });
  });

  it("do not swallow subsequent dirty data because the previous line was hit.", async () => {
    await expect(evaluateCheck(hasPositiveQty, {
      ...ctxOf({}),
      lines: [{ qty: 3 }, { qty: null }],
    })).rejects.toThrow(/line 2 "Quantity" is blank/);
  });

  it("explain the use of existential terms, not impersonating each line", () => {
    expect(describeCheck(hasPositiveQty, LABELS)).toBe("At least one line's Quantity must be greater than 0");
  });
});

describe("relaid agg: This contribution is grouped by source coordinates", () => {
  it("when the same source line is split into two rows, the two rows are combined instead of the respective ceiling", async () => {
    const check = normalizeCheck({
      primitive: "related_agg",
      from: "salesDelivery",
      through: "lines",
      match: "orderLineId",
      on: "$line.orderLineId",
      agg: "sum",
      measure: "qty",
      where: { status: "shipped" },
      op: "lte",
      right: { ref: "$line.orderQty" },
      plus: { ref: "$line.qty" },
    });
    const listed: unknown[] = [];
    const query: RuleQuery = {
      get: async () => null,
      list: async (_module, filters) => {
        listed.push(filters);
        return [];
      },
      balance: async () => {
        throw new Error("This source-line case must not query a balance");
      },
    };

    const outcome = await evaluateCheck(check, {
      ...ctxOf({}),
      lines: [
        { orderLineId: "order-line-1", orderQty: 10, qty: 6 },
        { orderLineId: "order-line-1", orderQty: 10, qty: 6 },
      ],
      query,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("this document 12");
    expect(listed).toEqual([{ orderLineId: "order-line-1", status: "shipped" }]);
  });
});

describe("relayed agg agg =min: barrel principle (not more than the smallest number of completed processes)", () => {
  /*:: Production domain prod-064 shape: process lines are least qualified and the individual inventory must not exceed it */
  const minCheck = (over: Record<string, unknown> = {}) =>
    normalizeCheck({
      primitive: "related_agg",
      from: "processTask",
      through: null,
      match: "productionOrderId",
      on: "productionOrderId",
      agg: "min",
      measure: "qualifiedQty",
      where: null,
      op: "gte",
      right: { ref: "$bill.qty" },
      plus: null,
      ...over,
    });

  const rowsOf = (rows: readonly Record<string, unknown>[]): RuleQuery => ({
    get: async () => null,
    list: async () => rows,
    balance: async () => {
      throw new Error("this case must not query a balance");
    },
  });

  it("the minimum is not the last, not the sum.", async () => {
    // the three processes were reported 120/ 80/ 150 respectively - the upper limit is 80, not 150 (last) or 350 (and)
    const ctx = {
      ...ctxOf({ productionOrderId: "po-1", qty: 100 }),
      query: rowsOf([{ qualifiedQty: 120 }, { qualifiedQty: 80 }, { qualifiedQty: 150 }]),
    };
    const outcome = await evaluateCheck(minCheck(), ctx);
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("80");
    // together with the last one, it's going to pass, and either one of them has to drift past. Red
    expect(outcome.detail).not.toContain("350");
  });

  it("the amount of inventory passed when inside the panel", async () => {
    const ctx = {
      ...ctxOf({ productionOrderId: "po-1", qty: 80 }),
      query: rowsOf([{ qualifiedQty: 120 }, { qualifiedQty: 80 }]),
    };
    expect((await evaluateCheck(minCheck(), ctx)).ok).toBe(true);
  });

  it("🔴 Empty-closed and human: inappropriate 0, inappropriate infinity", async () => {
    const ctx = { ...ctxOf({ productionOrderId: "po-1", qty: 1 }), query: rowsOf([]) };
    const outcome = await evaluateCheck(minCheck(), ctx);
    // as +----------- and--and---and---and---and--and--and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and-and and and and and and and and and and and and, and, and, and, and, and, and and, and and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and, and and, and, and, and, and, and, and, and, and, and, and, and, and, and, you, you, you,
    expect(outcome.ok).toBe(false);
    // consider it a lie. Users follow it and report nothing.
    expect(outcome.detail).not.toContain(" is 0");
    expect(outcome.detail).toContain("has none");
  });

  it("empty line set equally rejected -- fail-closed without looking at the comparator direction in this type of reverse comparison", async () => {
    const ctx = { ...ctxOf({ productionOrderId: "po-1", qty: 1 }), query: rowsOf([]) };
    const outcome = await evaluateCheck(minCheck({ op: "lte" }), ctx);
    expect(outcome.ok).toBe(false);
  });

  it("the empty line set of sum is still 0 (plus units) and the empty line set of Min is \"no value\"", async () => {
    const ctx = { ...ctxOf({ productionOrderId: "po-1", qty: 1 }), query: rowsOf([]) };
    const sum = normalizeCheck({
      primitive: "related_agg",
      from: "processTask",
      through: null,
      match: "productionOrderId",
      on: "productionOrderId",
      agg: "sum",
      measure: "qualifiedQty",
      where: null,
      op: "gte",
      right: { value: 0 },
      plus: null,
    });
    expect((await evaluateCheck(sum, ctx)).ok).toBe(true);
  });

  it("🔴 plus: The same key is added under sum, can only be small under min, cannot be distinguished above the declaration", () => {
    expect(() => minCheck({ plus: { ref: "$bill.qty" } })).toThrow(/plus must be null/);
    // inverse: sum accepts plus, as usual, this limit is narrow min
    expect(() => minCheck({ agg: "sum", plus: { ref: "$bill.qty" } })).not.toThrow();
  });

  it("min must be given measure, count still does not accept measure", () => {
    expect(() => minCheck({ measure: null })).toThrow(/min requires measure/);
    expect(() => minCheck({ agg: "count", measure: "qualifiedQty" })).toThrow(/count does not accept measure/);
  });

  it("describe is talking about \"minimal\" not \"total\" -- the same sentence for people and angent.", () => {
    expect(describeCheck(minCheck(), LABELS)).toContain("minimum");
    expect(describeCheck(minCheck(), LABELS)).not.toContain("total");
  });
});

// ---------------------------------------------------------------------------
// 🔴 The failed case is itself a bug's family.
//
// common shape of the four screenshots: the judgement is correct,** the statement** is not human. There are three kinds of problems:
//   1 The right number does not print it -- "not greater than 0," and the 0 is the write-off of upstream invoices
//   2 Empty as `null` - "Every line of planning must be equal to the nulla."
//   not to mention which record -- "the status of the procurement plan is "draft" was read as "my list is a draft."
//
// Case one: 13 Reused with the same `expectationText`It's kernel. `isEmptyValue`
// (with `compare` eq/ne branch, writing verification, required fields, the same), this document does not write a second word.
// ---------------------------------------------------------------------------

describe("🔴 One, the right number is the quote. You have to tell me what it's called at the same time.", () => {
  it("field compare: Threshold from another cell of this list, which one to say", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.totalAmount" },
      op: "lte",
      right: { ref: "$bill.creditLimit" },
    });
    const labels: FieldLabels = { ...LABELS, bill: { ...LABELS.bill, creditLimit: "Credit limit" } };
    const ctx = { ...ctxOf({ totalAmount: 200, creditLimit: 100 }), labels };
    const outcome = await evaluateCheck(check, ctx);
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toBe("Order amount is 200, required not greater than \"Credit limit\" (100)");
  });

  it("word threshold print-in-the-same -- this fix-up narrows the reference to the slot and does not create a source for constants", async () => {
    const check = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.totalAmount" },
      op: "lte",
      right: { value: 100 },
    });
    expect((await evaluateCheck(check, ctxOf({ totalAmount: 200 }))).detail).toBe("Order amount is 200, required not greater than 100");
  });

  it("relaid agg: original sentence for WB-BUG-75 - \"not greater than 0\" to read \"not greater than \"invoice amount\" (0)", async () => {
    // the "0" is not "0 dollars required by the system" but "0 per cent written off from the upstream invoice".
    // when the numbers are printed, the user changes the amount of his list, and what he should do is to review the invoice.
    const check = normalizeCheck({
      primitive: "related_agg",
      from: "purchasePayment",
      through: null,
      match: "invoiceId",
      on: "invoiceId",
      agg: "sum",
      measure: "totalAmount",
      where: { status: "Paid" },
      op: "lte",
      right: { ref: "$bill.invoiceAmount" },
      plus: { ref: "$bill.totalAmount" },
    });
    const labels: FieldLabels = { ...LABELS, bill: { ...LABELS.bill, invoiceAmount: "Invoice amount" } };
    const query: RuleQuery = {
      get: async () => null,
      list: async () => [],
      balance: async () => {
        throw new Error("this case must not query a balance");
      },
    };
    const outcome = await evaluateCheck(check, {
      ...ctxOf({ invoiceId: "inv-1", invoiceAmount: 0, totalAmount: 10 }),
      labels,
      query,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toBe(
      'purchasePayment totalAmount total is 10 (existing 0 + this document 10), required not greater than "Invoice amount" (0)',
    );
    // old text: "... not greater than zero" - a threshold with no provenance Value
    expect(outcome.detail).not.toMatch(/required not greater than 0$/);
  });
});

describe("🔴 2 \"is equal to nulla\" to \"leave this box.\"", () => {
  /*:: Original form of WB-BUG-68: an empty plan line for hand-orders, with a lock on "This line cannot hang a plan line" */
  const noPlanLine = normalizeCheck({
    primitive: "lines_all",
    left: { ref: "$line.planLineId" },
    op: "eq",
    right: { value: null },
  });
  const labels: FieldLabels = { ...LABELS, line: { ...LABELS.line, planLineId: "Plan line" } };

  it("describe does not appear Null again - none of the values called Null can be filled on the interface", () => {
    const rule = describeCheck(noPlanLine, labels);
    expect(rule).toBe("Every line's Plan line must be empty (leave this cell blank)");
    expect(rule).not.toContain("null");
  });

  it("the failed file only refers to those lines that are not qualified, without repeating \"every line.\"", async () => {
    const ctx = { ...ctxOf({}), labels, lines: [{ planLineId: null }, { planLineId: "pl-1" }] };
    const outcome = await evaluateCheck(noPlanLine, ctx);
    expect(outcome.ok).toBe(false);
    // old text: "No, line 2 is not enough: the plan line in each line must be equal to the nuld" -- the range is wrong with the word.
    expect(outcome.detail).toBe("line 2 does not satisfy: Plan line must be empty (leave this cell blank)");
  });

  it("the reverse case, ne empty, says the cell cannot be left blank", () => {
    const mustHave = normalizeCheck({
      primitive: "lines_all",
      left: { ref: "$line.planLineId" },
      op: "ne",
      right: { value: "" },
    });
    expect(describeCheck(mustHave, labels)).toBe("Every line's Plan line must have a value (this cell cannot be left blank)");
  });

  it("I'll give you the kernel.`isEmptyValue`: Empty string and null is the same thing, 0 is not empty", () => {
    const eqZero = normalizeCheck({
      primitive: "field_compare",
      left: { ref: "$bill.totalAmount" },
      op: "eq",
      right: { value: 0 },
    });
    // it'll be a completely normal gate.
    expect(describeCheck(eqZero, LABELS)).toBe("Order amount must be equal to 0");
  });

  it("The non-empty value still carries the original citation -- the status list of the stop `\\\"key\\\"` This pattern is in Chinese.", () => {
    const active = normalizeCheck({
      primitive: "ref_field_compare",
      via: "customerId",
      entity: "customer",
      field: "status",
      op: "eq",
      right: { value: "active" },
    });
    expect(describeCheck(active, LABELS)).toContain('must be equal to "active"');
  });
});

describe("🔴 3 Ref field compare says, \"What record is it?\"", () => {
  const planApproved = normalizeCheck({
    primitive: "ref_field_compare",
    via: "$line.planId",
    entity: "purchasePlan",
    field: "status",
    op: "eq",
    right: { value: "approved" },
  });
  const labels: FieldLabels = { ...LABELS, line: { ...LABELS.line, planId: "Purchase plan" } };
  const query: RuleQuery = {
    get: async () => ({ status: "draft", warehouseId: "wh-bj" }),
    list: async () => [],
    balance: async () => {
      throw new Error("this case must not query a balance");
    },
  };

  it("the main word is \"the one that points up the line,\" not \"me.\"", async () => {
    const outcome = await evaluateCheck(planApproved, { ...ctxOf({}), labels, query, lines: [{ planId: "pp-1" }] });
    expect(outcome.ok).toBe(false);
    // old Script: Line 1: The status of the procurement plan is "draft" and the requirement equals "approved"
    // — Users stand on their page and read, "This is a draft."
    expect(outcome.detail).toBe(
      'line 1: "Purchase plan" points to purchasePlan status is "draft", required equal to "approved"',
    );
  });

  it("resembling describe - rules are displayed next to the actual screen and the main language is not read in two pieces Yes.", () => {
    expect(describeCheck(planApproved, labels)).toContain("\"Purchase plan\" points to purchasePlan");
  });

  it("second sentence of WB-BUG-67: The uuid on the right to say which of the sheets it is.", async () => {
    const warehouseMatches = normalizeCheck({
      primitive: "ref_field_compare",
      via: "$line.planId",
      entity: "purchasePlan",
      field: "warehouseId",
      op: "eq",
      right: { ref: "$bill.warehouseId" },
    });
    const outcome = await evaluateCheck(warehouseMatches, {
      ...ctxOf({ warehouseId: "b1c624d1-0000-0000-0000-000000000000" }),
      labels,
      query,
      lines: [{ planId: "pp-1" }],
    });
    expect(outcome.ok).toBe(false);
    // the old text: "...warehouseId is "wh-bj" and requires the equivalent of "b1c624d1-..." - both are internal markings.
    // the table on the same screen shows "Inventory warehouse - 0004 sjhang county warehouse". The value on the left has to be translated into label and cross the module.
    // check the vault once. It's one of your own.
    expect(outcome.detail).toContain('required equal to "Shipping warehouse" (');
  });
});

// ---------------------------------------------------------------------------
// 🔴 Platform level validity bug: datetime `eq` / `ne` It's been a long time.
//
// Two. `Date` Never. `===`(reference equals equal), and the datetime field to the rule engine is `Date`。
// On the same field `gt/gte/lt/lte` It's right. `orderable` Remove `getTime()`）—
// **System comparison, equal error**, not visible from reading statement.
//
// Site (line 283 API matrix for S4):`performanceSettlement.settle` Yes.
// `source_report_time_matches` "The time of reporting is "...653Z."
// the whole S9 line is broken here.
// ---------------------------------------------------------------------------

describe("🔴 Same comparison for Date", () => {
  const T = "2026-08-04T14:35:36.653Z";

  it("two Date examples at the same time: eq set, ne not set", () => {
    // Previously:`new Date(T) === new Date(T)` It's false eq constant, ne constant
    expect(compare(new Date(T), "eq", new Date(T))).toBe(true);
    expect(compare(new Date(T), "ne", new Date(T))).toBe(false);
  });

  it("at different times, it's still different -- it's the same, not the gate.", () => {
    expect(compare(new Date(T), "eq", new Date("2026-08-04T14:35:36.654Z"))).toBe(false);
    expect(compare(new Date(T), "ne", new Date("2026-08-04T14:35:36.654Z"))).toBe(true);
  });

  it("the right half has not been corrupted: the gte / lte of different examples at the same time is still valid", () => {
    expect(compare(new Date(T), "gte", new Date(T))).toBe(true);
    expect(compare(new Date(T), "lte", new Date(T))).toBe(true);
    expect(compare(new Date(T), "gt", new Date(T))).toBe(false);
  });

  it("date compares to the ISO string of equal prices -- it comes from the library on the one hand and it's literally normal on the other.", () => {
    expect(compare(new Date(T), "eq", T)).toBe(true);
    expect(compare(T, "eq", new Date(T))).toBe(true);
    // two words at the same time are the same.
    expect(compare(new Date("2026-02-10T00:00:00Z"), "eq", "2026-02-10T08:00:00+08:00")).toBe(true);
  });

  it("the empty value is not affected - is EmptyValue", () => {
    expect(compare(null, "eq", null)).toBe(true);
    expect(compare(new Date(T), "eq", null)).toBe(false);
    expect(compare(new Date(T), "ne", null)).toBe(true);
  });

  it("🔴 Date is more than a value that is not a date at all: throw, misjudge -- that's a false statement.", () => {
    expect(() => compare(new Date(T), "eq", 123, '"Report time"')).toThrow(/cannot be compared/);
    expect(() => compare(new Date(T), "ne", "not a date", '"Report time"')).toThrow(/cannot be compared/);
  });

  it("🔴 The full search path is set - the gate at the scene is ref field compare.", async () => {
    // Only `compare` It's not enough. `performanceSettlement.settle` Top
    // `ref_field_compare`Left is `ctx.query.get` The line from the library, Date.
    const check = normalizeCheck({
      primitive: "ref_field_compare",
      via: "$line.processReportId",
      entity: "processReport",
      field: "reportedAt",
      op: "eq",
      right: { ref: "$line.reportedAt" },
    });
    const query: RuleQuery = {
      // drive the timestamptz to read the Date instance -- that's the left of the gate.
      get: async () => ({ reportedAt: new Date(T) }),
      list: async () => [],
      balance: async () => {
        throw new Error("this case must not query a balance");
      },
    };
    const ctx = {
      ...ctxOf({}),
      query,
      lines: [{ processReportId: "pr-1", reportedAt: new Date(T) }],
    };
    const outcome = await evaluateCheck(check, ctx);
    expect(outcome.ok).toBe(true);
    // previously: ok=false, detail render both sides into the same characters word by word Thread
    expect(outcome.detail).toContain("1 line");
  });

  it("The trigger is... `instanceof Date`No, it's not. `isTemporal` — normal string semantics without a word", () => {
    // batch numbers that coincide with the date: always false,** not dropped.**
    // Press `isTemporal` If it triggers, the article goes into the cross-section and throws anomalies.
    // so the red and green of a gate depends on what the data looks like, and it's only available on this batch number.
    expect(compare("2026-08-04", "eq", "ABC-001")).toBe(false);
    expect(compare("2026-08-04", "ne", "ABC-001")).toBe(true);
    // strings in two date-forms continue to be literally compared (they may be date columns or batch numbers)
    expect(compare("2026-08-04", "eq", "2026-08-04")).toBe(true);
    expect(compare("2026-08-04", "eq", "2026-08-05")).toBe(false);
  });
});
