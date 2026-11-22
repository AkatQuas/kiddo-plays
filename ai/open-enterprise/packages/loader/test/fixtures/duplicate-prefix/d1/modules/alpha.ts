import { defineModule } from "@open-erp/metamodel";

// the code differs from d2/beta, but both claim prefix SP — the prefix is one dimension of the counter, and sharing it shares the sequence
export default defineModule({
  label: "fixture A",
  numbering: { prefix: "SP", seqScope: "tenant" },
  fields: [{ key: "code", label: "code", type: "string", primary: true, auto: true }],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
