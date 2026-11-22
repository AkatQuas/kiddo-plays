import { describe, expect, it } from "vitest";
import {
  COMPARATORS,
  COMPARATOR_TEXT,
  COMPARATORS_BY_TYPE,
  defineFixtureModule,
  assertSummaryTargets,
  normalizeAggregates,
  normalizeColumnOverrides,
  normalizeQuery,
  QueryInputError,
  platformQueryFields,
  QUERY_COMPARATORS,
  QUERY_COMPARATOR_TEXT,
  QUERY_MAX_LIMIT,
  QUERY_MAX_SEARCH_TERMS,
  searchTerms,
  searchText,
  RELATIVE_DATES,
  RELATIVE_SPAN_MAX_N,
  RELATIVE_SPAN_UNIT,
  RELATIVE_SPANS,
  isRelativeSpanN,
  relativeDateLabel,
  type RelativeSpan,
  planListColumns,
  planListSummaries,
  resolveColumns,
  resolveListColumns,
  summaryKey,
} from "../src/index.js";

const mod = defineFixtureModule({
  code: "demoBill",
  label: "Demo document",
  domain: "sales",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "amount", label: "Amount", type: "money" },
    { key: "channel", label: "Channel", type: "enum", options: ["Direct sale", "Distribution"] },
    { key: "orderDate", label: "Order date", type: "date" },
    { key: "remark", label: "Remark", type: "text" },
    { key: "attach", label: "Attachment", type: "attachment" },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "demoBillLine",
      fields: [
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "grade", label: "Level", type: "enum", options: ["A", "B"] },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", color: "gray", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true },
    ],
    transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
  },
  views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
});

describe("seech: a word with a group of words", () => {
  // 🔴 The array is for "a group of names at a time": 20 names of goods in a single file.
  // one check is 20 round trips, and the model travels 10 seconds each.

  it("the behaviour of a single string remains the same word for word", () => {
    expect(normalizeQuery(mod, { search: "SO-1" }).search).toBe("SO-1");
    expect(searchTerms("SO-1")).toEqual(["SO-1"]);
    // no, no, no.
    expect(normalizeQuery(mod, {}).search).toBeNull();
    expect(normalizeQuery(mod, { search: null }).search).toBeNull();
    expect(searchTerms(null)).toEqual([]);
  });

  it("serial array, empty word dropped", () => {
    expect(normalizeQuery(mod, { search: ["A", "B"] }).search).toEqual(["A", "B"]);
    expect(searchTerms(["A", "  ", "B "])).toEqual(["A", "B"]);
  });

  it("empty words are rejected according to the rule of a single word - arrays are not more liberal", () => {
    // `search: ""` Today's the day to throw. There's no reason to mix an empty string in an array.
    // release is a condition that doesn't match anything, and its empty results are the same as "no really."
    expect(() => normalizeQuery(mod, { search: "" })).toThrow();
    expect(() => normalizeQuery(mod, { search: ["A", ""] })).toThrow();
    expect(() => normalizeQuery(mod, { search: ["   "] })).toThrow();
  });

  it("🔴 The non-strings in the array have to be rejected on the spot.", () => {
    // a Null blends into the vocabulary, and without stopping it becomes a condition that doesn't match anything...
    // and the empty result of the return is exactly the same as "no."
    expect(() => normalizeQuery(mod, { search: ["A", null] })).toThrow();
    expect(() => normalizeQuery(mod, { search: [1] })).toThrow();
  });

  it("seechText: Put back the sentence that a search box can show", () => {
    // 🔴 Interface and URL. Use this one, side by side. Come on. `searchTerms`- It's not the same thing:
    // there's only one box for "What to show."
    assert: {
      expect(searchText("SO-1")).toBe("SO-1");
      expect(searchText(null)).toBe("");
      expect(searchText(["A", "B"])).toBe("A B");
      // each word has to go back and forth as it is -- interface echoes, URL decoding depends on it.
      expect(searchText(normalizeQuery(mod, { search: "SO-1" }).search)).toBe("SO-1");
    }
  });

  it("hard limit for word numbers - word numbers multiplied directly by the number of or branches of SQL", () => {
    const many = Array.from({ length: QUERY_MAX_SEARCH_TERMS + 1 }, (_, i) => `t${String(i)}`);
    expect(() => normalizeQuery(mod, { search: many })).toThrow(/at most/);
    expect(normalizeQuery(mod, { search: many.slice(0, QUERY_MAX_SEARCH_TERMS) }).search).toHaveLength(
      QUERY_MAX_SEARCH_TERMS,
    );
  });

  /**
   * 🔴 The ceiling should be sufficient to contain a single submission**, not the next estimate.
   *
   * Site: one sales contract yielded 49 customer names, and one `bill_list(customer, search:[…49 names…])`
   * it was rejected by 20 caps. The disposal of the model is a batch retest, and each batch is a complete round trip (10~60 seconds) -
   * the same words and the addition of a SQL are one second. It's called "49 to pass once."
   */
  it("🔴 The size of a material must be checked at once - 49 words are not allowed to be reduced to split.", () => {
    const fromOneContract = Array.from({ length: 49 }, (_, i) => `Customer${String(i)} Co.`);
    expect(normalizeQuery(mod, { search: fromOneContract }).search).toHaveLength(49);
  });
});

