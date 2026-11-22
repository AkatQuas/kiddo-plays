import { describe, expect, it } from "vitest";
import {
  RoleGrantError,
  expandRoleGrant,
  expandRoleGrants,
  fieldPermissionKey,
  modulePermissionKey,
  roleGrantCatalog,
  transitionPermissionKey,
  validateRoleGrant,
  validateRoleGrants,
  type ModuleRoleGrant,
  type RoleGrant,
  type RoleGrantCatalog,
  type RoleGrantPermissionRef,
} from "../src/index.js";

const MODULE = "processAssignment";
const SYSTEM = "system:stockQuery:read";

const TRANSITIONS = [
  { code: "approve", action: "Approve" },
  { code: "syncApprove", action: "Sync approval", internal: true },
  { code: "start", action: "Start" },
  { code: "report", action: "Work report" },
  { code: "complete", action: "Finish" },
  { code: "forceComplete", action: "Complete with the production order", internal: true },
  { code: "cancel", action: "Cancel" },
  { code: "forceCancel", action: "Cancel with the production order", internal: true },
] as const;

function modulePerm(action: "read" | "lookup" | "update" | "delete"): RoleGrantPermissionRef {
  return {
    key: modulePermissionKey(MODULE, action),
    kind: "module",
    module: MODULE,
    action,
    field: null,
    transition: null,
    label: action,
    dataScoped: action === "read" || action === "lookup",
  };
}

function transitionPerm(code: string, action: string): RoleGrantPermissionRef {
  return {
    key: transitionPermissionKey(MODULE, code),
    kind: "transition",
    module: MODULE,
    action: "execute",
    field: null,
    transition: code,
    label: action,
    dataScoped: false,
  };
}

function fieldPerm(field: string, action: "read" | "write"): RoleGrantPermissionRef {
  return {
    key: fieldPermissionKey(MODULE, field, action),
    kind: "field",
    module: MODULE,
    action,
    field,
    transition: null,
    label: field,
    dataScoped: false,
  };
}

const FIELDS = ["code", "name", "xColor"] as const;

const PERMISSIONS: readonly RoleGrantPermissionRef[] = [
  modulePerm("read"),
  modulePerm("lookup"),
  modulePerm("update"),
  modulePerm("delete"),
  ...TRANSITIONS.map((transition) => transitionPerm(transition.code, transition.action)),
  ...FIELDS.flatMap((field) => [fieldPerm(field, "read"), fieldPerm(field, "write")]),
  {
    key: SYSTEM,
    kind: "system",
    module: null,
    action: "read",
    field: null,
    transition: null,
    label: "Stock query",
    dataScoped: false,
  },
];

const catalog: RoleGrantCatalog = roleGrantCatalog({
  modules: [{ code: MODULE, label: "Assignment", transitions: TRANSITIONS }],
  permissions: PERMISSIONS,
  scopeFields: [
    {
      module: MODULE,
      field: "teamId",
      label: "Team",
      type: "ref",
      ops: ["me", "own-org", "own-org-and-descendants", "specified", "eq", "between", "is_empty"],
    },
    {
      module: MODULE,
      field: "bizDate",
      label: "Business date",
      type: "date",
      ops: ["eq", "between", "is_empty"],
    },
  ],
  customFieldKeys: new Map([[MODULE, ["keptByMap"]]]),
  schemas: [],
});

function grant(patch: Partial<ModuleRoleGrant> & Pick<ModuleRoleGrant, "actions" | "buttons" | "fields" | "scope">): ModuleRoleGrant {
  return { module: MODULE, ...patch };
}

function rejects(run: () => void, message: string): void {
  expect(run).toThrow(RoleGrantError);
  expect(run).toThrow(message);
}

describe("roleGrantCatalog", () => {
  it("type to give business name, sending action, non-international edge, field path and byKey", () => {
    const slice = catalog.modules.get(MODULE);
    expect(slice?.label).toBe("Assignment");
    expect(slice?.actions).toEqual(["read", "update", "delete"]);
    expect(slice?.transitions.map((transition) => transition.code)).toEqual([
      "approve", "start", "report", "complete", "cancel",
    ]);
    expect(slice?.fieldPaths).toEqual(["code", "name", "xColor"]);
    expect(slice?.customFieldKeys).toEqual(["keptByMap"]);
    expect(slice?.scopeFields.map((field) => field.field)).toEqual(["teamId", "bizDate"]);
    expect(catalog.byKey.has(modulePermissionKey(MODULE, "read"))).toBe(true);
    expect(catalog.byKey.has(transitionPermissionKey(MODULE, "syncApprove"))).toBe(true);
    expect(catalog.byKey.has(modulePermissionKey(MODULE, "create"))).toBe(false);
    expect(catalog.systemByKey.has(SYSTEM)).toBe(true);
  });
});

