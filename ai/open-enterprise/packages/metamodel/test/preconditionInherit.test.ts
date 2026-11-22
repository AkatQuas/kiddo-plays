// ---------------------------------------------------------------------------
// the exit side inherits the gate at the starting point.
//
// it's a regression line for ** actually measured **, not hypothetical:
//   `salesDelivery.confirm` This post is part of our special coverage Libya Protests 2011.
//   And its route exit `confirm_over_stock`(The one that was changed when the stock was insufficient)
//   so a super-fast-out bill confirms the past from the exception, and the goods and the accounts follow.
//   The same hole. `stockOut.confirm_over_stock` Exists (n = 2).
//
// The root causes are structural: the gate. `onTransition` Hanging, and the exit of route is the same as the end.
// alternative path**, default inheritance of zero. An exit set up to bypass the A gate, then bypassed B, C, D.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { ALL_TRANSITIONS, resolvePreconditions, type Precondition } from "../src/index.js";

/** Build only the keys `resolvePreconditions` actually reads, not a whole module. */
function pc(over: Partial<Precondition> & Pick<Precondition, "id" | "onTransition">): Precondition {
  return {
    onCreate: false,
    source: "gate",
    level: "block",
    exit: null,
    check: null,
    when: null,
    message: null,
    why: "",
    enabled: true,
    ...over,
  };
}

function mod(...preconditions: Precondition[]): { readonly preconditions: readonly Precondition[] } {
  return { preconditions };
}

const idsOf = (rs: readonly { rule: Precondition }[]): string[] => rs.map((r) => r.rule.id);

describe("the exit side inherits the gate at the starting point, except the one that counts as the exit.", () => {
  // the smallest shape of a route gate + an exit side: Approve takes two gates, one of which is route to approve exception
  const routeShape = mod(
    pc({ id: "customer_active", onTransition: "approve" }),
    pc({ id: "payable_within_limit", onTransition: "approve", level: "route", exit: "approve_exception" }),
    pc({ id: "exception_needs_manager", onTransition: "approve_exception" }),
  );

  it("\"Customs are disabled\" by the exception.", () => {
    const got = resolvePreconditions(routeShape, "approve_exception");
    expect(idsOf(got)).toContain("customer_active");
  });

  it("but I can't get the one that took it as an exit -- that's why it exists.", () => {
    const got = resolvePreconditions(routeShape, "approve_exception");
    expect(idsOf(got)).not.toContain("payable_within_limit");
  });

  it("it's a self-declared gate. It's marked \"non-inheritance.\"", () => {
    const got = resolvePreconditions(routeShape, "approve_exception");
    const own = got.find((r) => r.rule.id === "exception_needs_manager");
    expect(own?.inheritedFrom).toBeNull();
  });

  it("the inherited gate points out the source -- a rule that's not written on the side of it, one has to see where it came from.", () => {
    const got = resolvePreconditions(routeShape, "approve_exception");
    expect(got.find((r) => r.rule.id === "customer_active")?.inheritedFrom).toBe("approve");
  });

  it("the starting point is not affected by itself: it does not inherit anything.", () => {
    expect(idsOf(resolvePreconditions(routeShape, "approve")).sort()).toEqual([
      "customer_active",
      "payable_within_limit",
    ]);
  });
});

describe("the exclusions are deduced, not declared.", () => {
  it("both rules go to the same exit.", () => {
    // the exit is designed to be bypassed by all the rules that make it exit -- not so much.
    const m = mod(
      pc({ id: "keep_me", onTransition: "confirm" }),
      pc({ id: "route_a", onTransition: "confirm", level: "route", exit: "force" }),
      pc({ id: "route_b", onTransition: "confirm", level: "route", exit: "force" }),
    );
    expect(idsOf(resolvePreconditions(m, "force"))).toEqual(["keep_me"]);
  });

  it("the route to another place, the route rule, is inherited -- bypassing A is not like bypassing B.", () => {
    const m = mod(
      pc({ id: "route_to_x", onTransition: "confirm", level: "route", exit: "x" }),
      pc({ id: "route_to_y", onTransition: "confirm", level: "route", exit: "y" }),
    );
    // this exit may still be diverted again.
    expect(idsOf(resolvePreconditions(m, "x"))).toEqual(["route_to_y"]);
  });
});

describe("border", () => {
  it("the gates on all sides don't repeat the value of inheritance.", () => {
    const m = mod(
      pc({ id: "everywhere", onTransition: ALL_TRANSITIONS }),
      pc({ id: "r", onTransition: "a", level: "route", exit: "b" }),
    );
    expect(idsOf(resolvePreconditions(m, "b"))).toEqual(["everywhere"]);
  });

  it("if you declare the same id on this side, you shall have your own.", () => {
    const strict = pc({ id: "same", onTransition: "a", level: "block" });
    const relaxed = pc({ id: "same", onTransition: "b", level: "hint" });
    const m = mod(strict, relaxed, pc({ id: "r", onTransition: "a", level: "route", exit: "b" }));
    const got = resolvePreconditions(m, "b");
    expect(got).toHaveLength(1);
    expect(got[0]?.rule.level).toBe("hint");
    expect(got[0]?.inheritedFrom).toBeNull();
  });

  it("the locks that were shut down were not inherited or excluded.", () => {
    const m = mod(
      pc({ id: "off", onTransition: "a", enabled: false }),
      pc({ id: "on", onTransition: "a" }),
      pc({ id: "r", onTransition: "a", level: "route", exit: "b" }),
    );
    expect(idsOf(resolvePreconditions(m, "b"))).toEqual(["on"]);
  });

  it("inheritance by chain: a b b c, c with a gate and one that is bypassed along the way will not be revived", () => {
    const m = mod(
      pc({ id: "from_a", onTransition: "a" }),
      pc({ id: "a_to_b", onTransition: "a", level: "route", exit: "b" }),
      pc({ id: "from_b", onTransition: "b" }),
      pc({ id: "b_to_c", onTransition: "b", level: "route", exit: "c" }),
    );
    // `a_to_b` It's been ruled out during the analysis of b, so it can't reach c.
    // the exclusion is** accumulated along the chain**, not every jump is retried.
    expect(idsOf(resolvePreconditions(m, "c")).sort()).toEqual(["from_a", "from_b"]);
  });

  it("inheritedFrom is the source of the statement, not the previous jump.", () => {
    const m = mod(
      pc({ id: "from_a", onTransition: "a" }),
      pc({ id: "a_to_b", onTransition: "a", level: "route", exit: "b" }),
      pc({ id: "from_b", onTransition: "b" }),
      pc({ id: "b_to_c", onTransition: "b", level: "route", exit: "c" }),
    );
    const got = resolvePreconditions(m, "c");
    // the interface with Yarn Catalog directly describes this value as "inheritance from "x". Point to a jump b,
    // the user will look at the b statement - and from a it's not on b, the guidance points to something that doesn't exist.
    expect(got.find((r) => r.rule.id === "from_a")?.inheritedFrom).toBe("a");
    expect(got.find((r) => r.rule.id === "from_b")?.inheritedFrom).toBe("b");
  });

  it("the ring of each other's exits goes straight - there's no solution, no guess.", () => {
    const m = mod(
      pc({ id: "a_to_b", onTransition: "a", level: "route", exit: "b" }),
      pc({ id: "b_to_a", onTransition: "b", level: "route", exit: "a" }),
    );
    expect(() => resolvePreconditions(m, "a")).toThrow(/inheritance cycle/);
  });
});