describe("where's the blank?", () => {
  // 🔴 Model hair `where: {}` What I'm trying to say is "no sift" and I used to admit it. `{kind:"group",children:[]}`，
  // so I hit the "query.where.kind "undefined" and left the group empty, and again...
  // same meaning, two round trips. Two collisions (bill list account/worker) have been measured online.
  it("`{}` & Empty Group", () => {
    expect(normalizeQuery(mod, { where: {} }).where).toBeNull();
    expect(normalizeQuery(mod, { where: { kind: "group", join: "and", children: [] } }).where).toBeNull();
  });

  it("🔴 It's true, silence makes the filter a full table.", () => {
    expect(() => normalizeQuery(mod, { where: { field: "code" } })).toThrow();
    expect(() => normalizeQuery(mod, { where: { kind: "cond" } })).toThrow();
  });
});

describe("normalizeQuery", () => {
  it("accept legal condition tree", () => {
    const q = normalizeQuery(mod, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "code", op: "contains", value: "SO" },
          { kind: "cond", field: "status", op: "in", value: ["draft"] },
        ],
      },
      sort: [{ field: "amount", desc: true }],
      limit: 20,
    });
    expect(q.limit).toBe(20);
    expect(q.where?.kind).toBe("group");
  });

  // 🔴 Secure boundary: condition is derived from the browser. Failure to verify field names is tantamount to asking if the module is not intended to be exposed
  it("reject non-existent fields", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "secret", op: "eq", value: 1 } })).toThrow(
      /has no field/,
    );
  });

  it("release Platform Fields", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "createdBy", op: "eq", value: "u1" } })).not.toThrow();
  });

  // refusal to teach people —
  //
  // 🔴 The verdict is "Can this error be changed at a time" and not "if or not."
  // the caller can only guess once more when there is only one word of "no such field" — the performance is measured over and over again in the same group of parameters.
  // so these three are contracts, not flowers.

  /*:: Take structured leads from QueryInputError; otherwise, the assertion fails */
  const hintOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      if (err instanceof QueryInputError) return err;
      throw err;
    }
    throw new Error("should have thrown QueryInputError, but it passed");
  };

  it("the field name is wrong: give a legitimate collection, the latest candidate and who to fix it", () => {
    const err = hintOf(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDat", op: "eq", value: 1 } }),
    );
    expect(err.code).toBe("QUERY_FIELD_UNKNOWN");
    expect(err.hint.valid).toContain("orderDate");
    // platform fields are also in a legitimate collection -- the condition model that the panel spell out should be spelled.
    expect(err.hint.valid).toContain("createdBy");
    expect(err.hint.didYouMean).toContain("orderDate");
    expect(err.hint.fixable).toBe("machine");
    expect(err.hint.read).toContain("demoBill");
  });

  it("i don't know, did you?", () => {
    const err = hintOf(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "zzzzzzzzzz", op: "eq", value: 1 } }),
    );
    expect(err.hint.didYouMean ?? []).toEqual([]);
    // but a legitimate collection of photos -- it's the only way out without a candidate.
    expect(err.hint.valid?.length).toBeGreaterThan(0);
  });

  it("error in detail: Legitimate assembly is the column of the schedule, not the header field", () => {
    const err = hintOf(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "lines.qtyy", op: "eq", value: 1 } }),
    );
    expect(err.code).toBe("LINE_COLUMN_UNKNOWN");
    expect(err.hint.valid).toContain("qty");
    expect(err.hint.valid).not.toContain("amount");
    expect(err.hint.didYouMean).toContain("qty");
  });

  it("wrong breakdown: give what is the breakdown of the module", () => {
    const err = hintOf(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "linez.qty", op: "eq", value: 1 } }),
    );
    expect(err.code).toBe("LINE_TABLE_UNKNOWN");
    expect(err.hint.valid).toEqual(["lines"]);
    expect(err.hint.didYouMean).toContain("lines");
  });

  it("take the list as a condition: point the way to lines.", () => {
    const err = hintOf(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "lines", op: "eq", value: 1 } }),
    );
    expect(err.code).toBe("QUERY_FIELD_NOT_QUERYABLE");
    expect(err.correctUsage).toContain("lines.");
    expect(err.hint.fixable).toBe("machine");
  });

  it("refusal to use the schedule as a search condition", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "lines", op: "eq", value: 1 } })).toThrow(/type subtable and cannot be a query condition/);
  });

  it("refuse attachment for query condition", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "attach", op: "eq", value: 1 } })).toThrow(/type attachment and cannot be a query condition/);
  });

  // the list of collators of the detailed paths: "Is there a second reading in the term `there exists a line of satisfaction'?"
  // not "a few." The two groups must be nailed together - only the one that went.
  // the negative class is then put in without testing red.
  const lineCond = (field: string, op: string, value: unknown) => ({
    where: { kind: "cond", field, op, value },
  });

  // `in` Select a column that supports it: no number `in`（COMPARATORS_BY_TYPE），
  // take the qty and try to be stopped by the ** type.
  it.each([
    { op: "eq", field: "lines.qty", value: 1 },
    { op: "gt", field: "lines.qty", value: 1 },
    { op: "gte", field: "lines.qty", value: 1 },
    { op: "lt", field: "lines.qty", value: 1 },
    { op: "lte", field: "lines.qty", value: 1 },
    { op: "between", field: "lines.qty", value: [1, 9] },
    { op: "in", field: "lines.grade", value: ["A", "B"] },
  ] as const)('line path allows $op — unique under "a line satisfies"', ({ op, field, value }) => {
    expect(() => normalizeQuery(mod, lineCond(field, op, value))).not.toThrow();
  });

  it.each(["ne", "not_in", "is_empty", "not_empty"])(
    'line path rejects a negative: %s — "a line is not X" and "no line is X" are both legal and cannot be told apart',
    (op) => {
      const value = op === "not_in" ? ["A"] : "A";
      expect(() => normalizeQuery(mod, lineCond("lines.grade", op, value))).toThrow(/line condition/);
    },
  );

  it("top-level empty group equals no place", () => {
    expect(normalizeQuery(mod, { where: { kind: "group", join: "and", children: [] } }).where).toBeNull();
    expect(normalizeQuery(mod, { where: { kind: "group", join: "or", children: [] } }).where).toBeNull();
  });

  it("empty nested group still rejected", () => {
    expect(() =>
      normalizeQuery(mod, {
        where: { kind: "group", join: "and", children: [{ kind: "group", join: "and", children: [] }] },
      }),
    ).toThrow(/must not be empty/);
  });

  it("the value in / not in must be an array", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "channel", op: "in", value: "x" } })).toThrow(
      /must be an array/,
    );
  });

  it("value Missing Drop - Empty Value has an exclusive comparator, do not blur", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "eq" } })).toThrow(/is_empty/);
  });

  // 🔴 This was done only once when the server was compiled: the same condition is legal in the nuclear eye and illegal in the server's eyes.
  // it's "yes" on both sides. No one's ever gonna say which one to believe.
  it("the comparator needs to match the field type - kernel stops, not left to compile Period", () => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "gte", value: 1 } })).toThrow(
      /does not support comparator/,
    );
  });

  // 🔴 `code` / `id` It's all a string, and "getting a set of identifiers to decipher adult words at once" is the most high-frequency reading mode of ERP.
  // No, in-time caller can only send a n-eq-mode 5 hits `id in [...]` / `code in [...]`
  it("string support in / not in - single numbers and codes are natural identifiers, lot taking is normal", () => {
    expect(COMPARATORS_BY_TYPE.string).toContain("in");
    expect(COMPARATORS_BY_TYPE.string).toContain("not_in");
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "in", value: ["A", "B"] } }),
    ).not.toThrow();
    // text Not: Long Text List Unread
    expect(COMPARATORS_BY_TYPE.text).not.toContain("in");
  });

  it("not contains is a query-specific comparator, text-type fields only", () => {
    expect(COMPARATORS).not.toContain("not_contains");
    for (const type of ["string", "text", "phone"] as const) {
      expect(COMPARATORS_BY_TYPE[type]).toContain("not_contains");
    }
    expect(COMPARATORS_BY_TYPE.enum).not.toContain("not_contains");
    expect(COMPARATORS_BY_TYPE.ref).not.toContain("not_contains");
    expect(COMPARATORS_BY_TYPE.money).not.toContain("not_contains");
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "not_contains", value: "TEST" } }),
    ).not.toThrow();
  });

  it("platform fields are also past type locks (created At is not a match)", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "createdAt", op: "contains", value: "2026" } }),
    ).toThrow(/does not support comparator/);
  });
});

