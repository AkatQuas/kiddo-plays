// ---------------------------------------------------------------------------
// Prefix allow-list. Four facts:
//   1. `-` never gets in. It is the segment separator inside formatCode.
//   2. A prefix may be up to 12 characters, long enough for the longest module name.
//   3. Existing Latin prefixes stay valid. Widening the set does not replace them.
//   4. Everything outside the allow-list is rejected, including characters that
//      only look like a separator or a letter.
//
// `numbering.test.ts` covers the two seqScope values and the business-day cut.
// This file covers the prefix character set and its length.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { formatCode, normalizeFixtureModule, type Numbering } from "../src/index.js";

/** Smallest legal module, used only to read normalizeNumbering's verdict. */
function numberingOf(prefix: unknown, seqScope = "day"): Numbering {
  const schema = normalizeFixtureModule({
    code: "po",
    label: "Purchase order",
    domain: "procurement",
    fields: [{ key: "code", label: "Doc no.", type: "string", primary: true, auto: true }],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"] } },
    numbering: { prefix, seqScope },
  });
  if (!schema.numbering) throw new Error("fixture did not receive numbering");
  return schema.numbering;
}

const accepts = (prefix: string): void => {
  expect(numberingOf(prefix).prefix).toBe(prefix);
};
const rejects = (prefix: unknown): void => {
  expect(() => numberingOf(prefix)).toThrow(/prefix/);
};

describe("prefix must not contain '-'", () => {
  // formatCode joins `{prefix}-{period}-{seq}` into 2 or 3 segments.
  // A hyphen inside the prefix splits the same string into four segments, and
  // "four segments" means the code bypassed formatCode. A legal declaration
  // would turn that check into a false alarm.
  it("rejects a hyphen at the start, middle, or end", () => {
    rejects("-PO");
    rejects("PO-");
    rejects("P-O");
    rejects("PURCHASE-ORDER");
    rejects("PURCHASEORDER-");
    rejects("-");
  });

  it("formatCode rejects the same prefixes", () => {
    expect(() => formatCode("PURCHASE-ORDER", "20260803", 1)).toThrow(/prefix/);
    expect(() => formatCode("PO-", "", 1)).toThrow(/prefix/);
  });

  it("rejects characters that only look like a hyphen or a slash", () => {
    // U+FF0D is what a fullwidth IME emits. It looks like `-` and is not one.
    rejects("PO\uFF0DORDER"); // U+FF0D fullwidth hyphen
    rejects("PO\u2013ORDER"); // U+2013 en dash
    rejects("PO\u2014ORDER"); // U+2014 em dash
    rejects("PO_ORDER");
    rejects("PO\uFF0FORDER"); // U+FF0F fullwidth slash
    rejects("PO/ORDER");
  });

  it("an accepted prefix still encodes as 2 or 3 segments", () => {
    expect(formatCode("PO", "20260803", 1).split("-")).toHaveLength(3);
    expect(formatCode("SUPPLIER", "", 1).split("-")).toHaveLength(2);
    expect(formatCode("PO", "20260803", 1)).toBe("PO-20260803-0001");
    expect(formatCode("SUPPLIER", "", 137)).toBe("SUPPLIER-0137");
  });
});

describe("prefix length", () => {
  it("accepts a mixed letter-and-digit prefix", () => {
    accepts("BOM1");
  });

  it("accepts 12 characters and keeps the margin above a short module code", () => {
    accepts("SUPPLIERQUOT");
    accepts("COSTSHEET");
    accepts("ABCDEFGHIJKL");
  });

  it("rejects 13 characters, so a pasted sentence cannot become a prefix", () => {
    rejects("ABCDEFGHIJKLM");
  });
});

describe("widening the allow-list does not retire Latin prefixes", () => {
  it("keeps the old boundary: one letter is valid, a leading digit is not", () => {
    accepts("A");
    accepts("A1");
    accepts("A0000000");
    rejects("1A");
    rejects("2026");
  });
});

describe("anything outside the allow-list is rejected", () => {
  it("rejects spaces, including a space that only looks blank", () => {
    rejects("PO ORDER");
    rejects("PO\u3000ORDER"); // U+3000 ideographic space
    rejects("  ");
  });

  it("rejects punctuation, brackets, and emoji", () => {
    rejects("PO.");
    rejects("(PO)");
    rejects("PO!");
    rejects("PO#");
    rejects("PO\u{1F4E6}");
  });

  it("rejects fullwidth letters and digits, which are different code points from ASCII", () => {
    rejects("\uFF38\uFF33"); // fullwidth X, S
    rejects("PO\uFF11"); // fullwidth digit 1
  });

  it("rejects CJK extension blocks (missing fonts, untypeable, and GBK export turns them into question marks)", () => {
    rejects(String.fromCodePoint(0x3400)); // Ext A
    rejects(String.fromCodePoint(0x20000)); // Ext B, outside the BMP
  });

  it("rejects kana and hangul; the Han range in the allow-list is the basic block only", () => {
    rejects("\u30AB\u30CA");
    rejects("\uD55C\uAE00");
  });

  it("rejects a non-string, an empty string, and a number", () => {
    rejects(undefined);
    rejects("");
    rejects(123);
  });
});

describe("the string in the declaration is the string that is issued", () => {
  // normalizeNumbering used to call `.toUpperCase()`. That silently rewrote the
  // declaration: the author wrote `sp`, every issued code was `SP`.
  // formatCode already threw, so the same value had two verdicts.
  it("does not rewrite lowercase into uppercase", () => {
    rejects("sp");
    rejects("Sp");
    rejects("POa");
  });

  it("normalizeNumbering and formatCode now give the same verdict", () => {
    expect(() => formatCode("po", "20260729", 1)).toThrow(/prefix/);
    rejects("po");
  });

  it("rejects letters whose uppercase form used to sneak onto the allow-list", () => {
    // `.toUpperCase()` used to run before the check and manufacture a legal prefix:
    // ß→SS, ﬁ→FI, ſ→S, ı→I. The string written and the string issued were not the same.
    rejects("\u00DF");
    rejects("\uFB01");
    rejects("\u017F");
    rejects("\u0131");
  });
});
