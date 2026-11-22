import { resolveListColumns, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import operationDraft from "../modules/operation.js";
import routingDraft from "../modules/routing.js";

const operation = sealModule(operationDraft, { code: "operation", domain: "manufacturing" });
const routing = sealModule(routingDraft, { code: "routing", domain: "manufacturing" });

describe("Operation definition list status", () => {
  it("default team and the 1:1 assignment ratio are required on create, and existing rows may still be empty", () => {
    for (const key of ["defaultTeamId", "assignmentRatio"] as const) {
      const field = operation.fields.find((item) => item.key === key);
      expect(field?.required).toBe(false);
      expect(field?.requiredOnManualCreate).toBe(true);
    }
  });

  it("the system does not inspect quality: neither the operation nor the routing exposes a needs-inspection field", () => {
    expect(operation.fields.some((field) => field.key === "requiresInspection")).toBe(false);
    const routingLines = routing.fields.find((field) => field.key === "lines");
    expect(routingLines?.fields?.some((field) => field.key === "requiresInspection")).toBe(false);
    expect(JSON.stringify(operation.views)).not.toContain("requiresInspection");
    expect(JSON.stringify(routing.views)).not.toContain("requiresInspection");
  });

  it("keeps the active single-state lifecycle and passes the declaration semantic gate", () => {
    expect(operation.lifecycle.statuses).toHaveLength(1);
    expect(operation.lifecycle.statuses[0]).toMatchObject({
      key: "active",
      label: "Active",
      color: "green",
      initial: true,
      terminal: true,
      editable: "full",
    });
    expect(operation.lifecycle.transitions).toEqual([]);
    expect(validateModule(operation).errors).toEqual([]);
  });

  it("the default list does not show status, but column settings can still restore it", () => {
    const defaults = resolveListColumns(operation, []);
    expect(defaults.defaults).not.toContain("status");
    expect(defaults.columns.map((column) => column.field)).not.toContain("status");
    expect(defaults.universe).toContain("status");

    const restored = resolveListColumns(operation, [
      { field: "status", hidden: false, width: null, order: null, summary: null },
    ]);
    expect(restored.columns.map((column) => column.field)).toContain("status");
  });
});