// unfilled —
//
// A kiosk doesn't mean two things.`eq + null` It was once both `opening' and `unfilled' on the interface.
// The consequence is that a new condition is compiled without direct application. `is null`list.

describe("there's only one way to ask an empty question.", () => {
  it.each(["eq", "ne"] as const)("%s + null is rejected and the error points at is_empty", (op) => {
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "code", op, value: null } })).toThrow(
      /is_empty/,
    );
  });

  it("is empty / not empty the value must be null", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "is_empty", value: null } }),
    ).not.toThrow();
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "code", op: "is_empty", value: "" } })).toThrow(
      /does not accept a value/,
    );
  });

  it("every searchable type is empty -- bool also, tri-state Boolean is \"Yes/ No/ Unfilled\" in ERP", () => {
    for (const [type, ops] of Object.entries(COMPARATORS_BY_TYPE)) {
      if (ops === null) continue;
      expect(ops, `${type} missing is_empty`).toContain("is_empty");
      expect(ops, `${type} missing not_empty`).toContain("not_empty");
    }
  });

  // `x in (null)` and `x not in (null)` Always unknown in SQL, not a single line back.
  // the latter is particularly like a trap: the user reads it as "excludes the unfilled" and actually "doesn't want anything."
  it("no Nulls in candidate arrays", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "channel", op: "in", value: ["Direct sale", null] } }),
    ).toThrow(/is_empty/);
  });
});

