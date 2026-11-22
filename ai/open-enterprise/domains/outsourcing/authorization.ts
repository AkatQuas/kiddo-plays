import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
// Subcontract issues and receipts are not created by hand, so this catalog does not grant delete.
const NO_DELETE = ["read", "create", "update", "export", "import"] as const;
const full: ModuleRoleGrant[] = [
  { module: "subcontractIssue", actions: NO_DELETE, fields: "all", buttons: "all", scope: null },
  { module: "subcontractMaterialReturn", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "subcontractOrder", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "subcontractReceipt", actions: NO_DELETE, fields: "all", buttons: "all", scope: null },
  { module: "subcontractReturn", actions: ALL, fields: "all", buttons: "all", scope: null },
];
const readOnly = ["subcontractIssue", "subcontractMaterialReturn", "subcontractOrder", "subcontractReceipt", "subcontractReturn"] as const;
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  { code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock", grants: readOnly.map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })) },
  { code: "sales-clerk", name: "Sales", description: "Maintains customers and sales orders, starts delivery, returns, and exchanges, and tracks completion", grants: [
    // The sales-order complete / cancelRunning planner must list and get subcontract orders to cascade force-complete and cancel.
    { module: "subcontractOrder", actions: ["read"], fields: "all", buttons: [], scope: null },
  ] },
  { code: "buyer", name: "Buyer", description: "Runs purchase plans, inquiries, orders, receipts, returns, and supplier coordination", grants: full },
  { code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery", grants: readOnly.map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })) },
  { code: "production-manager", name: "Workshop manager", description: "Maintains manufacturing master data and coordinates shop-floor execution", grants: [
    // The production-order and task close planner also needs to read subcontract orders.
    { module: "subcontractOrder", actions: ["read"], fields: "all", buttons: [], scope: null },
  ] },
] } satisfies ProductAuthorizationFragment;
