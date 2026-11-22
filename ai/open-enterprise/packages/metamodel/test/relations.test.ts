// ---------------------------------------------------------------------------
// inducing documentary relationships
//
// Returning to a hole ** as measured**: detailed page `<main>` The number of anchor is 0--
// the "sale orders" on the list are not moving, and the "solded amount 1500" on the order does not see the singles.
// the relationship is clearly stated in the schema, and the renderer reads it as an option for the bottom box.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  isPushFillable,
  isReverseQueryable,
  isSystemSupplied,
  pushLineValues,
  pushSourceField,
  pushSourceIssueCoordinate,
  pushSourceTable,
  normalizeFixtureModule,
  normalizeQuery,
  relationsOf,
  reverseQueryFieldOf,
  type ModuleSchema,
} from "../src/index.js";

/*:: Creates a minimum legitimate module: single-state lifecycle + a main field + field called by the caller */
function mod(code: string, label: string, fields: readonly unknown[]): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label,
    domain: "d",
    fields: [{ key: "code", label: "Number", type: "string", required: true, primary: true }, ...fields],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", editable: "full" }],
      transitions: [],
    },
    views: { list: { columns: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
  });
}

const customer = mod("customer", "Customer", []);
const product = mod("product", "Product", []);
const salesOrder = mod("salesOrder", "Sales order", [
  { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
  {
    key: "lines",
    label: "Order lines",
    type: "subtable",
    ref: "salesOrderLine",
    fields: [{ key: "productId", label: "Product", type: "ref", ref: "product", required: true }],
  },
]);
const salesDelivery = mod("salesDelivery", "Sales issue", [
  { key: "orderId", label: "Sales order", type: "ref", ref: "salesOrder", required: true },
  { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
]);

const ALL = [customer, product, salesOrder, salesDelivery];

describe("outside: to whom does this module point?", () => {
  it("headers ref out with the pointed module", () => {
    const got = relationsOf(ALL, "salesDelivery").outbound;
    expect(got.map((r) => `${r.field}→${r.to}`).sort()).toEqual(["customerId→customer", "orderId→salesOrder"]);
  });

  it("from the list, ref is also out of bounds.", () => {
    const line = relationsOf(ALL, "salesOrder").outbound.find((r) => r.field === "productId");
    expect(line).toMatchObject({ to: "product", via: "line", through: "lines", throughLabel: "Order lines" });
  });

  it("subtable fields are not related by themselves -- it's ref from a table name, not a module code", () => {
    // sales OrderLine is not a module. If you look at it as a relationship, you're going to throw it because you're pointing at unknown modules.
    // instead of quietly adding a chain to a non-existent page. Answer.
    const got = relationsOf(ALL, "salesOrder").outbound;
    expect(got.map((r) => r.to)).not.toContain("salesOrderLine");
  });
});

describe("entry: Who points to this module", () => {
  it("sweep all modules to reverse relationship without any declaration", () => {
    const got = relationsOf(ALL, "customer").inbound;
    expect(got.map((r) => `${r.from}.${r.field}`).sort()).toEqual([
      "salesDelivery.customerId",
      "salesOrder.customerId",
    ]);
  });

  it("line-to-Link in - Goods quoted in detail from two sheets", () => {
    const got = relationsOf(ALL, "product").inbound;
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ from: "salesOrder", via: "line", through: "lines" });
  });

  it("no one points to a module with an empty array. It's not a mistake.", () => {
    // it wasn't unusual when the primary data was built.
    expect(relationsOf(ALL, "salesDelivery").inbound).toEqual([]);
  });
});

