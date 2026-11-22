import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { availableTransitions, evaluateTransition } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const salesOrder = requireModule(catalog, "salesOrder").schema;
const customer = requireModule(catalog, "customer").schema;

const NOW = new Date("2026-07-29T00:00:00Z");

describe("sales fulfillment: status collapses to in progress", () => {
  it("approval enters in progress", () => {
    const approve = salesOrder.lifecycle.transitions.find((edge) => edge.code === "approve");
    expect(approve).toMatchObject({ from: "pendingReview", to: "inProgress" });
  });

  it("in progress can ship, release to production, complete, reject, and cancel", () => {
    const codes = availableTransitions(salesOrder, "inProgress").map((edge) => edge.code);
    expect(codes).toEqual([
      "unapprove",
      "ship",
      "complete",
      "cancelRunning",
      "to_production",
    ]);
    expect(salesOrder.lifecycle.transitions.find((edge) => edge.code === "ship")).toMatchObject({
      from: "inProgress",
      to: "inProgress",
      push: "salesDelivery",
    });
    expect(salesOrder.lifecycle.transitions.find((edge) => edge.code === "to_production")).toMatchObject({
      from: "inProgress",
      to: "inProgress",
      push: "productionOrder",
    });
  });

  it("awaiting shipment, shipping, inProduction, closed, and the old release and finish edges are gone", () => {
    expect(salesOrder.lifecycle.statuses.map((status) => status.key)).toEqual([
      "pendingReview",
      "inProgress",
      "completed",
      "cancelled",
    ]);
    for (const gone of [
      "shipInProduction",
      "shipMore",
      "finish",
      "finishShipping",
      "markShipping",
      "close",
      "closeShipping",
      "releaseToShip",
      "releaseToShipping",
      "releaseToComplete",
      "toProductionFromShipping",
    ]) {
      expect(salesOrder.lifecycle.transitions.some((edge) => edge.code === gone), gone).toBe(false);
    }
  });

  it("after the original is cancelled it can be released again: a cancelled production order is not counted as released", () => {
    const lines = salesOrder.fields.find((one) => one.key === "lines");
    const producing = (lines?.fields ?? []).find((one) => one.key === "producingBaseQty");
    const where = (producing?.derive as { where?: { status?: readonly string[] } } | null)?.where;
    expect(where?.status).toEqual(["pendingReview", "awaitingRelease", "releasing", "inProduction", "reported", "finished"]);
    expect(where?.status).not.toContain("cancelled");
  });

  it("disabling a customer treats in progress as still open", () => {
    const rule = customer.preconditions.find((one) => one.id === "no_open_orders");
    const where = (rule?.check as { params?: { where?: { status?: unknown } } } | undefined)?.params?.where;
    expect(where?.status).toEqual(["inProgress"]);
  });

  it("the list has no production-progress column and the form has no production-status cell", () => {
    expect(salesOrder.views.list.columns).not.toContain("productionProgress");
    expect(salesOrder.views.form.flatMap((section) => section.fields)).not.toContain("productionStatus");
    expect(salesOrder.fields.some((field) => field.key === "productionProgress" || field.key === "productionStatus")).toBe(false);
  });

  it("in progress can take ship (a self-loop)", async () => {
    const decision = await evaluateTransition(
      {
        module: salesOrder,
        bill: { id: "so-prod", status: "inProgress", totalAmount: 500, customerId: "c1", warehouseId: "wh-sh" },
        lines: [{ id: "l1", productId: "p1", openBaseQty: 10, openQty: 10 }],
        params: {},
        actor: { id: "u1" },
        now: NOW,
        query: { get: async () => null, list: async () => [], balance: async () => 0 },
      },
      "ship",
    );
    expect(decision.verdict.pass).toBe(true);
  });
});
