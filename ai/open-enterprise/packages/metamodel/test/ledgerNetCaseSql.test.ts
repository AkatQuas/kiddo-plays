import { describe, expect, it } from "vitest";
import {
  EFFECT_OPS,
  effectOpSign,
  effectOpsOf,
  ledgerNetCaseSql,
  ledgerNetCaseSqlFor,
  listLedgerCodes,
} from "../src/index.js";

describe("ledgerNetCaseSql shares the installed ledger catalog", () => {
  it("each ledger CASE covers exactly the ops in the sign table, with the right sign, and has no else", () => {
    for (const target of listLedgerCodes()) {
      const fragment = ledgerNetCaseSql(target);
      expect(fragment, target).not.toMatch(/\belse\b/i);
      expect(fragment, target).toMatch(/^case /);
      expect(fragment, target).toMatch(/ end$/);
      for (const op of EFFECT_OPS) {
        const defined = effectOpsOf(target).includes(op);
        expect(fragment.includes(`when op = '${op}'`), `${target}.${op}`).toBe(defined);
        if (!defined) continue;
        const then = effectOpSign(target, op) === 1 ? "then amount" : "then -amount";
        expect(fragment, `${target}.${op} sign`).toContain(`when op = '${op}' ${then}`);
      }
    }
  });

  it("the stock CASE has no reserve — the old global in/reserve positive band is wrong on this ledger", () => {
    expect(ledgerNetCaseSql("stock")).not.toContain("reserve");
    expect(effectOpsOf("stock")).not.toContain("reserve");
  });

  it("several ledgers are a dispatch of each ledger's generator, not a second sign table", () => {
    const fragment = ledgerNetCaseSqlFor(["ap", "stock"]);
    expect(fragment).toBe(
      `case when target = 'ap' then ${ledgerNetCaseSql("ap")} when target = 'stock' then ${ledgerNetCaseSql("stock")} end`,
    );
    expect(fragment).not.toMatch(/\belse\b/i);
    expect(ledgerNetCaseSqlFor(["stock"])).toBe(ledgerNetCaseSql("stock"));
  });

  it("an empty list throws immediately, and does not emit a CASE that would read every row as negative", () => {
    expect(() => ledgerNetCaseSqlFor([])).toThrow(/must name at least one ledger/);
  });
});