describe("can you re-check the attributes of your relationship?", () => {
  it("header relationships can be reversed: a normal list query is enough", () => {
    const r = relationsOf(ALL, "salesOrder").inbound.find((x) => x.from === "salesDelivery");
    expect(r && isReverseQueryable(r)).toBe(true);
  });

  it("🔴 The ruling is to Lever, not via - line ref points to the watch and can be reversed", () => {
    // merge the entire base of the library: there's no orderId on the list, the source is on the line.
    // press via to make the "relevant documents" on the order details page always empty and the blank panel will be read.
    // "This order doesn't go downstream" -- the rollup on the same screen is showing the amount of distribution.
    const r = relationsOf(ALL, "product").inbound[0];
    expect(r).toMatchObject({ via: "line", toLevel: "bill" });
    expect(r && isReverseQueryable(r)).toBe(true);
  });

  it("point to a line that cannot be refLine - it has a line id, not a file id", () => {
    // take it, id, and compare it with the documents, id.
    const merged = mod("mergedDelivery", "Combined issue", [
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "mergedDeliveryLine",
        fields: [
          { key: "orderId", label: "Order", type: "ref", ref: "salesOrder", required: true },
          { key: "orderLineId", label: "Order line", type: "refLine", ref: "salesOrder", through: "lines", required: true },
        ],
      },
    ]);
    const inbound = relationsOf([...ALL, merged], "salesOrder").inbound.filter((r) => r.from === "mergedDelivery");
    const toLine = inbound.find((r) => r.field === "orderLineId");
    const toBill = inbound.find((r) => r.field === "orderId");

    expect(toLine).toMatchObject({ via: "line", toLevel: "line", toThrough: "lines" });
    expect(toLine && isReverseQueryable(toLine)).toBe(false);
    // the same quote from the table can be rechecked -- both sides are on the same side, one is less than half the capacity.
    expect(toBill && isReverseQueryable(toBill)).toBe(true);
  });
});

describe("invert which field name", () => {
  /** Merges the library form: the source reference length is on the line and the header is not orderId - it's the same as the domains/sales */
  const merged = mod("mergedDelivery", "Combined issue", [
    {
      key: "lines",
      label: "Issue lines",
      type: "subtable",
      ref: "mergedDeliveryLine",
      fields: [
        { key: "orderId", label: "Sales order", type: "ref", ref: "salesOrder", required: true },
        { key: "orderLineId", label: "Order line", type: "refLine", ref: "salesOrder", through: "lines", required: true },
      ],
    },
  ]);
  const WITH_MERGED = [...ALL, merged];
  const inboundOf = (field: string) =>
    relationsOf(WITH_MERGED, "salesOrder").inbound.find((r) => r.from === "mergedDelivery" && r.field === field);

  it("the header relationship is the field name itself.", () => {
    const r = relationsOf(ALL, "salesOrder").inbound.find((x) => x.from === "salesDelivery");
    expect(r && reverseQueryFieldOf(r)).toBe("orderId");
  });

  it("The line relationship is to be carried from the surface level:`lines.orderId`No, it's not. `orderId`", () => {
    // the detected hole: the entire "relevant documents" on the order details page 400
    //   "Query.where: there is no field "orderId" on the module "sales Delivery"
    // the relationship itself is right (via:'line' + to Love:'bil', recheckable) and the query language recognizes this path.
    // (parseLinePath → questions) — It's just that this time the projection didn't spell from the surface.
    // and it's a whole panel that's wrong.
    const r = inboundOf("orderId");
    expect(r).toMatchObject({ via: "line", toLevel: "bill", through: "lines" });
    expect(r && reverseQueryFieldOf(r)).toBe("lines.orderId");
  });

  it("🔴 The field name that was dropped must have been identified in the query language -- that's the line that floats on both sides.", () => {
    // this one nails the projection to the query language: it changes the path pattern on either side, and it is red immediately.
    // if the string is equal to "lines.orderId," change it to "parseLinePath." Green
    const r = inboundOf("orderId");
    if (!r) throw new Error("the test premise failed: the orderId edge on the line was not derived");
    const where = { kind: "cond", field: reverseQueryFieldOf(r), op: "eq", value: "bill-1" };
    expect(normalizeQuery(merged, { where, search: null, sort: [], limit: 5, offset: 0 }).where).toMatchObject({
      field: "lines.orderId",
    });
  });

  it("you can't check the sides and throw them. No field. First Name", () => {
    // take the id and compare it to the document id and get an empty panel, and the empty panel will read, "This order is not going downstream."
    const r = inboundOf("orderLineId");
    expect(r && isReverseQueryable(r)).toBe(false);
    expect(() => reverseQueryFieldOf(r!)).toThrow(/cannot be reverse-looked-up/);
  });
});

