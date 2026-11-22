import { defineModule } from "@open-erp/metamodel";

/**
 * Invoice record: the sales-invoice fact.
 *
 * Company name, tax number, address, phone, bank, and account are legal facts frozen at issue time.
 * The customer record only supplies editable starting values. A later change must not rewrite historical invoices.
 * An invoice may stand without a sales order, or its lines may cite several orders.
 */
export default defineModule({
  // Menu name is "Invoice record". The module code stays salesInvoice (changing the code renames the table and every reference).
  label: "Invoice record",
  numbering: { prefix: "XSFP", seqScope: "day" },

  fields: [
    { key: "code", label: "Invoice request no.", type: "string", primary: true, auto: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    // Invoice profile uses `refDefault`: the customer record is a usual value, not a fact.
    // The record supplies a starting value. This invoice may change it. After save it is frozen on the invoice. Lookup must not rewrite history.
    {
      key: "companyName",
      label: "Company name",
      type: "string",
      refDefault: { from: "customer", match: "customerId", through: null, field: "name" },
    },
    {
      key: "taxNo",
      label: "Invoice tax number",
      type: "string",
      refDefault: { from: "customer", match: "customerId", through: null, field: "taxNo" },
    },
    {
      key: "companyAddress",
      label: "Company address",
      type: "string",
      refDefault: { from: "customer", match: "customerId", through: null, field: "invoiceAddress" },
    },
    {
      key: "phoneNumber",
      label: "Phone",
      type: "phone",
      refDefault: { from: "customer", match: "customerId", through: null, field: "invoicePhone" },
    },
    {
      key: "bankName",
      label: "Bank",
      type: "string",
      refDefault: { from: "customer", match: "customerId", through: null, field: "invoiceBank" },
    },
    {
      key: "bankAccount",
      label: "Bank account",
      type: "string",
      refDefault: { from: "customer", match: "customerId", through: null, field: "invoiceAccount" },
    },
    { key: "invoiceNo", label: "Invoice number", type: "string" },
    { key: "invoiceDate", label: "Invoice date", type: "date" },
    { key: "invoiceAmount", label: "Invoice amount", type: "money", required: true },
    {
      key: "sourceFileRef",
      label: "Source file",
      type: "string",
      help: "Stable object reference of the image or PDF on the file platform. A temporary download URL is not a business fact",
    },
    {
      key: "orderLinks",
      label: "Linked sales orders",
      type: "subtable",
      ref: "salesInvoiceOrderLink",
      fields: [
        {
          key: "salesOrderId",
          label: "Sales order",
          type: "ref",
          ref: "salesOrder",
          required: true,
          refFilter: { customerId: { from: "$bill.customerId" }, status: ["inProgress", "completed"] },
          help: "Pick the customer first. Only that customer's in-progress or completed sales orders are listed.",
        },
        {
          // After a sales order is chosen, the client writes a completed receipt when one exists. Saving without a receipt is allowed.
          // This column is not shown on its own (the entry surface hides it in ensureInvoiceReceiptColumns).
          // Do not bind a refFilter to the sales order here — a generic ref candidate cannot hop across the receivable bill.
          // The real filter is `/api/salesInvoice/available-orders` and `order-receipts`.
          key: "receiptId",
          label: "Receipt no.",
          type: "ref",
          ref: "receivableReceipt",
          required: false,
          help: "Filled automatically when the chosen sales order has a completed receipt.",
        },
        { key: "remark", label: "Link note", type: "text" },
      ],
    },
    { key: "remark", label: "Remark", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Created as pending review. Do not set editable: "none": pending review must be editable, or the form cannot be filled.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      {
        key: "invoiced",
        label: "invoiced",
        color: "green",
        editable: "whitelist",
        editableFields: ["sourceFileRef", "remark"],
      },
      { key: "voided", label: "voided", color: "gray", terminal: true },
    ],
    transitions: [
      { code: "issue", from: "pendingReview", to: "invoiced", action: "Issue invoice", primary: true },
      {
        code: "void",
        from: "invoiced",
        to: "voided",
        action: "Void",
        confirm: true,
        params: [{ key: "reason", label: "Void reason", type: "text", required: true }],
      },
    ],
  },

  preconditions: [
    {
      id: "invoice_amount_positive",
      onTransition: "issue",
      source: "invariant",
      level: "block",
      why: "An invoice request must be a positive amount. A negative invoice must not open a reversal channel",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.invoiceAmount" },
        op: "gt",
        right: { value: 0 },
      },
    },
    {
      id: "customer_active",
      onTransition: "issue",
      source: "gate",
      level: "block",
      why: "At issue the customer must still be active. A disabled customer must not receive a new valid invoice",
      check: {
        primitive: "ref_field_compare",
        via: "customerId",
        entity: "customer",
        field: "status",
        op: "eq",
        right: { value: "active" },
      },
    },
  ],

  handoff: [
    {
      id: "notify_finance_review",
      kind: "todo",
      onStatus: "pendingReview",
      to: "finance",
      title: "Invoice request waiting for review",
      why: "A recognized or hand-entered invoice request becomes an invoice fact only after finance checks the company details and the amount",
    },
    {
      id: "notify_sales_issued",
      kind: "notify",
      onTransition: "issue",
      to: "sales-representative",
      title: "Invoice issued",
      why: "After issue, sales delivers the invoice to the customer and follows collection",
    },
  ],

  views: {
    list: {
      columns: [
        "code",
        "invoiceNo",
        "customerId",
        "companyName",
        "companyAddress",
        "phoneNumber",
        "bankName",
        "bankAccount",
        "invoiceDate",
        "invoiceAmount",
        "status",
      ],
      filters: ["status", "customerId", "invoiceDate"],
      searchable: [
        "code",
        "invoiceNo",
        "companyName",
        "taxNo",
        "companyAddress",
        "phoneNumber",
        "bankName",
        "bankAccount",
        "sourceFileRef",
      ],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      {
        title: "Invoice",
        fields: [
          "code",
          "customerId",
          "companyName",
          "taxNo",
          "companyAddress",
          "phoneNumber",
          "bankName",
          "bankAccount",
          "invoiceNo",
          "invoiceDate",
          "invoiceAmount",
        ],
      },
      { title: "Sales source", fields: ["orderLinks"] },
      { title: "Source file", fields: ["sourceFileRef"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
