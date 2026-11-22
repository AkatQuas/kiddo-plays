import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, type BillIssue, type ModuleSchema } from "@open-erp/metamodel";
import { applyPushBillLines, buildPushDraft, persistablePushDraft, remapPushIssues, splitPushDrafts } from "../src/index.js";

function moduleOf(code: string, tables: readonly unknown[]): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    fields: [{ key: "code", type: "string", primary: true }, ...tables],
    lifecycle: { statuses: [{ key: "active", initial: true }], transitions: [] },
    views: { list: { columns: ["code"] }, form: [] },
  });
}

describe("visible Movement Map for builtPushDraft", () => {
  it("only copy a pair of aliases of the declaration and give the same pair to the oe reference writing party", () => {
    const source = moduleOf("source", [
      { key: "ignored", type: "subtable", ref: "ignoredLine", fields: [{ key: "qty", type: "number" }] },
      { key: "requestLines", type: "subtable", ref: "requestLine", fields: [{ key: "qty", type: "number" }] },
    ]);
    const target = moduleOf("target", [
      { key: "operationLines", type: "subtable", ref: "operationLine", fields: [{ key: "qty", type: "number" }] },
      { key: "ignored", type: "subtable", ref: "targetIgnoredLine", fields: [{ key: "qty", type: "number" }] },
    ]);

    const draft = buildPushDraft(source, target, {
      id: "source-1",
      revision: 1,
      header: { code: "SRC-1" },
      lines: {
        ignored: [{ id: "ignored-1", qty: 99 }],
        requestLines: [{ id: "request-1", qty: 8 }],
      },
    }, null, { source: "requestLines", target: "operationLines" });

    expect(draft.lines).toEqual({ operationLines: [{ qty: 8 }] });
    expect(draft.lineLink).toEqual({ sourceKey: "requestLines", targetKey: "operationLines" });
  });

  it("plannerSupplied's missing should not be misappropriated from the same name section", () => {
    const source = normalizeFixtureModule({
      code: "ordinarySource",
      label: "ordinary source",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        { key: "frozenPlanValue", label: "source same-name value", type: "number" },
      ],
      lifecycle: { statuses: [{ key: "active", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const target = normalizeFixtureModule({
      code: "plannerTarget",
      label: "Planner target",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        { key: "frozenPlanValue", label: "frozen plan value", type: "number", required: true, plannerSupplied: true },
      ],
      lifecycle: { statuses: [{ key: "active", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const draft = buildPushDraft(source, target, {
      id: "source-1",
      revision: 1,
      header: { code: "SRC-1", frozenPlanValue: 8 },
      lines: {},
    }, null);
    expect(draft.header).not.toHaveProperty("frozenPlanValue");

    const issue: BillIssue = {
      path: "frozenPlanValue",
      label: "frozen plan value",
      code: "REQUIRED_BLANK",
      message: "frozen plan value is required",
    };
    const [remapped] = remapPushIssues(source, target, [issue]);
    expect(remapped?.path).toBe("");
    expect(remapped?.label).toContain('while pushing "Planner target"');
    expect(remapped?.message).toContain("this bill has no matching place to edit");
  });
});

describe("pensistable PushDraft Snapshot, plain", () => {
  it("write to remove snapshot, keep source list references", () => {
    const target = normalizeFixtureModule({
      code: "productionOrderLike",
      label: "production order",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        { key: "salesOrderId", label: "source sales order", type: "ref", ref: "salesOrderLike" },
        {
          key: "salesOrderRemark",
          label: "sales order remark",
          type: "text",
          pushFrom: "remark",
          snapshot: { from: "salesOrderLike", match: "salesOrderId", through: null, field: "remark", optional: true },
        },
      ],
      lifecycle: { statuses: [{ key: "active", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const draft = {
      header: { salesOrderId: "so-1", salesOrderRemark: "customer rush" },
      lines: {},
      lineLink: null,
    };
    const persist = persistablePushDraft(target, draft);
    expect(persist.header["salesOrderRemark"]).toBeUndefined();
    expect(persist.header["salesOrderId"]).toBe("so-1");
  });
});

describe("applyPushBillLines overwrite this number", () => {
  it("send it open when there's no details. Cover it and drop it.", () => {
    const source = normalizeFixtureModule({
      code: "salesOrderLike",
      label: "sales order",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "orderLine",
          fields: [
            { key: "qty", type: "number" },
            { key: "openQty", type: "number" },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "awaitingShipment", initial: true }],
        transitions: [
          {
            code: "ship",
            from: "awaitingShipment",
            to: "awaitingShipment",
            action: "ship",
            push: "deliveryLike",
            params: [
              {
                key: "shipLines",
                label: "this shipment lines",
                type: "billLines",
                required: false,
                lineField: {
                  key: "shipLines",
                  label: "this shipment lines",
                  type: "subtable",
                  ref: "shipDraft",
                  required: false,
                  fields: [
                    { key: "orderLineId", label: "order line", type: "string", required: true },
                    { key: "qty", label: "this time", type: "number", required: true },
                  ],
                },
              },
            ],
          },
        ],
      },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const target = normalizeFixtureModule({
      code: "deliveryLike",
      label: "delivery note",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "deliveryLine",
          fields: [
            { key: "orderLineId", type: "refLine", ref: "salesOrderLike", through: "lines", required: true },
            { key: "qty", type: "number", required: true },
          ],
        },
      ],
      lifecycle: { statuses: [{ key: "draft", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const record = {
      id: "so-1",
      revision: 1,
      header: { code: "SO-1" },
      lines: {
        lines: [
          { id: "l1", qty: 10, openQty: 10 },
          { id: "l2", qty: 8, openQty: 8 },
        ],
      },
    };
    const draft = buildPushDraft(source, target, record, null);
    const edge = source.lifecycle.transitions[0]!;
    const defaults = applyPushBillLines(source, target, edge, record, draft, {});
    expect(defaults.draft.lines["lines"]?.map((row) => row["qty"])).toEqual([10, 8]);

    const partial = applyPushBillLines(source, target, edge, record, draft, {
      shipLines: [
        { orderLineId: "l1", qty: 3 },
        { orderLineId: "l2", qty: 0 },
      ],
    });
    expect(partial.draft.lines["lines"]).toEqual([{ orderLineId: "l1", qty: 3 }]);
    expect(partial.sourceRows).toHaveLength(1);
  });

  it("the same line of orders was split into multiple rows, total, more than the remainder rejected", () => {
    const source = normalizeFixtureModule({
      code: "salesOrderLike",
      label: "sales order",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "orderLine",
          fields: [
            { key: "qty", type: "number" },
            { key: "openQty", type: "number" },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "awaitingShipment", initial: true }],
        transitions: [
          {
            code: "ship",
            from: "awaitingShipment",
            to: "awaitingShipment",
            action: "ship",
            push: "deliveryLike",
            params: [
              {
                key: "shipLines",
                label: "this shipment lines",
                type: "billLines",
                required: false,
                lineField: {
                  key: "shipLines",
                  label: "this shipment lines",
                  type: "subtable",
                  ref: "shipDraft",
                  required: false,
                  fields: [
                    { key: "orderLineId", label: "order line", type: "string", required: true },
                    { key: "qty", label: "this time", type: "number", required: true },
                  ],
                },
              },
            ],
          },
        ],
      },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const target = normalizeFixtureModule({
      code: "deliveryLike",
      label: "delivery note",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "deliveryLine",
          fields: [
            { key: "orderLineId", type: "refLine", ref: "salesOrderLike", through: "lines", required: true },
            { key: "qty", type: "number", required: true },
          ],
        },
      ],
      lifecycle: { statuses: [{ key: "draft", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const record = {
      id: "so-1",
      revision: 1,
      header: { code: "SO-1" },
      lines: { lines: [{ id: "l1", qty: 10, openQty: 10 }] },
    };
    const draft = buildPushDraft(source, target, record, null);
    const edge = source.lifecycle.transitions[0]!;
    expect(() =>
      applyPushBillLines(source, target, edge, record, draft, {
        shipLines: [
          { orderLineId: "l1", qty: 6 },
          { orderLineId: "l1", qty: 6 },
        ],
      }),
    ).toThrow(/available remaining quantity/);

    const merged = applyPushBillLines(source, target, edge, record, draft, {
      shipLines: [
        { orderLineId: "l1", qty: 3 },
        { orderLineId: "l1", qty: 4 },
      ],
    });
    expect(merged.draft.lines["lines"]).toEqual([{ orderLineId: "l1", qty: 7 }]);
    expect(merged.sourceRows).toHaveLength(1);
  });
  /**
   * A single sheet can have ** more than one surplus**. The sales order's "disbursement surplus" is `openQty`,
   * And the "transferable surplus" is to be removed from the part that has been diverted - the same article `openQty`
   * Can't serve either side. The ceiling was therefore declared on this side** `remaining` Columns.
   *
   * failure to do so: 1,000 orders are re-produced, 1,000 can then be rotated.
   *it's still 1000, because none of it has yet been delivered, and the workshop is doing twice as much work and every sheet is legal.
   */
  it("🔴 Maximum by remaining column of this edge declared unwritten openQty", () => {
    const source = normalizeFixtureModule({
      code: "salesOrderLike",
      label: "sales order",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "orderLine",
          fields: [
            { key: "qty", type: "number" },
            { key: "openQty", type: "number" },
            { key: "openProductionQty", type: "number" },
          ],
        },
      ],
      lifecycle: {
        statuses: [{ key: "awaitingShipment", initial: true }],
        transitions: [
          {
            code: "toProduction",
            from: "awaitingShipment",
            to: "awaitingShipment",
            action: "to production",
            push: "productionLike",
            // the rest of it is "transferable production" instead of "open volume".
            remaining: "lines.openProductionQty",
            params: [
              {
                key: "productionLines",
                label: "this production transfer lines",
                type: "billLines",
                required: false,
                lineField: {
                  key: "productionLines",
                  label: "this production transfer lines",
                  type: "subtable",
                  ref: "productionDraft",
                  required: false,
                  fields: [
                    { key: "salesOrderLineId", label: "order line", type: "string", required: true },
                    { key: "qty", label: "this time", type: "number", required: true },
                  ],
                },
              },
            ],
          },
        ],
      },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const target = normalizeFixtureModule({
      code: "productionLike",
      label: "production order",
      domain: "test",
      fields: [
        { key: "code", type: "string", primary: true },
        {
          key: "lines",
          type: "subtable",
          ref: "productionLine",
          fields: [
            { key: "salesOrderLineId", type: "refLine", ref: "salesOrderLike", through: "lines", required: true },
            { key: "qty", type: "number", required: true },
          ],
        },
      ],
      lifecycle: { statuses: [{ key: "draft", initial: true }], transitions: [] },
      views: { list: { columns: ["code"] }, form: [] },
    });
    // none of them have been shipped yet, but seven have been turned over.
    const record = {
      id: "so-1",
      revision: 1,
      header: { code: "SO-1" },
      lines: { lines: [{ id: "l1", qty: 10, openQty: 10, openProductionQty: 3 }] },
    };
    const draft = buildPushDraft(source, target, record, null);
    const edge = source.lifecycle.transitions[0]!;

    // 🔴 Critical assertion: 4 > extensible 3 is rejected. The old realization of writing dead openQty will be released to 10.
    expect(() =>
      applyPushBillLines(source, target, edge, record, draft, {
        productionLines: [{ salesOrderLineId: "l1", qty: 4 }],
      }),
    ).toThrow(/available remaining quantity 3/);

    // by default, without detail, not by shipment opening
    const defaulted = applyPushBillLines(source, target, edge, record, draft, {});
    expect(defaulted.draft.lines["lines"]).toEqual([{ salesOrderLineId: "l1", qty: 3 }]);

    // just turn around: this is the 300 in 1000. Yes.
    const partial = applyPushBillLines(source, target, edge, record, draft, {
      productionLines: [{ salesOrderLineId: "l1", qty: 2 }],
    });
    expect(partial.draft.lines["lines"]).toEqual([{ salesOrderLineId: "l1", qty: 2 }]);
  });
});

describe("conversion by line splitting: maxRows 1 + line factory falls to the top", () => {
  const source = normalizeFixtureModule({
    code: "salesOrderLike",
    label: "sales order",
    domain: "test",
    fields: [
      { key: "code", type: "string", primary: true },
      {
        key: "lines",
        type: "subtable",
        ref: "orderLine",
        fields: [
          { key: "productId", type: "ref", ref: "product" },
          { key: "qty", type: "number" },
          { key: "openProductionQty", type: "number" },
        ],
      },
    ],
    lifecycle: {
      statuses: [{ key: "awaitingShipment", initial: true }],
      transitions: [
        {
          code: "toProduction",
          from: "awaitingShipment",
          to: "awaitingShipment",
          action: "to production",
          push: "productionLike",
          remaining: "lines.openProductionQty",
          params: [
            {
              key: "productionLines",
                  label: "this production transfer lines",
              type: "billLines",
              required: false,
              lineField: {
                key: "productionLines",
                label: "this production transfer lines",
                type: "subtable",
                ref: "productionDraft",
                required: false,
                fields: [
                  { key: "salesOrderLineId", label: "order line", type: "string", required: true },
                  { key: "qty", label: "this time", type: "number", required: true },
                  { key: "productionOrgId", label: "production plant", type: "ref", ref: "orgUnit", required: true },
                ],
              },
            },
          ],
        },
      ],
    },
    views: { list: { columns: ["code"] }, form: [] },
  });
  const target = normalizeFixtureModule({
    code: "productionLike",
    label: "production order",
    domain: "test",
    fields: [
      { key: "code", type: "string", primary: true },
      { key: "productionOrgId", label: "production plant", type: "ref", ref: "orgUnit" },
      {
        key: "lines",
        type: "subtable",
        ref: "productionLine",
        maxRows: 1,
        fields: [
          { key: "salesOrderSourceId", type: "ref", ref: "salesOrderLike", hidden: true },
          { key: "salesOrderLineId", type: "refLine", ref: "salesOrderLike", through: "lines", required: true },
          { key: "productId", type: "ref", ref: "product" },
          { key: "qty", type: "number", required: true },
        ],
      },
    ],
    lifecycle: { statuses: [{ key: "pendingReview", initial: true }], transitions: [] },
    views: { list: { columns: ["code"] }, form: [] },
  });
  const record = {
    id: "so-1",
    revision: 1,
    header: { code: "SO-1" },
    lines: {
      lines: [
        { id: "l1", productId: "p-a", qty: 10, openProductionQty: 10 },
        { id: "l2", productId: "p-b", qty: 8, openProductionQty: 8 },
      ],
    },
  };

  it("two rows split into two sheets, each with its own factory.", () => {
    const draft = buildPushDraft(source, target, record, null);
    const edge = source.lifecycle.transitions[0]!;
    const applied = applyPushBillLines(source, target, edge, record, draft, {
      productionLines: [
        { salesOrderLineId: "l1", qty: 10, productionOrgId: "factory-sh" },
        { salesOrderLineId: "l2", qty: 8, productionOrgId: "factory-hz" },
      ],
    });
    const chunks = splitPushDrafts(target, applied);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.draft.header["productionOrgId"]).toBe("factory-sh");
    expect(chunks[1]?.draft.header["productionOrgId"]).toBe("factory-hz");
    expect(chunks[0]?.draft.lines["lines"]).toEqual([{ salesOrderLineId: "l1", productId: "p-a", qty: 10 }]);
    expect(chunks[1]?.draft.lines["lines"]).toEqual([{ salesOrderLineId: "l2", productId: "p-b", qty: 8 }]);
  });

  it("there's a lot of people who don't pick a factory. Let's go.", () => {
    const draft = buildPushDraft(source, target, record, null);
    const edge = source.lifecycle.transitions[0]!;
    expect(() =>
      applyPushBillLines(source, target, edge, record, draft, {
        productionLines: [{ salesOrderLineId: "l1", qty: 10 }],
      }),
    ).toThrow(/production plant/);
  });
});
