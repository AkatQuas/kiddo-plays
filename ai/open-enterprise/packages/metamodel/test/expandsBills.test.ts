import { describe, expect, it } from "vitest";
import { normalizeFixtureModule, withPlannerExpansion, type ModuleSchema } from "../src/index.js";

/**
 * `Transition.expandsBills` - Won't this side be ** bulk billed**.
 *
 :: With `postsToLedger` It's the same rule. It's not. `TRANSITION_KEYS` Lee, the interface is determined by it.
 * "Do you want to make a call first" and the verdict must come from the statement - from running time `executionPlan` The verdict is...
 * fail-open, on the same side of the list, which happened to be empty, left the window open and showed no symptoms.
 *
 :: With `postsToLedger` ** Different ** only returns points: second source of the article (reverseOn by side)
 * See in the same lifecycle,`normalizeLifecycle` That's what I'm talking about.
 * `modules/<code>/index.ts` Export of Name `planners` It's not in the module statement.
 * So by loader `withPlannerExpansion` Backfill.
 */

function moduleWith(transitions: readonly unknown[]): ModuleSchema {
  return normalizeFixtureModule({
    code: "alpha",
    label: "Document A",
    domain: "d1",
    fields: [{ key: "code", label: "Code", type: "string", primary: true }],
    lifecycle: {
      statuses: [
        { key: "draft", label: "draft", initial: true },
        { key: "done", label: "Released", terminal: true },
      ],
      transitions,
    },
    views: { list: { columns: ["code"] } },
  });
}

const EDGES = [
  { code: "releaseMerged", from: "draft", to: "done", action: "Release merged" },
  { code: "releaseSeparate", from: "draft", to: "done", action: "Release separately" },
  { code: "cancel", from: "draft", to: "done", action: "Cancel", confirm: true },
];

const by = (module: ModuleSchema, code: string): boolean => {
  const found = module.lifecycle.transitions.find((t) => t.code === code);
  if (found === undefined) throw new Error(`the case has no edge "${code}"`);
  return found.expandsBills;
};

describe("backfill for extandsbils", () => {
  it("🔴 Normalize the constant layer -- it can't see Planners, not the \"no bill on this side\" conclusion", () => {
    const module = moduleWith(EDGES);
    expect(module.lifecycle.transitions.map((t) => t.expandsBills)).toEqual([false, false, false]);
  });

  it("the ones that hung up Planner's turn true, with the rest of the module.", () => {
    const expanded = withPlannerExpansion(moduleWith(EDGES), new Set(["releaseMerged", "releaseSeparate"]));
    expect(by(expanded, "releaseMerged")).toBe(true);
    expect(by(expanded, "releaseSeparate")).toBe(true);
    // backfill ** Edges** do not press modules: no parallels of Planner in the same directory form module
    expect(by(expanded, "cancel")).toBe(false);
  });

  /** * Zero Planners ** returns the same object in its present form ** and does not even spread — most modules are in this form. */
  it("zero planners return as they are, do not create objects", () => {
    const module = moduleWith(EDGES);
    expect(withPlannerExpansion(module, new Set())).toBe(module);
  });

  /**
   * fail-fast: Loader has checked "planners.X point to unknown transfer"
   * "Model table changed between two steps" ansert. Quietly skipping is that side forever.
   * another zero symptom of fail-open.
   */
  it("🔴 Point to the non-existent side and throw, and skip.", () => {
    expect(() => withPlannerExpansion(moduleWith(EDGES), new Set(["nope"]))).toThrow(/nope/);
  });

  /**
   :: With `postsToLedger` It's the same word for word: the thrust key is not the seventh concept, and a statement will be blocked.
   * The result of refusal is a copy And... `expandsBills: false` On the line JSON,
   * Turn off the "quantity of the bill first" quietly. Same `bypass-gate` That thing with nails.
   */
  it("write in the statement that extandsbils are closed -- it's not the seventh concept, it's a projection of planners", () => {
    expect(() =>
      moduleWith([{ code: "releaseMerged", from: "draft", to: "done", action: "Release merged", expandsBills: true }]),
    ).toThrow(/expandsBills/);
  });
});
