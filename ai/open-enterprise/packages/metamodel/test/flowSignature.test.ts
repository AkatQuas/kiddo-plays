import { describe, expect, it } from "vitest";
import {
  chainAlignmentOf,
  defineFixtureFlow,
  defineFixtureModule,
  flowSignatureOf,
  type ModuleSchema,
} from "../src/index.js";

// plugin: copy the net's real pit —
//
// the order is "completed" and the gate requires it to perform all the tasks below it.** Completed; the tasks range from "inproject" to "inproject."
// there is an important gap in the "completed" side. Nobody wrote that side in the process -- it was on the scene.
// there's only one word that's not in the library, and no one knows it's missing an entire section.

function taskModule(confirmIsInternal = false): ModuleSchema {
  return defineFixtureModule({
  code: "task",
  label: "Task",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "orderId", label: "Order", type: "ref", ref: "order", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "awaitingLaunch", label: "awaitingLaunch", initial: true },
      { key: "inProduction", label: "inProduction" },
      { key: "awaitingInbound", label: "awaitingInbound" },
      { key: "completed", label: "completed", terminal: true },
    ],
    transitions: [
      { code: "launch", from: "awaitingLaunch", to: "inProduction", action: "Launch all" },
      // system side: Automatically synchronized report completion, no one can click.
      { code: "syncReport", from: "inProduction", to: "awaitingInbound", action: "Sync report complete", internal: true },
      // 🔴 This one's important, and there's no process to cover it -- it's broken here.
      { code: "confirm", from: "awaitingInbound", to: "completed", action: "Confirm completion",
        ...(confirmIsInternal ? { internal: true as const } : {}) },
    ],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "orderId"] }] },
  });
}
const task = taskModule();

function orderWith(check: Record<string, unknown>): ModuleSchema {
  return defineFixtureModule({
  code: "order",
  label: "Order",
  domain: "demo",
  fields: [{ key: "code", label: "Document number", type: "string", required: true, primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "inProduction", label: "inProduction" },
      { key: "finished", label: "finished", terminal: true },
    ],
    transitions: [
      { code: "start", from: "draft", to: "inProduction", action: "Start" },
      { code: "complete", from: "inProduction", to: "finished", action: "Finish" },
    ],
  },
  preconditions: [
    {
      id: "all_tasks_done",
      onTransition: "complete",
      source: "gate",
      level: "block",
      message: "Tasks are still unfinished",
      why: "The order waits until every task below it is finished",
      check,
    },
  ],
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code"] }] },
  });
}
const order = orderWith({
  primitive: "related_agg",
  from: "task", through: "lines", match: "orderId", on: "id",
  agg: "count", measure: null,
  where: { status: ["awaitingLaunch", "inProduction", "awaitingInbound"] },
  op: "eq", right: { value: 0 }, plus: null,
});

const modules: ReadonlyMap<string, ModuleSchema> = new Map([
  ["order", order],
  ["task", task],
]);

const step = (key: string, module: string, transition: string, next: readonly string[] = []) => ({
  key, label: key, kind: "action" as const, module, transition,
  where: null, actor: null, note: null, at: { x: 0, y: 0 },
  next: next.map((to) => ({ to, whenStatus: null, label: null })),
});

const launch = defineFixtureFlow({
  code: "launch", label: "From start to launch", domain: "demo", purpose: "After the order starts, launch every task under it",
  owner: null, roles: [], triggerWords: [], entry: "start",
  steps: [step("start", "order", "start", ["go"]), step("go", "task", "launch")],
});

const finish = defineFixtureFlow({
  code: "finish", label: "Finish", domain: "demo", purpose: "After every task is finished, mark the order finished",
  owner: null, roles: [], triggerWords: [], entry: "done",
  steps: [step("done", "order", "complete")],
});

describe("process input / participation", () => {
  it("the entry is the status of the list from the start.", () => {
    const sig = flowSignatureOf(launch, modules);
    expect(sig.entry).toEqual({ module: "order", moduleLabel: "Order", status: "draft" });
  });

  it("the participation is where the modules are running -- the next one is aligned.", () => {
    expect(flowSignatureOf(launch, modules).leaves).toEqual({ order: "inProduction", task: "inProduction" });
  });

  it("cross-module front read from related agg gate, inversely split", () => {
    const sig = flowSignatureOf(finish, modules);
    expect(sig.needs).toEqual([{
      module: "task", moduleLabel: "Task",
      statuses: ["awaitingLaunch", "inProduction", "awaitingInbound"],
      wanted: false,
      step: "done",
      why: "The order waits until every task below it is finished",
    }]);
  });

  it("🔴 You can't read the whole thing, you can't guess the direction -- it's worse than not reporting.", () => {
    // "At most of the 5" is not "to be sent upstream" or "not to stay upstream":
    // if you can't tell us where you're going, throw it all away.
    const odd = orderWith({
      primitive: "related_agg",
      from: "task", through: "lines", match: "orderId", on: "id",
      agg: "count", measure: null, where: { status: "inProduction" },
      op: "lte", right: { value: 5 }, plus: null,
    });
    expect(flowSignatureOf(finish, new Map([["order", odd], ["task", task]])).needs).toEqual([]);
  });
});

describe("linking", () => {
  it("the previous paragraph left it in a prohibited state = broken chain, and it says which one.", () => {
    const issues = chainAlignmentOf(
      [flowSignatureOf(launch, modules), flowSignatureOf(finish, modules)],
      modules,
    );
    const broken = issues.filter((one) => one.level === "broken");
    expect(broken).toHaveLength(1);
    expect(broken[0]?.at).toBe(1);
    expect(broken[0]?.text).toContain("Task");
    expect(broken[0]?.text).toContain("inProduction");
  });

  it("it's the only time you don't say \"never touched it\" -- the first part should have been built.", () => {
    expect(chainAlignmentOf([flowSignatureOf(launch, modules)], modules)).toEqual([]);
  });

  it("🔴 It's all over the system, and it's \"not clear\" and it's not red.", () => {
    const auto = taskModule(true);
    const wanted = orderWith({
      primitive: "related_agg",
      from: "task", through: "lines", match: "orderId", on: "id",
      agg: "count", measure: null, where: { status: "completed" },
      op: "gte", right: { value: 1 }, plus: null,
    });
    const world: ReadonlyMap<string, ModuleSchema> = new Map([["order", wanted], ["task", auto]]);
    const issues = chainAlignmentOf(
      [flowSignatureOf(launch, world), flowSignatureOf(finish, world)],
      world,
    );
    expect(issues.filter((one) => one.level === "broken")).toEqual([]);
    expect(issues.some((one) => one.text.includes("automatically"))).toBe(true);
  });
});
