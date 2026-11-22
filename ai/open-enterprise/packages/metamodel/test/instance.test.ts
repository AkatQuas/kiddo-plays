import { describe, expect, it } from "vitest";
import { checkBillPatch, checkGeneratedBill, checkNewBill, normalizeFixtureModule, refSitesOf, type BillIssue } from "../src/index.js";

/**
 * a module that covers all of the things to be judged: obligatory / non-mandatory x types, plus three system supplies
 * (Auto / LineAgg / Formula) used to peg "no system feed will be recorded and verified".
 */
const schema = normalizeFixtureModule({
  code: "purchaseOrder",
  label: "Purchase order",
  domain: "procurement",
  numbering: { prefix: "CG", seqScope: "day" },
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true, auto: true },
    { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
    { key: "orderDate", label: "Order date", type: "date", required: true },
    { key: "channel", label: "Purchase channel", type: "enum", options: ["Direct purchase", "Agent"] },
    { key: "urgent", label: "Urgent", type: "bool" },
    { key: "discount", label: "Discount rate", type: "percent" },
    { key: "remark", label: "Remark", type: "text" },
    { key: "totalQty", label: "Order quantity", type: "number", lineAgg: { of: "lines", measure: "sum(qty)" } },
    {
      key: "lines",
      label: "Purchase lines",
      type: "subtable",
      ref: "purchaseOrderLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "price", label: "Unit price", type: "money", required: true },
        {
          key: "amount",
          label: "Amount",
          type: "money",
          derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "price" }] } },
        },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "reviewed", label: "reviewed", terminal: true },
    ],
    transitions: [{ code: "approve", from: "draft", to: "reviewed", action: "Approve" }],
  },
  views: { list: { columns: ["code"] } },
});

const plannerFrozenSchema = normalizeFixtureModule({
  code: "generatedTarget",
  label: "System-generated document",
  domain: "test",
  fields: [
    { key: "name", label: "Name", type: "string" },
    { key: "mode", label: "Frozen method", type: "enum", options: ["manual", "automatic"], plannerSupplied: true },
  ],
  lifecycle: {
    statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
    transitions: [],
  },
  handoff: [],
  preconditions: [],
  views: { list: { columns: ["name"], filters: [], searchable: [], defaultSort: null }, form: [] },
});

describe("plannerSupplid Dam", () => {
  it("normal New Ignore and Refuse Handling by Outer Keygates, Planner Generation requires a visible freeze and validation of the count", () => {
    expect(plannerFrozenSchema.creatable.manual).toBe(false);
    expect(plannerFrozenSchema.creatable.blockers).toEqual([
      expect.objectContaining({ path: "mode", label: "Frozen method" }),
    ]);
    const manual = checkNewBill(plannerFrozenSchema, { name: "x" }, {});
    expect(manual.ok).toBe(true);

    const missing = checkGeneratedBill(plannerFrozenSchema, { name: "x" }, {});
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues.map((issue) => issue.path)).toContain("mode");

    const invalid = checkGeneratedBill(plannerFrozenSchema, { name: "x", mode: "other" }, {});
    expect(invalid.ok).toBe(false);

    const valid = checkGeneratedBill(plannerFrozenSchema, { name: "x", mode: "manual" }, {});
    expect(valid).toMatchObject({ ok: true, header: { name: "x", mode: "manual" } });
  });
});

const manualRequiredSchema = normalizeFixtureModule({
  code: "manualOrGenerated",
  label: "Created by a person or by the system",
  domain: "test",
  fields: [
    { key: "code", label: "Document number", type: "string", primary: true, auto: true },
    { key: "reason", label: "Business reason", type: "text", requiredOnManualCreate: true },
  ],
  lifecycle: { statuses: [{ key: "draft", initial: true, terminal: true }], transitions: [] },
  views: { list: { columns: ["code"] }, form: [{ title: "Basics", fields: ["code", "reason"] }] },
});

describe("requiredOnManualCreate", () => {
  it("only normal manual new to fill, Planner generation leaves empty", () => {
    const missing = checkNewBill(manualRequiredSchema, {}, {});
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues).toContainEqual(expect.objectContaining({ path: "reason", code: "REQUIRED_BLANK" }));

    expect(checkGeneratedBill(manualRequiredSchema, {}, {})).toMatchObject({ ok: true });
    expect(checkNewBill(manualRequiredSchema, { reason: "  Month-end count found 3 extra  " }, {})).toMatchObject({
      ok: true,
      header: { reason: "Month-end count found 3 extra" },
    });
  });
});

