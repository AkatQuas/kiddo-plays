// ---------------------------------------------------------------------------
// quote Candidate Filter - Declare Shapes and Values
//
// the full value of this capability lies in the fact that the candidate side shares the same test as the writing side**. So this test nail isn't.
// "Whether filters can be used" is the form that ** violates not to blame**: prefix wrongly, filter yourself,
// For the watch. `$line.`, quietly return unfiltered when the value is not available. Every symptom looks normal.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { SchemaError, bindRefFilterViaEntities, normalizeField, refFilterOperands, resolveRefFilter } from "../src/index.js";

const ref = (extra: Record<string, unknown> = {}): unknown => ({
  key: "productionOrgId",
  label: "Production plant",
  type: "ref",
  ref: "orgUnit",
  ...extra,
});

describe("declaring shapes: violation of patterns that do not miss, rejection of article by article during modelling period", () => {
  it("static cursor / array / dynamic operator count of three values received", () => {
    const field = normalizeField(
      ref({ refFilter: { orgType: "factory", level: [1, 2], parentOrgId: { from: "$bill.orgId" } } }),
    );
    expect(field.refFilter).toEqual({
      orgType: "factory",
      level: [1, 2],
      parentOrgId: { from: "$bill.orgId" },
    });
  });

  it("🔴 Meaning only in ref: Hanging on to another type is a death statement — the modeler is limited in scope and practically nothing.", () => {
    expect(() => normalizeField({ key: "note", label: "Remark", type: "string", refFilter: { a: 1 } })).toThrow(
      SchemaError,
    );
  });

  it("🔴 {\\cHFFFFFF}{\\cH00FFFF} RefLine today n=0: Line candidate has been narrowed down by the \"select which one first\" list. Axis", () => {
    expect(() =>
      normalizeField(
        { key: "orderLineId", label: "Source line", type: "refLine", ref: "salesOrder", through: "lines", refFilter: { a: 1 } },
        "field",
        false,
      ),
    ).toThrow(/refLine/);
  });

  it("🔴 Empty object rejected: None of the conditions equals no filter, and it looks like it's been declared.", () => {
    expect(() => normalizeField(ref({ refFilter: {} }))).toThrow(/empty object/);
  });

  it("🔴 No, no, no, no.", () => {
    expect(() => normalizeField(ref({ refFilter: { orgType: [] } }))).toThrow(/empty array/);
  });

  it("🔴 Prefix closed: $actor / $param not accepted - visible range is centralized by data scope and the recording period is not moving", () => {
    expect(() => normalizeField(ref({ refFilter: { a: { from: "$actor.tenantId" } } }))).toThrow(/unknown prefix/);
    expect(() => normalizeField(ref({ refFilter: { a: { from: "$param.x" } } }))).toThrow(/unknown prefix/);
  });

  it("🔴 Can't use $line. : When you're asking for a value, the release will present a statement error as \"please fill in something.\"", () => {
    expect(() => normalizeField(ref({ refFilter: { a: { from: "$line.productId" } } }))).toThrow(/on the header/);
  });

  it("line. Legitimate -- the current line is on that level", () => {
    const field = normalizeField(
      { key: "bomId", label: "BOM", type: "ref", ref: "bom", refFilter: { productId: { from: "$line.productId" } } },
      "field",
      false,
    );
    expect(field.refFilter).toEqual({ productId: { from: "$line.productId" } });
  });

  it("🔴 Self-included: filter yourself with this grid, candidate for the sky or self-sustained -- neither is anyone's word.", () => {
    expect(() =>
      normalizeField(ref({ refFilter: { parentOrgId: { from: "$bill.productionOrgId" } } })),
    ).toThrow(/this field itself/);
  });

  it("there are no field names in dynamic operations from", () => {
    expect(() => normalizeField(ref({ refFilter: { a: { from: "$bill." } } }))).toThrow();
  });

  it("dynamic mapping yielding normative shapes, empty mapping and empty target set rejected", () => {
    const field = normalizeField(
      ref({ refFilter: { orgType: { from: "$bill.orgType", map: { factory: null, workshop: "factory", line: ["workshop"] } } } }),
    );
    expect(field.refFilter).toEqual({
      orgType: { from: "$bill.orgType", map: { factory: null, workshop: "factory", line: ["workshop"] } },
    });
    expect(() => normalizeField(ref({ refFilter: { orgType: { from: "$bill.orgType", map: {} } } }))).toThrow(/empty object/);
    expect(() =>
      normalizeField(ref({ refFilter: { orgType: { from: "$bill.orgType", map: { line: [] } } } })),
    ).toThrow(/empty array/);
  });

  it("object value recognized only from / Map / through / Field: The extra key is silently ignored and the author thinks it works", () => {
    expect(() => normalizeField(ref({ refFilter: { a: { from: "$bill.x", op: "ne" } } }))).toThrow(/unknown key/);
  });

  it("the line ends through a match with Field.", () => {
    expect(() =>
      normalizeField(ref({ refFilter: { id: { from: "$bill.planId", through: "lines" } } })),
    ).toThrow(/a pair/);
    expect(() =>
      normalizeField(ref({ refFilter: { id: { from: "$bill.planId", field: "productId" } } })),
    ).toThrow(/a pair/);
  });

  it("the line can't be used with Map", () => {
    expect(() =>
      normalizeField(
        ref({
          refFilter: {
            id: { from: "$bill.planId", through: "lines", field: "productId", map: { a: "b" } },
          },
        }),
      ),
    ).toThrow(/map/);
  });

  it("keep through / field", () => {
    const field = normalizeField(
      {
        key: "productId",
        label: "Product",
        type: "ref",
        ref: "product",
        refFilter: {
          canPurchase: true,
          id: { from: "$line.planId", through: "lines", field: "productId" },
        },
      },
      "field",
      false,
    );
    expect(field.refFilter).toEqual({
      canPurchase: true,
      id: { from: "$line.planId", through: "lines", field: "productId" },
    });
  });
});

