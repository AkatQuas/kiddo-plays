import { describe, expect, it } from "vitest";
import {
  applyLineDefaultFrom,
  checkNewBill,
  defaultFromOf,
  maxRowsOf,
  normalizeFixtureModule,
} from "../src/index.js";

function receiptLike(overrides: Record<string, unknown> = {}) {
  return normalizeFixtureModule({
    code: "tinyReceipt",
    label: "Collect",
    domain: "test",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "amount", label: "Amount collected", type: "money", required: true },
      {
        key: "allocations",
        label: "Apply receivable",
        type: "subtable",
        ref: "tinyReceiptLine",
        required: true,
        maxRows: 1,
        ...overrides,
        fields: [
          { key: "receivableId", label: "Receivable", type: "string" },
          { key: "amount", label: "Amount applied this time", type: "money", defaultFrom: { header: "amount" } },
        ],
      },
    ],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", color: "gray", initial: true, terminal: true, editable: "full" }],
      transitions: [],
    },
    views: {
      list: { columns: ["code", "amount"], filters: [], searchable: ["code"] },
      form: [{ title: "Basics", fields: ["code", "amount", "allocations"] }],
    },
  });
}

describe("maxRows / defaultFrom", () => {
  it("normalize readable maxRows and defaultForm", () => {
    const schema = receiptLike();
    const table = schema.fields.find((field) => field.key === "allocations");
    expect(maxRowsOf(table!)).toBe(1);
    expect(defaultFromOf(table!.fields!.find((field) => field.key === "amount")!)).toEqual({ header: "amount" });
  });

  it("write path beyond maxRows reportLINE MAX ROWS", () => {
    const checked = checkNewBill(
      receiptLike(),
      { code: "X", amount: 100 },
      { allocations: [{ receivableId: "r1", amount: 40 }, { receivableId: "r2", amount: 60 }] },
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.issues.some((issue) => issue.code === "LINE_MAX_ROWS")).toBe(true);
    }
  });

  it("write-off lines when the header amounts change", () => {
    const schema = receiptLike();
    const next = applyLineDefaultFrom(
      schema,
      "amount",
      { amount: 80 },
      { allocations: [{ receivableId: "r1", amount: null }] },
    );
    expect(next?.["allocations"]?.[0]?.["amount"]).toBe(80);
  });

  it("maxRows can't hang on to a watch.", () => {
    expect(() =>
      normalizeFixtureModule({
        code: "tiny",
        label: "x",
        domain: "test",
        fields: [{ key: "code", label: "Document number", type: "string", primary: true, maxRows: 1 }],
        lifecycle: {
          statuses: [{ key: "active", label: "Enabled", color: "green", initial: true, terminal: true, editable: "full" }],
          transitions: [],
        },
        views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
      }),
    ).toThrow(/maxRows is meaningful only on a subtable/);
  });
});
