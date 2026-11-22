// ---------------------------------------------------------------------------
// Surface — a read-only, parameterized query projection.
//
// 🔴 Not a seventh concept, and not a module: no table of its own, no state
// machine, no stored data. It is a named way to read existing modules and ledgers.
// The write-path escape hatches are planners / actionPreparers / batchActions.
// This is the legal shape of the read path.
//
// Zero IO. Exactly one of sql / modes / pivot is non-empty. packages only compileBoundSql or compilePivotSql.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  optionalText,
  requireArray,
  requireCoordinateSegment,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import { businessColumnName, snake } from "../derive/pgNames.js";
import { labelFieldsOf, referenceLabelSeparator } from "../derive/referenceLabel.js";
import {
  formulaFields,
  hasColumn,
  isDerived,
  isNumericFieldType,
  normalizeExpr,
  type DeriveAgg,
  type Expr,
  type Field,
  type FieldType,
  type FormulaOp,
} from "../schema/fields.js";
import {
  isPlatformField,
  isPlatformLineField,
  PLATFORM_FIELD_TYPES,
  type ModuleSchema,
  type PlatformField,
} from "../schema/module.js";
import { type EffectTarget } from "../schema/effects.js";
import { type RowFilter } from "../schema/common.js";
import { listLedgerCodes } from "./ledger.js";
import { collectBoundSqlReads, mergeBoundSqlReads, type BoundSqlReads } from "./sqlCell.js";

export const SURFACE_PARAM_TYPES = ["string", "boolean", "integer", "number", "enum", "stringList"] as const;
export type SurfaceParamType = (typeof SURFACE_PARAM_TYPES)[number];

/**
 * moduleLabel: SQL is given a module code, and the executor projects it to catalog.label. null when it is not any module.
 * choice: SQL is given a tenant dictionary code, and the executor projects it to the effective option.label. If it cannot be found, the code is shown as-is.
 */
export const SURFACE_COLUMN_TYPES = ["string", "number", "datetime", "moduleLabel", "choice"] as const;
export type SurfaceColumnType = (typeof SURFACE_COLUMN_TYPES)[number];

export interface SurfaceParamOption {
  readonly value: string;
  readonly label: string;
}

export interface SurfaceParam {
  readonly key: string;
  readonly label: string;
  readonly type: SurfaceParamType;
  readonly required: boolean;
  readonly options: readonly SurfaceParamOption[] | null;
  readonly description: string | null;
  /** This key must not appear when other parameters take these values (for example warehouseId times mode=crossWarehouse). */
  readonly incompatibleWith: Readonly<Record<string, readonly string[]>> | null;
}

export const SURFACE_EXTRA_KINDS = ["sql", "page", "pageSize"] as const;
export type SurfaceExtraKind = (typeof SURFACE_EXTRA_KINDS)[number];

export type SurfaceExtra =
  | { readonly kind: "sql"; readonly sql: string }
  | { readonly kind: "page" }
  | { readonly kind: "pageSize" };

export interface SurfaceColumn {
  readonly key: string;
  readonly label: string;
  readonly type: SurfaceColumnType;
  /** Required when type=choice. Points at a catalog.choiceSets code. Must be null for every other type. */
  readonly choiceSet: string | null;
}

export interface SurfaceReads {
  readonly modules: readonly string[];
  readonly ledgers: readonly EffectTarget[];
}

/** Pivot column axis. id / label are identical, character for character, to that column dimension's value in items and to `${colDim}Label`. */
export interface SurfacePivotCol {
  readonly id: string | null;
  readonly label: string | null;
  readonly attrs: Readonly<Record<string, string | null>>;
}

export interface SurfaceResult {
  readonly items: readonly Readonly<Record<string, unknown>>[];
  readonly total: number;
  readonly extras: Readonly<Record<string, unknown>>;
  /** Pivot query surfaces only. A non-pivot surface does not carry this key. [] when there is no column dimension. */
  readonly cols?: readonly SurfacePivotCol[];
}

export const SURFACE_PIVOT_FORMATS = ["integer", "percent"] as const;
export type SurfacePivotFormat = (typeof SURFACE_PIVOT_FORMATS)[number];

export const SURFACE_PIVOT_SORTS = ["labelAsc", "dateDesc"] as const;
export type SurfacePivotDefaultSort = (typeof SURFACE_PIVOT_SORTS)[number];

export const SURFACE_PIVOT_LAYERS = ["header", "line"] as const;
export type SurfacePivotLayer = (typeof SURFACE_PIVOT_LAYERS)[number];

export const SURFACE_PIVOT_AGGS = ["sum", "max"] as const;
export type SurfacePivotFactAgg = (typeof SURFACE_PIVOT_AGGS)[number];

export const SURFACE_PIVOT_DIM_FILTERS = ["ilike", "dateRange"] as const;
export type SurfacePivotDimFilter = (typeof SURFACE_PIVOT_DIM_FILTERS)[number];

export const SURFACE_PIVOT_MEASURE_FILTERS = ["range"] as const;
export type SurfacePivotMeasureFilter = (typeof SURFACE_PIVOT_MEASURE_FILTERS)[number];

export const SURFACE_PIVOT_BUCKETS = ["pastDue"] as const;
export type SurfacePivotBucket = (typeof SURFACE_PIVOT_BUCKETS)[number];

export interface SurfacePivotDimOptions {
  readonly past: string;
  readonly notPast: string;
}

/** Exactly one of field and rowExpr is non-empty. rowExpr is evaluated on the fact row, then aggregated by agg. Omitting rowExpr is the same as null. */
export interface SurfacePivotFactMeasure {
  readonly field: string | null;
  readonly rowExpr?: Expr | null;
  readonly agg: SurfacePivotFactAgg | null;
}

export interface SurfacePivotFact {
  readonly module: string;
  readonly through: string | null;
  readonly status: readonly string[];
  readonly dateField: string;
  readonly measures: Readonly<Record<string, SurfacePivotFactMeasure>>;
}

export interface SurfacePivotDimension {
  readonly label: string;
  readonly path: readonly string[];
  readonly on: SurfacePivotLayer | null;
  readonly field: string | null;
  readonly filterable: boolean;
  readonly filter: SurfacePivotDimFilter | null;
  readonly bucket: SurfacePivotBucket | null;
  readonly options: SurfacePivotDimOptions | null;
  readonly attrs: Readonly<Record<string, { label: string; field: string }>>;
}

export type SurfacePivotMeasureExpr =
  | { readonly kind: "sum"; readonly of: string }
  | { readonly kind: "max"; readonly of: string }
  | { readonly kind: "add"; readonly left: string; readonly right: string }
  | { readonly kind: "sub"; readonly left: string; readonly right: string }
  | { readonly kind: "ratio"; readonly numerator: string; readonly denominator: string; readonly scale: number };

export interface SurfacePivotMeasure {
  readonly label: string;
  readonly format: SurfacePivotFormat;
  readonly expr: SurfacePivotMeasureExpr;
  readonly filter: SurfacePivotMeasureFilter | null;
}

export interface SurfacePivot {
  readonly facts: readonly SurfacePivotFact[];
  readonly dimensions: Readonly<Record<string, SurfacePivotDimension>>;
  readonly measures: Readonly<Record<string, SurfacePivotMeasure>>;
  readonly defaultRowDims: readonly string[];
  readonly requiredRowDims: readonly string[];
  readonly maxRangeDays: number;
  readonly defaultSort: SurfacePivotDefaultSort;
}

export interface SurfacePivotListing {
  readonly dimensions: readonly {
    readonly key: string;
    readonly label: string;
    readonly module?: string;
    readonly filter?: "ilike" | "dateRange";
    readonly options?: readonly { readonly value: string; readonly label: string }[];
    readonly attrs?: readonly { key: string; label: string }[];
  }[];
  readonly measures: readonly {
    readonly key: string;
    readonly label: string;
    readonly format: SurfacePivotFormat;
    readonly filter?: "range";
  }[];
  readonly defaultRowDims: readonly string[];
  readonly requiredRowDims: readonly string[];
  readonly maxRangeDays: number;
  readonly defaultSort: SurfacePivotDefaultSort;
}

export interface SurfaceDefinition {
  readonly label: string;
  readonly permission: string;
  /** The framework page path on the human side. null = not in navigation (for drill-down or attached queries). */
  readonly path: string | null;
  readonly params: readonly SurfaceParam[];
  readonly columns: readonly SurfaceColumn[];
  readonly reads: SurfaceReads;
  readonly sql: string | null;
  readonly modes: Readonly<Record<string, string>> | null;
  readonly extras: Readonly<Record<string, SurfaceExtra>>;
  readonly pivot: SurfacePivot | null;
}

export type Surfaces = Readonly<Record<string, SurfaceDefinition>>;
export type SurfaceModuleCatalog = Readonly<Record<string, ModuleSchema>>;

/** The loader does not guess from a function's shape whether a registry passed through the kernel entry. */
export const DEFINED_SURFACES_BY_KERNEL = Symbol.for("open-erp.definedSurfaces");

