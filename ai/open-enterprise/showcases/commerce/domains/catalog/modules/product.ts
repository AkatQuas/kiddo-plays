import { defineModule, singleState } from "@open-erp/metamodel";

export default defineModule({
  label: "Product",
  numbering: { prefix: "SKU", seqScope: "tenant" },
  fields: [
    { key: "code", label: "Product code", type: "string", primary: true, auto: true },
    { key: "name", label: "Product name", type: "string", required: true },
  ],
  lifecycle: singleState(),
  views: {
    list: { columns: ["code", "name"], referenceLabel: ["name"], searchable: ["code", "name"] },
    form: [{ title: "Basic information", fields: ["code", "name"] }],
  },
});
