import { defineModule, definePlanners } from "@open-erp/metamodel";

export default defineModule({
  label: "source document",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", initial: true },
      { key: "done", terminal: true },
    ],
    transitions: [{ code: "release", from: "draft", to: "done", action: "release" }],
  },
  views: { list: { columns: ["code"] } },
});

export const planners = definePlanners({
  release: () => ({ version: 1, commands: [] }),
}, { release: ["missing"] });
