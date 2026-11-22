// the flow sheet -- it's the only definition**: HTTP presses it out, storage presses it release.
//
// 🔴 These are the ones that "write one in one place" are not valid: the interface is a set of buttons, the back end is a set, and the other is a set of buttons.
// the performance is that the buttons go down and the request is rejected — and the users have no idea what they did wrong.
// so, "what moves can be made from this state" must be a check-up, not if it's written in two places.

import { describe, expect, it } from "vitest";
import {
  actionsFrom, isFlowAction, isFlowEditable,
  FLOW_ACTIONS, FLOW_ACTION_KEYS, FLOW_STATUSES, FLOW_STATUS_LABELS,
} from "../src/index.js";

describe("FLOW_ACTIONS", () => {
  it("six actions, covering all legal flow between four states.", () => {
    expect([...FLOW_ACTION_KEYS].sort()).toEqual(
      ["approve", "devDone", "needDev", "reject", "revise", "submit"].sort(),
    );
  });

  it("every action from/to is in four states - no fifth state.", () => {
    const statuses = new Set(["draft", "review", "dev", "published"]);
    for (const key of FLOW_ACTION_KEYS) {
      const spec = FLOW_ACTIONS[key];
      for (const from of spec.from) expect(statuses.has(from)).toBe(true);
      expect(statuses.has(spec.to)).toBe(true);
    }
  });

  it("🔴 No direct change from published", () => {
    expect(actionsFrom("published")).toEqual(["revise"]);
  });

  it("you can submit it, you can't mark it.", () => {
    expect([...actionsFrom("draft")].sort()).toEqual(["needDev", "submit"]);
  });

  it("nuclear power passed, rejected, and could not be marked.", () => {
    expect([...actionsFrom("review")].sort()).toEqual(["approve", "needDev", "reject"]);
  });

  it("there's only one way to go before it's completed: the development has been completed and the markings have been completed and the organization returned Medium", () => {
    expect(actionsFrom("dev")).toEqual(["devDone"]);
    expect(FLOW_ACTIONS.devDone.to).toBe("draft");
  });

  it("🔴 There's no reason to deny it, except to submit it.", () => {
    expect(FLOW_ACTIONS.submit.needReason).toBe(false);
    for (const key of FLOW_ACTION_KEYS) {
      if (key === "submit") continue;
      expect(FLOW_ACTIONS[key].needReason).toBe(true);
    }
  });

  it("every state can go out -- no way in or out.", () => {
    for (const status of ["draft", "review", "dev", "published"] as const) {
      expect(actionsFrom(status).length).toBeGreaterThan(0);
    }
  });

  it("🔴 Can the content be changed by the status machine -- only \"in the set\" and the verdict is not more than literally", () => {
    expect(isFlowEditable("draft")).toBe(true);
    for (const status of ["review", "dev", "published"] as const) {
      expect(isFlowEditable(status), `${status} must not be directly editable`).toBe(false);
    }
  });

  it("four, key, in English -- it's a frame asset, not on any business documents.", () => {
    expect([...FLOW_STATUSES]).toEqual(["draft", "review", "dev", "published"]);
    // 🔴 There is no archive: history is in the revision form. One more finality will only explain the "restoration" entrance.
    expect(FLOW_STATUSES).not.toContain("archived");
    expect(FLOW_STATUS_LABELS.dev).toBe("Needs completion");
  });

  it("shows a name that does not collid with the file state - \"Delivering\" is not a \"pendingreview\"", () => {
    for (const status of FLOW_STATUSES) {
      expect(FLOW_STATUS_LABELS[status]?.length ?? 0).toBeGreaterThan(1);
    }
    expect(Object.values(FLOW_STATUS_LABELS)).not.toContain("pendingReview");
    expect(FLOW_STATUS_LABELS.review).toBe("In review");
  });

  it("it's only six.", () => {
    expect(isFlowAction("approve")).toBe(true);
    expect(isFlowAction("archive")).toBe(false);
    expect(isFlowAction("save")).toBe(false); // save is content saving, not status action
  });
});
