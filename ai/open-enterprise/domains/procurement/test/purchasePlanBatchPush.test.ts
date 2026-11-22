import { evaluateTransition, isSystemSupplied, sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseOrderDraft from "../modules/purchaseOrder.js";
import purchasePlanDraft from "../modules/purchasePlan.js";

const purchaseOrder = sealModule(purchaseOrderDraft, { code: "purchaseOrder", domain: "procurement" });
const purchasePlan = sealModule(purchasePlanDraft, { code: "purchasePlan", domain: "procurement" });

const NOW = new Date("2026-07-30T00:00:00.000Z");
const ACTOR = { id: "buyer-1" };
const EMPTY_QUERY = { get: async () => null, list: async () => [], balance: async () => 0 };

function lineColumns() {
  return purchasePlan.fields.find((field) => field.key === "lines")?.fields ?? [];
}

function lineField(key: string) {
  return lineColumns().find((field) => field.key === key);
}

function toOrderParam() {
  const edge = purchasePlan.lifecycle.transitions.find((one) => one.code === "to_order");
  return edge?.params.find((param) => param.type === "billLines");
}

describe("Purchase plan partial conversion to orders", () => {
  it("to_order declares remaining + billLines, pairs on planLineRef, and seeds qty from quantity still to order", () => {
    const edge = purchasePlan.lifecycle.transitions.find((one) => one.code === "to_order");
    expect(edge).toMatchObject({
      from: "approved",
      to: "approved",
      action: "Turn into purchase order",
      primary: true,
      push: "purchaseOrder",
      remaining: "lines.remainingOrderQty",
    });

    const param = toOrderParam();
    expect(param?.key).toBe("orderLines");
    expect(param?.type).toBe("billLines");
    expect(param?.fixedRows).toBe(false);
    expect(param?.lineField?.fields?.map((field) => field.key)).toEqual([
      "planLineRef",
      "productId",
      "qtyPlanned",
      "occupyingQty",
      "remainingOrderQty",
      "qty",
    ]);
    expect(param?.hiddenColumns).toEqual(["planLineRef"]);
    expect(param?.readOnlyColumns).toEqual(["productId", "qtyPlanned", "occupyingQty", "remainingOrderQty"]);
    expect(param?.seed).toMatchObject({
      from: "lines",
      columns: {
        planLineRef: "id",
        productId: "productId",
        qtyPlanned: "qty",
        occupyingQty: "occupyingQty",
        remainingOrderQty: "remainingOrderQty",
        qty: "remainingOrderQty",
      },
      skipNonPositive: "remainingOrderQty",
    });

    const orderQty = purchaseOrder.fields
      .find((field) => field.key === "lines")
      ?.fields?.find((field) => field.key === "qty");
    expect(orderQty?.refDefault).toBeNull();
    expect(orderQty?.help).toContain("may be reduced");
  });

  it("order-line planLineRef can be filled by push: it is not system-supplied and has no plannerSupplied", () => {
    // Regression: if planLineRef is marked system-supplied (for example plannerSupplied), pushLineValues skips the whole column.
    // The draft line's planLineRef stays empty, pushBillLines cannot pair on it, and conversion reports
    // that the line has no match on the push draft. Push is supposed to fill this column from the source line id.
    const orderLines = purchaseOrder.fields.find((field) => field.key === "lines");
    const columns = orderLines?.fields ?? [];
    const planLineRef = columns.find((field) => field.key === "planLineRef");
    expect(planLineRef?.type).toBe("refLine");
    expect(planLineRef?.ref).toBe("purchasePlan");
    expect(planLineRef?.refOwner).toBe("planLineRefBill");
    expect(planLineRef?.plannerSupplied).not.toBe(true);
    expect(planLineRef?.pushFrom ?? null).toBeNull();
    // Same-layer rule: a refLine back to the source module must not be eaten by any system-supplied test, or push cannot fill it.
    expect(isSystemSupplied(planLineRef!, columns)).toBe(false);
  });

  it("ordered quantity counts only approved orders; occupying includes pending review and excludes closed and cancelled", () => {
    const ordered = lineField("orderedBaseQty");
    expect(ordered?.derive).toMatchObject({
      kind: "rollup",
      from: "purchaseOrder",
      through: "lines",
      match: "planLineRef",
      agg: "sum",
      measure: "baseQty",
      where: { status: ["awaitingReceipt", "receiving", "completed"] },
    });

    const occupying = lineField("occupyingBaseQty");
    expect(occupying?.hidden).toBe(true);
    expect(occupying?.derive).toMatchObject({
      kind: "rollup",
      from: "purchaseOrder",
      through: "lines",
      match: "planLineRef",
      agg: "sum",
      measure: "baseQty",
      where: { status: ["pendingReview", "awaitingReceipt", "receiving", "completed"] },
    });
    const occupyingWhere = (occupying?.derive as { where?: { status?: unknown } } | null)?.where ?? null;
    expect(occupyingWhere?.status).not.toContain("cancelled");
    expect(occupyingWhere?.status).not.toContain("closedOut");

    expect(lineField("remainingOrderBaseQty")?.hidden).toBe(true);
    expect(lineField("occupyingQty")?.hidden).not.toBe(true);
    expect(lineField("remainingOrderQty")?.hidden).not.toBe(true);
  });

  it("to_order is blocked when nothing remains to order; completing the plan still reads ordered quantity, not occupying quantity", async () => {
    const blocked = await evaluateTransition(
      {
        module: purchasePlan,
        bill: { id: "plan-exhausted", status: "approved" },
        lines: [
          { productId: "product-a", remainingOrderQty: 0, orderedBaseQty: 0, baseQty: 10 },
          { productId: "product-b", remainingOrderQty: 0, orderedBaseQty: 4, baseQty: 4 },
        ],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "to_order",
    );
    expect(blocked.verdict.pass).toBe(false);
    expect(blocked.checks.find((check) => check.id === "has_orderable_line")).toMatchObject({
      ok: false,
      message: "Every plan line has already been released to a purchase order, so it cannot be converted again",
    });

    const open = await evaluateTransition(
      {
        module: purchasePlan,
        bill: { id: "plan-open", status: "approved" },
        lines: [{ productId: "product-a", remainingOrderQty: 4, orderedBaseQty: 0, baseQty: 10 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "to_order",
    );
    expect(open.verdict.pass).toBe(true);

    const finishBlocked = await evaluateTransition(
      {
        module: purchasePlan,
        bill: { id: "plan-draft-only", status: "approved" },
        lines: [{ productId: "product-a", remainingOrderQty: 0, occupyingQty: 10, orderedBaseQty: 0, baseQty: 10 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "finish",
    );
    expect(finishBlocked.verdict.pass).toBe(false);
    expect(finishBlocked.checks.find((check) => check.id === "fully_ordered")?.message).toContain("Turn into purchase order");
  });
});
