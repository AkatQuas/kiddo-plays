// ---------------------------------------------------------------------------
// `Transition.when` - Same state, side by side by surface field.
//
// state = where is it parked; field = which one of these is this; when = this side does not exist.
// no when = unconditional existence in the state. When joining with remaining: remaining pipe volume, when tube shape.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  evaluateTransition,
  normalizeFixtureModule,
  validateModule,
  visibleTransitions,
  type ModuleSchema,
  type RuleQuery,
} from "../src/index.js";

const NOW = new Date("2026-08-04T00:00:00Z");

const NO_DATA: RuleQuery = {
  get: async () => null,
  list: async () => [],
  balance: async () => {
    throw new Error("this case must not query a balance");
  },
};

const HANDLING_WHEN = {
  primitive: "field_compare",
  left: { ref: "$bill.handlingType" },
  op: "eq",
} as const;

function remainderModule(overrides?: {
  readonly transitions?: readonly Record<string, unknown>[];
}): ModuleSchema {
  return normalizeFixtureModule({
    code: "subcontractMaterialReturnLike",
    label: "Leftover handling",
    domain: "test",
    fields: [
      { key: "code", type: "string", primary: true },
      { key: "handlingType", label: "What to do with leftovers", type: "enum", options: ["Return warehouse", "Confirm loss"] },
    ],
    lifecycle: {
      statuses: [
        { key: "pending", initial: true },
        { key: "returned", terminal: true },
        { key: "lossConfirmed", terminal: true },
        { key: "draft" },
      ],
      transitions: overrides?.transitions ?? [
        {
          code: "releaseDemand",
          from: "pending",
          to: "returned",
          action: "Confirm leftover return",
          primary: true,
          when: { ...HANDLING_WHEN, right: { value: "Return warehouse" } },
        },
        {
          code: "releaseLossDemand",
          from: "pending",
          to: "lossConfirmed",
          action: "Confirm leftover loss",
          primary: true,
          when: { ...HANDLING_WHEN, right: { value: "Confirm loss" } },
        },
        { code: "reject", from: "pending", to: "draft", action: "Return for edit" },
        { code: "submit", from: "draft", to: "pending", action: "Submit leftover handling" },
      ],
    },
    views: { list: { columns: ["code"] }, form: [] },
  });
}

function codesOf(module: ModuleSchema, status: string, header: Readonly<Record<string, unknown>>): string[] {
  return visibleTransitions(module, status, { header }).map((edge) => edge.code);
}

describe("visibleTrans: when", () => {
  it("no, no, no, no.", () => {
    const module = remainderModule({
      transitions: [
        { code: "releaseDemand", from: "pending", to: "returned", action: "Confirm leftover return", primary: true },
        { code: "reject", from: "pending", to: "draft", action: "Return for edit" },
        { code: "submit", from: "draft", to: "pending", action: "Submit leftover handling" },
      ],
    });
    expect(availableTransitions(module, "pending").map((edge) => edge.code)).toEqual(["releaseDemand", "reject"]);
    expect(codesOf(module, "pending", { status: "pending" })).toEqual(["releaseDemand", "reject"]);
    expect(codesOf(module, "pending", { status: "pending", handlingType: "Confirm loss" })).toEqual([
      "releaseDemand",
      "reject",
    ]);
  });

  it("handlingType = confirmation of wear and tear: visible only edge of loss + object, no confirmation of return of surplus", () => {
    const module = remainderModule();
    expect(codesOf(module, "pending", { status: "pending", handlingType: "Confirm loss" })).toEqual([
      "releaseLossDemand",
      "reject",
    ]);
  });

  it("handlingType = Back to the warehouse: Only backside visible + subject", () => {
    const module = remainderModule();
    expect(codesOf(module, "pending", { status: "pending", handlingType: "Return warehouse" })).toEqual([
      "releaseDemand",
      "reject",
    ]);
  });

  it("list projection does not exist when fields: empty vs is faked, both sides are hidden, only when reject", () => {
    const module = remainderModule();
    expect(codesOf(module, "pending", { status: "pending" })).toEqual(["reject"]);
  });
});

describe("main button gate", () => {
  it("♪ When Primary + When Primary ♪ TRANSITION ♪ CONDITIONAL Primary MIXED", () => {
    const module = remainderModule({
      transitions: [
        {
          code: "releaseDemand",
          from: "pending",
          to: "returned",
          action: "Confirm leftover return",
          primary: true,
          when: { ...HANDLING_WHEN, right: { value: "Return warehouse" } },
        },
        { code: "reject", from: "pending", to: "draft", action: "Return for edit", primary: true },
        { code: "submit", from: "draft", to: "pending", action: "Submit leftover handling" },
      ],
    });
    expect(validateModule(module).errors.map((error) => error.code)).toContain("TRANSITION_CONDITIONAL_PRIMARY_MIXED");
  });

  it("two fields with the same primary and the same fields → validate passed", () => {
    expect(validateModule(remainderModule()).errors).toEqual([]);
  });
});

describe("evaluateTransion: where's the failure to block, not throw?", () => {
  it("not applicable edges → verdict block, text field name and actual Value", async () => {
    const module = remainderModule();
    const decision = await evaluateTransition(
      {
        module,
        bill: { id: "r-1", status: "pending", handlingType: "Confirm loss" },
        lines: [],
        params: {},
        actor: {},
        now: NOW,
        query: NO_DATA,
      },
      "releaseDemand",
    );
    expect(decision.verdict).toMatchObject({ pass: false, level: "block" });
    expect(decision.verdict.pass).toBe(false);
    if (decision.verdict.pass) throw new Error("an edge that does not apply must block");
    expect(decision.verdict.message).toContain("What to do with leftovers");
    expect(decision.verdict.message).toContain("Confirm loss");
    expect(decision.verdict.message).not.toContain("field_compare");
  });
});

describe("when Set", () => {
  it("♪ When Field compare ♪", () => {
    expect(() =>
      remainderModule({
        transitions: [
          {
            code: "releaseDemand",
            from: "pending",
            to: "returned",
            action: "Confirm leftover return",
            when: {
              primitive: "ref_field_compare",
              via: "code",
              entity: "subcontractMaterialReturnLike",
              through: null,
              field: "handlingType",
              op: "eq",
              right: { value: "Return warehouse" },
            },
          },
          { code: "reject", from: "pending", to: "draft", action: "Return for edit" },
          { code: "submit", from: "draft", to: "pending", action: "Submit leftover handling" },
        ],
      }),
    ).toThrow(/when accepts only field_compare/);
  });
});
