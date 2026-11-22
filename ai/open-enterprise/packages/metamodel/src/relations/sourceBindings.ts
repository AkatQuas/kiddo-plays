// ---------------------------------------------------------------------------
// Source-binding IR — the contract for cross-record values, candidates, and bill-creation sources
//
// This projects only declarations of "a record / creation fact comes from another record", not the full FieldSupply:
// auto, derive.formula, derive.rollup, and lineAgg are system-supplied values inside this record and do not belong to this IR.
// This file is zero IO and invents no schema; push/create-from mappings only reuse the relations primitives the runtime already has.
// ---------------------------------------------------------------------------

import { schemaFail } from "../schema/common.js";
import { creationFlowsOf } from "./creationFlows.js";
import { hasColumn, isPlannerSupplied, isSystemSupplied, type Field } from "../schema/fields.js";
import {
  isPlatformField,
  isPublicPlatformField,
  type ModuleSchema,
} from "../schema/module.js";
import { isRefFilterRef, type RefFilterOperand, type RefFilterScalar } from "../normalize/refFilter.js";
import { isPushFillable, pushSourceField, pushSourceTable } from "./relations.js";
import { transitionActions, type PushLineMapping } from "../schema/lifecycle.js";
import { transitionEdges } from "../derive/engine.js";

export type SourceLevel = "record" | "line";
export type SourceBindingScope = "cross-record";

/** An unambiguous coordinate of a declared field. path is for display only; field is the unambiguous field key. */
export interface SourceCoordinate {
  readonly module: string;
  readonly level: SourceLevel;
  readonly table: string | null;
  readonly field: string;
  readonly path: string;
}

export interface SourceEntity {
  readonly module: string;
  readonly level: SourceLevel;
  readonly table: string | null;
}

export interface CanonicalLiteralOperand {
  readonly kind: "literal";
  /** Set semantics: stable order, deduped by type and value. */
  readonly values: readonly RefFilterScalar[];
}

export interface CanonicalDynamicOperand {
  readonly kind: "dynamic";
  readonly from: string;
  readonly map: readonly {
    readonly source: string;
    /** Set semantics: stable order, deduped by type and value. */
    readonly values: readonly RefFilterScalar[];
  }[] | null;
}

export interface CanonicalCondition {
  readonly field: string;
  readonly operand: CanonicalLiteralOperand | CanonicalDynamicOperand;
}

/** Cross-record candidate source of a ref/refLine. A system-supplied reference is projected too, with selectable=false. */
export interface FieldSelectBinding {
  readonly id: string;
  readonly kind: "field-select";
  readonly scope: SourceBindingScope;
  readonly mode: "live";
  readonly mechanism: "ref" | "refLine";
  readonly source: SourceEntity;
  readonly target: SourceCoordinate;
  readonly selectable: boolean;
  readonly filter: readonly CanonicalCondition[];
  readonly preselect: readonly CanonicalCondition[];
  readonly explain: string;
}

export type FieldValueBindingMode = "live" | "snapshot" | "default";
export type FieldValueBindingMechanism = "lookup" | "snapshot" | "refDefault";

export type ValueSource =
  | { readonly kind: "field"; readonly coordinate: SourceCoordinate }
  | { readonly kind: "identity"; readonly entity: SourceEntity }
  | { readonly kind: "literal"; readonly value: string | number };

/**
 * Contract for a cell whose value comes from another record. Deliberately only lookup/snapshot/refDefault;
 * formula/rollup/auto/lineAgg belong to this record's internal FieldSupply and are not on this axis.
 */
export interface FieldValueBinding {
  readonly id: string;
  readonly kind: "field-value";
  readonly scope: SourceBindingScope;
  readonly mode: FieldValueBindingMode;
  readonly mechanism: FieldValueBindingMechanism;
  readonly source: Extract<ValueSource, { readonly kind: "field" }>;
  readonly target: SourceCoordinate;
  /** The matching reference lookup/snapshot/default uses on the target's own layer. */
  readonly via: SourceCoordinate;
  readonly explain: string;
}

/** The full cross-record contract by which a product unit set supplies candidates, a default, and a conversion factor to a business bill's unit cell. */
export interface UnitChoiceBinding {
  readonly id: string;
  readonly kind: "unit-choice";
  readonly scope: SourceBindingScope;
  readonly mode: "default";
  readonly mechanism: "unitChoice";
  readonly source: SourceEntity;
  readonly target: SourceCoordinate;
  readonly via: SourceCoordinate;
  readonly main: SourceCoordinate;
  readonly auxiliary: SourceCoordinate;
  readonly conversionRate: SourceCoordinate;
  readonly factorInto: SourceCoordinate;
  readonly explain: string;
}

