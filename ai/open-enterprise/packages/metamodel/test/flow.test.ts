import { describe, expect, it } from "vitest";
import {
  defineFixtureFlow,
  defineFixtureModule,
  flowCapabilityOf,
  flowDependenciesOf,
  isGapBlocking,
  validateFlow,
  type ModuleSchema,
} from "../src/index.js";

// plugins: two singles, one normal link, plus one system side —
//
// the shape follows the real part of the net: document A is in the making and the next step is to start with "awaiting Shipment."
// One in the middle. `internal` On the other hand, it is not possible to see the current situation on the Internet.
// this place is the easiest place to misperceive when a blow check, so the binder directly recaptulates it.

const order = defineFixtureModule({
  code: "order",
  label: "Order",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "pendingReview", label: "pendingReview" },
      { key: "In process", label: "In process" },
      { key: "awaitingShipment", label: "awaitingShipment" },
      { key: "completed", label: "completed", terminal: true },
    ],
    transitions: [
      { code: "submit", from: "draft", to: "pendingReview", action: "Submit for review" },
      { code: "approve", from: "pendingReview", to: "In process", action: "Approve" },
      // system side: No one can light, but it's the only way to make "awaiting Shipment"
      { code: "released", from: "In process", to: "awaitingShipment", action: "Finished and ready to ship", internal: true },
      { code: "ship", from: "awaitingShipment", to: "awaitingShipment", action: "Ship", push: "delivery" },
      { code: "finish", from: "awaitingShipment", to: "completed", action: "Shipment complete" },
    ],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "customerId"] }] },
});

const delivery = defineFixtureModule({
  code: "delivery",
  label: "Issue",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "orderId", label: "Order", type: "ref", ref: "order", required: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "amount", label: "Amount", type: "money", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "shipped", label: "shipped", terminal: true },
    ],
    transitions: [
      {
        code: "confirm",
        from: "draft",
        to: "shipped",
        action: "Confirm issue",
        effects: [
          {
            target: "ap",
            op: "in",
            subject: "$bill.supplierId",
            amount: "{amount}",
            reverseOn: [],
          },
        ],
      },
    ],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "orderId", "supplierId", "amount"] }] },
});

const customer = defineFixtureModule({
  code: "customer",
  label: "Customer",
  domain: "demo",
  fields: [{ key: "name", label: "Name", type: "string", required: true, primary: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "Active", initial: true, terminal: true }],
    transitions: [],
  },
  views: { list: { columns: ["name"] }, form: [{ title: "Main", fields: ["name"] }] },
});

const MODULES: ReadonlyMap<string, ModuleSchema> = new Map([
  ["order", order],
  ["delivery", delivery],
  ["customer", customer],
]);

const ROLES = new Set(["sales", "warehouse"]);

function step(over: Record<string, unknown>): Record<string, unknown> {
  return {
    key: "s",
    label: "one step",
    kind: "action",
    module: "order",
    transition: "approve",
    where: null,
    actor: null,
    note: null,
    next: [],
    at: null,
    ...over,
  };
}

function flow(steps: readonly Record<string, unknown>[], over: Record<string, unknown> = {}) {
  return defineFixtureFlow({
    code: "demo-flow",
    label: "Demo flow",
    domain: "demo",
    purpose: "A fixture flow that shows what this validation checks",
    owner: "sales",
    triggerWords: [],
    entry: steps[0]!["key"],
    steps,
    ...over,
  });
}

// shape gate: this self-discovered error —

describe("normalizeFlow Shape", () => {
  it("action Must Write Module and Transtion", () => {
    expect(() => flow([step({ key: "a", transition: null })])).toThrow(/transition is required/);
    expect(() => flow([step({ key: "a", module: null })])).toThrow(/module is required/);
  });

  it("manual / Note Do not point to the module -- otherwise it will be considered a \"system can't do it, but I'll draw first\" position.", () => {
    expect(() => flow([step({ key: "a", kind: "manual", transition: null })])).toThrow(
      /module \/ transition must not be written/,
    );
  });

  it("query Do not write", () => {
    expect(() => flow([step({ key: "a", kind: "query", where: null })])).toThrow(/does not walk an edge/);
  });

  it("fault point to steps that do not exist in this process - Hard failure and list optional keys", () => {
    expect(() =>
      flow([step({ key: "a", next: [{ to: "nope", whenStatus: null, label: null }] })]),
    ).toThrow(/this flow has no such step.*a/s);
  });

  it("don't point at yourself.", () => {
    expect(() =>
      flow([step({ key: "a", next: [{ to: "a", whenStatus: null, label: null }] })]),
    ).toThrow(/branches to itself/);
  });

  it("step key repeat -- it leads the way, it doesn't.", () => {
    expect(() => flow([step({ key: "a" }), step({ key: "a" })])).toThrow(/duplicated/);
  });

  it("it's too short a time to say no -- it's the first line seen by the trial, and it can't copy the name again.", () => {
    expect(() => flow([step({ key: "a" })], { purpose: "Go" })).toThrow(/too short/i);
  });

  it("code can only be kebab - it enters URL and route index", () => {
    expect(() => flow([step({ key: "a" })], { code: "Demo_Flow" })).toThrow(/illegal shape/);
  });

  it("coordinates can be defaulted - process written by angent does not care about layout and cannot be rejected for missing one", () => {
    const f = flow([step({ key: "a", at: null })]);
    expect(f.steps[0]!.at).toBeNull();
  });
});

