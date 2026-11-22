import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
const full: ModuleRoleGrant[] = [
  { module: "customer", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "receivableBill", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "receivableReceipt", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "salesDelivery", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "salesInvoice", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "salesOrder", actions: ALL, fields: "all", buttons: "all", scope: null },
];
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  { code: "finance", name: "Finance", description: "Record receipts and payments, allocate open items, and maintain cash accounts", grants: [
    ...["receivableBill", "receivableReceipt"].map((module): ModuleRoleGrant => ({ module, actions: ALL, fields: "all", buttons: "all", scope: null })),
    { module: "salesInvoice", actions: ALL, fields: "all", buttons: "all", scope: null },
  ] },
  { code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock", grants: [
    // Pending-review sales deliveries are confirmed by the warehouse. Before confirm, the issue date may be filled in. Cancel keeps the voided fact.
    { module: "salesDelivery", actions: ["read", "update"], fields: "all", buttons: ["Confirm issue", "Cancel"], scope: null },
    // The shipment-completion planner must read issued quantity per order line so it auto-closes only when every line is delivered.
    // Read only: no edit, no export, and no public sales-order action.
    { module: "salesOrder", actions: ["read"], fields: "all", buttons: [], scope: null },
  ] },
  { code: "sales-clerk", name: "Sales", description: "Maintains customers and sales orders, starts delivery, returns, and exchanges, and tracks completion", grants: [
    ...["customer", "salesOrder"].map((module): ModuleRoleGrant => ({ module, actions: ALL, fields: "all", buttons: "all", scope: null })),
    { module: "salesDelivery", actions: ALL, fields: "all", buttons: "all", scope: null },
  ] },
  { code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery", grants: ["customer", "salesOrder", "salesDelivery"].map((module): ModuleRoleGrant => ({ module, actions: ["read", "export"], fields: "all", buttons: [], scope: null })) },
] } satisfies ProductAuthorizationFragment;
