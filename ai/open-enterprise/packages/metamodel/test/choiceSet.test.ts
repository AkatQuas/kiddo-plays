import { describe, expect, it } from "vitest";
import {
  isChoiceSetItemCode,
  normalizeChoiceSetItemCode,
  defineFixtureDomain,
  normalizeField,
} from "../src/index.js";

describe("the product declaration tenant can configure dictionary", () => {
  it("domain is the default trueness of the item, the array order is the default order", () => {
    const domain = defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [
        {
          code: "sales.orderSource",
          label: "Order source",
          items: [
            { code: "retail", label: "Retail" },
            { code: "b2b", label: "Enterprise" },
          ],
        },
      ],
    });
    expect(domain.choiceSets).toEqual([
      {
        code: "sales.orderSource",
        label: "Order source",
        items: [
          { code: "retail", label: "Retail", retired: false },
          { code: "b2b", label: "Enterprise", retired: false },
        ],
      },
    ]);
  });

  it("options / choiceSet / unitChoice must and can only have one candidate", () => {
    expect(normalizeField({ key: "source", type: "enum", choiceSet: "sales.orderSource" })).toMatchObject({
      options: null,
      choiceSet: "sales.orderSource",
      unitChoice: null,
    });
    expect(() => normalizeField({ key: "source", type: "enum" })).toThrow(
      /must declare exactly one of options, choiceSet, and unitChoice/,
    );
    expect(() => normalizeField({
      key: "source",
      type: "enum",
      options: ["retail"],
      choiceSet: "sales.orderSource",
    })).toThrow(/choiceSet is mutually exclusive with options and unitChoice/);
    expect(() => normalizeField({ key: "source", type: "string", choiceSet: "sales.orderSource" })).toThrow(
      /choiceSet is meaningful only on an enum field/,
    );
  });

  it("the dictionary code, oritem code is closed to the current label and is unique", () => {
    expect(() => defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{ code: "orderSource", label: "Order source", items: [{ code: "x", label: "X" }] }],
    })).toThrow(/dotted lowerCamel/);
    expect(() => defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [{ code: "x", label: "X" }, { code: "x", label: "Y" }],
      }],
    })).toThrow(/declared "x" more than once/);
    expect(() => defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [{ code: "x", label: "Same name" }, { code: "y", label: "Same name" }],
      }],
    })).toThrow(/declared "Same name" more than once/);
  });

  it("dictionary entries can be displayed in defined locations and reject unsupported colours", () => {
    const domain = defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [{ code: "retail", label: "Retail", color: "blue" }],
      }],
    });
    expect(domain.choiceSets[0]?.items[0]).toMatchObject({ code: "retail", color: "blue" });
    expect(() => defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [{ code: "retail", label: "Retail", color: "not-a-color" }],
      }],
    })).toThrow(/color/);
  });

  it("the product preset is shared with the tenant's new item.", () => {
    expect(isChoiceSetItemCode("LIVE")).toBe(true);
    expect(isChoiceSetItemCode("bankTransfer")).toBe(true);
    expect(isChoiceSetItemCode("region.cn-east_3")).toBe(true);
    expect(normalizeChoiceSetItemCode(" LIVE ")).toBe("LIVE");
    expect(isChoiceSetItemCode("Retail business")).toBe(false);
    expect(isChoiceSetItemCode("two words")).toBe(false);
    expect(isChoiceSetItemCode(`x${"0".repeat(64)}`)).toBe(false);
  });

  it("retired tombstone, and tombstone", () => {
    const domain = defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [
          { code: "retail", label: "Retail", retired: true },
          { code: "b2b", label: "Enterprise" },
        ],
      }],
    });
    expect(domain.choiceSets[0]?.items).toEqual([
      { code: "retail", label: "Retail", retired: true },
      { code: "b2b", label: "Enterprise", retired: false },
    ]);
    expect(() => defineFixtureDomain({
      code: "sales",
      label: "Sales",
      choiceSets: [{
        code: "sales.orderSource",
        label: "Order source",
        items: [{ code: "retail", label: "Retail", retired: true }],
      }],
    })).toThrow(/at least one product preset item that is not retired/);
  });
});
