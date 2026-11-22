// ---------------------------------------------------------------------------
// quickshot source non-empty assurance
//
// it's back to a path that can't be reversed:
// Sales orders left blank for "Specific Model" and could not be shipped after review** (400) `SNAPSHOT_SOURCE_EMPTY`），
// and the document has left the draft, and it's stuck in "awaiting Shipment" — all three remedial routes have been tried at the scene.
// the only way out is to return the draft again.
//
// it's not that field, it's a corollary: codegen assumes that "snapshot ⇒ must be worth the NOT NULL column" and that it's not the same.
// this article** is only valid when the source must be filled in. When the source was selected, it was listed as lying on behalf of the statement.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  missingOptionalSnapshotValues,
  normalizeFixtureModule,
  snapshotSourceGuarantee,
  type ModuleSchema,
} from "../src/index.js";

/*:: Creates a minimum legitimate module: single-state lifecycle + a main field + field called by the caller */
function mod(code: string, fields: readonly unknown[]): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "d",
    fields: [{ key: "code", label: "Number", type: "string", required: true, primary: true }, ...fields],
    lifecycle: { statuses: [{ key: "Take effect", label: "Take effect", editable: "full" }], transitions: [] },
    views: { list: { columns: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
  });
}

const resolverOf = (...modules: readonly ModuleSchema[]) => {
  const map = new Map(modules.map((m) => [m.code, m]));
  return (code: string): ModuleSchema | undefined => map.get(code);
};

