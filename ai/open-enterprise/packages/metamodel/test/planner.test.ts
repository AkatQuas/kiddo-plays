import { describe, expect, it } from "vitest";
import {
  canonicalExecutionPlan,
  definePlanners,
  EXECUTION_TIME,
  isDefinedPlanners,
  normalizeExecutionPlan,
  plannerConsistencyOf,
  type ExecutionPlan,
} from "../src/index.js";

describe("exchangeplan is a closed, sequenced list of commands.", () => {
  it("balance read-set closed, heavy and in full coordinates and entered canonical fingerprints", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [],
      readSet: {
        ledgerBalances: [
          { target: "stock", subjectId: "p-b", scopeId: "wh-2" },
          { target: "stock", subjectId: "p-a", scopeId: "wh-1" },
        ],
      },
    });
    expect(plan.readSet?.ledgerBalances).toEqual([
      { target: "stock", subjectId: "p-a", scopeId: "wh-1" },
      { target: "stock", subjectId: "p-b", scopeId: "wh-2" },
    ]);
    expect(canonicalExecutionPlan(plan)).not.toBe(
      canonicalExecutionPlan(normalizeExecutionPlan({ version: 1, commands: [] })),
    );
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [],
      readSet: { ledgerBalances: [
        { target: "stock", subjectId: "p-a", scopeId: "wh-1" },
        { target: "stock", subjectId: "p-a", scopeId: "wh-1" },
      ] },
    })).toThrow(/repeats coordinate/);
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [],
      readSet: { ledgerBalances: [{ target: "unknown", subjectId: "p-a", scopeId: null }] },
    })).toThrow(/target .* is unknown/);
  });

  it("follow-up CreateBill id from preface", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [
        {
          type: "createBill",
          commandId: "production-task",
          module: "productionTask",
          header: { qty: 10 },
          lines: {},
        },
        {
          type: "createBill",
          commandId: "process-task",
          module: "processTask",
          header: {
            productionTaskId: { kind: "createdId", commandId: "production-task" },
          },
          lines: {
            steps: [{ parentId: { kind: "createdId", commandId: "production-task" } }],
          },
        },
        {
          type: "createReference",
          commandId: "order-to-task",
          source: { kind: "existing", module: "productionOrder", id: "order-1" },
          target: { kind: "createdId", commandId: "production-task" },
        },
      ],
    });

    expect(plan.commands).toHaveLength(3);
    expect(plan.commands[1]).toMatchObject({
      type: "createBill",
      header: { productionTaskId: { kind: "createdId", commandId: "production-task" } },
    });
  });

  it("forwards, self-references and loops do not indicate space: they can only point to previous crime Bill", () => {
    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          {
            type: "createBill",
            commandId: "process-task",
            module: "processTask",
            header: { parentId: { kind: "createdId", commandId: "production-task" } },
            lines: {},
          },
          {
            type: "createBill",
            commandId: "production-task",
            module: "productionTask",
            header: {},
            lines: {},
          },
        ],
      }),
    ).toThrow(/unknown or not-yet-executed createBill "production-task"/);

    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          {
            type: "createBill",
            commandId: "self",
            module: "productionTask",
            header: { parentId: { kind: "createdId", commandId: "self" } },
            lines: {},
          },
        ],
      }),
    ).toThrow(/unknown or not-yet-executed createBill "self"/);
  });

  it("the only person in the program who can't steal a name.", () => {
    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          { type: "createBill", commandId: "same", module: "a", header: {}, lines: {} },
          {
            type: "createReference",
            commandId: "same",
            source: { kind: "existing", module: "source", id: "1" },
            target: { kind: "createdId", commandId: "same" },
          },
        ],
      }),
    ).toThrow(/reuses commandId "same"/);
  });

  it("SQL, nudity and billing commands are not in union, unknown command directly rejects", () => {
    // 🔴 `updateStatus` / `appendLedger` ** Still ** Not in: new `setStatus` Yes.
    // "Take which side of the target module" is not "to change the status to what" -- the latter will bypass the target.
    // this is the second writing path.
    for (const type of ["sql", "updateStatus", "setState", "appendLedger", "patchBill"]) {
      expect(() =>
        normalizeExecutionPlan({
          version: 1,
          commands: [{ type, commandId: "forbidden" }],
        }),
      ).toThrow(/only createBill \/ createReference \/ setStatus \/ setGeneratedHeader \/ appendSourceLines \/ appendTargetLines/);
    }
  });

  it("the plan must have a visible version and payload must be stable; the conditional plan allows zero commands", () => {
    expect(() => normalizeExecutionPlan({ commands: [] })).toThrow(/version must be 1/);
    expect(normalizeExecutionPlan({ version: 1, commands: [] })).toEqual({ version: 1, commands: [] });
    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          { type: "createBill", commandId: "a", module: "a", header: { qty: Number.NaN }, lines: {} },
        ],
      }),
    ).toThrow(/finite number/);

    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          { type: "createBill", commandId: "a", module: "a", header: {}, lines: new Date() },
        ],
      }),
    ).toThrow(/lines must be a plain JSON object/);

    const inheritedLines = Object.create({ polluted: [{ qty: 1 }] }) as Record<string, unknown>;
    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          { type: "createBill", commandId: "a", module: "a", header: {}, lines: inheritedLines },
        ],
      }),
    ).toThrow(/lines must be a plain JSON object/);
  });
});

