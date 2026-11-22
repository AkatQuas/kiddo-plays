import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeProductAuthorization } from "../src/authorization.js";
import { loadCatalog, type LoadedModule } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(HERE, "../../../domains");

function directoryModules(schema: {
  readonly creatable: { readonly manual: boolean };
  readonly lifecycle: { readonly statuses: readonly { readonly editable: string }[] };
} = {
  creatable: { manual: false },
  lifecycle: { statuses: [{ editable: "none" }, { editable: "none" }] },
}): Map<string, LoadedModule> {
  return new Map([["subject", {
    code: "subject",
    domain: "platform",
    file: "platform/modules/subject.ts",
    schema,
    escapeHatch: false,
    planners: new Map(),
    plannerConsistency: new Map(),
    actionPreparers: new Map(),
    batchActions: {},
  } as unknown as LoadedModule]]);
}

const DIRECTORY = { domain: "platform", value: { subjectDirectory: { module: "subject" } } };

describe("product application authorization", () => {
  it("strictly parses the cross-domain application catalog and sorts by code deterministically", () => {
    const authorization = normalizeProductAuthorization([
      DIRECTORY,
      { domain: "z", value: { applications: [{ code: "report-mobile", name: "shop floor" }] } },
      { domain: "a", value: { applications: [{ code: "boss-mobile", name: "owner" }] } },
    ], directoryModules());

    expect(authorization.applications).toEqual([
      { code: "boss-mobile", name: "owner" },
      { code: "report-mobile", name: "shop floor" },
    ]);
    expect(authorization.subjectDirectory).toEqual({ module: "subject" });
  });

  it.each([
    {
      label: "unknown application key",
      located: [{ domain: "d", value: { applications: [{ code: "boss-mobile", name: "owner", path: "/boss" }] } }],
      error: /has unknown keys "path"/,
    },
    {
      label: "unknown top-level key",
      located: [{ domain: "d", value: { applications: [], applicationRoutes: [] } }],
      error: /has unknown keys "applicationRoutes"/,
    },
    {
      label: "illegal code",
      located: [{ domain: "d", value: { applications: [{ code: "BossMobile", name: "owner" }] } }],
      error: /lowercase kebab-case/,
    },
    {
      label: "code with whitespace",
      located: [{ domain: "d", value: { applications: [{ code: "boss-mobile ", name: "owner" }] } }],
      error: /lowercase kebab-case/,
    },
    {
      label: "duplicate code",
      located: [
        { domain: "d1", value: { applications: [{ code: "boss-mobile", name: "owner" }] } },
        { domain: "d2", value: { applications: [{ code: "boss-mobile", name: "operations" }] } },
      ],
      error: /declares application "boss-mobile" again/,
    },
    {
      label: "duplicate name",
      located: [
        { domain: "d1", value: { applications: [{ code: "boss-mobile", name: "owner" }] } },
        { domain: "d2", value: { applications: [{ code: "owner-mobile", name: "owner" }] } },
      ],
      error: /declares application name "owner" again/,
    },
  ])("rejects $label", ({ located, error }) => {
    expect(() => normalizeProductAuthorization(located, new Map())).toThrow(error);
  });

  it("the real product catalog declares applications, and application users do not enter the role seed", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.authorization.subjectDirectory).toEqual({ module: "subject" });
    const systemGrants = catalog.authorization.roles.flatMap((role) => role.grants)
      .flatMap((grant) => "systemKey" in grant ? [grant.systemKey] : []);
    expect(systemGrants.some((permission) => permission.startsWith("application:"))).toBe(false);
  });

  it("a role-seed action rejects an internal reference coordinate", () => {
    expect(() => normalizeProductAuthorization([
      DIRECTORY,
      {
        domain: "platform",
        value: {
          roles: [{
            code: "seed-role",
            name: "seed role",
            description: "test",
            grants: [{ module: "subject", actions: ["lookup"], buttons: [], fields: "all", scope: null }],
          }],
        },
      },
    ], directoryModules())).toThrow(/actions contains an unknown value "lookup"/);
  });

  it("the whole product declares subjectDirectory in exactly one place, and the declared module cannot be created by hand and has no editable status", () => {
    expect(() => normalizeProductAuthorization([
      { domain: "a", value: { applications: [{ code: "boss-mobile", name: "owner" }] } },
    ], directoryModules())).toThrow(/declare subjectDirectory in exactly one place/);
    expect(() => normalizeProductAuthorization([
      DIRECTORY,
      { domain: "sales", value: { subjectDirectory: { module: "subject" } } },
    ], directoryModules())).toThrow(/both declare the account directory/);
    expect(() => normalizeProductAuthorization([
      { domain: "sales", value: { subjectDirectory: { module: "subject" } } },
    ], directoryModules())).toThrow(/must be owned by the current domain/);
    expect(() => normalizeProductAuthorization([DIRECTORY], directoryModules({
      creatable: { manual: true },
      lifecycle: { statuses: [{ editable: "none" }] },
    }))).toThrow(/must not be manually creatable/);
    expect(() => normalizeProductAuthorization([DIRECTORY], directoryModules({
      creatable: { manual: false },
      lifecycle: { statuses: [{ editable: "none" }, { editable: "full" }] },
    }))).toThrow(/must have every status non-editable/);
  });

  it("walkUpToType must be an org-type dictionary code, and a Chinese display name is rejected", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.authorization.scopeTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "productionOrder",
        policy: "own-org-and-descendants",
        walkUpToType: "factory",
      }),
    ]));
    expect(() => normalizeProductAuthorization([
      {
        domain: "manufacturing",
        value: {
          orgTree: { module: "orgUnit", parentField: "parentOrgId", typeField: "orgType" },
        },
      },
      {
        domain: "production",
        value: {
          scopeTargets: [{
            policy: "own-org-and-descendants",
            module: "productionOrder",
            field: "productionOrgId",
            walkUpToType: "Factory",
          }],
        },
      },
    ], catalog.modules)).toThrow(/org-type dictionary code/);
  });

  it("affiliationSyncs.activeStatus must be a lifecycle status of fromModule", async () => {
    const catalog = await loadCatalog({ domainsRoot: REAL });
    expect(catalog.authorization.affiliationSyncs).toEqual([
      expect.objectContaining({
        fromModule: "worker",
        orgTypeValue: "team",
        activeStatus: "active",
      }),
    ]);
    const sync = {
      fromModule: "worker",
      userIdField: "platformUserId",
      displayField: "name",
      orgField: "productionOrgId",
      orgTypeField: "orgType",
      orgTypeValue: "team",
    };
    expect(() => normalizeProductAuthorization([
      DIRECTORY,
      { domain: "manufacturing", value: { affiliationSyncs: [sync] } },
    ], catalog.modules)).toThrow(/activeStatus/);
    expect(() => normalizeProductAuthorization([
      DIRECTORY,
      { domain: "manufacturing", value: { affiliationSyncs: [{ ...sync, activeStatus: "not-a-status" }] } },
    ], catalog.modules)).toThrow(/is not a status declared by worker/);
  });
});
