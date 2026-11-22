import { defineModule } from "@open-erp/metamodel";

/** Production worker master. This module may attach only a team (`orgType=team`). */
export default defineModule({
  label: "Workers",
  numbering: { prefix: "WORKER", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Worker code", type: "string", primary: true, auto: true },
    { key: "name", label: "Name", type: "string", required: true },
    {
      key: "platformUserId",
      label: "Platform user ID",
      type: "ref",
      ref: "subject",
      unique: true,
      refFilter: { status: "active" },
      person: { role: "owner", via: "self" },
      help: "A sync affiliation is written only when this is bound and the worker is on a team; an unbound worker writes nothing",
    },
    // There used to be both `productionOrgId` (ref) and `team` (free text) on one record,
    // with no answer for which was the source of truth. A team is already a node on the
    // organization tree, so only the ref remains.
    {
      key: "productionOrgId",
      label: "Team",
      type: "ref",
      ref: "orgUnit",
      // Create must attach a team. After the organization side clears the link it may be empty;
      // the synced affiliation is deleted with the clear, not merely hidden in the UI.
      requiredOnManualCreate: true,
      // Candidate list and write precondition share one rule: a disabled team is not a valid production coordinate.
      refFilter: { status: "active", orgType: "team" },
    },
    {
      key: "priceType",
      label: "Pricing type",
      type: "enum",
      options: ["Piece rate", "Hourly rate", "Mixed pay"],
      required: true,
      help: "Whether this person's wage is settled by piece, by hour, or both. Blank means Mixed pay: both wages are calculated and added",
    },
    {
      key: "pricingCoefficient",
      label: "Pricing coefficient",
      type: "number",
      // The entry form fills the coefficient only on a default-operation row. A header cell
      // would repeat the row, so it is hidden. The field stays: default-operation defaultFrom
      // and wage resolution still read it (blank counts as 1).
      hidden: true,
      help: "Worker-level default coefficient (not shown on the form). Used when a default-operation row is blank or unmatched. Wage = piece rate × coefficient × qualified quantity; blank counts as 1",
    },
    {
      key: "workerType",
      label: "Worker type",
      type: "enum",
      options: ["Regular employee", "Temporary employee"],
      required: true,
      help: "Employment type. It affects social insurance and the settlement basis",
    },
    { key: "position", label: "Production role", type: "string" },
    { key: "phone", label: "Phone", type: "phone" },
    { key: "skill", label: "Skills", type: "text" },
    // Default operations: several rows means several selections. Dispatch and scheduling can prefer operations this person can do.
    {
      key: "defaultOperations",
      label: "Default operations",
      type: "subtable",
      ref: "workerDefaultOperation",
      fields: [
        {
          key: "operationId",
          label: "Operation",
          type: "ref",
          ref: "operation",
          required: true,
          help: "An operation this person can take by default. Several rows means several selections",
        },
        {
          key: "pricingCoefficient",
          label: "Pricing coefficient",
          type: "number",
          defaultFrom: { header: "pricingCoefficient" },
          help: "Coefficient for this operation. Wage = piece rate × this coefficient × qualified quantity. Blank falls back to the worker header; both blank count as 1",
        },
      ],
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  /**
   * Leaving the company is disable, not a second state machine. The occupancy axis is only
   * disable / enable. "Active" and "Left" are business labels, not another lifecycle.
   *
   * This is a status edge, not a delete. A person who has left still carries facts that already
   * happened: dispatched work, reports, and calculated wages. Deleting them would point those
   * documents at an id that no longer exists, and each document would still look valid (the
   * platform delete gate would refuse the delete for that reason).
   * Leaving means "do not dispatch new work", not "this person was never here".
   *
   * The status key stays `active`: the dispatch candidate list (`processAssignment.workerId`
   * and assignment lines) already says `refFilter: { status: "active" }`. Renaming the key
   * would silently make those lists accept anyone, while the dropdown still looked fine.
   *
   * Not terminal: people come back. Master data has no real end.
   */
  lifecycle: {
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true },
      // A left worker cannot be edited: the row stays so historical documents can still resolve the name.
      { key: "disabled", label: "Left", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Mark as left", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Reinstate" },
    ],
  },

  preconditions: [
    {
      /**
       * Open work blocks leaving.
       *
       * The check reads assignments (`processAssignment.workerId`), not reports.
       * A report is a fact that already happened and does not depend on whether they leave.
       * An assignment is responsibility still owed: if the person leaves, that operation has
       * nobody to claim it, and the assignment itself will not notice.
       *
       * Open means the assignment is still pendingReview, awaitingProduction, or inProduction.
       * completed and cancelled do not count.
       */
      id: "no_open_assignments",
      onTransition: "disable",
      source: "gate",
      level: "block",
      why: "This person still has unfinished assignments. Once they leave, those operations have nobody to claim them. Finish the work or cancel the assignments before marking them as left",
      check: {
        primitive: "related_agg",
        from: "processAssignment",
        through: null,
        match: "workerId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: ["pendingReview", "awaitingProduction", "inProduction"] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
  ],

  views: {
    list: {
      columns: ["code", "name", "platformUserId", "productionOrgId", "priceType", "pricingCoefficient", "workerType", "position", "phone"],
      // primary stays code (unique numbering inside the tenant). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["status", "productionOrgId", "priceType", "workerType"],
      searchable: ["code", "name", "platformUserId", "position", "phone"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      {
        title: "Worker",
        fields: ["code", "name", "platformUserId", "productionOrgId", "position", "phone"],
      },
      // The header coefficient is not on the create/edit form. Fill it on default-operation rows.
      // The header field remains as the stored fallback (blank counts as 1).
      { title: "Employment and pricing", fields: ["priceType", "workerType"] },
      { title: "Default operations", fields: ["defaultOperations"] },
      { title: "Skills", fields: ["skill"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
