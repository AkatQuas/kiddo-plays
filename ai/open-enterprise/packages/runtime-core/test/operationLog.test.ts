import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defineFixtureModule, singleState, type ModuleSchema } from "@open-erp/metamodel";
import { BillNotFoundError } from "../src/contracts/errors.js";
import type { BillRecord } from "../src/contracts/repositories.js";
import type { Identity, RuntimeAuthorizer, RuntimeCatalog } from "../src/index.js";
import {
  createBill,
  createInternalBill,
  createPlannedBill,
  deleteBill,
  executeInternalTransition,
  executeTransition,
  executeTransitionAsPlanEffect,
  saveDraft,
  saveInternalHeader,
  type AuditEntry,
  type ExecutionRepos,
  type NewOperationLog,
} from "../src/execute/execute.js";
import {
  assertNewOperationLog,
  operationLogActor,
  operationLogContent,
  operationLogSource,
} from "../src/execute/operationLog.js";

const bill = defineFixtureModule({
  code: "opBill",
  label: "operation sample",
  domain: "test",
  fields: [
    { key: "code", label: "document number", type: "string", required: true, primary: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true, editable: "full" },
      { key: "done", label: "done", terminal: true },
    ],
    transitions: [
      { code: "submit", from: "draft", to: "done", action: "submit" },
      { code: "ship", from: "draft", to: "done", action: "ship", push: "opDelivery" },
      { code: "syncShip", from: "draft", to: "done", action: "system ship", internal: true, push: "opDelivery" },
    ],
  },
  views: {
    list: { columns: ["code"], filters: [], searchable: ["code"] },
    form: [{ title: "info", fields: ["code"] }],
  },
});

const delivery = defineFixtureModule({
  code: "opDelivery",
  label: "delivery sample",
  domain: "test",
  fields: [
    { key: "code", label: "document number", type: "string", required: true, primary: true },
  ],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code"], filters: [], searchable: ["code"] },
    form: [{ title: "info", fields: ["code"] }],
  },
});

const systemBill = defineFixtureModule({
  code: "opSystem",
  label: "system sample",
  domain: "test",
  capabilities: { create: "system" },
  fields: [
    { key: "code", label: "document number", type: "string", required: true, primary: true },
  ],
  lifecycle: singleState("active", "active", "green"),
  views: {
    list: { columns: ["code"], filters: [], searchable: ["code"] },
    form: [{ title: "info", fields: ["code"] }],
  },
});

const SCHEMAS = new Map<string, ModuleSchema>([
  [bill.code, bill],
  [delivery.code, delivery],
  [systemBill.code, systemBill],
]);

const NOW = new Date("2026-10-09T01:02:03.000Z");

function identityOf(agentId: string | null): Identity {
  return {
    tenantId: "T1",
    orgId: "O1",
    userId: "U1",
    identify: "1",
    agentId,
    roles: [{ code: "role", name: "role" }],
    permissions: [],
    dataScopes: {},
    authorization: {
      applicationId: "open-erp",
      policyVersion: "v1",
      catalogDigest: "digest",
      decisionId: "decision",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
    },
  };
}

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

interface StoredBill {
  id: string;
  revision: number;
  header: Record<string, unknown>;
  lines: Record<string, readonly Record<string, unknown>[]>;
}

interface Logged {
  readonly via: "outer" | "tx";
  readonly userId: string;
  readonly agentId: string | null;
  readonly entry: NewOperationLog;
}

function catalogOf(): RuntimeCatalog {
  return {
    modules: new Map([...SCHEMAS].map(([code, schema]) => [
      code,
      { schema, planners: new Map(), actionPreparers: new Map() },
    ])),
    choiceSets: [],
    moduleSettings: [],
  };
}

