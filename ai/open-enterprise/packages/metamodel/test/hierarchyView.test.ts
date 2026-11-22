import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, validateModule } from "../src/index.js";

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "org",
    label: "Organization",
    domain: "ops",
    fields: [
      { key: "code", label: "Code", type: "string", primary: true },
      { key: "name", label: "Name", type: "string", required: true },
      { key: "level", label: "Level", type: "enum", options: ["Group", "Company", "Department"], required: true },
      { key: "parentId", label: "Parent", type: "ref", ref: "org" },
    ],
    lifecycle: {
      statuses: [{ key: "active", label: "Active", color: "green", initial: true, terminal: true }],
      transitions: [],
    },
    views: {
      hierarchy: { parent: "parentId", level: "level", label: "name" },
      list: { columns: ["code", "name", "level", "parentId"] },
      form: [{ title: "Basics", fields: ["code", "name", "level", "parentId"] }],
    },
    ...overrides,
  };
}

const codes = (value: Record<string, unknown>): readonly string[] =>
  validateModule(normalizeFixtureModule(value)).errors.map((error) => error.code);

describe("views.hierarchy: a projection-only self-referenced fixed level", () => {
  it("parent self-ref + enum level + string name passed", () => {
    expect(codes(raw())).toEqual([]);
    expect(normalizeFixtureModule(raw()).views.hierarchy).toEqual({ parent: "parentId", level: "level", label: "name" });
  });

  it("the hierarchy could be choiceSet enum -- the dictionary entry is the file.", () => {
    const value = raw();
    value["fields"] = [
      { key: "code", label: "Code", type: "string", primary: true },
      { key: "name", label: "Name", type: "string", required: true },
      { key: "level", label: "Level", type: "enum", choiceSet: "manufacturing.orgType", required: true },
      { key: "parentId", label: "Parent", type: "ref", ref: "org" },
    ];
    expect(codes(value)).toEqual([]);
  });

  it("father is not self-ref, rank is not enum, name is not string slotting", () => {
    const value = raw();
    value["fields"] = [
      { key: "code", label: "Code", type: "string", primary: true },
      { key: "name", label: "Name", type: "text" },
      { key: "level", label: "Level", type: "string" },
      { key: "parentId", label: "Parent", type: "ref", ref: "other" },
    ];
    expect(codes(value)).toEqual(expect.arrayContaining([
      "VIEW_HIERARCHY_PARENT_NOT_SELF_REF",
      "VIEW_HIERARCHY_LEVEL_NOT_ENUM",
      "VIEW_HIERARCHY_LABEL_NOT_TEXT",
    ]));
  });

  it("three coordinates must enter the list projection and cannot be searched separately from the hierarchy page", () => {
    const value = raw();
    value["views"] = {
      hierarchy: { parent: "parentId", level: "level", label: "name" },
      list: { columns: ["code"] },
      form: [],
    };
    expect(codes(value).filter((code) => code === "VIEW_HIERARCHY_FIELD_NOT_LISTED")).toHaveLength(3);
  });

  it("when not declared, the norm becomes null, the consumer does not guess.", () => {
    const value = raw();
    value["views"] = { list: { columns: ["code"] }, form: [] };
    expect(normalizeFixtureModule(value).views.hierarchy).toBeNull();
  });
});