// cross-module verification —

describe("validateFlow Cross Module", () => {
  it("= Fatal, list the side where the module is moved.", () => {
    const problems = validateFlow(flow([step({ key: "a", transition: "nope" })]), {
      modules: MODULES,
      roles: ROLES,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]!.severity).toBe("fatal");
    expect(problems[0]!.code).toBe("FLOW_TRANSITION_UNKNOWN");
    // 🔴 The error message needs to be right: list options, not just "no."
    expect(problems[0]!.message).toContain("approve (Approve: pendingReview→In process)");
    // the system is not an option -- it can't be a step.
    expect(problems[0]!.message).not.toContain("released");
  });

  it("take the system side step = Fatal -- the implementer will be stuck on a non-existent button.", () => {
    const problems = validateFlow(flow([step({ key: "a", transition: "released" })]), {
      modules: MODULES,
      roles: ROLES,
    });
    expect(problems[0]!.code).toBe("FLOW_TRANSITION_INTERNAL");
  });

  it("responsible role unknown = Fatal; rolls skip this one for empty set, not lose it all", () => {
    const f = flow([step({ key: "a", actor: "nobody" })]);
    expect(validateFlow(f, { modules: MODULES, roles: ROLES })[0]!.code).toBe("FLOW_ACTOR_UNKNOWN");
    expect(validateFlow(f, { modules: MODULES, roles: new Set() })).toHaveLength(0);
  });

  it("connect directly to module = no problem", () => {
    const problems = validateFlow(
      flow([
        step({ key: "a", transition: "submit", next: [{ to: "b", whenStatus: "pendingReview", label: null }] }),
        step({ key: "b", transition: "approve" }),
      ]),
      { modules: MODULES, roles: ROLES },
    );
    expect(problems).toHaveLength(0);
  });

  it("the middle is attached to the system.", () => {
    const problems = validateFlow(
      flow([
        step({ key: "a", transition: "approve", next: [{ to: "b", whenStatus: "awaitingShipment", label: null }] }),
        step({ key: "b", transition: "finish" }),
      ]),
      { modules: MODULES, roles: ROLES },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]!.code).toBe("FLOW_SYSTEM_BRIDGE");
    expect(problems[0]!.message).toContain("Finished and ready to ship");
    // 🔴 It's not a gap: it's a normal shape of normal business processes, just to be marked on the details page.
    expect(isGapBlocking(problems[0]!)).toBe(false);
  });

  it("i can't catch it.", () => {
    const problems = validateFlow(
      flow([
        step({ key: "a", transition: "submit", next: [{ to: "b", whenStatus: null, label: null }] }),
        step({ key: "b", transition: "finish" }),
      ]),
      { modules: MODULES, roles: ROLES },
    );
    const gap = problems.find((p) => p.code === "FLOW_STATUS_DISCONTINUOUS");
    expect(gap).toBeDefined();
    expect(isGapBlocking(gap!)).toBe(true);
    expect(gap!.message).toContain("a step is missing in between");
  });

  it("= gap.", () => {
    const problems = validateFlow(
      flow([
        step({ key: "a", transition: "submit", next: [{ to: "b", whenStatus: "completed", label: "Wrong" }] }),
        step({ key: "b", transition: "approve" }),
      ]),
      { modules: MODULES, roles: ROLES },
    );
    expect(problems.some((p) => p.code === "FLOW_BRANCH_STATUS_MISMATCH")).toBe(true);
  });

  it("cross-module references; two unrelated stand-alone = gap", () => {
    const linkedFlow = flow([
      step({ key: "a", transition: "ship", next: [{ to: "b", whenStatus: "draft", label: null }] }),
      step({ key: "b", module: "delivery", transition: "confirm" }),
    ]);
    expect(validateFlow(linkedFlow, { modules: MODULES, roles: ROLES })).toHaveLength(0);

    const strangers = flow([
      step({ key: "a", transition: "submit", next: [{ to: "b", whenStatus: null, label: null }] }),
      step({ key: "b", module: "customer", transition: "nothing" }),
    ]);
    const problems = validateFlow(strangers, { modules: MODULES, roles: ROLES });
    // customer does not have that one on it.
    expect(problems.some((p) => p.severity === "fatal")).toBe(true);
  });

  it("steps that can't get through the entrance = gap", () => {
    const problems = validateFlow(
      flow([step({ key: "a", transition: "submit" }), step({ key: "orphan", transition: "approve" })]),
      { modules: MODULES, roles: ROLES },
    );
    expect(problems.some((p) => p.code === "FLOW_STEP_UNREACHABLE")).toBe(true);
  });
});

