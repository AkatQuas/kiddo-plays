import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  defineFixtureModule,
  FIELD_PERMISSION_ACTION_LABELS,
  fieldPermissionKey,
  hasCreatePath,
  hasEditableStatus,
  MODULE_PERMISSION_ACTION_LABELS,
  MODULE_PERMISSION_ACTIONS,
  modulePermissionCatalog,
  modulePermissionKey,
  normalizeFixtureModule,
  permissionCatalog,
  permissionBusinessLabel,
  transitionConsequenceSpoken,
  transitionPermissionKey,
  transitionsReaching,
  withPushOrigins,
  type ModuleSchema,
} from "../src/index.js";

function sample() {
  return defineFixtureModule({
    code: "sample",
    label: "Sample",
    domain: "test",
    fields: [
      { key: "code", label: "Number", type: "string", required: true, primary: true },
      { key: "amount", label: "Amount", type: "money", required: true },
      { key: "computed", label: "Computed value", type: "money", derive: { kind: "formula", expr: { field: "amount" } } },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "sampleLine",
        fields: [
          { key: "qty", label: "Quantity", type: "number", required: true },
          { key: "sum", label: "Subtotal", type: "number", derive: { kind: "formula", expr: { field: "qty" } } },
        ],
      },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", initial: true },
        { key: "done", terminal: true },
      ],
      transitions: [
        { code: "submit", from: "draft", to: "done", action: "Submit" },
        { code: "syncDone", from: "draft", to: "done", action: "System sync complete", internal: true },
      ],
    },
    views: { list: { columns: ["code"] } },
  });
}

describe("schema Permission Directory", () => {
  it("the module, the status margin, the header and the line field generate stable coordinates", () => {
    const catalog = modulePermissionCatalog(sample(), true);
    const keys = catalog.map((definition) => definition.key);
    expect(keys).toContain(modulePermissionKey("sample", "read"));
    expect(keys).toContain(modulePermissionKey("sample", "create"));
    expect(keys).toContain(transitionPermissionKey("sample", "submit"));
    expect(keys).toContain(fieldPermissionKey("sample", "amount", "read"));
    expect(keys).toContain(fieldPermissionKey("sample", "amount", "write"));
    expect(keys).toContain(fieldPermissionKey("sample", "lines", "write"));
    expect(keys).toContain(fieldPermissionKey("sample", "lines.qty", "write"));
  });

  it("permission business names are produced directly from directories and do not include English action codes or modules", () => {
    const catalog = modulePermissionCatalog(sample(), true);
    const byKey = (key: string) => catalog.find((definition) => definition.key === key);
    expect(byKey(modulePermissionKey("sample", "read"))?.label).toBe("Sample · View");
    expect(byKey(modulePermissionKey("sample", "lookup"))?.label).toBe("Sample · Reference");
    expect(byKey(modulePermissionKey("sample", "create"))?.label).toBe("Sample · Create");
    expect(byKey(modulePermissionKey("sample", "update"))?.label).toBe("Sample · Edit");
    expect(byKey(fieldPermissionKey("sample", "amount", "read"))?.label).toBe("Sample · Amount · Visible");
    expect(byKey(fieldPermissionKey("sample", "amount", "write"))?.label).toBe("Sample · Amount · Editable");
    expect(byKey(fieldPermissionKey("sample", "lines.qty", "write"))?.label).toBe("Sample · Lines · Quantity · Editable");
    expect(byKey(transitionPermissionKey("sample", "submit"))?.label).toBe("Sample · Submit");
    for (const definition of catalog) {
      expect(definition.label).not.toContain("sample");
      for (const action of MODULE_PERMISSION_ACTIONS) {
        expect(definition.label).not.toMatch(new RegExp(`(?:^|[ /·])${action}(?:$|[ /·])`));
      }
      expect(definition.label).not.toContain("Read");
      expect(definition.label).not.toContain("Write");
    }
    expect(MODULE_PERMISSION_ACTION_LABELS.lookup).toBe("Reference");
    expect(FIELD_PERMISSION_ACTION_LABELS.write).toBe("Editable");
    expect(permissionBusinessLabel(["Production task", "View"])).toBe("Production task · View");
  });

  it("status side effect speech displays name in module, missing name is dropped", () => {
    expect(transitionConsequenceSpoken({ postsToLedger: true, push: "inbound" }, "Receipt"))
      .toBe("This step will post to the ledger and push down and create Receipt");
    expect(transitionConsequenceSpoken({ postsToLedger: true, push: null }, null)).toBe("This step will post to the ledger");
    expect(transitionConsequenceSpoken({ postsToLedger: false, push: "inbound" }, "Receipt")).toBe("This step will push down and create Receipt");
    expect(transitionConsequenceSpoken({ postsToLedger: false, push: null }, null)).toBeNull();
    expect(() => transitionConsequenceSpoken({ postsToLedger: false, push: "inbound" }, null))
      .toThrow(/has no module display name/);
  });

  it("system supply field only read, no fake cashable write", () => {
    const keys = modulePermissionCatalog(sample(), true).map((definition) => definition.key);
    expect(keys).toContain(fieldPermissionKey("sample", "computed", "read"));
    expect(keys).not.toContain(fieldPermissionKey("sample", "computed", "write"));
    expect(keys).toContain(fieldPermissionKey("sample", "lines.sum", "read"));
    expect(keys).not.toContain(fieldPermissionKey("sample", "lines.sum", "write"));
  });

  it("maintain internal status edges for Planner, but without manual buttons, instructions or authorization directories", () => {
    const module = sample();
    expect(module.lifecycle.transitions.find((transition) => transition.code === "syncDone")?.internal).toBe(true);
    expect(availableTransitions(module, "draft").map((transition) => transition.code)).toEqual(["submit"]);
    expect(transitionsReaching(module, ["done"])[0]?.transitions.map((transition) => transition.code)).toEqual(["submit"]);
    expect(modulePermissionCatalog(module, true).map((definition) => definition.key))
      .not.toContain(transitionPermissionKey("sample", "syncDone"));
  });

  it("new field creates new key and does not automatically repeat old authorization", () => {
    const before = new Set(modulePermissionCatalog(sample(), true).map((definition) => definition.key));
    const module = sample();
    const after = modulePermissionCatalog({
      ...module,
      fields: [
        ...module.fields,
        { ...module.fields[0]!, key: "newField", label: "New field", primary: false },
      ],
    }, true);
    const added = after.map((definition) => definition.key).filter((key) => !before.has(key));
    expect(added).toEqual([
      fieldPermissionKey("sample", "newField", "read"),
      fieldPermissionKey("sample", "newField", "write"),
    ]);
  });
});