const SURFACE_DEF_KEYS = ["label", "permission", "path", "params", "columns", "sql", "modes", "extras", "pivot"] as const;
const SURFACE_PARAM_KEYS = ["key", "label", "type", "required", "options", "description", "incompatibleWith"] as const;
const SURFACE_COLUMN_KEYS = ["key", "label", "type", "choiceSet"] as const;
const SURFACE_PIVOT_KEYS = ["facts", "dimensions", "measures", "defaultRowDims", "requiredRowDims", "maxRangeDays", "defaultSort"] as const;
const SURFACE_PIVOT_FACT_KEYS = ["module", "status", "dateField", "measures", "through"] as const;
const SURFACE_PIVOT_DIM_KEYS = ["label", "path", "filterable", "on", "field", "filter", "bucket", "options", "attrs"] as const;
const SURFACE_PIVOT_DIM_ATTR_KEYS = ["label", "field"] as const;
const SURFACE_PIVOT_MEASURE_KEYS = ["label", "format", "expr", "filter"] as const;
const SURFACE_PIVOT_DIM_OPTION_KEYS = ["past", "notPast"] as const;
const SURFACE_PIVOT_FACT_MEASURE_KEYS = ["field", "rowExpr", "agg"] as const;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** PostgreSQL `RESERVED_KEYWORD` (kwlist.h), a closed set. */
const PG_RESERVED_KEYWORDS = new Set([
  "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "asymmetric",
  "both", "case", "cast", "check", "collate", "column", "constraint", "create",
  "current_catalog", "current_date", "current_role", "current_time", "current_timestamp",
  "current_user", "default", "deferrable", "desc", "distinct", "do", "else", "end",
  "except", "false", "fetch", "for", "foreign", "from", "grant", "group", "having",
  "in", "initially", "intersect", "into", "lateral", "leading", "limit", "localtime",
  "localtimestamp", "not", "null", "offset", "on", "only", "or", "order", "placing",
  "primary", "references", "returning", "select", "session_user", "some", "symmetric",
  "system_user", "table", "then", "to", "trailing", "true", "union", "unique", "user",
  "using", "variadic", "when", "where", "window", "with",
]);

function assertNotSqlReserved(key: string, at: string): void {
  if (PG_RESERVED_KEYWORDS.has(key.toLowerCase()) || PG_RESERVED_KEYWORDS.has(snake(key))) {
    schemaFail(`${at} "${key}" is an SQL reserved word; pick another name`);
  }
}

export interface ResolvedPivotHop {
  readonly field: string;
  readonly fromModule: string;
  readonly toModule: string;
  readonly column: string;
  readonly fromAlias: "f" | "h";
}

export interface ResolvedPivotRollup {
  readonly from: string;
  readonly through: string | null;
  readonly matchColumn: string;
  readonly onColumn: string | null;
  readonly agg: DeriveAgg;
  readonly measureColumn: string | null;
  readonly measureLayer: SurfacePivotLayer;
  readonly where: RowFilter | null;
}

export type ResolvedPivotDimValueKind = "sentinel" | "date" | "bucket";

export interface ResolvedPivotDimension {
  readonly key: string;
  readonly label: string;
  readonly filterable: boolean;
  readonly filter: SurfacePivotDimFilter | null;
  readonly bucket: SurfacePivotBucket | null;
  readonly options: SurfacePivotDimOptions | null;
  readonly valueKind: ResolvedPivotDimValueKind;
  readonly path: readonly ResolvedPivotHop[];
  /**
   * The module of the record the dimension value points at. When non-null it always has `labelParts`.
   * A path dimension is the target of the last hop. An `on` + `field: "id"` dimension is the fact module itself.
   */
  readonly endpointModule: string | null;
  /** How the endpoint record is named (`labelFieldsOf`), the same list as reference candidates and echo. Empty when `endpointModule` is empty. */
  readonly labelParts: readonly ResolvedPivotLabelPart[];
  readonly labelSeparator: string;
  readonly fieldAlias: "f" | "h" | null;
  readonly fieldColumn: string | null;
  readonly attrs: readonly { key: string; label: string; column: string; choiceSet: string | null }[];
}

/** One cell of the name: a column on the endpoint table, or a column reached by joining another table through a lookup derive. */
export interface ResolvedPivotLabelPart {
  readonly column: string;
  readonly lookup: { readonly module: string; readonly matchColumn: string } | null;
}

export interface ResolvedPivotFactMeasure {
  readonly key: string;
  readonly field: string | null;
  /** Physical column of a single-column measure. rowExpr has no single column, so this is an empty string. */
  readonly column: string;
  readonly agg: SurfacePivotFactAgg;
  readonly alias: "f" | "h";
  readonly rollup: ResolvedPivotRollup | null;
  /** When non-empty, aggregate this row expression instead of column / rollup. Omitting it is the same as null. */
  readonly rowSql?: string | null;
}

export interface ResolvedPivotFact {
  readonly index: number;
  readonly module: string;
  readonly through: string | null;
  readonly status: readonly string[];
  readonly dateField: string;
  readonly dateColumn: string;
  readonly dateAlias: "f" | "h";
  readonly measures: readonly ResolvedPivotFactMeasure[];
}

export interface ResolvedPivot {
  readonly facts: readonly ResolvedPivotFact[];
  readonly dimensions: readonly ResolvedPivotDimension[];
  readonly measures: Readonly<Record<string, SurfacePivotMeasure>>;
  readonly measureOrder: readonly string[];
  readonly defaultRowDims: readonly string[];
  readonly requiredRowDims: readonly string[];
  readonly maxRangeDays: number;
  readonly defaultSort: SurfacePivotDefaultSort;
  readonly reads: SurfaceReads;
}

const SYSTEM_PERMISSION_PATTERN = /^system:[a-zA-Z][a-zA-Z0-9]*:[a-z]+$/;
const FRAMEWORK_PATH_PATTERN = /^\/_[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeParamOption(raw: unknown, at: string): SurfaceParamOption {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["value", "label"] as const, at);
  return { value: requireText(obj["value"], `${at}.value`), label: requireText(obj["label"], `${at}.label`) };
}

function normalizeParam(raw: unknown, at: string): SurfaceParam {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SURFACE_PARAM_KEYS, at);
  const type = requireEnum(obj["type"], SURFACE_PARAM_TYPES, `${at}.type`);
  const requiredRaw = obj["required"];
  if (requiredRaw !== undefined && typeof requiredRaw !== "boolean") {
    schemaFail(`${at}.required must be a boolean`);
  }
  const required = requiredRaw === true;
  let options: readonly SurfaceParamOption[] | null = null;
  if (obj["options"] !== undefined && obj["options"] !== null) {
    const list = requireArray(obj["options"], `${at}.options`).map((entry, index) =>
      normalizeParamOption(entry, `${at}.options[${String(index)}]`),
    );
    if (list.length === 0) schemaFail(`${at}.options is an empty array. Do not write this key when an enum has no candidates`);
    assertUniqueKeys(list.map((item) => item.value), `${at}.options`);
    options = list;
  }
  if (type === "enum" && options === null) schemaFail(`${at}: type=enum must declare options`);
  if (type !== "enum" && options !== null) schemaFail(`${at}: only enum may declare options`);
  const description = obj["description"] === undefined || obj["description"] === null
    ? null
    : requireText(obj["description"], `${at}.description`);
  let incompatibleWith: Readonly<Record<string, readonly string[]>> | null = null;
  if (obj["incompatibleWith"] !== undefined && obj["incompatibleWith"] !== null) {
    const rawMap = requireObject(obj["incompatibleWith"], `${at}.incompatibleWith`);
    incompatibleWith = Object.fromEntries(
      Object.entries(rawMap).map(([other, values]) => [
        requireCoordinateSegment(other, `${at}.incompatibleWith.${other}`),
        requireArray(values, `${at}.incompatibleWith.${other}`).map((item, index) =>
          requireText(item, `${at}.incompatibleWith.${other}[${String(index)}]`),
        ),
      ]),
    );
  }
  return {
    key: requireCoordinateSegment(obj["key"], `${at}.key`),
    label: requireText(obj["label"], `${at}.label`),
    type,
    required,
    options,
    description,
    incompatibleWith,
  };
}

function normalizeColumn(raw: unknown, at: string): SurfaceColumn {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SURFACE_COLUMN_KEYS, at);
  const type = requireEnum(obj["type"], SURFACE_COLUMN_TYPES, `${at}.type`);
  const choiceSet = optionalText(obj["choiceSet"], `${at}.choiceSet`);
  if (type === "choice") {
    if (choiceSet === null) schemaFail(`${at}: type=choice must declare choiceSet`);
  } else if (choiceSet !== null) {
    schemaFail(`${at}: only choice may declare choiceSet`);
  }
  return {
    key: requireCoordinateSegment(obj["key"], `${at}.key`),
    label: requireText(obj["label"], `${at}.label`),
    type,
    choiceSet,
  };
}

function toSurfaceReads(collected: BoundSqlReads, at: string): SurfaceReads {
  const ledgers = collected.ledgers.map((code) => requireEnum(code, listLedgerCodes(), `${at} derived ledger`));
  if (collected.modules.length === 0 && ledgers.length === 0) {
    schemaFail(`${at} derives neither a module nor a ledger`);
  }
  return { modules: collected.modules, ledgers };
}

function readsFromSqlSources(
  sql: string | null,
  modes: Readonly<Record<string, string>> | null,
  extras: Readonly<Record<string, SurfaceExtra>>,
  at: string,
): BoundSqlReads {
  const parts: BoundSqlReads[] = [];
  if (sql !== null) parts.push(collectBoundSqlReads(sql, at));
  if (modes !== null) {
    for (const [mode, value] of Object.entries(modes)) {
      parts.push(collectBoundSqlReads(value, `${at}.modes.${mode}`));
    }
  }
  for (const [key, extra] of Object.entries(extras)) {
    if (extra.kind === "sql") parts.push(collectBoundSqlReads(extra.sql, `${at}.extras.${key}`));
  }
  return mergeBoundSqlReads(parts);
}

