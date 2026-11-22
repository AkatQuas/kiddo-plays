import { defineModule } from "@open-erp/metamodel";

/**
 * Purchase payable entered by hand.
 *
 * It stands beside the old payableStatement (generated from warehouse posting). They do not replace each other.
 * The user picks the supplier and the purchase orders, then creates the document. Total and detail accounting
 * modes are both supported. The mode comes from the purchaseAccountingMode setting and cannot change after the document is created.
 */
export default defineModule({
  label: "Purchase payable",
  numbering: { prefix: "CGYK", seqScope: "day" },
  fields: [
    // The page may leave this empty. A dedicated create entry uses a hand-entered value first,
    // otherwise numbering assigns one, and a non-empty value is what reaches the generic save.
    { key: "code", label: "Payable no.", type: "string", primary: true, required: true },
    {
      key: "accountingMode",
      label: "Accounting mode",
      type: "enum",
      required: true,
      options: [
        { value: "total", label: "Total" },
        { value: "detail", label: "Detail" },
      ],
      help: "Read from system settings. It cannot change after the document is created.",
    },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    {
      key: "totalAmount",
      label: "Payable amount",
      type: "money",
      help: "Total mode: enter it by hand. Detail mode: the form submits the sum of lines.payableAmount. Both modes share this field. Do not use lineAgg, or total mode would be cleared to the line total of zero.",
    },
    {
      key: "paidAmount",
      label: "Amount paid",
      type: "money",
      derive: {
        kind: "rollup",
        from: "purchasePayment",
        through: null,
        match: "payableId",
        measure: "sum(amount)",
        where: { status: "completed" },
      },
    },
    {
      key: "outstandingAmount",
      label: "Amount unpaid",
      type: "money",
      derive: {
        kind: "formula",
        expr: { op: "sub", args: [{ field: "totalAmount" }, { field: "paidAmount" }] },
      },
    },
    { key: "statementDate", label: "Payable date", type: "date" },
    {
      key: "lines",
      label: "Purchase-order lines",
      type: "subtable",
      ref: "purchasePayableLine",
      fields: [
        {
          key: "orderId",
          label: "Purchase order",
          type: "ref",
          ref: "purchaseOrder",
          required: true,
          refFilter: {
            supplierId: { from: "$bill.supplierId" },
            status: ["awaitingReceipt", "receiving", "completed"],
          },
        },
        { key: "sourceType", label: "Source type", type: "string" },
        { key: "sourceNo", label: "Source no.", type: "string" },
        { key: "purchasePlanId", label: "Linked purchase plan", type: "ref", ref: "purchasePlan" },
        { key: "purchaseDate", label: "Purchase date", type: "date" },
        { key: "warehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse" },
        {
          key: "orderAmount",
          label: "Order amount",
          type: "money",
          snapshot: { from: "purchaseOrder", match: "orderId", through: null, field: "totalAmount" },
        },
        {
          key: "payableAmount",
          label: "Payable amount",
          type: "money",
          // Cannot be declared required. This cell is filled only in detail mode, and a declared
          // required is unconditional. In total mode (one totalAmount on the header) the line has
          // no amount, and a required declaration makes save return 400: "Purchase-order lines,
          // row 1, Payable amount is required".
          // Detail-mode required is checked by the form dialog (PayableFormModal.handleSave).
          // The declaration layer has no primitive for "required when a header field has a value"
          // (required_fields only acts on $bill, and lines_all can only compare each line).
          help: "Detail mode only: enter an amount for each purchase order. In total mode the header totalAmount carries the amount and the line stays empty.",
        },
        {
          key: "pendingPayableAmount",
          label: "Amount still to pay",
          type: "money",
          help: "Detail mode only: purchase-order total minus payable amounts on payables pending approval, minus amounts on payables being paid, minus actual payments on cancelled payables. The displayed minimum is 0.",
        },
        { key: "orderCode", label: "Purchase order no.", type: "string", derive: { kind: "lookup", from: "purchaseOrder", through: null, match: "orderId", field: "code" } },
      ],
    },
    { key: "supplierName", label: "Supplier name", type: "string", hidden: true, derive: { kind: "lookup", from: "supplier", through: null, match: "supplierId", field: "name" } },
    { key: "remark", label: "Payable remarks", type: "text" },
  ],
  lifecycle: {
    statuses: [
      {
        key: "pendingApproval",
        label: "pendingApproval",
        color: "amber",
        initial: true,
        editable: "whitelist",
        // The supplier cannot change after create. Purchase lines may be edited, including row deletion, while pending approval.
        editableFields: ["totalAmount", "statementDate", "remark", "lines"],
      },
      { key: "paying", label: "paying", color: "blue", editable: "none" },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "gray", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingApproval", to: "paying", action: "Approve", primary: true },
      { code: "cancel", from: "pendingApproval", to: "cancelled", action: "Cancel", confirm: true },
      { code: "complete", from: "paying", to: "completed", action: "Complete", confirm: true },
      { code: "cancel", from: "paying", to: "cancelled", action: "Cancel", confirm: true },
    ],
  },
  preconditions: [
    {
      id: "total_mode_amount_required_on_create",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      when: {
        primitive: "field_compare",
        left: { ref: "$bill.accountingMode" },
        op: "eq",
        right: { value: "total" },
      },
      why: "Total mode must enter a payable amount.",
      check: { primitive: "required_fields", fields: ["totalAmount"] },
    },
    {
      id: "lines_required_on_create",
      onTransition: "*",
      onCreate: true,
      source: "invariant",
      level: "block",
      why: "A purchase payable must select at least one purchase-order line, so this payable has a subject.",
      check: { primitive: "lines_not_empty" },
    },
  ],
  views: {
    list: {
      columns: ["code", "supplierName", "totalAmount", "paidAmount", "outstandingAmount", "accountingMode", "status", "createdBy", "createdAt"],
      // The reference shows only the payable number. Without this pin, labelFieldsOf appends the
      // second list column supplierName, and the payment's "Payable no." cell becomes
      // "CGYK-… supplier name", stacked next to Supplier name and Accounting mode.
      referenceLabel: ["code"],
      filters: ["status", "supplierId"],
      searchable: ["code", "supplierName"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Payable", fields: ["code", "accountingMode", "supplierId", "totalAmount", "statementDate", "remark"] },
      { title: "Purchase-order lines", fields: ["lines"] },
      { title: "Payment progress", fields: ["paidAmount", "outstandingAmount"] },
    ],
  },
});
