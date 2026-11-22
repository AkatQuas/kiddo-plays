import { defineModule, singleState } from "@open-erp/metamodel";

export default defineModule({
  label: "Customer",
  numbering: { prefix: "CUS", seqScope: "tenant" },
  fields: [
    { key: "code", label: "Customer code", type: "string", primary: true, auto: true },
    { key: "name", label: "Customer name", type: "string", required: true },
  ],
  lifecycle: singleState(),
  views: {
    list: { columns: ["code", "name"], referenceLabel: ["name"], searchable: ["name"] },
    form: [{ title: "Basic information", fields: ["code", "name"] }],
  },
});
