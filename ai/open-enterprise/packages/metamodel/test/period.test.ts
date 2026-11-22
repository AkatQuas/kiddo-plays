import { describe, expect, it } from "vitest";
import {
  PeriodClosedError,
  listLedgerCodes,
  normalizePeriod,
  openPeriods,
  periodBookOf,
  periodOf,
  resolvePostingPeriod,
  type Period,
} from "../src/index.js";

/** 2026 3/4/5 issue, boundary is ** instantaneous** (in UTC simplified here, in OE TIMEZONE) */
function month(seq: number, code: string, from: string, to: string, status: "open" | "closed" = "open"): Period {
  return { book: "finance", code, seq, startAt: new Date(from), endAt: new Date(to), status };
}

const MAR = month(1, "2026-03", "2026-03-01T00:00:00Z", "2026-04-01T00:00:00Z");
const APR = month(2, "2026-04", "2026-04-01T00:00:00Z", "2026-05-01T00:00:00Z");
const MAY = month(3, "2026-05", "2026-05-01T00:00:00Z", "2026-06-01T00:00:00Z");

describe("subaccount Map", () => {
  it("every target has its place -- the books in the directory must be available for the period.", () => {
    for (const target of listLedgerCodes()) {
      expect(() => periodBookOf(target)).not.toThrow();
    }
  });

  it("inventory, payable", () => {
    expect(periodBookOf("stock")).toBe("inventory");
    expect(periodBookOf("ap")).toBe("finance");
  });

  it("🔴 Unknown target throws, no defaults -- guessed attribution periods will remain permanently on the unaltered bill Lee.", () => {
    expect(() => periodBookOf("payroll" as never)).toThrow(/unknown posting target/);
  });
});

describe("normative", () => {
  it("the zone must not be empty - startAt = = endAt without any moment, but it appears to be normal.", () => {
    expect(() =>
      normalizePeriod({
        book: "finance",
        code: "2026-03",
        seq: 1,
        startAt: new Date("2026-03-01T00:00:00Z"),
        endAt: new Date("2026-03-01T00:00:00Z"),
        status: "open",
      }),
    ).toThrow(/startAt must/);
  });

  it("seq must be the integer number of ≥1 - the sequence closes by it, without it \"last issue\" unsolved", () => {
    expect(() => normalizePeriod({ ...MAR, seq: 0 })).toThrow(/seq must be an integer/);
    expect(() => normalizePeriod({ ...MAR, seq: 1.5 })).toThrow(/seq must be an integer/);
  });

  it("book with status is closed", () => {
    expect(() => normalizePeriod({ ...MAR, book: "payroll" })).toThrow(/closed enum/);
    expect(() => normalizePeriod({ ...MAR, status: "locked" })).toThrow(/closed enum/);
  });

  it("code is free text - 4-4-5 calendars and 13 issues", () => {
    expect(normalizePeriod({ ...MAR, code: "2026-W05" }).code).toBe("2026-W05");
    expect(normalizePeriod({ ...MAR, code: "2026-13" }).code).toBe("2026-13");
  });
});

describe("periodof - Which issue is instantaneous?", () => {
  const ALL = [MAR, APR, MAY];

  it("[startAt, endAt): Last minute at the end of the period is next and not two at once", () => {
    expect(periodOf(ALL, "finance", new Date("2026-03-31T23:59:59Z"))?.code).toBe("2026-03");
    expect(periodOf(ALL, "finance", new Date("2026-04-01T00:00:00Z"))?.code).toBe("2026-04");
  });

  it("it's not coming out of any period.", () => {
    expect(periodOf(ALL, "finance", new Date("2026-02-15T00:00:00Z"))).toBeNull();
  });

  it("book separated: inventory not maintained during financial period", () => {
    expect(periodOf(ALL, "inventory", new Date("2026-03-15T00:00:00Z"))).toBeNull();
  });

  it("🔴 Overlap is thrown away without taking the first - attribution period cannot depend on array order", () => {
    const overlap = [MAR, month(9, "2026-Q1", "2026-01-01T00:00:00Z", "2026-04-01T00:00:00Z")];
    expect(() => periodOf(overlap, "finance", new Date("2026-03-15T00:00:00Z"))).toThrow(/overlapping periods/);
  });
});

describe("openPeriods", () => {
  it("only open, in chronological order.", () => {
    const closedMar = { ...MAR, status: "closed" as const };
    expect(openPeriods([MAY, APR, closedMar], "finance").map((p) => p.code)).toEqual(["2026-04", "2026-05"]);
  });
});

describe("resolve popping period - attribution is a decision", () => {
  it("the fact that it was open, it was written on it.", () => {
    const r = resolvePostingPeriod([MAR, APR], "finance", new Date("2026-03-28T00:00:00Z"));
    expect(r.period.code).toBe("2026-03");
    expect(r.shiftedFrom).toBeNull();
  });

  it("🔴 The fact that the issue was closed, extended to the earliest part of the session, and brought with it a copy of the paper.", () => {
    // 4/12 Redempted a 3/28 account: No March line, no March line.
    // it's a reverse in April.
    const r = resolvePostingPeriod([{ ...MAR, status: "closed" }, APR, MAY], "finance", new Date("2026-03-28T00:00:00Z"));
    expect(r.period.code).toBe("2026-04");
    expect(r.shiftedFrom?.code).toBe("2026-03");
  });

  it("🔴 The delay is not blocking -- a copy of a 3/30 sheet is in April.", () => {
    // the consequence of blocking is that the user changes the date of the document to meet the rules of attribution: the facts are altered
    const r = resolvePostingPeriod([{ ...MAR, status: "closed" }, APR], "finance", new Date("2026-03-30T00:00:00Z"));
    expect(r.period.code).toBe("2026-04");
  });

  it("it didn't last for any period.", () => {
    const r = resolvePostingPeriod([APR], "finance", new Date("2026-02-01T00:00:00Z"));
    expect(r.period.code).toBe("2026-04");
    expect(r.shiftedFrom).toBeNull();
  });

  it("🔴 There's no opening period.", () => {
    // and guessed the attribution period will remain permanently on the bill. Lee.
    expect(() =>
      resolvePostingPeriod([{ ...MAR, status: "closed" }], "finance", new Date("2026-03-15T00:00:00Z")),
    ).toThrow(PeriodClosedError);
    expect(() => resolvePostingPeriod([], "finance", new Date("2026-03-15T00:00:00Z"))).toThrow(
      /there is no open period/,
    );
  });

  it("** The earliest **, not the latest ** * - the first one to be paid at the same time", () => {
    const r = resolvePostingPeriod([{ ...MAR, status: "closed" }, MAY, APR], "finance", new Date("2026-03-10T00:00:00Z"));
    expect(r.period.code).toBe("2026-04");
  });
});
