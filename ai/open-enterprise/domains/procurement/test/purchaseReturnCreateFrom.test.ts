import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import purchaseReceiptDraft from "../modules/purchaseReceipt.js";
import purchaseReturnDraft from "../modules/purchaseReturn.js";

const purchaseReceipt = sealModule(purchaseReceiptDraft, { code: "purchaseReceipt", domain: "procurement" });
const purchaseReturn = sealModule(purchaseReturnDraft, { code: "purchaseReturn", domain: "procurement" });

function lineFields(module: typeof purchaseReceipt | typeof purchaseReturn) {
  return module.fields.find((field) => field.key === "lines")?.fields ?? [];
}

describe("Purchase return picked from receipt lines", () => {
  it("the declaration passes the single-module semantic gate", () => {
    expect(validateModule(purchaseReturn).errors).toEqual([]);
    expect(validateModule(purchaseReceipt).errors).toEqual([]);
  });

  it("createFrom targets the receipt line, and push no longer copies the whole document", () => {
    expect(purchaseReturn.views.createFrom).toEqual([{
      path: "lines.receiptLineId",
      label: "Push purchase return",
      sourceStatuses: ["received"],
      sourceRemaining: { header: "remainingReturnBaseQty", line: "lines.remainingReturnBaseQty" },
    }]);
    expect(purchaseReceipt.lifecycle.transitions.find((edge) => edge.code === "return_goods")).toBeUndefined();
    expect(purchaseReceipt.lifecycle.transitions.every((edge) => edge.push !== "purchaseReturn")).toBe(true);
  });

  it("handled-on defaults to today, and handling, date, and reason are still not required at the field layer", () => {
    expect(purchaseReturn.fields.find((field) => field.key === "returnDate")).toMatchObject({
      type: "date",
      required: false,
      createDefault: "today",
    });
    expect(purchaseReturn.fields.find((field) => field.key === "handlingType")).toMatchObject({ required: false });
    expect(purchaseReturn.fields.find((field) => field.key === "reason")).toMatchObject({ required: false });
    for (const id of ["handling_type_required", "return_date_required", "reason_required"] as const) {
      expect(purchaseReturn.preconditions.find((rule) => rule.id === id)).toMatchObject({
        onTransition: "releaseDemand",
        level: "block",
      });
    }
    for (const id of ["exchange_handling_type_required", "exchange_return_date_required", "exchange_reason_required"] as const) {
      expect(purchaseReturn.preconditions.find((rule) => rule.id === id)).toMatchObject({
        onTransition: "confirmExchange",
        level: "block",
      });
    }
  });

  it("product, unit, and price are snapshots of the receipt line, and receipt candidates are narrowed by supplier and warehouse", () => {
    const fields = lineFields(purchaseReturn);
    expect(fields.find((field) => field.key === "receiptId")?.refFilter).toEqual({
      status: "received",
      supplierId: { from: "$bill.supplierId" },
      warehouseId: { from: "$bill.warehouseId" },
    });
    expect(fields.find((field) => field.key === "receiptLineId")).toMatchObject({
      type: "refLine",
      required: true,
    });
    expect(fields.find((field) => field.key === "receiptLineId")?.hidden).not.toBe(true);
    expect(fields.find((field) => field.key === "productId")).toMatchObject({
      snapshot: { from: "purchaseReceipt", match: "receiptLineId", through: "lines", field: "productId" },
    });
    expect(fields.find((field) => field.key === "unit")).toMatchObject({
      type: "string",
      snapshot: { from: "purchaseReceipt", match: "receiptLineId", through: "lines", field: "unit" },
    });
    expect(fields.find((field) => field.key === "baseUnitPrice")).toMatchObject({
      snapshot: { from: "purchaseReceipt", match: "receiptLineId", through: "lines", field: "baseUnitPrice" },
    });
    expect(fields.find((field) => field.key === "unit")?.unitChoice ?? null).toBeNull();
  });

  it("quantity still returnable is original receipt minus confirmed returns and exchanges, and there is no returnedQty column", () => {
    const receiptLines = lineFields(purchaseReceipt);
    expect(receiptLines.find((field) => field.key === "returnedQty")).toBeUndefined();
    expect(receiptLines.find((field) => field.key === "returnedBaseQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "purchaseReturn",
      through: "lines",
      match: "receiptLineId",
      where: { status: ["returnedGoods", "exchanged"] },
    });
    expect(receiptLines.find((field) => field.key === "remainingReturnBaseQty")?.derive).toMatchObject({
      kind: "formula",
    });
    expect(purchaseReceipt.fields.find((field) => field.key === "remainingReturnBaseQty")?.derive).toMatchObject({
      kind: "formula",
    });
    const returnLines = lineFields(purchaseReturn);
    expect(returnLines.find((field) => field.key === "receiptLineBaseQty")).toMatchObject({
      hidden: true,
      derive: { kind: "lookup" },
    });
    const overReturn = purchaseReturn.preconditions.find((rule) => rule.id === "not_over_return");
    expect(overReturn?.onTransition).toBe("releaseDemand");
    expect(overReturn?.check?.primitive).toBe("related_agg");
    expect(purchaseReturn.preconditions.find((rule) => rule.id === "exchange_not_over_return")?.onTransition).toBe("confirmExchange");
  });
});
