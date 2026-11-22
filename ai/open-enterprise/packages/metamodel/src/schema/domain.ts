// ---------------------------------------------------------------------------
// Domain declaration — a business domain says what it is called
//
// 🔴 Not a seventh concept: it does not live on a module. It is a declaration
// at the domain layer. A module's `domain` field points at the `code` here.
//
// Why this has to exist: a menu must show "Sales", not `SALES`. The name has
// only two possible sources — the domain declares it, or the frontend keeps a
// map `{ sales: "Sales" }`. The map is a second source of truth: adding a domain
// makes the menu silently show the code, renaming the domain does not update the
// map, and neither side reports an error.
//
// Domain-level declarations are an easy place to become a junk drawer (icons,
// sort, color, permissions, …). Every new key has to answer "why does this not
// belong on the module?". Menu grouping does not live on the domain.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireCoordinateSegment,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";
import { normalizeChoiceSet, type ChoiceSetSchema } from "./choiceSet.js";
import { normalizeModuleSetting, type ModuleSettingSchema } from "./moduleSetting.js";
import { normalizeDashboard, type DashboardSchema } from "./dashboard.js";

export interface DomainSchema {
  /**
   * Identity — not in the declaration. The loader derives it from the directory
   * name and `sealDomain` injects it. Writing it into the declaration is a second
   * copy of the same fact: renaming the directory would not update it, and neither side would report an error.
   */
  readonly code: string;
  /** Name shown in menus and docs */
  readonly label: string;
  /**
   * Whether this domain has business modules. Defaults to `true`.
   *
   * Declaring `false` means a support domain: it only provides an agent / skill
   * and contains no documents (`ops` is this kind; it ships the general in-product
   * assistant and meta-operation scripts). The loader uses this to decide whether a `modules/` directory is required.
   *
   * 🔴 Why an explicit declaration, not "no modules/ directory means a support domain":
   * the latter turns a typo such as `modules` spelled `module` into a silent zero-module
   * domain — that domain's documents disappear as a batch, and the loader says nothing.
   * Defaulting to true is the safe side, because a support domain that forgot to declare
   * itself hits a loud error ("domain X has no modules/ directory"), not silence.
   *
   * Same law as `lifecycle`: a degenerate shape must be declared (master data still
   * writes `singleState()`). Once something derived is treated as a declaration,
   * the validator starts validating its own output.
   */
  readonly modules: boolean;
  /**
   * Which business line this domain belongs to. Default = itself (the domain is a line).
   *
   * 🔴 Why this layer exists: a domain is a modeling cut (order management / operation
   * management / production receive are three domains, because their documents, state
   * machines, and gates differ), while a business person has only one line in mind,
   * "production management". Places shown to the business (flow groups, dashboard columns)
   * split by line; places shown to developers (module ownership, file paths) split by
   * domain — both are right, and they are not the same ruler.
   *
   * 🔴 It lives on the domain, not on the flow: which line a flow belongs to is decided
   * by the domain it sits in, not by a choice the flow makes. If it were a property of
   * the flow, two flows in the same domain could claim two lines, which has no business
   * meaning and only removes the criterion for grouping.
   */
  readonly line: { readonly code: string; readonly label: string } | null;
  /**
   * Tenant-configurable dictionaries owned by this domain. A field stores only the
   * choiceSet code, and it may be shared across modules and domains. Product defaults
   * stay in source; the tenant database stores only added and overridden facts.
   */
  readonly choiceSets: readonly ChoiceSetSchema[];
  /** Module settings owned by product code; the tenant database stores only the selected value, revision, and audit. */
  readonly moduleSettings: readonly ModuleSettingSchema[];
  /**
   * Dashboard surfaces declared by this domain (more than one is allowed).
   * `code` is globally unique and the loader merges them into catalog.dashboards.
   * The old key `dashboard` (one) and the new key `dashboards` (an array) are both accepted.
   */
  readonly dashboards: readonly DashboardSchema[];
}

/**
 * Product of the shape gate (`normalizeDomain`): keys are normalized, but there is no identity yet.
 *
 * Only someone who has the directory path (the loader) knows `code`, so it does not enter this layer.
 */
export type DomainShape = Omit<DomainSchema, "code">;

/**
 * Proof that the shape gate has passed. Same law, word for word, as `MODULE_DRAFT`.
 *
 * A Symbol, non-enumerable: it does not enter `JSON.stringify`, and gates that walk
 * `Object.keys` such as `assertClosedKeys` do not see it. Sealing drops it with the
 * spread — a sealed `DomainSchema` carries no proof, because nobody still needs to ask
 * "did you pass the shape gate?".
 */
export const DOMAIN_DRAFT: unique symbol = Symbol.for("open-erp.domainDraft");

/**
 * Product of `defineDomain({...})`: shape gate passed, stamped, and still without an identity.
 *
 * A different type from `DomainSchema`, so TypeScript blocks misuse: a draft has no `code`
 * and cannot be passed to anything that consumes `DomainSchema`; a bare object has no proof
 * key and cannot be passed to `sealDomain`.
 */
export interface DomainDraft extends DomainShape {
  readonly [DOMAIN_DRAFT]: true;
}

const DOMAIN_KEYS = ["label", "line", "modules", "choiceSets", "moduleSettings", "dashboard", "dashboards"] as const;

