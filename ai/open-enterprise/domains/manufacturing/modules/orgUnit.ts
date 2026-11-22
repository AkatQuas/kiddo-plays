import { defineModule } from "@open-erp/metamodel";

/**
 * Organization unit: the only organization source in this workspace. Call it an organization.
 *
 * The type dictionary can grow. This stage does not check parent/child types (skipping a level
 * is allowed; a dirty tree is left alone).
 * The ancestor cache is fully meaningful for assignment snapshots only when the tree happens
 * to be factory, then workshop, then line, then team.
 */
export default defineModule({
  label: "Organizations",
  numbering: { prefix: "ORG", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Organization code", type: "string", primary: true, auto: true },
    { key: "name", label: "Organization name", type: "string", required: true },
    {
      key: "orgType",
      label: "Organization type",
      type: "enum",
      choiceSet: "manufacturing.orgType",
      required: true,
    },
    {
      key: "parentOrgId",
      label: "Parent organization",
      type: "ref",
      ref: "orgUnit",
      refFilter: { status: "active" },
    },
    { key: "address", label: "Address", type: "string" },
    {
      key: "leaderWorkerId",
      label: "Owner",
      type: "ref",
      ref: "subject",
      refFilter: { status: "active" },
      help: "A system account. The stored value is the platform userId",
      person: { role: "owner", via: "self" },
    },
    { key: "contactPhone", label: "Phone", type: "phone" },
    {
      key: "ancWorkshopId",
      label: "Workshop",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "orgUnit", match: "parentOrgId", through: null, field: "parentOrgId", optional: true },
    },
    {
      key: "ancFactoryId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      snapshot: { from: "orgUnit", match: "parentOrgId", through: null, field: "ancWorkshopId", optional: true },
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      {
        key: "active",
        label: "Active",
        color: "green",
        initial: true,
        editable: "whitelist",
        editableFields: ["name", "parentOrgId", "address", "contactPhone", "leaderWorkerId", "remark"],
      },
      {
        key: "disabled",
        label: "Disabled",
        color: "gray",
        editable: "whitelist",
        editableFields: ["name", "parentOrgId", "address", "contactPhone", "leaderWorkerId", "remark"],
      },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Re-enable", confirm: true },
    ],
  },

  preconditions: [
    {
      id: "no_active_child_org",
      onTransition: "disable",
      source: "gate",
      level: "block",
      why: "An organization cannot be disabled while it still has active child organizations",
      message: "This organization still has active child organizations. Disable those children first",
      check: {
        primitive: "related_agg",
        from: "orgUnit",
        through: null,
        match: "parentOrgId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: "active" },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
    {
      id: "no_bound_worker",
      onTransition: "disable",
      source: "gate",
      level: "block",
      why: "An organization cannot be disabled while production workers are still attached to it",
      message: "Production workers are still attached to this organization. Move them to another organization, or mark them as left, before disabling it",
      check: {
        primitive: "related_agg",
        from: "worker",
        through: null,
        match: "productionOrgId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: "active" },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
  ],

  views: {
    attachExisting: [{ path: "worker.productionOrgId", label: "Add existing workers", targetLabel: "Workers", hostFilter: { orgType: "team", status: "active" } }],
    hierarchy: { parent: "parentOrgId", level: "orgType", label: "name" },
    list: {
      columns: ["code", "name", "orgType", "parentOrgId", "leaderWorkerId", "status"],
      // primary stays code (unique numbering inside the tenant). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["status", "orgType", "parentOrgId"],
      searchable: ["code", "name"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Organization", fields: ["code", "name", "orgType", "parentOrgId", "leaderWorkerId"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