const UNASSEMBLED_PUSH_SENTENCE =
  "push origins have not been resolved yet (pushedFrom is null) — this module table did not go through loadCatalog's withPushOrigins assembly step";

function withCreatable(module: ModuleSchema, creatable: ModuleSchema["creatable"]): ModuleSchema {
  return { ...module, creatable };
}

function noneEditable(module: ModuleSchema): ModuleSchema {
  return {
    ...module,
    lifecycle: {
      ...module.lifecycle,
      statuses: module.lifecycle.statuses.map((status) => ({
        ...status,
        editable: "none",
        editableFields: null,
      })),
    },
  };
}

function moduleActions(module: ModuleSchema): readonly string[] {
  return modulePermissionCatalog(module, true)
    .filter((definition) => definition.kind === "module")
    .map((definition) => definition.action);
}

function catalogKeys(module: ModuleSchema): readonly string[] {
  return modulePermissionCatalog(module, true).map((definition) => definition.key);
}

const MANUAL_EDITABLE_KEYS = [
  modulePermissionKey("sample", "read"),
  modulePermissionKey("sample", "lookup"),
  modulePermissionKey("sample", "create"),
  modulePermissionKey("sample", "update"),
  modulePermissionKey("sample", "delete"),
  modulePermissionKey("sample", "export"),
  modulePermissionKey("sample", "import"),
  transitionPermissionKey("sample", "submit"),
  fieldPermissionKey("sample", "code", "read"),
  fieldPermissionKey("sample", "code", "write"),
  fieldPermissionKey("sample", "amount", "read"),
  fieldPermissionKey("sample", "amount", "write"),
  fieldPermissionKey("sample", "computed", "read"),
  fieldPermissionKey("sample", "lines", "read"),
  fieldPermissionKey("sample", "lines", "write"),
  fieldPermissionKey("sample", "lines.qty", "read"),
  fieldPermissionKey("sample", "lines.qty", "write"),
  fieldPermissionKey("sample", "lines.sum", "read"),
] as const;

