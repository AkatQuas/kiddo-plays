import { defineModule } from "@open-erp/metamodel";

/**
 * Payment.
 *
 * Created from the pay action on purchasePayable, or created on its own from the payment list.
 * Supports total mode (one amount for the document) and detail mode (a payment amount per linked
 * purchase order). The mode follows the linked purchasePayable.accountingMode.
 *
 * This module no longer posts a cash account directly (no cash:out effect).
 * The paid amount is reflected by the purchasePayable.paidAmount rollup.
 */
export default defineModule({
  label: "Payment",
  numbering: { prefix: "CGFK", seqScope: "day" },
  fields: [
    // The page may leave this empty. A dedicated create entry uses a hand-entered value first,
    // otherwise numbering assigns one, and a non-empty value is what reaches the generic save.
    { key: "code", label: "Payment no.", type: "string", primary: true, required: true },
    {
      key: "payableId",
      label: "Payable",
      type: "ref",
      ref: "purchasePayable",
      required: true,
      refFilter: { supplierId: { from: "$bill.supplierId" } },
      help: "The linked purchase payable. Payment status is not tied to payable status. A payment created from the payment list must fill the payable number by hand.",
    },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    {
      key: "amount",
      label: "Payment amount",
      type: "money",
      required: true,
      help: "Total mode: enter it by hand. Detail mode: the form submits the sum of lines.paymentAmount. Both modes share this field. Do not use lineAgg, or total mode would be cleared to the line total of zero.",
    },
    {
      key: "paymentMethod",
      label: "Payment method",
      type: "enum",
      options: [
        { value: "cash", label: "Cash" },
        { value: "bank_transfer", label: "Bank transfer" },
        { value: "other", label: "Other" },
      ],
      required: true,
    },
    { key: "referenceNo", label: "Bank reference", type: "string" },
    { key: "paymentDate", label: "Payment date", type: "date", required: true, createDefault: "today" },
    { key: "remark", label: "Payment remarks", type: "text" },
    {
      key: "lines",
      label: "Purchase-order payment lines",
      type: "subtable",
      ref: "purchasePaymentLine",
      help: "Used only in detail mode.",
      fields: [
        {
          key: "orderId",
          label: "Purchase order",
          type: "ref",
          ref: "purchaseOrder",
          required: true,
          refFilter: { id: { from: "$bill.payableId", through: "lines", field: "orderId" } },
        },
        { key: "paymentAmount", label: "Payment amount", type: "money", required: true },
      ],
    },
    {
      key: "lineAmount",
      label: "Payment line total",
      type: "money",
      hidden: true,
      lineAgg: { of: "lines", measure: "sum(paymentAmount)" },
    },
    {
      key: "supplierName",
      label: "Supplier name",
      type: "string",
      hidden: true,
      derive: { kind: "lookup", from: "supplier", through: null, match: "supplierId", field: "name" },
    },
    {
      key: "accountingMode",
      label: "Accounting mode",
      type: "enum",
      options: [
        { value: "total", label: "Total" },
        { value: "detail", label: "Detail" },
      ],
      derive: { kind: "lookup", from: "purchasePayable", through: null, match: "payableId", field: "accountingMode" },
    },
    {
      key: "payableAmount",
      label: "Payable amount",
      type: "money",
      hidden: true,
      derive: { kind: "lookup", from: "purchasePayable", through: null, match: "payableId", field: "totalAmount" },
    },
  ],
  lifecycle: {
    statuses: [
      { key: "pendingApproval", label: "pendingApproval", color: "amber", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "whitelist", editableFields: ["referenceNo", "remark"] },
      { key: "cancelled", label: "cancelled", color: "gray", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingApproval", to: "completed", action: "Approve", primary: true },
      { code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    {
      id: "supplier_matches_payable",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The payment supplier must match the payable supplier, so a payment is not recorded against another supplier.",
      check: { primitive: "ref_field_compare", via: "payableId", entity: "purchasePayable", field: "supplierId", op: "eq", right: { ref: "$bill.supplierId" } },
    },
    {
      id: "accounting_mode_matches_payable",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The payment must keep the payable's accounting mode. It must not change how amounts are collected.",
      check: { primitive: "ref_field_compare", via: "payableId", entity: "purchasePayable", field: "accountingMode", op: "eq", right: { ref: "$bill.accountingMode" } },
    },
    {
      id: "amount_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The payment amount must be greater than zero.",
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "payable_amount_not_exceeded",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      message: "This payment exceeds the unpaid amount on the payable.",
      why: "Completed payments against one payable cannot add up to more than the payable amount.",
      check: {
        primitive: "invariant_related_agg",
        from: "purchasePayment",
        through: null,
        match: "payableId",
        on: "payableId",
        agg: "sum",
        measure: "amount",
        where: { status: "completed" },
        op: "lte",
        right: { ref: "$bill.payableAmount" },
        plus: { ref: "$bill.amount" },
      },
    },
    {
      id: "total_mode_lines_empty",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingMode" }, op: "eq", right: { value: "total" } },
      why: "Total mode pays the whole payable. It cannot also carry purchase-order payment lines.",
      check: { primitive: "lines_empty" },
    },
    {
      id: "detail_mode_lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Detail mode must list the purchase orders this payment covers.",
      check: {
        primitive: "lines_required_if_ref_field",
        via: "payableId",
        entity: "purchasePayable",
        field: "accountingMode",
        values: ["detail"],
      },
    },
    {
      id: "detail_mode_line_amount_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingMode" }, op: "eq", right: { value: "detail" } },
      why: "In detail mode every purchase order's payment amount must be greater than zero.",
      check: { primitive: "lines_all", left: { ref: "$line.paymentAmount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "detail_mode_total_matches",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingMode" }, op: "eq", right: { value: "detail" } },
      why: "In detail mode the payment total must equal the sum of the purchase-order payment lines.",
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "eq", right: { ref: "$bill.lineAmount" } },
    },
    {
      id: "detail_order_supplier_matches",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingMode" }, op: "eq", right: { value: "detail" } },
      why: "Payment lines may use only purchase orders of the current supplier.",
      check: { primitive: "ref_field_compare", via: "$line.orderId", entity: "purchaseOrder", field: "supplierId", op: "eq", right: { ref: "$bill.supplierId" } },
    },
  ],
  views: {
    list: {
      columns: ["code", "supplierName", "amount", "payableId", "accountingMode", "paymentMethod", "paymentDate", "status", "createdBy", "createdAt"],
      filters: ["status", "supplierId", "payableId"],
      searchable: ["code", "supplierName"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Payment", fields: ["code", "supplierId", "payableId", "accountingMode", "amount", "paymentMethod", "referenceNo", "paymentDate", "remark"] },
      { title: "Purchase-order payment lines", fields: ["lines"] },
    ],
  },
});
