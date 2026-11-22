// ---------------------------------------------------------------------------
// Empty watch by front row`headerEmptyFill`）
//
// the only danger to this ability is not "not bringing out," but ** to fill the unpaved surface**: press the watch head.
// the filter is a narrow list of candidates, not "select the head of the table and turn the entire page." Client receipts / procurement receipts
// it looks exactly the same, and its implicit entry into force adds drafts. That's why all the nails are "not laid without a statement."
// this post is part of our special coverage Syria Protests 2011.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  SchemaError,
  headerEmptyFillSitesOf,
  normalizeField,
  normalizeFixtureModule,
  validateModule,
  type ModuleSchema,
} from "../src/index.js";

const completionRef = (extra: Record<string, unknown> = {}): unknown => ({
  key: "productionCompletionId",
  label: "Finished supply",
  type: "ref",
  ref: "productionCompletion",
  required: true,
  refFilter: { productionOrderId: { from: "$bill.productionOrderId" }, status: "Active" },
  ...extra,
});

function moduleWith(lines: readonly unknown[], extraHeader: readonly unknown[] = []): ModuleSchema {
  return normalizeFixtureModule({
    code: "fillProbe",
    label: "Row-fill probe",
    domain: "production",
    numbering: { prefix: "FP", seqScope: "day" },
    fields: [
      { key: "code", label: "Code", type: "string", primary: true, auto: true },
      { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", required: true },
      ...extraHeader,
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "fillProbeLine",
        fields: lines,
      },
    ],
    lifecycle: {
      statuses: [{ key: "pendingReview", label: "pendingReview", color: "amber", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
  });
}

const codesOf = (schema: ModuleSchema): readonly string[] =>
  validateModule(schema).errors.map((error) => error.code);

describe("declaration Shape", () => {
  it("headEmptyFill had a closed-key check.", () => {
    expect(() => normalizeField(completionRef({ headerEmptyFill: true }))).not.toThrow();
    expect(normalizeField(completionRef({ headerEmptyFill: true })).headerEmptyFill).toBe(true);
  });

  it("could not initialise Bonobo", () => {
    expect(normalizeField(completionRef()).headerEmptyFill).toBeUndefined();
  });

  it("only meaningful on ref", () => {
    expect(() =>
      normalizeField({ key: "qty", label: "Quantity", type: "number", headerEmptyFill: true }),
    ).toThrow(SchemaError);
  });
});

describe("declaring level semantic gates", () => {
  it("nothing is reported in normal form.", () => {
    expect(codesOf(moduleWith([completionRef({ headerEmptyFill: true })]))).toEqual([]);
  });

  it("table header ref rejected: no empty watch", () => {
    const schema = moduleWith(
      [{ key: "qty", label: "Quantity", type: "number" }],
      [{
        key: "warehouseId",
        label: "Warehouse",
        type: "ref",
        ref: "warehouse",
        headerEmptyFill: true,
        refFilter: { status: "active" },
      }],
    );
    expect(codesOf(schema)).toContain("HEADER_EMPTY_FILL_ON_HEADER");
  });

  it("no refFilter, no: or the whole tenant.", () => {
    expect(
      codesOf(moduleWith([{
        key: "productionCompletionId",
        label: "Finished supply",
        type: "ref",
        ref: "productionCompletion",
        required: true,
        headerEmptyFill: true,
      }])),
    ).toContain("HEADER_EMPTY_FILL_WITHOUT_FILTER");
  });

  it("it's only static.", () => {
    expect(
      codesOf(moduleWith([{
        key: "productionCompletionId",
        label: "Finished supply",
        type: "ref",
        ref: "productionCompletion",
        required: true,
        headerEmptyFill: true,
        refFilter: { status: "Active" },
      }])),
    ).toContain("HEADER_EMPTY_FILL_NO_BILL_OPERAND");
  });

  it("refFilter with $line. Reject: empty table does not have current line", () => {
    expect(
      codesOf(moduleWith([
        { key: "taskId", label: "Task", type: "ref", ref: "productionTask" },
        {
          key: "productionCompletionId",
          label: "Finished supply",
          type: "ref",
          ref: "productionCompletion",
          required: true,
          headerEmptyFill: true,
          refFilter: { productionTaskId: { from: "$line.taskId" } },
        },
      ])),
    ).toContain("HEADER_EMPTY_FILL_LINE_OPERAND");
  });

  it("maxRows: 1 Reject", () => {
    const schema = normalizeFixtureModule({
      code: "fillProbe",
      label: "Row-fill probe",
      domain: "production",
      numbering: { prefix: "FP", seqScope: "day" },
      fields: [
        { key: "code", label: "Code", type: "string", primary: true, auto: true },
        { key: "productionOrderId", label: "Production order", type: "ref", ref: "productionOrder", required: true },
        {
          key: "lines",
          label: "Lines",
          type: "subtable",
          ref: "fillProbeLine",
          maxRows: 1,
          fields: [completionRef({ headerEmptyFill: true })],
        },
      ],
      lifecycle: {
        statuses: [{ key: "pendingReview", label: "pendingReview", color: "amber", initial: true, terminal: true }],
        transitions: [],
      },
      views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [] },
    });
    expect(codesOf(schema)).toContain("HEADER_EMPTY_FILL_MAX_ROWS_ONE");
  });

  it("refLine rejected", () => {
    expect(
      codesOf(moduleWith([
        { key: "orderId", label: "Order", type: "ref", ref: "salesOrder", required: true },
        {
          key: "orderLineId",
          label: "Order line",
          type: "refLine",
          ref: "salesOrder",
          through: "lines",
          required: true,
        },
        completionRef({ headerEmptyFill: true }),
      ])),
    ).toContain("HEADER_EMPTY_FILL_REQUIRED_REFLINE");
  });

  it("two rows of a table, headerEmptyFil", () => {
    expect(
      codesOf(moduleWith([
        completionRef({ headerEmptyFill: true }),
        {
          key: "taskId",
          label: "Task",
          type: "ref",
          ref: "productionTask",
          required: true,
          headerEmptyFill: true,
          refFilter: { productionOrderId: { from: "$bill.productionOrderId" } },
        },
      ])),
    ).toContain("HEADER_EMPTY_FILL_MULTIPLE");
  });
});

describe("headEmptyFilleSitesof: no place without declaration Points", () => {
  it("only a visible switch, not on $bil.ref.", () => {
    const declared = moduleWith([completionRef({ headerEmptyFill: true })]);
    const inferred = moduleWith([completionRef()]);
    expect(headerEmptyFillSitesOf(declared.fields)).toEqual([
      expect.objectContaining({
        path: "lines.productionCompletionId",
        headerKeys: ["productionOrderId"],
      }),
    ]);
    expect(headerEmptyFillSitesOf(inferred.fields)).toEqual([]);
  });
});