describe("permission coordinates only for real action of the module", () => {
  it("manually buildable and editable state: 7 module actions, field read/write consistent with change", () => {
    const module = withCreatable(sample(), {
      manual: true,
      blockers: [],
      pushedFrom: [],
    });
    expect(module.creatable.manual).toBe(true);
    expect(hasEditableStatus(module)).toBe(true);
    expect(hasCreatePath(module)).toBe(true);
    expect(moduleActions(module)).toEqual([...MODULE_PERMISSION_ACTIONS]);
    expect(catalogKeys(module)).toEqual([...MANUAL_EDITABLE_KEYS]);
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "computed", "write"));
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "lines.sum", "write"));
    expect(catalogKeys(module)).not.toContain(transitionPermissionKey("sample", "syncDone"));
  });

  it("manually buildable but not editable: no update, fields write", () => {
    const module = noneEditable(withCreatable(sample(), {
      manual: true,
      blockers: [],
      pushedFrom: [],
    }));
    expect(hasCreatePath(module)).toBe(true);
    expect(hasEditableStatus(module)).toBe(false);
    expect(moduleActions(module)).toEqual(["read", "lookup", "create", "delete", "export", "import"]);
    expect(catalogKeys(module)).toContain(fieldPermissionKey("sample", "amount", "write"));
    expect(catalogKeys(module)).toContain(fieldPermissionKey("sample", "code", "write"));
    expect(catalogKeys(module)).not.toContain(modulePermissionKey("sample", "update"));
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "computed", "write"));
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "lines.sum", "write"));
  });

  it("generate path but not editable: no update and delete, fields write", () => {
    const module = noneEditable(withCreatable(sample(), {
      manual: false,
      blockers: [],
      pushedFrom: [{ module: "upstream", moduleLabel: "Upstream document", transition: "issue", action: "Push" }],
    }));
    expect(hasCreatePath(module)).toBe(true);
    expect(hasEditableStatus(module)).toBe(false);
    expect(moduleActions(module)).toEqual(["read", "lookup", "create", "export", "import"]);
    expect(catalogKeys(module)).toContain(fieldPermissionKey("sample", "amount", "write"));
    expect(catalogKeys(module)).not.toContain(modulePermissionKey("sample", "update"));
    expect(catalogKeys(module)).not.toContain(modulePermissionKey("sample", "delete"));
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "computed", "write"));
  });

  it("similar system account number: cannot be built, cannot be modified, module coordinates only read/lookup/export, field only read", () => {
    const module = noneEditable(
      withCreatable(sample(), {
        manual: false,
        blockers: [],
        pushedFrom: [],
      }),
    );
    expect(module.views.createFrom).toEqual([]);
    expect(module.lifecycle.statuses.every((status) => status.editable === "none")).toBe(true);
    expect(hasCreatePath(module)).toBe(false);
    expect(hasEditableStatus(module)).toBe(false);
    expect(moduleActions(module)).toEqual(["read", "lookup", "export"]);
    expect(catalogKeys(module)).toEqual([
      modulePermissionKey("sample", "read"),
      modulePermissionKey("sample", "lookup"),
      modulePermissionKey("sample", "export"),
      transitionPermissionKey("sample", "submit"),
      fieldPermissionKey("sample", "code", "read"),
      fieldPermissionKey("sample", "amount", "read"),
      fieldPermissionKey("sample", "computed", "read"),
      fieldPermissionKey("sample", "lines", "read"),
      fieldPermissionKey("sample", "lines.qty", "read"),
      fieldPermissionKey("sample", "lines.sum", "read"),
    ]);
  });

  it("construct only below: create/import/update and field write, no delete", () => {
    const module = withCreatable(sample(), {
      manual: false,
      blockers: [],
      pushedFrom: [{ module: "upstream", moduleLabel: "Upstream document", transition: "issue", action: "Push" }],
    });
    expect(module.views.createFrom).toEqual([]);
    expect(hasCreatePath(module)).toBe(true);
    expect(hasEditableStatus(module)).toBe(true);
    expect(moduleActions(module)).toEqual(["read", "lookup", "create", "update", "export", "import"]);
    expect(catalogKeys(module)).toEqual(
      MANUAL_EDITABLE_KEYS.filter((key) => key !== modulePermissionKey("sample", "delete")),
    );
    expect(catalogKeys(module)).toContain(fieldPermissionKey("sample", "amount", "write"));
    expect(catalogKeys(module)).not.toContain(fieldPermissionKey("sample", "computed", "write"));
  });

  it("can only be created: there is Create/import, no delete", () => {
    const base = withCreatable(sample(), {
      manual: false,
      blockers: [],
      pushedFrom: [],
    });
    const module: ModuleSchema = {
      ...base,
      views: {
        ...base.views,
        createFrom: [{ path: "code", label: null, sourceStatuses: null, sourceRemaining: null }],
      },
    };
    expect(hasCreatePath(module)).toBe(true);
    expect(moduleActions(module)).toEqual(["read", "lookup", "create", "update", "export", "import"]);
    expect(moduleActions(module)).not.toContain("delete");
    expect(catalogKeys(module)).toContain(modulePermissionKey("sample", "create"));
    expect(catalogKeys(module)).toContain(modulePermissionKey("sample", "import"));
    expect(catalogKeys(module)).not.toContain(modulePermissionKey("sample", "delete"));
    expect(catalogKeys(module)).toContain(fieldPermissionKey("sample", "amount", "write"));
  });

  it("# Has CreatePath: manual is true #", () => {
    const module = sample();
    expect(module.creatable.manual).toBe(true);
    expect(module.creatable.pushedFrom).toBeNull();
    expect(hasCreatePath(module)).toBe(true);
    expect(moduleActions(module)).toEqual([...MODULE_PERMISSION_ACTIONS]);
  });

  it("{\\cHFFFFFF}{\\cH00FFFF} Has CreatePath: manual is false and", () => {
    const base = sample();
    const module = withCreatable(base, {
      manual: false,
      blockers: base.creatable.blockers,
      pushedFrom: null,
    });
    const expected =
      `module "sample" ${UNASSEMBLED_PUSH_SENTENCE}, so the create path cannot be judged`;
    expect(() => hasCreatePath(module)).toThrow(expected);
    expect(() => modulePermissionCatalog(module, true)).toThrow(expected);
  });

  it("hasEditableStatus: there is a editable state of true, all none or empty list is false", () => {
    const editable = withCreatable(sample(), { manual: true, blockers: [], pushedFrom: [] });
    expect(editable.lifecycle.statuses.some((status) => status.editable !== "none")).toBe(true);
    expect(hasEditableStatus(editable)).toBe(true);

    const whitelist = {
      ...noneEditable(editable),
      lifecycle: {
        ...editable.lifecycle,
        statuses: editable.lifecycle.statuses.map((status, index) =>
          index === 0
            ? { ...status, editable: "whitelist" as const, editableFields: ["code"] }
            : { ...status, editable: "none" as const, editableFields: null },
        ),
      },
    };
    expect(hasEditableStatus(whitelist)).toBe(true);
    expect(hasEditableStatus(noneEditable(editable))).toBe(false);
    expect(
      hasEditableStatus({
        ...editable,
        lifecycle: { ...editable.lifecycle, statuses: [] },
      }),
    ).toBe(false);
  });

  it("only lookup when you're not on edge, the rest of the coordinates are the same as when quoted", () => {
    const module = sample();
    const referenced = modulePermissionCatalog(module, true).map((definition) => definition.key);
    const unreferenced = modulePermissionCatalog(module, false).map((definition) => definition.key);
    const lookup = modulePermissionKey("sample", "lookup");
    expect(referenced).toContain(lookup);
    expect(unreferenced).toEqual(referenced.filter((key) => key !== lookup));
  });

  it("missionCatalog only sends lookup to the cited module", () => {
    const target = normalizeFixtureModule({
      code: "targetBill",
      label: "Target document",
      domain: "test",
      fields: [{ key: "code", label: "Number", type: "string", required: true, primary: true }],
      lifecycle: {
        statuses: [
          { key: "draft", initial: true },
          { key: "done", terminal: true },
        ],
        transitions: [{ code: "submit", from: "draft", to: "done", action: "Submit" }],
      },
      views: { list: { columns: ["code"] } },
    });
    const source = normalizeFixtureModule({
      code: "sourceBill",
      label: "Source document",
      domain: "test",
      fields: [
        { key: "code", label: "Number", type: "string", required: true, primary: true },
        { key: "targetId", label: "Target", type: "ref", ref: "targetBill", required: true },
      ],
      lifecycle: {
        statuses: [
          { key: "draft", initial: true },
          { key: "done", terminal: true },
        ],
        transitions: [{ code: "submit", from: "draft", to: "done", action: "Submit" }],
      },
      views: { list: { columns: ["code"] } },
    });
    const definitions = permissionCatalog([source, target]);
    const actions = (code: string) => definitions
      .filter((definition) => definition.kind === "module" && definition.module === code)
      .map((definition) => definition.action);
    expect(actions("targetBill")).toContain("lookup");
    expect(actions("sourceBill")).not.toContain("lookup");
    expect(actions("sourceBill")).toEqual(actions("targetBill").filter((action) => action !== "lookup"));
  });
});

