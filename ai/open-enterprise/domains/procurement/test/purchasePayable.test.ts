import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import purchasePayableDraft from "../modules/purchasePayable.js";
import purchasePaymentDraft from "../modules/purchasePayment.js";

const purchasePayable = sealModule(purchasePayableDraft, { code: "purchasePayable", domain: "procurement" });
const purchasePayment = sealModule(purchasePaymentDraft, { code: "purchasePayment", domain: "procurement" });

function field(key: string) {
  const found = purchasePayable.fields.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`purchasePayable is missing field ${key}`);
  return found;
}

function lineField(key: string) {
  const found = (field("lines").fields ?? []).find((column) => column.key === key);
  if (!found) throw new Error(`purchasePayable.lines is missing column ${key}`);
  return found;
}

describe("purchasePayable module declaration", () => {
  it("passes the declaration semantic gate", () => {
    expect(validateModule(purchasePayable).errors).toEqual([]);
  });

  it("the initial status is pending approval", () => {
    const initial = purchasePayable.lifecycle.statuses.find((s) => s.initial);
    expect(initial?.key).toBe("pendingApproval");
  });

  it("the payable number may be left empty on the page: a hand-entered value is kept, otherwise the dedicated entry assigns one before a non-empty save", () => {
    expect(field("code")).toMatchObject({
      type: "string",
      primary: true,
      required: true,
      auto: false,
    });
    expect(purchasePayable.numbering).toEqual({ prefix: "CGYK", seqScope: "day" });
  });

  it("the payment number has the same shape as the payable: optional hand entry, not auto", () => {
    const code = purchasePayment.fields.find((candidate) => candidate.key === "code");
    expect(code).toMatchObject({
      type: "string",
      primary: true,
      required: true,
      auto: false,
    });
    expect(purchasePayment.numbering).toEqual({ prefix: "CGFK", seqScope: "day" });
  });

  it("has supplierId, accountingMode, and totalAmount", () => {
    const keys = purchasePayable.fields.map((f) => f.key);
    expect(keys).toContain("supplierId");
    expect(keys).toContain("accountingMode");
    expect(keys).toContain("totalAmount");
  });

  it("the lines subtable has orderId", () => {
    expect(lineField("orderId")).toMatchObject({
      type: "ref",
      ref: "purchaseOrder",
      required: true,
      refFilter: {
        supplierId: { from: "$bill.supplierId" },
        status: ["awaitingReceipt", "receiving", "completed"],
      },
    });
  });

  it("paidAmount rolls up from purchasePayment", () => {
    expect(field("paidAmount")).toMatchObject({
      type: "money",
      derive: {
        kind: "rollup",
        from: "purchasePayment",
        match: "payableId",
        measure: "amount",
        where: { status: "completed" },
      },
    });
  });

  it("outstandingAmount is a formula for the unpaid amount", () => {
    expect(field("outstandingAmount")).toMatchObject({
      type: "money",
      derive: {
        kind: "formula",
        expr: {
          op: "sub",
          args: [{ field: "totalAmount" }, { field: "paidAmount" }],
        },
      },
    });
  });

  it("supplierName is a lookup from supplier", () => {
    expect(field("supplierName")).toMatchObject({
      type: "string",
      hidden: true,
      derive: {
        kind: "lookup",
        from: "supplier",
        through: null,
        match: "supplierId",
        field: "name",
      },
    });
  });

  it("has 4 lifecycle transitions", () => {
    expect(purchasePayable.lifecycle.transitions).toHaveLength(4);
    expect(purchasePayable.lifecycle.transitions).toEqual([
      expect.objectContaining({ code: "approve", from: "pendingApproval", to: "paying" }),
      expect.objectContaining({ code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel" }),
      expect.objectContaining({ code: "complete", from: "paying", to: "completed" }),
      expect.objectContaining({ code: "cancel", from: "paying", to: "cancelled", action: "Cancel" }),
    ]);
  });

  it("completing or cancelling a payable does not check linked payments", () => {
    expect(purchasePayable.preconditions.some((rule) => rule.check?.primitive === "related_agg")).toBe(false);
    expect(purchasePayable.preconditions.map((rule) => rule.id)).not.toEqual(expect.arrayContaining([
      "no_pending_payments_before_complete",
      "no_pending_payments_before_cancel",
    ]));
  });

  it("approving a payable does not check the payable amount", () => {
    expect(purchasePayable.preconditions.filter((rule) => rule.onTransition === "approve")).toEqual([]);
  });

  it("pending approval may edit lines and may not change the supplier", () => {
    const pending = purchasePayable.lifecycle.statuses.find((status) => status.key === "pendingApproval");
    expect(pending?.editableFields).toEqual(["totalAmount", "statementDate", "remark", "lines"]);
    expect(pending?.editableFields).not.toContain("supplierId");
  });

  it("total mode requires a payable amount on create", () => {
    expect(purchasePayable.preconditions).toContainEqual(expect.objectContaining({
      id: "total_mode_amount_required_on_create",
      onTransition: "*",
      onCreate: true,
      when: {
        primitive: "field_compare",
        params: {
          left: { ref: "$bill.accountingMode" },
          op: "eq",
          right: { value: "total" },
        },
      },
      check: { primitive: "required_fields", params: { fields: ["totalAmount"] } },
    }));
  });
});

describe("purchasePayment contract after the redesign", () => {
  it("passes the declaration semantic gate", () => {
    expect(validateModule(purchasePayment).errors).toEqual([]);
  });

  it("has payableId referencing purchasePayable", () => {
    const payable = purchasePayment.fields.find((f) => f.key === "payableId");
    expect(payable).toMatchObject({
      type: "ref",
      ref: "purchasePayable",
      required: true,
      refFilter: { supplierId: { from: "$bill.supplierId" } },
    });
  });

  it("the initial status is pending approval", () => {
    const initial = purchasePayment.lifecycle.statuses.find((s) => s.initial);
    expect(initial?.key).toBe("pendingApproval");
  });

  it("has a cancelled status", () => {
    const cancelled = purchasePayment.lifecycle.statuses.find((s) => s.key === "cancelled");
    expect(cancelled).toBeDefined();
  });

  it("accountingMode is a lookup from purchasePayable", () => {
    const f = purchasePayment.fields.find(f => f.key === "accountingMode");
    expect(f).toMatchObject({
      type: "enum",
      derive: {
        kind: "lookup",
        from: "purchasePayable",
        match: "payableId",
        field: "accountingMode",
      },
    });
  });

  it("supplierName is for the list and search, and is not repeated on the detail form", () => {
    expect(purchasePayment.fields.find((f) => f.key === "supplierName")).toMatchObject({
      hidden: true,
      derive: { kind: "lookup", from: "supplier", match: "supplierId", field: "name" },
    });
  });

  it("the lines subtable has orderId and paymentAmount", () => {
    const lines = purchasePayment.fields.find(f => f.key === "lines");
    const fields = (lines as any)?.fields ?? [];
    const orderId = fields.find((f: any) => f.key === "orderId");
    expect(orderId).toMatchObject({ type: "ref", ref: "purchaseOrder" });
    expect(orderId?.refFilter).toEqual({
      id: { from: "$bill.payableId", through: "lines", field: "orderId" },
    });
    expect(fields.find((f: any) => f.key === "paymentAmount")).toMatchObject({ type: "money" });
  });

  it("approval rechecks the supplier, the cumulative payment cap, and the amount shape of both modes", () => {
    const ids = purchasePayment.preconditions.map((rule) => rule.id);
    expect(ids).toEqual(expect.arrayContaining([
      "supplier_matches_payable",
      "accounting_mode_matches_payable",
      "payable_amount_not_exceeded",
      "total_mode_lines_empty",
      "detail_mode_lines_required",
      "detail_mode_line_amount_positive",
      "detail_mode_total_matches",
      "detail_order_supplier_matches",
    ]));
    expect(purchasePayment.fields.find((f) => f.key === "lineAmount")).toMatchObject({
      hidden: true,
      lineAgg: { of: "lines", measure: "paymentAmount" },
    });
    expect(purchasePayment.fields.find((f) => f.key === "payableAmount")).toMatchObject({
      hidden: true,
      derive: { kind: "lookup", from: "purchasePayable", match: "payableId", field: "totalAmount" },
    });
    expect(purchasePayment.preconditions.find((rule) => rule.id === "detail_mode_lines_required")).toMatchObject({
      when: null,
      check: {
        primitive: "lines_required_if_ref_field",
        params: {
          via: "payableId",
          entity: "purchasePayable",
          field: "accountingMode",
          values: ["detail"],
        },
      },
    });
  });

  it("payment status is not bound to payable status", () => {
    expect(purchasePayment.preconditions.map((rule) => rule.id)).not.toContain("payable_active");
    expect(purchasePayment.fields.find((field) => field.key === "payableId")).toMatchObject({
      refFilter: { supplierId: { from: "$bill.supplierId" } },
    });
  });

  it("purchase-order status does not affect payment approval", () => {
    expect(purchasePayment.preconditions.map((rule) => rule.id)).not.toContain("detail_order_status_allowed");
    expect(purchasePayment.preconditions.some((rule) => {
      if (rule.check?.primitive !== "ref_field_compare") return false;
      const params = rule.check.params as Record<string, unknown>;
      return params["entity"] === "purchaseOrder" && params["field"] === "status";
    })).toBe(false);
  });
});