describe("excerpt: Candidate side with written side share", () => {
  const filter = {
    orgType: "factory",
    level: [1, 2],
    orderId: { from: "$bill.productionOrderId" },
    productId: { from: "$line.productId" },
  } as const;

  it("static condition as it is, the single value is also created as an array of elements - the compile side handles only one shape", () => {
    const out = resolveRefFilter({ orgType: "factory", level: [1, 2] }, {}, null);
    expect(out.conditions).toEqual([
      { field: "orgType", values: ["factory"] },
      { field: "level", values: [1, 2] },
    ]);
    expect(out.pending).toEqual([]);
  });

  it("the number of dynamic operations is a condition of equivalence", () => {
    const out = resolveRefFilter(filter, { productionOrderId: "o-1" }, { productId: "p-1" });
    expect(out.pending).toEqual([]);
    expect(out.conditions).toContainEqual({ field: "orderId", values: ["o-1"] });
    expect(out.conditions).toContainEqual({ field: "productId", values: ["p-1"] });
  });

  it("dynamic Map First Source Values, and then re-entry with static conditions", () => {
    const mapped = {
      orgType: { from: "$bill.orgType", map: { factory: null, workshop: "factory", line: "workshop", team: "line" } },
    } as const;
    expect(resolveRefFilter(mapped, { orgType: "line" }, null)).toEqual({
      conditions: [{ field: "orgType", values: ["workshop"] }],
      pending: [],
    });
    expect(resolveRefFilter(mapped, { orgType: "factory" }, null)).toEqual({
      conditions: [{ field: "orgType", values: [null] }],
      pending: [],
    });
    expect(() => resolveRefFilter(mapped, { orgType: "Division" }, null)).toThrow(/no mapping/);
  });

  it("🔴 I can't get it.", () => {
    // the return does not filter is fail-open and only happens when it happens to be empty:
    // the task of production of this order will be relaxed in silence into any production task, without symptoms and almost impossible to reproduce.
    const out = resolveRefFilter(filter, {}, {});
    expect(out.pending).toEqual(["$bill.productionOrderId", "$line.productId"]);
    // the static conditions that have been obtained have been given as usual -- pending, not the whole thing.
    expect(out.conditions).toEqual([
      { field: "orgType", values: ["factory"] },
      { field: "level", values: [1, 2] },
    ]);
  });

  it("🔴 Empty and pure blanks count \"unfilled\": ref.", () => {
    expect(resolveRefFilter({ a: { from: "$bill.x" } }, { x: "" }, null).pending).toEqual(["$bill.x"]);
    expect(resolveRefFilter({ a: { from: "$bill.x" } }, { x: "  " }, null).pending).toEqual(["$bill.x"]);
    expect(resolveRefFilter({ a: { from: "$bill.x" } }, { x: null }, null).pending).toEqual(["$bill.x"]);
  });

  it("🔴 When the header field conveys the nuld line context, $line. sentencing instead of throwing - the declaration period has been denied", () => {
    expect(resolveRefFilter({ a: { from: "$line.x" } }, {}, null).pending).toEqual(["$line.x"]);
  });

  it("there is no declaration.", () => {
    expect(resolveRefFilter(null, {}, null)).toEqual({ conditions: [], pending: [] });
    expect(resolveRefFilter(undefined, {}, null)).toEqual({ conditions: [], pending: [] });
  });

  it("line conclusion: Skipping upstream empty, not pending - manual alone still static", () => {
    const filter = {
      canPurchase: true,
      status: "active",
      id: { from: "$line.planId", through: "lines", field: "productId" },
    } as const;
    const out = resolveRefFilter(filter, {}, {});
    expect(out.pending).toEqual([]);
    expect(out.conditions).toEqual([
      { field: "canPurchase", values: [true] },
      { field: "status", values: ["active"] },
    ]);
  });

  it("line: via, values remains the document id", () => {
    const filter = {
      canPurchase: true,
      id: { from: "$line.planId", through: "lines", field: "productId" },
    } as const;
    const out = resolveRefFilter(filter, {}, { planId: "plan-1" });
    expect(out.pending).toEqual([]);
    expect(out.conditions).toEqual([
      { field: "canPurchase", values: [true] },
      {
        field: "id",
        values: ["plan-1"],
        via: { through: "lines", sourceField: "productId", from: "$line.planId" },
      },
    ]);
  });
});