// ── between ───────────────────────────────────────────────────────────────

describe("between", () => {
  it("values and dates are available, text is not available", () => {
    expect(COMPARATORS_BY_TYPE.money).toContain("between");
    expect(COMPARATORS_BY_TYPE.date).toContain("between");
    expect(COMPARATORS_BY_TYPE.string).not.toContain("between");
  });

  it("value must be an array of exactly 2 lengths", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "between", value: [100, 500] } }),
    ).not.toThrow();
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "between", value: [100] } }),
    ).toThrow(/length exactly 2/);
    expect(() => normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "between", value: 100 } })).toThrow(
      /must be an array/,
    );
  });

  it("it's worth it at both ends -- there's no reading in half the area.", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "between", value: [100, null] } }),
    ).toThrow(/both ends/);
  });

  // the opposite is permanent leave: it returns to a set of results, and the user reads "no such document."
  it("the lower bounds are bigger than the upper bounds.", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "between", value: [500, 100] } }),
    ).toThrow(/reversed range/);
  });
});

// - relative to time - / / / / / / - / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / / // // / /// // // // / / //// /// // /// / ///// / // / ///// /// / //// / //////// / //////// // ////////////// / //////////////////////////// // //
//
// 🔴 The shape of the value must reside in the kernel: three consumer sides (the panel paints it, the server compiles it, the SavedView sequences it).
// expands at the front end into two absolute date input views, which will expire silently the next day.

describe("relative Time", () => {
  it("available on date / datetime", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDate", op: "eq", value: { $rel: "last_7d" } } }),
    ).not.toThrow();
  });

  it("last week / last March was a long, long time.", () => {
    expect(RELATIVE_DATES).toContain("last_week");
    expect(RELATIVE_DATES).toContain("last_3_months");
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDate", op: "eq", value: { $rel: "last_week" } } }),
    ).not.toThrow();
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDate", op: "eq", value: { $rel: "last_3_months" } } }),
    ).not.toThrow();
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "createdAt", op: "eq", value: { $rel: "last_week" } } }),
    ).not.toThrow();
  });

  it("between accepts only absolute endpoints; relative token itself is complete", () => {
    expect(() =>
      normalizeQuery(mod, {
        where: { kind: "cond", field: "orderDate", op: "between", value: [{ $rel: "last_month" }, { $rel: "today" }] },
      }),
    ).toThrow(/cannot be a between endpoint/);
    expect(() =>
      normalizeQuery(mod, {
        where: { kind: "cond", field: "orderDate", op: "between", value: ["2026-01-01", { $rel: "today" }] },
      }),
    ).toThrow(/cannot be a between endpoint/);
  });

  it("drop-in on non-date fields - unknown value shapes do not squirm into SQL", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "amount", op: "eq", value: { $rel: "today" } } }),
    ).toThrow(/relative time/i);
  });

  it("ne not accepted above -- depending on whether empty values are two readings", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDate", op: "ne", value: { $rel: "today" } } }),
    ).toThrow(/relative time/i);
  });

  it("unknown token rejected as a string", () => {
    expect(() =>
      normalizeQuery(mod, { where: { kind: "cond", field: "orderDate", op: "eq", value: { $rel: "next_century" } } }),
    ).toThrow(/unknown/);
  });

  it("keys other than $rel rejected", () => {
    expect(() =>
      normalizeQuery(mod, {
        where: { kind: "cond", field: "orderDate", op: "eq", value: { $rel: "today", tz: "UTC" } },
      }),
    ).toThrow(/unknown key/);
  });
});

// relative time: Parameters —
//
// 🔴 This is a set of two hard gaps: the long ones that can't be accompanied by parameters ( "staying longer than two days" cannot be written).
// it also points to the past.
//
// The most important proposition in this section is ** caliber**:`_days` It's calendar day.`_hours` It's rolling. The price of ambiguity is
// the answer is all day long at best, and both readings look as if they are true in the outcome — nowhere is wrong.