const WHOLE = {
  supplierId: "s-1",
  orderDate: "2026-07-30",
  channel: "Direct purchase",
  urgent: false,
  discount: 0.1,
  remark: "Remark",
};
const ROW = { productId: "p-1", qty: 2, price: 10 };
const LINES = { lines: [ROW] };

/*♪ Just take the code, and the assertion doesn't have to be copied ♪ - The news has changed. Red */
function codesOf(check: ReturnType<typeof checkNewBill>): readonly string[] {
  return check.ok ? [] : check.issues.map((i) => i.code);
}

function issuesOf(check: ReturnType<typeof checkNewBill>): readonly BillIssue[] {
  return check.ok ? [] : check.issues;
}

describe("legitimate single release and standardization", () => {
  it("release, and return value can drop directly Library", () => {
    const check = checkNewBill(schema, WHOLE, LINES);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.header["supplierId"]).toBe("s-1");
    expect(check.lines["lines"]).toHaveLength(1);
  });

  it("🔴 None of the system supply fields are involved: auto / lineAgg / formulae generation does not necessarily fill in or result in", () => {
    // if they are treated as "unfilled fields", a completely correct list will never be created;
    // in turn, if it's taken as it is, it's the user who can write the system supply fields.
    const check = checkNewBill(schema, WHOLE, LINES);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.header).not.toHaveProperty("code");
    expect(check.header).not.toHaveProperty("totalQty");
    expect(check.lines["lines"]?.[0]).not.toHaveProperty("amount");
  });

  it("🔴 Empty string and nuld harvest nuld - Unfilled in the library only means", () => {
    // The two expressions are in common.`where remark is null` I'll miss half.
    const check = checkNewBill(schema, { ...WHOLE, remark: "", channel: null }, LINES);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.header["remark"]).toBeNull();
    expect(check.header["channel"]).toBeNull();
  });

  it("strip blanks on both ends of the string: A space is not \"filled\"", () => {
    const blank = checkNewBill(schema, { ...WHOLE, remark: "   " }, LINES);
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.header["remark"]).toBeNull();

    const padded = checkNewBill(schema, { ...WHOLE, supplierId: "  s-1  " }, LINES);
    if (padded.ok) expect(padded.header["supplierId"]).toBe("s-1");
  });
});

describe("must fill the gap: the previous form was 500", () => {
  it("the header will not be filled with RQUIRED BLANK, not with PG's not-null to throw", () => {
    const { orderDate: _dropped, ...rest } = WHOLE;
    const check = checkNewBill(schema, rest, LINES);
    expect(codesOf(check)).toEqual(["REQUIRED_BLANK"]);
    expect(issuesOf(check)[0]).toMatchObject({ path: "orderDate", label: "Order date" });
    // The message must be a label, not a listing: PG. `order_date`，
    // the user only has the "order date" on the interface.
    expect(issuesOf(check)[0]?.message).toContain("Order date");
  });

  it("🔴 An empty string is also a missing value - this is the only line of defense for the text type required fields", () => {
    // `NOT NULL` Empty strings are always released, so ref / string must be filled on the other side of the database with no gate.
    // Actual:`customerId: ""` Get 201, open up and empty. White
    expect(codesOf(checkNewBill(schema, { ...WHOLE, supplierId: "" }, LINES))).toEqual(["REQUIRED_BLANK"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, supplierId: "   " }, LINES))).toEqual(["REQUIRED_BLANK"]);
  });

  it("🔴 It's not the first -- PG hit the first full, abort, only one.", () => {
    const check = checkNewBill(schema, { channel: "Direct purchase" }, { lines: [{}] });
    const issues = issuesOf(check);
    expect(issues.map((i) => i.path).sort()).toEqual([
      "lines[0].price",
      "lines[0].productId",
      "lines[0].qty",
      "orderDate",
      "supplierId",
    ]);
    expect(issues.every((i) => i.code === "REQUIRED_BLANK")).toBe(true);
  });

  it("it's not a problem not to fill in.", () => {
    const { remark: _r, channel: _c, urgent: _u, discount: _d, ...bare } = WHOLE;
    expect(checkNewBill(schema, bare, LINES).ok).toBe(true);
  });
});

