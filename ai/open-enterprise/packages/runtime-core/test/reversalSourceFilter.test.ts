import { describe, expect, it } from "vitest";
import { openReversalSourceTransitions, type LedgerRow } from "../src/index.js";

function row(
  id: string,
  transitionCode: string,
  reversalOf: string | null = null,
): LedgerRow {
  return {
    id,
    postingPeriod: "2026-08",
    target: "stock",
    op: reversalOf === null ? "out" : "in",
    amount: 1,
    subjectType: "product",
    subjectId: "sku-1",
    scopeType: "warehouse",
    scopeId: "warehouse-1",
    sourceModule: "exclusivePosting",
    sourceId: "bill-1",
    sourceLineId: null,
    transitionCode,
    reversalOf,
    occurredAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("openReversalSourceTransitions", () => {
  it("returns only source edges that still have an unreversed fact", () => {
    const rows = [
      row("sales-open", "postReceivable"),
      row("purchase-closed", "postPayable"),
      row("purchase-reversal", "reverse", "purchase-closed"),
    ];

    expect([...openReversalSourceTransitions(rows)]).toEqual(["postReceivable"]);
  });

  it("returns an empty set when everything is reversed, and does not treat the reversal itself as a source that can be reversed again", () => {
    const rows = [
      row("sales-closed", "postReceivable"),
      row("sales-reversal", "reverse", "sales-closed"),
    ];

    expect([...openReversalSourceTransitions(rows)]).toEqual([]);
  });
});
