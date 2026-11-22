import { isSystemSupplied, sealModule, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import defectTypeDraft from "../modules/defectType.js";
import operationDraft from "../modules/operation.js";

const defectType = sealModule(defectTypeDraft, { code: "defectType", domain: "manufacturing" });
const operation = sealModule(operationDraft, { code: "operation", domain: "manufacturing" });

const field = (key: string) => {
  const hit = defectType.fields.find((f) => f.key === key);
  if (!hit) throw new Error(`Defect types have no "${key}"`);
  return hit;
};

describe("Defect configuration: the dictionary work-report defects are attributed to", () => {
  it("passes the declaration semantic gate", () => {
    expect(validateModule(defectType).errors).toEqual([]);
  });

  // Master data uses `"tenant"`. A date segment is what you get when a sequence is continuous only within one day.
  // "Entry date" is not an attribute of a defect item. Once it is baked into the code it can never be changed.
  it("codes run continuously per tenant, with no date segment, the same rule as operation", () => {
    expect(defectType.numbering).toEqual({ prefix: "DEFECT", seqScope: "tenant" });
    expect(defectType.numbering?.seqScope).toBe(operation.numbering?.seqScope);
    expect(isSystemSupplied(field("code"))).toBe(true);
  });

  // Single-state, not a bool pretending to be a status. An `is_enabled` shape makes "enabled"
  // live on both a field and a status, while permissions, editability, and buttons read only the status.
  it("is single-state master data, with no bool pretending to be an enabled flag", () => {
    expect(defectType.lifecycle.statuses.map((s) => s.key)).toEqual(["active"]);
    expect(defectType.lifecycle.transitions).toEqual([]);
    expect(defectType.fields.some((f) => f.type === "bool")).toBe(false);
  });

  // A defect item appears by name in the work-report dialog. Two with the same name make the reporter pick one at random,
  // and their categories may differ. The defect rate rolled up by category still looks completely normal.
  it("defect name is unique in the tenant, and category is a closed set", () => {
    expect(field("name")).toMatchObject({ type: "string", required: true, unique: true });
    expect(field("category")).toMatchObject({ type: "enum", required: true });
    expect(field("category").options?.map((option) => option.value)).toEqual([
      "Quality defect",
      "Equipment issue",
      "Material issue",
      "Process issue",
      "Other issue",
    ]);
  });
});
