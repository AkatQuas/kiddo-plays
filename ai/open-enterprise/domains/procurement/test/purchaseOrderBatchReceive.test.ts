import { evaluateTransition, sealModule, transitionAt } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseOrderDraft from "../modules/purchaseOrder.js";
import purchaseReceiptDraft from "../modules/purchaseReceipt.js";

const purchaseOrder = sealModule(purchaseOrderDraft, { code: "purchaseOrder", domain: "procurement" });
const purchaseReceipt = sealModule(purchaseReceiptDraft, { code: "purchaseReceipt", domain: "procurement" });

const NOW = new Date("2026-07-30T00:00:00.000Z");
const ACTOR = { id: "warehouse-clerk-1" };
const EMPTY_QUERY = { get: async () => null, list: async () => [], balance: async () => 0 };

function lineColumns() {
  return purchaseOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
}

function lineField(key: string) {
  return lineColumns().find((field) => field.key === key);
}

describe("Purchase order partial receipt", () => {
  it("Receive on both awaitingReceipt and receiving declares remaining + billLines, pairs on orderLineId, and seeds qty from quantity still to receive", () => {
    for (const from of ["awaitingReceipt", "receiving"] as const) {
      const edge = transitionAt(purchaseOrder, from, "receive");
      expect(edge.remaining).toBe("lines.remainingReceiveQty");
      expect(edge.push).toBe("purchaseReceipt");
      expect(edge.primary).toBe(true);

      const param = edge.params.find((one) => one.type === "billLines");
      expect(param?.key).toBe("receiveLines");
      expect(param?.type).toBe("billLines");
      expect(param?.fixedRows).toBe(true);
      expect(param?.lineField?.fields?.map((field) => field.key)).toEqual([
        "orderLineId",
        "productId",
        "qtyOrdered",
        "occupyingQty",
        "remainingReceiveQty",
        "qty",
      ]);
      expect(param?.hiddenColumns).toEqual(["orderLineId"]);
      expect(param?.readOnlyColumns).toEqual(["productId", "qtyOrdered", "occupyingQty", "remainingReceiveQty"]);
      expect(param?.seed).toMatchObject({
        from: "lines",
        columns: {
          orderLineId: "id",
          productId: "productId",
          qtyOrdered: "qty",
          occupyingQty: "occupyingQty",
          remainingReceiveQty: "remainingReceiveQty",
          qty: "remainingReceiveQty",
        },
        skipNonPositive: "remainingReceiveQty",
      });
    }

    expect(purchaseOrder.lifecycle.transitions
      .filter((edge) => edge.code === "receive")
      .map((edge) => [edge.from, edge.to, edge.action])).toEqual([
      ["awaitingReceipt", "receiving", "Receive"],
      ["receiving", "receiving", "Receive"],
    ]);

    const receiptQty = purchaseReceipt.fields
      .find((field) => field.key === "lines")
      ?.fields?.find((field) => field.key === "qty");
    expect(receiptQty?.refDefault).toBeNull();
    expect(receiptQty?.help).toContain("may be less");
  });

  it("received counts only received receipts; occupying includes pending review and received, not cancelled or the old reversed status", () => {
    const received = lineField("receivedBaseQty");
    expect(received?.label).toBe("Received quantity (primary unit)");
    expect(received?.derive).toMatchObject({
      kind: "rollup",
      from: "purchaseReceipt",
      through: "lines",
      match: "orderLineId",
      agg: "sum",
      measure: "baseQty",
      where: { status: "received" },
    });

    const occupying = lineField("occupyingBaseQty");
    expect(occupying?.hidden).toBe(true);
    expect(occupying?.derive).toMatchObject({
      kind: "rollup",
      from: "purchaseReceipt",
      through: "lines",
      match: "orderLineId",
      agg: "sum",
      measure: "baseQty",
      where: { status: ["pendingReview", "received"] },
    });
    const occupyingWhere = (occupying?.derive as { where?: { status?: unknown } } | null)?.where ?? null;
    expect(occupyingWhere?.status).not.toContain("cancelled");
    expect(occupyingWhere?.status).not.toContain("reversed");

    expect(lineField("remainingReceiveBaseQty")?.hidden).toBe(true);
    expect(lineField("receivedQty")?.hidden).not.toBe(true);
    expect(lineField("occupyingQty")?.hidden).not.toBe(true);
    expect(lineField("remainingReceiveQty")?.hidden).not.toBe(true);

    const formProgress = purchaseOrder.views.form.find((group) => group.title === "Amounts and receipt progress");
    expect(formProgress?.fields).toEqual(["totalAmount", "totalTaxAmount", "totalNetAmount"]);
    expect(formProgress?.fields).not.toContain("receivedBaseQty");
    expect(formProgress?.fields).not.toContain("occupyingBaseQty");
    expect(formProgress?.fields).not.toContain("remainingReceiveBaseQty");
  });

  it("when nothing remains to receive, Receive is blocked by the same gate on both statuses", async () => {
    const blockedMore = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: { id: "po-exhausted", status: "receiving" },
        lines: [
          { productId: "product-a", qty: 10, remainingReceiveQty: 0 },
          { productId: "product-b", qty: 4, remainingReceiveQty: 0 },
        ],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "receive",
    );
    expect(blockedMore.verdict.pass).toBe(false);
    expect(blockedMore.verdict.pass === false && blockedMore.verdict.level).toBe("block");
    expect(blockedMore.checks.find((check) => check.id === "receive_has_remaining")).toMatchObject({
      ok: false,
      message: "Every line has already been released to a receipt or is fully received, so it cannot be received again",
    });

    const blockedFirst = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: { id: "po-first", status: "awaitingReceipt" },
        lines: [{ productId: "product-a", qty: 10, remainingReceiveQty: 0 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "receive",
    );
    expect(blockedFirst.verdict.pass).toBe(false);
    expect(blockedFirst.checks.find((check) => check.id === "receive_has_remaining")).toMatchObject({
      ok: false,
      message: "Every line has already been released to a receipt or is fully received, so it cannot be received again",
    });

    const open = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: { id: "po-open", status: "receiving" },
        lines: [{ productId: "product-a", qty: 10, remainingReceiveQty: 4 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: EMPTY_QUERY,
      },
      "receive",
    );
    expect(open.verdict.pass).toBe(true);
  });
});
