// ---------------------------------------------------------------------------
// Modeling-material index — project declared and derived catalog state into searchable capability facts
//
// This file does not keep a module-to-tag table. Module facts come only from the ModuleSchema already assembled by loadCatalog,
// relationsOf, and sourceBindingsOf. A new module or a schema edit changes the index together with the catalog.
//
// This is not a second validate. It does not judge whether a module is correct. It describes a catalog that already loaded.
// The semantic gate still has one entry: yarn test.
// ---------------------------------------------------------------------------

import { type Catalog } from "@open-erp/loader";
import {
  EFFECT_OPS,
  listLedgerCodes,
  peekLedgerCatalog,
  HANDOFF_KINDS,
  LEVELS,
  PRECONDITION_SOURCES,
  PRIMITIVE_NAMES,
  SUPPLY_TEXT,
  stampOnFirstEnterOf,
  uniqueDefaultWithinOf,
  isReverseQueryable,
  relationsOf,
  sourceBindingsOf,
  supplyOf,
  type Field,
  type ModuleSchema,
  type SourceBinding,
} from "@open-erp/metamodel";

export type MaterialFeature = string;

export interface MaterialFeatureDefinition {
  readonly feature: MaterialFeature;
  readonly description: string;
}

export interface MaterialCard {
  readonly code: string;
  readonly label: string;
  readonly domain: string;
  /** Source path relative to domains/. */
  readonly file: string;
  readonly features: readonly MaterialFeature[];
}

export interface MaterialCandidate extends MaterialCard {
  readonly matched: readonly MaterialFeature[];
  readonly missing: readonly MaterialFeature[];
}

export interface MaterialCoverage {
  readonly feature: MaterialFeature;
  readonly candidates: readonly string[];
}

