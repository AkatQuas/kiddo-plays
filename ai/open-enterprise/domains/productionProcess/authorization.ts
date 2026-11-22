import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";

// Assignments, work reports, and production tasks are not created by hand, so this catalog does not grant delete.
const NO_DELETE = ["read", "create", "update", "export", "import"] as const;
const modules = ["processAssignment", "processReport", "productionTask"] as const;
const admin = modules.map((module): ModuleRoleGrant => ({ module, actions: NO_DELETE, fields: "all", buttons: "all", scope: null }));

export default {
  roles: [
    { code: "tenant-admin", name: "System administrator", description: "System configuration and every business permission inside the tenant", grants: admin },
    { code: "production-manager", name: "Workshop manager", description: "Maintains manufacturing master data and coordinates shop-floor execution", grants: admin },
    {
      code: "production-planner", name: "Production planner", description: "Builds the production plan, maintains routings, and releases tasks and assignments",
      grants: ["productionTask", "processAssignment"].map((module): ModuleRoleGrant => ({ module, actions: ["read", "create", "update", "export", "import"], fields: "all", buttons: "all", scope: null })),
    },
    {
      code: "production-coordinator", name: "Production coordinator", description: "Tracks order dates, purchased material, production progress, work reports, and delivery",
      grants: modules.map((module): ModuleRoleGrant => ({ module, actions: ["read", "export"], fields: "all", buttons: [], scope: null })),
    },
    {
      code: "team-leader", name: "Team leader", description: "Views the team's people and tasks and can report work for a member",
      grants: [
        { module: "processAssignment", actions: ["read"], fields: "all", buttons: ["Start", "Report work", "Finish operation"], scope: [[{ field: "teamId", op: "own-org-and-descendants", values: [] }]] },
        { module: "processReport", actions: ["read", "create", "update"], fields: "all", buttons: ["Approve"], scope: [[{ field: "teamId", op: "own-org-and-descendants", values: [] }]] },
      ],
    },
    {
      code: "production-reporter", name: "Production operator", description: "Runs this person's or the team's production tasks and work reports",
      grants: [
        {
          module: "processAssignment", actions: ["read"], fields: "all", buttons: ["Start", "Report work"],
          scope: [[{ field: "workerId", op: "me", values: [] }], [{ field: "teamAssignmentOrgId", op: "own-org", values: [] }]],
        },
        {
          module: "processReport", actions: ["read", "create", "update"], fields: "all", buttons: [],
          scope: [[{ field: "workerId", op: "me", values: [] }]],
        },
      ],
    },
    {
      code: "buyer", name: "Buyer", description: "Runs purchase plans, inquiries, orders, receipts, returns, and supplier coordination",
      // Approving a full subcontract reads and advances the linked production task in the same planner. This grant is read-only: no production-task fields or transitions, so purchasing still cannot operate the task by hand.
      grants: [{ module: "productionTask", actions: ["read"], fields: "all", buttons: [], scope: null }],
    },
    {
      code: "warehouse-clerk", name: "Warehouse clerk", description: "Manages warehouse masters, receipts, issues, and stock",
      grants: [
        { module: "productionTask", actions: ["read"], fields: "all", buttons: [], scope: null },
      ],
    },
  ],
  scopeTargets: [
    { policy: "own-org-and-descendants", module: "productionTask", field: "productionOrgId", walkUpToType: "factory" },
  ],
} satisfies ProductAuthorizationFragment;
