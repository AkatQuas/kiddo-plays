import { defineModule, singleState } from "@open-erp/metamodel";

export default defineModule({
  label: "Supplier",
  numbering: { prefix: "SUP", seqScope: "tenant" },
  fields: [
    { key: "code", label: "Supplier code", type: "string", primary: true, auto: true },
    { key: "name", label: "Supplier name", type: "string", required: true, unique: true },
  ],
  lifecycle: singleState(),
  views: {
    list: { columns: ["code", "name"], referenceLabel: ["name"], searchable: ["name"] },
    form: [{ title: "Basic information", fields: ["code", "name"] }],
  },
});