describe("relative time: Parameters", () => {
  const rel = (field: string, op: string, value: unknown): unknown =>
    normalizeQuery(mod, { where: { kind: "cond", field, op, value } });

  it("calendar log passed / The future is both directions -- the completion of the past equals \"N within days\".", () => {
    expect(() => rel("orderDate", "lt", { $rel: "last_n_days", n: 2 })).not.toThrow();
    expect(() => rel("orderDate", "eq", { $rel: "next_n_days", n: 3 })).not.toThrow();
    // symmetry is structural, not "I remember writing": every last * has to have the same unit next *
    for (const token of RELATIVE_SPANS) {
      const mirror = token.startsWith("last_")
        ? token.replace("last_", "next_")
        : token.replace("next_", "last_");
      expect(RELATIVE_SPANS as readonly string[]).toContain(mirror);
      // the caliber follows the unit, not the direction: the past and the future must be the same.
      expect(RELATIVE_SPAN_UNIT[token]).toBe(RELATIVE_SPAN_UNIT[mirror as RelativeSpan]);
    }
  });

  it("n Missing or Throwed - no default value for this dimension", () => {
    expect(() => rel("orderDate", "eq", { $rel: "last_n_days" })).toThrow(/n is missing/);
  });

  it.each([0, -3, 2.5, RELATIVE_SPAN_MAX_N + 1, "3", null])(
    "n = %s is rejected: negative, decimal, over the cap, and strings must not be compiled into SQL",
    (n) => {
      expect(() => rel("orderDate", "eq", { $rel: "last_n_days", n })).toThrow(/n (must be|is missing)/);
    },
  );

  it("the boundary value itself is legal: 1 and the ceiling can be crossed.", () => {
    expect(() => rel("orderDate", "eq", { $rel: "last_n_days", n: 1 })).not.toThrow();
    expect(() => rel("orderDate", "eq", { $rel: "last_n_days", n: RELATIVE_SPAN_MAX_N })).not.toThrow();
  });

  it("fixed length token tape n rejected -- silently ignore that 3 is equivalent to three days for the caller to ask himself", () => {
    expect(() => rel("orderDate", "eq", { $rel: "today", n: 3 })).toThrow(/unknown key/);
  });

  // 🔴 The core theme of this section: calendar days vs rolling 24 hours is not the same thing, so it's two tranches with names.
  it("scroll hours slots only set on datetime, date fields dropped", () => {
    // created At is the platform's datetime: "Create More than 24 Hours" asks when rolling Long
    expect(() => rel("createdAt", "lt", { $rel: "last_n_hours", n: 24 })).not.toThrow();
    expect(() => rel("createdAt", "eq", { $rel: "next_n_hours", n: 6 })).not.toThrow();
    // orderDate is date: without time, the hour is lost silently and the answer is reduced to the calendar-day boundary
    expect(() => rel("orderDate", "lt", { $rel: "last_n_hours", n: 48 })).toThrow(/rolling-hour/);
    // the calendar file is set up for both types - "List of this week" is a legal issue on date.
    expect(() => rel("createdAt", "gte", { $rel: "last_n_days", n: 7 })).not.toThrow();
  });

  it("it's written in the name of the token. It's not a key that can be missed.", () => {
    expect(RELATIVE_SPAN_UNIT["last_n_days"]).toBe("calendar_day");
    expect(RELATIVE_SPAN_UNIT["last_n_hours"]).toBe("rolling_hour");
    expect(RELATIVE_SPAN_UNIT["last_n_months"]).toBe("calendar_month");
    expect(RELATIVE_SPAN_UNIT["next_n_months"]).toBe("calendar_month");
    // Names and calibres must be consistent:`_hours` But on calendar days, it's a mistake that none of the tests in this section will find out.
    for (const token of RELATIVE_SPANS) {
      const unit = token.endsWith("_hours")
        ? "rolling_hour"
        : token.endsWith("_months")
          ? "calendar_month"
          : "calendar_day";
      expect(RELATIVE_SPAN_UNIT[token]).toBe(unit);
    }
  });

  it("last n months / next n months is legal on date and datetime", () => {
    expect(() => rel("orderDate", "eq", { $rel: "last_n_months", n: 3 })).not.toThrow();
    expect(() => rel("orderDate", "eq", { $rel: "next_n_months", n: 2 })).not.toThrow();
    expect(() => rel("createdAt", "eq", { $rel: "last_n_months", n: 3 })).not.toThrow();
    expect(() => rel("createdAt", "eq", { $rel: "next_n_months", n: 2 })).not.toThrow();
  });

  it("rELATIVE OK OPS / RELATIVE OK TYPES", () => {
    // non-date field
    expect(() => rel("amount", "eq", { $rel: "last_n_days", n: 3 })).toThrow(/relative time/i);
    // ne is not a permitted comparator Lee.
    expect(() => rel("orderDate", "ne", { $rel: "last_n_days", n: 3 })).toThrow(/relative time/i);
    // relative token means the complete range, no more spelling the third calibre as an end point for bitween
    expect(() =>
      rel("orderDate", "between", [{ $rel: "last_n_days", n: 30 }, { $rel: "next_n_days", n: 7 }]),
    ).toThrow(/cannot be a between endpoint/);
    expect(() => rel("orderDate", "between", ["2026-01-01", { $rel: "next_n_days", n: 7 }])).toThrow(
      /cannot be a between endpoint/,
    );
  });

  it("only eq + single token, between can reject fusion slots for full relative periods", () => {
    expect(() =>
      rel("orderDate", "between", [{ $rel: "this_month" }, { $rel: "next_n_days", n: 1 }]),
    ).toThrow(/relative-time token.*between/);
    try {
      rel("orderDate", "between", [{ $rel: "this_month" }, { $rel: "next_n_days", n: 1 }]);
    } catch (error) {
      expect(error).toMatchObject({
        code: "RELATIVE_RANGE_NOT_BETWEEN_ENDPOINT",
        path: "query.where.value",
        correctUsage: expect.stringContaining('op=eq'),
      });
    }
  });

  it("query input belt stable code/path/repairHint", () => {
    try {
      rel("orderDate", "eq", { $rel: "next_n_days", n: 0 });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toMatchObject({
        code: "RELATIVE_SPAN_N_OUT_OF_RANGE",
        path: "query.where.value.n",
        correctUsage: expect.stringContaining("1..3650"),
      });
    }
  });

  it("only one wording: panel summary and angent description for relativeDateLabel", () => {
    // the long-format wording is the same word -- it's already on the interface. Let's go.
    expect(relativeDateLabel({ $rel: "last_7d" })).toBe("last 7 days");
    // parameter Profile Fill N in, not leave a placeholder to caller itself
    expect(relativeDateLabel({ $rel: "last_n_days", n: 3 })).toContain("3");
    expect(relativeDateLabel({ $rel: "last_n_days", n: 3 })).toContain("calendar days");
    expect(relativeDateLabel({ $rel: "last_n_hours", n: 48 })).toContain("rolling");
    expect(relativeDateLabel({ $rel: "last_week" })).toBe("last week");
    expect(relativeDateLabel({ $rel: "last_3_months" })).toBe("last three months (including this month, three calendar months)");
    expect(relativeDateLabel({ $rel: "last_n_months", n: 3 })).toBe("last 3 calendar months (including this month)");
    expect(relativeDateLabel({ $rel: "next_n_months", n: 2 })).toBe("next 2 calendar months (including this month)");
  });

  it("there's only one case, the kernel shares with the enforcer.", () => {
    expect(isRelativeSpanN(1)).toBe(true);
    expect(isRelativeSpanN(RELATIVE_SPAN_MAX_N)).toBe(true);
    expect(isRelativeSpanN(0)).toBe(false);
    expect(isRelativeSpanN(RELATIVE_SPAN_MAX_N + 1)).toBe(false);
    expect(isRelativeSpanN("7")).toBe(false);
    expect(isRelativeSpanN(undefined)).toBe(false);
  });
});

