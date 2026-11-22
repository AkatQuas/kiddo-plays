import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
const full: ModuleRoleGrant[] = [
  ...["productFamily", "product"].map((module): ModuleRoleGrant => ({ module, actions: ALL, fields: "all", buttons: "all", scope: null })),
  { module: "stockIn", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "stockOut", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "warehouse", actions: ALL, fields: "all", buttons: "all", scope: null },
];
const warehouseClerk = ["productFamily", "product"].map((module): ModuleRoleGrant => ({ module, actions: ALL, fields: "all", buttons: "all", scope: null }));
warehouseClerk.push({ module: "warehouse", actions: ["read", "export"], fields: "all", buttons: [], scope: null });
warehouseClerk.push({ module: "stockIn", actions: ["read"], fields: "all", buttons: [], scope: null });
warehouseClerk.push({ module: "stockOut", actions: ["read"], fields: "all", buttons: [], scope: null });
const productionCoordinator: ModuleRoleGrant[] = [
  ...["product", "warehouse"].map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })),
];
const productionManager: ModuleRoleGrant[] = [
  { module: "product", actions: ["read"], fields: "all", buttons: [], scope: null },
  { module: "stockIn", actions: ["read"], fields: "all", buttons: [], scope: null },
];
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  {
    code: "warehouse-clerk",
    name: "Warehouse clerk",
    description: "Manages warehouse masters, receipts, issues, and stock",
    grants: [
      ...warehouseClerk,
      { systemKey: "system:stockQuery:read" },
    ],
  },
  {
    code: "inventory-manager",
    name: "Inventory manager",
    description: "Start inventory-gain, inventory-loss, and other manual receipt and issue documents, and follow their review",
    grants: ["product", "warehouse"].map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })),
  },
  { code: "buyer", name: "Buyer", description: "Runs purchase plans, inquiries, orders, receipts, returns, and supplier coordination", grants: [
    { module: "warehouse", actions: ["read"], fields: "all", buttons: [], scope: null },
  ] },
  { code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery", grants: [
    ...productionCoordinator,
    { systemKey: "system:stockQuery:read" },
  ] },
  { code: "production-manager", name: "Workshop manager", description: "Maintains manufacturing master data and coordinates shop-floor execution", grants: productionManager },
] } satisfies ProductAuthorizationFragment;