export type CreationMappingMechanism =
  | "pushFrom"
  | "same-name"
  | "source-record"
  | "source-line"
  | "push-default";

/** One cell that push/create-from actually writes into the target draft; the rule is the same source as buildPushDraft/pushLineValues. */
export interface CreationMapping {
  readonly mode: "copy" | "constant";
  readonly mechanism: CreationMappingMechanism;
  readonly source: ValueSource;
  readonly target: SourceCoordinate;
}

export interface CreationBinding {
  readonly id: string;
  readonly kind: "creation";
  readonly scope: SourceBindingScope;
  readonly mechanism: "create-from" | "push";
  readonly label: string;
  readonly source: SourceEntity;
  readonly target: { readonly module: string; readonly path: string | null };
  readonly transition: { readonly module: string; readonly code: string } | null;
  readonly sourceStatuses: readonly string[] | null;
  readonly sourceRemaining: {
    readonly header: SourceCoordinate | null;
    readonly line: SourceCoordinate;
  } | null;
  readonly mappings: readonly CreationMapping[];
  readonly explain: string;
}

/** A Planner only declares "this edge will run a dynamic plan"; ModuleSchema does not contain the target set and must not be disguised as a creation fact. */
export interface PlannerExecutionBinding {
  readonly id: string;
  readonly kind: "planner-execution";
  readonly scope: SourceBindingScope;
  readonly source: SourceEntity;
  readonly transition: { readonly module: string; readonly code: string };
  readonly targets: { readonly kind: "dynamic" };
  readonly explain: string;
}

export type SourceBinding =
  | FieldSelectBinding
  | FieldValueBinding
  | UnitChoiceBinding
  | CreationBinding
  | PlannerExecutionBinding;

interface FieldSite {
  readonly module: ModuleSchema;
  readonly table: Field | null;
  readonly fields: readonly Field[];
  readonly field: Field;
  readonly coordinate: SourceCoordinate;
}

type StableIdPart = string | number | boolean | null;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** A JSON tuple keeps segment boundaries; a colon, a dot, or a case difference inside module/path cannot collide. */
function stableId(...parts: readonly StableIdPart[]): string {
  return JSON.stringify(parts);
}

function coordinate(module: string, table: string | null, field: string): SourceCoordinate {
  return {
    module,
    level: table === null ? "record" : "line",
    table,
    field,
    path: table === null ? field : `${table}.${field}`,
  };
}

function coordinateId(value: SourceCoordinate): readonly StableIdPart[] {
  return [value.module, value.table, value.field];
}

function entity(module: string, table: string | null): SourceEntity {
  return { module, level: table === null ? "record" : "line", table };
}

function requireSubtableFields(field: Field, at: string): readonly Field[] {
  if (field.type !== "subtable" || field.fields === null) {
    schemaFail(`source bindings: ${at} did not resolve to a fully declared line table`);
  }
  return field.fields;
}

function sitesOf(module: ModuleSchema): readonly FieldSite[] {
  const out: FieldSite[] = [];
  for (const field of module.fields) {
    out.push({
      module,
      table: null,
      fields: module.fields,
      field,
      coordinate: coordinate(module.code, null, field.key),
    });
    if (field.type !== "subtable") continue;
    const columns = requireSubtableFields(field, `${module.code}.${field.key}`);
    for (const column of columns) {
      out.push({
        module,
        table: field,
        fields: columns,
        field: column,
        coordinate: coordinate(module.code, field.key, column.key),
      });
    }
  }
  return out;
}

function moduleIndex(modules: readonly ModuleSchema[]): ReadonlyMap<string, ModuleSchema> {
  const out = new Map<string, ModuleSchema>();
  for (const module of modules) {
    if (out.has(module.code)) schemaFail(`source bindings: module code "${module.code}" is duplicated, so the source cannot be resolved uniquely`);
    out.set(module.code, module);
  }
  return out;
}

function requireModule(
  modules: ReadonlyMap<string, ModuleSchema>,
  code: string,
  at: string,
): ModuleSchema {
  const hit = modules.get(code);
  if (!hit) schemaFail(`source bindings: ${at} points at an unknown source module "${code}"`);
  return hit;
}

function requireTable(module: ModuleSchema, key: string, at: string): Field {
  const hits = module.fields.filter((field) => field.key === key);
  if (hits.length !== 1 || hits[0]?.type !== "subtable") {
    schemaFail(
      `source bindings: ${at} points at "${module.code}.${key}", but it did not resolve uniquely to a line table` +
        ` (hit ${String(hits.length)})`,
    );
  }
  return hits[0];
}

