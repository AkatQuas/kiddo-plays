// ---------------------------------------------------------------------------
// Module settings — product code declares the optional business branches;
// the tenant stores only the current choice
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireCoordinateSegment,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";
import { normalizeChoiceSetItemCode } from "./choiceSet.js";

export interface ModuleSettingOptionSchema {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
}

export interface ModuleSettingChangeGuardSchema {
  readonly kind: "noOpenBills";
  /** Module that must have no open documents before the setting can change. */
  readonly module: string;
}

/**
 * One module setting implemented and published by code.
 *
 * The definition, options, and default belong to product code. The runtime database
 * may store only the tenant's selected option code, the revision, and the audit.
 * Every option must correspond to a real code branch. The database must not become a second metamodel.
 */
export interface ModuleSettingSchema {
  /** Product-wide unique dotted lowerCamel stable identity, for example production.taskCompletionMode. */
  readonly code: string;
  /** Business module the setting belongs to, so system administration can filter by module. */
  readonly module: string;
  readonly label: string;
  readonly description: string;
  /** From which business moment the new value applies after save, declared by the domain that implements the branch. */
  readonly effectiveWhen: string;
  /** Business block checked before the value changes. Absent means a direct change is allowed. */
  readonly changeGuard: ModuleSettingChangeGuardSchema | null;
  readonly options: readonly ModuleSettingOptionSchema[];
  readonly defaultOption: string;
}

const SETTING_KEYS = ["code", "module", "label", "description", "effectiveWhen", "changeGuard", "options", "defaultOption"] as const;
const OPTION_KEYS = ["code", "label", "description"] as const;
const CHANGE_GUARD_KEYS = ["kind", "module"] as const;
const SETTING_CODE = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;

export function normalizeModuleSetting(raw: unknown, at = "moduleSetting"): ModuleSettingSchema {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SETTING_KEYS, at);
  const code = requireText(obj["code"], `${at}.code`);
  if (!SETTING_CODE.test(code)) {
    schemaFail(`${at}.code "${code}" must be dotted lowerCamel (for example production.taskCompletionMode)`);
  }
  const module = requireCoordinateSegment(obj["module"], `${at}.module`);
  const options = requireArray(obj["options"], `${at}.options`).map((rawOption, index): ModuleSettingOptionSchema => {
    const optionAt = `${at}.options[${String(index)}]`;
    const option = requireObject(rawOption, optionAt);
    assertClosedKeys(option, OPTION_KEYS, optionAt);
    const description = option["description"];
    if (description !== undefined && description !== null && typeof description !== "string") {
      schemaFail(`${optionAt}.description must be a string or null`);
    }
    return {
      code: normalizeChoiceSetItemCode(option["code"], `${optionAt}.code`),
      label: requireText(option["label"], `${optionAt}.label`),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
    };
  });
  if (options.length < 2) {
    schemaFail(`${at}.options must have at least two implemented branches; a single outcome should not be a setting`);
  }
  assertUniqueKeys(options.map((option) => option.code), `${at}.options.code`);
  assertUniqueKeys(options.map((option) => option.label), `${at}.options.label`);
  const defaultOption = normalizeChoiceSetItemCode(obj["defaultOption"], `${at}.defaultOption`);
  if (!options.some((option) => option.code === defaultOption)) {
    schemaFail(`${at}.defaultOption "${defaultOption}" is not in options`);
  }
  const rawChangeGuard = obj["changeGuard"];
  let changeGuard: ModuleSettingChangeGuardSchema | null = null;
  if (rawChangeGuard !== undefined && rawChangeGuard !== null) {
    const guard = requireObject(rawChangeGuard, `${at}.changeGuard`);
    assertClosedKeys(guard, CHANGE_GUARD_KEYS, `${at}.changeGuard`);
    if (guard["kind"] !== "noOpenBills") {
      schemaFail(`${at}.changeGuard.kind accepts only "noOpenBills"`);
    }
    changeGuard = {
      kind: "noOpenBills",
      module: requireCoordinateSegment(guard["module"], `${at}.changeGuard.module`),
    };
  }
  return {
    code,
    module,
    label: requireText(obj["label"], `${at}.label`),
    description: requireText(obj["description"], `${at}.description`),
    effectiveWhen: requireText(obj["effectiveWhen"], `${at}.effectiveWhen`),
    changeGuard,
    options,
    defaultOption,
  };
}
