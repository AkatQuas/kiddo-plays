import { defineModule } from "@open-erp/metamodel";

/** Supplier master. Disabling is a status transition, not a bool that can be rewritten quietly. */
export default defineModule({
  label: "Suppliers",
  // Custom fields are open to the tenant: this table gains a `custom jsonb` column and a GIN index.
  // It is opened because it sits upstream. "Supplier" on a purchase order or a subcontract order
  // is one header ref, so industry fields on the supplier master can pass through that ref onto
  // the document. If the master is not opened, the downstream cell is grey, and the user cannot
  // see that the reason is "the upstream was not opened".
  customFields: true,
  numbering: { prefix: "SUP", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Supplier code", type: "string", primary: true, auto: true },
    {
      key: "name",
      label: "Supplier name",
      type: "string",
      required: true,
      unique: true,
      help: "Cannot duplicate an existing supplier name",
    },
    {
      key: "shortName",
      label: "Short name",
      type: "string",
      help: "Used on narrow lists. It is not part of the duplicate check. The full name is the unique identity",
    },
    {
      key: "address",
      label: "Address",
      type: "string",
      help: "Ship-to address for receipts and returns. A purchase return does not freeze it — shipping uses the current master value",
    },
    { key: "contact", label: "Contact", type: "string" },
    // The label follows the wording already on the master page: contact details, not a phone number specifically.
    { key: "phone", label: "Contact details", type: "phone" },
    {
      // Level is a purchasing management action (place strategic suppliers first; review an eliminated supplier before negotiating).
      // It is a controlled enum, not free text. Free text grows three writings of the same level,
      // then a filter by level never returns the full set, and each row still looks correct on its own.
      key: "level",
      label: "Supplier level",
      type: "enum",
      choiceSet: "procurement.supplierLevel",
      help: "A recorded fact. It does not block documents by itself. To make Eliminated block purchase-order approval, add an explicit gate on purchaseOrder.approve",
    },
    /**
     * Supplier type (3.5.0).
     *
     * "What can this supplier take on": purchasing (sells materials or goods to us) and
     * subcontracting (processes our materials for us).
     *
     * Two bools, not one multi-select enum, because one supplier can be both. That shape was
     * an explicit business requirement. The kernel `enum` is single-valued. Expressing "both"
     * would need a `both` option, and "every supplier that can take subcontract work" becomes
     * `in [subcontract, both]`. Miss `both` and half the rows disappear, while each site still looks correct.
     *
     * Both cells can enter `refFilter`. A subcontract order's supplier cell offers only
     * `canSubcontract`. A purchase order offers only `canPurchase`. The candidate list and the
     * write path share the same condition (see refFilter.ts).
     *
     * There is no literal default (the kernel `createDefault` only accepts today/now), so after
     * migration both cells are empty on existing suppliers. Purchase-order and subcontract-order
     * supplier candidates are therefore not filtered by them yet. Turning the filter on would
     * make the dropdown empty. Open the filter only after existing rows are filled in. That is
     * written on `subcontractOrder.supplierId`.
     */
    {
      key: "canPurchase",
      label: "Purchase supplier",
      type: "bool",
      help: "Purchase orders can be placed with this supplier (buy materials or goods). It can be checked together with Subcontract supplier",
    },
    {
      key: "canSubcontract",
      label: "Subcontract supplier",
      type: "bool",
      help: "Subcontract orders can be placed with this supplier (issue materials for processing). It can be checked together with Purchase supplier",
    },
    { key: "taxNo", label: "Tax id", type: "string" },
    { key: "bankAccount", label: "Collection account", type: "string" },
    { key: "settlementDays", label: "Payment terms (days)", type: "number" },
    {
      key: "openCommitment",
      label: "Open purchase commitment",
      type: "money",
      derive: {
        kind: "rollup",
        from: "purchaseOrder",
        match: "supplierId",
        through: null,
        measure: "sum(totalAmount)",
        where: { status: ["awaitingReceipt", "receiving"] },
      },
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true },
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Enable again" },
    ],
  },

  preconditions: [
    {
      id: "no_open_orders",
      onTransition: "disable",
      source: "gate",
      level: "block",
      why: "Disabling a supplier that still has purchase orders not fully received leaves in-transit responsibility with nowhere to land. Finish or close those orders first",
      check: {
        primitive: "related_agg",
        from: "purchaseOrder",
        match: "supplierId",
        on: "id",
        agg: "count",
        where: { status: ["awaitingReceipt", "receiving"] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "name", "shortName", "canPurchase", "canSubcontract", "address", "contact", "phone", "level", "settlementDays", "openCommitment"],
      // primary is still code (unique numbering inside the tenant). The reference cell shows the name, not the code or the id.
      referenceLabel: ["name"],
      filters: ["status", "level", "canPurchase", "canSubcontract"],
      searchable: ["code", "name", "shortName", "contact", "taxNo"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Basic information", fields: ["code", "name", "shortName", "level", "contact", "phone", "address", "taxNo"] },
      // One supplier can both supply materials and take subcontract work, so these are two checkboxes, not one radio.
      { title: "Supplier type", fields: ["canPurchase", "canSubcontract"] },
      { title: "Settlement", fields: ["bankAccount", "settlementDays", "openCommitment"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