describe("wrong type: always 500 before, or worse - Silent library", () => {
  it("date received the / empty string / semi-clear question, not 22P02", () => {
    expect(codesOf(checkNewBill(schema, { ...WHOLE, orderDate: "not a date" }, LINES))).toEqual(["DATE_MALFORMED"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, orderDate: "2026-07" }, LINES))).toEqual(["DATE_MALFORMED"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, orderDate: 20260730 }, LINES))).toEqual(["TYPE_MISMATCH"]);
  });

  it("🔴 The day that does not exist on the calendar is rejected - shape does not mean the day", () => {
    expect(codesOf(checkNewBill(schema, { ...WHOLE, orderDate: "2026-02-30" }, LINES))).toEqual(["DATE_MALFORMED"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, orderDate: "2026-13-01" }, LINES))).toEqual(["DATE_MALFORMED"]);
    // february 29th of the year.
    expect(checkNewBill(schema, { ...WHOLE, orderDate: "2028-02-29" }, LINES).ok).toBe(true);
  });

  it("🔴 Ref received object rejected. Once upon a time it was spelled by JS as '[Object Object] 'Silent Library", () => {
    const check = checkNewBill(schema, { ...WHOLE, supplierId: { a: 1 } }, LINES);
    expect(codesOf(check)).toEqual(["TYPE_MISMATCH"]);
    expect(issuesOf(check)[0]?.message).toContain("Supplier");
  });

  it("numeric value received text rejected; numeric string received (numeric column often arrives with a string)", () => {
    expect(codesOf(checkNewBill(schema, WHOLE, { lines: [{ ...ROW, qty: "Many" }] }))).toEqual(["TYPE_MISMATCH"]);
    const check = checkNewBill(schema, WHOLE, { lines: [{ ...ROW, qty: "2.5" }] });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.lines["lines"]?.[0]?.["qty"]).toBe(2.5);
  });

  it("bool only picks a char: 'false' is a truth string, and the wrong direction is to remain silent as true", () => {
    expect(codesOf(checkNewBill(schema, { ...WHOLE, urgent: "false" }, LINES))).toEqual(["TYPE_MISMATCH"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, urgent: 1 }, LINES))).toEqual(["TYPE_MISMATCH"]);
  });

  it("enum candidate value rejected and put on the list", () => {
    const check = checkNewBill(schema, { ...WHOLE, channel: "Commerce" }, LINES);
    expect(codesOf(check)).toEqual(["ENUM_NOT_IN_OPTIONS"]);
    expect(issuesOf(check)[0]?.message).toContain("Direct purchase");
    expect(issuesOf(check)[0]?.message).toContain("Agent");
  });
});

describe("numerical accuracy and range: Same source as the column precision in the table", () => {
  it("🔴 More than numeric integer rejection. Before PG throws 22003, the pattern is 500.", () => {
    // money is 14 bits integer of numeric (18,4)
    const check = checkNewBill(schema, WHOLE, { lines: [{ ...ROW, price: 1e30 }] });
    expect(codesOf(check)).toEqual(["NUMBER_OUT_OF_RANGE"]);
    expect(checkNewBill(schema, WHOLE, { lines: [{ ...ROW, price: 1e13 }] }).ok).toBe(true);
    expect(codesOf(checkNewBill(schema, WHOLE, { lines: [{ ...ROW, price: 1e14 }] }))).toEqual([
      "NUMBER_OUT_OF_RANGE",
    ]);
  });

  it("🔴 Decimal bits rounded to the column precision and not left to PG to intercept -- otherwise the total of the watch is one more difference to the detail min", () => {
    // the total value returned from** here** (see prepareWrite → lineTotals in billRepo).
    // if you do not give up, the price of the library is set by PG to 4 bits, and the total is 6 bits, and the two numbers will never match
    const check = checkNewBill(schema, WHOLE, { lines: [{ ...ROW, price: 1.234567 }] });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.lines["lines"]?.[0]?.["price"]).toBe(1.2346);
  });

  it("percent is the symmetry of the whole warehouse, accepting only 0.100.", () => {
    expect(codesOf(checkNewBill(schema, { ...WHOLE, discount: -0.1 }, LINES))).toEqual(["PERCENT_OUT_OF_RANGE"]);
    expect(codesOf(checkNewBill(schema, { ...WHOLE, discount: 100.0001 }, LINES))).toEqual(["PERCENT_OUT_OF_RANGE"]);
    expect(checkNewBill(schema, { ...WHOLE, discount: 0 }, LINES).ok).toBe(true);
    expect(checkNewBill(schema, { ...WHOLE, discount: 100 }, LINES).ok).toBe(true);
  });

  it("negative numbers and 0 are legitimate business values, not at this level.", () => {
    expect(checkNewBill(schema, WHOLE, { lines: [{ ...ROW, qty: 0 }] }).ok).toBe(true);
    expect(checkNewBill(schema, WHOLE, { lines: [{ ...ROW, qty: -5 }] }).ok).toBe(true);
  });
});