function requireField(
  module: ModuleSchema,
  table: string | null,
  key: string,
  at: string,
  allowPlatform = false,
): { readonly field: Field | null; readonly coordinate: SourceCoordinate } {
  const fields = table === null
    ? module.fields
    : requireSubtableFields(requireTable(module, table, at), `${module.code}.${table}`);
  const hits = fields.filter((field) => field.key === key);
  if (hits.length === 1 && hits[0]) {
    return { field: hits[0], coordinate: coordinate(module.code, table, key) };
  }
  if (
    hits.length === 0 &&
    table === null &&
    allowPlatform &&
    isPlatformField(key) &&
    key !== "id" &&
    key !== "tenantId"
  ) {
    return { field: null, coordinate: coordinate(module.code, null, key) };
  }
  schemaFail(
    `source bindings: ${at} points at an unknown or non-unique source path "${module.code}.${table === null ? key : `${table}.${key}`}"` +
      ` (hit ${String(hits.length)})`,
  );
}

function scalarKey(value: RefFilterScalar): string {
  if (value === null) return "0:null";
  if (typeof value === "boolean") return `1:${value ? "1" : "0"}`;
  if (typeof value === "number") return `2:${String(value)}`;
  return `3:${value}`;
}

function canonicalValues(value: RefFilterScalar | readonly RefFilterScalar[]): readonly RefFilterScalar[] {
  const unique = new Map<string, RefFilterScalar>();
  for (const item of Array.isArray(value) ? value : [value]) unique.set(scalarKey(item), item);
  return [...unique.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, item]) => item);
}

function canonicalStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function canonicalOperand(operand: RefFilterOperand): CanonicalLiteralOperand | CanonicalDynamicOperand {
  if (!isRefFilterRef(operand)) return { kind: "literal", values: canonicalValues(operand) };
  const entries = operand.map === undefined
    ? null
    : Object.entries(operand.map)
        .sort(([left], [right]) => compareText(left, right))
        .map(([source, value]) => ({ source, values: canonicalValues(value) }));
  return { kind: "dynamic", from: operand.from, map: entries };
}

function canonicalConditions(
  raw: Readonly<Record<string, RefFilterOperand>> | null,
): readonly CanonicalCondition[] {
  if (raw === null) return [];
  return Object.entries(raw)
    .sort(([left], [right]) => compareText(left, right))
    .map(([field, operand]) => ({ field, operand: canonicalOperand(operand) }));
}

function assertCandidateConditions(
  modules: ReadonlyMap<string, ModuleSchema>,
  site: FieldSite,
  raw: Readonly<Record<string, RefFilterOperand>> | null,
  kind: "refFilter" | "refPreselect",
): void {
  if (raw === null) return;
  if (site.field.ref === null) schemaFail(`source bindings: ${site.coordinate.path}.${kind} has no ref source`);
  const source = requireModule(modules, site.field.ref, `${site.coordinate.module}.${site.coordinate.path}.${kind}`);
  for (const [key, operand] of Object.entries(raw)) {
    const candidate = source.fields.find((field) => field.key === key);
    if (!candidate && !isPublicPlatformField(key)) {
      schemaFail(`source bindings: ${site.coordinate.module}.${site.coordinate.path}.${kind}.${key} points at an unknown candidate field`);
    }
    if (candidate && !hasColumn(candidate)) {
      schemaFail(`source bindings: ${site.coordinate.module}.${site.coordinate.path}.${kind}.${key} is not a filterable stored column`);
    }
    if (!isRefFilterRef(operand)) continue;
    if (kind === "refPreselect") {
      schemaFail(`source bindings: ${site.coordinate.module}.${site.coordinate.path}.refPreselect does not accept dynamic source "${operand.from}"`);
    }
    const prefix = operand.from.startsWith("$bill.")
      ? "$bill."
      : operand.from.startsWith("$line.")
        ? "$line."
        : null;
    if (prefix === null) schemaFail(`source bindings: unknown dynamic source path "${operand.from}"`);
    if (prefix === "$line." && site.table === null) {
      schemaFail(`source bindings: header field "${site.coordinate.path}" cannot read a line source "${operand.from}"`);
    }
    const ownKey = operand.from.slice(prefix.length);
    const ownFields = prefix === "$bill." ? site.module.fields : site.fields;
    const hits = ownFields.filter((field) => field.key === ownKey);
    if (hits.length !== 1) {
      schemaFail(
        `source bindings: the dynamic source "${operand.from}" of ${site.coordinate.module}.${site.coordinate.path}.${kind}` +
          ` is unknown or not unique (hit ${String(hits.length)})`,
      );
    }
  }
}