/** Modules a pivot reads: fact modules, plus hop from/to, plus rollup.from after bind. At declaration time only facts exist. Hops and rollup appear after the loader binds. An on dimension has an empty path and introduces no new module. */
function pivotReads(
  facts: readonly { readonly module: string; readonly measures?: object }[],
  dimensions: readonly {
    readonly path: readonly { readonly fromModule: string; readonly toModule: string }[];
    readonly labelParts: readonly ResolvedPivotLabelPart[];
  }[],
): BoundSqlReads {
  const modules: string[] = [];
  const add = (module: string): void => {
    if (!modules.includes(module)) modules.push(module);
  };
  for (const fact of facts) {
    add(fact.module);
    if (fact.measures === undefined) continue;
    const list = (Array.isArray(fact.measures) ? fact.measures : Object.values(fact.measures)) as readonly {
      readonly rollup?: { readonly from: string } | null;
    }[];
    for (const measure of list) {
      const from = measure.rollup?.from;
      if (from !== undefined) add(from);
    }
  }
  for (const dimension of dimensions) {
    for (const hop of dimension.path) {
      add(hop.fromModule);
      add(hop.toModule);
    }
    for (const part of dimension.labelParts) {
      if (part.lookup !== null) add(part.lookup.module);
    }
  }
  return { modules, ledgers: [] };
}

export function unionSurfaceReads(left: SurfaceReads, right: SurfaceReads): SurfaceReads {
  const merged = mergeBoundSqlReads([left, right]);
  return { modules: merged.modules, ledgers: merged.ledgers as readonly EffectTarget[] };
}

function normalizePath(raw: unknown, at: string): string | null {
  if (raw === undefined || raw === null) return null;
  const path = requireText(raw, at);
  if (!FRAMEWORK_PATH_PATTERN.test(path)) {
    schemaFail(`${at} "${path}" is not a legal framework page path: it must be kebab-case starting with /_, for example /_stock-query`);
  }
  return path;
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function moduleOf(modules: SurfaceModuleCatalog, code: string, at: string): ModuleSchema {
  const module = modules[code];
  if (module === undefined) schemaFail(`${at} unknown module "${code}"`);
  return module;
}

function fieldOf(module: ModuleSchema, key: string, at: string): Field {
  const field = module.fields.find((item) => item.key === key);
  if (field === undefined) schemaFail(`${at} module "${module.code}" has no field "${key}"`);
  return field;
}

function linePlatformType(key: string): FieldType | null {
  if (!isPlatformLineField(key)) return null;
  if (key === "id") return "string";
  if (key === "lineNo") return "number";
  schemaFail(`line platform field "${key}" has no type`);
}

function subtableOf(module: ModuleSchema, through: string, at: string): Field {
  const field = module.fields.find((item) => item.key === through);
  if (field === undefined || field.type !== "subtable") {
    schemaFail(`${at} "${through}" must be a line table of module "${module.code}"`);
  }
  return field;
}

interface LocatedPivotField {
  readonly layer: SurfacePivotLayer;
  readonly key: string;
  readonly type: FieldType;
  readonly field: Field | null;
  readonly column: string;
}

function locateLayerField(
  module: ModuleSchema,
  layer: SurfacePivotLayer,
  key: string,
  through: string | null,
): LocatedPivotField | null {
  if (layer === "header") {
    if (isPlatformField(key)) {
      return { layer, key, type: PLATFORM_FIELD_TYPES[key as PlatformField], field: null, column: businessColumnName(key) };
    }
    const field = module.fields.find((item) => item.key === key && item.type !== "subtable");
    if (field === undefined) return null;
    return { layer, key, type: field.type, field, column: businessColumnName(key) };
  }
  if (through === null) return null;
  const lineType = linePlatformType(key);
  if (lineType !== null) {
    return { layer, key, type: lineType, field: null, column: businessColumnName(key) };
  }
  const table = module.fields.find((item) => item.key === through && item.type === "subtable");
  const field = table?.fields?.find((item) => item.key === key);
  if (field === undefined) return null;
  return { layer, key, type: field.type, field, column: businessColumnName(key) };
}

function locatePivotField(
  module: ModuleSchema,
  through: string | null,
  key: string,
  on: SurfacePivotLayer | null,
  at: string,
): LocatedPivotField {
  if (through === null) {
    if (on === "line") schemaFail(`${at} has no line table, so on:"line" cannot be written`);
    const found = locateLayerField(module, "header", key, null);
    if (found === null) schemaFail(`${at} module "${module.code}" has no field "${key}"`);
    return found;
  }
  if (on !== null) {
    const found = locateLayerField(module, on, key, through);
    if (found === null) {
      schemaFail(on === "header" ? `${at} the header has no field "${key}"` : `${at} the line has no field "${key}"`);
    }
    return found;
  }
  const line = locateLayerField(module, "line", key, through);
  const header = locateLayerField(module, "header", key, through);
  if (line !== null && header !== null) {
    schemaFail(`${at} both the line and the header have field "${key}"; mark which one with on`);
  }
  if (line !== null) return line;
  if (header !== null) return header;
  schemaFail(`${at} module "${module.code}" has no field "${key}"`);
}

function requireBoolean(value: unknown, at: string): boolean {
  if (typeof value !== "boolean") schemaFail(`${at} must be a boolean`);
  return value;
}

function requirePositiveInt(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    schemaFail(`${at} must be a positive integer`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) schemaFail(`${at} must be a finite number`);
  return value;
}

function normalizePivotFactMeasure(raw: unknown, at: string): SurfacePivotFactMeasure {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SURFACE_PIVOT_FACT_MEASURE_KEYS, at);
  const hasField = present(obj["field"]);
  const hasRowExpr = present(obj["rowExpr"]);
  if (hasField === hasRowExpr) schemaFail(`${at}: exactly one of field and rowExpr must be non-empty`);
  const aggRaw = obj["agg"];
  return {
    field: hasField ? requireCoordinateSegment(obj["field"], `${at}.field`) : null,
    rowExpr: hasRowExpr ? normalizeExpr(obj["rowExpr"], `${at}.rowExpr`) : null,
    agg: aggRaw === undefined || aggRaw === null
      ? null
      : requireEnum(aggRaw, SURFACE_PIVOT_AGGS, `${at}.agg`),
  };
}

function normalizePivotExpr(raw: unknown, at: string): SurfacePivotMeasureExpr {
  const obj = requireObject(raw, at);
  const kind = requireText(obj["kind"], `${at}.kind`);
  if (kind === "sum" || kind === "max") {
    assertClosedKeys(obj, ["kind", "of"] as const, at);
    return { kind, of: requireCoordinateSegment(obj["of"], `${at}.of`) };
  }
  if (kind === "add" || kind === "sub") {
    assertClosedKeys(obj, ["kind", "left", "right"] as const, at);
    return {
      kind,
      left: requireCoordinateSegment(obj["left"], `${at}.left`),
      right: requireCoordinateSegment(obj["right"], `${at}.right`),
    };
  }
  if (kind === "ratio") {
    assertClosedKeys(obj, ["kind", "numerator", "denominator", "scale"] as const, at);
    return {
      kind: "ratio",
      numerator: requireCoordinateSegment(obj["numerator"], `${at}.numerator`),
      denominator: requireCoordinateSegment(obj["denominator"], `${at}.denominator`),
      scale: requireFiniteNumber(obj["scale"], `${at}.scale`),
    };
  }
  schemaFail(`${at}.kind "${kind}" is unknown; choices: sum / add / sub / ratio / max`);
}

function measureDeps(expr: SurfacePivotMeasureExpr): readonly string[] {
  if (expr.kind === "sum" || expr.kind === "max") return [];
  if (expr.kind === "add" || expr.kind === "sub") return [expr.left, expr.right];
  return [expr.numerator, expr.denominator];
}

function topoMeasureKeys(
  measures: Readonly<Record<string, SurfacePivotMeasure>>,
  factMeasureKeys: ReadonlySet<string>,
  at: string,
): readonly string[] {
  const keys = Object.keys(measures);
  const visiting = new Set<string>();
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (key: string, from: string): void => {
    if (seen.has(key)) return;
    if (visiting.has(key)) schemaFail(`${at}.measures has a cyclic reference`);
    const measure = measures[key];
    if (measure === undefined) schemaFail(`${from} references an unknown measure "${key}"`);
    visiting.add(key);
    const expr = measure.expr;
    if (expr.kind === "sum" || expr.kind === "max") {
      if (!factMeasureKeys.has(expr.of)) {
        schemaFail(`${at}.measures.${key}.expr.of "${expr.of}" is not a fact measure`);
      }
    } else {
      for (const dep of measureDeps(expr)) visit(dep, `${at}.measures.${key}.expr`);
    }
    visiting.delete(key);
    seen.add(key);
    order.push(key);
  };
  for (const key of keys) visit(key, `${at}.measures`);
  return order;
}

