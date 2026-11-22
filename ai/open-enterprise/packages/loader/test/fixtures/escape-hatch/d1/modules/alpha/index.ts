import { defineModule } from "@open-erp/metamodel";

// directory shape = escape hatch. The code is the **directory name**, not the file name (the file name is always index).
export default defineModule({
  label: "fixture",
  fields: [{ key: "code", label: "code", type: "string", primary: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
