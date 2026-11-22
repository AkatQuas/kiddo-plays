import { describe, expect, it } from "vitest";
import {
  EFFECT_LEDGER_OP_SIGNED_CONSTRAINT,
  EFFECT_OPS,
  effectLedgerOpSignedCheckPredicate,
  effectLedgerSignedPairs,
  effectOpsOf,
  ledgerOpSigns,
  listLedgerCodes,
} from "../src/index.js";

function parseInList(raw: string): readonly string[] {
  return [...raw.matchAll(/'([^']+)'/g)].map((hit) => {
    const value = hit[1];
    if (value === undefined) throw new Error(`the predicate has an empty quoted string: ${raw}`);
    return value;
  });
}

/** Expand the generator's own format into a pair set - to prove that it is not missing, that it is not numerous, rather than that "the string equals itself". */
function pairsAllowedByPredicate(predicate: string): ReadonlySet<string> {
  const pairs = new Set<string>();
  const clauseRe = /\(\s*target\s+in\s+\(([^)]+)\)\s+and\s+op\s+in\s+\(([^)]+)\)\s*\)/g;
  let saw = 0;
  for (const hit of predicate.matchAll(clauseRe)) {
    saw += 1;
    const targets = parseInList(hit[1] ?? "");
    const ops = parseInList(hit[2] ?? "");
    if (targets.length === 0 || ops.length === 0) {
      throw new Error(`the CHECK clause expanded to an empty set: ${hit[0]}`);
    }
    for (const target of targets) {
      for (const op of ops) pairs.add(`${target}:${op}`);
    }
  }
  if (saw === 0) throw new Error(`the predicate parsed to no clauses: ${predicate}`);
  return pairs;
}

describe("the CHECK name is the same as the loaded directory", () => {
  it("staple to death - Move / Drizzle / Gate 3 must be the same", () => {
    expect(EFFECT_LEDGER_OP_SIGNED_CONSTRAINT).toBe("oe_effect_ledger_op_signed");
  });

  it("(target, op)", () => {
    const fromTable = new Set(effectLedgerSignedPairs().map((pair) => `${pair.target}:${pair.op}`));
    const fromPredicate = pairsAllowedByPredicate(effectLedgerOpSignedCheckPredicate());
    expect([...fromPredicate].sort()).toEqual([...fromTable].sort());

    // a contrario must be added to the word: otherwise "stock rejection" is a note, not the nature of this table
    expect(fromPredicate.has("stock:reserve")).toBe(false);
    expect(fromPredicate.has("stock:release")).toBe(false);
    expect(fromPredicate.has("cash:reserve")).toBe(false);
    expect(ledgerOpSigns("stock").reserve).toBeUndefined();
  });

  it("grouping in each directory: release in the table, no rejection", () => {
    const allowed = pairsAllowedByPredicate(effectLedgerOpSignedCheckPredicate());
    for (const target of listLedgerCodes()) {
      for (const op of EFFECT_OPS) {
        const defined = effectOpsOf(target).includes(op);
        expect(allowed.has(`${target}:${op}`), `${target}.${op}`).toBe(defined);
      }
    }
  });
});