describe("snapshotSourceGuarantee — source non-empty assurance", () => {
  it("source", () => {
    const product = mod("product", [{ key: "mainUnit", label: "Main unit", type: "string", required: true }]);
    expect(
      snapshotSourceGuarantee(resolverOf(product), { from: "product", through: null, field: "mainUnit" }),
    ).toMatchObject({ guaranteed: true, via: "required" });
  });

  // 🔴 This article was ** previously judged to be a loophole**: only required / auto and therefore receivable
  // `amount ← salesDelivery.totalAmount`(lineAgg) was sentenced to "source insecurity" -
  // lineAgg is of the same nature as auto (systemic writing, columns, empty details and values). The net effect of missing it is
  // a list of amounts that would have been ** of NOT NULL's accounts** was subsequently degraded to empty.
  it("🔴 Source: LineAgg ⇒ is guaranteed - empty detail and value (sum is 0), same as auto", () => {
    const delivery = mod("salesDelivery", [
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "salesDeliveryLine",
        fields: [{ key: "amount", label: "Amount", type: "money" }],
      },
      { key: "totalAmount", label: "Total", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(delivery), { from: "salesDelivery", through: null, field: "totalAmount" }),
    ).toMatchObject({ guaranteed: true, via: "lineAgg" });
  });

  it("the source is the auto pick-up.", () => {
    const order = mod("salesOrder", [{ key: "serial", label: "Journal", type: "string", auto: true }]);
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: null, field: "serial" }),
    ).toMatchObject({ guaranteed: true, via: "auto" });
  });

  it("the source is Calculate.", () => {
    const order = mod("salesOrder", [
      { key: "qty", label: "Quantity", type: "number", required: true },
      { key: "factor", label: "Factor", type: "number", required: true },
      {
        key: "baseQty",
        label: "Main-unit quantity",
        type: "number",
        calculate: { op: "mul", args: [{ field: "qty" }, { field: "factor" }] },
      },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: null, field: "baseQty" }),
    ).toMatchObject({ guaranteed: true, via: "calculate" });
  });

  it("the source is a tablehead platform bar with assurance (framework supply, column NOT NULL)", () => {
    const report = mod("processReport", []);
    expect(
      snapshotSourceGuarantee(resolverOf(report), { from: "processReport", through: null, field: "updatedAt" }),
    ).toMatchObject({ guaranteed: true, via: "platform" });
  });

  it("🔴 TenantId/ id does not count platform sources - the same conditions as which checkCrossReferences recognizes platform sources", () => {
    const report = mod("processReport", []);
    for (const field of ["tenantId", "id"]) {
      expect(
        snapshotSourceGuarantee(resolverOf(report), { from: "processReport", through: null, field }),
        `${field} must not be treated as a guaranteed platform source`,
      ).toMatchObject({ guaranteed: false, gap: "missing" });
    }
    // there's no such column on the table.
    const withLines = mod("processReport", [
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "processReportLine",
        fields: [{ key: "qty", label: "Quantity", type: "number" }],
      },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(withLines), { from: "processReport", through: "lines", field: "updatedAt" }),
    ).toMatchObject({ guaranteed: false, gap: "missing" });
  });

  it("quick-ray re-entry: Snapshot, end of chain, assured whole.", () => {
    const product = mod("product", [{ key: "mainUnit", label: "Main unit", type: "string", required: true }]);
    const order = mod("salesOrder", [
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "unit",
        label: "Unit",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "mainUnit" },
      },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(product, order), { from: "salesOrder", through: null, field: "unit" }),
    ).toMatchObject({ guaranteed: true, via: "chain" });
  });

  // 🔴 Show me the one that died on the spot. This is not a "declaration is wrong" — "the specification is not filled in" is a business fact.
  // the owner of the product file was worthless until it was finished. The verdict must be that there is no guarantee.
  // this is how the table side makes the column empty and the path is written accordingly.
  it("🔴 Source selected fill ⇒ no assurance (legal status, not error)", () => {
    const order = mod("salesOrder", [
      { key: "spec", label: "Specification", type: "string" }, // pick-up: Mainly unconnected, temporarily filled by hand
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: null, field: "spec" }),
    ).toMatchObject({ guaranteed: false, gap: "optional" });
  });

  it("any kind of jump on the chain and no guarantee.", () => {
    const product = mod("product", [{ key: "spec", label: "Specification", type: "string" }]); // select Fill
    const order = mod("salesOrder", [
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      {
        key: "spec",
        label: "Specification",
        type: "string",
        snapshot: { from: "product", match: "productId", through: null, field: "spec" },
      },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(product, order), { from: "salesOrder", through: null, field: "spec" }),
    ).toMatchObject({ guaranteed: false, gap: "optional" });
  });

  it("snapshot.optional thallium on the chain, even if the end of the chain has to be filled, the current source has no non-empty assurance", () => {
    const product = mod("product", [{ key: "ownerId", label: "Owner", type: "ref", ref: "owner", required: true }]);
    const demand = mod("demand", [
      { key: "productId", label: "Product", type: "ref", ref: "product" },
      {
        key: "ownerId",
        label: "Owner",
        type: "ref",
        ref: "owner",
        snapshot: { from: "product", match: "productId", through: null, field: "ownerId", optional: true },
      },
    ]);
    expect(
      snapshotSourceGuarantee(resolverOf(product, demand), { from: "demand", through: null, field: "ownerId" }),
    ).toMatchObject({ guaranteed: false, gap: "optional" });
  });

  it("source coordinates do not exist.", () => {
    const order = mod("salesOrder", []);
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: null, field: "nope" }),
    ).toMatchObject({ guaranteed: false, gap: "missing" });
    // the module itself does not exist
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "ghost", through: null, field: "x" }),
    ).toMatchObject({ guaranteed: false, gap: "missing" });
  });

  // the ring is ** declared sick** and is not one of the "sources selected" categories: The former is to blame (loader report).
  // the latter is a legal state. After a synthesis, a ←b←a's dead chain will be used as a "source selection".
  // quietly downgrades into empty columns, with a run-time showing that a cell is always empty and that there is nothing to mention.
  it("🔴 Quick-separated chain ring, twilight, no guarantee, and bring the ring path (segregated with option)", () => {
    const a = mod("a", [
      { key: "ref", label: "points at b", type: "ref", ref: "b", required: true },
      { key: "x", label: "x", type: "string", snapshot: { from: "b", match: "ref", through: null, field: "y" } },
    ]);
    const b = mod("b", [
      { key: "ref", label: "points at a", type: "ref", ref: "a", required: true },
      { key: "y", label: "y", type: "string", snapshot: { from: "a", match: "ref", through: null, field: "x" } },
    ]);
    const result = snapshotSourceGuarantee(resolverOf(a, b), { from: "a", through: null, field: "x" });
    expect(result).toMatchObject({ guaranteed: false, gap: "cycle" });
    expect(result.cycle).toEqual(["a.$bill.x", "b.$bill.y", "a.$bill.x"]);
  });

  it("i mean, though, it pointed to the row from the table, not the head.", () => {
    const order = mod("salesOrder", [
      { key: "spec", label: "Header spec", type: "string", required: true }, // there are fields with the same name on the table.
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "salesOrderLine",
        fields: [{ key: "spec", label: "Specification", type: "string" }], // line Selection
      },
    ]);
    // 🔴 The wrong layer doesn't go wrong, it's just another layer of the same name.
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: "lines", field: "spec" }),
    ).toMatchObject({ guaranteed: false, gap: "optional" });
    expect(
      snapshotSourceGuarantee(resolverOf(order), { from: "salesOrder", through: null, field: "spec" }),
    ).toMatchObject({ guaranteed: true, via: "required" });
  });
});

describe("missionalSnapshotValues - empty references Value", () => {
  const fields = mod("warehouseDemandLike", [
    { key: "sourceId", label: "Source document", type: "ref", ref: "source" },
    {
      key: "sourceQty",
      label: "Source quantity",
      type: "number",
      snapshot: {
        from: "source",
        match: "sourceId",
        through: null,
        field: "qty",
        optional: true,
      },
    },
  ]).fields;

  it("whole: match clearly written nuld in absence or empty; non-empty match left to quote Query Freeze", () => {
    expect(missingOptionalSnapshotValues(fields, {}, "whole")).toEqual({ sourceQty: null });
    expect(missingOptionalSnapshotValues(fields, { sourceId: null }, "whole")).toEqual({ sourceQty: null });
    expect(missingOptionalSnapshotValues(fields, { sourceId: "source-1" }, "whole")).toEqual({});
  });

  it("patch: omit the match without touching the current snapshot; visible clean-up of the match", () => {
    expect(missingOptionalSnapshotValues(fields, {}, "patch")).toEqual({});
    expect(missingOptionalSnapshotValues(fields, { sourceId: "" }, "patch")).toEqual({ sourceQty: null });
  });
});