describe("we need to blow up the missing module table, not one side.", () => {
  it("ref points to a module that is not on the table. Throw, and specify which field", () => {
    // the consequence of missing one side is that the details page is missing one panel and one link, without any local reporting. Wrong.
    expect(() => relationsOf([salesDelivery], "salesDelivery")).toThrow(/points at an unknown module "salesOrder"/);
  });

  it("ask for a module that is not in the table.", () => {
    expect(() => relationsOf(ALL, "purchaseOrder")).toThrow(/the module table has no "purchaseOrder"/);
  });
});

describe("self Reference", () => {
  it("the module points to itself in both directions -- it's both out and out.", () => {
    const account = mod("account", "Account", [{ key: "parentId", label: "Parent account", type: "ref", ref: "account" }]);
    const got = relationsOf([account], "account");
    expect(got.outbound).toHaveLength(1);
    expect(got.inbound).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// it's not a relationship.
//
// 🔴 Returned to a structural** accident:`derive` Never build a column, and `relationsOf` Once upon a time
// `type:'ref'` It's always on the side. Remove Protection`billRepo.assertRemovable`Go to that side.
// If you don't get the column, `fail()` ** Not a single record can be deleted from the module to which he was given.**
// even a warehouse that has just been built and is not downstream can't be deleted, while the wrong article says "no quote".
//
// The verdict is "Who set this value?":`ref` The users chose it.`derive:lookup` It's a copy of another field.
// The real quote is: `derive.match` The ref. The same article was quoted twice to include a copy as "who points to me".
//
// 🔴 This group is also nailed to the boundary of the verdict** (one misspelled must be red):
//   • Dropping the sentence and sending back the dead side ⇒ 1, 2 reds;
//   • Retrogression of the sentence
//   :: The judgement is written `isSystemSupplied` Company `snapshot` Eat together the twilight 3 red.
//     snapshot ** has a column** and has nothing to do with the source after freezing, which is the reference that this record holds.
// ---------------------------------------------------------------------------

describe("derived, ref. Figure", () => {
  const warehouse = mod("warehouse", "Stock warehouse", []);
  const order = mod("dwOrder", "Order", [
    { key: "warehouseId", label: "Shipping warehouse", type: "ref", ref: "warehouse", required: true },
  ]);
  const delivery = mod("dwDelivery", "Issue", [
    { key: "orderId", label: "Order", type: "ref", ref: "dwOrder", required: true },
    // the warehouse the user chose: True quote
    { key: "warehouseId", label: "Shipping warehouse", type: "ref", ref: "warehouse", required: true },
    // copies brought from purchase orders: unlisted, when asked
    {
      key: "orderWarehouseId",
      label: "Warehouse named on the order",
      type: "ref",
      ref: "warehouse",
      derive: { kind: "lookup", from: "dwOrder", match: "orderId", field: "warehouseId" },
    },
    // the one frozen: column, no more source.
    {
      key: "frozenWarehouseId",
      label: "Warehouse at order time",
      type: "ref",
      ref: "warehouse",
      snapshot: { from: "dwOrder", match: "orderId", through: null, field: "warehouseId" },
    },
  ]);
  const DW = [warehouse, order, delivery];

  it("🔴 Seeup's ref does not project side -- it's not a reference held in this module, it's a displayed value brought out", () => {
    const got = relationsOf(DW, "dwDelivery").outbound;
    expect(got.map((r) => r.field)).not.toContain("orderWarehouseId");
  });

  it("🔴 There's no such thing as counter-checking -- back-checking a column that doesn't exist. Drop it.", () => {
    const got = relationsOf(DW, "warehouse").inbound;
    // there's a lot of quotes: the one the user chose, the one on the upstream order.
    expect(got.map((r) => `${r.from}.${r.field}`).sort()).toEqual([
      "dwDelivery.frozenWarehouseId",
      "dwDelivery.warehouseId",
      "dwOrder.warehouseId",
    ]);
  });

  it("⚠️ `snapshot` It's not affected -- it's a column. It's the quote that this record holds.", () => {
    const got = relationsOf(DW, "warehouse").inbound;
    expect(got.map((r) => `${r.from}.${r.field}`)).toContain("dwDelivery.frozenWarehouseId");
  });

  it("it's a line-by-line, ref, same level.", () => {
    const lineDelivery = mod("dwLineDelivery", "Line-level issue", [
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "dwLineDeliveryLine",
        fields: [
          { key: "orderId", label: "Order", type: "ref", ref: "dwOrder", required: true },
          { key: "warehouseId", label: "Shipping warehouse", type: "ref", ref: "warehouse", required: true },
          {
            key: "orderWarehouseId",
            label: "Warehouse named on the order",
            type: "ref",
            ref: "warehouse",
            derive: { kind: "lookup", from: "dwOrder", match: "orderId", field: "warehouseId" },
          },
        ],
      },
    ]);
    const inbound = relationsOf([warehouse, order, lineDelivery], "warehouse").inbound.filter(
      (r) => r.from === "dwLineDelivery",
    );
    expect(inbound.map((r) => r.field)).toEqual(["warehouseId"]);
    expect(inbound[0]).toMatchObject({ via: "line", through: "lines", toLevel: "bill" });
  });
});

// ---------------------------------------------------------------------------
// Push / Manual menu: Source breakdown by `refLine.through` Matches, not the same name.
//
// 🔴 It's back to a hole with no symptoms: the source list used to be the key to the target.
// Go to the source module. `find` Out. The 12 push edges in the barn today coincide with the same name on both sides, which has always been green;
// And three aliases. `refLine` Declaration (all) `required: true`Only the hand-picker road will go.
// so people pick up the upstream list, and they pull out the line,** they don't fill out a box,** they end up stuck to the required gap.
//
// It's just the same name. Source `lines` Target `materialLines`。
// ---------------------------------------------------------------------------

const subOrder = mod("subcontractOrder", "Subcontract order", [
  {
    key: "lines",
    label: "Subcontract lines",
    type: "subtable",
    ref: "subcontractOrderLine",
    fields: [
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qty", label: "Quantity", type: "number", required: true },
    ],
  },
]);
const subIssue = mod("subcontractIssue", "Subcontract issue", [
  { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", required: true },
  {
    key: "materialLines",
    label: "Issue lines",
    type: "subtable",
    ref: "subcontractIssueLine",
    fields: [
      { key: "orderLineId", label: "Subcontract order line", type: "refLine", ref: "subcontractOrder", through: "lines", required: true },
      { key: "orderId", label: "Subcontract order", type: "ref", ref: "subcontractOrder", required: true },
      { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
      { key: "qty", label: "Quantity", type: "number", required: true },
    ],
  },
]);

const issueTable = subIssue.fields.find((f) => f.key === "materialLines");
if (!issueTable) throw new Error("fixture: materialLines was not built");

describe("exonyms: matching is refLine.through, not \"same name on both sides.\"", () => {
  it("PushSourceTable to find the source list by declaration `lines`", () => {
    expect(pushSourceTable(subOrder, issueTable)?.key).toBe("lines");
  });

  it("🔴 All right, id and the same list can be brought here -- none of this table ever worked.", () => {
    const row = pushLineValues(subOrder, issueTable, "bill-1", { id: "line-9", productId: "p1", qty: 30 }, isSystemSupplied);
    expect(row["orderLineId"]).toBe("line-9");
    expect(row["productId"]).toBe("p1");
    expect(row["qty"]).toBe(30);
    // watchhead's companion, Ref, is filled with the same job as the storage to check the existence of the facility. Write
    expect(row["orderId"]).toBeUndefined();
  });

  it("🔴 The offline gate sees the same sentence -- the gate and the enforcer are not to be judged separately.", () => {
    const link = issueTable.fields?.find((f) => f.key === "orderLineId");
    if (!link) throw new Error("fixture: orderLineId was not built");
    expect(isPushFillable(subOrder, link, issueTable, isSystemSupplied)).toBe(true);
  });

  it("turn back the same name when no refLine pointed back to the source module - no statement of that type would match", () => {
    const plain = mod("plainTarget", "No reference target", [
      { key: "lines", label: "Lines", type: "subtable", ref: "plainTargetLine", fields: [{ key: "qty", label: "Quantity", type: "number" }] },
    ]);
    const table = plain.fields.find((f) => f.key === "lines");
    if (!table) throw new Error("fixture");
    expect(pushSourceTable(subOrder, table)?.key).toBe("lines");
    expect(pushSourceTable(subIssue, table)).toBeNull();
  });

  it("through the list of the source module that you can't point to - the construction period should have stopped it and jumped silently", () => {
    const broken = mod("brokenTarget", "Bad target", [
      {
        key: "materialLines",
        label: "Lines",
        type: "subtable",
        ref: "brokenTargetLine",
        fields: [
          { key: "orderLineId", label: "Line", type: "refLine", ref: "subcontractOrder", through: "noSuchTable", required: true },
          { key: "orderId", label: "Document", type: "ref", ref: "subcontractOrder", required: true },
        ],
      },
    ]);
    const table = broken.fields.find((f) => f.key === "materialLines");
    if (!table) throw new Error("fixture");
    expect(() => pushSourceTable(subOrder, table)).toThrow(/has no line table/);
  });
});

describe("visible PushFrom allows lineback to source table Head", () => {
  const requirement = mod("materialReq", "Material requirement", [
    { key: "requiredDate", label: "Required date", type: "date", required: true },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "materialReqLine",
      fields: [{ key: "qty", label: "Quantity", type: "number", required: true }],
    },
  ]);
  const plan = mod("purchasePlanLike", "Purchase plan", [
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "planLine",
      fields: [
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "planArrivalDate", label: "Planned arrival date", type: "date", required: true, pushFrom: "requiredDate" },
      ],
    },
  ]);
  const table = plan.fields.find((field) => field.key === "lines");
  if (!table) throw new Error("fixture: plan.lines");
  const arrival = table.fields?.find((field) => field.key === "planArrivalDate");
  if (!arrival) throw new Error("fixture: planArrivalDate");

  it("the off-line gate thinks it can be filled out.", () => {
    expect(isPushFillable(requirement, arrival, table, isSystemSupplied)).toBe(true);
    expect(pushSourceField(requirement, arrival, table)?.key).toBe("requiredDate");
  });

  it("every line with the header freezes to the required date.", () => {
    const row = pushLineValues(
      requirement,
      table,
      "mr-1",
      { id: "l1", qty: 2 },
      isSystemSupplied,
      null,
      { requiredDate: "2026-09-01" },
    );
    expect(row["qty"]).toBe(2);
    expect(row["planArrivalDate"]).toBe("2026-09-01");
  });

  it("do not make a date without a header", () => {
    const row = pushLineValues(requirement, table, "mr-1", { id: "l1", qty: 2 }, isSystemSupplied);
    expect(row["planArrivalDate"]).toBeUndefined();
  });

  it("failed coordinates point back to the header of the source list, not a non-existent detail", () => {
    expect(pushSourceIssueCoordinate(requirement, plan, "lines[0].planArrivalDate")).toEqual({
      path: "requiredDate",
      label: "Required date",
    });
  });

  it("the same name does not come back to the header - the same name does not come from this cell without pushFrom", () => {
    const target = mod("plainDateTarget", "Target", [
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "plainDateLine",
        fields: [{ key: "requiredDate", label: "Line date", type: "date", required: true }],
      },
    ]);
    const targetTable = target.fields.find((field) => field.key === "lines");
    const col = targetTable?.fields?.find((field) => field.key === "requiredDate");
    if (!targetTable || !col) throw new Error("fixture");
    expect(isPushFillable(requirement, col, targetTable, isSystemSupplied)).toBe(false);
  });

  it("do not turn back when the same name is on the source line", () => {
    const source = mod("datedLines", "A source with a line date", [
      { key: "requiredDate", label: "Header date", type: "date" },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "datedLine",
        fields: [
          { key: "requiredDate", label: "Line date", type: "date" },
          { key: "qty", label: "Quantity", type: "number" },
        ],
      },
    ]);
    const row = pushLineValues(
      source,
      table,
      "s1",
      { id: "l1", qty: 1, requiredDate: "2026-01-01" },
      isSystemSupplied,
      null,
      { requiredDate: "2026-12-31" },
    );
    expect(row["planArrivalDate"]).toBe("2026-01-01");
  });
});