describe("expandRoleGrant", () => {
  it("button Cancel was expanded to only one business action, international did not appear", () => {
    const expanded = expandRoleGrant(catalog, grant({
      actions: ["read"],
      buttons: ["Cancel"],
      fields: "all",
      scope: null,
    }));
    expect(expanded.permissions.filter((key) => key.includes(":transition:"))).toEqual([
      transitionPermissionKey(MODULE, "cancel"),
    ]);
    for (const code of ["syncApprove", "forceComplete", "forceCancel"]) {
      expect(expanded.permissions).not.toContain(transitionPermissionKey(MODULE, code));
    }
  });

  it("button array does not disrupt the order of statements", () => {
    const expanded = expandRoleGrant(catalog, grant({
      actions: ["delete"],
      buttons: ["Finish", "Cancel"],
      fields: "all",
      scope: null,
    }));
    expect(expanded.permissions.filter((key) => key.includes(":transition:"))).toEqual([
      transitionPermissionKey(MODULE, "complete"),
      transitionPermissionKey(MODULE, "cancel"),
    ]);
  });

  it("except removes read with write", () => {
    const open = expandRoleGrant(catalog, grant({
      actions: ["read", "update"],
      buttons: [],
      fields: "all",
      scope: null,
    }));
    expect(open.permissions).toContain(fieldPermissionKey(MODULE, "xColor", "read"));
    expect(open.permissions).toContain(fieldPermissionKey(MODULE, "xColor", "write"));
    const expanded = expandRoleGrant(catalog, grant({
      actions: ["read", "update"],
      buttons: [],
      fields: { except: ["name", "xColor"] },
      scope: null,
    }));
    expect(expanded.permissions).toEqual([
      modulePermissionKey(MODULE, "read"),
      modulePermissionKey(MODULE, "update"),
      fieldPermissionKey(MODULE, "code", "read"),
      fieldPermissionKey(MODULE, "code", "write"),
    ]);
  });

  it("unknown button name dropped, not dropped", () => {
    const expanded = expandRoleGrant(catalog, grant({
      actions: ["delete"],
      buttons: ["There is no such button", "Cancel"],
      fields: "all",
      scope: null,
    }));
    expect(expanded.permissions.filter((key) => key.includes(":transition:"))).toEqual([
      transitionPermissionKey(MODULE, "cancel"),
    ]);
  });

  it("pope is full or empty array and groups are when viewing coordinates", () => {
    const row = grant({ actions: ["read"], buttons: [], fields: "all", scope: null });
    expect(expandRoleGrant(catalog, row).scope).toEqual({ module: MODULE, groups: [] });
    expect(expandRoleGrant(catalog, { ...row, scope: [] }).scope).toEqual({ module: MODULE, groups: [] });
  });

  it("expand without viewing coordinates", () => {
    const withoutRead = roleGrantCatalog({
      modules: [{ code: MODULE, label: "Assignment", transitions: TRANSITIONS }],
      permissions: PERMISSIONS.filter((item) => item.key !== modulePermissionKey(MODULE, "read")),
      scopeFields: [],
      schemas: [],
    });
    const expanded = expandRoleGrant(withoutRead, grant({
      actions: ["read"],
      buttons: [],
      fields: "all",
      scope: [[{ field: "teamId", op: "me", values: [] }]],
    }));
    expect(expanded.permissions).not.toContain(modulePermissionKey(MODULE, "read"));
    expect(expanded.permissions).toContain(fieldPermissionKey(MODULE, "code", "read"));
    expect(expanded.scope).toBeNull();
  });

  it("the system key line expands only the key, and the key that is not in the directory is discarded", () => {
    expect(expandRoleGrant(catalog, { systemKey: SYSTEM })).toEqual({ permissions: [SYSTEM], scope: null });
    expect(expandRoleGrant(catalog, { systemKey: "system:missing:read" })).toEqual({ permissions: [], scope: null });
  });

  it("multi-line permissions are reordered in the order in which they appear, and only the first line of the same module range is taken", () => {
    const merged = expandRoleGrants(catalog, [
      grant({ actions: ["read"], buttons: [], fields: "all", scope: null }),
      grant({
        actions: ["read", "update"],
        buttons: ["Cancel"],
        fields: "all",
        scope: [[{ field: "teamId", op: "me", values: [] }]],
      }),
      { systemKey: SYSTEM },
      { systemKey: "system:missing:read" },
    ]);
    expect(merged.scopes).toEqual([{ module: MODULE, groups: [] }]);
    expect(merged.permissions.filter((key) => key === modulePermissionKey(MODULE, "read"))).toHaveLength(1);
    expect(merged.permissions.at(-1)).toBe(SYSTEM);
    expect(merged.permissions).not.toContain("system:missing:read");
    expect(merged.derived).toEqual([]);
  });
});

