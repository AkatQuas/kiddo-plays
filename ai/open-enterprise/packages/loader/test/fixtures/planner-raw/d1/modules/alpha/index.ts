import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "source document",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "released", label: "released", terminal: true },
    ],
    transitions: [{ code: "release", from: "draft", to: "released", action: "release" }],
  },
  views: { list: { columns: ["code"] } },
});

export const planners = {
  release: async () => ({ version: 1, commands: [] }),
};