function assertMatch(
  site: FieldSite,
  sourceModule: string,
  sourceTable: string | null,
  match: string,
  at: string,
): SourceCoordinate {
  const hits = site.fields.filter((field) => field.key === match);
  if (hits.length !== 1 || !hits[0]) {
    schemaFail(`source bindings: ${at}.match "${match}" is unknown or not unique on the target layer (hit ${String(hits.length)})`);
  }
  const field = hits[0];
  const expected = sourceTable === null ? "ref" : "refLine";
  if (field.type !== expected || field.ref !== sourceModule || (expected === "refLine" && field.through !== sourceTable)) {
    schemaFail(
      `source bindings: ${at}.match "${match}" does not uniquely point at ${sourceModule}${sourceTable === null ? " header" : ` line ${sourceTable}`}`,
    );
  }
  return coordinate(site.module.code, site.table?.key ?? null, field.key);
}

function fieldValueBindings(
  modules: ReadonlyMap<string, ModuleSchema>,
  site: FieldSite,
): readonly FieldValueBinding[] {
  const declarations = [
    site.field.derive?.kind === "lookup" ? "lookup" : null,
    site.field.snapshot !== null ? "snapshot" : null,
    site.field.refDefault !== null ? "refDefault" : null,
  ].filter((item): item is FieldValueBindingMechanism => item !== null);
  if (declarations.length > 1) {
    schemaFail(`source bindings: ${site.module.code}.${site.coordinate.path} has more than one cross-record value source: ${declarations.join(", ")}`);
  }
  const declaration = declarations[0];
  if (!declaration) return [];
  const raw = declaration === "lookup"
    ? site.field.derive?.kind === "lookup" ? site.field.derive : null
    : declaration === "snapshot"
      ? site.field.snapshot
      : site.field.refDefault;
  if (raw === null || raw === undefined) schemaFail(`source bindings: ${site.coordinate.path}.${declaration} declaration is missing`);
  const sourceModule = requireModule(modules, raw.from, `${site.module.code}.${site.coordinate.path}.${declaration}.from`);
  const via = assertMatch(site, raw.from, raw.through, raw.match, `${site.module.code}.${site.coordinate.path}.${declaration}`);
  const source = requireField(
    sourceModule,
    raw.through,
    raw.field,
    `${site.module.code}.${site.coordinate.path}.${declaration}.field`,
    declaration === "snapshot",
  );
  if (source.field !== null && !hasColumn(source.field)) {
    schemaFail(`source bindings: ${source.coordinate.module}.${source.coordinate.path} is not a stored source field`);
  }
  const mode: FieldValueBindingMode = declaration === "lookup"
    ? "live"
    : declaration === "snapshot"
      ? "snapshot"
      : "default";
  const explanation = declaration === "lookup"
    ? `brought across live from ${source.coordinate.module}.${source.coordinate.path} through ${via.path} at query time`
    : declaration === "snapshot"
      ? `frozen from ${source.coordinate.module}.${source.coordinate.path} through ${via.path} at save time`
      : `when blank, prefilled from ${source.coordinate.module}.${source.coordinate.path} through ${via.path} and allowed to be overwritten`;
  return [{
    id: stableId("field-value", ...coordinateId(site.coordinate), declaration),
    kind: "field-value",
    scope: "cross-record",
    mode,
    mechanism: declaration,
    source: { kind: "field", coordinate: source.coordinate },
    target: site.coordinate,
    via,
    explain: explanation,
  }];
}

/**
 * The real source of this enum's candidates: a choiceSet code, or the choiceSet of unitSet.main on the product bound by unitChoice.
 * Null for static options / when it cannot be resolved. The gate compares both ends with it and does not misread unitChoice as another dictionary.
 */
export function enumCandidateSourceOf(
  field: Field,
  siblings: readonly Field[],
  moduleOf: (code: string) => ModuleSchema | undefined,
): string | null {
  if (field.choiceSet !== null) return field.choiceSet;
  if (field.unitChoice === null) return null;
  const match = siblings.find((candidate) => candidate.key === field.unitChoice?.match);
  if (match?.type !== "ref" || match.ref === null) return null;
  const source = moduleOf(match.ref);
  const mainKey = source?.unitSet?.main;
  if (source === undefined || mainKey === undefined) return null;
  return source.fields.find((candidate) => candidate.key === mainKey)?.choiceSet ?? null;
}

export function enumCandidateSourceLabel(source: string | null): string {
  return source ?? "static options";
}

