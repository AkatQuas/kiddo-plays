import { describe, expect, it } from "vitest";

import { isDerived, isLineAggregated, isPlannerSupplied, isSystemSupplied, normalizeFixtureModule, validateModule, type Field } from "../src/index.js";

/** Simulates the missing key field on the wire: no snapshot properties for the old process / JSON Province Null */
function wireField(partial: Partial<Field> & Pick<Field, "key" | "label" | "type">): Field {
  return {
    required: false,
    primary: false,
    unique: false, uniqueWith: null,
    auto: false,
    options: null,
    choiceSet: null,
    ref: null,
    refFilter: null,
    through: null,
    derive: null,
    lineAgg: null,
    calculate: null,
    unitChoice: null,
    help: null,
    pushFrom: null,
    fields: null,
    snapshot: null,
    refDefault: null,
    refPreselect: null,
    refPreselectSole: false,
    ...partial,
  } as Field;
}

describe("is SystemSupplied", () => {
  it("a normal field without snapshot / constructive / lineAgg is not a system supply", () => {
    // deliberately delete keys, repeat the shape of schema API when out of station without snapshot
    const bare = {
      key: "name",
      label: "Name",
      type: "string" as const,
      required: true,
      primary: false,
      unique: false, uniqueWith: null,
      auto: false,
      options: null,
      ref: null,
      through: null,
      // dive / LineAgg / snapshot all missing
      help: null,
      pushFrom: null,
      fields: null,
    } as unknown as Field;

    expect(isDerived(bare)).toBe(false);
    expect(isLineAggregated(bare)).toBe(false);
    expect(isSystemSupplied(bare)).toBe(false);
  });

  it("a visible nuld normal field is not a system supply", () => {
    const field = wireField({ key: "name", label: "Name", type: "string" });
    expect(isSystemSupplied(field)).toBe(false);
  });

  it("snapshot is the system supply", () => {
    const field = wireField({
      key: "unit",
      label: "Unit",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "unit" },
    });
    expect(isSystemSupplied(field)).toBe(true);
  });

  it("refDefault is a user value that can be covered, not a system supply", () => {
    const field = wireField({
      key: "pieceRate",
      label: "Piece rate",
      type: "money",
      refDefault: { from: "operation", match: "operationId", through: null, field: "pieceRate" },
    });
    expect(isSystemSupplied(field)).toBe(false);
  });

  it("auto/ Delive remains a system supply", () => {
    expect(isSystemSupplied(wireField({ key: "code", label: "Code", type: "string", auto: true }))).toBe(true);
    expect(
      isSystemSupplied(
        wireField({
          key: "spuCategory",
          label: "Category",
          type: "string",
          derive: { kind: "lookup", from: "productSpu", through: null, match: "spuId", field: "category" },
        }),
      ),
    ).toBe(true);
  });
});

describe("is SystemSupplied - systemGenerated", () => {
  it("🔴 systemGenerated: True Direct Calculating System Supply - even if field types are themselves string", () => {
    const field = wireField({
      key: "barcode",
      label: "Barcode",
      type: "string",
      systemGenerated: true,
    });
    expect(isSystemSupplied(field)).toBe(true);
  });

  it("systemGenerated default does not affect the original judgement - it is additive", () => {
    const field = wireField({
      key: "spec",
      label: "Specification",
      type: "string",
    });
    expect(isSystemSupplied(field)).toBe(false);
  });
});

describe("plannerSupplied - freeze only when Planner is generated", () => {
  it("system supply, normal form/Agent not written", () => {
    const field = wireField({
      key: "completionMode",
      label: "Completion method",
      type: "enum",
      options: [
        { value: "manual", label: "manual" },
        { value: "automatic", label: "automatic" },
      ],
      plannerSupplied: true,
    });
    expect(isPlannerSupplied(field)).toBe(true);
    expect(isSystemSupplied(field)).toBe(true);
  });

  it("default does not change the syntax of normal fields", () => {
    const field = wireField({ key: "name", label: "Name", type: "string" });
    expect(isPlannerSupplied(field)).toBe(false);
  });

  it("no additional patches or UI hidden mechanisms can be folded", () => {
    const raw = {
      code: "generatedTarget",
      label: "System-generated target",
      domain: "test",
      numbering: { prefix: "TSTG", seqScope: "day" },
      fields: [
        { key: "code", label: "Code", type: "string", primary: true, auto: true },
        {
          key: "mode",
          label: "Frozen method",
          type: "enum",
          options: ["manual", "automatic"],
          plannerSupplied: true,
          systemGenerated: true,
          hidden: true,
        },
      ],
      lifecycle: { statuses: [{ key: "draft", label: "draft", initial: true, terminal: true }], transitions: [] },
      handoff: [],
      preconditions: [],
      views: { list: { columns: ["code"], filters: [], searchable: [], defaultSort: null }, form: [] },
    };
    const report = validateModule(normalizeFixtureModule(raw));
    expect(report.errors).toContainEqual(expect.objectContaining({
      code: "FIELD_PLANNER_SUPPLIED_EXCLUSIVE",
      message: expect.stringContaining("systemGenerated"),
    }));
  });
});