function harness() {
  const bills = new Map<string, StoredBill>();
  const committed: Logged[] = [];
  const audits: AuditEntry[] = [];
  const state = { failChange: false, changeCalls: 0 };

  const initialKey = (module: string): string => {
    const schema = SCHEMAS.get(module);
    return schema?.lifecycle.statuses.find((status) => status.initial)?.key ?? "draft";
  };

  const remember = (module: string, header: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, readonly Record<string, unknown>[]>>): BillRecord => {
    const schema = SCHEMAS.get(module);
    const next: Record<string, unknown> = { ...header, status: initialKey(module) };
    const primary = schema?.fields.find((field) => field.primary);
    if (primary && (typeof next[primary.key] !== "string" || String(next[primary.key]).trim() === "")) {
      next[primary.key] = module === "opDelivery" ? "FH-1" : "XS-1";
    }
    const row: StoredBill = {
      id: randomUUID(),
      revision: 1,
      header: next,
      lines: { ...lines },
    };
    bills.set(row.id, row);
    return { id: row.id, revision: row.revision, header: { ...row.header }, lines: row.lines };
  };

  const read = (module: string, id: string): BillRecord => {
    const row = bills.get(id);
    if (row === undefined) throw new BillNotFoundError(module, id, "not found");
    return { id: row.id, revision: row.revision, header: { ...row.header }, lines: row.lines };
  };

  const logOf = (via: "outer" | "tx", identity: Identity, entry: NewOperationLog): Logged => {
    const actor = operationLogActor(identity);
    return { via, userId: actor.userId, agentId: actor.agentId, entry };
  };

  const billRepo = {
    async create(_identity: Identity, module: string, header: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, readonly Record<string, unknown>[]>>) {
      return remember(module, header, lines);
    },
    async createGenerated(_identity: Identity, module: string, header: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, readonly Record<string, unknown>[]>>) {
      return remember(module, header, lines);
    },
    async get(_identity: Identity, module: string, id: string) {
      return read(module, id);
    },
    async lockForAction(_identity: Identity, module: string, id: string) {
      return read(module, id);
    },
    async save(_identity: Identity, _module: string, id: string, patch: Readonly<Record<string, unknown>>) {
      const row = bills.get(id);
      if (row === undefined) throw new Error("this bill does not exist");
      row.revision += 1;
      row.header = { ...row.header, ...patch };
      return read(_module, id);
    },
    async setStatus(_identity: Identity, module: string, id: string, _from: string, to: string) {
      const row = bills.get(id);
      if (row === undefined) throw new BillNotFoundError(module, id, "not found");
      row.revision += 1;
      row.header = { ...row.header, status: to };
    },
    async setGeneratedHeader(_identity: Identity, module: string, id: string, patch: Readonly<Record<string, unknown>>) {
      const row = bills.get(id);
      if (row === undefined) throw new BillNotFoundError(module, id, "not found");
      row.revision += 1;
      row.header = { ...row.header, ...patch };
      return read(module, id);
    },
    async remove(_identity: Identity, _module: string, id: string) {
      bills.delete(id);
    },
  };

  const repos = {
    bills: billRepo,
    ledger: { rowsOf: async () => [], append: async () => undefined },
    handoff: { open: async () => undefined, closeOpen: async () => undefined },
    references: { append: async () => undefined },
    audit: {
      async find(_identity: Identity, module: string, billId: string, transitionCode: string, idempotencyKey: string) {
        return audits.find((row) =>
          row.module === module && row.billId === billId && row.transitionCode === transitionCode && row.idempotencyKey === idempotencyKey,
        ) ?? null;
      },
      async list() {
        return [];
      },
      async append(identity: Identity, entry: Omit<AuditEntry, "id" | "actorId" | "policyVersion" | "decisionId">) {
        const row: AuditEntry = {
          ...entry,
          id: randomUUID(),
          actorId: identity.userId,
          policyVersion: identity.authorization.policyVersion,
          decisionId: identity.authorization.decisionId,
        };
        audits.push(row);
        return row;
      },
    },
    operationLogs: {
      async append(identity: Identity, entry: NewOperationLog) {
        assertNewOperationLog(entry);
        committed.push(logOf("outer", identity, entry));
      },
    },
    changeEvents: {
      async append() {
        throw new Error("wrote a change fact outside the transaction");
      },
    },
    async transaction<T>(fn: (on: ExecutionRepos) => Promise<T>): Promise<T> {
      const buffer: Logged[] = [];
      const snap = new Map([...bills].map(([id, row]) => [id, { ...row, header: { ...row.header } }]));
      const auditCount = audits.length;
      const tx = {
        ...repos,
        operationLogs: {
          async append(identity: Identity, entry: NewOperationLog) {
            assertNewOperationLog(entry);
            buffer.push(logOf("tx", identity, entry));
          },
        },
        changeEvents: {
          async append() {
            state.changeCalls += 1;
            if (state.failChange) throw new Error("change fact failed");
          },
        },
      };
      try {
        const result = await fn(tx as ExecutionRepos);
        committed.push(...buffer);
        return result;
      } catch (error) {
        bills.clear();
        for (const [id, row] of snap) bills.set(id, row);
        audits.length = auditCount;
        throw error;
      }
    },
  } as unknown as ExecutionRepos;

  return {
    repos,
    bills,
    committed,
    state,
    deps: {
      catalog: catalogOf(),
      repos,
      authorizer,
      now: () => NOW,
    },
  };
}

