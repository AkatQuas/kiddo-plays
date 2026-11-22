import { evaluateTransition, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseInvoiceDraft from "../modules/purchaseInvoice.js";
import purchaseOrderDraft from "../modules/purchaseOrder.js";
import purchasePayableDraft from "../modules/purchasePayable.js";
import purchasePaymentDraft from "../modules/purchasePayment.js";
import purchasePlanDraft from "../modules/purchasePlan.js";
import purchaseReceiptDraft from "../modules/purchaseReceipt.js";
import purchaseReturnDraft from "../modules/purchaseReturn.js";
import supplierDraft from "../modules/supplier.js";

const purchaseInvoice = sealModule(purchaseInvoiceDraft, { code: "purchaseInvoice", domain: "procurement" });
const purchaseOrder = sealModule(purchaseOrderDraft, { code: "purchaseOrder", domain: "procurement" });
const purchasePayable = sealModule(purchasePayableDraft, { code: "purchasePayable", domain: "procurement" });
const purchasePayment = sealModule(purchasePaymentDraft, { code: "purchasePayment", domain: "procurement" });
const purchasePlan = sealModule(purchasePlanDraft, { code: "purchasePlan", domain: "procurement" });
const purchaseReceipt = sealModule(purchaseReceiptDraft, { code: "purchaseReceipt", domain: "procurement" });
const purchaseReturn = sealModule(purchaseReturnDraft, { code: "purchaseReturn", domain: "procurement" });
const supplier = sealModule(supplierDraft, { code: "supplier", domain: "procurement" });

const MODULES = [
  supplier,
  purchasePlan,
  purchaseOrder,
  purchaseReceipt,
  purchaseReturn,
  purchaseInvoice,
  purchasePayable,
  purchasePayment,
] as const;

const NOW = new Date("2026-07-30T00:00:00.000Z");
const ACTOR = { id: "procurement-approver-1" };

function failedCheckIds(decision: Awaited<ReturnType<typeof evaluateTransition>>): readonly string[] {
  return decision.checks.filter((check) => !check.ok).map((check) => check.id);
}

function expectBlocked(decision: Awaited<ReturnType<typeof evaluateTransition>>, ids: readonly string[]): void {
  expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
  expect(failedCheckIds(decision)).toEqual(expect.arrayContaining([...ids]));
}

describe("Procurement module contract", () => {
  it.each(MODULES.map((module) => [module.code, module] as const))("%s passes the single-module semantic gate", (_code, module) => {
    expect(validateModule(module).errors).toEqual([]);
  });

  it.each(MODULES.map((module) => [module.code, module] as const))("%s initial status is not draft", (_code, module) => {
    const initial = module.lifecycle.statuses.find((status) => status.initial);
    expect(initial?.key).not.toBe("draft");
    expect(initial?.key).not.toBe("draft");
    expect(module.lifecycle.statuses.some((status) => status.key === "draft" || status.key === "draft")).toBe(false);
  });

  it("the module list and numbering rules are complete and unique in the domain", () => {
    expect(MODULES.map((module) => module.code)).toEqual([
      "supplier",
      "purchasePlan",
      "purchaseOrder",
      "purchaseReceipt",
      "purchaseReturn",
      "purchaseInvoice",
      "purchasePayable",
      "purchasePayment",
    ]);
    expect(new Set(MODULES.map((module) => module.numbering?.prefix)).size).toBe(MODULES.length);
    expect(supplier.numbering?.seqScope).toBe("tenant");
    expect(MODULES.slice(1).every((module) => module.numbering?.seqScope === "day")).toBe(true);
  });

  it("the supplier list sorts by created time descending", () => {
    expect(supplier.views.list.defaultSort).toEqual({ field: "createdAt", desc: true });
  });

  it("purchase-order product: a plan narrows to the plan line, no plan still means an active product, and choosing a plan line brings the product", () => {
    const lines = purchaseOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
    const product = lines.find((field) => field.key === "productId");
    const plan = lines.find((field) => field.key === "planId");
    expect(plan?.defaultFrom).toEqual({ header: "purchasePlanId" });
    expect(product?.refFilter).toEqual({
      status: "active",
      id: { from: "$line.planId", through: "lines", field: "productId" },
    });
    expect(product?.refDefault).toEqual({
      from: "purchasePlan",
      match: "planLineRef",
      through: "lines",
      field: "productId",
    });
  });

  it("a header that mixes products only aggregates money, and does not invent a unitless quantity total", () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      supplier: [],
      purchasePlan: [],
      purchaseOrder: ["totalAmount", "totalTaxAmount", "totalNetAmount"],
      purchaseReceipt: ["totalAmount", "requestedBaseQty"],
      purchaseReturn: ["totalAmount", "requestedBaseQty"],
      purchaseInvoice: [],
      purchasePayable: [],
      purchasePayment: ["lineAmount"],
    };

    for (const module of MODULES) {
      const actual = module.fields.filter((field) => field.lineAgg !== null).map((field) => field.key);
      const expectedFields = expected[module.code];
      if (expectedFields === undefined) throw new Error(`missing the lineAgg acceptance rule for ${module.code}`);
      expect(actual).toEqual(expectedFields);
    }
  });

  it("every line amount is a same-line formula or a save-time calculation", () => {
    for (const module of [purchaseOrder, purchaseReceipt, purchaseReturn]) {
      const lines = module.fields.find((field) => field.key === "lines");
      const amount = lines?.fields?.find((field) => field.key === "amount");
      expect(amount?.derive?.kind === "formula" || amount?.calculate !== null).toBe(true);
    }
  });

  it("the purchase commitment stands alone; confirming receipt or return posts stock, and an exchange issues then receives in the same warehouse", () => {
    const approve = purchaseOrder.lifecycle.transitions.find((edge) => edge.code === "approve");
    expect(approve?.effects.map((effect) => `${effect.target}:${effect.op}`)).toEqual(["ap:reserve"]);
    expect(approve?.effects[0]?.reverseOn).toEqual(["unapprove", "finish", "close"]);

    const receipt = purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "confirm");
    expect(receipt?.effects.map((effect) => `${effect.target}:${effect.op}`)).toEqual(["stock:in"]);
    expect(receipt).toMatchObject({ primary: true, push: null, from: "pendingReview", to: "received" });
    expect(purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "releaseDemand")).toBeUndefined();

    const returned = purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "releaseDemand");
    expect(returned?.effects.map((effect) => `${effect.target}:${effect.op}`)).toEqual(["stock:out"]);
    expect(returned).toMatchObject({ from: "pendingConfirm", to: "returnedGoods", primary: true, push: null });
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "confirmReturn")).toBeUndefined();

    const exchange = purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "confirmExchange");
    expect(exchange?.effects.map((effect) => `${effect.target}:${effect.op}`)).toEqual(["stock:out", "stock:in"]);
    expect(exchange).toMatchObject({ from: "pendingConfirm", to: "exchanged", primary: true, push: null });
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "receiveExchange")).toBeUndefined();

    // purchasePayment was redesigned: no cash:out effect. Payment is reflected by the purchasePayable.paidAmount rollup.
    expect(purchasePayment.lifecycle.transitions.find((edge) => edge.code === "approve")?.effects ?? []).toEqual([]);

    expect(purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "reverse")).toBeUndefined();
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "reverseReturn")).toBeUndefined();
    expect(purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "closeRemainder")).toBeUndefined();
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "closeRemainder")).toBeUndefined();
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "closeExchangeRemainder")).toBeUndefined();
    expect(purchaseReturn.lifecycle.statuses.map((status) => status.key)).not.toContain("returningFromWarehouse");
    expect(purchaseReturn.lifecycle.statuses.map((status) => status.key)).not.toContain("awaitingExchange");
    expect(purchaseReturn.lifecycle.transitions.find((edge) => edge.code === "reverseExchange")).toBeUndefined();
    // purchasePayment was redesigned: no reverse edge, only approve and cancel.
  });

  it("stock posts per product and warehouse, and AP is always on the supplier", () => {
    for (const [module, transition] of [[purchaseReceipt, "confirm"], [purchaseReturn, "releaseDemand"], [purchaseReturn, "confirmExchange"]] as const) {
      const confirm = module.lifecycle.transitions.find((edge) => edge.code === transition);
      const stockEffects = confirm?.effects.filter((effect) => effect.target === "stock") ?? [];
      expect(stockEffects.length).toBeGreaterThan(0);
      for (const stock of stockEffects) {
        expect(stock.subject).toMatchObject({ from: "line", field: "productId" });
        expect(stock.scope).toMatchObject({ from: "bill", field: "warehouseId" });
      }
    }
  });


  it("a purchase plan can be converted again only while at least one line still has quantity to order", async () => {
    const context = {
      module: purchasePlan,
      bill: { id: "plan-orderable", status: "approved" },
      params: {},
      actor: ACTOR,
      now: NOW,
      query: { get: async () => null, list: async () => [], balance: async () => 0 },
    } as const;

    const exhausted = await evaluateTransition({
      ...context,
      lines: [
        { productId: "product-a", remainingOrderQty: 0 },
        { productId: "product-b", remainingOrderQty: 0 },
      ],
    }, "to_order");
    expectBlocked(exhausted, ["has_orderable_line"]);

    const remaining = await evaluateTransition({
      ...context,
      lines: [
        { productId: "product-a", remainingOrderQty: 0 },
        { productId: "product-b", remainingOrderQty: 10 },
      ],
    }, "to_order");
    expect(remaining.verdict.pass).toBe(true);
  });
});

