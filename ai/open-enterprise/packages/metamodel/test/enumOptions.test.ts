import { describe, expect, it } from "vitest";
import {
  enumFieldOptions,
  enumOptionLabel,
  enumOptionNeedsFacingLabel,
  normalizeField,
} from "../src/index.js";

describe("value / label of static enum", () => {
  it("string candidate equals {value, label}, the text takes value", () => {
    const field = normalizeField({ key: "direction", type: "enum", options: ["Receive", "Ship"] });
    expect(field.options).toEqual([
      { value: "Receive", label: "Receive" },
      { value: "Ship", label: "Ship" },
    ]);
    expect(enumFieldOptions(field)).toEqual(field.options);
  });

  it("the candidate places the stable code in the same category as the Chinese script.", () => {
    const field = normalizeField({
      key: "sourceType",
      type: "enum",
      options: ["Manual", { value: "salesDelivery", label: "Sales shipment" }],
    });
    expect(field.options).toEqual([
      { value: "Manual", label: "Manual" },
      { value: "salesDelivery", label: "Sales shipment" },
    ]);
    expect(enumOptionLabel(field, "salesDelivery")).toBe("Sales shipment");
    expect(enumOptionLabel(field, "Manual")).toBe("Manual");
    expect(enumFieldOptions(field)).toEqual(field.options);
  });

  it("refusal to repeat values, duplicate files and redundant keys", () => {
    expect(() => normalizeField({
      key: "sourceType",
      type: "enum",
      options: [
        { value: "salesDelivery", label: "Sales shipment" },
        { value: "salesDelivery", label: "Sales issue" },
      ],
    })).toThrow(/declared "salesDelivery"|salesDelivery/);
    expect(() => normalizeField({
      key: "sourceType",
      type: "enum",
      options: [
        { value: "salesDelivery", label: "Sales shipment" },
        { value: "purchaseReceipt", label: "Sales shipment" },
      ],
    })).toThrow(/declared "Sales shipment" more than once/);
    expect(() => normalizeField({
      key: "sourceType",
      type: "enum",
      options: [{ value: "salesDelivery", label: "Sales shipment", extra: true }],
    })).toThrow(/unknown key/);
  });

  it("a system code needs its own facing label; a unit symbol or non-ASCII prose does not", () => {
    expect(enumOptionNeedsFacingLabel("salesDelivery")).toBe(true);
    expect(enumOptionNeedsFacingLabel("SI_INVENTORY_GAIN")).toBe(true);
    expect(enumOptionNeedsFacingLabel("legacy")).toBe(true);
    expect(enumOptionNeedsFacingLabel("café")).toBe(false);
    expect(enumOptionNeedsFacingLabel("kg")).toBe(false);
    expect(enumOptionNeedsFacingLabel("L")).toBe(false);
  });
});
