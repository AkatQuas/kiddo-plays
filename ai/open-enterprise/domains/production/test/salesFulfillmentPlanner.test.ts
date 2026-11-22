import { describe, expect, it } from "vitest";
import type { PlannerBillSnapshot, PlannerContext } from "@open-erp/metamodel";
import { releaseSalesAfterProductionSettled } from "../salesFulfillment.ts";

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot {
  return { id, revision: 1, header: { id, ...header }, lines };
}

function context(input: {
  orderId: string;
  salesOrderId: string | null;
  salesStatus: string;
  leftover: readonly Readonly<Record<string, unknown>>[];
  salesLines?: readonly Readonly<Record<string, unknown>>[];
}): PlannerContext {
  return {
    module: "productionOrder",
    transition: "complete",
    bill: snapshot(input.orderId, { salesOrderId: input.salesOrderId }),
    params: {},
    read: {
      async getBill(module, id) {
        if (module === "salesOrder" && id === input.salesOrderId) {
          return snapshot(id, { status: input.salesStatus }, {
            lines: input.salesLines ?? [{ id: "sol-1", baseQty: 10, shippedBaseQty: 0 }],
          });
        }
        throw new Error(`unexpected getBill ${module}:${id}`);
      },
      async listBills(module) {
        if (module !== "productionOrder") throw new Error(`unexpected list ${module}`);
        return { rows: input.leftover, total: input.leftover.length };
      },
      async invariantBillSummary() { throw new Error("must not read invariants"); },
      async invariantLineSummary() { throw new Error("must not read invariants"); },
    },
  };
}

describe("Production order writes back sales fulfillment", () => {
  it("the sales order has converged on in progress: ending production no longer pushes release* or complete", async () => {
    for (const salesLines of [
      [{ id: "sol-1", baseQty: 10, shippedBaseQty: 0 }],
      [{ id: "sol-1", baseQty: 10, shippedBaseQty: 4 }, { id: "sol-2", baseQty: 8, shippedBaseQty: 0 }],
      [{ id: "sol-1", baseQty: 10, shippedBaseQty: 10 }],
    ]) {
      const commands = await releaseSalesAfterProductionSettled(
        context({
          orderId: "po-1",
          salesOrderId: "so-1",
          salesStatus: "inProgress",
          leftover: [],
          salesLines,
        }),
        "po-1",
      );
      expect(commands).toEqual([]);
    }
  });

  it("one-to-many still unfinished, no sales order attached, or the sales order is no longer in progress: still no push", async () => {
    expect(await releaseSalesAfterProductionSettled(
      context({
        orderId: "po-1",
        salesOrderId: "so-1",
        salesStatus: "inProgress",
        leftover: [{ id: "po-2", status: "releasing" }],
      }),
      "po-1",
    )).toEqual([]);
    expect(await releaseSalesAfterProductionSettled(
      context({ orderId: "po-1", salesOrderId: null, salesStatus: "inProgress", leftover: [] }),
      "po-1",
    )).toEqual([]);
    expect(await releaseSalesAfterProductionSettled(
      context({ orderId: "po-1", salesOrderId: "so-1", salesStatus: "completed", leftover: [] }),
      "po-1",
    )).toEqual([]);
  });
});
