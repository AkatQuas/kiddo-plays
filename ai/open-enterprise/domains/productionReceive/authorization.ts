import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
const full: ModuleRoleGrant[] = [
  { module: "materialIssue", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "materialReturn", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "productionReceipt", actions: ALL, fields: "all", buttons: "all", scope: null },
];
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  { code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock", grants: [
    { module: "materialIssue", actions: ["read"], fields: "all", buttons: [], scope: null },
    { module: "materialReturn", actions: ["read"], fields: "all", buttons: [], scope: null },
    { module: "productionReceipt", actions: ["read", "update"], fields: "all", buttons: ["Confirm stock-in"], scope: null },
  ] },
  { code: "production-manager", name: "Workshop manager", description: "Maintains manufacturing master data and coordinates shop-floor execution", grants: ["materialIssue", "materialReturn", "productionReceipt"].map((module): ModuleRoleGrant => ({ module, actions: ["read", "create", "update"], fields: "all", buttons: "all", scope: null })) },
] } satisfies ProductAuthorizationFragment;
