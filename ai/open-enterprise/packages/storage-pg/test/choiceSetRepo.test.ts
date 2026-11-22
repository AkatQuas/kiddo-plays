import type { RuntimeChoiceSet } from "@open-erp/runtime-core";
import { describe, expect, it } from "vitest";
import {
  ChoiceSetConfigurationError,
  ChoiceSetInputError,
  assertChoiceSetItemStatus,
  assertEffectiveChoiceSetMutation,
  mergeChoiceSetItems,
  nextChoiceSetSortOrder,
  type StoredChoiceSetItemFact,
} from "../src/repo/choiceSetRepo.js";

const definition: RuntimeChoiceSet = {
  code: "demo.channel",
  label: "channel",
  items: [
    { code: "retail", label: "retail", retired: false },
    { code: "wholesale", label: "wholesale", retired: false },
  ],
};

function fact(overrides: Partial<StoredChoiceSetItemFact> = {}): StoredChoiceSetItemFact {
  return {
    id: "fact-1",
    itemCode: "partner",
    source: "custom",
    label: "partner",
    sortOrder: 1_500,
    status: "active",
    ...overrides,
  };
}

describe("product Default + Tenant Incremental Merge", () => {
  it("when the product later adds an active preset to the existing custom code", () => {
    const upgraded: RuntimeChoiceSet = {
      ...definition,
      items: [...definition.items, { code: "partner", label: "product partner channel", retired: false }],
    };

    expect(() => mergeChoiceSetItems(upgraded, [fact()]))
      .toThrow(ChoiceSetConfigurationError);
  });

  it("product retried tombstone with existing custom code", () => {
    const upgraded: RuntimeChoiceSet = {
      ...definition,
      items: [...definition.items, { code: "partner", label: "historical partner channel", retired: true }],
    };

    expect(() => mergeChoiceSetItems(upgraded, [fact()]))
      .toThrow(ChoiceSetConfigurationError);
  });

  it("retired tombstone preserve product label parsing historical values, but tenant active override is not restored", () => {
    const retired: RuntimeChoiceSet = {
      ...definition,
      items: [{ code: "retail", label: "historical retail", retired: true }, ...definition.items.slice(1)],
    };

    expect(mergeChoiceSetItems(retired, [fact({
      itemCode: "retail",
      source: "preset",
      label: null,
      sortOrder: null,
      status: "active",
    })])).toContainEqual({
      code: "retail",
      label: "historical retail",
      sortOrder: 1_000,
      status: "disabled",
      source: "preset",
      retired: true,
    });
    expect(() => assertChoiceSetItemStatus(retired, "retail", "active"))
      .toThrow(ChoiceSetInputError);
    expect(() => assertChoiceSetItemStatus(retired, "retail", "disabled"))
      .not.toThrow();
  });

  it("file remove existing preset fail-fast to avoid silent loss of historical resolution", () => {
    expect(() => mergeChoiceSetItems(definition, [fact({
      itemCode: "removedPreset",
      source: "preset",
      label: null,
      sortOrder: null,
      status: "disabled",
    })])).toThrow(ChoiceSetConfigurationError);
  });

  it("the current set can still be constructed when product upgrades cause zero activity; restoration of normal disabled can be repaired, unrecovered status denied", () => {
    const upgraded: RuntimeChoiceSet = {
      ...definition,
      items: [
        { code: "retail", label: "retail", retired: false },
        { code: "wholesale", label: "wholesale", retired: true },
      ],
    };
    const zeroActive = mergeChoiceSetItems(upgraded, [fact({
      itemCode: "retail",
      source: "preset",
      label: null,
      sortOrder: null,
      status: "disabled",
    })]);
    expect(zeroActive.every((item) => item.status === "disabled")).toBe(true);
    expect(() => assertEffectiveChoiceSetMutation(upgraded.code, zeroActive))
      .toThrow(/must keep at least one enabled item/);

    const repaired = zeroActive.map((item) => item.code === "retail"
      ? { ...item, status: "active" as const }
      : item);
    expect(() => assertEffectiveChoiceSetMutation(upgraded.code, repaired)).not.toThrow();
    expect(() => assertEffectiveChoiceSetMutation(upgraded.code, zeroActive.map((item) => ({
      ...item,
      sortOrder: item.sortOrder + 10,
    })))).toThrow(/must keep at least one enabled item/);
  });

  it("do not continue a label-as-code as the default or custom value", () => {
    expect(() => mergeChoiceSetItems(definition, [fact({ itemCode: "retail label" })]))
      .toThrow(/accept only a stable code/);
  });

  it("repeated facts and cross-border ranking of the same tenant item", () => {
    expect(() => mergeChoiceSetItems(definition, [fact(), fact({ id: "fact-2" })]))
      .toThrow(/has a duplicate fact/);
    expect(() => mergeChoiceSetItems(definition, [fact({ sortOrder: -1 })]))
      .toThrow(/has an illegal sortOrder/);
  });

  it("the default sorting is also done before entering the library.", () => {
    expect(() => nextChoiceSetSortOrder([{ sortOrder: 2_147_483_647 }]))
      .toThrow(ChoiceSetInputError);
  });
});
