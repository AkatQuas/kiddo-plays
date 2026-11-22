import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";
const ALL = ["read", "create", "update", "delete", "export", "import"] as const;
// Purchase receipt is not created by hand, so the permission catalog does not grant delete.
const RECEIPT_ACTIONS = ["read", "create", "update", "export", "import"] as const;
const full: ModuleRoleGrant[] = [
  { module: "purchaseInvoice", actions: ALL, fields: "all", buttons: "all", scope: null },
  ...["purchaseOrder", "purchasePayable", "purchasePayment", "purchasePlan"].map((module): ModuleRoleGrant => ({
    module,
    actions: ALL,
    fields: "all",
    buttons: "all",
    scope: null,
  })),
  { module: "purchaseReceipt", actions: RECEIPT_ACTIONS, fields: "all", buttons: "all", scope: null },
  { module: "purchaseReturn", actions: ALL, fields: "all", buttons: "all", scope: null },
  { module: "supplier", actions: ALL, fields: "all", buttons: "all", scope: null },
];
export default { roles: [
  { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: full },
  { code: "finance", name: "Finance", description: "Record receipts and payments, allocate open items, and maintain cash accounts", grants: [
    { module: "purchaseInvoice", actions: ALL, fields: "all", buttons: "all", scope: null },
    ...["purchasePayable", "purchasePayment"].map((module): ModuleRoleGrant => ({ module, actions: ALL, fields: "all", buttons: "all", scope: null })),
  ] },
  { code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock", grants: [
    ...["purchaseReceipt", "purchaseReturn"].map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })),
  ] },
  { code: "buyer", name: "Buyer", description: "Runs purchase plans, inquiries, orders, receipts, returns, and supplier coordination", grants: full },
  { code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery", grants: [
    ...["purchasePlan", "purchaseOrder", "purchaseReceipt"].map((module): ModuleRoleGrant => ({ module, actions: ["read"], fields: "all", buttons: [], scope: null })),
  ] },
] } satisfies ProductAuthorizationFragment;