const DECLARATION_BLOCKER = {
  path: "capabilities.create",
  label: "Manual create",
  type: "string",
  why: "The module declaration does not allow manual create",
} as const;

function openBill(code: string, capabilities?: Record<string, unknown>): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    ...(capabilities === undefined ? {} : { capabilities }),
    fields: [{ key: "code", label: "Number", type: "string", required: true, primary: true }],
    lifecycle: {
      statuses: [
        { key: "draft", initial: true },
        { key: "done", terminal: true },
      ],
      transitions: [{ code: "submit", from: "draft", to: "done", action: "Submit" }],
    },
    views: { list: { columns: ["code"] } },
  });
}

function directoryBill(capabilities?: Record<string, unknown>): ModuleSchema {
  return normalizeFixtureModule({
    code: "account",
    label: "Account",
    domain: "test",
    ...(capabilities === undefined ? {} : { capabilities }),
    fields: [
      { key: "code", label: "Account name", type: "string", primary: true },
      { key: "syncedAt", label: "Synced at", type: "datetime", required: true, systemGenerated: true },
    ],
    lifecycle: {
      statuses: [{ key: "active", initial: true, editable: "none" }],
      transitions: [],
    },
    views: { list: { columns: ["code"] } },
  });
}

describe("capabilites", () => {
  it("skip Capabilites: three true, module action is the same as now", () => {
    const module = sample();
    expect(module.capabilities).toEqual({ create: true, export: true, import: true });
    expect(moduleActions(module)).toEqual([...MODULE_PERMISSION_ACTIONS]);
    const empty = openBill("plain", {});
    expect(empty.capabilities).toEqual({ create: true, export: true, import: true });
    expect(moduleActions(empty)).toEqual([...MODULE_PERMISSION_ACTIONS]);
  });

  it("unknown key, non-bolean, Null and non-object", () => {
    expect(() => openBill("plain", { print: false })).toThrow(/unknown key "print"/);
    expect(() => openBill("plain", { create: "no" })).toThrow(/capabilities\.create can only be true, false, or "system"/);
    expect(() => openBill("plain", { export: 1 })).toThrow(/capabilities\.export must be a boolean/);
    expect(() => openBill("plain", { import: null })).toThrow(/capabilities\.import must be a boolean/);
    const shell = {
      code: "plain",
      label: "plain",
      domain: "test",
      fields: [{ key: "code", label: "Number", type: "string", primary: true }],
      lifecycle: { statuses: [{ key: "draft", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] } },
    };
    expect(() => normalizeFixtureModule({ ...shell, capabilities: null })).toThrow(/capabilities must be an object/);
    expect(() => normalizeFixtureModule({ ...shell, capabilities: [] })).toThrow(/capabilities must be an object/);
    expect(() => normalizeFixtureModule({ ...shell, capabilities: "off" })).toThrow(/capabilities must be an object/);
  });

  it("no export", () => {
    const module = openBill("plain", { export: false });
    expect(module.capabilities).toEqual({ create: true, export: false, import: true });
    expect(hasCreatePath(module)).toBe(true);
    expect(moduleActions(module)).toContain("create");
    expect(moduleActions(module)).toContain("import");
    expect(moduleActions(module)).not.toContain("export");
  });

  it("report form still available", () => {
    const module = openBill("plain", { import: false });
    expect(hasCreatePath(module)).toBe(true);
    expect(module.capabilities).toEqual({ create: true, export: true, import: false });
    expect(moduleActions(module)).toContain("create");
    expect(moduleActions(module)).not.toContain("import");
  });

  it("create scenario: manual false, blocker why fixed, create neither path nor report", () => {
    const gated = openBill("gated", { create: false });
    expect(gated.creatable.manual).toBe(false);
    expect(gated.capabilities).toEqual({ create: false, export: true, import: false });
    expect(gated.creatable.blockers).toEqual([DECLARATION_BLOCKER]);
    expect(() => openBill("plain", { create: false, import: true })).toThrow(/cannot widen import after manual create is turned off/);

    const upstream = normalizeFixtureModule({
      code: "upstream",
      label: "Upstream document",
      domain: "test",
      fields: [{ key: "code", label: "Number", type: "string", required: true, primary: true }],
      lifecycle: {
        statuses: [
          { key: "draft", initial: true },
          { key: "done", terminal: true },
        ],
        transitions: [{ code: "issue", from: "draft", to: "done", action: "Push", push: "gated" }],
      },
      views: { list: { columns: ["code"] } },
    });
    const assembled = withPushOrigins([upstream, gated]).find((module) => module.code === "gated");
    if (assembled === undefined) throw new Error("withPushOrigins still owes a module");
    expect(assembled.creatable.manual).toBe(false);
    expect(assembled.creatable.blockers).toContainEqual(DECLARATION_BLOCKER);
    expect(hasCreatePath(assembled)).toBe(true);
    expect(moduleActions(assembled)).not.toContain("create");
    expect(moduleActions(assembled)).not.toContain("import");
    expect(moduleActions(assembled)).toContain("export");

    const closed = directoryBill({ create: false, export: false });
    expect(closed.capabilities).toEqual({ create: false, export: false, import: false });
    expect(closed.creatable.manual).toBe(false);
    expect(closed.creatable.blockers).toEqual([
      expect.objectContaining({
        path: "syncedAt",
        why: "This cell is supplied by the server write path. Ordinary create, import, the UI, and the Agent have no write entry",
      }),
      DECLARATION_BLOCKER,
    ]);
  });

  it("create system: New cannot be created manually, create still, tick name is generated, no report", () => {
    const module = openBill("plain", { create: "system" });
    expect(module.capabilities).toEqual({ create: "system", export: true, import: false });
    expect(module.creatable.manual).toBe(false);
    expect(module.creatable.blockers).toEqual([{
      path: "capabilities.create",
      label: "Manual create",
      type: "string",
      why: "Generated by the system; manual create is not allowed",
    }]);
    expect(hasCreatePath(module)).toBe(true);
    expect(moduleActions(module)).toContain("create");
    expect(moduleActions(module)).not.toContain("import");
    const create = modulePermissionCatalog(module, true).find((definition) =>
      definition.kind === "module" && definition.action === "create");
    expect(create?.label).toBe("plain · Generate");
    expect(() => openBill("plain", { create: "system", import: true })).toThrow(/cannot widen import after manual create is turned off/);
  });

  it("clear true added to", () => {
    expect(() => directoryBill({ create: true })).toThrow(/contradicts the fact that fields already block manual create/);
    expect(() => directoryBill({ create: true })).toThrow(/supplied by the server write path/);
    const omitted = directoryBill();
    expect(omitted.capabilities).toEqual({ create: true, export: true, import: true });
    expect(omitted.creatable.manual).toBe(false);
    expect(omitted.creatable.blockers.map((blocker) => blocker.path)).toEqual(["syncedAt"]);
    const exportOnly = directoryBill({ export: false });
    expect(exportOnly.capabilities).toEqual({ create: true, export: false, import: true });
    expect(exportOnly.creatable.blockers.some((blocker) => blocker.path === "capabilities")).toBe(false);
  });
});