// 

describe("only one definition for the comparator and platform field", () => {
  // queries are made, not copied: Comparators add one, and here they follow.
  it("qUERY COMPARATORS is the binary superset.", () => {
    for (const op of COMPARATORS) expect(QUERY_COMPARATORS).toContain(op);
    expect(QUERY_COMPARATORS).toContain("not_contains");
    expect(QUERY_COMPARATORS).toContain("between");
  });

  it("the file is also spelled -- the same gte is the same word in the intercept hint and the filter panel.", () => {
    for (const op of COMPARATORS) expect(QUERY_COMPARATOR_TEXT[op]).toBe(COMPARATOR_TEXT[op]);
  });

  it("platform check field belt type, comparator push by type - not written in list", () => {
    const platform = platformQueryFields([
      { key: "active", label: "Active" },
      { key: "disabled", label: "Disabled" },
    ]);
    const status = platform.find((f) => f.key === "status");
    expect(status?.type).toBe("enum");
    expect(status?.options).toEqual([
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" },
    ]);
    // that's the one that was left on the panel.
    expect(platform.map((f) => f.key)).toContain("updatedAt");
  });

  it("status throws when there is no candidate - the panel will render a draw that cannot choose something", () => {
    expect(() => platformQueryFields([])).toThrow(/status/);
  });

  it("it's hard.", () => {
    expect(() => normalizeQuery(mod, { limit: QUERY_MAX_LIMIT + 1 })).toThrow(/at most/);
  });

  it("sort fields equally verified", () => {
    expect(() => normalizeQuery(mod, { sort: [{ field: "nope", desc: false }] })).toThrow(/has no field/);
  });
});