describe("appendSourceLines: Add only one additional item from the table to the current source list", () => {
  const append = (over: Readonly<Record<string, unknown>> = {}): unknown => ({
    version: 1,
    commands: [{
      type: "appendSourceLines",
      commandId: "append-assignments",
      table: "assignmentLines",
      rows: [{ workerId: "worker-1", assignedQty: 5 }],
      ...over,
    }],
  });

  it("no target / mobile / id, no watch or replace", () => {
    expect(normalizeExecutionPlan(append()).commands[0]).toEqual({
      type: "appendSourceLines",
      commandId: "append-assignments",
      table: "assignmentLines",
      rows: [{ workerId: "worker-1", assignedQty: 5 }],
    });
    for (const forbidden of [
      { target: { kind: "existing", module: "processTask", id: "task-1" } },
      { module: "processTask" },
      { id: "task-1" },
      { patch: { remark: "x" } },
      { replace: true },
    ]) {
      expect(() => normalizeExecutionPlan(append(forbidden))).toThrow(/unknown key/);
    }
  });

  it("a non-empty addition to an order must be made and only one table is available Okay.", () => {
    expect(() => normalizeExecutionPlan(append({ table: "" }))).toThrow(/table must be a non-empty string/);
    expect(() => normalizeExecutionPlan(append({ rows: [] }))).toThrow(/rows must not be empty/);
    expect(() => normalizeExecutionPlan(append({ rows: {} }))).toThrow(/rows must be an array/);
  });

  it("rejection of Created Id: Additional line only refers to established facts and does not extend the order to arbitrary return Write", () => {
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [
        { type: "createBill", commandId: "new-worker", module: "worker", header: {}, lines: {} },
        {
          type: "appendSourceLines",
          commandId: "append",
          table: "assignmentLines",
          rows: [{ workerId: { kind: "createdId", commandId: "new-worker" } }],
        },
      ],
    })).toThrow(/unknown or not-yet-executed createBill "new-worker"/);
  });

  it("table and rows enter canonical fingerprints", () => {
    const base = canonicalExecutionPlan(normalizeExecutionPlan(append()));
    expect(canonicalExecutionPlan(normalizeExecutionPlan(append({ table: "otherLines" })))).not.toBe(base);
    expect(canonicalExecutionPlan(normalizeExecutionPlan(append({
      rows: [{ workerId: "worker-1", assignedQty: 6 }],
    })))).not.toBe(base);
  });
});

describe("appendTargetLines: Adding the facts to the stock or to the planned new target", () => {
  it("database target target / table /rows / enclosed status", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "appendTargetLines",
        commandId: "append-progress",
        target: { kind: "existing", module: "processTask", id: "task-1" },
        table: "progressLines",
        rows: [{ qualifiedQty: 5 }],
        expectedStatus: "inProduction",
      }],
    });
    expect(plan.commands[0]).toEqual({
      type: "appendTargetLines",
      commandId: "append-progress",
      target: { kind: "existing", module: "processTask", id: "task-1" },
      table: "progressLines",
      rows: [{ qualifiedQty: 5 }],
      expectedStatus: "inProduction",
    });
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{ ...plan.commands[0], patch: { baseQualifiedQty: 5 } }],
    })).toThrow(/unknown key/);
  });

  it("can point forward to create Bill, and create Id in line only to quote the pre-order creation result", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [
        { type: "createBill", commandId: "worker", module: "worker", header: {}, lines: {} },
        { type: "createBill", commandId: "task", module: "processTask", header: {}, lines: {} },
        {
          type: "appendTargetLines",
          commandId: "append-created",
          target: { kind: "createdId", commandId: "task" },
          table: "progressLines",
          rows: [{ workerId: { kind: "createdId", commandId: "worker" }, qualifiedQty: 3 }],
          expectedStatus: "Awaiting assignment",
        },
      ],
    });
    expect(plan.commands[2]).toMatchObject({
      type: "appendTargetLines",
      target: { kind: "createdId", commandId: "task" },
    });

    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "appendTargetLines",
        commandId: "too-early",
        target: { kind: "createdId", commandId: "later" },
        table: "lines",
        rows: [{ refId: { kind: "createdId", commandId: "later" } }],
        expectedStatus: "draft",
      }],
    })).toThrow(/unknown or not-yet-executed createBill "later"/);
  });

  it("the non-empty line is bound to fill in the protocol, and any change in fact changes the fingerprints.", () => {
    const raw = {
      version: 1,
      commands: [{
        type: "appendTargetLines",
        commandId: "append",
        target: { kind: "existing", module: "task", id: "t-1" },
        table: "lines",
        rows: [{ qty: 1 }],
        expectedStatus: "inProgress",
      }],
    } as const;
    const base = canonicalExecutionPlan(normalizeExecutionPlan(raw));
    expect(() => normalizeExecutionPlan({
      ...raw,
      commands: [{ ...raw.commands[0], rows: [] }],
    })).toThrow(/rows must not be empty/);
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{ ...raw.commands[0], expectedStatus: "" }],
    })).toThrow(/expectedStatus must be a non-empty string/);
    expect(canonicalExecutionPlan(normalizeExecutionPlan({
      ...raw,
      commands: [{ ...raw.commands[0], rows: [{ qty: 2 }] }],
    }))).not.toBe(base);
  });
});

