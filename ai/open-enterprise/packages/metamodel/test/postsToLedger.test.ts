import { describe, expect, it } from "vitest";
import { normalizeLifecycle, type Transition } from "../src/index.js";

/**
 * `Transition.postsToLedger` - Won't this side move the bill.
 *
 * This is ** led ** `Effect.perLine`This is the basis for the interface to decide "Do you want to make a call first?"
 * the sentence must come from the declaration rather than from the run-off plan: the sentence is fail-open, on the same side
 * plan, which happens to be empty, leaves the window open, while “sometimes it doesn't”.
 */

/** One reservation. Edges named by `reverseOn` also write the ledger, in the opposite direction. */
function reserve(reverseOn: readonly string[]): unknown {
  return {
    target: "ap",
    op: "reserve",
    subject: "$bill.supplierId",
    amount: "{totalAmount}",
    reverseOn,
  };
}

function lifecycleWith(transitions: readonly unknown[]): readonly Transition[] {
  return normalizeLifecycle({
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "pending", label: "awaitingShipment" },
      { key: "done", label: "completed", terminal: true },
    ],
    transitions,
  }).transitions;
}

function by(transitions: readonly Transition[], code: string): Transition {
  const found = transitions.find((t) => t.code === code);
  if (found === undefined) throw new Error(`the case has no edge "${code}"`);
  return found;
}

describe("two sources of postsToLedger", () => {
  const edges = lifecycleWith([
    // one says it on this side.
    { code: "approve", from: "draft", to: "pending", action: "Approve", effects: [reserve(["unapprove", "finish"])] },
    // 2 effects on this side, but entered by approve reverseOn -- it released the occupation.
    { code: "unapprove", from: "pending", to: "draft", action: "Unapprove" },
    { code: "finish", from: "pending", to: "done", action: "Complete" },
    // neither one: neither bookkeeping nor elimination
    { code: "submit", from: "draft", to: "pending", action: "Submit" },
  ]);

  it("1 This side says effects", () => {
    expect(by(edges, "approve").postsToLedger).toBe(true);
  });

  it("2 on this side zero effects, but the other side says \"roll it back\" -- it'll release the platter quietly if it doesn't. mouth", () => {
    expect(by(edges, "unapprove").effects).toHaveLength(0);
    expect(by(edges, "unapprove").postsToLedger).toBe(true);
    expect(by(edges, "finish").postsToLedger).toBe(true);
  });

  it("on the side of neither is false -- we can't judge all the sides to confirm, that's no signal.", () => {
    expect(by(edges, "submit").postsToLedger).toBe(false);
  });
});

describe("it's not a statement.", () => {
  it("write in the statement that PostsToLedger was shut down... It's not a seventh concept. It's a projection of an existing declaration.", () => {
    expect(() =>
      lifecycleWith([{ code: "submit", from: "draft", to: "pending", action: "Submit", postsToLedger: true }]),
    ).toThrow(/postsToLedger/);
  });

  it("reverseOn points to non-existent sides that do not misjudge any of them.", () => {
    const edges = lifecycleWith([
      { code: "approve", from: "draft", to: "pending", action: "Approve", effects: [reserve(["nonexistent"])] },
      { code: "submit", from: "draft", to: "pending", action: "Submit" },
    ]);
    expect(by(edges, "approve").postsToLedger).toBe(true);
    expect(by(edges, "submit").postsToLedger).toBe(false);
  });

  it("zero-side life cycle unexploded (uniode of primary data)", () => {
    expect(lifecycleWith([])).toHaveLength(0);
  });
});
