// ---------------------------------------------------------------------------
// lineAgg - Header = Total of Details
//
// This capability is supplemented by the "system supply x column"`auto` A second resident.
// it goes down, so consistency is no longer given by "no fall" — this document is about the obligation to change:
// there is only one request for value, a statement that cannot be written, and the amount of the check that is recognized without recognition.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  computeLineAggregates,
  hasColumn,
  isDerived,
  isSystemSupplied,
  normalizeFixtureModule,
  sumLineColumn,
  validateModule,
  type Field,
} from "../src/index.js";

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  views: unknown;
  [key: string]: unknown;
}

/**
 * a minimum available purchase order: the first two totals in the table and a column of formulae in the breakdown.
 *
 * the shape follows the model sales order - the line amount is the same line formula and the header amount is its sum.
 * this is the most common link in the ERP.
 */
function purchaseOrder(): Raw {
  return structuredClone({
    code: "purchaseOrder",
    label: "Purchase order",
    domain: "procurement",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "supplierId", label: "Supplier", type: "ref", ref: "supplier", required: true },
      { key: "totalQty", label: "Quantity", type: "number", lineAgg: { of: "lines", measure: "sum(qty)" } },
      { key: "totalAmount", label: "Amount", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
      { key: "lineCount", label: "Row count", type: "number", lineAgg: { of: "lines", measure: "count()" } },
      {
        key: "lines",
        label: "Lines",
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
        // no further details after the check: the sum of the amount of the item is the sum of the details.
        { key: "pending", label: "awaitingReceipt", color: "blue", editable: "none" },
        { key: "done", label: "completed", color: "green", terminal: true },
      ],
      transitions: [
        {
          code: "approve",
          from: "draft",
          to: "pending",
          action: "Approve",
          primary: true,
          effects: [
            {
              target: "ap",
              op: "reserve",
              subject: "$bill.supplierId",
              amount: "{totalAmount}",
              reverseOn: ["unapprove", "finish"],
            },
          ],
        },
        { code: "unapprove", from: "pending", to: "draft", action: "Unapprove" },
        { code: "finish", from: "pending", to: "done", action: "Complete", primary: true },
      ],
    },
    views: { list: { columns: ["code", "supplierId", "totalAmount"] } },
  });
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

function fieldsOf(raw: Raw): readonly Field[] {
  return normalizeFixtureModule(raw).fields;
}

/*:: Tablehead field (key-based) for classification of claims */
function fieldOf(raw: Raw, key: string): Field {
  const hit = fieldsOf(raw).find((f) => f.key === key);
  if (!hit) throw new Error(`no field ${key}`);
  return hit;
}

describe("lineAgg landed in the \"System supply x column\"", () => {
  it("it's a system supply (no person is allowed to fill in), but** there's a column** - the opposite is true.", () => {
    const total = fieldOf(purchaseOrder(), "totalAmount");
    expect(isSystemSupplied(total)).toBe(true);
    // 🔴 This is the foundation of the whole capability: hasColumn isDelived, so lineAgg automatically comes out.
    // eFFECT AMOUNT NOT STORED) and lookup downstream will expire.
    expect(isDerived(total)).toBe(false);
    expect(hasColumn(total)).toBe(true);
  });

  it("overlapping with delive / auto - only one field can have a supply mechanism", () => {
    const withDerive = purchaseOrder();
    withDerive.fields[3] = {
      key: "totalAmount",
      label: "Amount",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(amount)" },
      derive: { kind: "formula", expr: { value: 1 } },
    };
    expect(() => normalizeFixtureModule(withDerive)).toThrow(/derive and lineAgg are mutually exclusive/);

    const withAuto = purchaseOrder();
    withAuto.fields[3] = {
      key: "totalAmount",
      label: "Amount",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(amount)" },
      auto: true,
    };
    expect(() => normalizeFixtureModule(withAuto)).toThrow(/mutually exclusive/);
  });

  it("load fields must be numerical", () => {
    const raw = purchaseOrder();
    raw.fields[3] = { key: "totalAmount", label: "Amount", type: "string", lineAgg: { of: "lines", measure: "sum(amount)" } };
    expect(() => normalizeFixtureModule(raw)).toThrow(/evaluates to a number/);
  });

  it("measure is written in the same words as rollup, som / count", () => {
    const raw = purchaseOrder();
    raw.fields[2] = { key: "totalQty", label: "Quantity", type: "number", lineAgg: { of: "lines", measure: "avg(qty)" } };
    // 🔴 avg /min / max has no value on the empty detail and the total is to enter the notNull column
    expect(() => normalizeFixtureModule(raw)).toThrow(/avg/);
  });
});

