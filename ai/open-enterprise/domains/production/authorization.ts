import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
// Material requirements are created upstream and are not editable in any status, so this catalog does not grant update or delete.
const REQUIREMENT_ACTIONS = ["read", "create", "export", "import"] as const;
const modules = ["materialRequirement", "productionOrder"] as const;
const full = modules.map((module): ModuleRoleGrant => ({
  module,
  actions: module === "materialRequirement" ? REQUIREMENT_ACTIONS : ALL,
  fields: "all",
  buttons: "all",
  scope: null,
}));
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  { code: "production-manager", name: "Workshop manager", description: "Maintains manufacturing master data and coordinates shop-floor execution", grants: full },
  { code: "production-planner", name: "Production planner", description: "Builds the production plan, maintains routings, and releases tasks and assignments", grants: full },
  { code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery", grants: modules.map((module): ModuleRoleGrant => ({ module, actions: ["read", "export"], fields: "all", buttons: [], scope: null })) },
  { code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock", grants: [
    { module: "productionOrder", actions: ["read"], fields: "all", buttons: [], scope: null },
  ] },
], scopeTargets: [
  { policy: "own-org-and-descendants", module: "productionOrder", field: "productionOrgId", walkUpToType: "factory" },
] } satisfies ProductAuthorizationFragment;