function normalizePivotDimAttrs(
  raw: unknown,
  here: string,
  taken: ReadonlySet<string>,
): Readonly<Record<string, { label: string; field: string }>> {
  if (raw === undefined || raw === null) return {};
  const obj = requireObject(raw, `${here}.attrs`);
  const out: Record<string, { label: string; field: string }> = {};
  for (const [key, spec] of Object.entries(obj)) {
    requireCoordinateSegment(key, `${here}.attrs key`);
    const attrAt = `${here}.attrs.${key}`;
    assertNotSqlReserved(key, attrAt);
    if (taken.has(key) || key in out) {
      schemaFail(`${attrAt} "${key}" conflicts with a dimension, a measure, or another attr`);
    }
    const attrObj = requireObject(spec, attrAt);
    assertClosedKeys(attrObj, SURFACE_PIVOT_DIM_ATTR_KEYS, attrAt);
    out[key] = {
      label: requireText(attrObj["label"], `${attrAt}.label`),
      field: requireCoordinateSegment(attrObj["field"], `${attrAt}.field`),
    };
  }
  return out;
}

function normalizePivot(raw: unknown, at: string): SurfacePivot {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SURFACE_PIVOT_KEYS, at);
  const factsRaw = requireArray(obj["facts"], `${at}.facts`);
  if (factsRaw.length === 0) schemaFail(`${at}.facts must not be empty`);
  const facts: SurfacePivotFact[] = [];
  const factMeasureKeys = new Set<string>();
  for (const [index, entry] of factsRaw.entries()) {
    const here = `${at}.facts[${String(index)}]`;
    const factObj = requireObject(entry, here);
    assertClosedKeys(factObj, SURFACE_PIVOT_FACT_KEYS, here);
    const moduleCode = requireCoordinateSegment(factObj["module"], `${here}.module`);
    const status = requireArray(factObj["status"], `${here}.status`).map((item, i) =>
      requireText(item, `${here}.status[${String(i)}]`),
    );
    if (status.length === 0) schemaFail(`${here}.status must not be empty`);
    assertUniqueKeys(status, `${here}.status`);
    const dateField = requireCoordinateSegment(factObj["dateField"], `${here}.dateField`);
    const throughRaw = factObj["through"];
    const through = throughRaw === undefined || throughRaw === null
      ? null
      : requireCoordinateSegment(throughRaw, `${here}.through`);
    const measuresObj = requireObject(factObj["measures"], `${here}.measures`);
    const measureEntries = Object.entries(measuresObj);
    if (measureEntries.length === 0) schemaFail(`${here}.measures must not be empty`);
    const measures: Record<string, SurfacePivotFactMeasure> = {};
    for (const [key, spec] of measureEntries) {
      requireCoordinateSegment(key, `${here}.measures key`);
      assertNotSqlReserved(key, `${here}.measures.${key}`);
      if (factMeasureKeys.has(key)) schemaFail(`${at} fact measure "${key}" is duplicated`);
      factMeasureKeys.add(key);
      measures[key] = normalizePivotFactMeasure(spec, `${here}.measures.${key}`);
    }
    facts.push({ module: moduleCode, through, status, dateField, measures });
  }
  const dimsObj = requireObject(obj["dimensions"], `${at}.dimensions`);
  const dimEntries = Object.entries(dimsObj);
  if (dimEntries.length === 0) schemaFail(`${at}.dimensions must not be empty`);
  const dimensions: Record<string, SurfacePivotDimension> = {};
  const dimKeys = new Set<string>();
  const attrKeys = new Set<string>();
  for (const [key] of dimEntries) {
    requireCoordinateSegment(key, `${at}.dimensions key`);
    dimKeys.add(key);
  }
  const listingMeasureKeys = Object.keys(requireObject(obj["measures"], `${at}.measures`));
  const derivedColumnKeys = [
    ...dimKeys,
    ...[...dimKeys].map((key) => `${key}Label`),
    ...listingMeasureKeys,
  ];
  for (const [key, spec] of dimEntries) {
    const here = `${at}.dimensions.${key}`;
    assertNotSqlReserved(key, here);
    const dimObj = requireObject(spec, here);
    assertClosedKeys(dimObj, SURFACE_PIVOT_DIM_KEYS, here);
    const hasPath = present(dimObj["path"]);
    const hasOn = present(dimObj["on"]);
    const hasField = present(dimObj["field"]);
    if (hasPath === (hasOn || hasField)) {
      schemaFail(`${here}: path and on/field must be one or the other`);
    }
    if (hasOn !== hasField) schemaFail(`${here}: on and field must appear together`);
    let path: readonly string[] = [];
    let on: SurfacePivotLayer | null = null;
    let field: string | null = null;
    if (hasPath) {
      path = requireArray(dimObj["path"], `${here}.path`).map((item, i) =>
        requireCoordinateSegment(item, `${here}.path[${String(i)}]`),
      );
      if (path.length < 1 || path.length > 2) schemaFail(`${here}.path must be 1 or 2 hops`);
    } else {
      on = requireEnum(dimObj["on"], SURFACE_PIVOT_LAYERS, `${here}.on`);
      field = requireCoordinateSegment(dimObj["field"], `${here}.field`);
    }
    const filterRaw = dimObj["filter"];
    const filter = filterRaw === undefined || filterRaw === null
      ? null
      : requireEnum(filterRaw, SURFACE_PIVOT_DIM_FILTERS, `${here}.filter`);
    if (filter === "ilike" && hasPath) {
      schemaFail(`${here}.filter:"ilike" can be used only on a same-table field dimension`);
    }
    if (filter === "dateRange" && hasPath) {
      schemaFail(`${here}.filter:"dateRange" can be used only on an on dimension`);
    }
    const bucketRaw = dimObj["bucket"];
    const bucket = bucketRaw === undefined || bucketRaw === null
      ? null
      : requireEnum(bucketRaw, SURFACE_PIVOT_BUCKETS, `${here}.bucket`);
    let options: SurfacePivotDimOptions | null = null;
    if (bucket === "pastDue") {
      if (hasPath) schemaFail(`${here}.bucket:"pastDue" can be used only on an on dimension`);
      if (filter !== null) schemaFail(`${here}: bucket cannot be used together with filter`);
      const optsObj = requireObject(dimObj["options"], `${here}.options`, "must be { past, notPast }");
      assertClosedKeys(optsObj, SURFACE_PIVOT_DIM_OPTION_KEYS, `${here}.options`);
      options = {
        past: requireText(optsObj["past"], `${here}.options.past`),
        notPast: requireText(optsObj["notPast"], `${here}.options.notPast`),
      };
    } else if (present(dimObj["options"])) {
      schemaFail(`${here}: only bucket:"pastDue" may declare options`);
    }
    const filterable = requireBoolean(dimObj["filterable"], `${here}.filterable`);
    if ((filter !== null || bucket !== null) && !filterable) {
      schemaFail(`${here}: filterable must be true when filter or bucket is declared`);
    }
    const taken = new Set<string>([...derivedColumnKeys, ...factMeasureKeys, ...attrKeys]);
    const attrs = normalizePivotDimAttrs(dimObj["attrs"], here, taken);
    for (const attrKey of Object.keys(attrs)) attrKeys.add(attrKey);
    dimensions[key] = {
      label: requireText(dimObj["label"], `${here}.label`),
      path,
      on,
      field,
      filterable,
      filter,
      bucket,
      options,
      attrs,
    };
  }
  const measuresObj = requireObject(obj["measures"], `${at}.measures`);
  const measureEntries = Object.entries(measuresObj);
  if (measureEntries.length === 0) schemaFail(`${at}.measures must not be empty`);
  const measures: Record<string, SurfacePivotMeasure> = {};
  for (const [key, spec] of measureEntries) {
    requireCoordinateSegment(key, `${at}.measures key`);
    const here = `${at}.measures.${key}`;
    assertNotSqlReserved(key, here);
    if (attrKeys.has(key)) schemaFail(`${here} "${key}" conflicts with an attr`);
    const measureObj = requireObject(spec, here);
    assertClosedKeys(measureObj, SURFACE_PIVOT_MEASURE_KEYS, here);
    const filterRaw = measureObj["filter"];
    const filter = filterRaw === undefined || filterRaw === null
      ? null
      : requireEnum(filterRaw, SURFACE_PIVOT_MEASURE_FILTERS, `${here}.filter`);
    const format = requireEnum(measureObj["format"], SURFACE_PIVOT_FORMATS, `${here}.format`);
    if (filter === "range" && format !== "integer" && format !== "percent") {
      schemaFail(`${here}.filter:"range" is only for number or percent measures`);
    }
    measures[key] = {
      label: requireText(measureObj["label"], `${here}.label`),
      format,
      expr: normalizePivotExpr(measureObj["expr"], `${here}.expr`),
      filter,
    };
  }
  topoMeasureKeys(measures, factMeasureKeys, at);
  const defaultRowDims = requireArray(obj["defaultRowDims"], `${at}.defaultRowDims`).map((item, i) =>
    requireCoordinateSegment(item, `${at}.defaultRowDims[${String(i)}]`),
  );
  if (defaultRowDims.length === 0) schemaFail(`${at}.defaultRowDims must not be empty`);
  assertUniqueKeys(defaultRowDims, `${at}.defaultRowDims`);
  for (const key of defaultRowDims) {
    if (!(key in dimensions)) schemaFail(`${at}.defaultRowDims "${key}" is not a key of dimensions`);
  }
  const requiredRowDims = requireArray(obj["requiredRowDims"], `${at}.requiredRowDims`).map((item, i) =>
    requireCoordinateSegment(item, `${at}.requiredRowDims[${String(i)}]`),
  );
  assertUniqueKeys(requiredRowDims, `${at}.requiredRowDims`);
  for (const key of requiredRowDims) {
    if (!(key in dimensions)) schemaFail(`${at}.requiredRowDims "${key}" is not a key of dimensions`);
    if (!defaultRowDims.includes(key)) schemaFail(`${at}.requiredRowDims "${key}" must appear in defaultRowDims`);
  }
  const defaultSortRaw = obj["defaultSort"];
  const defaultSort = defaultSortRaw === undefined || defaultSortRaw === null
    ? "labelAsc"
    : requireEnum(defaultSortRaw, SURFACE_PIVOT_SORTS, `${at}.defaultSort`);
  return {
    facts,
    dimensions,
    measures,
    defaultRowDims,
    requiredRowDims,
    maxRangeDays: requirePositiveInt(obj["maxRangeDays"], `${at}.maxRangeDays`),
    defaultSort,
  };
}

