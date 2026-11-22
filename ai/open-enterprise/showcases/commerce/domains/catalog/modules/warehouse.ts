import { defineModule, singleState } from "@open-erp/metamodel";

export default defineModule({
  label: "Warehouse",
  numbering: { prefix: "WH", seqScope: "tenant" },
  fields: [
    { key: "code", label: "Warehouse code", type: "string", primary: true, auto: true },
    { key: "name", label: "Warehouse name", type: "string", required: true, unique: true },
  ],
  lifecycle: singleState(),
  views: {
    list: { columns: ["code", "name"], referenceLabel: ["name"], searchable: ["code", "name"] },
    form: [{ title: "Basic information", fields: ["code", "name"] }],
  },
});
