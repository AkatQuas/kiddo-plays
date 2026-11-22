import { describe, expect, it } from "vitest";
import { defineFixtureModule, singleState } from "@open-erp/metamodel";
import {
  createBill,
  saveDraft,
  type Identity,
  type RuntimeAuthorizer,
  type RuntimeCatalog,
  type ExecutionRepos,
} from "../src/index.js";

const schema = defineFixtureModule({
  code: "skuLike",
  label: "SKU sample",
  domain: "test",
  fields: [
    { key: "name", label: "SKU name", type: "string", required: true, primary: true },
    { key: "kind", label: "category", type: "enum", options: ["finished", "raw"], required: true },
    {
      key: "flag",
      label: "production material",
      type: "bool",
      hidden: true,
      systemGenerated: true,
      createDefaultBy: { field: "kind", values: { finished: false, raw: false } },
      help: "System-generated field; creating or editing cannot change this cell.",
    },
  ],
  lifecycle: singleState("active", "active", "green"),
  views: {
    list: { columns: ["name"], filters: [], searchable: ["name"] },
    form: [{ title: "info", fields: ["name", "kind"] }],
  },
});

const identity: Identity = {
  tenantId: "T1",
  orgId: "O1",
  userId: "U1",
  identify: "1",
  agentId: null,
  roles: [{ code: "role", name: "role" }],
  permissions: [],
  dataScopes: { skuLike: { policies: ["all"] as const, predicates: [] } },
  authorization: {
    applicationId: "open-erp",
    policyVersion: "v1",
    catalogDigest: "digest",
    decisionId: "decision",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
  },
};

const authorizer: RuntimeAuthorizer = {
  catalog: { byKey: { has: () => true } },
  canLedger: () => false,
  assertLedger: () => {
    throw new Error("test authorizer has no ledger criterion");
  },
  assert: () => undefined,
  assertModule: () => undefined,
  assertTransition: () => undefined,
  assertWritePayload: () => undefined,
  assertQuery: () => undefined,
};

function catalogOf(): RuntimeCatalog {
  return {
    modules: new Map([
      ["skuLike", { schema, planners: new Map(), actionPreparers: new Map() }],
    ]),
    choiceSets: [],
    moduleSettings: [],
  };
}

function reposOf(existing?: { header: Record<string, unknown> }) {
  const created: Record<string, unknown>[] = [];
  const bills = {
    async create(_identity: Identity, _module: string, header: Readonly<Record<string, unknown>>) {
      created.push({ ...header });
      return { id: "new-1", revision: 1, header: { ...header, status: "active" }, lines: {} };
    },
    async get() {
      return {
        id: "old-1",
        revision: 1,
        header: existing?.header ?? { status: "active", name: "existing", kind: "finished", flag: true },
        lines: {},
      };
    },
    async save(
      _identity: Identity,
      _module: string,
      _id: string,
      patch: Readonly<Record<string, unknown>>,
    ) {
      return {
        id: "old-1",
        revision: 2,
        header: { status: "active", name: "existing", kind: "finished", flag: true, ...patch },
        lines: {},
      };
    },
  };
  const repos = {
    bills,
    transaction: async <T>(fn: (on: typeof repos) => Promise<T>) => await fn(repos),
    handoff: { open: async () => undefined },
  } as unknown as ExecutionRepos;
  return { repos, created };
}

describe("createBill / saveDraft Letter Envelopment System Sub-sentence", () => {
  it("with flag: false to build a bill; with true refusal and indication of the return of the goods file", async () => {
    const ok = reposOf();
    const created = await createBill(
      { catalog: catalogOf(), repos: ok.repos, authorizer, now: () => new Date() },
      identity,
      "skuLike",
      { name: "dress", kind: "finished", flag: false },
      {},
    );
    expect(created.id).toBe("new-1");
    expect(ok.created[0]).toMatchObject({ name: "dress", flag: false });

    const steal = reposOf();
    await expect(
      createBill(
        { catalog: catalogOf(), repos: steal.repos, authorizer, now: () => new Date() },
        identity,
        "skuLike",
        { name: "toy", kind: "finished", flag: true },
        {},
      ),
    ).rejects.toThrow(/System-generated field/);
    expect(steal.created).toEqual([]);
  });

  it("reread true when saving without using the system button", async () => {
    const f = reposOf({ header: { status: "active", name: "suit", kind: "finished", flag: true } });
    let savedPatch: Readonly<Record<string, unknown>> | null = null;
    const bills = {
      ...f.repos.bills,
      async save(
        _identity: Identity,
        _module: string,
        _id: string,
        patch: Readonly<Record<string, unknown>>,
      ) {
        savedPatch = patch;
        return { id: "old-1", revision: 2, header: { status: "active", name: "suit revised", kind: "finished", flag: true }, lines: {} };
      },
    };
    // 🔴 `transaction` We have to retie this one: the one from the f.repos inheritance, the one that was captured behind closed doors.
    // ** The warehouse **, so the affairs are still uncovered save, saved Patch is never full.
    const repos = {
      ...f.repos,
      bills,
      transaction: async <T>(fn: (on: unknown) => Promise<T>): Promise<T> => await fn(repos),
    } as unknown as ExecutionRepos;
    await saveDraft(
      { catalog: catalogOf(), repos, authorizer, now: () => new Date() },
      identity,
      "skuLike",
      "old-1",
      { name: "suit revised", flag: true },
      null,
      1,
    );
    expect(savedPatch).toEqual({ name: "suit revised" });
  });
});