function isDateType(type: FieldType): boolean {
  return type === "date" || type === "datetime";
}

function isTextAggType(type: FieldType): boolean {
  return type === "string" || type === "text" || type === "enum" || type === "phone";
}

function factAlias(through: string | null, layer: SurfacePivotLayer): "f" | "h" {
  if (through === null) return "f";
  return layer === "header" ? "h" : "f";
}

function bindRollup(
  located: LocatedPivotField,
  modules: SurfaceModuleCatalog,
  at: string,
): ResolvedPivotRollup {
  const derive = located.field?.derive;
  if (derive?.kind !== "rollup") schemaFail(`${at} is not a rollup derive`);
  const fromModule = moduleOf(modules, derive.from, at);
  let measureLayer: SurfacePivotLayer = "header";
  if (derive.through !== null) {
    const table = subtableOf(fromModule, derive.through, `${at} rollup.through`);
    if (derive.measure !== null && table.fields?.some((item) => item.key === derive.measure)) {
      measureLayer = "line";
    } else if (derive.measure !== null && derive.agg !== "count") {
      const headerField = fromModule.fields.find((item) => item.key === derive.measure);
      if (headerField === undefined) {
        schemaFail(`${at} rollup measure "${derive.measure}" has no corresponding column on downstream module "${derive.from}"`);
      }
      if ((table.maxRows ?? null) !== 1) {
        schemaFail(
          `${at}: rollup measure "${derive.measure}" is on the header, but line table "${derive.through}" is not maxRows: 1. ` +
            `A bill with many lines would add the same header quantity more than once`,
        );
      }
      measureLayer = "header";
    }
  } else if (derive.measure !== null) {
    const headerField = fromModule.fields.find((item) => item.key === derive.measure);
    if (headerField === undefined && derive.agg !== "count") {
      schemaFail(`${at} rollup measure "${derive.measure}" has no corresponding column on downstream module "${derive.from}"`);
    }
  }
  return {
    from: derive.from,
    through: derive.through,
    matchColumn: businessColumnName(derive.match),
    onColumn: derive.on === undefined || derive.on === null ? null : businessColumnName(derive.on),
    agg: derive.agg,
    measureColumn: derive.measure === null ? null : businessColumnName(derive.measure),
    measureLayer,
    where: derive.where,
  };
}

const PIVOT_ROW_INFIX: Readonly<Record<Exclude<FormulaOp, "max">, string>> = Object.freeze({
  add: "+",
  sub: "-",
  mul: "*",
  div: "/",
});

function sqlIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) schemaFail(`rowExpr: illegal identifier "${name}"`);
  return name;
}

/** Arithmetic on a fact row. NULL propagates. Division by zero is left to the database. orElse is what becomes coalesce. */
function pivotRowExprSql(expr: Expr, alias: "f" | "h"): string {
  if ("field" in expr) return `${alias}.${sqlIdent(businessColumnName(expr.field))}`;
  if ("value" in expr) return String(expr.value);
  if ("orElse" in expr) {
    return `coalesce(${pivotRowExprSql(expr.orElse.of, alias)}, ${String(expr.orElse.whenEmpty)})`;
  }
  const parts = expr.args.map((arg) => pivotRowExprSql(arg, alias));
  if (expr.op === "max") return `greatest(${parts.join(", ")})`;
  return `(${parts.join(` ${PIVOT_ROW_INFIX[expr.op]} `)})`;
}

function bindRowExprMeasure(
  module: ModuleSchema,
  fact: SurfacePivotFact,
  key: string,
  expr: Expr,
  declaredAgg: SurfacePivotFactAgg | null,
  at: string,
): ResolvedPivotFactMeasure {
  const aliases = new Set<"f" | "h">();
  for (const name of formulaFields(expr)) {
    const fieldAt = `${at}.rowExpr`;
    const located = locatePivotField(module, fact.through, name, null, fieldAt);
    if (!isNumericFieldType(located.type)) schemaFail(`${fieldAt} "${name}" must be a numeric field`);
    if (located.field !== null && isDerived(located.field)) {
      schemaFail(`${fieldAt} "${name}" is a derived field and has no stored column`);
    }
    if (located.field !== null && !hasColumn(located.field)) {
      schemaFail(`${fieldAt} "${name}" has no stored column`);
    }
    aliases.add(factAlias(fact.through, located.layer));
  }
  if (aliases.size > 1) schemaFail(`${at}.rowExpr references fields that are not on the same level`);
  const only = [...aliases][0];
  const alias = aliases.size === 0 ? "f" : only;
  if (alias === undefined) schemaFail(`${at}.rowExpr failed to resolve`);
  return {
    key,
    field: null,
    column: "",
    agg: declaredAgg === "max" ? "max" : "sum",
    alias,
    rollup: null,
    rowSql: pivotRowExprSql(expr, alias),
  };
}

function bindFactAgg(located: LocatedPivotField, declared: SurfacePivotFactAgg | null, at: string): SurfacePivotFactAgg {
  const rollup = located.field?.derive?.kind === "rollup";
  if (isNumericFieldType(located.type) || rollup) {
    if (declared === "max") return "max";
    return "sum";
  }
  if (isDateType(located.type)) {
    if (declared !== "max") schemaFail(`${at} a date field must declare agg: "max"`);
    return "max";
  }
  if (isTextAggType(located.type)) {
    if (declared === "max") return "max";
    schemaFail(`${at} a text field must declare agg: "max"`);
  }
  schemaFail(`${at} "${located.key}" must be a numeric field`);
}

function bindPivotAttrs(
  attrs: SurfacePivotDimension["attrs"],
  endpointModule: string | null,
  modules: SurfaceModuleCatalog,
  at: string,
): ResolvedPivotDimension["attrs"] {
  const entries = Object.entries(attrs);
  if (entries.length === 0) return [];
  if (endpointModule === null) schemaFail(`${at}.attrs can be attached only to a dimension that has an endpoint module`);
  const endpoint = moduleOf(modules, endpointModule, `${at}.attrs`);
  return entries.map(([key, attr]) => {
    const fieldAt = `${at}.attrs.${key}`;
    const field = fieldOf(endpoint, attr.field, `${fieldAt}.field`);
    if (!hasColumn(field)) {
      schemaFail(`${fieldAt}.field "${attr.field}" has no stored column`);
    }
    if (field.type !== "string" && field.type !== "enum") {
      schemaFail(`${fieldAt}.field "${attr.field}" must be string or enum`);
    }
    if (field.type === "enum") {
      if (typeof field.choiceSet !== "string" || field.choiceSet === "") {
        schemaFail(`${fieldAt}.field "${attr.field}" is an enum and must declare a non-empty choiceSet`);
      }
      return { key, label: attr.label, column: businessColumnName(attr.field), choiceSet: field.choiceSet };
    }
    return { key, label: attr.label, column: businessColumnName(attr.field), choiceSet: null };
  });
}

/**
 * A dimension label is the name of the endpoint record: the same `labelFieldsOf`
 * as reference candidates and the echo of a stored reference. Do not declare a
 * separate field on the report. One cell alone cannot tell which goods "11cm*4cm*8cm" is.
 * Pivot SQL can assemble only strings: a table column is read directly, and a
 * header-level lookup joins one more table. Any other shape is rejected here.
 */
function bindPivotLabel(
  endpoint: ModuleSchema,
  modules: SurfaceModuleCatalog,
  at: string,
): readonly ResolvedPivotLabelPart[] {
  return labelFieldsOf(endpoint).map((key) => {
    const here = `${at} endpoint "${endpoint.code}" name "${key}"`;
    const field = endpoint.fields.find((item) => item.key === key);
    if (field === undefined) {
      if (PLATFORM_FIELD_TYPES[key as PlatformField] !== "string") schemaFail(`${here} must be string`);
      return { column: businessColumnName(key), lookup: null };
    }
    if (field.type !== "string") schemaFail(`${here} must be string; received "${field.type}"`);
    const derive = field.derive;
    if (derive == null) return { column: businessColumnName(key), lookup: null };
    if (derive.kind !== "lookup" || derive.through !== null) {
      schemaFail(`${here} is a derived field; a pivot supports lookup only at header level`);
    }
    const target = moduleOf(modules, derive.from, here);
    const targetField = fieldOf(target, derive.field, here);
    if (!hasColumn(targetField)) {
      schemaFail(`${here} lookup "${derive.from}.${derive.field}" must be a stored column`);
    }
    return {
      column: businessColumnName(derive.field),
      lookup: { module: derive.from, matchColumn: businessColumnName(derive.match) },
    };
  });
}

