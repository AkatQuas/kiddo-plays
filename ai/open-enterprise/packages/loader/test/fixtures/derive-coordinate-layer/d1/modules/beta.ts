import { defineModule } from "@open-erp/metamodel";

// rollup target (the downstream document): `qty` **lives only on the line table**; the header has no such column.
// it exists so that a wrong-layer `where` has a real target.
export default defineModule({
  label: "fixture downstream",
  fields: [
    { key: "code", label: "code", type: "string", primary: true },
    { key: "alphaId", label: "source document", type: "ref", ref: "alpha" },
    { key: "totalQty", label: "total quantity", type: "number" },
    // the header **has this key, but no column**: a derive is computed at query time, so SQL has nothing of it to compare
    {
      key: "doubleQty",
      label: "double quantity",
      type: "number",
      derive: { kind: "formula", expr: { op: "mul", args: [{ field: "totalQty" }, { value: 2 }] } },
    },
    {
      key: "lines",
      label: "lines",
      type: "subtable",
      ref: "betaLine",
      fields: [
        { key: "alphaId", label: "source document", type: "ref", ref: "alpha" },
        { key: "qty", label: "quantity", type: "number" },
      ],
    },
    {
      key: "sourceLines",
      label: "source line",
      type: "subtable",
      ref: "betaSourceLine",
      maxRows: 1,
      fields: [
        { key: "alphaId", label: "source document", type: "ref", ref: "alpha" },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true, editable: "full" },
      { key: "done", label: "completed", terminal: true, editable: "none" },
    ],
    transitions: [{ code: "finish", from: "draft", to: "done", action: "finish" }],
  },
  views: { list: { columns: ["code"] } },
});