describe("details: Line numbers and paths", () => {
  it("path uses subscripts, label uses line numbers - interfaces click on the subscript, people follows line numbers Read it.", () => {
    const check = checkNewBill(schema, WHOLE, { lines: [ROW, { productId: "p-2", price: 1 }] });
    const issues = issuesOf(check);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe("lines[1].qty");
    expect(issues[0]?.label).toBe("Purchase lines line 2 · Quantity");
  });

  it("line is not an object →LINE ROW NOT OBJECT, skipping silently", () => {
    expect(codesOf(checkNewBill(schema, WHOLE, { lines: ["x"] as never }))).toEqual(["LINE_ROW_NOT_OBJECT"]);
  });

  it("it's not an array from the watch.", () => {
    expect(codesOf(checkNewBill(schema, WHOLE, { lines: "x" as never }))).toEqual(["LINES_NOT_ARRAY"]);
  });

  it("zero lines and fine lines -- drafts are slowly filled out and the number of gates is on submit", () => {
    expect(checkNewBill(schema, WHOLE, { lines: [] }).ok).toBe(true);
  });

  it("reQUIRED BLANK", () => {
    const requiredLines = normalizeFixtureModule({
      code: "mustHaveLines",
      label: "Lines are required",
      domain: "procurement",
      numbering: { prefix: "MX", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
        {
          key: "lines",
          label: "Purchase lines",
          type: "subtable",
          ref: "mustHaveLine",
          required: true,
          fields: [
            { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
            { key: "qty", label: "Quantity", type: "number", required: true },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"] } },
    });
    const header = { supplierId: "s-1" };
    const omitted = checkNewBill(requiredLines, header, {});
    expect(codesOf(omitted)).toContain("REQUIRED_BLANK");
    const empty = checkNewBill(requiredLines, header, { lines: [] });
    expect(codesOf(empty)).toContain("REQUIRED_BLANK");
    expect(checkNewBill(requiredLines, header, { lines: [{ productId: "p-1", qty: 1 }] }).ok).toBe(true);
  });

  it("there's no schedule on the module. Throw it.", () => {
    expect(() => checkNewBill(schema, WHOLE, { doesNotExist: [] })).toThrow(/has no line table/);
  });
});

describe("the difference is \"Is the missing count wrong?\"", () => {
  it("patch does not contain a mandatory field = it is not a gap", () => {
    expect(checkBillPatch(schema, { remark: "Edit the remark" }, null).ok).toBe(true);
  });

  it("🔴 The patch emptys the required fillings and still refuses. That's \"deleting what's already worth.\" It doesn't work like it's ever been filled out.", () => {
    expect(codesOf(checkBillPatch(schema, { orderDate: "" }, null))).toEqual(["REQUIRED_BLANK"]);
    expect(codesOf(checkBillPatch(schema, { orderDate: null }, null))).toEqual(["REQUIRED_BLANK"]);
  });

  it("the type of field that appears in the Patch", () => {
    expect(codesOf(checkBillPatch(schema, { orderDate: "not a date" }, null))).toEqual(["DATE_MALFORMED"]);
  });

  it("🔴 Line always press whole, even if the whole sheet is a watch -- the detail is a whole sheet replacement", () => {
    // it's all that comes in. Pressing the watch will allow "the necessary emptying of a line while saving" to pass silently.
    // and the row of not-null when you drop the library will hit the PG.
    expect([...codesOf(checkBillPatch(schema, {}, { lines: [{ productId: "p-1" }] }))].sort()).toEqual([
      "REQUIRED_BLANK",
      "REQUIRED_BLANK",
    ]);
  });

  it("lines for full = nothing.", () => {
    const check = checkBillPatch(schema, { remark: "x" }, null);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.lines).toEqual({});
  });
});

describe("refSitesof: Which references should be found in the declaration", () => {
  it("refDefault only hangs the reference coordinates when the target is missing, with visible overlay priority", () => {
    const withDefault = normalizeFixtureModule({
      code: "priceDraft",
      label: "Price draft",
      domain: "test",
      numbering: { prefix: "PD", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
        {
          key: "pieceRate",
          label: "Piece rate",
          type: "money",
          required: true,
          refDefault: { from: "operation", match: "operationId", through: null, field: "pieceRate" },
        },
      ],
      lifecycle: { statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }], transitions: [] },
      views: { list: { columns: ["code"] } },
    });

    const omitted = checkNewBill(withDefault, { operationId: "op-1" }, {});
    expect(omitted.ok).toBe(true);
    const site = refSitesOf(withDefault, omitted.ok ? omitted.header : {}, {})[0];
    expect(site?.defaults).toEqual([
      {
        sourceField: "pieceRate",
        target: { table: null, row: null, field: "pieceRate", path: "pieceRate", label: "Piece rate" },
      },
    ]);

    const overridden = checkNewBill(withDefault, { operationId: "op-1", pieceRate: 9.9 }, {});
    expect(overridden.ok).toBe(true);
    const overriddenSite = refSitesOf(withDefault, overridden.ok ? overridden.header : {}, {})[0];
    expect(overriddenSite?.defaults).toEqual([]);
  });

  it("the header and detailed ref are included with the path / label / target entity", () => {
    const sites = refSitesOf(schema, WHOLE, LINES);
    expect(sites).toEqual([
      // `snapshots` Yes** This quote coordinates are to be attached to the freezer**. None of the snapshots of this module has been declared empty.
      // 🔴 An empty array is not full: caller's caller is unconditional for-of it,
      // give it to Null, you'll have to add a empty branch to the writing path, and that branch will be the place to "silent or not freeze."
      // `filter` ** This is the case after the candidate filtered.** None of this module refFilter declared
      // Conditions/ pending are empty. and `snapshots` Same law.
      // write the path and read it unconditionally, and give it to the Null, which is exactly where the "silent or unfiltered" is.
      {
        entity: "supplier",
        through: null,
        id: "s-1",
        path: "supplierId",
        label: "Supplier",
        companion: null,
        filter: { conditions: [], pending: [] },
        filterAwaits: null,
        snapshots: [],
        defaults: [],
      },
      {
        entity: "product",
        through: null,
        id: "p-1",
        path: "lines[0].productId",
        label: "Purchase lines line 1 · Product",
        companion: null,
        filter: { conditions: [], pending: [] },
        filterAwaits: null,
        snapshots: [],
        defaults: [],
      },
    ]);
  });

  it("🔴 snapshot hung on the reference coordinates - freeze must be the one that has just been judged existential Okay.", () => {
    // division of labour:** kernel coordinates, server do IO**. Freezing values follow the same query as the reference existentiality.
    // so there's only one real source of "see what line." If you break into a second query, you'll have one more real source, and you'll float.
    // "Quoted, snapshot failed" or the other way around, and both sides look normal.
    const withSnapshot = normalizeFixtureModule({
      code: "goodsIssue",
      label: "Issue",
      domain: "inventory",
      numbering: { prefix: "CK", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse", required: true },
        {
          key: "warehouseName",
          label: "Warehouse name",
          type: "string",
          snapshot: { from: "warehouse", match: "warehouseId", through: null, field: "name" },
        },
        {
          key: "lines",
          label: "Issue lines",
          type: "subtable",
          ref: "goodsIssueLine",
          fields: [
            { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
            { key: "qty", label: "Quantity", type: "number", required: true },
            {
              key: "unit",
              label: "Unit",
              type: "string",
              snapshot: { from: "product", match: "productId", through: null, field: "unit" },
            },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"] } },
    });

    const sites = refSitesOf(withSnapshot, { warehouseId: "w-1" }, { lines: [{ productId: "p-1", qty: 1 }] });
    // freezing the target to write back the coordinates (table / line subscript / column), server only by coordinates and no more self-sweeping fields --
    // "The watch is clean, the detail is forgotten."
    expect(sites).toEqual([
      {
        entity: "warehouse",
        through: null,
        id: "w-1",
        path: "warehouseId",
        label: "Warehouse",
        companion: null,
        filter: { conditions: [], pending: [] },
        filterAwaits: null,
        snapshots: [
          {
            sourceField: "name",
            target: { table: null, row: null, field: "warehouseName", path: "warehouseName", label: "Warehouse name" },
          },
        ],
        defaults: [],
      },
      {
        entity: "product",
        through: null,
        id: "p-1",
        path: "lines[0].productId",
        label: "Issue lines line 1 · Product",
        companion: null,
        filter: { conditions: [], pending: [] },
        filterAwaits: null,
        snapshots: [
          {
            sourceField: "unit",
            target: {
              table: "lines",
              row: 0,
              field: "unit",
              path: "lines[0].unit",
              label: "Issue lines line 1 · Unit",
            },
          },
        ],
        defaults: [],
      },
    ]);
  });

  it("🔴 Freezing fields themselves are not involved in recording verification -- the client passed on it as a key, not a value gate. Yes.", () => {
    // snapshot in `isSystemSupplied` ♪ ♪ The stakes are all over it. ♪ You must fill the gap by
    // "Match shall fill + Source Non-empty Guarantee + Column not Null" to catch, not here.
    const withSnapshot = normalizeFixtureModule({
      code: "goodsIssue2",
      label: "Issue",
      domain: "inventory",
      numbering: { prefix: "CK", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        { key: "warehouseId", label: "Warehouse", type: "ref", ref: "warehouse", required: true },
        {
          key: "warehouseName",
          label: "Warehouse name",
          type: "string",
          snapshot: { from: "warehouse", match: "warehouseId", through: null, field: "name" },
        },
      ],
      lifecycle: {
        statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"] } },
    });
    const checked = checkNewBill(withSnapshot, { warehouseId: "w-1" }, {});
    expect(checked.ok).toBe(true);
    // this is not the type in the normative result: it is supplemented by a resolverefs in the transaction, not from the client
    if (checked.ok) expect(Object.hasOwn(checked.header, "warehouseName")).toBe(false);
  });

  it("🔴 RefLine also collect and bring through - the line of which list on the other side", () => {
    // Only `ref` , the first line-referenced paragraph will pass silently.
    // i mean, through it can't be saved: the bottom of both is the text column, and the wrong tab shows that the good data was dropped.
    const withRefLine = normalizeFixtureModule({
      code: "goodsReceipt",
      label: "Purchase receipt",
      domain: "procurement",
      numbering: { prefix: "RK", seqScope: "day" },
      fields: [
        { key: "code", label: "Document number", type: "string", primary: true, auto: true },
        {
          key: "lines",
          label: "Receipt lines",
          type: "subtable",
          ref: "goodsReceiptLine",
          fields: [
            { key: "sourceBillId", label: "Source order", type: "ref", ref: "purchaseOrder", required: true },
            { key: "sourceLineId", label: "Source order line", type: "refLine", ref: "purchaseOrder", through: "lines" },
            { key: "qty", label: "Quantity", type: "number", required: true },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"] } },
    });
    expect(refSitesOf(withRefLine, {}, { lines: [{ sourceLineId: "pol-9", qty: 1 }] })).toEqual([
      {
        entity: "purchaseOrder",
        through: "lines",
        id: "pol-9",
        path: "lines[0].sourceLineId",
        label: "Receipt lines line 1 · Source order line",
        companion: { table: "lines", row: 0, field: "sourceBillId" },
        filter: { conditions: [], pending: [] },
        filterAwaits: null,
        snapshots: [],
        defaults: [],
      },
    ]);
    const checked = checkNewBill(withRefLine, {}, { lines: [{ sourceLineId: "pol-9", qty: 1 }] });
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      // backup column required is the repository constraint, not the second input level; the storage check will be completed by pol-9 It's...
      expect(checked.lines["lines"]?.[0]).toEqual({ sourceLineId: "pol-9", qty: 1 });
    }
  });

  it("🔴 The half of the detail is not to be missed -- the missing sign is that the lines are always running out of air.", () => {
    const sites = refSitesOf(schema, {}, { lines: [{ productId: "p-1" }, { productId: "p-2" }] });
    expect(sites.map((s) => s.path)).toEqual(["lines[0].productId", "lines[1].productId"]);
  });

  it("unfilled ref not on the list: it's a mandatory gate, and it shouldn't have become an id='existent query", () => {
    expect(refSitesOf(schema, { ...WHOLE, supplierId: "" }, { lines: [] })).toEqual([]);
  });
});
