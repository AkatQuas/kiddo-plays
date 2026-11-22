// ---------------------------------------------------------------------------
// checkable field list - the one that the tool catalogue says to the model, "What can you sift?"
//
// 🔴 The value of this list is in** it is true.** The model uses it as a closed assembly.
// "Not a field in the list is always rejected", so a field is missing, and that capability does not exist in the model;
// one more, and the model will be sent over during the compilation period. Neither direction is wrong.
//
// Line detail was missing: `normalizeQuery` has always accepted `lines.<column>`, and this list did not.
// so, the most common line-level threshold query for ERPs like "there is a line of scheduled arrival dates earlier than today" and models don't send.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  defineFixtureModule,
  queryableFields,
  searchOperations,
  singleState,
} from "../src/index.js";

const mod = defineFixtureModule({
  code: "demoBill",
  label: "Demo document",
  domain: "sales",
  fields: [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "amount", label: "Amount", type: "money" },
    { key: "attach", label: "Attachment", type: "attachment" },
    {
      key: "lines",
      label: "Lines",
      type: "subtable",
      ref: "demoBillLine",
      fields: [
        { key: "qty", label: "Quantity", type: "number", required: true },
        { key: "planArrivalDate", label: "Planned arrival date", type: "date" },
        { key: "grade", label: "Level", type: "enum", options: ["A", "B"] },
      ],
    },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", color: "gray", initial: true },
      { key: "completed", label: "completed", color: "green", terminal: true },
    ],
    transitions: [{ code: "done", from: "draft", to: "completed", action: "Complete" }],
  },
  views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
});

const fields = queryableFields(mod);
const byKey = new Map(fields.map((f) => [f.field, f]));

describe("queryableFields", () => {
  it("declaration field in, untraceable type absent", () => {
    expect(byKey.has("code")).toBe(true);
    expect(byKey.has("amount")).toBe(true);
    // the attachment does not read "equivalent to what"; the breakdown is not a value per se
    expect(byKey.has("attach")).toBe(false);
    expect(byKey.has("lines")).toBe(false);
  });

  it("platform field in platform", () => {
    expect(byKey.get("status")?.platform).toBe(true);
    expect(byKey.get("createdAt")?.platform).toBe(true);
  });

  // 🔴 Title of this document
  it("The details are on the list. `<line table>.<column>`", () => {
    expect(byKey.has("lines.qty")).toBe(true);
    expect(byKey.has("lines.planArrivalDate")).toBe(true);
    expect(byKey.has("lines.grade")).toBe(true);
  });

  it("the cross-reference is between the two gates - the sequence is kept, the negative is kept.", () => {
    const qty = byKey.get("lines.qty");
    expect(qty?.comparators).toEqual(["eq", "gt", "gte", "lt", "lte", "between"]);
    // "There's one line not X" and "there's no one X" are legal.
    for (const op of ["ne", "not_in", "is_empty", "not_empty"]) {
      expect(qty?.comparators, `a line column must not offer ${op}`).not.toContain(op);
    }
    // the date column also retains the sequence -- "the scheduled arrival date is earlier than today" depending on it.
    expect(byKey.get("lines.planArrivalDate")?.comparators).toContain("lt");
  });

  it("take a list of names, because both schedules can be qty.", () => {
    expect(byKey.get("lines.qty")?.label).toBe("Line · Lines · Quantity");
  });

  it("a list of the candidates.", () => {
    expect(byKey.get("lines.grade")?.options).toEqual([
      { value: "A", label: "A" },
      { value: "B", label: "B" },
    ]);
  });

  it("platform status candidate from Lifecycle.statuses.label, does not show key to position", () => {
    const master = defineFixtureModule({
      code: "demoMaster",
      label: "Demo master data",
      domain: "sales",
      fields: [{ key: "code", label: "Code", type: "string", required: true, primary: true }],
      lifecycle: singleState("active", "Active", "green"),
      views: { list: { columns: ["code"], filters: [], searchable: ["code"] }, form: [{ title: "Basics", fields: ["code"] }] },
    });
    expect(queryableFields(master).find((field) => field.field === "status")?.options).toEqual([
      { value: "active", label: "Active" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 🔴 Retrieving narrow axes
//
// the caller has both the business concept and the module on his hands, which was expressed in a single string slot.
// So it put them together as `void production task`. A substring match on the whole phrase is bound to fail.
// In the recorded run, 15 of 184 questions wandered 56 times: a short verb hit, the full phrase did not,
// and the model ended by searching the module code.
// the few are never synonyms (the words are meant to be hit), the dimension of "on which module."
// ---------------------------------------------------------------------------

describe("cell narrow axis for ops search", () => {
  const index = [
    { name: "a.void", module: "a", moduleLabel: "Document A", kind: "write" as const, label: "Void", summary: "Void document A" },
    { name: "b.void", module: "b", moduleLabel: "Document B", kind: "write" as const, label: "Void", summary: "Void document B" },
    { name: "b.submit", module: "b", moduleLabel: "Document B", kind: "write" as const, label: "Submit", summary: "Submit document B" },
  ];

  it("unclaimed module cross-module hits, same as before", () => {
    expect(searchOperations(index, "Void").map((e) => e.name)).toEqual(["a.void", "b.void"]);
  });

  it("it's the only module on which to look -- the only dimension that was missing.", () => {
    expect(searchOperations(index, "Void", 20, "b").map((e) => e.name)).toEqual(["b.void"]);
  });

  // 🔴 The root of the disease repeats: spelling the module name in Keyword will be a failure because no operation has a full name with this phrase
  it("scrolling the module name in Keyword is still 0 -- so narrow must be another dimension", () => {
    expect(searchOperations(index, "VoidCombinedPhraseXZ")).toEqual([]);
    expect(searchOperations(index, "Void", 20, "b")).toHaveLength(1);
  });

  it("the module matches exactly, and it's not blurry -- two layers of blurry, and no one can tell why something isn't out.", () => {
    expect(searchOperations(index, "Void", 20, "bb")).toEqual([]);
  });

  it("empty keyword + mode = list all operations of this module", () => {
    expect(searchOperations(index, "", 20, "b").map((e) => e.name)).toEqual(["b.void", "b.submit"]);
  });
});