function unitChoiceBinding(
  modules: ReadonlyMap<string, ModuleSchema>,
  site: FieldSite,
): UnitChoiceBinding | null {
  const choice = site.field.unitChoice;
  if (choice == null) return null;
  const match = site.fields.find((candidate) => candidate.key === choice.match);
  if (!match || match.type !== "ref" || match.ref === null) {
    schemaFail(`source bindings: ${site.module.code}.${site.coordinate.path}.unitChoice.match did not resolve to a same-layer ref`);
  }
  const source = requireModule(modules, match.ref, `${site.module.code}.${site.coordinate.path}.unitChoice.match`);
  if (source.unitSet == null) {
    schemaFail(`source bindings: ${source.code} does not declare unitSet and cannot be the unit source of ${site.module.code}.${site.coordinate.path}`);
  }
  const factor = site.fields.find((candidate) => candidate.key === choice.factorInto);
  if (!factor || factor.type !== "number") {
    schemaFail(`source bindings: ${site.module.code}.${site.coordinate.path}.unitChoice.factorInto did not resolve to a same-layer number`);
  }
  const main = requireField(source, null, source.unitSet.main, `${source.code}.unitSet.main`, false);
  const auxiliary = requireField(source, null, source.unitSet.auxiliary, `${source.code}.unitSet.auxiliary`, false);
  const rate = requireField(source, null, source.unitSet.conversionRate, `${source.code}.unitSet.conversionRate`, false);
  return {
    id: stableId("unit-choice", ...coordinateId(site.coordinate)),
    kind: "unit-choice",
    scope: "cross-record",
    mode: "default",
    mechanism: "unitChoice",
    source: entity(source.code, null),
    target: site.coordinate,
    via: coordinate(site.module.code, site.table?.key ?? null, match.key),
    main: main.coordinate,
    auxiliary: auxiliary.coordinate,
    conversionRate: rate.coordinate,
    factorInto: coordinate(site.module.code, site.table?.key ?? null, factor.key),
    explain:
      `main/auxiliary unit candidates come from ${source.code} through ${match.key}; priority is non-blank user value > non-blank refDefault > main unit, ` +
      `the main-unit factor is 1 and the auxiliary-unit factor is ${source.unitSet.conversionRate} (1 auxiliary unit = N main units)`,
  };
}

function requireTargetPath(module: ModuleSchema, path: string, at: string): FieldSite {
  const parts = path.split(".");
  if (parts.length === 1 && parts[0]) {
    const hit = sitesOf(module).filter((site) => site.table === null && site.field.key === parts[0]);
    if (hit.length === 1 && hit[0]) return hit[0];
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    const hit = sitesOf(module).filter(
      (site) => site.table?.key === parts[0] && site.field.key === parts[1],
    );
    if (hit.length === 1 && hit[0]) return hit[0];
  }
  schemaFail(`source bindings: ${at} points at an unknown or non-unique target path "${module.code}.${path}"`);
}

function mappingSortKey(mapping: CreationMapping): string {
  const source = mapping.source.kind === "field"
    ? ["field", ...coordinateId(mapping.source.coordinate)]
    : mapping.source.kind === "identity"
      ? ["identity", mapping.source.entity.module, mapping.source.entity.table]
      : ["literal", typeof mapping.source.value, String(mapping.source.value)];
  return stableId("mapping", ...coordinateId(mapping.target), mapping.mechanism, ...source);
}

function canonicalMappings(mappings: readonly CreationMapping[], at: string): readonly CreationMapping[] {
  const byTarget = new Map<string, CreationMapping>();
  for (const mapping of mappings) {
    const key = stableId(...coordinateId(mapping.target));
    if (byTarget.has(key)) {
      schemaFail(`source bindings: the target "${mapping.target.module}.${mapping.target.path}" of ${at} has more than one source`);
    }
    byTarget.set(key, mapping);
  }
  return [...byTarget.values()].sort((left, right) => compareText(mappingSortKey(left), mappingSortKey(right)));
}

/**
 * Project one cell of buildPushDraft/pushLineValues. This does not rewrite the "which source table / which cell can be carried" rule:
 * source table, source field, and fillable all call the runtime primitives in relations.ts.
 */
