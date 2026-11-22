import { defineModule } from "@open-erp/metamodel";

/**
 * Receipt: started from a receivable bill in "collecting". Records one actual collection. Approval completes it.
 *
 * Closed and small (source: the receivable-bill design, already reviewed; no new blueprint):
 * - Its own fact: one collection against one receivable bill. Finance owns it. Approval ends it.
 * - One receipt hangs off one receivable bill (1:1). One receivable bill may be collected across many receipts.
 * - Over-collection is allowed. The sum is not checked against the open receivable (prepayment and overpayment).
 * - Progress only. Approval does not post ar/cash (unrelated to the old salesReceipt/receivable path, so nothing is posted twice).
 *   Collected amount on the receivable bill is a rollup of this document.
 * - Accounting mode is snapshotted from the linked receivable bill:
 *   · Ledger: fill header `amount` only. This document needs no sales-order receipt lines.
 *   · Detail: enter this collection per linked sales order (`lines`). Header `amount` must equal the line sum.
 */
export default defineModule({
  label: "Receipt",
  numbering: { prefix: "SKD", seqScope: "day" },
  fields: [
    // The page may leave this blank. A dedicated create entry uses a typed value first, otherwise numbering assigns it, then a non-empty value enters the shared save path.
    { key: "code", label: "Receipt no.", type: "string", primary: true, required: true },
    {
      key: "receivableBillId",
      label: "Receivable bill",
      type: "ref",
      ref: "receivableBill",
      required: true,
      refFilter: { status: "collecting" },
      help: "Only a receivable bill in collecting can be collected. Usually brought in from the Collect action on the receivable-bill list.",
    },
    { key: "amount", label: "Amount collected", type: "money", required: true, help: "In ledger mode, type this collection total. In detail mode it is the sum of this collection on each sales order, and it must match the line total." },
    {
      key: "paymentMethod",
      label: "Payment method",
      type: "enum",
      required: true,
      options: [
        { value: "cash", label: "Cash" },
        { value: "bankTransfer", label: "Bank transfer" },
        { value: "other", label: "Other" },
      ],
    },
    { key: "referenceNo", label: "Bank reference", type: "string" },
    { key: "receiptDate", label: "Receipt date", type: "date", required: true, createDefault: "today" },
    // The detail header has a hard cap (first 10 cells). Receipt date and remark must sit ahead of derived copies,
    // or customerName and the line total push them out of view — the edit dialog can fill them and the detail cannot show them.
    { key: "remark", label: "Receipt remark", type: "text" },
    {
      key: "receivableBillNo",
      label: "Receivable bill no.",
      type: "string",
      derive: { kind: "lookup", from: "receivableBill", through: null, match: "receivableBillId", field: "code" },
    },
    {
      key: "accountingType",
      label: "Accounting mode",
      type: "enum",
      options: [
        { value: "ledger", label: "Ledger" },
        { value: "detail", label: "Detail" },
      ],
      snapshot: { from: "receivableBill", match: "receivableBillId", field: "accountingType" },
      help: "Taken from the selected receivable bill. Ledger fills only the header total. Detail enters this collection per sales order.",
    },
    {
      key: "customerId",
      label: "Customer",
      type: "ref",
      ref: "customer",
      snapshot: { from: "receivableBill", match: "receivableBillId", field: "customerId" },
    },
    {
      key: "receivableAmount",
      label: "Receivable amount",
      type: "money",
      snapshot: { from: "receivableBill", match: "receivableBillId", field: "amount" },
    },
    {
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "customer", through: null, match: "customerId", field: "name" },
    },
    {
      key: "linesReceiptTotal",
      label: "Line collection total",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(receiptAmount)" },
      help: "Sum of this collection on each sales order. In detail mode the header amount must equal this.",
    },
    {
      key: "lines",
      label: "Sales-order collections",
      type: "subtable",
      ref: "receivableReceiptLine",
      fields: [
        {
          key: "salesOrderId",
          label: "Sales order",
          type: "ref",
          ref: "salesOrder",
          required: true,
          refFilter: { customerId: { from: "$bill.customerId" } },
          help: "In detail mode, record this collection per order. Pick a sales order already on the receivable bill.",
        },
        {
          key: "salesOrderNo",
          label: "Sales order no.",
          type: "string",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "code" },
        },
        {
          key: "receiptAmount",
          label: "This collection",
          type: "money",
          help: "Required in detail mode, and included in the header collection total.",
        },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      // Pending approval is the initial state and is editable by default. Do not set editable: "none", or the form cannot be filled.
      { key: "pendingApproval", label: "pendingApproval", color: "amber", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "gray", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "confirm", from: "pendingApproval", to: "completed", action: "Approve", primary: true },
      { code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    {
      id: "amount_positive",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "The amount collected must be greater than zero.",
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "bill_active",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "Collection can be confirmed only while the receivable bill is still collecting.",
      check: { primitive: "ref_field_compare", via: "receivableBillId", entity: "receivableBill", field: "status", op: "eq", right: { value: "collecting" } },
    },
    {
      id: "detail_lines_amount_positive",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "In detail mode, this collection on every sales order must be greater than zero.",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingType" }, op: "eq", right: { value: "detail" } },
      check: { primitive: "lines_all", left: { ref: "$line.receiptAmount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "detail_amount_matches_lines",
      onTransition: "confirm",
      source: "invariant",
      level: "block",
      why: "In detail mode, the header amount collected must equal the sum of this collection on each sales order.",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingType" }, op: "eq", right: { value: "detail" } },
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "eq", right: { ref: "$bill.linesReceiptTotal" } },
    },
  ],
  handoff: [
    {
      id: "notify_finance_confirm",
      kind: "todo",
      onStatus: "pendingApproval",
      to: "finance",
      title: "Receipt waiting for approval",
      why: "Finance checks the amount and the bank reference, then approves.",
    },
  ],
  views: {
    list: {
      columns: ["code", "customerName", "amount", "receivableBillNo", "accountingType", "status", "createdBy", "createdAt"],
      filters: ["status"],
      searchable: ["code", "customerName", "receivableBillNo"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Receipt", fields: ["code", "receivableBillId", "amount", "paymentMethod", "referenceNo", "receiptDate", "remark"] },
      { title: "Receivable", fields: ["receivableBillNo", "accountingType", "customerId", "receivableAmount"] },
      { title: "Sales-order collections", fields: ["lines", "linesReceiptTotal"] },
    ],
    createFrom: [
      {
        path: "receivableBillId",
        label: "Collect",
        // Show Collect only on a receivable bill in collecting (a display gate). The server does not rely on it.
        // The real constraints are receivableBillId.refFilter and the ref_field_compare precondition on confirm.
        sourceStatuses: ["collecting"],
      },
    ],
    workbenches: [],
    attachExisting: [],
    hierarchy: null,
    explosion: null,
    availability: null,
    composite: null,
  },
});
