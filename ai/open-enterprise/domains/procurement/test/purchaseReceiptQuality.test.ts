import { evaluateTransition, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseReceiptDraft from "../modules/purchaseReceipt.js";
import purchaseReturnDraft from "../modules/purchaseReturn.js";

const purchaseReceipt = sealModule(purchaseReceiptDraft, { code: "purchaseReceipt", domain: "procurement" });
const purchaseReturn = sealModule(purchaseReturnDraft, { code: "purchaseReturn", domain: "procurement" });

function lineFields(module: typeof purchaseReceipt | typeof purchaseReturn) {
  return module.fields.find((field) => field.key === "lines")?.fields ?? [];
}

describe("Purchase receipt and return do not carry quality inspection", () => {
  it("a receipt keeps planned quantity, actual quantity, unit conversion, and an optional batch, and declares no quality field or quality gate", () => {
    expect(validateModule(purchaseReceipt).errors).toEqual([]);
    const fields = lineFields(purchaseReceipt);
    expect(fields.find((field) => field.key === "qty")).toMatchObject({ type: "number", required: true });
    expect(fields.find((field) => field.key === "expectedQty")).toMatchObject({
      type: "number",
      pushFrom: "qty",
      refDefault: { from: "purchaseOrder", match: "orderLineId", through: "lines", field: "qty" },
    });
    expect(fields.find((field) => field.key === "baseQty")).toMatchObject({ calculate: { op: "mul" } });
    expect(fields.find((field) => field.key === "batchNo")).toMatchObject({ type: "string", required: false });

    const forbidden = /quality|qualified|unqualified/i;
    expect(fields.filter((field) => forbidden.test(`${field.key}:${field.label}`))).toEqual([]);
    expect(purchaseReceipt.preconditions.filter((rule) => forbidden.test(`${rule.id}:${rule.why}`))).toEqual([]);
  });

  it("return quantity is entered explicitly, defaults to quantity still returnable, and is not derived from an unqualified quantity", () => {
    expect(validateModule(purchaseReturn).errors).toEqual([]);
    const fields = lineFields(purchaseReturn);
    const qty = fields.find((field) => field.key === "qty");
    expect(qty).toMatchObject({ type: "number", required: true, pushFrom: "qty" });
    expect(fields.some((field) => /qualified|unqualified/i.test(`${field.key}:${field.label}`))).toBe(false);
  });

  it("confirming a purchase receipt posts stock", async () => {
    const confirm = purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "confirm");
    expect(confirm).toMatchObject({
      from: "pendingReview",
      to: "received",
      primary: true,
      push: null,
    });
    expect(confirm?.effects).toEqual([
      expect.objectContaining({ target: "stock", op: "in" }),
    ]);

    const decision = await evaluateTransition({
      module: purchaseReceipt,
      bill: {
        id: "receipt-1",
        status: "pendingReview",
        supplierId: "supplier-1",
        warehouseId: "warehouse-1",
        receiptDate: "2026-08-11",
      },
      lines: [{
        orderId: "order-1",
        orderLineId: "order-line-1",
        productId: "product-1",
        qty: 5,
        expectedQty: 5,
        effectiveExpectedQty: 5,
        unit: "piece",
        unitFactor: 1,
        baseQty: 5,
        baseUnitPrice: 20,
        orderLineBaseQty: 10,
      }],
      params: {},
      actor: { id: "buyer-1" },
      now: new Date("2026-08-11T08:00:00.000Z"),
      query: {
        get: async (entity: string, _id: unknown, through?: string | null) =>
          entity === "purchaseOrder" && through === null
            ? { status: "receiving", supplierId: "supplier-1", warehouseId: "warehouse-1" }
            : { productId: "product-1", baseUnitPrice: 20 },
        list: async () => [],
        balance: async () => 0,
      },
    }, "confirm");
    expect(decision.verdict.pass).toBe(true);
    expect(decision.plan.forward.some((effect) => effect.target === "stock" && effect.op === "in")).toBe(true);
  });

  it("confirming a return issues stock; confirming an exchange issues and receives in the same warehouse", () => {
    const returned = purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "releaseDemand");
    const exchanged = purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "confirmExchange");
    expect(returned).toMatchObject({
      from: "pendingConfirm",
      to: "returnedGoods",
      primary: true,
      push: null,
    });
    expect(returned?.effects).toEqual([
      expect.objectContaining({ target: "stock", op: "out" }),
    ]);
    expect(exchanged).toMatchObject({
      from: "pendingConfirm",
      to: "exchanged",
      primary: true,
      push: null,
    });
    expect(exchanged?.effects).toEqual([
      expect.objectContaining({ target: "stock", op: "out" }),
      expect.objectContaining({ target: "stock", op: "in" }),
    ]);
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "confirmReturn")).toBeUndefined();
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "receiveExchange")).toBeUndefined();
    expect(purchaseReturn.lifecycle.statuses.map((status) => status.key)).not.toContain("returningFromWarehouse");
    expect(purchaseReturn.lifecycle.statuses.map((status) => status.key)).not.toContain("awaitingExchange");
  });
});
