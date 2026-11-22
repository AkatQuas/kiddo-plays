import { defineModule } from "@open-erp/metamodel";

/** Mold master, attached to a factory, and optionally limited to several products. */
export default defineModule({
  label: "Molds",
  numbering: { prefix: "MOLD", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Mold code", type: "string", primary: true, auto: true },
    { key: "name", label: "Mold name", type: "string", required: true },
    // Shares `manufacturing.moldType` with `moldType` on the operation:
    // the operation says which class it needs, the mold says which class it is, and scheduling can match them.
    { key: "moldType", label: "Mold type", type: "enum", choiceSet: "manufacturing.moldType" },
    // Candidates are factories only. Same shape as production order `productionOrgId`:
    // without refFilter every organization enters the dropdown. Candidate list and write
    // share `resolveRefFilter`, so a non-factory id also fails with REF_FILTER_MISMATCH.
    {
      key: "productionOrgId",
      label: "Production organization",
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "factory" },
    },
    // A mold or fixture is tooling that makes the thing, so applicable products are makeable items.
    // A mold for a purchased button is the supplier's concern, not this plant's asset.
    // Single-state master data does not filter on `status`: the row stays editable. Adding that
    // filter would refuse even an owner change on every mold that ever cited a product after
    // that product was disabled (see the header note on bom).
    // One mold can cover several products. That is a subtable, not a single applicableProductId.
    {
      key: "applicableProducts",
      label: "Applicable products",
      type: "subtable",
      ref: "moldApplicableProduct",
      fields: [
        {
          key: "productId",
          label: "Product",
          type: "ref",
          ref: "product",
          required: true,
          refFilter: { canProduce: true },
        },
      ],
    },
    { key: "specification", label: "Specification", type: "string" },
    { key: "assetNo", label: "Asset number", type: "string" },
    { key: "manager", label: "Mold owner", type: "string" },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  /**
   * 3.5.0: a mold can be disabled (scrap, seal, repair).
   *
   * This is a status edge, not an `enabled` boolean. A boolean "disable" is an ordinary field
   * edit: no edge, no precondition, no audit, and nobody can later say when the mold stopped
   * or who stopped it. Same shape as equipment, customer, supplier, and product masters.
   *
   * Not terminal: a disabled mold can be enabled again. Master data has no real end.
   */
  lifecycle: {
    statuses: [
      { key: "active", label: "In use", color: "green", initial: true },
      { key: "disabled", label: "Disabled", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Enable" },
    ],
  },

  views: {
    list: {
      columns: ["code", "name", "moldType", "productionOrgId", "specification", "manager"],
      // primary stays code (unique numbering inside the tenant). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["status", "productionOrgId", "moldType"],
      searchable: ["code", "name", "specification", "assetNo"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Mold", fields: ["code", "name", "moldType", "productionOrgId"] },
      { title: "Applicable products", fields: ["applicableProducts"] },
      { title: "Specification and custody", fields: ["specification", "assetNo", "manager"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
