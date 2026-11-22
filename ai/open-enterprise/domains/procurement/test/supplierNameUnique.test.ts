import { sealModule, uniqueSitesOf, validateModule } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

import supplierDraft from "../modules/supplier.js";

const supplier = sealModule(supplierDraft, { code: "supplier", domain: "procurement" });

describe("supplier name is unique in the tenant; the short name is not", () => {
  it("the declaration passes the semantic gate; name is unique, shortName is not", () => {
    expect(validateModule(supplier).errors).toEqual([]);
    const name = supplier.fields.find((field) => field.key === "name");
    const shortName = supplier.fields.find((field) => field.key === "shortName");
    expect(name).toMatchObject({ type: "string", required: true, unique: true });
    expect(shortName?.unique).toBe(false);
  });

  it("uniqueSitesOf treats only the full name as the duplicate-check coordinate", () => {
    expect(uniqueSitesOf(supplier, { name: "Acme" })).toEqual([
      { key: "name", path: "name", label: "Supplier name", value: "Acme", with: [] },
    ]);
    expect(uniqueSitesOf(supplier, { shortName: "Acme" })).toEqual([]);
  });
});
