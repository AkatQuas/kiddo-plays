import { sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import workerDraft from "../modules/worker.js";

const worker = sealModule(workerDraft, { code: "worker", domain: "manufacturing" });

describe("Production worker occupancy: left means disabled", () => {
  it("the module passes the declaration semantic gate", () => {
    expect(validateModule(worker).errors).toEqual([]);
  });

  it("the same pair of edges as supplier and product: disable / enable, and the labels are still active and left", () => {
    expect(worker.lifecycle.statuses).toEqual([
      expect.objectContaining({ key: "active", label: "Active", color: "green", initial: true }),
      expect.objectContaining({ key: "disabled", label: "Left", color: "gray", editable: "none" }),
    ]);
    expect(worker.lifecycle.transitions).toMatchObject([
      { code: "disable", from: "active", to: "disabled", action: "Mark as left", confirm: true },
      { code: "enable", from: "disabled", to: "active", action: "Reinstate" },
    ]);
    expect(worker.lifecycle.transitions.map((edge) => edge.code)).toEqual(["disable", "enable"]);
  });

  it("the open-assignment gate hangs on disable, and the copy still says left", () => {
    const gate = worker.preconditions.find((rule) => rule.id === "no_open_assignments");
    expect(gate).toMatchObject({
      onTransition: "disable",
      why: expect.stringContaining("marking them as left"),
    });
  });
});