describe("planListColumns", () => {
  const AUDIT = ["createdBy", "createdAt", "updatedBy", "updatedAt"] as const;

  it("default assurance status, no moves already in place; audit four rows follow the business line", () => {
    expect(planListColumns(["code", "amount"]).defaults).toEqual(["code", "status", "amount", ...AUDIT]);
    expect(planListColumns(["code", "status", "amount"]).defaults).toEqual(["code", "status", "amount", ...AUDIT]);
  });

  it("hideStatus master data is also defaulted to audit four columns - not a procurement exception", () => {
    expect(planListColumns(["code", "name"], true).defaults).toEqual(["code", "name", ...AUDIT]);
  });

  it("hideAudit closes the audit default and the whole set is held", () => {
    const { defaults, universe } = planListColumns(["code"], false, true);
    expect(defaults).toEqual(["code", "status"]);
    expect(universe).toEqual(["code", "status", "id", ...AUDIT]);
  });

  it("the module columns has already written an audit key heavy without plugging it twice", () => {
    expect(planListColumns(["code", "createdBy"]).defaults).toEqual([
      "code",
      "status",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt",
    ]);
  });

  it("column Settings Candidate = Default ∪Platform QUERY FIELDS (with id), without conduit fields", () => {
    const { universe } = planListColumns(["code"]);
    // 🔴 `id` In the candidacy: it's with `module` It's all about documentation.`bill_list` We must return it.
    // angent also needs to know that it is a legitimate searchable field (see PLATFORM QUERY FIELDS above).
    // what's really unexposed is the ** conduit field** (tenantId / orgId), which is the gate below.
    expect(universe).toEqual(["code", "status", ...AUDIT, "id"]);
    expect(universe).not.toContain("tenantId");
    expect(universe).not.toContain("orgId");
  });
});

describe("aggregation", () => {
  // the sum only has business meaning for number / money - percent is the sum of the percentages.
  // getting a number without any reading (the same calibre as the breakdown)
  it.each([
    { field: "orderDate", ok: false },
    { field: "amount", ok: true },
  ] as const)("totals attach only to numeric columns: $field → $ok", ({ field, ok }) => {
    const run = () =>
      assertSummaryTargets(mod, [{ field, hidden: false, width: null, order: null, summary: "sum" }]);
    if (ok) expect(run).not.toThrow();
    else expect(run).toThrow(/cannot carry a total/);
  });

  // user view is historical data and not a statement: fields are deleted and the entire list page should not be blown up
  it("other Organiser No throw.", () => {
    expect(() =>
      assertSummaryTargets(mod, [{ field: "gone", hidden: false, width: null, order: null, summary: "sum" }]),
    ).not.toThrow();
  });

  it("requested folder whitelist: non-existent fields Throw!", () => {
    expect(() => normalizeAggregates(mod, [{ field: "gone", fn: "sum" }])).toThrow(/has no field/);
    expect(() => normalizeAggregates(mod, [{ field: "orderDate", fn: "sum" }])).toThrow(/cannot be aggregated/);
    expect(normalizeAggregates(mod, [{ field: "amount", fn: "avg" }])).toEqual([{ field: "amount", fn: "avg" }]);
  });

  it("there's only one way to spell the bond.", () => {
    expect(summaryKey({ field: "amount", fn: "sum" })).toBe("amount:sum");
  });
});

describe("normalizeColumnOverrides", () => {
  // the view stored before this dimension is online does not have a summary key. The view of all old users.
  // the moment you open the list, it's all dead -- it's not fail-fast, it's bad data.
  it("old Line Missing Summary Key: Press nulll to read", () => {
    const [only] = normalizeColumnOverrides([{ field: "code", hidden: false, width: 120, order: null }]);
    expect(only).toEqual({ field: "code", hidden: false, width: 120, order: null, summary: null });
  });

  // half of the coverage does not distinguish between "using default" and "not saving". It's written by the caller himself.
  // the missing key is a misspelled -- if you let go, it will be read as "the width follows the default, the order is not changed" and the caller thinks he didn't say it.
  it("🔴 width / order / heidden: throw and say which is missing", () => {
    expect(() => normalizeColumnOverrides([{ field: "code", hidden: true }])).toThrow(/width, order/);
    expect(() => normalizeColumnOverrides([{ field: "code", width: null, order: null }])).toThrow(/hidden/);
    expect(() => normalizeColumnOverrides([{ hidden: false, width: null, order: null }])).toThrow(/field/);
  });

  it("the key is in the wrong value: throw it.", () => {
    expect(() => normalizeColumnOverrides([{ field: "code", hidden: false, width: "Width", order: null }])).toThrow();
    expect(() => normalizeColumnOverrides([{ field: "code", hidden: false, width: null, order: null, summary: "Sum" }])).toThrow();
  });
});

