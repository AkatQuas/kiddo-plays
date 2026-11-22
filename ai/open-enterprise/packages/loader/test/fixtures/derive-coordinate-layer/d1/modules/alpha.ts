import { defineModule } from "@open-erp/metamodel";

// four rollups, two pairs: a `where` written on the header / written on the line-table layer by mistake.
//
// 🔴 a wrong layer used to have **zero symptoms** under `yarn test`: no layer was checked for a `derive.where` key,
// it fails only at runtime SQL compile (`rollupExpr` saying the rollup filter referenced a field that does not exist),
// and the symptom then is that some module's list page will not open at all — nowhere near the line that was written wrong.
export default defineModule({
  label: "fixture upstream",
  fields: [
    { key: "code", label: "code", type: "string", primary: true },
    // ✅ header rollup + header filter (`status` is a platform field; every header has the column)
    {
      key: "doneTotal",
      label: "completed total",
      type: "number",
      derive: { kind: "rollup", from: "beta", match: "alphaId", measure: "sum(totalQty)", where: { status: "done" } },
    },
    // ✅ row rollup + header filter — the compiler innerJoins back to the header before judging status
    {
      key: "doneLineQty",
      label: "completed line quantity",
      type: "number",
      derive: {
        kind: "rollup",
        from: "beta",
        through: "lines",
        match: "alphaId",
        measure: "sum(qty)",
        where: { status: "done" },
      },
    },
    // ✅ row rollup + header measure: the line table is maxRows: 1, so one document's header quantity is not added once per line
    {
      key: "headerOccupied",
      label: "header occupancy",
      type: "number",
      derive: {
        kind: "rollup",
        from: "beta",
        through: "sourceLines",
        match: "alphaId",
        measure: "sum(totalQty)",
        where: { status: "done" },
      },
    },
    // ✗ wrong layer: `qty` lives only on beta's line table; the header has no such column
    {
      key: "badLineWhere",
      label: "wrong-layer row rollup",
      type: "number",
      derive: {
        kind: "rollup",
        from: "beta",
        through: "lines",
        match: "alphaId",
        measure: "sum(qty)",
        where: { qty: 1 },
      },
    },
    // ✗ the same criterion when through is empty, **word for word**: the filter always checks the header, and the gate does not branch
    {
      key: "badHeaderWhere",
      label: "wrong-layer header rollup",
      type: "number",
      derive: { kind: "rollup", from: "beta", match: "alphaId", measure: "sum(totalQty)", where: { qty: 1 } },
    },
    // ✗ the key **is** on the header, but it is a derive — a derive builds no column, so SQL has nothing of it to compare
    {
      key: "badDeriveWhere",
      label: "derived field used as a filter key",
      type: "number",
      derive: { kind: "rollup", from: "beta", match: "alphaId", measure: "sum(totalQty)", where: { doubleQty: 2 } },
    },
    // ✗ mistyped measure: `qty` has no column on beta's header (it is on the line table).
    //   `measure` follows through by default; this one is the opposite of where
    {
      key: "badMeasure",
      label: "measure on the wrong layer",
      type: "number",
      derive: { kind: "rollup", from: "beta", match: "alphaId", measure: "sum(qty)" },
    },
    // ✗ header measure but the line table has no maxRows: 1 — several lines of one document add the same header quantity more than once
    {
      key: "headerOccupiedUnbounded",
      label: "header measure with an unbounded line table",
      type: "number",
      derive: {
        kind: "rollup",
        from: "beta",
        through: "lines",
        match: "alphaId",
        measure: "sum(totalQty)",
        where: { status: "done" },
      },
    },
    // ✗ lookup match is the foreign-key column on **this module's own layer**, not a field on the target module.
    //   this module's header has no betaId, so this lookup blows up only at SQL compile time
    {
      key: "badLookupMatch",
      label: "bring back the target code",
      type: "string",
      derive: { kind: "lookup", from: "beta", match: "betaId", field: "code" },
    },
  ],
  lifecycle: {
    statuses: [{ key: "active", label: "active", initial: true, terminal: true, editable: "full" }],
    transitions: [],
  },
  views: { list: { columns: ["code"] } },
});
