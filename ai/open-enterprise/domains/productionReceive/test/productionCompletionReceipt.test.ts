import { evaluateTransition, sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import productionReceiptDraft, { planners } from "../modules/productionReceipt/index.js";

const productionReceipt = sealModule(productionReceiptDraft, { code: "productionReceipt", domain: "productionReceive" });

const NOW = new Date("2026-08-06T08:00:00.000Z");

describe("A completion receipt is one document for one task", () => {
  it("stock posts only when the receipt is confirmed; pending review occupies the available inbound quantity", () => {
    const release = productionReceipt.lifecycle.transitions.find((edge) => edge.code === "releaseDemand");
    expect(release).toMatchObject({ from: "pendingReview", to: "completed", action: "Confirm stock-in", primary: true });
    expect(release?.effects).toEqual([]);

    expect(productionReceipt.lifecycle.statuses.find((status) => status.key === "pendingReview")?.initial).toBe(true);
    expect(productionReceipt.lifecycle.transitions.find((edge) => edge.code === "audit")).toBeUndefined();
    expect(productionReceipt.lifecycle.statuses.map((status) => status.key)).not.toContain("Awaiting work");
    expect(productionReceipt.fields.find((field) => field.key === "productionCompletionId")).toBeUndefined();
    expect(productionReceipt.fields.find((field) => field.key === "productionTaskId")).toMatchObject({
      type: "ref",
      ref: "productionTask",
      required: true,
    });
    expect(productionReceipt.fields.find((field) => field.key === "inboundQty")).toMatchObject({
      type: "number",
      required: true,
    });
    expect(productionReceipt.fields.find((field) => field.key === "handlerId")).toMatchObject({
      type: "ref",
      ref: "subject",
      required: true,
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    });
    expect(productionReceipt.preconditions.find((one) => one.id === "receipt_completion_available")).toBeUndefined();
    expect(Object.keys(planners).sort()).toEqual(["releaseDemand"]);
  });

  it("confirming the receipt plans, creates, and approves a goods receipt", async () => {
    const plan = await planners.releaseDemand({
      module: "productionReceipt",
      transition: "releaseDemand",
      bill: {
        id: "receipt-1",
        revision: 1,
        header: {
          code: "FGIN-001",
          productionTaskId: "task-1",
          inboundQty: 4,
          handlerId: "keeper-1",
          receiptDate: "2026-08-06",
        },
        lines: {
          lines: [{
            productId: "product-1",
            warehouseId: "warehouse-1",
            qty: 4,
            unit: "piece",
            batchNo: null,
          }],
        },
      },
      params: {},
      read: {
        async getBill(module, id) {
          if (module === "productionTask" && id === "task-1") {
            return { id, revision: 1, header: { status: "inProduction" }, lines: { processLines: [{ approvedQualifiedQty: 4 }] } };
          }
          throw new Error(`unexpected ${module}/${id}`);
        },
        async listBills() { return { rows: [], total: 0 }; },
        async invariantBillSummary() { return { total: 1, value: 4 }; },
        async invariantLineSummary() { return { total: 0, value: null }; },
      },
    });

    expect(plan.commands).toEqual([
      expect.objectContaining({
        type: "createBill",
        commandId: "stock-in-001",
        module: "stockIn",
        header: expect.objectContaining({
          type: "productionReceipt",
          warehouseId: "warehouse-1",
          productionReceiptId: "receipt-1",
          productionTaskId: "task-1",
          applyTime: "2026-08-06",
        }),
        lines: { lines: [{ productId: "product-1", unit: "piece", quantity: 4, remark: "Source production receipt: FGIN-001" }] },
      }),
      {
        type: "setStatus",
        commandId: "stock-in-001-approve",
        target: { kind: "createdId", commandId: "stock-in-001" },
        transition: "approve",
        expectedStatus: "pending",
      },
    ]);
  });

  it("the header snapshots product name, specification, SKU, and specification remark", () => {
    const sku = productionReceipt.fields.find((field) => field.key === "skuCode");
    const specRemark = productionReceipt.fields.find((field) => field.key === "specRemark");
    expect(sku).toMatchObject({
      label: "SKU code",
      snapshot: { from: "product", match: "productId", through: null, field: "barcode" },
    });
    expect(specRemark).toMatchObject({
      label: "Specification note",
      snapshot: { from: "product", match: "productId", through: null, field: "remark" },
    });
    expect(productionReceipt.fields.find((field) => field.key === "spec")?.snapshot).toMatchObject({
      from: "product",
      match: "productId",
      field: "spec",
    });
  });

  it("an in-production task can confirm the receipt", async () => {
    const decision = await evaluateTransition(
      {
        module: productionReceipt,
        bill: {
          id: "receipt-running",
          status: "pendingReview",
          productionOrderId: "order-1",
          productionTaskId: "task-1",
          productId: "product-1",
          receiptDate: "2026-08-06",
          handlerId: "keeper-1",
          warehouseId: "warehouse-1",
          inboundQty: 4,
        },
        lines: [{
          productionTaskId: "task-1",
          productId: "product-1",
          warehouseId: "warehouse-1",
          qty: 4,
          unit: "piece",
          unitFactor: 1,
          baseQty: 4,
        }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: null, conversionRate: null }
            : {
                productionOrderId: "order-1",
                productId: "product-1",
                completionWarehouseId: "warehouse-1",
                status: "inProduction",
              },
          list: async () => [],
          invariantAggregate: async () => 0,
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );
    expect(decision.checks.find((check) => check.id === "receipt_task_completed")?.ok).toBe(true);
    expect(decision.checks.find((check) => check.id === "receipt_qty_header_positive")?.ok).toBe(true);
  });
});
