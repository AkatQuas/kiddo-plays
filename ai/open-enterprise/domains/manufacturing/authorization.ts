import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";

const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
// Active and disabled BOM rows are not editable, so the permission catalog does not grant update.
const BOM_ACTIONS = ["read", "create", "delete", "export", "import"] as const;
// Routings are maintained on the page, so the permission catalog does not grant export / import.
const ROUTING_ACTIONS = ["read", "create", "update", "delete"] as const;
const modules = ["bom", "defectType", "equipment", "mold", "operation", "orgUnit", "routing", "worker"] as const;
const admin = modules.map((module): ModuleRoleGrant => ({
  module,
  actions: module === "bom" ? BOM_ACTIONS : module === "routing" ? ROUTING_ACTIONS : ALL,
  fields: "all",
  buttons: "all",
  scope: null,
}));

export default {
  roles: [
    { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: admin },
    {
      code: "production-manager",
      name: "Workshop manager",
      description: "Maintains manufacturing master data and coordinates shop-floor execution",
      grants: [...admin],
    },
    {
      code: "buyer", name: "Buyer", description: "Runs purchase plans, inquiries, orders, receipts, returns, and supplier coordination",
      grants: [{ module: "bom", actions: ["read"], fields: "all", buttons: [], scope: null }],
    },
    {
      code: "production-planner", name: "Production planner", description: "Builds the production plan, maintains routings, and releases tasks and assignments",
      grants: ["bom", "routing", "operation", "orgUnit", "worker"].map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })),
    },
    {
      code: "team-leader", name: "Team leader", description: "Views the team's people and tasks and can report work for a member",
      grants: [
        { module: "orgUnit", actions: ["read"], fields: "all", buttons: [], scope: [[{ field: "id", op: "own-org-and-descendants", values: [] }]] },
        { module: "worker", actions: ["read"], fields: "all", buttons: [], scope: [[{ field: "productionOrgId", op: "own-org-and-descendants", values: [] }]] },
      ],
    },
    {
      code: "production-reporter", name: "Production operator", description: "Runs this person's or the team's production tasks and work reports",
      grants: [
        { module: "orgUnit", actions: ["read"], fields: "all", buttons: [], scope: [[{ field: "id", op: "own-org", values: [] }]] },
        { module: "worker", actions: ["read"], fields: "all", buttons: [], scope: [[{ field: "productionOrgId", op: "own-org", values: [] }]] },
        { module: "operation", actions: ["read"], fields: "all", buttons: [], scope: null },
      ],
    },
  ],
  orgTree: { module: "orgUnit", parentField: "parentOrgId", typeField: "orgType" },
  affiliationSyncs: [
    {
      fromModule: "worker",
      userIdField: "platformUserId",
      displayField: "name", // fills only the worker-directory workerName; must not overwrite the platform displayName
      orgField: "productionOrgId",
      orgTypeField: "orgType",
      orgTypeValue: "team",
      activeStatus: "active",
    },
  ],
} satisfies ProductAuthorizationFragment;
