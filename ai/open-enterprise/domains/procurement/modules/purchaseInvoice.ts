import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "Invoice booking",
  numbering: { prefix: "PI", seqScope: "day" },
  fields: [
    { key: "code", label: "Invoice register no.", type: "string", primary: true, auto: true },
    { key: "invoiceNo", label: "Supplier invoice no.", type: "string", required: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "invoiceDate", label: "Invoice date", type: "date", required: true },
    { key: "receivedDate", label: "Received on", type: "date", required: true },
    { key: "totalAmount", label: "Amount incl. tax", type: "money", required: true },
    {
      // References a system account. The value is the platform userId. via:self means the value is already an account.
      key: "buyer", label: "Buyer", type: "ref", ref: "subject",
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    },
    { key: "supplierName", label: "Supplier name", type: "string", derive: { kind: "lookup", from: "supplier", through: null, match: "supplierId", field: "name" } },
    { key: "remark", label: "Remarks", type: "text" },
    { key: "payments", label: "Payments", type: "subtable", ref: "purchaseInvoicePaymentLine", fields: [
      { key: "orderId", label: "Purchase order", type: "ref", ref: "purchaseOrder", required: true,
        refFilter: { status: ["awaitingReceipt", "receiving", "completed"], supplierId: { from: "$bill.supplierId" } } },
      { key: "paymentId", label: "Linked payment", type: "ref", ref: "purchasePayment", required: true,
        refFilter: { status: "completed", supplierId: { from: "$bill.supplierId" } } },
      { key: "orderCode", label: "Purchase order no.", type: "string", derive: { kind: "lookup", from: "purchaseOrder", through: null, match: "orderId", field: "code" } },
      { key: "paymentCode", label: "Payment no.", type: "string", derive: { kind: "lookup", from: "purchasePayment", through: null, match: "paymentId", field: "code" } },
      { key: "paymentRemark", label: "Payment note", type: "string", derive: { kind: "lookup", from: "purchasePayment", through: null, match: "paymentId", field: "remark" } },
    ]},
  ],
  lifecycle: {
    statuses: [
      // Created as pending review. Do not set editable: "none". Pending review must be editable, or the form cannot be filled.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      { key: "reviewed", label: "reviewed", color: "green", terminal: true, editable: "whitelist", editableFields: ["remark"] },
      { key: "voided", label: "voided", color: "red", terminal: true },
    ],
    transitions: [
      { code: "approve", from: "pendingReview", to: "reviewed", action: "Approve", primary: true },
      { code: "void", from: "pendingReview", to: "voided", action: "Void", confirm: true },
    ],
  },
  preconditions: [
    { id: "amount_positive", onTransition: "approve", source: "invariant", level: "block", why: "The invoice amount must be positive", check: { primitive: "field_compare", left: { ref: "$bill.totalAmount" }, op: "gt", right: { value: 0 } } },
    { id: "received_after_invoice", onTransition: "approve", source: "gate", level: "warn", message: "The received date is earlier than the invoice date. Confirm it.", why: "The dates are usually entered the wrong way around", check: { primitive: "field_compare", left: { ref: "$bill.receivedDate" }, op: "gte", right: { ref: "$bill.invoiceDate" } } },
  ],
  handoff: [
    { id: "notify_finance", kind: "todo", onStatus: "pendingReview", to: "finance", title: "Invoice booking is pending review", why: "Finance needs to check the document" },
  ],
  views: {
    list: { columns: ["code", "invoiceNo", "supplierId", "invoiceDate", "receivedDate", "totalAmount", "status"], filters: ["status", "supplierId"], searchable: ["code", "invoiceNo"], defaultSort: { field: "createdAt", desc: true } },
    form: [{ title: "Invoice", fields: ["code", "invoiceNo", "supplierId", "invoiceDate", "receivedDate", "buyer", "totalAmount"] }, { title: "Other", fields: ["remark"] }, { title: "Linked payments", fields: ["payments"] }],
  },
});
