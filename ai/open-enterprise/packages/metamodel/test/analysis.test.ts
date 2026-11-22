import { describe, expect, it } from "vitest";
import { defineFixtureModule, QueryInputError, resolveAnalysisField } from "../src/index.js";

const module = defineFixtureModule({
  code: "order",
  label: "Order",
  domain: "demo",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
    { key: "amount", label: "Amount", type: "money", required: true },
    // 🔴 It's named after the detail, and it's real form.
    // it's called the same project Id. They don't string after the prefix divides the two layers, but it depends on the example below.
    // i don't think so.
    { key: "productId", label: "Main product", type: "ref", ref: "product" },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "orderLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "price", label: "Unit price", type: "money", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
    transitions: [],
  },
  views: {
    list: { columns: ["code", "customerId", "amount"], filters: ["status"], searchable: ["code"] },
    form: [{ title: "Content", fields: ["code", "customerId", "amount", "lines"] }],
  },
});

// name space —
//
// 🔴 This group is nailed to one thing: **analysis and query are the same way**.
// Before `through` Word, the field name space is changed to "the nudity of the schedule" and the square field is called. First Name
// There's only one source...`module_describe` Queryable, it's always written in detail. `lines.qty`。
// So the same call was made. `query.where` Use `lines.planArrivalDate` Adopted
// Analyse side applications `lines.productId` It was rejected (10 times in a series of collisions.
// and the header, through which the whole dimension is out of space - "Customs by Client" cannot be written.

describe("the field name of analysis is the same as the word query", () => {
  it("critical error return stable", () => {
    const error = (() => {
      try {
        resolveAnalysisField(module, null, "lines.productId", "analysis.dimensions[0]");
      } catch (caught) {
        return caught;
      }
      throw new Error("expected rejection");
    })();
    expect(error).toBeInstanceOf(QueryInputError);
    expect(error).toMatchObject({
      code: "ANALYSIS_LINE_FIELD_REQUIRES_THROUGH",
      path: "analysis.dimensions[0]",
      correctUsage: expect.stringContaining('"through":"lines"'),
    });
  });

  it("through: a line with prefix and a header with nudity key, which can be used in combination", () => {
    expect(resolveAnalysisField(module, "lines", "customerId", "t")).toEqual({
      layer: "header",
      key: "customerId",
      type: "ref",
    });
    expect(resolveAnalysisField(module, "lines", "lines.productId", "t")).toEqual({
      layer: "line",
      key: "productId",
      type: "ref",
    });
    expect(resolveAnalysisField(module, "lines", "lines.qty", "t")).toEqual({
      layer: "line",
      key: "qty",
      type: "number",
    });
  });

  it("🔴 Header dimensions x Detailed indicators: only particle size determined, not naming space determined", () => {
    expect(resolveAnalysisField(module, "lines", "customerId", "t").layer).toBe("header");
  });

  it("platform field is also headline in detail - line does not have its own status and creator", () => {
    expect(resolveAnalysisField(module, "lines", "status", "t")).toEqual({
      layer: "header",
      key: "status",
      type: "enum",
    });
  });

  it("🔴 Naked lines are rejected and errors are given directly to correct -- no two-way acceptance", () => {
    expect(() => resolveAnalysisField(module, "lines", "qty", "t")).toThrow(/line table/);
  });

  it("🔴 Lines.productId is the headline, lines.producId is the line", () => {
    expect(resolveAnalysisField(module, "lines", "productId", "t")).toEqual({
      layer: "header",
      key: "productId",
      type: "ref",
    });
    expect(resolveAnalysisField(module, "lines", "lines.productId", "t")).toEqual({
      layer: "line",
      key: "productId",
      type: "ref",
    });
  });

  it("it says in the header analysis that the line was rejected and that it was going to pass through.", () => {
    expect(() => resolveAnalysisField(module, null, "lines.productId", "t")).toThrow(/through/);
  });

  it("the list to which the path is directed is rejected if it is not consistent with the one-size-size-fits-all list.", () => {
    const twoTables = defineFixtureModule({
      code: "orderTwo",
      label: "An order with two line tables",
      domain: "demo",
      fields: [
        { key: "code", label: "Document number", type: "string", required: true, primary: true },
        {
          key: "lines",
          label: "Product lines",
          type: "subtable",
          ref: "orderTwoLine",
          fields: [{ key: "qty", label: "Quantity", type: "number" }],
        },
        {
          key: "fees",
          label: "Expense lines",
          type: "subtable",
          ref: "orderTwoFee",
          fields: [{ key: "amount", label: "Amount", type: "money" }],
        },
      ],
      lifecycle: {
        statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
        transitions: [],
      },
      views: {
        list: { columns: ["code"], filters: ["status"], searchable: ["code"] },
        form: [{ title: "Content", fields: ["code", "lines", "fees"] }],
      },
    });
    expect(() => resolveAnalysisField(twoTables, "lines", "fees.amount", "t")).toThrow(
      /line table/,
    );
  });

  it("it's not a \"no field\" that says two layers when you can't.", () => {
    expect(() => resolveAnalysisField(module, "lines", "ghost", "t")).toThrow(/lines\.qty/);
  });
});
