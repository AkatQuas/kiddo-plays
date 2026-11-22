import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import purchaseInvoiceDraft from "../modules/purchaseInvoice.js";

const purchaseInvoice = sealModule(purchaseInvoiceDraft, { code: "purchaseInvoice", domain: "procurement" });

function field(key: string) {
  const f = purchaseInvoice.fields.find((c) => c.key === key);
  if (!f) throw new Error(`purchaseInvoice is missing field ${key}`);
  return f;
}
function payLine(key: string) {
  const f = (field("payments").fields ?? []).find((c) => c.key === key);
  if (!f) throw new Error(`payments is missing column ${key}`);
  return f;
}

describe("purchaseInvoice payments subtable", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(purchaseInvoice).errors).toEqual([]);
  });
  it("orderId refs purchaseOrder, with supplier and status refFilter", () => {
    expect(payLine("orderId")).toMatchObject({
      type: "ref", ref: "purchaseOrder", required: true,
      refFilter: { status: ["awaitingReceipt", "receiving", "completed"], supplierId: { from: "$bill.supplierId" } },
    });
  });
  it("paymentId refs purchasePayment, with completed and supplier refFilter", () => {
    expect(payLine("paymentId")).toMatchObject({
      type: "ref", ref: "purchasePayment", required: true,
      refFilter: { status: "completed", supplierId: { from: "$bill.supplierId" } },
    });
  });
  it("orderCode, paymentCode, and paymentRemark are lookups and only point at declared fields", () => {
    expect(payLine("orderCode")).toMatchObject({ derive: { kind: "lookup", from: "purchaseOrder", match: "orderId", field: "code" } });
    expect(payLine("paymentCode")).toMatchObject({ derive: { kind: "lookup", from: "purchasePayment", match: "paymentId", field: "code" } });
    expect(payLine("paymentRemark")).toMatchObject({ derive: { kind: "lookup", from: "purchasePayment", match: "paymentId", field: "remark" } });
  });
  it("the reviewed whitelist does not include payments; the subtable locks after review without a lifecycle change", () => {
    const approved = purchaseInvoice.lifecycle.statuses.find((s) => s.key === "reviewed");
    expect(approved).toBeDefined();
    expect(approved?.editableFields ?? []).not.toContain("payments");
  });
});