export interface MaterialQueryResult {
  readonly required: readonly MaterialFeature[];
  /** Modules that cover every required capability. */
  readonly exact: readonly MaterialCandidate[];
  /** Modules that cover at least one required capability but not all of them. Never presented as exact. */
  readonly partial: readonly MaterialCandidate[];
  /** Which materials cover each capability, for combining several samples. */
  readonly coverage: readonly MaterialCoverage[];
  /** Capabilities that are legal in the vocabulary but unused by any module in this catalog. */
  readonly uncovered: readonly MaterialFeature[];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function definitions(): MaterialFeatureDefinition[] {
  const out: MaterialFeatureDefinition[] = [
    { feature: "field:ref", description: "Has a header or line business reference (ref)" },
    { feature: "field:refLine", description: "Has a reference to an upstream line (refLine)" },
    { feature: "field:subtable", description: "Has one header-and-lines structure (subtable)" },
    { feature: "field:refFilter", description: "Reference candidates carry a refFilter" },
    { feature: "field:refPreselect", description: "Reference candidates carry a refPreselect" },
    { feature: "field:refPreselectSole", description: "The sole reference candidate is filled automatically (refPreselectSole)" },
    { feature: "field:headerEmptyFill", description: "A line column declares that an empty table is filled with candidate rows after the header is filled (headerEmptyFill)" },
    { feature: "field:refDefault", description: "Prefilled after a reference, and still overridable (refDefault)" },
    { feature: "field:createDefault", description: "Carries a createDefault at creation" },
    { feature: "field:pushFrom", description: "A push field uses pushFrom for an explicit rename mapping" },
    { feature: "field:unitChoice", description: "The unit is chosen from the main or auxiliary unit of a product reference on the same level" },
    { feature: "field:choiceSet", description: "Enum candidates come from a product-declared, tenant-maintained choice set" },
    { feature: "field:calculate", description: "On save, the field is calculated from a same-level formula and stored" },
    { feature: "field:maxRows", description: "The line table declares a maximum row count (maxRows)" },
    { feature: "field:defaultFrom", description: "A line column takes its default from the header (defaultFrom)" },
    { feature: "field:hidden", description: "The field has a column and the write path still consumes it, but the form does not render it (hidden)" },
    { feature: "module:unitSet", description: "The module is the authority for main and auxiliary units and the conversion rate" },
    { feature: "constraint:unique", description: "Has a declared field unique within the tenant" },
    { feature: "constraint:uniqueWith", description: "Has a declared composite unique coordinate" },
    { feature: "constraint:uniqueDefaultWithin", description: "An isDefault-style pointer is unique per coordinate and status, and the previous one is demoted on entry" },
    { feature: "constraint:singleActiveWithin", description: "One active record per coordinate: entering the active status demotes the other active records of the same coordinate to a named status (one active record per product at a time)" },
    { feature: "field:stampOnFirstEnter", description: "Stamps a date or datetime field the first time a named status is entered, and does not overwrite an existing value" },
    { feature: "lifecycle:terminal", description: "The lifecycle includes a terminal status" },
    { feature: "transition:selfLoop", description: "The lifecycle includes a self-loop transition" },
    { feature: "transition:push", description: "A status transition declaratively pushes a target bill" },
    { feature: "transition:planner", description: "A status transition mounts a read-only Planner" },
    { feature: "effect:perLine", description: "At least one ledger effect expands per line" },
    { feature: "precondition:when", description: "At least one precondition has an applicability when" },
    { feature: "creation:manual", description: "The module can be created directly by a person" },
    { feature: "creation:pushed", description: "The module has a declarative push or Planner creation path" },
    { feature: "relation:header", description: "At least one business reference sits on the header" },
    { feature: "relation:line", description: "At least one business reference sits on a line" },
    { feature: "relation:toLine", description: "At least one business reference points at a line of the target module" },
    { feature: "relation:self", description: "At least one business reference points back at this module, forming a hierarchy" },
    { feature: "relation:reverseQueryable", description: "At least one business reference can be looked up from the target detail" },
    { feature: "relation:reverseUnavailable", description: "At least one line-level target reference cannot be looked up by bill id" },
    {
      feature: "sourceBinding:select:filtered:target",
      description: "A target reference field of this module declares a candidate filter",
    },
    {
      feature: "sourceBinding:select:filtered:source",
      description: "This module is the source of reference candidates that carry a filter",
    },
    {
      feature: "sourceBinding:select:preselected:target",
      description: "A target reference field of this module declares a candidate preselect",
    },
    {
      feature: "sourceBinding:select:preselected:source",
      description: "This module is the source of reference candidates that carry a preselect",
    },
    {
      feature: "sourceBinding:value:lookup:target",
      description: "A target field of this module looks up another module's field live",
    },
    {
      feature: "sourceBinding:value:lookup:source",
      description: "A field of this module is the live lookup source for another module",
    },
    {
      feature: "sourceBinding:value:snapshot:target",
      description: "A target field of this module freezes another module's field value on save",
    },
    {
      feature: "sourceBinding:value:snapshot:source",
      description: "A field of this module is the snapshot source frozen by another module on save",
    },
    {
      feature: "sourceBinding:value:default:target",
      description: "A target field of this module is prefilled from another module and may be overridden",
    },
    {
      feature: "sourceBinding:value:default:source",
      description: "A field of this module is the overridable default source for another module",
    },
    {
      feature: "sourceBinding:creation:createFrom:target",
      description: "This module declares a target entry that creates from an existing source record or line",
    },
    {
      feature: "sourceBinding:creation:createFrom:source",
      description: "A record or line of this module can be the creation source of another module's create-from entry",
    },
    {
      feature: "sourceBinding:creation:push:target",
      description: "This module is the target generated by a declarative status-transition push",
    },
    {
      feature: "sourceBinding:creation:push:source",
      description: "A status transition of this module declaratively pushes another target module",
    },
    {
      feature: "sourceBinding:remaining:target",
      description: "This module's create-from entry limits selectable source lines by remaining source quantity",
    },
    {
      feature: "sourceBinding:remaining:source",
      description: "This module supplies the source header and line balances that create-from selectability needs",
    },
    {
      feature: "sourceBinding:plannerExecution:transition",
      description: "A status transition of this module runs a dynamic Planner; the target set is known only at runtime",
    },
    { feature: "sourceBinding:unitChoice:target", description: "This module's unit cell consumes another module's unit set" },
    { feature: "sourceBinding:unitChoice:source", description: "This module supplies main and auxiliary unit candidates and the conversion rate" },
  ];

  for (const supply of Object.keys(SUPPLY_TEXT)) {
    out.push({ feature: `supply:${supply}`, description: `Field value is supplied by the ${supply} mechanism` });
  }
  for (const level of LEVELS) {
    out.push({ feature: `precondition:level:${level}`, description: `Has a ${level} precondition` });
  }
  for (const source of PRECONDITION_SOURCES) {
    out.push({ feature: `precondition:source:${source}`, description: `Has a precondition from source ${source}` });
  }
  for (const primitive of PRIMITIVE_NAMES) {
    out.push({ feature: `precondition:rule:${primitive}`, description: `A precondition uses the ${primitive} primitive` });
  }
  for (const target of peekLedgerCatalog() === null ? [] : listLedgerCodes()) {
    out.push({ feature: `effect:target:${target}`, description: `At least one effect posts to the ${target} ledger` });
  }
  for (const op of EFFECT_OPS) {
    out.push({ feature: `effect:op:${op}`, description: `At least one effect uses the ${op} operation` });
  }
  for (const kind of HANDOFF_KINDS) {
    out.push({ feature: `handoff:${kind}`, description: `At least one ${kind} handoff` });
  }

  return out.sort((a, b) => compareText(a.feature, b.feature));
}

/**
 * Closed vocabulary accepted by queries. Enum dimensions are generated from metamodel's closed constants, not copied by hand.
 */
export const MATERIAL_FEATURES: readonly MaterialFeatureDefinition[] = Object.freeze(definitions());

const FEATURE_SET = new Set(MATERIAL_FEATURES.map((definition) => definition.feature));

function visitFields(fields: readonly Field[], found: Set<string>): void {
  for (const field of fields) {
    if (field.type === "ref" || field.type === "refLine" || field.type === "subtable") {
      found.add(`field:${field.type}`);
    }
    if (field.refFilter !== null) found.add("field:refFilter");
    if (field.refPreselect !== null) found.add("field:refPreselect");
    if (field.refPreselectSole) found.add("field:refPreselectSole");
    if (field.headerEmptyFill === true) found.add("field:headerEmptyFill");
    if (field.refDefault !== null) found.add("field:refDefault");
    if (field.createDefault !== undefined && field.createDefault !== null) found.add("field:createDefault");
    if (field.pushFrom !== null) found.add("field:pushFrom");
    if (field.unitChoice !== null) found.add("field:unitChoice");
    if (field.choiceSet !== null) found.add("field:choiceSet");
    if (field.calculate !== null) found.add("field:calculate");
    // `hidden` / `maxRows` / `defaultFrom` are present on the object only when declared (see the return spread of `normalizeField`).
    // A missing key on the wire means the property does not exist. The criterion is "explicitly true / non-null".
    // It must not be written as `!== undefined` — that treats "not declared" as "declared", so every module in the repo
    // would carry these capabilities and `--need` would return nothing but noise.
    if (field.maxRows != null) found.add("field:maxRows");
    if (field.defaultFrom != null) found.add("field:defaultFrom");
    if (field.hidden === true) found.add("field:hidden");
    if (field.unique) found.add("constraint:unique");
    if (field.uniqueWith !== null) found.add("constraint:uniqueWith");
    if (uniqueDefaultWithinOf(field) !== null) found.add("constraint:uniqueDefaultWithin");
    if (stampOnFirstEnterOf(field) !== null) found.add("field:stampOnFirstEnter");

    const supply = supplyOf(field, fields);
    if (supply !== null) found.add(`supply:${supply}`);

    if (field.type === "subtable" && field.fields !== null) visitFields(field.fields, found);
  }
}

function addFeature(byModule: Map<string, Set<string>>, module: string, feature: string): void {
  const found = byModule.get(module) ?? new Set<string>();
  found.add(feature);
  byModule.set(module, found);
}

/**
 * Project the participant roles of a canonical SourceBinding into author search terms.
 *
 * This reads only the kind, mechanism, source, target, and transition already present on the IR. It does not look back at field declarations,
 * and it does not reimplement the underlying criteria of ref, create-from, push, or Planner.
 */
function sourceBindingFeatures(bindings: readonly SourceBinding[]): ReadonlyMap<string, ReadonlySet<string>> {
  const byModule = new Map<string, Set<string>>();
  for (const binding of bindings) {
    switch (binding.kind) {
      case "field-select":
        if (binding.filter.length > 0) {
          addFeature(byModule, binding.target.module, "sourceBinding:select:filtered:target");
          addFeature(byModule, binding.source.module, "sourceBinding:select:filtered:source");
        }
        if (binding.preselect.length > 0) {
          addFeature(byModule, binding.target.module, "sourceBinding:select:preselected:target");
          addFeature(byModule, binding.source.module, "sourceBinding:select:preselected:source");
        }
        break;
      case "field-value": {
        const valueFeature = binding.mechanism === "refDefault" ? "default" : binding.mechanism;
        addFeature(byModule, binding.target.module, `sourceBinding:value:${valueFeature}:target`);
        addFeature(byModule, binding.source.coordinate.module, `sourceBinding:value:${valueFeature}:source`);
        break;
      }
      case "unit-choice":
        addFeature(byModule, binding.target.module, "sourceBinding:unitChoice:target");
        addFeature(byModule, binding.source.module, "sourceBinding:unitChoice:source");
        break;
      case "creation": {
        const creationFeature = binding.mechanism === "create-from" ? "createFrom" : "push";
        addFeature(byModule, binding.target.module, `sourceBinding:creation:${creationFeature}:target`);
        addFeature(byModule, binding.source.module, `sourceBinding:creation:${creationFeature}:source`);
        if (binding.mechanism === "push") {
          // Keep the existing search term, but the fact now comes from the same creation binding.
          if (binding.transition !== null) {
            addFeature(byModule, binding.transition.module, "transition:push");
          }
        }
        if (binding.sourceRemaining !== null) {
          addFeature(byModule, binding.target.module, "sourceBinding:remaining:target");
          if (binding.sourceRemaining.header !== null) {
            addFeature(byModule, binding.sourceRemaining.header.module, "sourceBinding:remaining:source");
          }
          addFeature(byModule, binding.sourceRemaining.line.module, "sourceBinding:remaining:source");
        }
        break;
      }
      case "planner-execution":
        addFeature(byModule, binding.transition.module, "sourceBinding:plannerExecution:transition");
        // Keep the existing search term. Whether a dynamic Planner exists is decided by the IR, not by guessing the loader planner map.
        addFeature(byModule, binding.transition.module, "transition:planner");
        break;
      default: {
        const exhaustive: never = binding;
        return exhaustive;
      }
    }
  }
  return byModule;
}

function schemaFeatures(
  schema: ModuleSchema,
  allSchemas: readonly ModuleSchema[],
  bindingFeatures: ReadonlySet<string>,
): string[] {
  const found = new Set<string>(bindingFeatures);
  visitFields(schema.fields, found);
  if (schema.unitSet !== null) found.add("module:unitSet");

  if (schema.lifecycle.statuses.some((status) => status.terminal)) found.add("lifecycle:terminal");
  if (schema.lifecycle.singleActiveWithin !== null) found.add("constraint:singleActiveWithin");
  for (const transition of schema.lifecycle.transitions) {
    if (transition.from === transition.to) found.add("transition:selfLoop");
    for (const effect of transition.effects) {
      found.add(`effect:target:${effect.target}`);
      found.add(`effect:op:${effect.op}`);
      if (effect.perLine) found.add("effect:perLine");
    }
  }

  for (const precondition of schema.preconditions) {
    found.add(`precondition:level:${precondition.level}`);
    found.add(`precondition:source:${precondition.source}`);
    if (precondition.check !== null) found.add(`precondition:rule:${precondition.check.primitive}`);
    if (precondition.when !== null) {
      found.add("precondition:when");
      found.add(`precondition:rule:${precondition.when.primitive}`);
    }
  }
  for (const handoff of schema.handoff) found.add(`handoff:${handoff.kind}`);

  if (schema.creatable.manual) found.add("creation:manual");
  if (schema.creatable.pushedFrom === null) {
    throw new Error(
      `materials: creatable.pushedFrom of module "${schema.code}" is not assembled; ` +
        `use the full result of loadCatalog, and do not treat an unassembled ModuleSchema as a material fact`,
    );
  }
  if (schema.creatable.pushedFrom.length > 0) found.add("creation:pushed");

  const relations = relationsOf(allSchemas, schema.code).outbound;
  for (const relation of relations) {
    found.add(relation.via === "bill" ? "relation:header" : "relation:line");
    if (relation.toLevel === "line") found.add("relation:toLine");
    if (relation.to === schema.code) found.add("relation:self");
    found.add(isReverseQueryable(relation) ? "relation:reverseQueryable" : "relation:reverseUnavailable");
  }

  const unknown = [...found].filter((feature) => !FEATURE_SET.has(feature));
  if (unknown.length > 0) {
    throw new Error(
      `materials: module "${schema.code}" derived capabilities outside the vocabulary: ${unknown.sort(compareText).join(", ")}`,
    );
  }
  return [...found].sort(compareText);
}

/** Pure projection: reads no files. It consumes a complete catalog and the canonical SourceBinding IR. */
export function materialCards(catalog: Catalog): readonly MaterialCard[] {
  const schemas = [...catalog.modules.values()].map((module) => module.schema);
  const bindingFeatures = sourceBindingFeatures(sourceBindingsOf(schemas));
  return [...catalog.modules.values()]
    .map((module) => ({
      code: module.code,
      label: module.schema.label,
      domain: module.domain,
      file: module.file,
      features: schemaFeatures(module.schema, schemas, bindingFeatures.get(module.code) ?? new Set<string>()),
    }))
    .sort((a, b) => compareText(a.code, b.code));
}

function assertKnownFeatures(required: readonly string[]): readonly string[] {
  const normalized = [...new Set(required)].sort(compareText);
  const unknown = normalized.filter((feature) => !FEATURE_SET.has(feature));
  if (unknown.length > 0) {
    throw new Error(
      `materials: unknown feature: ${unknown.join(", ")}. Allowed features: ` +
        MATERIAL_FEATURES.map((definition) => definition.feature).join(", "),
    );
  }
  return normalized;
}

function normalizedCards(cards: readonly MaterialCard[]): readonly MaterialCard[] {
  const seen = new Set<string>();
  return cards
    .map((card) => {
      if (seen.has(card.code)) throw new Error(`materials: material code "${card.code}" is duplicated`);
      seen.add(card.code);
      const features = [...new Set(card.features)].sort(compareText);
      const unknown = features.filter((feature) => !FEATURE_SET.has(feature));
      if (unknown.length > 0) {
        throw new Error(`materials: material "${card.code}" carries capabilities outside the vocabulary: ${unknown.join(", ")}`);
      }
      return { ...card, features };
    })
    .sort((a, b) => compareText(a.code, b.code));
}

/** Pure query: every required item is a hard condition. partial never enters exact. */
export function findMaterials(cards: readonly MaterialCard[], required: readonly string[]): MaterialQueryResult {
  const needs = assertKnownFeatures(required);
  if (needs.length === 0) throw new Error("materials: findMaterials needs at least one feature");

  const stableCards = normalizedCards(cards);
  const candidates = stableCards.map((card): MaterialCandidate => {
    const features = new Set(card.features);
    return {
      ...card,
      matched: needs.filter((feature) => features.has(feature)),
      missing: needs.filter((feature) => !features.has(feature)),
    };
  });
  const exact = candidates.filter((candidate) => candidate.missing.length === 0).sort((a, b) => compareText(a.code, b.code));
  const partial = candidates
    .filter((candidate) => candidate.matched.length > 0 && candidate.missing.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || compareText(a.code, b.code));
  const coverage = needs.map((feature) => ({
    feature,
    candidates: stableCards
      .filter((card) => card.features.includes(feature))
      .map((card) => card.code)
      .sort(compareText),
  }));

  return {
    required: needs,
    exact,
    partial,
    coverage,
    uncovered: coverage.filter((entry) => entry.candidates.length === 0).map((entry) => entry.feature),
  };
}
