import type { ModuleRoleGrant, ProductAuthorizationFragment } from "@open-erp/metamodel";

// The payroll report is produced from work reports and cannot be edited in any status, so the permission catalog does not grant update or delete.
const WAGE_ACTIONS = ["read", "create", "export", "import"] as const;
const wage: ModuleRoleGrant = {
  module: "performanceSettlement",
  actions: WAGE_ACTIONS,
  fields: "all",
  buttons: "all",
  scope: null,
};

/**
 * Report-domain grants. The daily report is for the owner and management. People are granted view and generate only. The snapshot is written by the daily-report pipeline through an internal entry.
 * Payroll report: the workshop manager can settle it. The production coordinator can read and export it.
 * Query surfaces are grantable coordinates. Only the ones named in the seed are granted.
 */
export default {
  roles: [
    {
      code: "tenant-admin",
      name: "System administrator",
      description: "System configuration and every business permission inside the tenant",
      grants: [
        {
          module: "dailyReport",
          actions: ["read", "create"],
          fields: "all",
          buttons: "all",
          scope: null,
        },
        wage,
      ],
    },
    {
      code: "boss",
      name: "Owner",
      description: "View the daily operating report and how the business is doing",
      grants: [
        {
          module: "dailyReport",
          actions: ["read"],
          fields: "all",
          buttons: [],
          scope: null,
        },
      ],
    },
    {
      code: "production-manager",
      name: "Workshop manager",
      description: "Maintains manufacturing master data and coordinates shop-floor execution",
      grants: [wage],
    },
    {
      code: "production-coordinator",
      name: "Production coordinator",
      description: "Tracks order dates, purchased material, production progress, work reports, and delivery",
      grants: [
        {
          module: "performanceSettlement",
          actions: ["read", "export"],
          fields: "all",
          buttons: [],
          scope: null,
        },
      ],
    },
  ],
} satisfies ProductAuthorizationFragment;
