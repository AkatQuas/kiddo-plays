// ---------------------------------------------------------------------------
// 🔴 When the push down fails, the coordinates of the issue point to the one on the source list** (S1 F-03)
//
// Live:`salesOrder/so-0005` This post is part of our special coverage Syria Protests 2011.
//   "Path": "lines [0].product Id", "label": "Producing fines, line 1 - Producing goods",...
// `lines[0].productId` It's a fine line of production orders, and the user is on page** of the sales list.**
// the one that did not exist in front of him was neither red nor red, and he was asked to "re-select."
//
// this test nail is the map itself. Two of the most easily miswritten and miswritten ** will remain silent **:
//   One line down, paired by one.`lineLink` Also labeled by Oe reference;
//   2 Column by Same Name, not by `pushFrom` That's it.
// so each of the following ones has the shape of a "same guess just right": the source/target list is all different from the listing**.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, pushSourceIssueCoordinate } from "../src/index.js";

/*:: Source list: side of the sales order */
const source = normalizeFixtureModule({
  code: "alpha",
  label: "Sales order",
  domain: "d1",
  numbering: { prefix: "A", seqScope: "day" },
  fields: [
    { key: "code", label: "Order number", type: "string", primary: true, auto: true },
    { key: "note", label: "Order note", type: "text" },
    {
      key: "lines",
      label: "Sales lines",
      type: "subtable",
      ref: "alphaLine",
      fields: [
        { key: "productId", label: "Product", type: "ref", ref: "product" },
        { key: "netPrice", label: "Net price", type: "money" },
      ],
    },
    {
      key: "requestLines",
      label: "Request lines",
      type: "subtable",
      ref: "alphaRequestLine",
      fields: [
        { key: "productId", label: "Requested product", type: "ref", ref: "product" },
        { key: "netPrice", label: "Requested net price", type: "money" },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", initial: true },
      { key: "done", terminal: true },
    ],
    transitions: [{ code: "done", from: "draft", to: "done", action: "Close" }],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "note", "lines"] }] },
});

/**
 * target list: The side of the production order.
 *
 * ** All intentional aliases**: breakdown `rows` ≠ `lines`Columns `goodsId` ≠ `productId`、
 * `price` ≠ `netPrice`I don't know. It's the same name for what it's all about.
 * and it's right in the barn (the 12 push on both sides of the same name) -- "Only the same name means no."
 */
const target = normalizeFixtureModule({
  code: "beta",
  label: "Production order",
  domain: "d1",
  numbering: { prefix: "B", seqScope: "day" },
  fields: [
    { key: "code", label: "Production number", type: "string", primary: true, auto: true },
    { key: "remark", label: "Production note", type: "text", pushFrom: "note" },
    { key: "plannedAt", label: "Planned start", type: "date" },
    {
      key: "rows",
      label: "Production lines",
      type: "subtable",
      ref: "betaLine",
      fields: [
        { key: "orderId", label: "Source order", type: "ref", ref: "alpha" },
        { key: "orderLineId", label: "Source order line", type: "refLine", ref: "alpha", through: "lines" },
        { key: "goodsId", label: "Product to make", type: "ref", ref: "product", pushFrom: "productId" },
        { key: "price", label: "Settlement price", type: "money", pushFrom: "netPrice" },
        { key: "qty", label: "Quantity", type: "number" },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "awaitingRelease", initial: true },
      { key: "completed", terminal: true },
    ],
    transitions: [{ code: "done", from: "awaitingRelease", to: "completed", action: "Complete" }],
  },
  views: { list: { columns: ["code"] }, form: [{ title: "Main", fields: ["code", "remark", "plannedAt", "rows"] }] },
});

describe("a map of the coordinates of the bottom pushback source", () => {
  it("🔴 Details: Form, List, Line Numbers must match - F-03", () => {
    expect(pushSourceIssueCoordinate(source, target, "rows[0].goodsId")).toEqual({
      path: "lines[0].productId",
      label: "Sales lines line 1 · Product",
    });
  });

  it("🔴 One of the wrong pairs will be caught -- the bottom mark is the only basis for copying by line.", () => {
    // this is the "must be red" requirement: replace it with "index ± 1, two claims."
    // ** At least one ** must be hung (line 0 and line 1 cannot be met by the same deviation simultaneously).
    expect(pushSourceIssueCoordinate(source, target, "rows[0].goodsId")?.path).toBe("lines[0].productId");
    expect(pushSourceIssueCoordinate(source, target, "rows[1].goodsId")?.path).toBe("lines[1].productId");
    // the visible line number is ** Subscript + 1** (consistent with Curly Line no), which is not the type of bottom in path Source
    expect(pushSourceIssueCoordinate(source, target, "rows[1].goodsId")?.label).toBe("Sales lines line 2 · Product");
    // negative: The wrong answer is not to be returned.
    expect(pushSourceIssueCoordinate(source, target, "rows[1].goodsId")?.path).not.toBe("lines[0].productId");
    expect(pushSourceIssueCoordinate(source, target, "rows[0].goodsId")?.path).not.toBe("lines[1].productId");
  });

  it("🔴 Column Press `pushFrom` Go, not by the same name -- a synonym will point to a key not found on a source list", () => {
    expect(pushSourceIssueCoordinate(source, target, "rows[2].price")).toEqual({
      path: "lines[2].netPrice",
      label: "Sales lines line 3 · Net price",
    });
    // Same name answers. `lines[2].price`And there's nothing on the source. `price` This column
    expect(pushSourceIssueCoordinate(source, target, "rows[2].price")?.path).not.toContain("price");
  });

  it("Table homogeneity`pushFrom` Same thing)", () => {
    expect(pushSourceIssueCoordinate(source, target, "remark")).toEqual({ path: "note", label: "Order note" });
  });

  it("push.line should not cover the opposite; loader also fail-fast", () => {
    expect(() => pushSourceIssueCoordinate(
      source,
      target,
      "rows[0].goodsId",
      { source: "requestLines", target: "rows" },
    )).toThrow(/push\.line\.source "requestLines" does not match/);
  });

  it("🔴 There's really nothing on the source list for that.", () => {
    // target own volume and date: The draft is empty and does not have a corresponding cell on the source list.
    // = The interface is red in a position that has nothing to do with this failure, which is worse than not red.
    expect(pushSourceIssueCoordinate(source, target, "plannedAt")).toBeNull();
    expect(pushSourceIssueCoordinate(source, target, "rows[0].qty")).toBeNull();
    // the non-existent table / column / module field is full, unpaved: this is a map for the script,
    // the legitimacy of the coordinates is guaranteed on the other side of the gate.
    expect(pushSourceIssueCoordinate(source, target, "rows[0].nope")).toBeNull();
    expect(pushSourceIssueCoordinate(source, target, "nope[0].goodsId")).toBeNull();
    expect(pushSourceIssueCoordinate(source, target, "nope")).toBeNull();
  });

  it("coordinates can be spelled out -- unsolved shapes are not allowed to be used as watch fields.", () => {
    // `rows[0]`No, it's not. `BillIssue` It's a fine book that's coming in.
    // it's not a watch word.
    expect(pushSourceIssueCoordinate(source, target, "rows[0]")).toBeNull();
  });
});