describe("setStatus: Push a new stock sheet or a pre-sequent list, and walk to the edge of the target module", () => {
  const push = (over: Readonly<Record<string, unknown>> = {}): unknown => ({
    version: 1,
    commands: [
      {
        type: "setStatus",
        commandId: "release-order",
        target: { kind: "existing", module: "productionOrder", id: "po-1" },
        transition: "release",
        expectedStatus: "awaitingRelease",
        ...over,
      },
    ],
  });

  it("shape closed: four keys a dozen, a few.", () => {
    const plan = normalizeExecutionPlan(push());
    expect(plan.commands[0]).toEqual({
      type: "setStatus",
      commandId: "release-order",
      target: { kind: "existing", module: "productionOrder", id: "po-1" },
      transition: "release",
      expectedStatus: "awaitingRelease",
    });

    // the change to a state doesn't mean space: it's a side, not a target state.
    expect(() => normalizeExecutionPlan(push({ toStatus: "releasing" }))).toThrow(/unknown key "toStatus"/);
    // border Parameter Equivalent (identified on SetStatusCommand)
    expect(() => normalizeExecutionPlan(push({ params: {} }))).toThrow(/unknown key "params"/);
    expect(() => normalizeExecutionPlan(push({ transition: "" }))).toThrow(/transition must be a non-empty string/);
    expect(() => normalizeExecutionPlan(push({ expectedStatus: null }))).toThrow(/expectedStatus must be a non-empty string/);
  });

  it("target can point to the forward line CreateBill, forward or unknown references are still rejected at the normalize stage", () => {
    expect(normalizeExecutionPlan({
        version: 1,
        commands: [
          { type: "createBill", commandId: "task", module: "productionTask", header: {}, lines: {} },
          {
            type: "setStatus",
            commandId: "start-it",
            target: { kind: "createdId", commandId: "task" },
            transition: "start",
            expectedStatus: "Awaiting start",
          },
        ],
      })).toMatchObject({ commands: [{ type: "createBill" }, { type: "setStatus", target: { kind: "createdId", commandId: "task" } }] });

    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "setStatus",
        commandId: "start-it",
        target: { kind: "createdId", commandId: "task" },
        transition: "start",
        expectedStatus: "Awaiting start",
      }],
    })).toThrow(/unknown or not-yet-executed createBill "task"/);

    // kind is another sentence: it's a misspelled, not a morphological error.
    expect(() => normalizeExecutionPlan(push({ target: { kind: "existing-bill", module: "a", id: "1" } }))).toThrow(
      /only existing \/ createdId/,
    );
  });

  it("setStatuscommandId does not output id:createdId still points to unknown CreateBill", () => {
    expect(() =>
      normalizeExecutionPlan({
        version: 1,
        commands: [
          {
            type: "setStatus",
            commandId: "release-order",
            target: { kind: "existing", module: "productionOrder", id: "po-1" },
            transition: "release",
            expectedStatus: "awaitingRelease",
          },
          {
            type: "createBill",
            commandId: "task",
            module: "productionTask",
            header: { orderId: { kind: "createdId", commandId: "release-order" } },
            lines: {},
          },
        ],
      }),
    ).toThrow(/unknown or not-yet-executed createBill "release-order"/);
  });

  /**
   * 🔴 ** Every cell is fingerprinted. ** One less is not wrong: Preview and Run have a plan each time.
   * the user confirmed that the "push this list" would be "push another sheet / walk the other side" and that the two fingerprints would be the same.
   */
  it("🔴 Change any setstatus cell, canonical JSON will change", () => {
    const base = canonicalExecutionPlan(normalizeExecutionPlan(push()));
    // key order does not change (canonical definition)
    expect(
      canonicalExecutionPlan(
        normalizeExecutionPlan({
          version: 1,
          commands: [
            {
              expectedStatus: "awaitingRelease",
              transition: "release",
              target: { id: "po-1", module: "productionOrder", kind: "existing" },
              commandId: "release-order",
              type: "setStatus",
            },
          ],
        }),
      ),
    ).toBe(base);

    for (const over of [
      { commandId: "release-order-2" },
      { target: { kind: "existing", module: "productionOrder", id: "po-2" } },
      { target: { kind: "existing", module: "salesOrder", id: "po-1" } },
      { transition: "retiredTransition" },
      { expectedStatus: "releasing" },
    ]) {
      expect(canonicalExecutionPlan(normalizeExecutionPlan(push(over)))).not.toBe(base);
    }
  });
});