function copiedMapping(source: ModuleSchema, site: FieldSite, line: PushLineMapping | null): CreationMapping | null {
  const target = site.field;
  const targetTable = site.table;
  if (isPlannerSupplied(target)) {
    // Same source as buildPushDraft: an ordinary push accepts only an explicit pushFrom and does not guess a same-named field into a Planner-frozen value.
    if (targetTable !== null || target.pushFrom === null) return null;
    const from = pushSourceField(source, target, null, line);
    if (from === null) return null;
    return {
      mode: "copy",
      mechanism: "pushFrom",
      source: { kind: "field", coordinate: coordinate(source.code, null, from.key) },
      target: site.coordinate,
    };
  }
  if (
    isSystemSupplied(target, targetTable === null ? undefined : site.fields) &&
    !(target.snapshot != null && target.pushFrom !== null)
  ) {
    return null;
  }

  if (target.pushFrom === null && target.type === "ref" && target.ref === source.code) {
    return {
      mode: "copy",
      mechanism: "source-record",
      source: { kind: "identity", entity: entity(source.code, null) },
      target: site.coordinate,
    };
  }

  // buildPushDraft skips a header primary after the source-bill ref is derived; the order stays the same.
  if (targetTable === null && target.primary) return null;

  if (targetTable !== null && target.pushFrom === null && target.type === "refLine" && target.ref === source.code) {
    const sourceTable = pushSourceTable(source, targetTable, line);
    if (sourceTable === null) return null;
    return {
      mode: "copy",
      mechanism: "source-line",
      source: { kind: "identity", entity: entity(source.code, sourceTable.key) },
      target: site.coordinate,
    };
  }

  if (!isPushFillable(source, target, targetTable, isSystemSupplied, line)) return null;
  const from = pushSourceField(source, target, targetTable, line);
  if (from === null) return null;
  const sourceTable = targetTable === null ? null : pushSourceTable(source, targetTable, line);
  const onLine = sourceTable?.fields?.some((field) => field.key === from.key) === true;
  return {
    mode: "copy",
    mechanism: target.pushFrom === null ? "same-name" : "pushFrom",
    source: { kind: "field", coordinate: coordinate(source.code, onLine ? sourceTable!.key : null, from.key) },
    target: site.coordinate,
  };
}

function lineMappings(
  source: ModuleSchema,
  target: ModuleSchema,
  targetTable: Field,
  line: PushLineMapping | null,
): readonly CreationMapping[] {
  // When buildPushDraft cannot find the source table it generates no target lines at all; a mapping must not be invented just because one column looks fillable.
  if (pushSourceTable(source, targetTable, line) === null) return [];
  const targetFields = requireSubtableFields(targetTable, `${target.code}.${targetTable.key}`);
  return canonicalMappings(
    targetFields.flatMap((field) => {
      const mapping = copiedMapping(source, {
        module: target,
        table: targetTable,
        fields: targetFields,
        field,
        coordinate: coordinate(target.code, targetTable.key, field.key),
      }, line);
      return mapping === null ? [] : [mapping];
    }),
    `${source.code} -> ${target.code}.${targetTable.key}`,
  );
}

/**
 * The push source of one action. The push declarations of several edges of the same action are identical character for character (`normalizeLifecycle` guarantees it),
 * so one row is emitted per action, and the source statuses are the starts of all of its edges — emitting per edge would make the same stable id appear several times.
 */
function pushBinding(
  modules: ReadonlyMap<string, ModuleSchema>,
  source: ModuleSchema,
  code: string,
): CreationBinding | null {
  const edges = transitionEdges(source, code);
  const transition = edges[0];
  if (transition === undefined || transition.push === null) return null;
  const target = requireModule(modules, transition.push, `${source.code}.${transition.code}.push`);
  const mappings: CreationMapping[] = [];
  for (const field of target.fields) {
    if (field.type === "subtable") {
      mappings.push(...lineMappings(source, target, field, transition.pushLine));
      continue;
    }
    const mapping = copiedMapping(source, {
      module: target,
      table: null,
      fields: target.fields,
      field,
      coordinate: coordinate(target.code, null, field.key),
    }, transition.pushLine);
    if (mapping !== null) mappings.push(mapping);
  }
  for (const [path, value] of Object.entries(transition.pushDefaults ?? {}).sort(([left], [right]) => compareText(left, right))) {
    const site = requireTargetPath(target, path, `${source.code}.${transition.code}.pushDefaults`);
    mappings.push({
      mode: "constant",
      mechanism: "push-default",
      source: { kind: "literal", value },
      target: site.coordinate,
    });
  }
  return {
    id: stableId("creation", "push", source.code, transition.code, target.code),
    kind: "creation",
    scope: "cross-record",
    mechanism: "push",
    label: transition.action,
    source: entity(source.code, null),
    target: { module: target.code, path: null },
    transition: { module: source.code, code: transition.code },
    sourceStatuses: canonicalStrings(edges.map((edge) => edge.from)),
    sourceRemaining: null,
    mappings: canonicalMappings(mappings, `${source.code}.${transition.code} -> ${target.code}`),
    explain: `edge ${transition.code} of module ${source.code} pushes and creates ${target.code}`,
  };
}