describe("Purchase source chain and posting-coordinate counterexamples", () => {
  it("a plan order is routed off the general approval edge, and the plan edge pins status, warehouse, product, and cumulative quantity", async () => {
    const bill = {
      id: "order-plan",
      status: "pendingReview",
      sourceType: "Purchase plan",
      supplierId: "supplier-a",
      warehouseId: "warehouse-b",
      totalAmount: 20,
    };
    const lines = [{
      planId: "plan-a",
      planLineRef: "plan-a-line-1",
      // planLineRefBill is the header companion of the refLine. Storage fills it from the source-line relationship on push.
      // plan_order_sources_approved and plan_order_warehouses_match_plans load the plan through this column.
      planLineRefBill: "plan-a",
      planLineQty: 10,
      productId: "product-b",
      qty: 2,
      unit: "piece",
      unitFactor: 1,
      baseQty: 2,
      taxPrice: 10,
      baseUnitPrice: 10,
      planLineBaseQty: 10,
      amount: 20,
    }];
    const query = {
      get: async (entity: string, _id: unknown, through?: string | null) => {
        if (entity === "supplier") return { status: "active" };
        if (entity === "purchasePlan" && through === null) return { warehouseId: "warehouse-a" };
        if (entity === "purchasePlan" && through === "lines") return { productId: "product-a" };
        return null;
      },
      list: async (entity: string) => entity === "purchaseOrder" ? [{ baseQty: 9 }] : [],
      balance: async () => 0,
    };

    const routed = await evaluateTransition({ module: purchaseOrder, bill, lines, params: {}, actor: ACTOR, now: NOW, query }, "approve");
    expect(routed.verdict).toMatchObject({ pass: false, level: "route", exit: "approve_plan" });

    const guarded = await evaluateTransition(
      { module: purchaseOrder, bill, lines, params: {}, actor: ACTOR, now: NOW, query },
      "approve_plan",
    );
    expectBlocked(guarded, [
      "plan_order_sources_approved",
      "plan_order_warehouses_match_plans",
      "plan_order_products_match_plan_lines",
      "plan_order_qty_within_plan_lines",
    ]);
  });

  it("a manual order still uses general approval; a legal plan order uses plan approval", async () => {
    const manual = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: {
          id: "order-manual",
          status: "pendingReview",
          sourceType: "Manual",
          supplierId: "supplier-a",
          warehouseId: "warehouse-a",
          purchaseDate: "2026-07-30",
          totalAmount: 20,
        },
        // planId and planLineRef are explicitly null. A real row is produced by column projection:
        // a declared column is always present, and its value is null. Omitting the two cells would
        // test a row shape that does not exist at runtime, and the routing rule "does this document
        // consume plan quantity" looks only at them.
        lines: [{ planId: null, planLineRef: null, productId: "product-a", qty: 2, taxPrice: 10, amount: 20, planArrivalDate: "2026-08-10" }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "active" }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );
    expect(manual.verdict.pass).toBe(true);

    // An empty string and null both mean "no plan line". Clearing a refLine on the form often leaves "".
    const blankString = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: {
          id: "order-manual-blank-string",
          status: "pendingReview",
          sourceType: "Manual",
          supplierId: "supplier-a",
          warehouseId: "warehouse-a",
          purchaseDate: "2026-07-30",
          totalAmount: 20,
        },
        lines: [{ planId: "", planLineRef: "", productId: "product-a", qty: 2, taxPrice: 10, amount: 20, planArrivalDate: "2026-08-10" }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "active" }),
          list: async () => [],
          balance: async () => 0,
        },
      },
      "approve",
    );
    expect(blankString.verdict.pass).toBe(true);

    const planned = await evaluateTransition(
      {
        module: purchaseOrder,
        bill: {
          id: "order-plan-ok",
          status: "pendingReview",
          sourceType: "Purchase plan",
          supplierId: "supplier-a",
          warehouseId: "warehouse-a",
          purchaseDate: "2026-07-30",
          totalAmount: 60,
        },
        lines: [{
          planId: "plan-a",
          planLineRef: "plan-a-line-1",
          planLineRefBill: "plan-a",
          planLineQty: 10,
          productId: "product-a",
          unit: "piece",
          unitFactor: 1,
          qty: 6,
          baseQty: 6,
          planLineBaseQty: 10,
          taxPrice: 10,
          baseUnitPrice: 10,
          amount: 60,
          planArrivalDate: "2026-08-10",
        }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async (entity, _id, through) => {
            if (entity === "supplier") return { status: "active" };
            if (entity === "purchasePlan" && through === null) return { status: "approved", warehouseId: "warehouse-a" };
            if (entity === "purchasePlan" && through === "lines") return { productId: "product-a" };
            return null;
          },
          list: async (entity) => entity === "purchasePlan" ? [{ id: "plan-a" }] : [{ baseQty: 4 }],
          balance: async () => 0,
        },
      },
      "approve_plan",
    );
    expect(planned.verdict.pass).toBe(true);

    // The self-reported sourceType is no longer the routing criterion. An order that says Manual
    // but whose lines are linked to plan lines is still sent from general approval to plan approval.
    // The old criterion let it through, and the purchasePlan.orderedQty rollup matches only
    // planLineRef and ignores sourceType, so plan quantity was consumed by an order that never
    // passed the cumulative gate, with verdict=pass the whole way.
    const lyingSourceType = {
      module: purchaseOrder,
      bill: {
        id: "order-manual-label-plan-lines",
        status: "pendingReview",
        sourceType: "Manual",
        supplierId: "supplier-a",
        warehouseId: "warehouse-a",
        purchaseDate: "2026-07-30",
        totalAmount: 20,
      },
      lines: [{
        planId: "plan-a",
        planLineRef: "plan-a-line-1",
        planLineRefBill: "plan-a",
        planLineQty: 10,
        productId: "product-a",
        unit: "piece",
        unitFactor: 1,
        qty: 2,
        baseQty: 2,
        planLineBaseQty: 10,
        taxPrice: 10,
        baseUnitPrice: 10,
        amount: 20,
        planArrivalDate: "2026-08-10",
      }],
      params: {},
      actor: ACTOR,
      now: NOW,
      query: {
        get: async (entity: string, _id: unknown, through?: string | null) => {
          if (entity === "supplier") return { status: "active" };
          if (entity === "purchasePlan" && through === null) return { status: "approved", warehouseId: "warehouse-a" };
          if (entity === "purchasePlan" && through === "lines") return { productId: "product-a" };
          return null;
        },
        list: async (entity: string) => (entity === "purchasePlan" ? [{ id: "plan-a" }] : [{ baseQty: 4 }]),
        balance: async () => 0,
      },
    };
    const rerouted = await evaluateTransition(lyingSourceType, "approve");
    expect(rerouted.verdict).toMatchObject({ pass: false, level: "route", exit: "approve_plan" });
    // After the route it still passes. The gate stops "skip the cumulative check", not "the label is wrong".
    expect((await evaluateTransition(lyingSourceType, "approve_plan")).verdict.pass).toBe(true);

    // Half the lines have a plan line and half do not. General approval does not accept that either. Split the document first.
    // This asserts only the general-edge side. The plan-edge side throws during evaluation today:
    // `related_agg` with `on: "$line.planLineRef"` and an empty coordinate is `schemaFail` (primitives.ts:616),
    // so the whole decision short-circuits to 500 instead of a block result. A mixed-source order already
    // had that shape before this change (the old criterion also failed to stop a line-level mix). It is
    // reported as a platform item and is not closed in the procurement domain.
    const mixed = {
      ...lyingSourceType,
      bill: { ...lyingSourceType.bill, id: "order-mixed", sourceType: "Purchase plan", totalAmount: 40 },
      lines: [
        lyingSourceType.lines[0]!,
        { planId: null, planLineRef: null, productId: "product-a", qty: 2, taxPrice: 10, amount: 20, planArrivalDate: "2026-08-10" },
      ],
    };
    expect((await evaluateTransition(mixed, "approve")).verdict).toMatchObject({ level: "route", exit: "approve_plan" });
  });

  it("a receipt cannot cite a terminal order or swap supplier, product, or price; a temporary warehouse change is only an explicit warning", async () => {
    const decision = await evaluateTransition(
      {
        module: purchaseReceipt,
        bill: {
          id: "receipt-cross",
          status: "pendingReview",
          supplierId: "supplier-b",
          warehouseId: "warehouse-b",
          totalQty: 1,
          totalAmount: 99,
        },
        lines: [{
          orderId: "order-a",
          orderLineId: "order-a-line-1",
          orderLineBaseQty: 10,
          productId: "product-b",
          unit: "piece",
          unitFactor: 1,
          qty: 1,
          baseQty: 1,
          baseUnitPrice: 99,
          taxPrice: 99,
          amount: 99,
        }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async (entity, _id, through) =>
            entity === "purchaseOrder" && through === null
              ? { status: "completed", supplierId: "supplier-a", warehouseId: "warehouse-a" }
              : { productId: "product-a", baseUnitPrice: 10 },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "confirm",
    );
    expectBlocked(decision, [
      "receipt_orders_receiving",
      "receipt_suppliers_match_orders",
      "receipt_products_match_order_lines",
      "receipt_prices_match_order_lines",
      "warehouse_matches_order",
    ]);
    expect(decision.checks.find((check) => check.id === "warehouse_matches_order")).toMatchObject({ level: "warn", ok: false });
  });

  it("a receipt with a complete source and a cumulative quantity still within the order can be confirmed, and confirm posts stock", async () => {
    const decision = await evaluateTransition(
      {
        module: purchaseReceipt,
        bill: {
          id: "receipt-ok",
          status: "pendingReview",
          supplierId: "supplier-a",
          warehouseId: "warehouse-a",
          receiptDate: "2026-07-30",
          totalQty: 2,
          totalAmount: 20,
        },
        lines: [{
          orderId: "order-a",
          orderLineId: "order-a-line-1",
          orderLineBaseQty: 10,
          productId: "product-a",
          unit: "piece",
          unitFactor: 1,
          qty: 2,
          expectedQty: 2,
          effectiveExpectedQty: 2,
          baseQty: 2,
          baseUnitPrice: 10,
          taxPrice: 10,
          amount: 20,
        }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async (entity, _id, through) =>
            entity === "purchaseOrder" && through === null
              ? { status: "receiving", supplierId: "supplier-a", warehouseId: "warehouse-a" }
              : { productId: "product-a", baseUnitPrice: 10 },
          list: async (entity) => entity === "purchaseOrder" ? [{ id: "order-a" }] : [{ baseQty: 8 }],
          balance: async () => 0,
        },
      },
      "confirm",
    );
    expect(decision.verdict.pass).toBe(true);
    expect(decision.plan.forward.some((effect) => effect.target === "stock" && effect.op === "in")).toBe(true);
  });

  it.each([
    ["Return", "releaseDemand", "return"] as const,
    ["Exchange", "confirmExchange", "exchange"] as const,
  ])("%s cannot cite an invalid receipt or swap supplier, warehouse, product, or price before confirm", async (handlingType, transition, prefix) => {
    const decision = await evaluateTransition(
      {
        module: purchaseReturn,
        bill: {
          id: `return-${handlingType}`,
          status: "pendingConfirm",
          handlingType,
          supplierId: "supplier-b",
          warehouseId: "warehouse-b",
          totalQty: 1,
          totalAmount: 99,
        },
        lines: [{
          receiptId: "receipt-a",
          receiptLineId: "receipt-a-line-1",
          receiptLineBaseQty: 10,
          productId: "product-b",
          unit: "piece",
          unitFactor: 1,
          qty: 1,
          baseQty: 1,
          baseUnitPrice: 99,
          taxPrice: 99,
          amount: 99,
        }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async (entity, _id, through) =>
            entity === "purchaseReceipt" && through === null
              ? { supplierId: "supplier-a", warehouseId: "warehouse-a" }
              : { productId: "product-a", baseUnitPrice: 10 },
          list: async () => [],
          balance: async () => 100,
        },
      },
      transition,
    );
    expectBlocked(decision, [
      `${prefix}_receipts_posted`,
      `${prefix}_suppliers_match_receipts`,
      `${prefix}_warehouses_match_receipts`,
      `${prefix}_products_match_receipt_lines`,
      `${prefix}_prices_match_receipt_lines`,
    ]);
    expect(decision.checks.find((check) => check.id === `${prefix}_warehouses_match_receipts`)).toMatchObject({
      level: "warn",
      ok: false,
    });
  });

  it("the invoice is independent of payment", () => {
    expect(purchaseInvoice.fields.find((field) => field.key === "paymentId")).toBeUndefined();
    expect(purchaseInvoice.fields.find((field) => field.key === "statementId")).toBeUndefined();
    expect(purchaseInvoice.fields.find((field) => field.key === "lines")).toBeUndefined();
    expect(purchaseInvoice.lifecycle.transitions.find((edge) => edge.code === "reverse")).toBeUndefined();
    expect(purchaseInvoice.lifecycle.statuses.find((s) => s.key === "reversed")).toBeUndefined();
  });

  it("payment approval still checks the supplier and line amounts, and is not bound to payable status", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-invalid",
          status: "pendingApproval",
          payableId: "payable-a",
          supplierId: "supplier-b",
          accountingMode: "detail",
          amount: 80,
          lineAmount: 60,
        },
        lines: [{ orderId: "order-a", paymentAmount: 60 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async (module) => module === "purchasePayable"
            ? ({ status: "cancelled", supplierId: "supplier-a", accountingMode: "detail" })
            : ({ status: "completed", supplierId: "supplier-a" }),
          list: async () => [],
          balance: async () => 1000,
        },
      },
      "approve",
    );
    expectBlocked(decision, ["supplier_matches_payable", "detail_mode_total_matches"]);
  });

  it("a payment can still be approved when the payable is already completed", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-after-payable-complete",
          status: "pendingApproval",
          payableId: "payable-a",
          payableAmount: 100,
          supplierId: "supplier-a",
          accountingMode: "total",
          amount: 20,
          lineAmount: 0,
        },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "completed", supplierId: "supplier-a", accountingMode: "total", totalAmount: 100 }),
          list: async () => [],
          balance: async () => 1000,
          invariantAggregate: async () => 0,
        },
      },
      "approve",
    );
    expect(decision.verdict.pass).toBe(true);
  });

  it("total-mode payment approval rejects purchase-order lines", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-total-with-lines",
          status: "pendingApproval",
          payableId: "payable-a",
          supplierId: "supplier-a",
          accountingMode: "total",
          amount: 60,
          lineAmount: 60,
        },
        lines: [{ orderId: "order-a", paymentAmount: 60 }],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "paying", supplierId: "supplier-a", accountingMode: "total" }),
          list: async () => [],
          balance: async () => 1000,
        },
      },
      "approve",
    );
    expectBlocked(decision, ["total_mode_lines_empty"]);
  });

  it("detail settlement follows the payable fact, and approval is rejected when there are no payment lines", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-detail-without-lines",
          status: "pendingApproval",
          payableId: "payable-a",
          payableAmount: 100,
          supplierId: "supplier-a",
          amount: 60,
          lineAmount: 0,
        },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({
            status: "paying",
            supplierId: "supplier-a",
            accountingMode: "detail",
            totalAmount: 100,
          }),
          list: async () => [],
          balance: async () => 1000,
          invariantAggregate: async () => 0,
        },
      },
      "approve",
    );
    expectBlocked(decision, ["detail_mode_lines_required"]);
    expect(decision.checks.find((check) => check.id === "detail_mode_lines_required")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("There are no detail lines"),
    });
  });

  it("total settlement still allows a payment with no lines", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-total-without-lines",
          status: "pendingApproval",
          payableId: "payable-a",
          payableAmount: 100,
          supplierId: "supplier-a",
          accountingMode: "total",
          amount: 60,
          lineAmount: 0,
        },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({
            status: "paying",
            supplierId: "supplier-a",
            accountingMode: "total",
            totalAmount: 100,
          }),
          list: async () => [],
          balance: async () => 1000,
          invariantAggregate: async () => 0,
        },
      },
      "approve",
    );
    expect(decision.checks.find((check) => check.id === "detail_mode_lines_required")).toMatchObject({ ok: true });
  });

  it("payment approval rejects a cumulative payment above the payable amount", async () => {
    const decision = await evaluateTransition(
      {
        module: purchasePayment,
        bill: {
          id: "payment-overpay",
          status: "pendingApproval",
          payableId: "payable-a",
          payableAmount: 100,
          supplierId: "supplier-a",
          accountingMode: "total",
          amount: 20,
          lineAmount: 0,
        },
        lines: [],
        params: {},
        actor: ACTOR,
        now: NOW,
        query: {
          get: async () => ({ status: "paying", supplierId: "supplier-a", accountingMode: "total" }),
          list: async () => [],
          balance: async () => 1000,
          invariantAggregate: async () => 90,
        },
      },
      "approve",
    );
    expectBlocked(decision, ["payable_amount_not_exceeded"]);
  });
});

