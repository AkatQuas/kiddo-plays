import { describe, expect, it } from "vitest";
import { availableTransitions, normalizeFixtureModule, seedTransitionParams, visibleTransitions } from "../src/index.js";

const module = normalizeFixtureModule({
  code: "orderLike",
  label: "Order",
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
      { code: "ship", from: "awaitingShipment", to: "awaitingShipment", action: "Ship", remaining: "lines.openQty" },
      { code: "close", from: "awaitingShipment", to: "awaitingShipment", action: "Close" },
    ],
  },
  views: { list: { columns: ["code"] }, form: [] },
});

describe("weisibleTrancitions press the spare collection button", () => {
  it("status out is still activeTransions; ship disappears from visible collections when open at 0", () => {
    expect(availableTransitions(module, "awaitingShipment").map((edge) => edge.code)).toEqual(["ship", "close"]);
    expect(
      visibleTransitions(module, "awaitingShipment", {
        header: { status: "awaitingShipment" },
        lines: { lines: [{ openQty: 0 }, { openQty: 0 }] },
      }).map((edge) => edge.code),
    ).toEqual(["close"]);
    expect(
      visibleTransitions(module, "awaitingShipment", {
        header: { status: "awaitingShipment" },
        lines: { lines: [{ openQty: 0 }, { openQty: 2 }] },
      }).map((edge) => edge.code),
    ).toEqual(["ship", "close"]);
  });

  it("the missing data is not projected as finished", () => {
    expect(
      visibleTransitions(module, "awaitingShipment", { header: { status: "awaitingShipment" } }).map((edge) => edge.code),
    ).toEqual(["ship", "close"]);
  });
});

describe("seedTranstionParams by Statement Hands.", () => {
  it("open 0 lines do not enter bullet windows, this default is open", () => {
    const withSeed = normalizeFixtureModule({
      code: "orderLike",
      label: "Order",
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
            action: "Ship",
            remaining: "lines.openQty",
            params: [
              {
                key: "shipLines",
                label: "This shipment",
                type: "billLines",
                required: false,
                lineField: {
                  key: "shipLines",
                  label: "This shipment",
                  type: "subtable",
                  ref: "draft",
                  required: false,
                  fields: [
                    { key: "orderLineId", label: "Order line", type: "string", required: true },
                    { key: "openQty", label: "Open quantity", type: "number", required: true },
                    { key: "qty", label: "This time", type: "number", required: true },
                  ],
                },
                seed: {
                  from: "lines",
                  columns: { orderLineId: "id", openQty: "openQty", qty: "openQty" },
                  skipNonPositive: "openQty",
                },
              },
            ],
          },
        ],
      },
      views: { list: { columns: ["code"] }, form: [] },
    });
    const params = seedTransitionParams(withSeed.lifecycle.transitions[0]!, {
      header: {},
      lines: {
        lines: [
          { id: "l1", openQty: 4 },
          { id: "l2", openQty: 0 },
        ],
      },
    });
    expect(params).toEqual({
      shipLines: [{ orderLineId: "l1", openQty: 4, qty: 4 }],
    });
  });
});
