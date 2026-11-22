import { describe, expect, it } from "vitest";
import {
  defineFixtureModule,
  hasRowValue,
  normalizeProjection,
  planListColumns,
  projectableColumnsOf,
  PLATFORM_QUERY_FIELDS,
} from "../src/index.js";

/**
 :: Shape used for accident recurrence:`address` is a declared, searchable, but not listed, field.
 Real `customer` This is it above - The list is code/name/shortName/... those seven columns.
 */
const customerish = defineFixtureModule({
  code: "demoCustomer",
  label: "Demo customer",
  domain: "sales",
  fields: [
    { key: "code", label: "Number", type: "string", required: true, primary: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "address", label: "Address", type: "string" },
    { key: "attach", label: "Attachment", type: "attachment" },
    {
      key: "lines",
      label: "Contact",
      type: "subtable",
      ref: "demoCustomerContact",
      fields: [
        { key: "person", label: "Contact", type: "string", required: true },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", color: "gray", initial: true },
      { key: "Enabled", label: "Enabled", color: "green", terminal: true },
    ],
    transitions: [{ code: "enable", from: "draft", to: "Enabled", action: "Enabled" }],
  },
  views: {
    // 🔴 On purpose, only two columns: the projection must ** not be pushed from here**
    list: { columns: ["code", "name"], filters: [], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "name", "address"] }],
  },
});

const withDerived = defineFixtureModule({
  code: "demoOrder",
  label: "Demo order",
  domain: "sales",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "customerId", label: "Customer", type: "ref", ref: "demoCustomer", required: true },
    {
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "demoCustomer", match: "customerId", field: "name" },
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", color: "gray", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true },
    ],
    transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
  },
  views: {
    list: { columns: ["code", "customerName"], filters: [], searchable: ["code"] },
    form: [{ title: "Basics", fields: ["code", "customerId"] }],
  },
});

describe("projectableColumnsOf", () => {
  it("axes different from the list column: list of invisible parties", () => {
    const { universe } = planListColumns(
      customerish.views.list.columns,
      customerish.views.list.hideStatus,
    );
    // the root of the accident: there's no such column, so reusing it means that it doesn't exist.
    expect(universe).not.toContain("address");
    expect(projectableColumnsOf(customerish)).toContain("address");
  });

  it("platform field candidate set (with id -- it's half the handle), pipe field not entered", () => {
    const projectable = projectableColumnsOf(customerish);
    for (const platform of PLATFORM_QUERY_FIELDS) {
      expect(projectable).toContain(platform.key);
    }
    // 🔴 `id` ** In ** candidate (main added to PLATFORM QUERY FIELDS): It's half the handle.
    // it's the pipe fields that shouldn't have come up -- that's the kind of "no value out."
    expect(projectable).not.toContain("tenantId");
  });

  it("none of the two categories in the table/annex Set", () => {
    const projectable = projectableColumnsOf(customerish);
    expect(projectable).not.toContain("lines");
    expect(projectable).not.toContain("attach");
  });

  it("the birth is on the list -- it's on the list. It's wrong to read it.", () => {
    expect(withDerived.views.list.columns).toContain("customerName");
    expect(projectableColumnsOf(withDerived)).toContain("customerName");
  });

  it("the verdict is that there is a RowValue platform field, without a copy", () => {
    const platform = PLATFORM_QUERY_FIELDS.map((p) => p.key);
    expect(projectableColumnsOf(customerish)).toEqual([
      ...customerish.fields.filter(hasRowValue).map((f) => f.key),
      ...platform.filter((key) => !customerish.fields.some((f) => f.key === key)),
    ]);
  });
});

describe("normalizeProjection", () => {
  it("do n't pass = Null (by default list of modules), Null is synonymous with undefined", () => {
    expect(normalizeProjection(customerish, undefined, "fields")).toBeNull();
    expect(normalizeProjection(customerish, null, "fields")).toBeNull();
  });

  it("the list of names comes back in order, and only one is left.", () => {
    expect(normalizeProjection(customerish, ["code", "name", "address"], "fields")).toEqual([
      "code",
      "name",
      "address",
    ]);
    expect(normalizeProjection(customerish, ["address", "code", "address"], "fields")).toEqual([
      "address",
      "code",
    ]);
  });

  it("platform field click", () => {
    expect(normalizeProjection(customerish, ["code", "updatedAt"], "fields")).toEqual([
      "code",
      "updatedAt",
    ]);
  });

  it("empty array rejected: it's \"no one row\" and not \"no default\"", () => {
    expect(() => normalizeProjection(customerish, [], "fields")).toThrow(/do not pass this parameter/u);
  });

  // 🔴 The following are the full security boundaries of the current capability:
  // less than one line looks exactly the same as a complete return. People will use it as a check.
  it("non-existent column: error reporting indicates a projectable project for Modeule describe (query)", () => {
    expect(() => normalizeProjection(customerish, ["code", "addr"], "fields")).toThrow(
      /has no projectable column "addr"[\s\S]*projectable/u,
    );
  });

  /**
   * * Refusal to bring a copy** to reissue** `fields`。
   *
   :: On-site:`bill_list(worker, fields:["id","code","name","teamId"])` It was rejected.
   * after reading the "projectable with mobile describe", the model changed its name and guess again.
   * again rejected - two complete trips (10~60 seconds/s) and the legitimate three lines of service knew from the outset.
   */
  it("🔴 The one in the wrong row with \"Get rid of it, the rest\"", () => {
    let message = "";
    try {
      normalizeProjection(customerish, ["code", "name", "addr"], "fields");
    } catch (cause: unknown) {
      message = cause instanceof Error ? cause.message : String(cause);
    }
    expect(message).toContain('has no projectable column "addr"');
    // the one that can be copied directly: the lawful column of the reservation, the order in which the reservation was made
    expect(message).toContain('fields:["code","name"]');
  });

  it("you're wrong, you're wrong, you're wrong.", () => {
    let message = "";
    try {
      normalizeProjection(customerish, ["code", "addr", "name", "nope"], "fields");
    } catch (cause: unknown) {
      message = cause instanceof Error ? cause.message : String(cause);
    }
    expect(message).toContain("also named wrong in the same call: nope");
    expect(message).toContain('fields:["code","name"]');
  });

  it("it's still a refusal, not the slip-off of those columns -- a list less and a full list looks the same.", () => {
    expect(() => normalizeProjection(customerish, ["code", "addr"], "fields")).toThrow();
  });

  it("details: None of the lines.", () => {
    expect(() => normalizeProjection(customerish, ["lines"], "fields")).toThrow(
      /is a line table[\s\S]*bill_get[\s\S]*analysis_sql/u,
    );
  });

  it("detailed path: Idem and before the \"field does not exist\" sentence", () => {
    expect(() => normalizeProjection(customerish, ["lines.person"], "fields")).toThrow(
      /is a line-column path/u,
    );
  });

  it("attachment cell: refers to attachment read, without placing the handle on the table", () => {
    expect(() => normalizeProjection(customerish, ["attach"], "fields")).toThrow(
      /attachment_read/u,
    );
  });

  it("non-string always rejected, no string() bottom", () => {
    expect(() => normalizeProjection(customerish, ["code", 1], "fields")).toThrow(/fields\[1\]/u);
    expect(() => normalizeProjection(customerish, "code", "fields")).toThrow(/must be an array/u);
  });
});
