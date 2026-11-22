import { checkNewBill, coerceWriteValue, sealModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import routingDraft from "../modules/routing.js";

const routing = sealModule(routingDraft, { code: "routing", domain: "manufacturing" });

const HEADER = { productId: "p-1", version: "V1.0", processType: "Sequential production" };
const LINE = {
  sequence: 1,
  operationId: "op-1",
  pieceRate: 1,
  hourlyRate: 1,
  standardTimePerPiece: 1,
  defaultTeamId: "team-1",
  assignmentRatio: 1,
  outsourcingMode: "No subcontract",
};

describe("Routing line needs approval: the value gate still accepts only a boolean", () => {
  it("a string or 1 entering the value gate is TYPE_MISMATCH, and the path is lines[].requiresApproval", () => {
    const asString = checkNewBill(routing, HEADER, {
      lines: [{ ...LINE, requiresApproval: "true" }],
    });
    expect(asString.ok).toBe(false);
    if (asString.ok) return;
    expect(asString.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "lines[0].requiresApproval",
          code: "TYPE_MISMATCH",
        }),
      ]),
    );

    const asNumber = checkNewBill(routing, HEADER, {
      lines: [{ ...LINE, requiresApproval: 1 }],
    });
    expect(asNumber.ok).toBe(false);
    if (asNumber.ok) return;
    expect(asNumber.issues.some((issue) => issue.path === "lines[0].requiresApproval" && issue.code === "TYPE_MISMATCH")).toBe(
      true,
    );
  });

  it("the write edge coerces before the value gate: true and false are not strings", () => {
    const lines = routing.fields.find((field) => field.key === "lines");
    const field = lines?.fields?.find((column) => column.key === "requiresApproval");
    if (!field) throw new Error("routing.lines.requiresApproval must still be bool");
    expect(field.type).toBe("bool");
    expect(coerceWriteValue(field, "false")).toBe(false);
    expect(coerceWriteValue(field, "1")).toBe(true);

    const checked = checkNewBill(routing, HEADER, {
      lines: [{ ...LINE, requiresApproval: coerceWriteValue(field, "false") }],
    });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.lines["lines"]?.[0]?.["requiresApproval"]).toBe(false);
  });
});