// ---------------------------------------------------------------------------
// The candidate surface and the rule surface share one source: the picker
// cannot offer what should not be picked, rather than rejecting it after save.
//
// Each case mirrors a precondition that already exists. On the workbook these
// bugs look the same: the user picks a row that looks right, it saves, and
// submit or approval is then rejected. The rejection names the status of the
// referenced document, which the person on the current page reads as their own
// document (WB-BUG-67, WB-BUG-75, WB-BUG-80).
//
// Dropping one entry does not error. That cell falls back to the full candidate
// set, so the pairing has to be pinned here.
// ---------------------------------------------------------------------------
describe("reference candidate filters project approval-time rules onto entry time", () => {
  function fieldAt(module: (typeof MODULES)[number], path: string) {
    const [head, sub] = path.split(".");
    const header = module.fields.find((f) => f.key === head);
    if (sub === undefined) return header;
    return header?.fields?.find((f) => f.key === sub);
  }

  const CASES = [
    // Purchase-order supplier: the active-supplier gate on approve / approve_plan is projected onto entry time.
    {
      module: purchaseOrder,
      path: "supplierId",
      filter: { status: "active" },
      mirrors: ["supplier_active"],
      on: "approve",
    },
    {
      module: purchaseOrder,
      path: "supplierId",
      filter: { status: "active" },
      mirrors: ["plan_supplier_active"],
      on: "approve_plan",
    },
    // Plan-line source on the purchase order: plan_order_sources_approved (the plan must be approved)
    // and plan_order_warehouses_match_plans (the plan receiving warehouse must match this order) on approve_plan.
    {
      module: purchaseOrder,
      path: "lines.planId",
      filter: { status: "approved", warehouseId: { from: "$bill.warehouseId" } },
      mirrors: ["plan_order_sources_approved", "plan_order_warehouses_match_plans"],
      on: "approve_plan",
    },
    // Order source on the purchase receipt: receipt_orders_receiving and receipt_suppliers_match_orders on confirm.
    {
      module: purchaseReceipt,
      path: "lines.orderId",
      filter: { status: "receiving", supplierId: { from: "$bill.supplierId" } },
      mirrors: ["receipt_orders_receiving", "receipt_suppliers_match_orders"],
      on: "confirm",
    },
    {
      module: purchaseReturn,
      path: "lines.receiptId",
      filter: {
        status: "received",
        supplierId: { from: "$bill.supplierId" },
        warehouseId: { from: "$bill.warehouseId" },
      },
      mirrors: ["return_receipts_posted", "return_suppliers_match_receipts"],
      on: "releaseDemand",
    },
  ] as const;

  for (const c of CASES) {
    it(`${c.module.code}.${c.path} candidates are narrowed by ${c.mirrors.join(" / ")}`, () => {
      expect(fieldAt(c.module, c.path)?.refFilter).toEqual(c.filter);

      // The projection does not replace the precondition. What is picked at entry
      // and whether the document is valid when the edge is taken are two moments.
      // A reference disabled after it was selected and before submit is caught only
      // by the latter, so both have to stay.
      for (const id of c.mirrors) {
        const rule = c.module.preconditions.find((p) => p.id === id);
        expect(rule, `${c.module.code} should still have precondition ${id}`).toBeDefined();
        expect(rule?.onTransition).toBe(c.on);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// "Optional on the draft, required on submit" must not collapse into `required: true`.
//
// Hit before (717c294): flipping `required` to true so the receipt date showed a
// required mark broke three things at once. `tables/src` drifted from the declaration,
// the `purchaseOrder.receive` push target was missing the cell (a cross-module gate),
// and the required mark was already supplied by the `required_fields` tier (the renderer
// reads `transitionRequiredFieldsOf`).
// ---------------------------------------------------------------------------
describe("receipt date is the later of the two required tiers", () => {
  it("the field is not required (a pushed pending-review document must be allowed to omit it), and confirm carries required_fields", () => {
    expect(purchaseReceipt.fields.find((f) => f.key === "receiptDate")).toMatchObject({
      type: "date",
      required: false,
    });

    const gate = purchaseReceipt.preconditions.find((p) => p.id === "receipt_date_required");
    expect(gate).toMatchObject({ onTransition: "confirm", level: "block" });
    expect(gate?.check?.primitive).toBe("required_fields");
    expect((gate?.check?.params as { fields: readonly string[] }).fields).toEqual(["receiptDate"]);
  });
});