/** Resolve hops and field types against the module catalog. The loader calls this once inside assertSurfaceReads. */
export function bindPivotModules(
  pivot: SurfacePivot,
  modules: SurfaceModuleCatalog,
  at: string,
): ResolvedPivot {
  const factMeasureKeys = new Set<string>();
  const resolvedFacts: ResolvedPivotFact[] = [];
  for (const [index, fact] of pivot.facts.entries()) {
    const here = `${at}.facts[${String(index)}]`;
    const module = moduleOf(modules, fact.module, here);
    if (fact.through !== null) subtableOf(module, fact.through, `${here}.through`);
    const statusKeys = new Set(module.lifecycle.statuses.map((item) => item.key));
    for (const key of fact.status) {
      if (!statusKeys.has(key)) schemaFail(`${here}.status "${key}" is not a status of module "${fact.module}"`);
    }
    const date = locatePivotField(module, fact.through, fact.dateField, "header", `${here}.dateField`);
    if (date.type !== "datetime") schemaFail(`${here}.dateField "${fact.dateField}" must be datetime`);
    const resolvedMeasures: ResolvedPivotFactMeasure[] = [];
    for (const [key, measure] of Object.entries(fact.measures)) {
      if (factMeasureKeys.has(key)) schemaFail(`${at} fact measure "${key}" is duplicated`);
      factMeasureKeys.add(key);
      const measureAt = `${here}.measures.${key}`;
      if (measure.rowExpr != null) {
        resolvedMeasures.push(bindRowExprMeasure(module, fact, key, measure.rowExpr, measure.agg, measureAt));
        continue;
      }
      if (measure.field === null) schemaFail(`${measureAt}: exactly one of field and rowExpr must be non-empty`);
      const fieldAt = `${measureAt}.field`;
      const located = locatePivotField(module, fact.through, measure.field, null, fieldAt);
      const agg = bindFactAgg(located, measure.agg, fieldAt);
      let rollup: ResolvedPivotRollup | null = null;
      if (located.field?.derive?.kind === "rollup") {
        rollup = bindRollup(located, modules, fieldAt);
      } else if (located.field !== null && isDerived(located.field)) {
        schemaFail(`${fieldAt} "${measure.field}" is a derived field; only a rollup can be a fact measure`);
      } else if (located.field !== null && located.field.type === "subtable") {
        schemaFail(`${fieldAt} "${measure.field}" must be a numeric field`);
      }
      resolvedMeasures.push({
        key,
        field: measure.field,
        column: located.column,
        agg,
        alias: factAlias(fact.through, located.layer),
        rollup,
        rowSql: null,
      });
    }
    resolvedFacts.push({
      index,
      module: fact.module,
      through: fact.through,
      status: fact.status,
      dateField: fact.dateField,
      dateColumn: date.column,
      dateAlias: factAlias(fact.through, "header"),
      measures: resolvedMeasures,
    });
  }
  const resolvedDims: ResolvedPivotDimension[] = [];
  for (const [key, dimension] of Object.entries(pivot.dimensions)) {
    const here = `${at}.dimensions.${key}`;
    if (dimension.on !== null && dimension.field !== null) {
      const aliases = new Set<"f" | "h">();
      const modulesForField = new Set<string>();
      let located: LocatedPivotField | null = null;
      for (const fact of pivot.facts) {
        const factModule = moduleOf(modules, fact.module, here);
        located = locatePivotField(factModule, fact.through, dimension.field, dimension.on, `${here}.field`);
        aliases.add(factAlias(fact.through, located.layer));
        modulesForField.add(fact.module);
      }
      if (located === null) schemaFail(`${here}.field failed to resolve`);
      if (aliases.size !== 1) schemaFail(`${here} a same-table field must land on the same level on every fact`);
      if (dimension.filter === "dateRange" && located.type !== "date") {
        schemaFail(`${here}.filter:"dateRange" is only for date fields; "${located.type}" cannot be treated as date`);
      }
      if (dimension.bucket === "pastDue" && located.type !== "date") {
        schemaFail(`${here}.bucket:"pastDue" is only for date fields; "${located.type}" cannot be treated as date`);
      }
      const fieldAlias = [...aliases][0]!;
      let valueKind: ResolvedPivotDimValueKind = "sentinel";
      let endpointModule: string | null = null;
      let labelParts: readonly ResolvedPivotLabelPart[] = [];
      let labelSeparator = "";
      if (dimension.bucket === "pastDue") {
        valueKind = "bucket";
      } else if (located.type === "date") {
        valueKind = "date";
      } else if (dimension.field === "id") {
        if (modulesForField.size !== 1) schemaFail(`${here} a same-table dimension with field:"id" requires every fact to belong to the same module`);
        endpointModule = [...modulesForField][0]!;
        const endpoint = moduleOf(modules, endpointModule, here);
        labelParts = bindPivotLabel(endpoint, modules, here);
        labelSeparator = referenceLabelSeparator(endpoint);
      }
      resolvedDims.push({
        key,
        label: dimension.label,
        filterable: dimension.filterable,
        filter: dimension.filter,
        bucket: dimension.bucket,
        options: dimension.options,
        valueKind,
        path: [],
        endpointModule,
        labelParts,
        labelSeparator,
        fieldAlias,
        fieldColumn: located.column,
        attrs: bindPivotAttrs(dimension.attrs, endpointModule, modules, here),
      });
      continue;
    }
    const firstTargets = new Set<string>();
    const hop0Aliases = new Set<"f" | "h">();
    let hops: ResolvedPivotHop[] = [];
    for (const fact of pivot.facts) {
      const factModule = moduleOf(modules, fact.module, here);
      const firstLocated = locatePivotField(factModule, fact.through, dimension.path[0]!, null, `${here}.path[0]`);
      if (firstLocated.type !== "ref" || firstLocated.field?.ref === null || firstLocated.field === null) {
        schemaFail(`${here}.path[0] "${dimension.path[0]}" must be a ref field`);
      }
      firstTargets.add(firstLocated.field.ref);
      const fromAlias = factAlias(fact.through, firstLocated.layer);
      hop0Aliases.add(fromAlias);
      hops = [
        {
          field: dimension.path[0]!,
          fromModule: fact.module,
          toModule: firstLocated.field.ref,
          column: firstLocated.column,
          fromAlias,
        },
      ];
      if (dimension.path.length === 2) {
        const mid = moduleOf(modules, firstLocated.field.ref, `${here}.path[1]`);
        const second = fieldOf(mid, dimension.path[1]!, `${here}.path[1]`);
        if (second.type !== "ref" || second.ref === null) {
          schemaFail(`${here}.path[1] "${dimension.path[1]}" must be a ref field`);
        }
        hops.push({
          field: dimension.path[1]!,
          fromModule: firstLocated.field.ref,
          toModule: second.ref,
          column: businessColumnName(dimension.path[1]!),
          fromAlias: "f",
        });
      }
    }
    if (firstTargets.size !== 1) schemaFail(`${here} the first hop must point at the same module on every fact`);
    if (hop0Aliases.size !== 1) schemaFail(`${here} the first hop must land on the same level on every fact`);
    const endpointModule = hops[hops.length - 1]?.toModule;
    if (endpointModule === undefined) schemaFail(`${here}.path does not determine an endpoint module`);
    const endpoint = moduleOf(modules, endpointModule, here);
    resolvedDims.push({
      key,
      label: dimension.label,
      filterable: dimension.filterable,
      filter: dimension.filter,
      bucket: dimension.bucket,
      options: dimension.options,
      valueKind: "sentinel",
      path: hops,
      endpointModule,
      labelParts: bindPivotLabel(endpoint, modules, here),
      labelSeparator: referenceLabelSeparator(endpoint),
      fieldAlias: null,
      fieldColumn: null,
      attrs: bindPivotAttrs(dimension.attrs, endpointModule, modules, here),
    });
  }
  const measureOrder = topoMeasureKeys(pivot.measures, factMeasureKeys, at);
  return {
    facts: resolvedFacts,
    dimensions: resolvedDims,
    measures: pivot.measures,
    measureOrder,
    defaultRowDims: pivot.defaultRowDims,
    requiredRowDims: pivot.requiredRowDims,
    maxRangeDays: pivot.maxRangeDays,
    defaultSort: pivot.defaultSort,
    reads: pivotReads(resolvedFacts, resolvedDims),
  };
}

function derivedParam(
  key: string,
  label: string,
  type: SurfaceParamType,
  required: boolean,
  options: readonly SurfaceParamOption[] | null = null,
): SurfaceParam {
  return { key, label, type, required, options, description: null, incompatibleWith: null };
}

