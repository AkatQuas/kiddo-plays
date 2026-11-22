import { defineModule } from "@open-erp/metamodel";

/**
 * Customer master — the master-data shape.
 *
 * Master data has a lifecycle too: active and disabled. Do not use an `enabled` boolean.
 * That would make "disable" an ordinary field edit, with no edge, no precondition, no
 * todo, and no audit trail. The state machine makes disable a gated handoff. The
 * precondition below is the gate.
 *
 * `status` is not in fields. The framework supplies it. Views and rules may reference it,
 * but declaring it again would be a second source of truth.
 */
export default defineModule({
  label: "Customer",
  // Same shape as product: the platform assigns the number, with no date segment. See product.ts.
  numbering: { prefix: "KH", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Customer code", type: "string", primary: true, auto: true, help: "Assigned on save, for example KH-0001" },
    {
      key: "name",
      label: "Customer name",
      type: "string",
      required: true,
      unique: true,
      help: "Must not duplicate an existing customer name",
    },
    // The short name is what lists and document headers actually show (a full legal name does not fit a column).
    // Two customers may share a short name. What must be unique in the tenant is the full name. `code` is a platform number, not a business name.
    { key: "shortName", label: "Short name", type: "string" },
    { key: "address", label: "Address", type: "string" },
    { key: "contact", label: "Contact", type: "string" },
    { key: "phone", label: "Phone", type: "phone" },
    {
      key: "servicePriority",
      label: "Service priority",
      type: "enum",
      choiceSet: "sales.customerServicePriority",
      help: "Used for delivery and shortage impact analysis. The scale runs Normal, Key, Urgent from low to high. Empty means not yet assessed, which is not the same as Normal",
    },
    // ── Invoice profile ─────────────────────────────────────────────────
    //
    // Invoice identity is customer name + tax number + invoice address + invoice phone + bank + account.
    // There is no separate invoice title. The name is who the invoice is issued to.
    //
    // This group is current master data (defaults), not historical fact. `taxNo` on an invoice
    // is still an independent column frozen at issue time. Do not turn it into a lookup of this
    // group: one tax-number edit would rewrite every historical invoice, and those are documents already issued.
    { key: "taxNo", label: "Tax number", type: "string" },
    { key: "invoiceAddress", label: "Invoice address", type: "string" },
    { key: "invoicePhone", label: "Invoice phone", type: "phone" },
    { key: "invoiceBank", label: "Bank", type: "string" },
    { key: "invoiceAccount", label: "Bank account", type: "string" },
    { key: "settlementDays", label: "Payment terms (days)", type: "number", help: "Days after shipment before the amount is due" },
    { key: "remark", label: "Remark", type: "text" },
  ],

  lifecycle: {
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true },
      // Not terminal: a disabled customer can be enabled again. Master data has no real end.
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Enable" },
    ],
  },

  preconditions: [
    {
      id: "no_open_orders",
      onTransition: "disable",
      source: "gate",
      level: "block",
      why: "A disabled customer cannot take new orders. Open orders would stall halfway, so finish in-progress orders before disabling",
      check: {
        primitive: "related_agg",
        from: "salesOrder",
        match: "customerId",
        on: "id",
        agg: "count",
        // Open means still fulfillable: inProgress.
        where: { status: ["inProgress"] },
        op: "eq",
        right: { value: 0 },
        // This document is a customer, not a sales order, so it is not in that row set and is not counted
        plus: null,
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "name", "shortName", "servicePriority", "contact", "phone", "settlementDays"],
      // primary stays code (the unique platform number). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["status", "servicePriority"],
      // Short name is searchable: callers usually give the short name, not the legal name or the code
      searchable: ["code", "name", "shortName", "contact"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Basics", fields: ["code", "name", "shortName", "contact", "phone", "address"] },
      // Invoice fields are their own group: finance only needs this section
      { title: "Invoice profile", fields: ["taxNo", "invoiceAddress", "invoicePhone", "invoiceBank", "invoiceAccount"] },
      { title: "Other", fields: ["remark"] },
    ],
    // A customer is master data. Who can see it and who owns the account are different questions.
    // A self scope does not mean "a salesperson sees only their customers". It means they cannot
    // pick a customer when ordering — the reference dropdown and the list share one scope, so a
    // salesperson who cannot see customers cannot create a sales order.
    // Commercial ownership belongs on the document, not in visibility.
  },
});