describe("validateRoleGrant", () => {
  it("illegal except throw RoleGrantError, text with modular business names and fields First Name", () => {
    rejects(() => validateRoleGrant(catalog, grant({
      actions: ["read"],
      buttons: [],
      fields: { except: ["missing field"] },
      scope: null,
    })), 'module "Assignment" has no field "missing field"');
  });

  it("reject unknown button name", () => {
    rejects(() => validateRoleGrant(catalog, grant({
      actions: ["read"],
      buttons: ["Withdraw"],
      fields: "all",
      scope: null,
    })), 'module "Assignment" has no button "Withdraw"');
  });

  it("reject module unspat operations", () => {
    rejects(() => validateRoleGrant(catalog, grant({
      actions: ["create"],
      buttons: [],
      fields: "all",
      scope: null,
    })), 'module "Assignment" has no "Create".');
  });

  it("reject internal references as role actions", () => {
    rejects(() => validateRoleGrant(catalog, grant({
      actions: ["lookup"] as never,
      buttons: [],
      fields: "all",
      scope: null,
    })), 'action "lookup" on module "Assignment" is invalid.');
  });

  it("reject non-empty range without viewing", () => {
    rejects(() => validateRoleGrant(catalog, grant({
      actions: ["update"],
      buttons: [],
      fields: "all",
      scope: [[{ field: "teamId", op: "me", values: [] }]],
    })), 'module "Assignment" has no "View" permission, so a data scope cannot be configured.');
  });

  it("reject duplicate module rows and duplicate system privileges", () => {
    const row = grant({ actions: ["read"], buttons: [], fields: "all", scope: null });
    rejects(() => validateRoleGrants(catalog, [row, row]), 'the grant for module "Assignment" is duplicated');
    const system: RoleGrant = { systemKey: SYSTEM };
    rejects(() => validateRoleGrants(catalog, [system, system]), 'system permission "Stock query" is duplicated');
  });

  it("no system access to directory denied, some passed", () => {
    rejects(
      () => validateRoleGrant(catalog, { systemKey: "system:missing:read" }),
      'the current permission catalog has no system permission "system:missing:read"',
    );
    expect(() => validateRoleGrant(catalog, { systemKey: SYSTEM })).not.toThrow();
  });

  it("no module in the current permission directory directly rejects", () => {
    rejects(() => validateRoleGrant(catalog, {
      module: "missing",
      actions: ["read"],
      buttons: [],
      fields: "all",
      scope: null,
    }), 'the current permission catalog has no module "missing"');
  });

  it("legitimate authorization passed and custom fields outside the directory can also be excluded", () => {
    expect(() => validateRoleGrant(catalog, grant({
      actions: ["read", "update"],
      buttons: ["Cancel", "Start", "Work report", "Finish"],
      fields: { except: ["name", "keptByMap", "xExtra"] },
      scope: [[{ field: "teamId", op: "me", values: [] }]],
    }))).not.toThrow();
    expect(() => validateRoleGrant(catalog, grant({
      actions: ["update"],
      buttons: [],
      fields: "all",
      scope: null,
    }))).not.toThrow();
  });

  it("scope conditions rejected by fields, algorithms and values", () => {
    const row = (scope: ModuleRoleGrant["scope"]): ModuleRoleGrant => grant({
      actions: ["read"],
      buttons: [],
      fields: "all",
      scope,
    });
    rejects(() => validateRoleGrant(catalog, row([[{ field: "ghost", op: "me", values: [] }]])), 'field "ghost" on module "Assignment" is not a configurable data scope');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "contains", values: ["a"] }]])), '"Team" on module "Assignment" does not support "contains"');
    rejects(() => validateRoleGrant(catalog, row([[
      { field: "teamId", op: "me", values: [] },
      { field: "teamId", op: "own-org", values: [] },
    ]])), '"Team" on module "Assignment" is duplicated in the same group');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "eq", values: ["a", "a"] }]])), 'module "Assignment" field "Team" scope values are duplicated');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "specified", values: [] }]])), 'module "Assignment" field "Team" a specified scope must select a resource');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "specified", values: ["id-1", { $rel: "today" as const }] }]])), 'module "Assignment" field "Team" a specified-scope value must be a resource id');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "between", values: ["a"] }]])), 'module "Assignment" field "Team" a range must be exactly two values');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "me", values: ["x"] }]])), 'module "Assignment" field "Team" must not set scope values when using "me"');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "eq", values: [] }]])), 'module "Assignment" field "Team" must set scope values when using "eq"');
    rejects(() => validateRoleGrant(catalog, row([[{ field: "bizDate", op: "eq", values: ["2026-02-29"] }]])), "Business date");
    expect(() => validateRoleGrant(catalog, row([[{ field: "bizDate", op: "eq", values: ["2026-09-21"] }]]))).not.toThrow();
    expect(() => validateRoleGrant(catalog, row([[{ field: "teamId", op: "specified", values: ["id-1"] }]]))).not.toThrow();
  });
});
