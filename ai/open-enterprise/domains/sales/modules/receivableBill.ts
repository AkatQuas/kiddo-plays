import { defineModule } from "@open-erp/metamodel";

/**
 * Receivable bill: created by sales or finance. Collects the collection plan for several sales orders of one customer.
 * After approval it is collecting. It closes when collection is finished.
 *
 * Closed and small (source: the receivable-bill design, already reviewed; no new blueprint):
 * - Its own fact: a receivable reconciliation and collection plan for some sales orders of one customer.
 *   Sales or finance owns it. It closes when collected or closed by hand.
 * - Separate from the old shipment auto-post path `receivable` / `salesReceipt`. This module neither reuses nor changes them.
 * - Ledger mode: the header receivable amount is typed. Lines only trace the source.
 *   Detail mode: the header amount is the sum of line `receivableAmount` and cannot be typed.
 * - Collected amount is a rollup of receipts (`receivableReceipt`). This module never posts ar/cash (same as payableBill).
 */
export default defineModule({
  label: "Receivable bill",
  numbering: { prefix: "YSDD", seqScope: "day" },
  fields: [
    // The page may leave this blank. A dedicated create entry uses a typed value first, otherwise numbering assigns it, then a non-empty value enters the shared save path.
    { key: "code", label: "Receivable bill no.", type: "string", primary: true, required: true },
    {
      key: "accountingType",
      label: "Accounting mode",
      type: "enum",
      options: [
        { value: "ledger", label: "Ledger" },
        { value: "detail", label: "Detail" },
      ],
      required: true,
      help: "Ledger: type the receivable amount on the header; lines only trace the source. Detail: type an amount on each line; the header is the sum.",
    },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    {
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "customer", through: null, match: "customerId", field: "name" },
    },
    {
      key: "amount",
      label: "Receivable amount",
      type: "money",
      required: true,
      help: "Typed in ledger mode. In detail mode it is filled from the line receivable amounts and must equal the line total.",
    },
    {
      key: "linesReceivableTotal",
      label: "Line receivable total",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(receivableAmount)" },
      help: "Sum of line receivable amounts. In detail mode the header receivable amount must equal this.",
    },
    {
      key: "receivedAmount",
      label: "Amount collected",
      type: "money",
      derive: {
        kind: "rollup",
        from: "receivableReceipt",
        match: "receivableBillId",
        measure: "sum(amount)",
        where: { status: "completed" },
      },
    },
    {
      key: "outstandingAmount",
      label: "Amount outstanding",
      type: "money",
      derive: {
        kind: "formula",
        expr: {
          op: "max",
          args: [
            { value: 0 },
            { op: "sub", args: [{ field: "amount" }, { field: "receivedAmount" }] },
          ],
        },
      },
    },
    { key: "receivableDate", label: "Receivable date", type: "date" },
    { key: "remark", label: "Receivable remark", type: "text" },
    {
      key: "lines",
      label: "Sales orders",
      type: "subtable",
      ref: "receivableBillLine",
      fields: [
        {
          key: "salesOrderId",
          label: "Sales order",
          type: "ref",
          ref: "salesOrder",
          required: true,
          refFilter: { customerId: { from: "$bill.customerId" }, status: ["inProgress", "completed"] },
          help: "Only in-progress or completed sales orders for the same customer.",
        },
        {
          key: "orderDate",
          label: "Order date",
          type: "date",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "orderDate" },
        },
        {
          key: "promiseDate",
          label: "Promise date",
          type: "date",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "promiseDate" },
        },
        {
          key: "orderSource",
          label: "Order source",
          type: "string",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "orderSource" },
        },
        {
          key: "salesperson",
          label: "Salesperson",
          type: "ref",
          ref: "subject",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "salesperson" },
        },
        {
          key: "actualTotal",
          label: "Net total",
          type: "money",
          derive: { kind: "lookup", from: "salesOrder", through: null, match: "salesOrderId", field: "totalAmount" },
        },
        // createdAt and status are platform fields. The framework forbids lookup (live read) of platform fields (allowPlatform=false).
        // Snapshot is the only path: it freezes the sales order's created time and status at the moment the line was added.
        // Created time does not change. Status is frozen and does not follow later sales-order changes
        // (a live status needs the platform to allow lookup of platform fields).
        {
          key: "orderCreatedAt",
          label: "Created at",
          type: "datetime",
          snapshot: { from: "salesOrder", match: "salesOrderId", field: "createdAt" },
        },
        {
          key: "orderStatus",
          label: "Status",
          type: "string",
          snapshot: { from: "salesOrder", match: "salesOrderId", field: "status" },
        },
        {
          key: "receivableAmount",
          label: "Receivable amount",
          type: "money",
          help: "Required in detail mode and included in the header sum. Ignored by the sum in ledger mode.",
        },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      // Pending approval is the initial state and the whole bill is editable. Do not set editable: "none", or the form cannot be filled.
      { key: "pendingApproval", label: "pendingApproval", color: "amber", initial: true },
      { key: "collecting", label: "collecting", color: "blue", editable: "none" },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "gray", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingApproval", to: "collecting", action: "Approve", primary: true, confirm: true },
      { code: "complete", from: "collecting", to: "completed", action: "Complete", confirm: true },
      { code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel", confirm: true },
      { code: "cancel", from: "collecting", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    {
      id: "lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A receivable bill needs at least one sales-order line.",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "customer_required_before_approve",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A customer must be selected before approval.",
      check: { primitive: "required_fields", fields: ["customerId"] },
    },
    {
      id: "ledger_amount_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "In ledger mode the receivable amount must be greater than zero.",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingType" }, op: "eq", right: { value: "ledger" } },
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "detail_lines_amount_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "In detail mode every line receivable amount must be greater than zero.",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingType" }, op: "eq", right: { value: "detail" } },
      check: { primitive: "lines_all", left: { ref: "$line.receivableAmount" }, op: "gt", right: { value: 0 } },
    },
    {
      id: "detail_amount_matches_lines",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "In detail mode the header receivable amount must equal the line receivable total.",
      when: { primitive: "field_compare", left: { ref: "$bill.accountingType" }, op: "eq", right: { value: "detail" } },
      check: { primitive: "field_compare", left: { ref: "$bill.amount" }, op: "eq", right: { ref: "$bill.linesReceivableTotal" } },
    },
  ],
  handoff: [
    {
      id: "notify_finance_approve",
      kind: "todo",
      onStatus: "pendingApproval",
      to: "finance",
      title: "Receivable bill waiting for approval",
      why: "Finance checks the customer and the receivable amount, then approves.",
    },
    {
      id: "notify_sales_approved",
      kind: "notify",
      onTransition: "approve",
      to: "sales-clerk",
      title: "Receivable bill approved",
      why: "Sales follows collection progress.",
    },
  ],
  views: {
    list: {
      columns: [
        "code",
        "customerName",
        "amount",
        "receivedAmount",
        "outstandingAmount",
        "accountingType",
        "status",
        "createdBy",
        "createdAt",
      ],
      filters: ["status", "customerId"],
      searchable: ["code", "customerName"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Receivable bill", fields: ["code", "accountingType", "customerId", "amount", "receivableDate", "remark"] },
      { title: "Sales orders", fields: ["lines"] },
      { title: "Collection progress", fields: ["receivedAmount", "outstandingAmount"] },
    ],
  },
});