describe("cluster: all unwritten aggregate statements are blocked during the modelling period", () => {
  it("it's not about detail.", () => {
    const raw = purchaseOrder();
    raw.fields[2] = { key: "totalQty", label: "Quantity", type: "number", lineAgg: { of: "supplierId", measure: "sum(qty)" } };
    expect(errorCodes(raw)).toContain("LINE_AGG_TARGET_UNKNOWN");
  });

  it("the meter column is not on that list.", () => {
    const raw = purchaseOrder();
    raw.fields[2] = { key: "totalQty", label: "Quantity", type: "number", lineAgg: { of: "lines", measure: "sum(weight)" } };
    expect(errorCodes(raw)).toContain("LINE_AGG_MEASURE_UNKNOWN");
  });

  it("the measuring column is lookup / rollup ⇒LINE AGG MEASURE NOT LOCAL (total at saving, those two are to be checked)", () => {
    const raw = purchaseOrder();
    const lines = raw.fields[5] as { fields: unknown[] };
    lines.fields.push({
      key: "listPrice",
      label: "List price",
      type: "money",
      derive: { kind: "lookup", from: "product", match: "productId", field: "price" },
    });
    raw.fields[3] = {
      key: "totalAmount",
      label: "Amount",
      type: "money",
      lineAgg: { of: "lines", measure: "sum(listPrice)" },
    };
    expect(errorCodes(raw)).toContain("LINE_AGG_MEASURE_NOT_LOCAL");
  });

  it("the measurement column is percent ⇒LINE AGG MEASURE NOT SUMMABLE (no reading in percentages added)", () => {
    const raw = purchaseOrder();
    const lines = raw.fields[5] as { fields: unknown[] };
    lines.fields.push({ key: "discount", label: "Discount %", type: "percent" });
    raw.fields[2] = { key: "totalQty", label: "Quantity", type: "number", lineAgg: { of: "lines", measure: "sum(discount)" } };
    expect(errorCodes(raw)).toContain("LINE_AGG_MEASURE_NOT_SUMMABLE");
  });

  it("sum(money) drops number column ⇒LINE AGG TYPE MISMATCH (precision and display caliber will be exchanged quietly)", () => {
    const raw = purchaseOrder();
    raw.fields[3] = { key: "totalAmount", label: "Amount", type: "number", lineAgg: { of: "lines", measure: "sum(amount)" } };
    expect(errorCodes(raw)).toContain("LINE_AGG_TYPE_MISMATCH");
  });

  it("count must fall number number one money", () => {
    const raw = purchaseOrder();
    raw.fields[4] = { key: "lineCount", label: "Row count", type: "money", lineAgg: { of: "lines", measure: "count()" } };
    expect(errorCodes(raw)).toContain("LINE_AGG_TYPE_MISMATCH");
  });

  it("hang on to the line ⇒LINE AGG ON LINE", () => {
    const raw = purchaseOrder();
    const lines = raw.fields[5] as { fields: unknown[] };
    lines.fields.push({ key: "sub", label: "Subtotal", type: "number", lineAgg: { of: "lines", measure: "sum(qty)" } });
    expect(errorCodes(raw)).toContain("LINE_AGG_ON_LINE");
  });

  it("mark required ⇒ FIELD REQUIRD SYSTEM SUPPLIED (system feed without user access)", () => {
    const raw = purchaseOrder();
    raw.fields[3] = {
      key: "totalAmount",
      label: "Amount",
      type: "money",
      required: true,
      lineAgg: { of: "lines", measure: "sum(amount)" },
    };
    expect(errorCodes(raw)).toContain("FIELD_REQUIRED_SYSTEM_SUPPLIED");
  });

  it("the model shape is clean.", () => {
    expect(errorCodes(purchaseOrder())).toEqual([]);
  });
});

describe("it's not a system contribution.", () => {
  it("lineAgg can keep an account -- that's why it has to go down.", () => {
    // the ap reserve in the template takes {talAmount} (a lineAgg field)
    expect(errorCodes(purchaseOrder())).not.toContain("EFFECT_AMOUNT_NOT_STORED");
  });

  it("⇒EFFECT AMOUNT NOT STORED", () => {
    const raw = purchaseOrder();
    raw.fields[3] = {
      key: "totalAmount",
      label: "Amount",
      type: "money",
      // count and leave no column when searching: keeping it equals writing a number that can be recalculated at any time into a table that will not change Accounts
      derive: { kind: "rollup", from: "receipt", match: "orderId", measure: "sum(amount)" },
    };
    expect(errorCodes(raw)).toContain("EFFECT_AMOUNT_NOT_STORED");
  });

  it("there's a column but not a number.", () => {
    // The verdict was relaxed from the system Supplied to hasColumn.`auto` Non-value fields of this type with columns
    // we're in the release, we're gonna need a second gate. I'm going to have to add one.
    // the normal string field is not a system feed, and the old rule doesn't say a word.
    // Not until the first execution. `fieldNumber` Blow it up. It's in the form of "the whole side is not available."
    const raw = purchaseOrder();
    const approve = (raw.lifecycle.transitions as { code: string; effects?: { amount: string }[] }[])[0];
    const effect = approve?.effects?.[0];
    if (!effect) throw new Error("the sample approve edge has no effects");
    effect.amount = "{code}";
    expect(errorCodes(raw)).toContain("EFFECT_AMOUNT_NOT_NUMERIC");
  });
});