describe("plan stable input for fingerprint", () => {
  it("object order does not affect canonical JSON, command array order remains semantic", () => {
    const left = normalizeExecutionPlan({
      version: 1,
      commands: [
        { type: "createBill", commandId: "a", module: "task", header: { b: 2, a: 1 }, lines: {} },
      ],
    });
    const right = normalizeExecutionPlan({
      commands: [
        { lines: {}, header: { a: 1, b: 2 }, module: "task", commandId: "a", type: "createBill" },
      ],
      version: 1,
    });
    expect(canonicalExecutionPlan(left)).toBe(canonicalExecutionPlan(right));

    const reordered = normalizeExecutionPlan({
      version: 1,
      commands: [
        { type: "createBill", commandId: "b", module: "task", header: {}, lines: {} },
        { type: "createBill", commandId: "a", module: "task", header: { a: 1, b: 2 }, lines: {} },
      ],
    });
    expect(canonicalExecutionPlan(left)).not.toBe(canonicalExecutionPlan(reordered));
  });

  it("elementTime is stable token, without preview time", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "createBill",
        commandId: "audit-fact",
        module: "task",
        header: { occurredAt: EXECUTION_TIME },
        lines: { lines: [{ recordedAt: { kind: "executionTime" } }] },
      }],
    });
    expect(plan.commands[0]).toEqual(expect.objectContaining({
      header: { occurredAt: EXECUTION_TIME },
    }));
    expect(canonicalExecutionPlan(plan)).toContain('"kind":"executionTime"');
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "createBill", commandId: "bad", module: "task",
        header: { occurredAt: { kind: "executionTime", value: "2026-01-01" } }, lines: {},
      }],
    })).toThrow(/only kind/);
  });

  it("created Field can only refer to the preface CreateBill and keep field coordinates", () => {
    const plan = normalizeExecutionPlan({
      version: 1,
      commands: [
        { type: "createBill", commandId: "receipt", module: "subcontractReceipt", header: { code: "R-001" }, lines: {} },
        {
          type: "createBill",
          commandId: "report",
          module: "processReport",
          header: { sourceBillCode: { kind: "createdField", commandId: "receipt", field: "code" } },
          lines: {},
        },
      ],
    });
    expect(plan.commands[1]).toMatchObject({
      type: "createBill",
      header: { sourceBillCode: { kind: "createdField", commandId: "receipt", field: "code" } },
    });
    expect(() => normalizeExecutionPlan({
      version: 1,
      commands: [{
        type: "createBill",
        commandId: "report",
        module: "processReport",
        header: { sourceBillCode: { kind: "createdField", commandId: "later", field: "code" } },
        lines: {},
      }],
    })).toThrow(/unknown or not-yet-executed createBill "later"/);
  });
});

describe("planner Registration Certificate", () => {
  it("definePlanners accept only non-empty lists of functions and leave unopenable vouchers", () => {
    const planners = definePlanners({
      release: async (): Promise<ExecutionPlan> => ({
        version: 1,
        commands: [{ type: "createBill", commandId: "a", module: "task", header: {}, lines: {} }],
      }),
    });
    expect(isDefinedPlanners(planners)).toBe(true);
    expect(plannerConsistencyOf(planners, "release")).toBe("exact");
    expect(Object.keys(planners)).toEqual(["release"]);
    expect(() => definePlanners({})).toThrow(/must not be empty/);
    expect(() => definePlanners({ release: 1 } as never)).toThrow(/must be a function/);
  });

  it("default exception, only relax the registered edge to last", () => {
    const release = async (): Promise<ExecutionPlan> => ({ version: 1, commands: [] });
    const planners = definePlanners({ release }, undefined, { release: "latest" });
    expect(plannerConsistencyOf(planners, "release")).toBe("latest");
    expect(Object.keys(planners)).toEqual(["release"]);
    expect(() => definePlanners({ release }, undefined, { missing: "latest" } as never)).toThrow(/unregistered/);
    expect(() => definePlanners({ release }, undefined, { release: "eventual" } as never)).toThrow(/exact \/ latest/);
  });
});
