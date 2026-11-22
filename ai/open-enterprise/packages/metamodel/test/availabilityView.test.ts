// ---------------------------------------------------------------------------
// `views.availability` - ** Declaration of available panel coordinates**
//
// why is there a place where the rendering machine could have been released from the statement (inventory is recorded on the program, in the warehouse) and the replayer is in the water.
// Core `EFFECT_SUBJECT.stock`But it's disciplined to "more than one, more than one."
// the entire panel disappeared when you quoted it, and that was exactly what it needed.
// the list: the cash already in the warehouse should not be lined up again.
//
// 🔴 The export is a declaration** not a relaxation of that discipline. Picking the first one / match by field name gives you a full pair of numbers.
// the wrong answer to the question is the panel (the balance of the product by the lead, a row of 0), which seems perfectly normal.
//
// Here's all the nails. `yarn test` Red. The performance of staying until running is
// the whole right column was missing when the form was opened for the first time — no distinction is made between “this module does not have this panel”.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, validateModule } from "../src/index.js";

interface Raw {
  code: string;
  label: string;
  domain: string;
  fields: unknown[];
  lifecycle: { statuses: unknown[]; transitions: unknown[] };
  views: Record<string, unknown>;
  [key: string]: unknown;
}

/** The smallest form of production orders cited by two warehouses * */
function order(availability: unknown): Raw {
  return structuredClone({
    code: "productionOrder",
    label: "Production order",
    domain: "production",
    fields: [
      { key: "code", label: "Document number", type: "string", primary: true },
      { key: "completionWarehouseId", label: "Completion warehouse", type: "ref", ref: "warehouse" },
      { key: "issueWarehouseId", label: "Issue warehouse", type: "ref", ref: "warehouse" },
      { key: "customerId", label: "Customer", type: "ref", ref: "customer" },
      { key: "qty", label: "Quantity", type: "number" },
      {
        key: "lines",
        label: "Production lines",
        type: "subtable",
        ref: "productionOrderLine",
        fields: [
          { key: "productId", label: "Product to make", type: "ref", ref: "product", required: true },
          { key: "bomId", label: "BOM", type: "ref", ref: "bom" },
          { key: "qty", label: "Quantity to make", type: "number", required: true },
        ],
      },
    ],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "completed", label: "completed", terminal: true },
      ],
      transitions: [{ code: "finish", from: "draft", to: "completed", action: "Complete", primary: true }],
    },
    views: { list: { columns: ["code", "qty"] }, availability },
  }) as Raw;
}

function errorCodes(raw: Raw): string[] {
  return validateModule(normalizeFixtureModule(raw)).errors.map((e) => e.code);
}

const GOOD = { scopeField: "completionWarehouseId", lines: "lines", subjectField: "productId" };

describe("shape gate (standardization period)", () => {
  it("if you don't declare it, it's the same, the same.", () => {
    const raw = order(undefined);
    delete raw.views["availability"];
    expect(normalizeFixtureModule(raw).views.availability).toBeNull();
  });

  it("we said we'd bring out three coordinates.", () => {
    expect(normalizeFixtureModule(order(GOOD)).views.availability).toEqual(GOOD);
  });

  it("🔴 The three of them have to be filled -- one less one has to be guessed.", () => {
    expect(() => normalizeFixtureModule(order({ scopeField: "completionWarehouseId", lines: "lines" }))).toThrow(
      /availability\.subjectField/,
    );
  });

  it("key Closed: Write one more key to throw and ignore it silently (quiet = the author thinks the configuration is working)", () => {
    expect(() => normalizeFixtureModule(order({ ...GOOD, measure: "qty" }))).toThrow(/measure|unknown key|not allowed/);
  });
});

describe("coordinated gate (construction period, award of inventory in the catalogue)", () => {
  it("baseline: completed warehouse + production detail + production of goods, release", () => {
    expect(errorCodes(order(GOOD))).toEqual([]);
  });

  it("the warehouse is not a field of this module", () => {
    expect(errorCodes(order({ ...GOOD, scopeField: "warehouseId" }))).toContain("VIEW_FIELD_UNKNOWN");
  });

  it("🔴 The unreadable number of \"balances\" by client.", () => {
    expect(errorCodes(order({ ...GOOD, scopeField: "customerId" }))).toContain(
      "VIEW_AVAILABILITY_SCOPE_NOT_REF",
    );
  });

  it("the warehouse box is not quoted: there is no warehouse on the quantitative column.", () => {
    expect(errorCodes(order({ ...GOOD, scopeField: "qty" }))).toContain("VIEW_AVAILABILITY_SCOPE_NOT_REF");
  });

  it("lines isn't a list.", () => {
    expect(errorCodes(order({ ...GOOD, lines: "qty" }))).toContain("VIEW_AVAILABILITY_LINES_NOT_SUBTABLE");
  });

  it("fields for lines do not exist", () => {
    expect(errorCodes(order({ ...GOOD, lines: "rows" }))).toContain("VIEW_FIELD_UNKNOWN");
  });

  it("🔴 The list of goods is on the list. Red", () => {
    expect(errorCodes(order({ ...GOOD, subjectField: "goodsId" }))).toContain("VIEW_AVAILABILITY_SUBJECT_UNKNOWN");
  });

  it("the commodity column refers to the wrong entity: by BOM check the inventory balance is constant and the panel shows it as 0", () => {
    expect(errorCodes(order({ ...GOOD, subjectField: "bomId" }))).toContain("VIEW_AVAILABILITY_SUBJECT_NOT_REF");
  });

  it("the list of goods is not quoted.", () => {
    expect(errorCodes(order({ ...GOOD, subjectField: "qty" }))).toContain("VIEW_AVAILABILITY_SUBJECT_NOT_REF");
  });

  it("pipe field (id / tenantId / orgId) does not enter view declaration - the same as the rest of Views", () => {
    expect(errorCodes(order({ ...GOOD, scopeField: "orgId" }))).toContain("VIEW_FIELD_PLATFORM_PIPE");
  });
});
