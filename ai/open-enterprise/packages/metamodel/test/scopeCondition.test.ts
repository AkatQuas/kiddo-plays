import { describe, expect, it } from "vitest";
import {
  QueryInputError,
  assertScopeConditionValues,
  parseScopeValue,
  scopeValueKey,
} from "../src/index.js";

describe("scope-condition value gate", () => {
  it("returns a non-time value unchanged", () => {
    expect(assertScopeConditionValues("string", "in", ["a", "b"], "c")).toEqual(["a", "b"]);
  });

  it("an absolute string accepts only a calendar-valid day or month", () => {
    expect(() => assertScopeConditionValues("date", "eq", ["2026-09-21"], "c")).not.toThrow();
    expect(() => assertScopeConditionValues("date", "eq", ["2026-09"], "c")).not.toThrow();
    expect(() => assertScopeConditionValues("date", "eq", ["2024-02-29"], "c")).not.toThrow();
    expect(() => assertScopeConditionValues("date", "eq", ["2026-02-29"], "c")).toThrow(/YYYY-MM-DD or YYYY-MM/);
    expect(() => assertScopeConditionValues("date", "eq", ["2026-13-40"], "c")).toThrow(/YYYY-MM-DD or YYYY-MM/);
    expect(() => assertScopeConditionValues("date", "eq", ["2026-00"], "c")).toThrow(/YYYY-MM-DD or YYYY-MM/);
    expect(() => assertScopeConditionValues("datetime", "eq", ["2026-09-21T00:00:00Z"], "c")).toThrow(/YYYY-MM-DD or YYYY-MM/);
  });

  it("a relative between endpoint reuses the kernel error code", () => {
    try {
      assertScopeConditionValues("datetime", "between", [{ $rel: "today" }, "2026-09-21"], "c");
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(QueryInputError);
      expect(error).toMatchObject({
        code: "RELATIVE_RANGE_NOT_BETWEEN_ENDPOINT",
        message: expect.stringContaining("c: a relative-time token means a whole span and cannot be a between endpoint"),
      });
    }
  });

  it("the structural dedupe key distinguishes an absolute string from a relative value", () => {
    expect(scopeValueKey("2026-09-21")).toBe("2026-09-21");
    expect(scopeValueKey({ $rel: "today" })).toBe("today");
    expect(scopeValueKey({ $rel: "last_n_days", n: 3 })).toBe("last_n_days:3");
    expect(parseScopeValue({ $rel: "last_n_months", n: 3 }, "v")).toEqual({ $rel: "last_n_months", n: 3 });
  });
});
