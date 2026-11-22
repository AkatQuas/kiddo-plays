// ---------------------------------------------------------------------------
// projection of "The Draft Can Be Missing, Submit Required"
//
// returning to a gap** of the frame layer**, not a module bug: the warehouse has to be filled in two.
// （`Field.required` = Dropped in the library must; on the side `required_fields` = Draft available, required for submission)
// And the only basis for the rendering machine to judge Red Star is `field.required`- It doesn't read drafts.
// So the second set of zero visual signals on the form:`salesOrder.promiseDate` No asterisk.
// the user filled out the "check" point and was informed that it had to be filled out.
//
// This file pins the derivation half: declaration → `field key → the edges that require it`. Whether to draw an asterisk,
// it's the consumer's decision, not here.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  normalizeFixtureModule,
  normalizePrecondition,
  requiredLaterHintsOf,
  transitionRequiredFieldsOf,
  type FieldRequiredOnTransition,
  type Precondition,
} from "../src/index.js";

/** Build only the two keys `transitionRequiredFieldsOf` actually reads, not a whole module. */
function mod(
  transitions: readonly string[],
  ...preconditions: Precondition[]
): {
  readonly preconditions: readonly Precondition[];
  readonly lifecycle: { readonly transitions: readonly { readonly code: string; readonly action: string; readonly params: readonly [] }[] };
} {
  return {
    preconditions,
    lifecycle: { transitions: transitions.map((code) => ({ code, action: code, params: [] })) },
  };
}

const pc = (raw: Record<string, unknown>): Precondition =>
  normalizePrecondition({ source: "invariant", level: "block", why: "Why this rule exists (this test does not read it)", ...raw });

const requiredOn = (fields: readonly string[]): Record<string, unknown> => ({
  check: { primitive: "required_fields", fields },
});

const edgesOf = (
  got: ReadonlyMap<string, readonly FieldRequiredOnTransition[]>,
  key: string,
): string[] => (got.get(key) ?? []).map((e) => e.transition);

describe("you have to fill in on the second.", () => {
  it("just say \"now empty.\"", () => {
    const hints = requiredLaterHintsOf({
      preconditions: [
        pc({ id: "handling_type_required", onTransition: "submit", ...requiredOn(["handlingType"]) }),
      ],
      lifecycle: { transitions: [{ code: "submit", action: "Submit", params: [] }] },
    });
    expect(hints["handlingType"]).toBe('May be left empty for now; required before "Submit"');
  });
});

describe("field key", () => {
  const schema = mod(
    ["submit", "approve"],
    pc({ id: "submit_fields_required", onTransition: "submit", ...requiredOn(["warehouseId", "promiseDate"]) }),
    pc({ id: "approve_needs_contract", onTransition: "approve", ...requiredOn(["contractNo"]) }),
  );

  it("a rule requires a few buttons, each pointing back to the same side.", () => {
    const got = transitionRequiredFieldsOf(schema);
    expect(edgesOf(got, "warehouseId")).toEqual(["submit"]);
    expect(edgesOf(got, "promiseDate")).toEqual(["submit"]);
    expect(edgesOf(got, "contractNo")).toEqual(["approve"]);
  });

  it("take the rule of request, id -- the person who wants to change the statement has to know where to go. Change", () => {
    const got = transitionRequiredFieldsOf(schema);
    expect(got.get("warehouseId")?.[0]).toMatchObject({
      transition: "submit",
      ruleId: "submit_fields_required",
      level: "block",
      inheritedFrom: null,
      conditional: false,
    });
  });

  it("fields that have not been asked for by any side do not appear in Map - default is \"no second\"", () => {
    expect(transitionRequiredFieldsOf(schema).has("remark")).toBe(false);
  });

  it("one by two, both left: two real moments.", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["submit", "approve"],
        pc({ id: "submit_needs", onTransition: "submit", ...requiredOn(["warehouseId"]) }),
        pc({ id: "approve_needs", onTransition: "approve", ...requiredOn(["warehouseId"]) }),
      ),
    );
    expect(edgesOf(got, "warehouseId")).toEqual(["submit", "approve"]);
  });

  it("Hang on `*` The rules are extended to each side.", () => {
    const got = transitionRequiredFieldsOf(
      mod(["submit", "approve", "close"], pc({ id: "always", onTransition: "*", ...requiredOn(["reasonCode"]) })),
    );
    expect(edgesOf(got, "reasonCode")).toEqual(["submit", "approve", "close"]);
  });

  it("Other words are not required:`field_compare` Also quotes $bil fields, but it's not \"this is worth it\"", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["submit"],
        pc({
          id: "amount_positive",
          onTransition: "submit",
          check: { primitive: "field_compare", left: { ref: "$bill.totalAmount" }, op: "gt", right: { value: 0 } },
        }),
      ),
    );
    expect(got.size).toBe(0);
  });

  it("closed Gate does not count -- an invalid gate should not leave an asterisk on the form", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["submit"],
        pc({ id: "off", onTransition: "submit", source: "gate", enabled: false, ...requiredOn(["warehouseId"]) }),
      ),
    );
    expect(got.size).toBe(0);
  });
});