describe("default Total Out of Plant", () => {
  const moneyMod = defineFixtureModule({
    code: "moneyBill",
    label: "Multi-amount document",
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", required: true, primary: true },
      { key: "totalAmount", label: "Order amount", type: "money" },
      { key: "taxAmount", label: "Tax", type: "money" },
      { key: "otherAmount", label: "Other amount", type: "money" },
      { key: "qty", label: "Quantity", type: "number" },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", color: "gray", initial: true },
        { key: "completed", label: "completed", color: "green", terminal: true },
      ],
      transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
    },
    views: {
      list: { columns: ["code", "totalAmount", "taxAmount", "otherAmount", "qty"], filters: [], searchable: ["code"] },
      form: [{ title: "Basics", fields: ["code"] }],
    },
  });

  it("declaration default column, first two amounts sum; quantity column and third amount column are missing", () => {
    const seeded = planListSummaries(
      ["code", "totalAmount", "taxAmount", "otherAmount", "qty"],
      moneyMod.fields,
    );
    expect([...seeded.entries()]).toEqual([
      ["totalAmount", "sum"],
      ["taxAmount", "sum"],
    ]);
  });

  // 🔴 This is the key to U22: the second consumer (export, list tool for angent) is based on the same statement.
  // it has to be the same sum as the user's screen -- each time it's the same.
  it("resolveListColumns at once: Uncovered column eatout default", () => {
    const plan = resolveListColumns(moneyMod, []);
    expect(plan.columns.filter((c) => c.summary !== null).map((c) => c.field)).toEqual([
      "totalAmount",
      "taxAmount",
    ]);
    expect(plan.defaults).toContain("status");
    expect(plan.universe).toContain("createdAt");
  });

  it("🔴 Turning off the sum is written by a submary:null that must be pressed out of the plant by default.", () => {
    const plan = resolveListColumns(moneyMod, [
      { field: "totalAmount", hidden: false, width: null, order: null, summary: null },
    ]);
    expect(plan.columns.find((c) => c.field === "totalAmount")?.summary).toBeNull();
    // the one that's never been touched is the default.
    expect(plan.columns.find((c) => c.field === "taxAmount")?.summary).toBe("sum");
  });

  it("overwrite to move the sum to another value column Let's go.", () => {
    const plan = resolveListColumns(moneyMod, [
      { field: "qty", hidden: false, width: null, order: null, summary: "sum" },
    ]);
    expect(plan.columns.find((c) => c.field === "qty")?.summary).toBe("sum");
  });

  it("resolveColumns does not show the same sum when no plant default is given.", () => {
    const cols = resolveColumns(["code", "amount"], []);
    expect(cols.every((c) => c.summary === null)).toBe(true);
  });
});

describe("resolveColumns", () => {
  // 🔴 This is the meaning of the whole delta.
  it("the new column in the declaration can also be found for older users who have stored views", () => {
    const overrides = [{ field: "code", hidden: false, width: 120, order: null, summary: null }];
    const cols = resolveColumns(["code", "amount"], overrides);
    expect(cols.map((c) => c.field)).toEqual(["code", "amount"]);
  });

  it("hide and column width overwrite effective", () => {
    const cols = resolveColumns(["code", "amount"], [{ field: "amount", hidden: true, width: null, order: null, summary: null }]);
    expect(cols.map((c) => c.field)).toEqual(["code"]);
    expect(cols[0]?.width).toBeNull();
  });

  it("order overwrite default order", () => {
    const cols = resolveColumns(
      ["code", "amount"],
      [{ field: "amount", hidden: false, width: null, order: -1, summary: null }],
    );
    expect(cols.map((c) => c.field)).toEqual(["amount", "code"]);
  });

  // user view is a historical legacy, not a declaration. It's wrong to bomb the current request with an outdated quote.
  it("ignored when the deleted field is quoted in the overwrite", () => {
    const cols = resolveColumns(["code"], [{ field: "gone", hidden: true, width: 80, order: 0, summary: null }]);
    expect(cols.map((c) => c.field)).toEqual(["code"]);
  });

  it("non-default column default hide, override Hidden: false open", () => {
    const { defaults, universe } = planListColumns(["code"]);
    expect(resolveColumns(defaults, [], universe).map((c) => c.field)).toEqual([
      "code",
      "status",
      "createdBy",
      "createdAt",
      "updatedBy",
      "updatedAt",
    ]);
    const opened = resolveColumns(
      defaults,
      [{ field: "createdAt", hidden: false, width: null, order: null, summary: null }],
      universe,
    );
    expect(opened.map((c) => c.field)).toContain("createdAt");
  });
});

// 🔴 Refuse to give the next step. The model takes aggregates three times to the count.
// what it wants is "a few in each state," which is grouping, not a single sum. It's just saying "can't get together" and it still has to guess again.
describe("aggregates border with anallysis sql", () => {
  it("when a platform field is rejected, a direct call should be made using analysis sql. Write", () => {
    let msg = "";
    try {
      normalizeAggregates(mod, [{ field: "status", fn: "count" }]);
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).toMatch(/is not numeric/);
    expect(msg).toMatch(/analysis_sql/);
    expect(msg).toMatch(/COUNT\(\*\)/);
    // tell me exactly what aggregates do, or they'll be wrong next time.
    expect(msg).toMatch(/list footer|single total/);
  });
});