describe("operation Log Writing", () => {
  it("creates a new profile by hand, operator identifies, empty agent Id is a user", async () => {
    const { deps, committed } = harness();
    const who = identityOf(null);
    const created = await createBill(deps, who, "opBill", { code: "XS-1", actorUserId: "someone-else" }, {});
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({
      via: "tx",
      userId: "U1",
      agentId: null,
    });
    expect(committed[0]?.entry).toMatchObject({
      module: "opBill",
      billId: created.id,
      billCode: "XS-1",
      kind: "create",
      action: null,
      at: NOW,
    });
    expect(operationLogSource(committed[0]?.agentId ?? null)).toBe("User");
    expect(operationLogContent("create", "operation sample", "XS-1", null)).toBe("Created operation sample XS-1");
  });

  it("the writing source with angentId is smart, and the content is still the same line as the document", async () => {
    const { deps, committed } = harness();
    await createBill(deps, identityOf("agent-7"), "opBill", { code: "XS-2" }, {});
    expect(committed[0]?.agentId).toBe("agent-7");
    expect(operationLogSource("agent-7")).toBe("Agent");
    expect(operationLogContent("create", "operation sample", "XS-2", null)).toBe("Created operation sample XS-2");
    expect(operationLogContent("create", "operation sample", "XS-2", null)).not.toContain("AI");
  });

  it("empty", () => {
    expect(operationLogActor(identityOf("  ")).agentId).toBeNull();
    expect(operationLogSource(null)).toBe("User");
  });

  it("plan to generate new logs; system generation and system covers not recorded", async () => {
    const { deps, committed, state, bills } = harness();
    const who = identityOf(null);
    const planned = await createPlannedBill(deps, who, "opBill", { code: "XS-3" }, {});
    expect(committed.map((row) => row.entry.kind)).toEqual(["create"]);
    expect(committed[0]?.entry.billId).toBe(planned.id);

    const before = state.changeCalls;
    await createInternalBill(deps, who, "opSystem", { code: "SYS-1" });
    expect(committed).toHaveLength(1);
    expect(state.changeCalls).toBeGreaterThan(before);

    const seeded = randomUUID();
    bills.set(seeded, { id: seeded, revision: 1, header: { status: "active", code: "SYS-1" }, lines: {} });
    const changes = state.changeCalls;
    await saveInternalHeader(deps, who, "opSystem", seeded, { code: "SYS-2" }, 1);
    expect(committed).toHaveLength(1);
    expect(state.changeCalls).toBe(changes + 1);
  });

  it("modify note, remove pre-copy number", async () => {
    const { deps, committed } = harness();
    const who = identityOf(null);
    const created = await createBill(deps, who, "opBill", { code: "XS-4" }, {});
    await saveDraft(deps, who, "opBill", created.id, { code: "XS-4B" }, null, 1);
    await deleteBill(deps, who, "opBill", created.id, 2);
    expect(committed.map((row) => [row.entry.kind, row.entry.billCode])).toEqual([
      ["create", "XS-4"],
      ["update", "XS-4B"],
      ["delete", "XS-4B"],
    ]);
    expect(committed.every((row) => row.entry.action === null && row.via === "tx")).toBe(true);
  });

  it("file main key is not uuid delete the operation log and do not roll back", async () => {
    const { deps, committed, bills } = harness();
    const who = identityOf(null);
    bills.set("so-0004", {
      id: "so-0004",
      revision: 1,
      header: { status: "draft", code: "XS-20260709-0001" },
      lines: {},
    });
    await deleteBill(deps, who, "opBill", "so-0004", 1);
    expect(bills.has("so-0004")).toBe(false);
    expect(committed).toEqual([
      expect.objectContaining({
        via: "tx",
        entry: expect.objectContaining({
          module: "opBill",
          billId: "so-0004",
          billCode: "XS-20260709-0001",
          kind: "delete",
          action: null,
        }),
      }),
    ]);
  });

  it("empty document id refused", () => {
    expect(() => assertNewOperationLog({
      module: "opBill",
      billId: "",
      billCode: null,
      kind: "delete",
      action: null,
      at: NOW,
    })).toThrow("Operation log bill id must not be empty");
  });

  it("streaming line; replaying the same key", async () => {
    const { deps, committed } = harness();
    const who = identityOf(null);
    const created = await createBill(deps, who, "opBill", { code: "XS-5" }, {});
    const args = {
      identity: who,
      module: "opBill",
      billId: created.id,
      transition: "submit",
      params: {},
      confirmedWarning: null,
      idempotencyKey: "once",
      expectedRevision: 1,
    };
    const first = await executeTransition(deps, args);
    const second = await executeTransition(deps, args);
    expect(first.outcome).toBe("executed");
    expect(second.outcome).toBe("replayed");
    const transitions = committed.filter((row) => row.entry.kind === "transition");
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.entry).toMatchObject({
      billCode: "XS-5",
      action: "submit",
      module: "opBill",
    });
    expect(operationLogContent("transition", "operation sample", "XS-5", "submit")).toBe("submit operation sample XS-5");
  });

  it("internal flow is not recorded; people press push flow and new downstream", async () => {
    const { deps, committed, state } = harness();
    const who = identityOf("agent-9");
    const internalBill = await createBill(deps, identityOf(null), "opBill", { code: "XS-6" }, {});
    const before = committed.length;
    const changes = state.changeCalls;
    await executeInternalTransition(deps, {
      identity: who,
      module: "opBill",
      billId: internalBill.id,
      transition: "syncShip",
      params: {},
      confirmedWarning: null,
      idempotencyKey: null,
      expectedRevision: 1,
    });
    expect(committed).toHaveLength(before);
    expect(state.changeCalls).toBeGreaterThan(changes);

    const actorBill = await createBill(deps, who, "opBill", { code: "XS-7" }, {});
    const from = committed.length;
    await executeTransition(deps, {
      identity: who,
      module: "opBill",
      billId: actorBill.id,
      transition: "ship",
      params: {},
      confirmedWarning: null,
      idempotencyKey: null,
      expectedRevision: 1,
    });
    const added = committed.slice(from);
    expect(added.map((row) => [row.entry.kind, row.entry.module])).toEqual([
      ["create", "opDelivery"],
      ["transition", "opBill"],
    ]);
    expect(added[1]?.entry.action).toBe("ship");
    expect(added[0]).toMatchObject({
      agentId: "agent-9",
      entry: { module: "opDelivery", kind: "create", billCode: "FH-1", action: null },
    });
    expect(operationLogContent("create", "delivery sample", "FH-1", null)).toBe("Created delivery sample FH-1");
  });

  it("the internal side of the plan does not remember the drift.", async () => {
    const { deps, committed, state } = harness();
    const who = identityOf(null);
    const created = await createBill(deps, who, "opBill", { code: "XS-9" }, {});
    const before = committed.length;
    const changes = state.changeCalls;
    const result = await executeTransitionAsPlanEffect(deps, {
      identity: who,
      module: "opBill",
      billId: created.id,
      transition: "syncShip",
    });
    expect(result.outcome).toBe("executed");
    const added = committed.slice(before);
    expect(added.filter((row) => row.entry.kind === "transition")).toEqual([]);
    expect(added.filter((row) => row.entry.kind === "create")).toEqual([]);
    expect(state.changeCalls).toBeGreaterThan(changes);
  });

  it("the same push-down flow is the same as a new one downstream.", async () => {
    const { deps, committed } = harness();
    let seconds = 0;
    deps.now = () => new Date(Date.UTC(2026, 9, 9, 0, 0, seconds++));
    const who = identityOf(null);
    const created = await createBill(deps, who, "opBill", { code: "XS-T" }, {});
    const from = committed.length;
    await executeTransition(deps, {
      identity: who,
      module: "opBill",
      billId: created.id,
      transition: "ship",
      params: {},
      confirmedWarning: null,
      idempotencyKey: null,
      expectedRevision: 1,
    });
    const added = committed.slice(from);
    const createdRow = added.find((row) => row.entry.kind === "create");
    const transition = added.find((row) => row.entry.kind === "transition");
    expect(createdRow?.entry.module).toBe("opDelivery");
    expect(transition?.entry.action).toBe("ship");
    expect(transition?.entry.at.getTime()).toBe(createdRow?.entry.at.getTime());
    const later = deps.now().getTime();
    expect(later).toBeGreaterThan(transition?.entry.at.getTime() ?? later);
  });

  it("there's no business rollback log, and it's written in the business.", async () => {
    const { deps, committed, bills, state } = harness();
    state.failChange = true;
    await expect(createBill(deps, identityOf(null), "opBill", { code: "XS-8" }, {})).rejects.toThrow("change fact failed");
    expect(committed).toEqual([]);
    expect(bills.size).toBe(0);
  });
});

describe("operation log contents", () => {
  it("it's empty. It doesn't spell behind the sentence.", () => {
    expect(operationLogContent("delete", "sales order", null, null)).toBe("Deleted sales order");
    expect(operationLogContent("update", "sales order", "  ", null)).toBe("Updated sales order");
    expect(operationLogContent("transition", "sales order", "XS-20260803-0001", "approved")).toBe("approved sales order XS-20260803-0001");
  });
});