describe("bind RefFilterViaEntities: Upstream module for entry", () => {
  it("press from the ref supplement", () => {
    const raw = resolveRefFilter(
      { id: { from: "$line.planId", through: "lines", field: "productId" } },
      {},
      { planId: "plan-1" },
    );
    const bound = bindRefFilterViaEntities(
      [],
      [{ key: "planId", type: "ref", ref: "purchasePlan" }],
      raw,
    );
    expect(bound.conditions[0]?.via?.entity).toBe("purchasePlan");
  });

  it("source is not ref and rejected -- otherwise the warehouse will take a non-document id as billId", () => {
    const raw = resolveRefFilter(
      { id: { from: "$line.planId", through: "lines", field: "productId" } },
      {},
      { planId: "plan-1" },
    );
    expect(() =>
      bindRefFilterViaEntities([], [{ key: "planId", type: "string", ref: null }], raw),
    ).toThrow(/not a reference/);
  });
});

describe("refFilterOperands: The front side therefore knows which ones to take before the candidate is selected.", () => {
  it("line only dynamic operations, static conditions not included (front end does not need to know the judgement itself)", () => {
    expect(
      refFilterOperands({ orgType: "factory", a: { from: "$bill.x" }, b: { from: "$line.y" } }),
    ).toEqual([
      { scope: "bill", key: "x" },
      { scope: "line", key: "y" },
    ]);
  });

  it("no declaration, ⇒, empty array", () => {
    expect(refFilterOperands(null)).toEqual([]);
  });
});
