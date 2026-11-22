import { describe, expect, it } from "vitest";
import {
  checkNewBill,
  createFromEligibilitySitesOf,
  normalizeFixtureModule,
  type FinalLineRows,
  type ModuleSchema,
} from "../src/index.js";

const status = (key: string, initial = false) => ({
  key,
  label: key,
  color: "gray",
  initial,
  terminal: key === "done",
  editable: "full",
});

function source(code: string, through: string): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    fields: [
      { key: "code", type: "string" },
      { key: "remainingQty", type: "number" },
      {
        key: through,
        type: "subtable",
        ref: `${code}Line`,
        fields: [
          { key: "qty", type: "number" },
          { key: "remainingQty", type: "number" },
        ],
      },
    ],
    lifecycle: {
      statuses: [status("draft", true), status("open"), status("done")],
      transitions: [],
    },
    views: { list: { columns: ["code"] } },
  });
}

interface FlowSpec {
  readonly field: string;
  readonly source: string;
  readonly through: string;
  readonly sourceStatuses?: readonly string[];
  readonly sourceRemaining?: { readonly header?: string; readonly line: string };
  readonly declare?: boolean;
}

function target(code: string, flows: readonly FlowSpec[]): ModuleSchema {
  return normalizeFixtureModule({
    code,
    label: code,
    domain: "test",
    fields: [
      { key: "code", type: "string" },
      {
        key: "lines",
        type: "subtable",
        ref: `${code}Line`,
        fields: flows.map((flow) => ({
          key: flow.field,
          type: "refLine",
          ref: flow.source,
          through: flow.through,
        })),
      },
    ],
    lifecycle: {
      statuses: [status("draft", true), status("done")],
      transitions: [],
    },
    views: {
      list: { columns: ["code"] },
      createFrom: flows
        .filter((flow) => flow.declare !== false)
        .map((flow) => ({
          path: `lines.${flow.field}`,
          ...(flow.sourceStatuses === undefined ? {} : { sourceStatuses: flow.sourceStatuses }),
          ...(flow.sourceRemaining === undefined ? {} : { sourceRemaining: flow.sourceRemaining }),
        })),
    },
  });
}

function finalLines(schema: ModuleSchema, lines: FinalLineRows): FinalLineRows {
  const checked = checkNewBill(schema, {}, lines);
  if (!checked.ok) throw new Error(`test payload did not normalize: ${JSON.stringify(checked.issues)}`);
  return checked.lines;
}

