import { evaluateTransition, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import orgUnitDraft from "../modules/orgUnit.js";

const orgUnit = sealModule(orgUnitDraft, { code: "orgUnit", domain: "manufacturing" });

const NOW = new Date("2026-07-30T00:00:00.000Z");
const ACTOR = { id: "planner-1" };

async function decide(
  bill: Record<string, unknown>,
  edge: "enable" | "disable",
): Promise<Awaited<ReturnType<typeof evaluateTransition>>> {
  return evaluateTransition(
    {
      module: orgUnit,
      bill: { id: "org-under-test", ...bill },
      lines: [],
      params: {},
      actor: ACTOR,
      now: NOW,
      query: { get: async () => null, list: async () => [], balance: async () => 0 },
    },
    edge,
  );
}

describe("Organization: create starts active, with no parent-child type check", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(orgUnit).errors).toEqual([]);
  });

  it("organization type uses the manufacturing dictionary, with no hardcoded options", () => {
    const orgType = orgUnit.fields.find((field) => field.key === "orgType");
    expect(orgType).toMatchObject({
      type: "enum",
      choiceSet: "manufacturing.orgType",
      options: null,
      required: true,
    });
  });

  it("the owner is a system person identity, not a production-worker file reference", () => {
    const leader = orgUnit.fields.find((field) => field.key === "leaderWorkerId");
    expect(leader).toMatchObject({
      type: "ref",
      ref: "subject",
      label: "Owner",
      refFilter: { status: "active" },
      person: { role: "owner", via: "self" },
    });
  });

  it("the initial state is active, with no draft and no activate edge", () => {
    const initial = orgUnit.lifecycle.statuses.find((s) => s.initial);
    expect(initial?.key).toBe("active");
    expect(orgUnit.lifecycle.statuses.some((s) => s.key === "draft")).toBe(false);
    expect(orgUnit.lifecycle.transitions.some((edge) => edge.code === "activate")).toBe(false);
    expect(orgUnit.lifecycle.transitions.map((edge) => edge.code).sort()).toEqual(["disable", "enable"]);
  });

  /**
   * This gate judges what is locked, not "exactly these cells".
   * Descriptive fields can be edited. `parentOrgId` can change too (skip-level is not blocked yet).
   * What must not move is `orgType`. Changing the type after it is stored makes downstream references that filter by code drift.
   */
  it("the active whitelist locks only the type: descriptive fields and the parent can be edited, orgType cannot", () => {
    const active = orgUnit.lifecycle.statuses.find((s) => s.key === "active");
    expect(active).toMatchObject({ editable: "whitelist" });
    expect(active?.editableFields).toEqual(["name", "parentOrgId", "address", "contactPhone", "leaderWorkerId", "remark"]);
    expect(active?.editableFields).not.toContain("orgType");
  });

  it("after disable, descriptive fields and the parent can still be edited, and the type stays locked", () => {
    const disabled = orgUnit.lifecycle.statuses.find((s) => s.key === "disabled");
    expect(disabled).toMatchObject({ editable: "whitelist" });
    expect(disabled?.editableFields).toEqual(["name", "parentOrgId", "address", "contactPhone", "leaderWorkerId", "remark"]);
    expect(disabled?.editableFields).not.toContain("orgType");
  });

  it("the tree gate is gone: enable has no parent-child type rule and no parent-required rule", () => {
    expect(orgUnit.preconditions.filter((rule) => rule.onTransition === "activate")).toEqual([]);
    expect(orgUnit.preconditions.filter((rule) => rule.onTransition === "enable")).toEqual([]);
    expect(orgUnit.preconditions.map((rule) => rule.id).sort()).toEqual(["no_active_child_org", "no_bound_worker"]);
  });

  it("re-enable does not check the parent type, and a skip-level parent still passes", async () => {
    const decision = await decide(
      { status: "disabled", name: "Skip-level team", orgType: "team", parentOrgId: "factory-1" },
      "enable",
    );
    expect(decision.verdict.pass).toBe(true);
  });

  it("a factory with a parent can still be re-enabled; this stage does not block a root from hanging under a parent", async () => {
    const decision = await decide(
      { status: "disabled", name: "Wrong factory", orgType: "factory", parentOrgId: "porg-other" },
      "enable",
    );
    expect(decision.verdict.pass).toBe(true);
  });

  it("add existing workers hangs only on the team code, not on a display name", () => {
    expect(orgUnit.views.attachExisting).toEqual([
      { path: "worker.productionOrgId", label: "Add existing workers", targetLabel: "Workers", hostFilter: { orgType: "team", status: "active" } },
    ]);
  });
});