// 🔴 This is the rationale for this projection: the export side of Route inherits the entire ** gate at the starting point.
// Straight ahead. `module.preconditions` In that case, there's nothing to add to the exception.
// and the users on that side will be blocked by them -- the interface is more relaxed than the gate, and that's exactly what the inheritance mechanism has to guard against.
describe("route.", () => {
  const schema = mod(
    ["approve", "approve_exception"],
    pc({ id: "approve_fields", onTransition: "approve", ...requiredOn(["warehouseId"]) }),
    pc({
      id: "over_limit",
      onTransition: "approve",
      source: "gate",
      level: "route",
      exit: "approve_exception",
      check: { primitive: "field_compare", left: { ref: "$bill.totalAmount" }, op: "lte", right: { value: 100 } },
    }),
    pc({ id: "exception_fields", onTransition: "approve_exception", ...requiredOn(["approvalNote"]) }),
  );

  it("that's the exception.", () => {
    const got = transitionRequiredFieldsOf(schema);
    expect(edgesOf(got, "warehouseId")).toEqual(["approve", "approve_exception"]);
    expect(got.get("warehouseId")?.[1]).toMatchObject({
      transition: "approve_exception",
      ruleId: "approve_fields",
      inheritedFrom: "approve",
    });
  });

  it("except by self-declared label of non-inheritance.", () => {
    const got = transitionRequiredFieldsOf(schema);
    expect(got.get("approvalNote")?.[0]).toMatchObject({ transition: "approve_exception", inheritedFrom: null });
  });
});

describe("the slots and the conditions are handed out as they are. Board", () => {
  it("warn file appears, but it's clearly marked -- it's the consumer's fault, not the data.", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["submit"],
        pc({ id: "soft", onTransition: "submit", source: "gate", level: "warn", ...requiredOn(["salesperson"]) }),
      ),
    );
    expect(got.get("salesperson")?.[0]).toMatchObject({ level: "warn" });
  });

  it("And... `when` The guard's request is marked as \"conditional\" - an asterisk for only one type of document cannot be drawn to another.", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["activate"],
        pc({
          id: "factory_only",
          onTransition: "activate",
          source: "gate",
          when: { primitive: "field_compare", left: { ref: "$bill.orgType" }, op: "eq", right: { value: "factory" } },
          ...requiredOn(["parentId"]),
        }),
      ),
    );
    expect(got.get("parentId")?.[0]).toMatchObject({ conditional: true });
  });

  it("take the rules out of the book - the default is the full, explained by the original language", () => {
    const got = transitionRequiredFieldsOf(
      mod(
        ["submit"],
        pc({ id: "with_msg", onTransition: "submit", message: "The shipping warehouse must be chosen first", ...requiredOn(["warehouseId"]) }),
      ),
    );
    expect(got.get("warehouseId")?.[0]?.message).toBe("The shipping warehouse must be chosen first");
  });
});

// synthetics prove a projection shape.
describe("run on a real statement: the submission of sales order", () => {
  it("promiseDate is not required, but submit has it on the side; warehouseId neither.", () => {
    // take only those parts of the salesOrder that are relevant to this projection, no effect domains
    const schema = normalizeFixtureModule({
      code: "salesOrder",
      label: "Sales order",
      domain: "sales",
      numbering: { prefix: "XS", seqScope: "day" },
      fields: [
        { key: "code", label: "Order number", type: "string", primary: true, auto: true },
        { key: "customerId", label: "Customer", type: "ref", ref: "customer", required: true },
        { key: "promiseDate", label: "Promise date", type: "date" },
        { key: "warehouseId", label: "Shipping warehouse", type: "ref", ref: "warehouse" },
      ],
      lifecycle: {
        statuses: [
          { key: "draft", label: "draft", initial: true },
          { key: "pendingReview", label: "pendingReview", editable: "none" },
          { key: "closed", label: "closed", terminal: true },
        ],
        transitions: [
          { code: "submit", from: "draft", to: "pendingReview", action: "Submit for review" },
          { code: "close", from: "pendingReview", to: "closed", action: "Close", confirm: true },
        ],
      },
      preconditions: [
        {
          id: "submit_fields_required",
          onTransition: "submit",
          source: "invariant",
          level: "block",
          why: "The promise date is the only start of the overdue reminder; the shipping warehouse is left out on purpose",
          check: { primitive: "required_fields", fields: ["promiseDate"] },
        },
      ],
      views: {
        list: { columns: ["code", "status"] },
        form: [{ title: "Basics", fields: ["code", "customerId", "promiseDate", "warehouseId"] }],
      },
    });

    // Premise: these two cells** are not** `required`(required will be compiled as NOT NULL column, the draft will not be saved)
    const fieldOf = (key: string) => schema.fields.find((f) => f.key === key);
    expect(fieldOf("warehouseId")?.required).toBe(false);
    expect(fieldOf("promiseDate")?.required).toBe(false);

    // second tranche is closed; the warehouse is really optional.
    const got = transitionRequiredFieldsOf(schema);
    expect(got.has("warehouseId")).toBe(false);
    expect(edgesOf(got, "promiseDate")).toEqual(["submit"]);
    // the one that needs to be in the vault without this projection: it's already in the first tranche.
    expect(got.has("customerId")).toBe(false);
  });
});
