import { describe, expect, it } from "vitest";
import { normalizeFixtureModule } from "../src/index.js";

function moduleWith(code: string, fields: readonly unknown[] = [{ key: "productId", label: "Product", type: "string" }]): unknown {
  return {
    code,
    label: "Test module",
    domain: "test",
    fields,
    lifecycle: {
      statuses: [{ key: "active", label: "Active", initial: true, terminal: true, editable: "full" }],
      transitions: [],
    },
    views: { list: { columns: ["productId"] } },
  };
}

const ILLEGAL_COORDINATES = [
  "sales.order",
  "sales:order",
  "sales/order",
  "sales#order",
  "sales-order",
  "sales_order",
  "SalesOrder",
  "1salesOrder",
  " salesOrder",
] as const;

describe("module code and Field.key share one closed coordinate syntax", () => {
  it("accepts the lowerCamel ASCII this repo uses, and allows a digit after the first character", () => {
    expect(normalizeFixtureModule(moduleWith("salesOrder2")).code).toBe("salesOrder2");
  });

  it.each(ILLEGAL_COORDINATES)("module code rejects %s", (code) => {
    expect(() => normalizeFixtureModule(moduleWith(code))).toThrow(/module\.code[\s\S]*lowerCamel ASCII/);
  });

  it.each(ILLEGAL_COORDINATES)("a header Field.key rejects %s", (key) => {
    expect(() => normalizeFixtureModule(moduleWith("salesOrder", [{ key, label: "Product", type: "string" }]))).toThrow(
      /fields\[0\]\.key[\s\S]*lowerCamel ASCII/,
    );
  });

  it.each(ILLEGAL_COORDINATES)("a line Field.key rejects %s", (key) => {
    expect(() =>
      normalizeFixtureModule(
        moduleWith("salesOrder", [
          {
            key: "lines",
            label: "Lines",
            type: "subtable",
            ref: "salesOrderLine",
            fields: [{ key, label: "Product", type: "string" }],
          },
        ]),
      ),
    ).toThrow(/fields\.lines\.fields\[0\]\.key[\s\S]*lowerCamel ASCII/);
  });
});
