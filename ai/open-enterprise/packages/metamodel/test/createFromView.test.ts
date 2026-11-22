import { describe, expect, it } from "vitest";
import { creationFlowsOf, normalizeFixtureModule, validateModule, type ModuleSchema } from "../src/index.js";

function target(createFrom: unknown): ModuleSchema {
  return normalizeFixtureModule({
    code: "delivery",
    label: "Shipment",
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "orderId", label: "Source order", type: "ref", ref: "order" },
      {
        key: "lines",
        label: "Shipment lines",
        type: "subtable",
        ref: "deliveryLine",
        fields: [
          { key: "orderLineId", label: "Source order line", type: "refLine", ref: "order", through: "lines" },
          { key: "sourceOrderId", label: "Source order", type: "ref", ref: "order" },
          { key: "qty", label: "Quantity", type: "number" },
        ],
      },
    ],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"] }, createFrom },
  });
}

function order(): ModuleSchema {
  return normalizeFixtureModule({
    code: "order",
    label: "Order",
    domain: "sales",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      {
        key: "lines",
        label: "Order lines",
        type: "subtable",
        ref: "orderLine",
        fields: [{ key: "qty", label: "Quantity", type: "number" }],
      },
    ],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }],
      transitions: [],
    },
    views: { list: { columns: ["code"] } },
  });
}

const errorCodes = (schema: ModuleSchema): readonly string[] =>
  validateModule(schema).errors.map((error) => error.code);

describe("views. CreateFrom shapes and semantics", () => {
  it("defaults to empty arrays; visible items only accept path/ label and labels to full", () => {
    expect(order().views.createFrom).toEqual([]);
    expect(target([{ path: "orderId" }, { path: "lines.orderLineId", label: "Ship by line" }]).views.createFrom)
      .toEqual([
        { path: "orderId", label: null, sourceStatuses: null, sourceRemaining: null },
        { path: "lines.orderLineId", label: "Ship by line", sourceStatuses: null, sourceRemaining: null },
      ]);
    expect(() => target([{ path: "orderId", source: "order" }])).toThrow(/source|unknown key|not allowed/);
    expect(() => target([{ path: "orderId" }, { path: "orderId" }])).toThrow(/declared "orderId" more than once/);
  });

  it("only ref or detail refLine, path/level/type for error", () => {
    expect(errorCodes(target([{ path: "code" }]))).toContain("VIEW_CREATE_FROM_HEADER_NOT_REF");
    expect(errorCodes(target([{ path: "missing" }]))).toContain("VIEW_CREATE_FROM_FIELD_UNKNOWN");
    expect(errorCodes(target([{ path: "orderId.any" }]))).toContain("VIEW_CREATE_FROM_TABLE_NOT_SUBTABLE");
    expect(errorCodes(target([{ path: "lines.qty" }]))).toContain("VIEW_CREATE_FROM_LINE_NOT_REF_LINE");
    expect(errorCodes(target([{ path: "lines.missing" }]))).toContain("VIEW_CREATE_FROM_LINE_UNKNOWN");
    expect(errorCodes(target([{ path: "lines.orderLineId.more" }]))).toContain("VIEW_CREATE_FROM_PATH_INVALID");
  });

  it("table entry accepts sourceStatuses as a display threshold, but rejects sourceremaining; both can be specified.", () => {
    // the table header's sourceStatuses are purely front-end display thresholds (list by line status button), not service-end eligibility sites,
    // so no more mistakes are made, and then the norm is retained.
    expect(errorCodes(target([{ path: "orderId", sourceStatuses: ["draft"] }])))
      .not.toContain("VIEW_CREATE_FROM_HEADER_ELIGIBILITY_UNSUPPORTED");
    expect(target([{ path: "orderId", sourceStatuses: ["draft"] }]).views.createFrom[0])
      .toMatchObject({ path: "orderId", sourceStatuses: ["draft"], sourceRemaining: null });
    // the remaining constant requirement is line-by-line, and the header entry is not available and is still wrong.
    expect(errorCodes(target([{
      path: "orderId",
      sourceRemaining: { header: "qty", line: "lines.qty" },
    }])))
      .toContain("VIEW_CREATE_FROM_HEADER_ELIGIBILITY_UNSUPPORTED");
    expect(target([{
      path: "lines.orderLineId",
      sourceStatuses: ["draft"],
      sourceRemaining: { header: "qty", line: "lines.qty" },
    }]).views.createFrom[0]).toMatchObject({
      sourceStatuses: ["draft"],
      sourceRemaining: { header: "qty", line: "lines.qty" },
    });
    expect(target([{
      path: "lines.orderLineId",
      sourceRemaining: { line: "lines.qty" },
    }]).views.createFrom[0]?.sourceRemaining).toEqual({ header: null, line: "lines.qty" });
    expect(() => target([{
      path: "lines.orderLineId",
      sourceRemaining: { header: "qty" },
    }])).toThrow(/sourceRemaining\.line/);
  });
});

describe("creationFlowsof: Reverse Discovery Visible Entry only", () => {
  it("source derived from field ref, header/specify layer, text with only one default", () => {
    const modules = [
      order(),
      target([{ path: "orderId" }, { path: "lines.orderLineId", label: "Select order lines to ship" }]),
    ];
    expect(creationFlowsOf(modules, "order")).toEqual([
      {
        source: "order",
        target: "delivery",
        targetLabel: "Shipment",
        path: "orderId",
        level: "header",
        label: "Create Shipment",
        sourceStatuses: null,
        sourceRemaining: null,
      },
      {
        source: "order",
        target: "delivery",
        targetLabel: "Shipment",
        path: "lines.orderLineId",
        level: "line",
        label: "Select order lines to ship",
        sourceStatuses: null,
        sourceRemaining: null,
      },
    ]);
  });

  it("normal relation does not create the entry without a declaration; module table opening", () => {
    expect(creationFlowsOf([order(), target([])], "order")).toEqual([]);
    expect(() => creationFlowsOf([target([{ path: "orderId" }])], "order")).toThrow(/no source module/);
    expect(() => creationFlowsOf([order()], "missing")).toThrow(/no source module/);
  });
});
