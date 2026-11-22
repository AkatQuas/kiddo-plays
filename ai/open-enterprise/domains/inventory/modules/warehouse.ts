import { defineModule, singleState } from "@open-erp/metamodel";

/**
 * Warehouse — the sample of the smallest module: one status, no edges, fields only.
 *
 * It shows two things:
 *
 * 1. Not every module needs a state machine. A warehouse has no lifecycle — once created, it stays.
 *    `singleState()` declares a status that is both initial and terminal, instead of omitting
 *    `lifecycle`. Omitting it forces every downstream reader to handle null, while an explicit
 *    single status keeps "buttons come from edges" true on every module (zero edges, zero buttons).
 *    Do not hand-copy its result: `terminal: true` without `editable` is treated as not editable,
 *    which yields master data that can never be changed, and validate does not report it.
 *
 * 2. Cross-domain references. A sales issue names a shipping warehouse, and the warehouse is
 *    inventory master data. A domain is a unit of cohesion, not a wall — the loader's cross-module
 *    reference check reads the whole directory, not one domain.
 */
export default defineModule({
  label: "Warehouses",
  // Same shape as product: the platform assigns the number, with no date segment. See product.ts.
  // Regional meaning (the old seeds WH-SH / WH-BJ) stays on name and address, not in the code.
  // A warehouse moves, gets renamed, and changes from a fabric warehouse into a finished-goods
  // warehouse. The code must not follow that change.
  //
  // The prefix and the label are declared separately. Renaming the label does not rename the prefix.
  // The label is a display name and only affects this screen. The code is what references carry.
  // Codes already printed on location labels, stock counts, and statements must not all go invalid
  // because of one rename.
  numbering: { prefix: "WH", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Warehouse code", type: "string", primary: true, auto: true },
    { key: "name", label: "Warehouse name", type: "string", required: true, unique: true },
    { key: "company", label: "Company", type: "string" },
    { key: "department", label: "Department", type: "string" },
    { key: "contact", label: "Contact", type: "string" },
    { key: "contactPhone", label: "Phone", type: "phone" },
    { key: "address", label: "Address", type: "text" },
  ],

  lifecycle: singleState(),

  views: {
    list: {
      columns: ["code", "name", "company", "department", "contact", "contactPhone"],
      // primary is still code (unique numbering inside the tenant). The reference cell shows the name, not the code or the id.
      referenceLabel: ["name"],
      searchable: ["code", "name"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Basic information", fields: ["code", "name", "company", "department", "contact", "contactPhone", "address"] },
    ],
    // Master data: every role that must pick a warehouse on a document has to be able to see it.
    // Leaving a role out does not make permissions stricter. That role cannot create the document.
  },
});
