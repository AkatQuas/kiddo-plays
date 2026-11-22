import { describe, expect, it } from "vitest";
import { displayScalarText, ScalarDisplayValueError, type ScalarDisplayField } from "../src/index.js";

const field = (key: string, type: ScalarDisplayField["type"]): ScalarDisplayField => ({ key, type });

describe("shared scalar display", () => {
  it("money, quantity, percent, and the business time zone render stably", () => {
    expect(displayScalarText(field("amount", "money"), "12000", { timeZone: "Asia/Shanghai" })).toBe("12,000.00");
    expect(displayScalarText(field("qty", "number"), 12_000.1234567, { timeZone: "Asia/Shanghai" })).toBe("12000.123457");
    expect(displayScalarText(field("rate", "percent"), 12.34567, { timeZone: "Asia/Shanghai" })).toBe("12.3457%");
    expect(displayScalarText(field("at", "datetime"), "2026-08-10T00:30:00.000Z", { timeZone: "Asia/Shanghai" })).toBe("2026-08-10 08:30");
  });

  it("keeps seconds on a notification timestamp, and treats a Date and a database string the same", () => {
    for (const value of [new Date("2026-09-23T07:21:51.041Z"), "2026-09-23T07:21:51.041Z", "2026-09-23 07:21:51.041+00"]) {
      expect(displayScalarText(field("at", "datetime"), value, { timeZone: "Asia/Shanghai", datetimeSeconds: true })).toBe("2026-09-23 15:21:51");
    }
  });

  it("a date-only value skips the time zone, and a missing label keeps the stable value", () => {
    expect(displayScalarText(field("day", "date"), "2026-08-10", { timeZone: "America/Los_Angeles" })).toBe("2026-08-10");
    expect(displayScalarText(field("customerId", "ref"), "customer-1", { timeZone: "Asia/Shanghai" })).toBe("customer-1");
    expect(displayScalarText(field("customerId", "ref"), "customer-1", { timeZone: "Asia/Shanghai", label: () => "East China customer" })).toBe("East China customer");
  });

  it("fails fast on a dirty value, and does not silently stringify an invalid number or boolean", () => {
    expect(() => displayScalarText(field("qty", "number"), "not-a-number", { timeZone: "Asia/Shanghai" })).toThrow(ScalarDisplayValueError);
    expect(() => displayScalarText(field("enabled", "bool"), 1, { timeZone: "Asia/Shanghai" })).toThrow(ScalarDisplayValueError);
  });
});