export function derivePivotParams(pivot: {
  readonly dimensions: Readonly<Record<string, Pick<SurfacePivotDimension, "label" | "filterable" | "filter">>>;
  readonly measures: Readonly<Record<string, Pick<SurfacePivotMeasure, "label" | "expr" | "filter">>>;
}): readonly SurfaceParam[] {
  const dimParams: SurfaceParam[] = [];
  for (const [key, dim] of Object.entries(pivot.dimensions)) {
    if (!dim.filterable) continue;
    if (dim.filter === "dateRange") {
      dimParams.push(derivedParam(`${key}From`, `${dim.label} from`, "string", false));
      dimParams.push(derivedParam(`${key}To`, `${dim.label} to`, "string", false));
    } else if (dim.filter === "ilike") {
      dimParams.push(derivedParam(key, dim.label, "string", false));
    } else {
      dimParams.push(derivedParam(key, dim.label, "stringList", false));
    }
  }
  const measureFilters: SurfaceParam[] = [];
  for (const [key, measure] of Object.entries(pivot.measures)) {
    if (measure.filter !== "range") continue;
    measureFilters.push(derivedParam(`${key}Min`, `${measure.label} min`, "number", false));
    measureFilters.push(derivedParam(`${key}Max`, `${measure.label} max`, "number", false));
  }
  return [
    derivedParam("rowDims", "Row dimensions", "stringList", false),
    derivedParam("colDim", "Column dimension", "string", false),
    derivedParam("dateFrom", "Start date", "string", true),
    derivedParam("dateTo", "End date", "string", true),
    ...dimParams,
    ...measureFilters,
    derivedParam(
      "sortBy",
      "Sort measure",
      "enum",
      false,
      Object.entries(pivot.measures).map(([key, measure]) => ({ value: key, label: measure.label })),
    ),
    derivedParam("sortCol", "Sort column", "string", false),
    derivedParam("sortDesc", "Descending", "boolean", false),
    derivedParam("page", "Page", "integer", false),
    derivedParam("pageSize", "Page size", "integer", false),
  ];
}

export function derivePivotColumns(pivot: SurfacePivot): readonly SurfaceColumn[] {
  const dims = Object.entries(pivot.dimensions).flatMap(([key, dim]) => [
    { key, label: dim.label, type: "string" as const, choiceSet: null },
    { key: `${key}Label`, label: `${dim.label} name`, type: "string" as const, choiceSet: null },
  ]);
  const measures = Object.entries(pivot.measures).map(([key, measure]) => ({
    key,
    label: measure.label,
    type: "number" as const,
    choiceSet: null,
  }));
  const columns = [...dims, ...measures];
  if (columns.length === 0) schemaFail("pivot derived columns must not be empty");
  assertUniqueKeys(columns.map((item) => item.key), "pivot.columns");
  return columns;
}

export function surfacePivotListing(resolved: ResolvedPivot): SurfacePivotListing {
  return {
    dimensions: resolved.dimensions.map((dim) => ({
      key: dim.key,
      label: dim.label,
      ...(dim.endpointModule !== null ? { module: dim.endpointModule } : {}),
      ...(dim.filter === "ilike" || dim.filter === "dateRange" ? { filter: dim.filter } : {}),
      ...(dim.options !== null
        ? {
            options: [
              { value: "past", label: dim.options.past },
              { value: "notPast", label: dim.options.notPast },
            ],
          }
        : {}),
      ...(dim.attrs.length === 0
        ? {}
        : { attrs: dim.attrs.map((attr) => ({ key: attr.key, label: attr.label })) }),
    })),
    measures: resolved.measureOrder.map((key) => {
      const measure = resolved.measures[key];
      if (measure === undefined) schemaFail(`surfacePivotListing: unknown measure "${key}"`);
      return {
        key,
        label: measure.label,
        format: measure.format,
        ...(measure.filter === "range" ? { filter: "range" as const } : {}),
      };
    }),
    defaultRowDims: resolved.defaultRowDims,
    requiredRowDims: resolved.requiredRowDims,
    maxRangeDays: resolved.maxRangeDays,
    defaultSort: resolved.defaultSort,
  };
}

