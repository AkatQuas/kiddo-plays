import { defineActionPreparers, defineModule, definePlanners, type ExecutionPlan } from "@open-erp/metamodel";

export default defineModule({
  label: "source document",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "released", label: "released", terminal: true },
    ],
    transitions: [
      {
        code: "release",
        from: "draft",
        to: "released",
        action: "release",
        params: [{ key: "mode", label: "mode", type: "text" }],
      },
      // One edge in the same directory-shaped module that has **no Planner**. `expandsBills` is filled per edge, not per module,
      // without this contrast, a regression that marks the whole directory-shaped module as batch-creating documents would not turn any test red
      { code: "cancel", from: "draft", to: "released", action: "cancel" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

export const actionPreparers = defineActionPreparers({
  release: (context) => ({ mode: `prepared:${String(context.bill.header["status"])}` }),
});

export const planners = definePlanners({
  release: async (context): Promise<ExecutionPlan> => {
    if (context.params["mode"] === "bad-command") {
      return { version: 1, commands: [{ type: "sql", commandId: "bad" }] } as unknown as ExecutionPlan;
    }
    if (context.params["mode"] === "unknown-module") {
      return {
        version: 1,
        commands: [{ type: "createBill", commandId: "missing", module: "missing", header: {}, lines: {} }],
      };
    }
    if (context.params["mode"] === "unknown-status-target") {
      return {
        version: 1,
        commands: [
          {
            type: "setStatus",
            commandId: "push-missing",
            target: { kind: "existing", module: "missing", id: "x-1" },
            transition: "release",
            expectedStatus: "draft",
          },
        ],
      };
    }
    return {
      version: 1,
      commands: [
        { type: "createBill", commandId: "task", module: "beta", header: { name: "task" }, lines: {} },
        {
          type: "createBill",
          commandId: "step",
          module: "beta",
          header: { parentId: { kind: "createdId", commandId: "task" } },
          lines: {},
        },
        {
          type: "createReference",
          commandId: "source-link",
          source: { kind: "existing", module: "alpha", id: context.bill.id },
          target: { kind: "createdId", commandId: "task" },
        },
      ],
    };
  },
}, { release: ["beta"] }, { release: "latest" });