function createFromBindings(
  modules: readonly ModuleSchema[],
  index: ReadonlyMap<string, ModuleSchema>,
): readonly CreationBinding[] {
  const out: CreationBinding[] = [];
  for (const source of [...modules].sort((left, right) => compareText(left.code, right.code))) {
    // Entry discovery shares creationFlowsOf with server/web; this does not scan views.createFrom again and write a second source rule.
    for (const flow of creationFlowsOf(modules, source.code)) {
      const target = requireModule(index, flow.target, `${source.code}.creationFlows.target`);
      const site = requireTargetPath(target, flow.path, `${target.code}.views.createFrom`);
      let sourceTable: Field | null = null;
      let mappings: readonly CreationMapping[];
      if (flow.level === "header") {
        mappings = [{
          mode: "copy",
          mechanism: "source-record",
          source: { kind: "identity", entity: entity(source.code, null) },
          target: site.coordinate,
        }];
      } else {
        if (site.table === null || site.field.type !== "refLine" || site.field.through === null) {
          schemaFail(`source bindings: ${target.code}.views.createFrom "${flow.path}" did not resolve to a line refLine`);
        }
        sourceTable = requireTable(source, site.field.through, `${target.code}.views.createFrom.${flow.path}.through`);
        mappings = lineMappings(source, target, site.table, null);
      }

      let remaining: CreationBinding["sourceRemaining"] = null;
      if (flow.sourceRemaining !== null) {
        if (sourceTable === null) schemaFail(`source bindings: header createFrom "${target.code}.${flow.path}" cannot declare a source-line balance`);
        const header = flow.sourceRemaining.header === null
          ? null
          : requireField(source, null, flow.sourceRemaining.header, `${target.code}.views.createFrom.sourceRemaining.header`);
        const parts = flow.sourceRemaining.line.split(".");
        if (parts.length !== 2 || parts[0] !== sourceTable.key || !parts[1]) {
          schemaFail(`source bindings: source-line balance "${flow.sourceRemaining.line}" is not on ${source.code}.${sourceTable.key}`);
        }
        const line = requireField(source, sourceTable.key, parts[1], `${target.code}.views.createFrom.sourceRemaining.line`);
        remaining = { header: header?.coordinate ?? null, line: line.coordinate };
      }

      out.push({
        id: stableId("creation", "create-from", source.code, sourceTable?.key ?? null, target.code, site.table?.key ?? null, site.field.key),
        kind: "creation",
        scope: "cross-record",
        mechanism: "create-from",
        label: flow.label,
        source: entity(source.code, sourceTable?.key ?? null),
        target: { module: target.code, path: flow.path },
        transition: null,
        sourceStatuses: flow.sourceStatuses === null ? null : canonicalStrings(flow.sourceStatuses),
        sourceRemaining: remaining,
        mappings: canonicalMappings(mappings, `${source.code} create-from ${target.code}.${flow.path}`),
        explain:
          sourceTable === null
            ? `create ${target.code} from a ${source.code} record, prefilling ${flow.path}`
            : `create ${target.code} from ${source.code}.${sourceTable.key} lines, writing ${flow.path}`,
      });
    }
  }
  return out;
}

/** Planner bindings are per action: one row per action, not repeated per edge. */
function plannerBinding(
  module: ModuleSchema,
  code: string,
): PlannerExecutionBinding | null {
  const transition = transitionEdges(module, code)[0];
  if (transition === undefined || !transition.expandsBills) return null;
  return {
    id: stableId("planner-execution", module.code, transition.code),
    kind: "planner-execution",
    scope: "cross-record",
    source: entity(module.code, null),
    transition: { module: module.code, code: transition.code },
    targets: { kind: "dynamic" },
    explain: `edge ${transition.code} of module ${module.code} runs a dynamic Planner; the target set exists only in the runtime ExecutionPlan`,
  };
}

export interface UnitChoiceSourceError {
  readonly code: string;
  readonly module: string;
  readonly path: string;
  readonly message: string;
}

/**
 * The only part of unitChoice that needs the whole module table to judge. A pure function, zero IO, so the loader can consume it directly at assembly time;
 * sourceBindingsOf also requires it first, so a material index / acceptance list does not emit a half-true IR on a sick declaration.
 */
