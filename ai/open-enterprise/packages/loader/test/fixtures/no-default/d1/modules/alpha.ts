import { defineModule } from "@open-erp/metamodel";

defineModule({
  label: "fixture",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