// the power projection —

describe("flowCapabilityOf", () => {
  const shipFlow = defineFixtureFlow({
    code: "ship-flow",
    label: "Ship",
    domain: "demo",
    purpose: "Ship a finished order and post it",
    owner: "warehouse",
    triggerWords: ["Ship"],
    entry: "ship",
    steps: [
      {
        key: "ship",
        label: "Ship",
        kind: "action",
        module: "order",
        transition: "ship",
        where: null,
        actor: "warehouse",
        note: null,
        at: null,
        next: [{ to: "confirm", whenStatus: "draft", label: null }],
      },
      {
        key: "confirm",
        label: "Confirm issue",
        kind: "action",
        module: "delivery",
        transition: "confirm",
        where: null,
        actor: "warehouse",
        note: null,
        at: null,
        next: [{ to: "note", whenStatus: null, label: null }],
      },
      {
        key: "note",
        label: "Notify the customer",
        kind: "manual",
        module: null,
        transition: null,
        where: null,
        actor: null,
        note: "Call offline",
        at: null,
        next: [],
      },
    ],
  });

  const cap = flowCapabilityOf(shipFlow, MODULES);

  it("requires, pick up the side of the entrance from and speak adult to the block guard.", () => {
    expect(cap.requires.module).toBe("order");
    expect(cap.requires.status).toBe("awaitingShipment");
    expect(cap.requires.text).toContain('Order is in "awaitingShipment"');
  });

  it("step is not a step.", () => {
    expect(cap.actionSteps).toBe(2);
    expect(cap.edges).toEqual(["order.ship", "delivery.confirm"]);
  });

  it("it's not \"there's this.\"", () => {
    expect(cap.produces.postings).toEqual(["ap.in"]);
  });

  it("i'll take the target.", () => {
    expect(cap.produces.documents).toContain("delivery");
  });

  it("the last time the same module has been removed", () => {
    expect(cap.produces.terminal).toEqual({ order: "awaitingShipment", delivery: "shipped" });
  });

  it("there's no system access.", () => {
    const manualEntry = defineFixtureFlow({
      code: "manual-entry",
      label: "Start offline",
      domain: "demo",
      purpose: "A flow that starts with an offline action, used to check the entry projection",
      owner: null,
      triggerWords: [],
      entry: "kickoff",
      steps: [
        {
          key: "kickoff",
          label: "Hold a meeting",
          kind: "manual",
          module: null,
          transition: null,
          where: null,
          actor: null,
          note: null,
          at: null,
          next: [],
        },
      ],
    });
    const c = flowCapabilityOf(manualEntry, MODULES);
    expect(c.requires.module).toBeNull();
    expect(c.requires.text).toContain("No system entry");
  });
});

describe("flowDependenciesOf", () => {
  it("the last one leaves a list on the next one = dependency, and it's derived.", () => {
    const first = flowCapabilityOf(
      defineFixtureFlow({
        code: "intake",
        label: "Take the order",
        domain: "demo",
        purpose: "Push a draft to pending review",
        owner: "sales",
        triggerWords: [],
        entry: "submit",
        steps: [
          {
            key: "submit",
            label: "Submit for review",
            kind: "action",
            module: "order",
            transition: "submit",
            where: null,
            actor: "sales",
            note: null,
            at: null,
            next: [],
          },
        ],
      }),
      MODULES,
    );
    const second = flowCapabilityOf(
      defineFixtureFlow({
        code: "review",
        label: "Approve",
        domain: "demo",
        purpose: "Approve a pending document and move it into production",
        owner: "sales",
        triggerWords: [],
        entry: "approve",
        steps: [
          {
            key: "approve",
            label: "Approve",
            kind: "action",
            module: "order",
            transition: "approve",
            where: null,
            actor: "sales",
            note: null,
            at: null,
            next: [],
          },
        ],
      }),
      MODULES,
    );

    const deps = flowDependenciesOf([first, second]);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ from: "intake", to: "review", via: "status" });
  });

  it("you don't count a process as self-reliance.", () => {
    const self = flowCapabilityOf(
      defineFixtureFlow({
        code: "loop",
        label: "A flow that can be run again",
        domain: "demo",
        purpose: "A flow whose terminal status equals its entry status must not count as its own upstream",
        owner: null,
        triggerWords: [],
        entry: "ship",
        steps: [
          {
            key: "ship",
            label: "Ship",
            kind: "action",
            module: "order",
            transition: "ship",
            where: null,
            actor: null,
            note: null,
            at: null,
            next: [],
          },
        ],
      }),
      MODULES,
    );
    expect(flowDependenciesOf([self])).toHaveLength(0);
  });
});
