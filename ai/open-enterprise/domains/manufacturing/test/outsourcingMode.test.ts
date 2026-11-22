import { type Field, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import operationDraft from "../modules/operation.js";
import routingDraft from "../modules/routing.js";

const operation = sealModule(operationDraft, { code: "operation", domain: "manufacturing" });
const routing = sealModule(routingDraft, { code: "routing", domain: "manufacturing" });

/** The three levels are the words in use today, copied as they are, with no synonym rewrite */
const MODES = ["No subcontract", "Optional subcontract", "Full subcontract"] as const;

const lineField = (key: string): Field => {
  const lines = routing.fields.find((field) => field.key === "lines");
  const hit = lines?.fields?.find((field) => field.key === key);
  if (!hit) throw new Error(`Routing lines have no "${key}"`);
  return hit;
};

describe("Operation subcontract is three levels, not a can or cannot pair", () => {
  it.each([operation, routing])("%s passes the declaration semantic gate", (module) => {
    expect(validateModule(module).errors).toEqual([]);
  });

  // Two levels cannot answer "can this operation be assigned to our own team?".
  // Optional subcontract is in-house by default and sent out only when capacity is short.
  // Full subcontract (plating, heat treatment) has no in-house capability, so scheduling
  // must create a subcontract order instead of an assignment. A bool folds both into the same true.
  it("the operation master is a required three-level enum", () => {
    const field = operation.fields.find((f) => f.key === "outsourcingMode");
    expect(field).toMatchObject({ label: "Operation subcontract", type: "enum", required: true });
    expect(field?.options?.map((option) => option.value)).toEqual([...MODES]);
    // The old two-level bool must not sit beside it. Two fields for one concept, and the next person does not know which to read
    expect(operation.fields.some((f) => f.key === "allowsOutsourcing")).toBe(false);
  });

  it("the routing line uses the same name and the same levels, and it is the route's own decision, not a master snapshot", () => {
    const field = lineField("outsourcingMode");
    expect(field).toMatchObject({ label: "Operation subcontract", type: "enum", required: true });
    expect(field.options?.map((option) => option.value)).toEqual([...MODES]);
    // The same plating operation is sent out on product A and made in-house on product B. A frozen master snapshot cannot say that.
    // The rate is prefilled from the master and decided by the route. Subcontract mode must not be a snapshot either.
    expect(field.snapshot).toBeNull();
    expect(lineField("pieceRate").refDefault).toMatchObject({ from: "operation", field: "pieceRate" });
    expect(lineField("hourlyRateUnit").snapshot).toMatchObject({ from: "operation", field: "hourlyRateUnit" });
  });

  it("the screen shows and filters the new field, with no dangling view key pointing at the old field", () => {
    expect(operation.views.list.columns).toContain("outsourcingMode");
    expect(operation.views.list.filters).toContain("outsourcingMode");
    expect(JSON.stringify(operation.views)).not.toContain("allowsOutsourcing");
    expect(JSON.stringify(routing.views)).not.toContain("allowsOutsourcing");
  });
});
