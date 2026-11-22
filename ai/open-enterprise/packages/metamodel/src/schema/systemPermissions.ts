// ---------------------------------------------------------------------------
// System permission coordinates
//
// Module permissions are derived by permissionCatalog(schema) from the current catalog (module × action).
// Framework permissions do not include ledgers. Surface permission strings are declared by each surface,
// and AuthorizationCatalog collects them into grantable coordinates.
// stockQueryRead is the identifier a surface declaration uses (the inventory surface still uses it);
// this const does not list every query-surface key.
// ---------------------------------------------------------------------------

/** Branded string: any `system:<name>:<action>`, not a closed enum. */
export type SystemPermissionKey = string;

/** Framework permissions that do not belong to a business domain. No ledgers, and no surface permissions. */
export const FRAMEWORK_PERMISSION_KEYS = {
  rbacManage: "system:rbac:manage",
  choiceSetManage: "system:choiceSet:manage",
  moduleSettingManage: "system:moduleSetting:manage",
  notificationManage: "system:notification:manage",
  operationLogRead: "system:operationLog:read",
  customFieldManage: "system:customField:manage",
} as const;

export const FRAMEWORK_PERMISSION_KEY_SET: ReadonlySet<string> = new Set(
  Object.values(FRAMEWORK_PERMISSION_KEYS),
);

/** Framework permissions, plus a few identifiers used by surface declarations. Whether a surface key is grantable is not decided by this const. */
export const SYSTEM_PERMISSION_KEYS = {
  ...FRAMEWORK_PERMISSION_KEYS,
  stockQueryRead: "system:stockQuery:read",
} as const;
