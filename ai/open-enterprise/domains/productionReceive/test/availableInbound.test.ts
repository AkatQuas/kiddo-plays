import { PlannerBusinessError, type PlannerContext } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import {
  availableInboundQty,
  bottleneckQualifiedQty,
  assertReceiptQtyWithinAvailable,
} from "../modules/productionReceipt/availableInbound.js";

describe("Available to receive = min(approved qualified ÷ assignment ratio) − already received", () => {
  it("no operation lines means the shortfall is 0", () => {
    expect(bottleneckQualifiedQty([])).toBe(0);
  });

  it("several operations take the shortfall of approved qualified quantity (ratio defaults to 1)", () => {
    expect(bottleneckQualifiedQty([
      { id: "cut", approvedQualifiedQty: 10 },
      { id: "iron", approvedQualifiedQty: 5 },
      { id: "pack", approvedQualifiedQty: 8 },
    ])).toBe(5);
  });

  it("convert to finished goods by assignment ratio, then take the shortfall: 1×100, 2×160, 1×90 → 80", () => {
    expect(bottleneckQualifiedQty([
      { id: "op1", approvedQualifiedQty: 100, assignmentRatio: 1 },
      { id: "op2", approvedQualifiedQty: 160, assignmentRatio: 2 },
      { id: "op3", approvedQualifiedQty: 90, assignmentRatio: 1 },
    ])).toBe(80);
  });

  it("floor after converting to finished goods by assignment ratio: 18÷5=3.6 → 3", () => {
    expect(bottleneckQualifiedQty([
      { id: "op1", approvedQualifiedQty: 18, assignmentRatio: 5 },
    ])).toBe(3);
  });

  it("available quantity may be negative in the calculation; it is shortfall minus already received", () => {
    expect(availableInboundQty(5, 2)).toBe(3);
    expect(availableInboundQty(5, 5)).toBe(0);
    expect(availableInboundQty(5, 7)).toBe(-2);
  });
});

function receiptCtx(args: {
  readonly inboundQty: number;
  readonly processLines: readonly Readonly<Record<string, unknown>>[];
  readonly received: number;
}): PlannerContext {
  return {
    module: "productionReceipt",
    transition: "releaseDemand",
    bill: {
      id: "receipt-1",
      revision: 1,
      header: { productionTaskId: "task-1", inboundQty: args.inboundQty },
      lines: {},
    },
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "productionTask" && id === "task-1") {
          return { id, revision: 1, header: { status: "inProduction" }, lines: { processLines: args.processLines } };
        }
        throw new Error(`unexpected ${module}/${id}`);
      },
      async listBills() { return { rows: [], total: 0 }; },
      async invariantBillSummary(module) {
        if (module === "productionReceipt") return { total: 1, value: args.received };
        return { total: 0, value: null };
      },
      async invariantLineSummary() { return { total: 0, value: null }; },
    },
  };
}

describe("Confirm receipt quantity gate", () => {
  it("shortfall 5, this receipt 4, received total 4 is allowed", async () => {
    await expect(assertReceiptQtyWithinAvailable(receiptCtx({
      inboundQty: 4,
      received: 4,
      processLines: [
        { id: "cut", approvedQualifiedQty: 10 },
        { id: "iron", approvedQualifiedQty: 5 },
      ],
    }))).resolves.toBeUndefined();
  });

  it("shortfall 5, already received 4, receiving 2 more is rejected", async () => {
    await expect(assertReceiptQtyWithinAvailable(receiptCtx({
      inboundQty: 2,
      received: 6,
      processLines: [
        { id: "cut", approvedQualifiedQty: 10 },
        { id: "iron", approvedQualifiedQty: 5 },
      ],
    }))).rejects.toBeInstanceOf(PlannerBusinessError);
  });

  it("rejects immediately when no operation has qualified quantity", async () => {
    await expect(assertReceiptQtyWithinAvailable(receiptCtx({
      inboundQty: 1,
      received: 1,
      processLines: [],
    }))).rejects.toThrow(/no approved qualified quantity to receive/);
  });
});
