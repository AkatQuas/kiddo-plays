import { defineModule } from "@open-erp/metamodel";

export default defineModule({
  label: "fixture B",
  numbering: { prefix: "SP", seqScope: "tenant" },
  fields: [{ key: "code", label: "code", type: "string", primary: true, auto: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