export function validateUnitChoiceSources(modules: readonly ModuleSchema[]): readonly UnitChoiceSourceError[] {
  const index = new Map(modules.map((module) => [module.code, module]));
  const errors: UnitChoiceSourceError[] = [];
  for (const module of modules) {
    for (const site of sitesOf(module)) {
      const choice = site.field.unitChoice;
      if (choice == null) continue;
      const path = `${site.coordinate.path}.unitChoice`;
      const match = site.fields.find((candidate) => candidate.key === choice.match);
      if (!match || match.type !== "ref" || match.ref === null) {
        errors.push({
          code: "UNIT_CHOICE_MATCH_NOT_REF",
          module: module.code,
          path: `${path}.match`,
          message: `match "${choice.match}" must be a same-layer, unique ref that has a target`,
        });
        continue;
      }
      const source = index.get(match.ref);
      if (!source) {
        errors.push({
          code: "UNIT_CHOICE_SOURCE_UNKNOWN",
          module: module.code,
          path: `${path}.match`,
          message: `product reference "${choice.match}" points at a module that does not exist "${match.ref}"`,
        });
        continue;
      }
      if (source.unitSet == null) {
        errors.push({
          code: "UNIT_CHOICE_SOURCE_NO_UNIT_SET",
          module: module.code,
          path,
          message: `source module "${source.code}" does not declare unitSet`,
        });
        continue;
      }
      for (const [role, key] of Object.entries(source.unitSet)) {
        const sourceField = source.fields.find((candidate) => candidate.key === key);
        if (!sourceField || !hasColumn(sourceField)) {
          errors.push({
            code: "UNIT_CHOICE_SOURCE_FIELD_NOT_STORED",
            module: module.code,
            path,
            message: `source ${source.code}.unitSet.${role} points at an unknown or non-stored field "${key}"`,
          });
        }
      }
    }
  }
  return errors;
}

/**
 * Derive the canonical SourceBinding IR from the complete module table.
 *
 * The return order uses the same code-unit total order as JS's default sort and is not affected by locale/ICU; the stable id is a JSON tuple.
 * The same id means two declarations contest one fact. Throw immediately; do not let the later write overwrite the earlier one.
 */
export function sourceBindingsOf(modules: readonly ModuleSchema[]): readonly SourceBinding[] {
  const unitErrors = validateUnitChoiceSources(modules);
  if (unitErrors.length > 0) {
    schemaFail(
      `source bindings: unit-source validation failed: ` +
        unitErrors.map((error) => `${error.module}.${error.path} [${error.code}] ${error.message}`).join("；"),
    );
  }
  const index = moduleIndex(modules);
  const out: SourceBinding[] = [];
  for (const module of [...modules].sort((left, right) => compareText(left.code, right.code))) {
    for (const site of sitesOf(module)) {
      if (site.field.type === "ref" || site.field.type === "refLine") {
        if (site.field.ref === null) schemaFail(`source bindings: ${module.code}.${site.coordinate.path} is a reference but has no ref`);
        const sourceModule = requireModule(index, site.field.ref, `${module.code}.${site.coordinate.path}.ref`);
        let sourceTable: Field | null = null;
        if (site.field.type === "refLine") {
          if (site.field.through === null) schemaFail(`source bindings: ${module.code}.${site.coordinate.path} is a refLine but has no through`);
          sourceTable = requireTable(sourceModule, site.field.through, `${module.code}.${site.coordinate.path}.through`);
        }
        assertCandidateConditions(index, site, site.field.refFilter, "refFilter");
        assertCandidateConditions(index, site, site.field.refPreselect, "refPreselect");
        out.push({
          id: stableId("field-select", ...coordinateId(site.coordinate)),
          kind: "field-select",
          scope: "cross-record",
          mode: "live",
          mechanism: site.field.type,
          source: entity(sourceModule.code, sourceTable?.key ?? null),
          target: site.coordinate,
          selectable: !isSystemSupplied(site.field, site.table === null ? undefined : site.fields),
          filter: canonicalConditions(site.field.refFilter),
          preselect: canonicalConditions(site.field.refPreselect),
          explain:
            site.field.type === "ref"
              ? `${module.code}.${site.coordinate.path} selects a ${sourceModule.code} record`
              : `${module.code}.${site.coordinate.path} selects a ${sourceModule.code}.${String(sourceTable?.key)} line`,
        });
      }
      out.push(...fieldValueBindings(index, site));
      const unit = unitChoiceBinding(index, site);
      if (unit !== null) out.push(unit);
    }
    for (const action of transitionActions(module.lifecycle)) {
      const pushed = pushBinding(index, module, action.code);
      if (pushed !== null) out.push(pushed);
      const planned = plannerBinding(module, action.code);
      if (planned !== null) out.push(planned);
    }
  }
  out.push(...createFromBindings(modules, index));

  const seen = new Set<string>();
  for (const binding of out) {
    if (seen.has(binding.id)) schemaFail(`source bindings: stable id "${binding.id}" is duplicated; two declarations contest the same source fact`);
    seen.add(binding.id);
  }
  return out.sort((left, right) => compareText(left.id, right.id));
}
