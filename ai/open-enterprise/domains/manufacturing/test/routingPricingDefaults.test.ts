import { type Field, isSystemSupplied, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import routingDraft from "../modules/routing.js";

const routing = sealModule(routingDraft, { code: "routing", domain: "manufacturing" });

const lineField = (key: string): Field => {
  const lines = routing.fields.find((field) => field.key === "lines");
  const hit = lines?.fields?.find((field) => field.key === key);
  if (!hit) throw new Error(`Routing lines have no "${key}"`);
  return hit;
};

describe("Choosing an operation on a routing prefills the operation master price", () => {
  it("the declaration passes the semantic gate", () => {
    expect(validateModule(routing).errors).toEqual([]);
  });

  it("create starts active, and the one active version per product is guaranteed by singleActiveWithin", () => {
    const active = routing.lifecycle.statuses.find((s) => s.key === "active");
    expect(active?.initial).toBe(true);
    expect(routing.lifecycle.statuses.some((s) => s.key === "draft")).toBe(false);
    expect(routing.lifecycle.transitions.some((t) => t.code === "activate")).toBe(false);
    expect(routing.lifecycle.singleActiveWithin).toEqual({
      within: ["productId"],
      status: "active",
      supersedeTo: "disabled",
    });
    for (const id of [
      "lines_required",
      "sequence_positive",
      "piece_rate_non_negative",
      "routing_product_makeable",
    ]) {
      const rule = routing.preconditions.find((pc) => pc.id === id);
      expect(rule?.onCreate).toBe(true);
      expect(rule?.onTransition).toBe("*");
    }
  });

  it("pieceRate is prefilled from operation and may be overridden", () => {
    const field = lineField("pieceRate");
    expect(field.refDefault).toEqual({
      from: "operation",
      match: "operationId",
      through: null,
      field: "pieceRate",
    });
    expect(field.snapshot).toBeNull();
    expect(field.required).toBe(true);
    expect(isSystemSupplied(field)).toBe(false);
  });

  it.each([
    ["defaultTeamId", "defaultTeamId"],
    ["assignmentRatio", "assignmentRatio"],
    ["requiresApproval", "requiresApproval"],
  ] as const)("%s is prefilled from the operation master and may be overridden per product", (target, source) => {
    const field = lineField(target);
    expect(field.refDefault).toEqual({
      from: "operation",
      match: "operationId",
      through: null,
      field: source,
    });
    expect(field.snapshot).toBeNull();
    expect(isSystemSupplied(field)).toBe(false);
  });

  it("the 1:1 assignment ratio is required; needs approval is optional", () => {
    expect(lineField("assignmentRatio").required).toBe(true);
    expect(lineField("requiresApproval").label).toBe("Needs approval");
    expect(lineField("requiresApproval").required).toBeFalsy();
  });

  it("the time unit stays frozen from the operation master", () => {
    const field = lineField("hourlyRateUnit");
    expect(field.snapshot).toEqual({
      from: "operation",
      match: "operationId",
      through: null,
      field: "hourlyRateUnit",
    });
    expect(isSystemSupplied(field)).toBe(true);
  });
});