function parseDateOnly(text: string, at: string): number {
  const match = DATE_ONLY.exec(text);
  if (match === null) schemaFail(`${at} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    schemaFail(`${at} "${text}" is not a legal date`);
  }
  return utc;
}

export function asStringList(value: unknown, at: string): readonly string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return omitted(value) ? [] : [value];
  if (!Array.isArray(value)) schemaFail(`${at} must be an array of strings`);
  return value.map((item, index) => {
    if (typeof item !== "string") schemaFail(`${at}[${String(index)}] must be a string`);
    return item;
  }).filter((item) => !omitted(item));
}

function asOptionalNumber(value: unknown, at: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) schemaFail(`${at} must be a finite number`);
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isFinite(n)) schemaFail(`${at} must be a finite number; received ${JSON.stringify(value)}`);
    return n;
  }
  schemaFail(`${at} must be a finite number`);
}

export function applyPivotParamRules(
  pivot: SurfacePivot,
  values: Readonly<Record<string, unknown>>,
  at: string,
): Readonly<Record<string, unknown>> {
  const dimKeys = new Set(Object.keys(pivot.dimensions));
  const out: Record<string, unknown> = { ...values };
  // Required row dimensions are judged only by the server's assertPivotLayout. Here we only fill default rows and reject unknown keys.
  const rowRaw = asStringList(values["rowDims"], `${at}.rowDims`);
  const rowDims = rowRaw.length === 0 ? [...pivot.defaultRowDims] : [...rowRaw];
  if (new Set(rowDims).size !== rowDims.length) schemaFail(`${at}.rowDims must not contain duplicates`);
  for (const key of rowDims) {
    if (!dimKeys.has(key)) schemaFail(`${at}.rowDims "${key}" is not a key of dimensions`);
  }
  out["rowDims"] = rowDims;
  const colRaw = values["colDim"];
  if (colRaw !== undefined && colRaw !== null && colRaw !== "") {
    const colDim = typeof colRaw === "string" ? colRaw : schemaFail(`${at}.colDim must be a string`);
    if (!dimKeys.has(colDim)) schemaFail(`${at}.colDim "${colDim}" is not a key of dimensions`);
    if (rowDims.includes(colDim)) schemaFail(`${at}.colDim "${colDim}" must not appear in rowDims`);
    out["colDim"] = colDim;
  } else {
    delete out["colDim"];
  }
  const dateFrom = values["dateFrom"];
  const dateTo = values["dateTo"];
  if (typeof dateFrom !== "string") schemaFail(`${at}.dateFrom is required`);
  if (typeof dateTo !== "string") schemaFail(`${at}.dateTo is required`);
  const from = parseDateOnly(dateFrom, `${at}.dateFrom`);
  const to = parseDateOnly(dateTo, `${at}.dateTo`);
  if (to < from) schemaFail(`${at}.dateTo cannot be earlier than dateFrom`);
  const days = Math.floor((to - from) / 86400000) + 1;
  if (days > pivot.maxRangeDays) {
    schemaFail(`${at} date span of ${String(days)} days exceeds maxRangeDays=${String(pivot.maxRangeDays)}`);
  }
  if ("sortDesc" in out && !("sortBy" in out)) schemaFail(`${at}.sortDesc may be used only when sortBy is given`);
  const sortColRaw = out["sortCol"];
  if (sortColRaw === undefined || sortColRaw === null || sortColRaw === "") delete out["sortCol"];
  else if (typeof sortColRaw !== "string") schemaFail(`${at}.sortCol must be a string`);
  const sortByGiven = typeof out["sortBy"] === "string" && out["sortBy"] !== "";
  if ("sortCol" in out && !sortByGiven) schemaFail(`${at}.sortCol may be used only when sortBy is given`);
  if (!("colDim" in out) && "sortCol" in out) schemaFail(`${at}.sortCol may be used only when there is a column dimension`);
  if ("colDim" in out && sortByGiven && !("sortCol" in out)) schemaFail(`${at}.sortCol is required`);
  const sortBy = out["sortBy"];
  if (typeof sortBy === "string") {
    const measure = pivot.measures[sortBy];
    if (measure === undefined) schemaFail(`${at}.sortBy "${sortBy}" is unknown`);
  }
  for (const [key, dim] of Object.entries(pivot.dimensions)) {
    if (dim.filter === "dateRange") {
      const fromRaw = out[`${key}From`];
      const toRaw = out[`${key}To`];
      const fromAt = fromRaw === undefined || fromRaw === null || fromRaw === ""
        ? undefined
        : parseDateOnly(typeof fromRaw === "string" ? fromRaw : schemaFail(`${at}.${key}From must be YYYY-MM-DD`), `${at}.${key}From`);
      const toAt = toRaw === undefined || toRaw === null || toRaw === ""
        ? undefined
        : parseDateOnly(typeof toRaw === "string" ? toRaw : schemaFail(`${at}.${key}To must be YYYY-MM-DD`), `${at}.${key}To`);
      if (fromAt !== undefined && toAt !== undefined && toAt < fromAt) {
        schemaFail(`${at}.${key}To cannot be earlier than ${key}From`);
      }
    }
    if (dim.bucket === "pastDue") {
      const selected = asStringList(out[key], `${at}.${key}`);
      for (const value of selected) {
        if (value !== "past" && value !== "notPast") {
          schemaFail(`${at}.${key} "${value}" is unknown; choices: past / notPast`);
        }
      }
    }
  }
  for (const [key, measure] of Object.entries(pivot.measures)) {
    if (measure.filter !== "range") continue;
    const min = asOptionalNumber(out[`${key}Min`], `${at}.${key}Min`);
    const max = asOptionalNumber(out[`${key}Max`], `${at}.${key}Max`);
    if (min !== undefined && max !== undefined && min > max) {
      schemaFail(`${at}.${key}Min cannot be greater than ${key}Max`);
    }
    if (min !== undefined) out[`${key}Min`] = min;
    else delete out[`${key}Min`];
    if (max !== undefined) out[`${key}Max`] = max;
    else delete out[`${key}Max`];
  }
  return out;
}

function normalizeDefinition(
  raw: unknown,
  at: string,
): SurfaceDefinition {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, SURFACE_DEF_KEYS, at);
  const permission = requireText(obj["permission"], `${at}.permission`);
  if (!SYSTEM_PERMISSION_PATTERN.test(permission)) {
    schemaFail(`${at}.permission "${permission}" is not a system permission key: it must be system:<name>:<action>`);
  }
  const hasSql = present(obj["sql"]);
  const hasModes = present(obj["modes"]);
  const hasPivot = present(obj["pivot"]);
  if ([hasSql, hasModes, hasPivot].filter(Boolean).length !== 1) {
    schemaFail(`${at}: exactly one of sql / modes / pivot must be non-empty`);
  }
  const extras = obj["extras"] === undefined || obj["extras"] === null
    ? {}
    : normalizeExtras(obj["extras"], `${at}.extras`);
  if (hasPivot) {
    if (obj["params"] !== undefined) schemaFail(`${at}: a pivot surface must not hand-write params`);
    if (obj["columns"] !== undefined) schemaFail(`${at}: a pivot surface must not hand-write columns`);
    const pivot = normalizePivot(obj["pivot"], `${at}.pivot`);
    const params = derivePivotParams(pivot);
    assertUniqueKeys(params.map((item) => item.key), `${at}.params`);
    const columns = derivePivotColumns(pivot);
    const reads = toSurfaceReads(
      mergeBoundSqlReads([pivotReads(pivot.facts, []), readsFromSqlSources(null, null, extras, at)]),
      at,
    );
    return {
      label: requireText(obj["label"], `${at}.label`),
      permission,
      path: normalizePath(obj["path"], `${at}.path`),
      params,
      columns,
      reads,
      sql: null,
      modes: null,
      extras,
      pivot,
    };
  }
  const params = requireArray(obj["params"], `${at}.params`).map((entry, index) =>
    normalizeParam(entry, `${at}.params[${String(index)}]`),
  );
  assertUniqueKeys(params.map((item) => item.key), `${at}.params`);
  const columns = requireArray(obj["columns"], `${at}.columns`).map((entry, index) =>
    normalizeColumn(entry, `${at}.columns[${String(index)}]`),
  );
  if (columns.length === 0) schemaFail(`${at}.columns must not be empty`);
  assertUniqueKeys(columns.map((item) => item.key), `${at}.columns`);
  let sql: string | null = null;
  let modes: Readonly<Record<string, string>> | null = null;
  if (hasSql) {
    sql = requireText(obj["sql"], `${at}.sql`);
  } else {
    const rawModes = requireObject(obj["modes"], `${at}.modes`);
    const entries = Object.entries(rawModes);
    if (entries.length === 0) schemaFail(`${at}.modes must not be empty`);
    const next: Record<string, string> = {};
    for (const [mode, value] of entries) {
      next[mode] = requireText(value, `${at}.modes.${mode}`);
    }
    const modeParam = params.find((param) => param.key === "mode");
    if (modeParam?.type !== "enum" || modeParam.options === null) {
      schemaFail(`${at}.modes requires params.mode to be an enum with options`);
    }
    const declared = [...modeParam.options.map((option) => option.value)].sort();
    const keys = Object.keys(next).sort();
    if (declared.join("\0") !== keys.join("\0")) {
      schemaFail(`${at}.modes keys must match mode.options: ${declared.join(" / ")}`);
    }
    modes = next;
  }
  const reads = toSurfaceReads(readsFromSqlSources(sql, modes, extras, at), at);
  return {
    label: requireText(obj["label"], `${at}.label`),
    permission,
    path: normalizePath(obj["path"], `${at}.path`),
    params,
    columns,
    reads,
    sql,
    modes,
    extras,
    pivot: null,
  };
}

function normalizeExtras(raw: unknown, at: string): Readonly<Record<string, SurfaceExtra>> {
  const obj = requireObject(raw, at);
  const out: Record<string, SurfaceExtra> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "cols") schemaFail(`${at}.cols is a reserved response key`);
    requireCoordinateSegment(key, `${at} key`);
    const spec = requireObject(value, `${at}.${key}`);
    const kind = requireEnum(spec["kind"], SURFACE_EXTRA_KINDS, `${at}.${key}.kind`);
    if (kind === "sql") {
      assertClosedKeys(spec, ["kind", "sql"] as const, `${at}.${key}`);
      const extraSql = requireText(spec["sql"], `${at}.${key}.sql`);
      out[key] = { kind: "sql", sql: extraSql };
      continue;
    }
    assertClosedKeys(spec, ["kind"] as const, `${at}.${key}`);
    out[key] = { kind };
  }
  return out;
}

export function defineSurfaces(raw: unknown): Surfaces {
  const obj = requireObject(raw, "surfaces");
  const entries = Object.entries(obj);
  if (!entries.length) schemaFail("surfaces must not be empty — do not export this named value when there is no query surface");
  const out: Record<string, SurfaceDefinition> = {};
  for (const [code, value] of entries) {
    requireCoordinateSegment(code, "surfaces code");
    out[code] = normalizeDefinition(value, `surfaces.${code}`);
  }
  Object.defineProperty(out, DEFINED_SURFACES_BY_KERNEL, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return out;
}

export function isDefinedSurfaces(value: unknown): value is Surfaces {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_SURFACES_BY_KERNEL] === true
  );
}

function omitted(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === "null" || value === "None";
}

function asBoolean(value: unknown, at: string): boolean {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  schemaFail(`${at} must be a boolean; received ${JSON.stringify(value)}`);
}

function asInteger(value: unknown, at: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(n)) schemaFail(`${at} must be an integer; received ${JSON.stringify(value)}`);
  return n;
}

function asFiniteNumber(value: unknown, at: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) schemaFail(`${at} must be a finite number; received ${JSON.stringify(value)}`);
  return n;
}

function queryValues(raw: unknown, at: string): readonly string[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) schemaFail(`${at} must be an array of strings`);
  return raw.map((item, index) => {
    if (typeof item !== "string") schemaFail(`${at}[${String(index)}] must be a string`);
    return item;
  });
}

/**
 * Fit HTTP query / agent params onto the closed param schema.
 * The input is Hono `c.req.queries()` as `Record<string, string[]>`. A scalar is wrapped in an array of length 1.
 * Unknown keys are rejected. An empty string counts as not given. Booleans and integers accept a string spelling.
 */
export function normalizeSurfaceParams(
  params: readonly SurfaceParam[],
  raw: Readonly<Record<string, readonly string[]>>,
  at: string,
  pivot?: SurfacePivot | null,
): Readonly<Record<string, unknown>> {
  const declared = new Map(params.map((param) => [param.key, param] as const));
  const unknown = Object.keys(raw).filter((key) => {
    if (declared.has(key)) return false;
    return queryValues(raw[key], `${at}.${key}`).some((item) => !omitted(item));
  });
  if (unknown.length) {
    schemaFail(
      `${at} unknown parameters ${unknown.map((key) => `"${key}"`).join(", ")} — ` +
        `available: ${params.map((param) => param.key).join(" / ") || "(none)"}`,
    );
  }
  const out: Record<string, unknown> = {};
  for (const param of params) {
    const here = `${at}.${param.key}`;
    const values = queryValues(raw[param.key], here).filter((item) => !omitted(item));
    if (values.length === 0) {
      if (param.required) schemaFail(`${here} is required`);
      continue;
    }
    if (param.type === "stringList") {
      out[param.key] = values;
      continue;
    }
    if (values.length > 1) schemaFail(`${here} cannot be given more than one value`);
    const value = values[0];
    if (param.type === "boolean") {
      out[param.key] = asBoolean(value, here);
      continue;
    }
    if (param.type === "integer") {
      out[param.key] = asInteger(value, here);
      continue;
    }
    if (param.type === "number") {
      out[param.key] = asFiniteNumber(value, here);
      continue;
    }
    const text = value!.trim();
    if (text === "") {
      if (param.required) schemaFail(`${here} is required`);
      continue;
    }
    if (param.type === "enum") {
      const allowed = param.options?.map((option) => option.value) ?? [];
      if (!allowed.includes(text)) {
        schemaFail(`${here} "${text}" is unknown; choices: ${allowed.join(" / ")}`);
      }
    }
    out[param.key] = text;
  }
  for (const param of params) {
    if (param.incompatibleWith === null || !(param.key in out)) continue;
    for (const [other, values] of Object.entries(param.incompatibleWith)) {
      const current = out[other];
      if (typeof current === "string" && values.includes(current)) {
        schemaFail(`${at}: ${param.key} and ${other}=${current} cannot both be given`);
      }
    }
  }
  if (pivot) return applyPivotParamRules(pivot, out, at);
  if ("sortDesc" in out && !("sortBy" in out)) schemaFail(`${at}.sortDesc may be used only when sortBy is given`);
  return out;
}

/** Navigation item code: `/_stock-query` becomes `stock-query`. An attached query with no path does not enter navigation. */
export function surfaceNavCode(path: string): string {
  if (!path.startsWith("/_")) schemaFail(`surface path "${path}" does not determine a navigation code`);
  return path.slice(2);
}
