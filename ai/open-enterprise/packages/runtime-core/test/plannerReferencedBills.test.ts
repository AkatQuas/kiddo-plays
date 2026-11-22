import { describe, expect, it, vi } from "vitest";
import { normalizeFixtureModule } from "@open-erp/metamodel";
import {
  computeExecutionPlan,
  PLANNER_REFERENCED_BILLS_MAX_LIMIT,
  planningReadContext,
  type ExecutionRepos,
  type Identity,
  type RuntimeAuthorizer,
  type RuntimeCatalog,
} from "../src/index.js";

function catalogOf(): RuntimeCatalog {
  const module = (code: string) => ({
    schema: normalizeFixtureModule({
      code,
      label: code,
      domain: "test",
      fields: [{ key: "code", type: "string", primary: true }],
      lifecycle: {
        statuses: [{ key: "active", initial: true }],
        transitions: code === "source"
          ? [{ code: "close", from: "active", to: "active", action: "close" }]
          : [],
      },
      views: { list: { columns: ["code"] }, form: [] },
    }),
    planners: new Map(),
    actionPreparers: new Map(),
  });
  return {
    modules: new Map([["source", module("source")], ["target", module("target")]]),
    choiceSets: [],
    moduleSettings: [],
  };
}

const identity: Identity = {
  tenantId: "T1",
  orgId: "O1",
  userId: "U1",
  identify: "1",
  agentId: null,
  roles: [{ code: "role", name: "role" }],
  permissions: [],
  dataScopes: { source: { policies: ["all"] as const, predicates: [] }, target: { policies: ["all"] as const, predicates: [] } },
  authorization: {
    applicationId: "open-erp",
    policyVersion: "v1",
    catalogDigest: "digest",
    decisionId: "decision",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
  },
};

function fixture(options?: { readonly deny?: string; readonly sourceInvisible?: boolean }) {
  const asserted: string[] = [];
  const listTargets = vi.fn(async () => ({
    rows: [{ id: "T-2", status: "done" }, { id: "T-1", status: "open" }],
    truncated: false,
  }));
  const get = vi.fn(async (_identity, module: string, id: string) => {
    if (options?.sourceInvisible) throw new Error("record does not exist or is not visible");
    return { id, revision: 1, header: { status: "active", module }, lines: {} };
  });
  const balance = vi.fn(async () => 8);
  const authorizer: RuntimeAuthorizer = {
    catalog: { byKey: { has: () => true } },
    canLedger: () => false,
    assertLedger: () => {
      throw new Error("test authorizer has no ledger criterion");
    },
    assert: () => undefined,
    assertModule: (_identity, module, action) => {
      asserted.push(`${module}:${action}`);
      if (options?.deny === module) throw new Error(`no ${module}:read permission`);
    },
    assertTransition: () => undefined,
    assertWritePayload: () => undefined,
    assertQuery: () => undefined,
  };
  const repos = {
    bills: { get },
    ledger: { balance },
    references: { listTargets },
    moduleSettings: { get: vi.fn() },
  } as unknown as Pick<ExecutionRepos, "bills" | "ledger" | "references" | "moduleSettings">;
  return { asserted, authorizer, repos, get, balance, listTargets };
}

describe("planner References", () => {
  it("account balances to retain precise subject/scope and identity without writing locks at the pure planning stage", async () => {
    const f = fixture();
    const read = planningReadContext(
      { catalog: catalogOf(), repos: f.repos, authorizer: f.authorizer },
      { identity, module: "source", transition: "close" },
    );
    await expect(read.ledgerBalance?.("stock", "product-b", "warehouse-1")).resolves.toBe(8);
    expect(f.balance).toHaveBeenCalledWith(identity, "stock", "product-b", "warehouse-1", false);
  });

  it("read first at both ends, source the affected area BillRepo, and then by id the whole sequence.", async () => {
    const f = fixture();
    const read = planningReadContext(
      { catalog: catalogOf(), repos: f.repos, authorizer: f.authorizer },
      { identity, module: "source", transition: "close" },
    );

    await expect(read.listReferencedBills?.("source", "S-1", "target", 10)).resolves.toEqual({
      rows: [{ id: "T-1", status: "open" }, { id: "T-2", status: "done" }],
      truncated: false,
    });
    expect(f.asserted).toEqual(["source:read", "target:read"]);
    expect(f.get).toHaveBeenCalledWith(identity, "source", "S-1");
    expect(f.listTargets).toHaveBeenCalledWith(identity, "source", "S-1", "target", 10);
  });

  it("target does not read or source fail-closed, never touch reference query", async () => {
    const denied = fixture({ deny: "target" });
    const deniedRead = planningReadContext(
      { catalog: catalogOf(), repos: denied.repos, authorizer: denied.authorizer },
      { identity, module: "source", transition: "close" },
    );
    await expect(deniedRead.listReferencedBills?.("source", "S-1", "target", 10)).rejects.toThrow(/no target:read/);
    expect(denied.listTargets).not.toHaveBeenCalled();

    const invisible = fixture({ sourceInvisible: true });
    const invisibleRead = planningReadContext(
      { catalog: catalogOf(), repos: invisible.repos, authorizer: invisible.authorizer },
      { identity, module: "source", transition: "close" },
    );
    await expect(invisibleRead.listReferencedBills?.("source", "S-1", "target", 10)).rejects.toThrow(/not visible/);
    expect(invisible.listTargets).not.toHaveBeenCalled();
  });

  it("it's hard-on, it's empty, id and it's denied until we're ready for storage.", async () => {
    const f = fixture();
    const read = planningReadContext(
      { catalog: catalogOf(), repos: f.repos, authorizer: f.authorizer },
      { identity, module: "source", transition: "close" },
    );
    await expect(read.listReferencedBills?.("source", "S-1", "target", PLANNER_REFERENCED_BILLS_MAX_LIMIT + 1))
      .rejects.toThrow(/limit must be an integer from 1 to 100/);
    await expect(read.listReferencedBills?.("source", "  ", "target", 10)).rejects.toThrow(/sourceId must be a non-empty string/);
    expect(f.listTargets).not.toHaveBeenCalled();
  });
});

describe("planner account balance reading Set", () => {
  it("runtime Automatically Generate ReadSet by Practical Read; Business Planner cannot fill it in hand", async () => {
    const f = fixture();
    const args = { identity, module: "source", billId: "S-1", transition: "close", params: {} };
    const bill = { id: "S-1", revision: 1, header: { status: "active" }, lines: {} };
    const plan = await computeExecutionPlan(
      { catalog: catalogOf(), repos: f.repos, authorizer: f.authorizer },
      args,
      bill,
      async (ctx) => {
        await ctx.read.ledgerBalance?.("stock", "product-b", "warehouse-1");
        // repeated reading can only form one lock coordinate.
        await ctx.read.ledgerBalance?.("stock", "product-b", "warehouse-1");
        return { version: 1, commands: [] };
      },
    );
    expect(plan.readSet).toEqual({
      ledgerBalances: [{ target: "stock", subjectId: "product-b", scopeId: "warehouse-1" }],
    });
    expect(f.balance).toHaveBeenCalledTimes(2);

    await expect(computeExecutionPlan(
      { catalog: catalogOf(), repos: f.repos, authorizer: f.authorizer },
      args,
      bill,
      async () => ({
        version: 1,
        commands: [],
        readSet: { ledgerBalances: [] },
      }),
    )).rejects.toThrow(/must not fill readSet by hand/);
  });
});