export function normalizeDomain(raw: unknown, label = "domain"): DomainShape {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, DOMAIN_KEYS, label);
  const name = requireText(obj["label"], `${label}.label`);
  // Default is "has modules": almost every domain does, and writing `modules: true` on each is pure noise.
  // Booleans only — a string such as `"false"` is always truthy in JS and would silently treat a support domain as having modules.
  const rawModules = obj["modules"];
  if (rawModules !== undefined && typeof rawModules !== "boolean") {
    schemaFail(`${label}.modules accepts only a boolean, got ${JSON.stringify(rawModules)}`);
  }
  // Business line: omitting it means this domain is itself a line. If declared, both slots are required —
  // a code alone would show `productionProcess` as that group's title.
  const rawLine = obj["line"];
  let line: { readonly code: string; readonly label: string } | null = null;
  if (rawLine !== undefined && rawLine !== null) {
    const one = requireObject(rawLine, `${label}.line`);
    line = {
      code: requireText(one["code"], `${label}.line.code`),
      label: requireText(one["label"], `${label}.line.label`),
    };
  }

  const rawChoiceSets = obj["choiceSets"];
  if (rawChoiceSets !== undefined && rawChoiceSets !== null && !Array.isArray(rawChoiceSets)) {
    schemaFail(`${label}.choiceSets must be an array`);
  }
  const choiceSets = (rawChoiceSets ?? []).map((entry: unknown, index: number) =>
    normalizeChoiceSet(entry, `${label}.choiceSets[${String(index)}]`),
  );
  const duplicateChoiceSetCodes = choiceSets
    .map((choiceSet) => choiceSet.code)
    .filter((choiceSetCode, index, all) => all.indexOf(choiceSetCode) !== index);
  if (duplicateChoiceSetCodes.length > 0) {
    schemaFail(`${label}.choiceSets declared "${[...new Set(duplicateChoiceSetCodes)].join(", ")}" more than once`);
  }
  const rawModuleSettings = obj["moduleSettings"];
  if (rawModuleSettings !== undefined && rawModuleSettings !== null && !Array.isArray(rawModuleSettings)) {
    schemaFail(`${label}.moduleSettings must be an array`);
  }
  const moduleSettings = (rawModuleSettings ?? []).map((entry: unknown, index: number) =>
    normalizeModuleSetting(entry, `${label}.moduleSettings[${String(index)}]`),
  );
  const duplicateSettingCodes = moduleSettings
    .map((setting) => setting.code)
    .filter((settingCode, index, all) => all.indexOf(settingCode) !== index);
  if (duplicateSettingCodes.length > 0) {
    schemaFail(`${label}.moduleSettings declared "${[...new Set(duplicateSettingCodes)].join(", ")}" more than once`);
  }
  if (obj["dashboard"] !== undefined && obj["dashboard"] !== null && obj["dashboards"] !== undefined && obj["dashboards"] !== null) {
    schemaFail(`${label}: dashboard and dashboards cannot both be declared — use the dashboards array for multiple surfaces`);
  }
  const dashboards: DashboardSchema[] = [];
  if (obj["dashboards"] !== undefined && obj["dashboards"] !== null) {
    if (!Array.isArray(obj["dashboards"])) schemaFail(`${label}.dashboards must be an array`);
    for (let index = 0; index < obj["dashboards"].length; index += 1) {
      dashboards.push(normalizeDashboard(obj["dashboards"][index], `${label}.dashboards[${String(index)}]`));
    }
  } else if (obj["dashboard"] !== undefined && obj["dashboard"] !== null) {
    dashboards.push(normalizeDashboard(obj["dashboard"], `${label}.dashboard`));
  }
  const dashboardCodes = dashboards.map((item) => item.code);
  if (new Set(dashboardCodes).size !== dashboardCodes.length) {
    schemaFail(`${label}.dashboards has a duplicate code: ${dashboardCodes.join(", ")}`);
  }
  return { label: name, line, modules: rawModules ?? true, choiceSets, moduleSettings, dashboards };
}

/**
 * The only authoring entry for a domain declaration. Domain files are always `export default defineDomain({...})`.
 *
 * Runs only the shape layer and produces a draft with no identity: `code` comes from the
 * directory name and cannot be written in the declaration, so there is no second source of
 * truth to drift. A mistake throws at load time, not later as a code shown on screen.
 */
export function defineDomain(input: unknown, label = "domain"): DomainDraft {
  return brandAsDomainDraft(normalizeDomain(input, label));
}

/** A domain's identity. The only source is the directory name, derived by the loader and then injected. */
export interface DomainIdentity {
  readonly code: string;
}

/**
 * Seal — inject the identity derived from the directory name into the draft, producing a complete `DomainSchema`.
 *
 * 🔴 The identity itself must pass the gate: `code` is a coordinate segment (a directory
 * name `my-domain/` does not yield a legal code). This used to be satisfied on the
 * declaration side as a side effect. After that slot was removed it must be checked at
 * the injection point, or a malformed directory name silently becomes a malformed domain code.
 *
 * 🔴 The `code === label` gate moved here, because it can be compared only once `code` is known:
 * the two being equal means nobody actually named it, and the menu would still show the code.
 */
export function sealDomain(draft: DomainDraft, identity: DomainIdentity): DomainSchema {
  // A bare object sealed while bypassing the shape gate means the closed-key gate never runs. The proof is the only criterion.
  if (!isDomainDraft(draft)) {
    schemaFail("sealDomain received something other than a defineDomain({...}) result — an object that has not passed the shape gate cannot receive an identity");
  }
  const shape: DomainShape = draft;
  const code = requireCoordinateSegment(identity.code, "domain.code");
  if (code === shape.label) {
    schemaFail(`domain "${code}": label and code are the same — a domain needs a human-readable name, not a copy of the code`);
  }
  return { ...shape, code };
}

function brandAsDomainDraft(shape: DomainShape): DomainDraft {
  Object.defineProperty(shape, DOMAIN_DRAFT, { value: true, enumerable: false, writable: false });
  return shape as DomainDraft;
}

/** Is this object a product of `defineDomain()`? */
export function isDomainDraft(value: unknown): value is DomainDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[DOMAIN_DRAFT] === true
  );
}
