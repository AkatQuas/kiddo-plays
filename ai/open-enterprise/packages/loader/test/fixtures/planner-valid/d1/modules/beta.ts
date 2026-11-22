import { defineModule, singleState } from "@open-erp/metamodel";

export default defineModule({
  label: "target document",
  fields: [{ key: "name", label: "name", type: "string", primary: true }],
  lifecycle: singleState(),
  views: { list: { columns: ["name"] } },
});