describe("createFrom EligibilitySitesof: ultimately written to qualifying sites", () => {
  it("coordinated output status and balance from canonical state-framding without charge of surplus occupancy/consumption", () => {
    const order = source("order", "orderLines");
    const delivery = target("delivery", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceStatuses: ["open", "draft"],
      sourceRemaining: { header: "remainingQty", line: "orderLines.remainingQty" },
    }]);

    expect(
      createFromEligibilitySitesOf(
        [delivery, order],
        "delivery",
        finalLines(delivery, { lines: [{ orderLineId: "line-2" }] }),
      ),
    ).toEqual([{
      target: { module: "delivery", path: "lines.orderLineId" },
      source: { module: "order", through: "orderLines", lineId: "line-2" },
      sourceStatuses: ["draft", "open"],
      sourceRemaining: {
        header: {
          module: "order",
          level: "record",
          table: null,
          field: "remainingQty",
          path: "remainingQty",
        },
        line: {
          module: "order",
          level: "line",
          table: "orderLines",
          field: "remainingQty",
          path: "orderLines.remainingQty",
        },
      },
    }]);
  });

  it("multiple Qualifications for a Target Module Flow Find Source by Final Target Path Okay.", () => {
    const purchase = source("purchase", "purchaseLines");
    const sales = source("sales", "salesLines");
    const settlement = target("settlement", [
      {
        field: "salesLineId",
        source: "sales",
        through: "salesLines",
        sourceStatuses: ["open"],
      },
      {
        field: "purchaseLineId",
        source: "purchase",
        through: "purchaseLines",
        sourceRemaining: { header: "remainingQty", line: "purchaseLines.remainingQty" },
      },
    ]);

    const sites = createFromEligibilitySitesOf(
      [sales, settlement, purchase],
      "settlement",
      finalLines(settlement, {
        lines: [{ salesLineId: "sales-line-1" }, { purchaseLineId: "purchase-line-1" }],
      }),
    );
    expect(sites.map((site) => [site.target.path, site.source.module, site.source.through, site.source.lineId]))
      .toEqual([
        ["lines.purchaseLineId", "purchase", "purchaseLines", "purchase-line-1"],
        ["lines.salesLineId", "sales", "salesLines", "sales-line-1"],
      ]);
  });

  it("only the same eligible site for sourceremaining output", () => {
    const order = source("order", "orderLines");
    const delivery = target("delivery", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceRemaining: { line: "orderLines.remainingQty" },
    }]);

    expect(createFromEligibilitySitesOf(
      [order, delivery],
      "delivery",
      finalLines(delivery, { lines: [{ orderLineId: "line-1" }] }),
    )[0]?.sourceRemaining).toMatchObject({
      header: null,
      line: { module: "order", table: "orderLines", field: "remainingQty" },
    });
  });

  it("when using the same line again from the same source canonical", () => {
    const order = source("order", "orderLines");
    const delivery = target("delivery", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceStatuses: ["draft"],
    }]);
    const lines = finalLines(delivery, {
      lines: [
        { orderLineId: "line-1" },
        { orderLineId: "line-1" },
        { orderLineId: "line-2" },
      ],
    });

    expect(createFromEligibilitySitesOf([order, delivery], "delivery", lines).map((site) => site.source.lineId))
      .toEqual(["line-1", "line-2"]);
  });

  it("only believe that the final whole table replaces the payload, without retaining old sources in preparation or URL context Okay.", () => {
    const order = source("order", "orderLines");
    const delivery = target("delivery", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceStatuses: ["draft"],
    }]);
    const prepared = finalLines(delivery, { lines: [{ orderLineId: "prepared-line" }] });
    const replaced = finalLines(delivery, { lines: [{ orderLineId: "final-line" }, { orderLineId: null }] });

    expect(createFromEligibilitySitesOf([order, delivery], "delivery", prepared)[0]?.source.lineId)
      .toBe("prepared-line");
    expect(createFromEligibilitySitesOf([order, delivery], "delivery", replaced).map((site) => site.source.lineId))
      .toEqual(["final-line"]);
  });

  it("normal refLine, invalid file-from and empty", () => {
    const order = source("order", "orderLines");
    const ordinary = target("ordinary", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
    }]);
    const relationOnly = target("relationOnly", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceStatuses: ["draft"],
      declare: false,
    }]);

    expect(createFromEligibilitySitesOf(
      [order, ordinary, relationOnly],
      "ordinary",
      finalLines(ordinary, { lines: [{ orderLineId: "line-1" }] }),
    )).toEqual([]);
    expect(createFromEligibilitySitesOf(
      [order, ordinary, relationOnly],
      "relationOnly",
      finalLines(relationOnly, { lines: [{ orderLineId: "line-1" }] }),
    )).toEqual([]);
    expect(createFromEligibilitySitesOf(
      [order, ordinary, relationOnly],
      "ordinary",
      finalLines(ordinary, { lines: [{ orderLineId: null }] }),
    )).toEqual([]);
  });

  it("disabled catalog, nonline qualification entry and non-refLine value", () => {
    const order = source("order", "orderLines");
    const delivery = target("delivery", [{
      field: "orderLineId",
      source: "order",
      through: "orderLines",
      sourceStatuses: ["draft"],
    }]);
    // the table entry belt is still fail-fast.
    const remainingHeader = normalizeFixtureModule({
      code: "remainingHeader",
      label: "remainingHeader",
      domain: "test",
      fields: [{ key: "orderId", type: "ref", ref: "order" }],
      lifecycle: { statuses: [status("draft", true)], transitions: [] },
      views: {
        list: { columns: ["orderId"] },
        createFrom: [{ path: "orderId", sourceRemaining: { line: "lines.qty" } }],
      },
    });
    // the tablehead entrance belt is a pure display threshold and does not create a qualifying site - it is not thrown in error and does not produce a site.
    const gatedHeader = normalizeFixtureModule({
      code: "gatedHeader",
      label: "gatedHeader",
      domain: "test",
      fields: [{ key: "orderId", type: "ref", ref: "order" }],
      lifecycle: { statuses: [status("draft", true)], transitions: [] },
      views: {
        list: { columns: ["orderId"] },
        createFrom: [{ path: "orderId", sourceStatuses: ["draft"] }],
      },
    });

    expect(() => createFromEligibilitySitesOf([order, delivery], "missing", {}))
      .toThrow(/has no target module.*missing/);
    expect(() => createFromEligibilitySitesOf([delivery], "delivery", { lines: [] }))
      .toThrow(/unknown source module.*order|no source module.*order/);
    // the balance of the tablehead was stopped directly by a more proactive source Bindingsof (stratification fail-fast, no eligibility guard).
    expect(() => createFromEligibilitySitesOf([order, remainingHeader], "remainingHeader", {}))
      .toThrow(/cannot declare a source-line balance/);
    expect(createFromEligibilitySitesOf([order, gatedHeader], "gatedHeader", {})).toEqual([]);
    expect(() => createFromEligibilitySitesOf(
      [order, delivery],
      "delivery",
      { lines: [{ orderLineId: 42 }] } as never,
    )).toThrow(/must be a non-empty, already-trimmed refLine id/);
    expect(() => createFromEligibilitySitesOf(
      [order, delivery],
      "delivery",
      { lines: [{ orderLineId: " line-1 " }] } as never,
    )).toThrow(/must be a non-empty, already-trimmed refLine id/);
  });
});
