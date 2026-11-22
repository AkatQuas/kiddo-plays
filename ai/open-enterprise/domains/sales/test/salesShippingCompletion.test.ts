import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { evaluateTransition } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const salesOrder = requireModule(catalog, "salesOrder").schema;
const salesDelivery = requireModule(catalog, "salesDelivery").schema;

const NOW = new Date("2026-08-25T00:00:00Z");
const AMPLE_STOCK = async (): Promise<number> => 1000;

function finishQuery(pendingReviewBaseQty: number) {
  return {
    get: async () => null,
    list: async (entity: string) => {
      throw new Error(`pending-review issue block must not fall back to an actor-scope list (${entity})`);
    },
    invariantAggregate: async (
      entity: string,
      where: Readonly<Record<string, unknown>>,
      through: string | null,
      agg: "sum" | "min",
      measure: string,
    ) => {
      expect(entity).toBe("salesDelivery");
      expect(through).toBe("lines");
      expect(agg).toBe("sum");
      expect(measure).toBe("baseQty");
      expect(where["status"]).toBe("pendingReview");
      return pendingReviewBaseQty;
    },
    balance: async () => 0,
  };
}

function deliveryConfirmQuery(orderStatus: string) {
  return {
    get: async () => ({
      status: orderStatus,
      customerId: "c1",
      productId: "p1",
      baseNetPrice: 100,
      warehouseId: "w1",
    }),
    list: async () => [],
    invariantAggregate: async () => {
      throw new Error("confirm issue does not use the sales-order complete gate");
    },
    balance: AMPLE_STOCK,
  };
}

describe("sales issue starts at pending review", () => {
  it("the initial status is pending review, and confirm issue moves it to shipped", () => {
    expect(salesDelivery.lifecycle.statuses.find((status) => status.initial)).toMatchObject({
      key: "pendingReview",
      label: "pendingReview",
    });
    expect(salesDelivery.lifecycle.transitions.find((edge) => edge.code === "confirm")).toMatchObject({
      from: "pendingReview",
      to: "shipped",
      action: "Confirm issue",
    });
    expect(salesDelivery.lifecycle.transitions.find((edge) => edge.code === "cancel")).toMatchObject({
      from: "pendingReview",
      to: "cancelled",
    });
  });
});

describe("complete: a pending-review issue blocks complete", () => {
  it("complete uses a tenant-wide invariant predicate, and cancel or reversal is not in the filter", () => {
    const complete = salesOrder.preconditions.find((rule) => rule.id === "no_pending_review_delivery_on_complete");
    expect(complete?.check).toMatchObject({
      primitive: "invariant_related_agg",
      params: {
        from: "salesDelivery",
        through: "lines",
        match: "orderId",
        on: "id",
        agg: "sum",
        measure: "baseQty",
        where: { status: "pendingReview" },
        op: "eq",
        right: { value: 0 },
        plus: null,
        readScope: "tenantInvariant",
      },
    });
    expect(complete?.message).toBe("Pending-review sales deliveries are still open, so this order cannot be completed. Confirm issue or cancel those deliveries first.");
    expect(salesOrder.preconditions.some((rule) => rule.id === "fully_shipped")).toBe(false);
    for (const gone of [
      "no_pending_review_delivery_on_finish",
      "no_pending_review_delivery_on_finishShipping",
      "no_pending_review_delivery_on_releaseToComplete",
    ]) {
      expect(salesOrder.preconditions.some((rule) => rule.id === gone), gone).toBe(false);
    }
  });

  it("complete blocks when a pending-review issue exists, and does not use list", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: {
          id: "so-block",
          status: "inProgress",
          totalAmount: 1000,
          customerId: "c1",
        },
        lines: [{ id: "sol-1", baseQty: 100, shippedBaseQty: 60 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: finishQuery(40),
      },
      "complete",
    );

    expect(decision.verdict.pass).toBe(false);
    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "no_pending_review_delivery_on_complete")).toMatchObject({
      ok: false,
      message: "Pending-review sales deliveries are still open, so this order cannot be completed. Confirm issue or cancel those deliveries first.",
    });
  });

  it("a short shipment with no pending-review issue can be completed", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-short", status: "inProgress", totalAmount: 1000, customerId: "c1" },
        lines: [{ id: "sol-1", baseQty: 100, shippedBaseQty: 60 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: finishQuery(0),
      },
      "complete",
    );
    expect(decision.verdict.pass).toBe(true);
  });
});

describe("confirm issue: source sales-order fulfillment uses the stored key", () => {
  it("the gate excludes completed and cancelled, and says to handle the issue before completing the order", () => {
    const rule = salesDelivery.preconditions.find((one) => one.id === "source_order_open_for_delivery");
    expect(rule?.check).toMatchObject({
      primitive: "ref_field_compare",
      params: {
        field: "status",
        op: "not_in",
        right: { value: ["completed", "cancelled"] },
      },
    });
    expect(rule?.message).toBe(
      "The source sales order is already completed or cancelled, so issue cannot be confirmed. Confirm issue or cancel pending-review deliveries before you complete the sales order. An order that has already ended cannot issue again.",
    );
    expect(JSON.stringify(rule?.check?.params)).not.toContain("Approve");
  });

  async function confirmAgainst(orderStatus: string) {
    return await evaluateTransition(
      {
        module: salesDelivery,
        bill: {
          id: "d-1",
          status: "pendingReview",
          totalAmount: 600,
          customerId: "c1",
          warehouseId: "w1",
          deliveryDate: "2026-08-25",
        },
        lines: [{
          orderId: "so-1",
          orderLineId: "sol-1",
          orderLineBaseQty: 100,
          orderWarehouseId: "w1",
          productId: "p1",
          qty: 6,
          unit: "pcs",
          unitFactor: 1,
          baseQty: 6,
          baseUnitPrice: 100,
        }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: deliveryConfirmQuery(orderStatus),
      },
      "confirm",
    );
  }

  it("in progress can confirm issue", async () => {
    const decision = await confirmAgainst("inProgress");
    expect(decision.checks.find((check) => check.id === "source_order_open_for_delivery")?.ok).toBe(true);
    expect(decision.verdict.pass).toBe(true);
  });

  it("completed and cancelled cannot confirm issue, and terminal states stay closed", async () => {
    for (const status of ["completed", "cancelled"]) {
      const decision = await confirmAgainst(status);
      const check = decision.checks.find((one) => one.id === "source_order_open_for_delivery");
      expect(check?.ok, status).toBe(false);
      expect(decision.verdict.pass === false && decision.verdict.level, status).toBe("block");
      expect(check?.message).toBe(
        "The source sales order is already completed or cancelled, so issue cannot be confirmed. Confirm issue or cancel pending-review deliveries before you complete the sales order. An order that has already ended cannot issue again.",
      );
    }
  });
});
