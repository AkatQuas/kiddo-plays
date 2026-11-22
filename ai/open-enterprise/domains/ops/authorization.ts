import type { ProductAuthorizationFragment } from "@open-erp/metamodel";

export default {
  applications: [
    { code: "boss-mobile", name: "Boss app" },
    { code: "report-mobile", name: "Shop-floor app" },
  ],
  roles: [
    {
      code: "tenant-admin",
      name: "System administrator",
      description: "System configuration and every business permission inside the tenant",
      grants: [
        { systemKey: "system:rbac:manage" },
        { systemKey: "system:choiceSet:manage" },
        { systemKey: "system:customField:manage" },
        { systemKey: "system:moduleSetting:manage" },
        { systemKey: "system:notification:manage" },
        { systemKey: "system:operationLog:read" },
        { systemKey: "system:stockQuery:read" },
        { systemKey: "system:productionReport:read" },
        { systemKey: "system:deliveryReport:read" },
      ],
    },
  ],
} satisfies ProductAuthorizationFragment;
