// ---------------------------------------------------------------------------
// activation freeze: account entry symbol
//
// 🔴 The purpose of this test is to ** pre-empt the status quo pending agreement to change the symbol. It must be green, word for word, before and after changes --
// green doesn't mean a new caliber, it means "how do you read the lines that have fallen?"
//
// Why is it worth a single copy:`NET_SUM` Yes, ** with symbol **, the symbol is changed to the entire history line.
// read it. And there's no symptoms -- the balance is just another number, no anomalies, no errors,
// the statements are available. The only thing that can stop it is a claim that these were the numbers before the change.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { effectOpSign, effectOpsOf, listLedgerCodes, positiveEffectOps, type EffectOp, type EffectTarget } from "@open-erp/metamodel";

/**
 * frozen symbol - ** Handwritten**, not from measured code import.
 *
 * from the measured code import constant, it's equal to itself, the claim is green. The freeze test is nailed.
 * "The number I want," so the expectations have to be written here.
 *
 * Five books today match the symbols on these four ops. `POSITIVE_OPS`),
 * so this watch can still be written on an op-dimensional basis. ** It's not gonna work if we put a commitment on the inventory ** - That day.
 * `stock.reserve` Yes. `−1` And... `ap.reserve` Still. `+1`This watch must be changed to press
 * (target, op) Two-dimensional, and those who change it are the ones who should be forced to think about it.
 */
const FROZEN_SIGN: Readonly<Record<EffectOp, 1 | -1>> = Object.freeze({
  reserve: 1,
  release: -1,
  in: 1,
  out: -1,
});

/** Allowed today (target, op) group - Status snapshot of the modeled gate, same independent Write */
const FROZEN_ALLOWED: Readonly<Record<EffectTarget, readonly EffectOp[]>> = Object.freeze({
  ap: ["reserve", "release", "in", "out"],
  stock: ["in", "out"],
  cash: ["in", "out"],
  gl: ["reserve", "release", "in", "out"],
});

describe("activation freeze: account entry sign (green before change of sign)", () => {
  it("each (target, op) symbol nailed to death -- one for today, not about target", () => {
    const actual: Record<string, number> = {};
    for (const target of listLedgerCodes()) {
      for (const op of effectOpsOf(target)) {
        // 🔴 Reads the symbol of ** measured code**`effectOpSign`), compared to FROZEN SIGN by hand.
        // after changing the symbol from one to the other, the expectation here has not changed a word -- that's right.
        // "This remodel has not been accompanied by any symbol."
        actual[`${target}.${op}`] = effectOpSign(target, op);
      }
    }
    expect(actual).toEqual({
      "ap.reserve": 1, "ap.release": -1, "ap.in": 1, "ap.out": -1,
      "stock.in": 1, "stock.out": -1,
    });
  });

  it("model period allowed combination nailing -- stock no commitment file today", () => {
    const actual = Object.fromEntries(listLedgerCodes().map((t) => [t, [...effectOpsOf(t)]]));
    expect(actual).toEqual(Object.fromEntries(listLedgerCodes().map((t) => [t, [...FROZEN_ALLOWED[t]]])));

    // This is the risk element of the entire instalment:`stock` Reserv / release, so
    // ** There can't be a stocking of promise accounts today**. Change the symbol of the stock so no history line can be changed...
    // the phrase "change POSITIVE OPS is a change of reading that has fallen into the library" is empty for stock.
    // it's not empty for ap / gl, and the two books reserv = + are right and need not be changed.
    expect(effectOpsOf("stock")).not.toContain("reserve");
    expect(effectOpsOf("stock")).not.toContain("release");
  });

  it("symbol & Inverted Op Table Self-conforming - The Red Sprint must return the balance.", () => {
    // the reverse execution plug is the EFFECT REVERSE OPS map of the past op, offset by a symbol to the contrary.
    // not in favor of peace, reversalof. So, "The two op symbols must be the opposite" is a hard variable:
    // after breaking it, the balance after the red flush was not returned to its original value but doubled.
    //
    // 🔴 The assertion must be placed on ** the table of the code tested** and ** itemized**. This comparison was written by hand.
    // fROZEN SIGN herself, the one that proves "my handwritten watch is self-conforming" - the real one.
    // `stock: {reserve:-1, release:-1}`It's green, and that's it.
    // reason for non-variant. The handwritten forms are one-dimensional and are not meant to be slotting, so they cannot be the subject of a test.
    for (const target of listLedgerCodes()) {
      const ops = effectOpsOf(target);
      for (const op of ops) {
        const reverse = ({ reserve: "release", release: "reserve", in: "out", out: "in" } as const)[op];
        // Only when ** both entries are on this account** will they match:`stock` Only in/out, no match
        if (!ops.includes(reverse)) continue;
        expect(
          effectOpSign(target, op) + effectOpSign(target, reverse),
          `${target}: ${op} and ${reverse} must have opposite signs, otherwise a reversal doubles the balance instead of offsetting it`,
        ).toBe(0);
      }
    }
  });

  it("each account must have a proper number -- a total negative signage and only return to a straight negative.", () => {
    // `positiveEffectOps` Fail-fast. This list of products that have been crucified has gone well today.
    // and prove that the fail-fast is not a dead code.
    for (const target of listLedgerCodes()) {
      expect(positiveEffectOps(target).length, `${target} has no positive-sign op`).toBeGreaterThan(0);
    }
  });
});
