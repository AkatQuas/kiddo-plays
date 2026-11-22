import { defineActionPreparers, defineModule } from "@open-erp/metamodel";
export default defineModule({
  label: "source document",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", initial: true }, { key: "done", label: "done", terminal: true }],
    transitions: [{ code: "finish", from: "draft", to: "done", action: "finish", params: [{ key: "note", label: "note", type: "text" }] }],
  },
  views: { list: { columns: ["code"] } },
});
export const actionPreparers = defineActionPreparers({ missing: () => ({ note: "default" }) });
