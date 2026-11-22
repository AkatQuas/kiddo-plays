import { describe, expect, it } from "vitest";
import {
  calendarYmd,
  codePeriod,
  formatCode,
  normalizeFixtureModule,
  validateModule,
  type Numbering,
} from "../src/index.js";

function base(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "po",
    label: "Purchase order",
    domain: "procurement",
    fields: [{ key: "code", label: "Document number", type: "string", primary: true, auto: true }],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"] } },
    numbering: { prefix: "CG", seqScope: "day" },
    ...extra,
  };
}

const PER_DAY: Numbering = { prefix: "XS", seqScope: "day" };
const PER_TENANT: Numbering = { prefix: "SP", seqScope: "tenant" };

describe("formatCode: two formatting groups, the number of paragraphs is determined by empty period", () => {
  it("the flow of water only lasts for one day.", () => {
    expect(formatCode("XS", "20260729", 1)).toBe("XS-20260729-0001");
    expect(formatCode("CK", "20260729", 42)).toBe("CK-20260729-0042");
  });

  it("the water flows through the entire tenant.", () => {
    expect(formatCode("SP", "", 1)).toBe("SP-0001");
    expect(formatCode("KH", "", 137)).toBe("KH-0137");
  });

  it("there's a lot of water running between the two.", () => {
    expect(formatCode("SP", "", 42)).toBe("SP-0042");
    expect(formatCode("XS", "20260729", 42)).toBe("XS-20260729-0042");
  });

  it("illegal prefix/ period/ seq rejected", () => {
    expect(() => formatCode("xs", "20260729", 1)).toThrow(/prefix/);
    expect(() => formatCode("XS", "2026-07-29", 1)).toThrow(/period/);
    // half-date is more dangerous than an empty string: it will spell out one that looks normal, but different in width from the other. No. No.
    expect(() => formatCode("XS", "202607", 1)).toThrow(/period/);
    expect(() => formatCode("XS", "20260729", 0)).toThrow(/seq/);
  });
});

describe("calendarYmd: Business day cut by declared time zone, not process time zone", () => {
  // 🔴 This is the same day as the day of the inquiry.
  // Old version: `calendarYmd(new Date(2026, 6, 29, 15, 0))` - Local construction + local reading,
  // it's green under any TZ, and it just happens to be completely blind about the thing it's supposed to guard against.
  const instant = new Date("2026-07-29T16:30:00Z");

  it("at the same moment, two operations in two time zones. Day", () => {
    expect(calendarYmd(instant, "Asia/Shanghai")).toBe("20260730"); // uTC+8 past zero.
    expect(calendarYmd(instant, "UTC")).toBe("20260729");
  });

  it("multi-monthly / Inter-year border cuts", () => {
    expect(calendarYmd(new Date("2025-12-31T16:00:00Z"), "Asia/Shanghai")).toBe("20260101");
    expect(calendarYmd(new Date("2025-12-31T16:00:00Z"), "UTC")).toBe("20251231");
  });

  it("time Zone must be filled: without an empty string, no return process TZ", () => {
    expect(() => calendarYmd(instant, "")).toThrow();
    // @ts-expect-error should have no type of time zone -- this assertion is accompanied by a nail to the signature
    expect(() => calendarYmd(instant)).toThrow();
  });
});

describe("codePeriod: The only place to read seqScope in the warehouse", () => {
  const instant = new Date("2026-07-29T16:30:00Z");

  it("day ⇒ Operating day, still declared by time zone", () => {
    expect(codePeriod(PER_DAY, instant, "Asia/Shanghai")).toBe("20260730");
    expect(codePeriod(PER_DAY, instant, "UTC")).toBe("20260729");
  });

  it("tenant zirconium Empty string (no more finer) with no change at any time", () => {
    expect(codePeriod(PER_TENANT, instant, "Asia/Shanghai")).toBe("");
    expect(codePeriod(PER_TENANT, instant, "UTC")).toBe("");
    expect(codePeriod(PER_TENANT, new Date("2020-01-01T00:00:00Z"), "UTC")).toBe("");
  });

  it("the day file is still filled with the time zone: the primary data is not the same as the documents are not worthy of the time zone", () => {
    expect(() => codePeriod(PER_DAY, instant, "")).toThrow();
  });
});

describe("nombering Gate", () => {
  it("declaration of pair release", () => {
    expect(validateModule(normalizeFixtureModule(base())).ok).toBe(true);
  });

  it("seqScop: release", () => {
    expect(validateModule(normalizeFixtureModule(base({ numbering: { prefix: "SP", seqScope: "tenant" } }))).ok).toBe(true);
  });

  it("auto missing numbering sentence", () => {
    const raw = base();
    delete raw["numbering"];
    const report = validateModule(normalizeFixtureModule(raw));
    expect(report.errors.map((e) => e.code)).toContain("NUMBERING_MISSING");
  });

  it("auto can't mark", () => {
    const report = validateModule(
      normalizeFixtureModule(
        base({
          fields: [{ key: "code", label: "Document number", type: "string", primary: true, auto: true, required: true }],
        }),
      ),
    );
    expect(report.errors.map((e) => e.code)).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("excess format button rejected in shape", () => {
    expect(() => normalizeFixtureModule(base({ numbering: { prefix: "CG", seqScope: "day", format: "Anything" } }))).toThrow(
      /accepts only prefix and seqScope/,
    );
  });

  it("seqScope will fill out no defaults: drop, day", () => {
    // 🔴 "The master data won't get the date code quietly." If by default day,
    // the missing seqScope master data module will be miscalculated for the entire journey, except for an additional semantic of a permanent error in the code
    expect(() => normalizeFixtureModule(base({ numbering: { prefix: "CG" } }))).toThrow(/seqScope/);
  });

  it("seqScope only closed and no self-made value", () => {
    expect(() => normalizeFixtureModule(base({ numbering: { prefix: "CG", seqScope: "month" } }))).toThrow(/seqScope/);
  });
});
