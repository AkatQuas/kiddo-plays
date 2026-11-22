import { defineModule } from "@open-erp/metamodel";

/** Production equipment master, attached to an organization. */
export default defineModule({
  label: "Equipment",
  numbering: { prefix: "EQUIP", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Equipment code", type: "string", primary: true, auto: true },
    { key: "name", label: "Equipment name", type: "string", required: true },
    // Candidates are production lines only. Same shape as a mold attached to a factory:
    // equipment sits on the line so scheduling lines up.
    // Without refFilter, factory, workshop, and team all enter the dropdown. That is the live miss.
    // Candidate list and write share one condition, so a non-line id also fails with REF_FILTER_MISMATCH.
    {
      key: "productionOrgId",
      label: "Production organization",
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "line" },
    },
    // 3.5.0: free text became the equipment-type choice set (`manufacturing.equipmentType`).
    // It is the same value set as `equipmentType` on the operation: the operation says which
    // class it needs, the equipment says which class it is. Two free-text copies never match.
    { key: "category", label: "Equipment type", type: "enum", choiceSet: "manufacturing.equipmentType", required: true },
    { key: "model", label: "Specification", type: "string" },
    { key: "serialNo", label: "Serial number", type: "string" },
    { key: "manufacturer", label: "Manufacturer", type: "string" },
    { key: "commissionedDate", label: "Commissioning date", type: "date" },
    {
      key: "manager",
      label: "Equipment owner",
      type: "ref",
      ref: "subject",
      refFilter: { status: "active" },
      help: "A system account. The stored value is the platform userId",
      person: { role: "owner", via: "self" },
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  /**
   * 3.5.0: equipment can be disabled (overhaul, scrap, transfer).
   *
   * This is a status edge, not an `enabled` boolean. A boolean "disable" is an ordinary field
   * edit: no edge, no precondition, no audit, and nobody can later say when the machine stopped
   * or who stopped it. Same shape as customer, supplier, and product masters.
   *
   * Not terminal: disabled equipment can be enabled again. Master data has no real end.
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
      columns: ["code", "name", "productionOrgId", "category", "model", "serialNo", "manager"],
      // primary stays code (unique numbering inside the tenant). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["status", "productionOrgId", "category"],
      searchable: ["code", "name", "model", "serialNo", "manufacturer"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Equipment", fields: ["code", "name", "productionOrgId", "category", "model", "serialNo"] },
      { title: "Commissioning", fields: ["manufacturer", "commissionedDate", "manager"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