describe("eFFECT AMOUNT SOURCE EDITABLE — The amount released was not the same number as it was.", () => {
  it("we'll be fined after the check.", () => {
    const raw = purchaseOrder();
    // "Awaiting Receipt" lets the details loose: it looks like it's allowed to be changed, actually, to an opening already hanging on the supplier's head.
    (raw.lifecycle.statuses as { key: string; label: string; editable?: string; editableFields?: string[] }[])[1] = {
      key: "pending",
      label: "awaitingReceipt",
      editable: "whitelist",
      editableFields: ["lines"],
    };
    expect(errorCodes(raw)).toContain("EFFECT_AMOUNT_SOURCE_EDITABLE");
  });

  it("let go of the situation after rolling back.", () => {
    const raw = purchaseOrder();
    // draft is the end point of unapprove, defaulted: "full," fine... It's legal.
    expect(errorCodes(raw)).not.toContain("EFFECT_AMOUNT_SOURCE_EDITABLE");
  });
});

describe("request: Write path, feed, interface share", () => {
  const fields = fieldsOf(purchaseOrder());

  it("normal column sum/ formulae column sum/ count", () => {
    const totals = computeLineAggregates(fields, {
      lines: [
        { productId: "p1", qty: 200, price: 4.5 },
        { productId: "p2", qty: 60, price: 0.85 },
      ],
    });
    expect(totals["totalQty"]).toBe(260);
    // formula rows do not fall in the library, resizing by declaration: 200 x 4.5 + 60 x 0.85
    expect(totals["totalAmount"]).toBe(951);
    expect(totals["lineCount"]).toBe(2);
  });

  it("the sum of the blanks is 0 -- it's arithmetic, not an undervalue pocket. Bottom", () => {
    expect(computeLineAggregates(fields, { lines: [] })).toEqual({ totalQty: 0, totalAmount: 0, lineCount: 0 });
  });

  it("key does not exist = this is a zero line from the table.", () => {
    expect(computeLineAggregates(fields, {})).toEqual({ totalQty: 0, totalAmount: 0, lineCount: 0 });
  });

  it("unrecorded entries, not zero", () => {
    // qty filled in, Price didn't fill out the amount of this line **, not zero.
    // if you press 0, it'll be small, and that number looks perfectly normal.
    const totals = computeLineAggregates(fields, {
      lines: [
        { productId: "p1", qty: 200, price: 4.5 },
        { productId: "p2", qty: 60, price: null },
      ],
    });
    expect(totals["totalQty"]).toBe(260);
    expect(totals["totalAmount"]).toBe(900);
  });

  it("numeric column via JSON counts as the string arrives", () => {
    const totals = computeLineAggregates(fields, { lines: [{ productId: "p1", qty: "200.000000", price: "4.5000" }] });
    expect(totals["totalQty"]).toBe(200);
    expect(totals["totalAmount"]).toBe(900);
  });

  it("rounded by the accuracy of the load field - the same as the column precision of the table", () => {
    // money Four: 0.1 + 0.2 The floating tails of that type are not allowed in the column, otherwise the total table is one line by line min
    const totals = computeLineAggregates(fields, {
      lines: [
        { productId: "p1", qty: 1, price: 0.1 },
        { productId: "p2", qty: 1, price: 0.2 },
      ],
    });
    expect(totals["totalAmount"]).toBe(0.3);
  });

  it("it's worth it or nothing.", () => {
    expect(() => computeLineAggregates(fields, { lines: [{ productId: "p1", qty: "two hundred", price: 1 }] })).toThrow();
  });

  it("soumLineColumn is the addition to the table head together with the details.", () => {
    const lines = fields.find((f) => f.key === "lines");
    const amount = lines?.fields?.find((f) => f.key === "amount");
    if (!amount) throw new Error("the sample has no amount column on the lines");
    const rows = [
      { qty: 200, price: 4.5 },
      { qty: 60, price: 0.85 },
    ];
    // the table foot must show the same number as the header.
    expect(sumLineColumn(amount, rows)).toBe(951);
    expect(computeLineAggregates(fields, { lines: rows })["totalAmount"]).toBe(951);
  });
});
