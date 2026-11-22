// ---------------------------------------------------------------------------
// Tenant-configurable choice sets — the product declares which dictionaries exist;
// the tenant stores only overrides and added facts
// ---------------------------------------------------------------------------

import { assertClosedKeys, assertUniqueKeys, requireArray, requireEnum, requireObject, requireText, schemaFail } from "./common.js";

/** Display color of a dictionary item. Preset color names supported by antd Tag. */
export const CHOICE_SET_ITEM_COLORS = ["gray", "blue", "geekblue", "cyan", "green", "purple", "orange", "red", "gold", "magenta"] as const;
export type ChoiceSetItemColor = (typeof CHOICE_SET_ITEM_COLORS)[number];

/**
 * A product preset item. Array order is the product default order. Do not also declare
 * sortOrder; that would be a second ordering source of truth.
 * code is the stable identity actually stored in business data; label is only the current product default display name.
 */
export interface ChoiceSetItemSchema {
  readonly code: string;
  readonly label: string;
  readonly color?: ChoiceSetItemColor;
  /**
   * Product-level permanent tombstone, only for historical or reserved identities that
   * already existed when the identity artifact was first adopted. A published active item
   * must not later become retired; enabling and disabling for the business is maintained
   * by the tenant only. A tombstone keeps the stable code and the historical display name,
   * but it is not an selectable candidate and cannot be restored. Source may omit it;
   * after normalize it is an explicit boolean.
   */
  readonly retired: boolean;
}

/** A product dictionary whose items a tenant may maintain. code is globally unique in the full product catalog. */
export interface ChoiceSetSchema {
  readonly code: string;
  readonly label: string;
  readonly items: readonly ChoiceSetItemSchema[];
}

const ITEM_KEYS = ["code", "label", "color", "retired"] as const;
const CHOICE_SET_KEYS = ["code", "label", "items"] as const;

/**
 * A dictionary code enters HTTP paths, audit resource keys, and Field.choiceSet, so it uses stable dotted lowerCamel.
 * The domain prefix is not a runtime inference rule. It only makes ownership obvious when the dictionary is shared across domains.
 */
const CHOICE_SET_CODE = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;
const CHOICE_SET_ITEM_CODE = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

/** The same stable-code check for tenant-added items and product preset items. No label alias and no legacy-value compatibility. */
export function isChoiceSetItemCode(value: unknown): value is string {
  return typeof value === "string" && CHOICE_SET_ITEM_CODE.test(value);
}

/** Declaration-side normalize entry. If runtime needs to keep the user's input-error classification, reuse isChoiceSetItemCode directly. */
export function normalizeChoiceSetItemCode(value: unknown, label = "choiceSet item code"): string {
  const code = requireText(value, label);
  if (!isChoiceSetItemCode(code)) {
    schemaFail(`${label} "${code}" must start with an ASCII letter and contain only letters, digits, dots, underscores, or hyphens, length 1–64`);
  }
  return code;
}

export function normalizeChoiceSet(raw: unknown, at = "choiceSet"): ChoiceSetSchema {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, CHOICE_SET_KEYS, at);
  const code = requireText(obj["code"], `${at}.code`);
  if (!CHOICE_SET_CODE.test(code)) {
    schemaFail(`${at}.code "${code}" must be dotted lowerCamel (for example sales.orderSource), for stable references and audit`);
  }
  const label = requireText(obj["label"], `${at}.label`);
  const rawItems = requireArray(obj["items"], `${at}.items`);
  if (rawItems.length === 0) {
    schemaFail(`${at}.items must contain at least one product preset item — an empty dictionary leaves every bound required field with no starting candidate`);
  }
  const items = rawItems.map((rawItem, index): ChoiceSetItemSchema => {
    const itemAt = `${at}.items[${String(index)}]`;
    const item = requireObject(rawItem, itemAt);
    assertClosedKeys(item, ITEM_KEYS, itemAt);
    return {
      code: normalizeChoiceSetItemCode(item["code"], `${itemAt}.code`),
      label: requireText(item["label"], `${itemAt}.label`),
      ...(item["color"] === undefined || item["color"] === null
        ? {}
        : { color: requireEnum(item["color"], CHOICE_SET_ITEM_COLORS, `${itemAt}.color`) }),
      retired: item["retired"] === undefined
        ? false
        : typeof item["retired"] === "boolean"
          ? item["retired"]
          : schemaFail(`${itemAt}.retired must be a boolean; true means a product-level permanent retired tombstone`),
    };
  });
  assertUniqueKeys(items.map((item) => item.code), `${at}.items.code`);
  assertUniqueKeys(items.map((item) => item.label), `${at}.items.label`);
  if (items.every((item) => item.retired)) {
    schemaFail(`${at}.items must keep at least one product preset item that is not retired, or a bound field has no starting candidate`);
  }
  return { code, label, items };
}
