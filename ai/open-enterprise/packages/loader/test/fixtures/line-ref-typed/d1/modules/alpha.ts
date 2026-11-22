import { defineModule } from "@open-erp/metamodel";

// a natural typo: meaning to point at an order line, the ref is written as <module>Line the way a subtable is.
// a gate that exempts by name suffix lets it through, while relationsOf collects by type and throws on existence —
// the symptom is a 500 on **some other** module's detail page.
export default defineModule({
  label: "fixture",
  fields: [
    { key: "code", label: "code", type: "string", primary: true },
    { key: "sourceLineId", label: "source line", type: "ref", ref: "betaLine" },
  ],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
