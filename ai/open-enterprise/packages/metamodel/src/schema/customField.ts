// ---------------------------------------------------------------------------
// Tenant custom fields — product code declares the boundary; the tenant stores only field instances and bindings
//
// How this splits from the data dictionary (`choiceSet.ts`), in one sentence:
//   · a dictionary answers "which values this cell may take" — already maintainable at runtime
//   · a custom field answers "which cells this document has" — the opening this file makes
//
// 🔴 This is one bounded exception to the repo-level axis "the database stores business facts, not a second copy of developer-written module metadata".
// Three things hold the boundary. Miss one and the opening spreads:
//   ① which modules are open is said by the module declaration itself (`ModuleSchema.customFields`), not by runtime data;
//   ② a field key is forced to an `x` prefix and can never collide with a declared field;
//   ③ forbidden ground (posting coordinates, the state machine, numbering, permission keys, the primary key, references) is hard-rejected by the pure checks in this file.
//
// The value does not land in its own table: it lands in a `custom` jsonb column on the module's own table, and travels with the business row.
// Measured at 500,000 rows: equality filter 0.34–1.8ms (level with a real column), the same EAV query 8.6ms (25 times slower).
// ---------------------------------------------------------------------------

import { requireEnum, requireObject, requireText } from "./common.js";
import type { Field } from "./fields.js";
import type { ModuleSchema } from "./module.js";

/**
 * Where the value comes from. The type lives on the field, not on the dictionary — the opposite of "add a boolean type to the dictionary":
 * a dictionary is only a code→label table, and a boolean field does not need a dictionary at all.
 *
 * Every kind maps onto an existing `FIELD_TYPES`, so the renderer, the query compiler, and notifications change nothing.
 * No new type is opened — a new type would add a branch in the table builder, the comparator table, the value gate, and rendering,
 * and the semantics of these kinds are already expressed faithfully by existing types (see the map below).
 */
export const CUSTOM_FIELD_VALUE_KINDS = [
  "choiceSet",
  "multiSelect",
  "bool",
  "number",
  "text",
  "textarea",
  "date",
  "time",
  "address",
] as const;
export type CustomFieldValueKind = (typeof CUSTOM_FIELD_VALUE_KINDS)[number];

/** Value source → existing field type. The only map. Rendering and validation both read it. */
export const CUSTOM_FIELD_TYPE_OF: Readonly<Record<CustomFieldValueKind, Field["type"]>> = Object.freeze({
  choiceSet: "enum",
  // Multi-select and single-select are the same enum field. The only difference is `multiple`: the value goes from one code to a set of codes.
  // Do not open a new FIELD_TYPE — that would grow a second implementation of "where candidates come from" and "how to validate"
  multiSelect: "enum",
  bool: "bool",
  number: "number",
  text: "string",
  textarea: "text",
  date: "date",
  /**
   * Time is stored as an `HH:mm` string. No new FIELD_TYPE.
   *
   * 🔴 This is not a compromise: a zero-padded `HH:mm` has the same lexicographic order as time order ("09:30" < "14:00"),
   * so comparison, sorting, and ranges are already correct on the string path.
   * A new type would add a branch in the table builder, the comparator table, the value gate, and rendering,
   * and the only thing gained is "it looks more formal".
   */
  time: "string",
  /**
   * An address is stored as `province/city/district/detail`, the same shape as the address fields already in the repo (customer, supplier, warehouse).
   * The UI reuses the existing province-city-district cascade (`RegionPicker`; the dataset is already in the repo).
   *
   * 🔴 It is not stored as "three dictionary levels plus a detail line": an administrative division has thousands of rows and district names repeat across provinces,
   * which does not fit "label is unique inside one dictionary". When someone really needs to aggregate by region,
   * this shape can be upgraded in place to a structured value without migrating existing data — the first three segments are already separated.
   */
  address: "string",
});

/** Value sources whose value is a set, not one item. Storage is a jsonb array. */
export function isMultiValued(kind: CustomFieldValueKind): boolean {
  return kind === "multiSelect";
}

/** `HH:mm`, zero-padded. Lexicographic order equals time order because of the zero padding. */
export const CUSTOM_FIELD_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Field-key shape: `x` plus Pascal tail, for example `xBaseFabric`.
 *
 * 🔴 An `x_` underscore prefix cannot be used: a field key is a coordinate id for the whole repo
 * (`requireCoordinateSegment`). It must be lowerCamel and must not contain an underscore — column names, query paths,
 * and permission keys are all derived from that shape. Breaking it opens a special case at every site.
 *
 * `x` plus an uppercase letter is namespace isolation, not a style: the declaration side permanently reserves this span with the `RESERVED_CUSTOM_PREFIX` gate,
 * so the two cannot collide. When a custom field is later adopted as a declared field,
 * the old cell and the new cell can coexist for a while and then be migrated, instead of a forced choice on the day it ships.
 */
const CUSTOM_FIELD_KEY = /^x[A-Z][A-Za-z0-9]{0,40}$/;

/** Reserved check on the declaration side. A key of this shape in a module declaration has seized the tenant namespace. */
export function isReservedCustomPrefix(key: string): boolean {
  return /^x[A-Z]/.test(key);
}

export function isCustomFieldKey(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_FIELD_KEY.test(value);
}

/** Field definition: "what this field is", independent of a module. */
export interface CustomFieldRecord {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly valueKind: CustomFieldValueKind;
  /** Required when the value comes from a dictionary (both single-select and multi-select). Points at one dictionary. */
  readonly choiceSetCode: string | null;
  readonly help: string | null;
  readonly status: CustomFieldStatus;
}

export const CUSTOM_FIELD_STATUSES = ["draft", "active", "disabled"] as const;
export type CustomFieldStatus = (typeof CUSTOM_FIELD_STATUSES)[number];

/**
 * Where this cell's value comes from.
 *   · own      filled on this module (subject to the surface rules and the status allow-list)
 *   · inherit  brought down from an upstream document and frozen — synthesized as a `snapshot`, not writable by the client
 */
export const CUSTOM_FIELD_ORIGINS = ["own", "inherit"] as const;
export type CustomFieldOrigin = (typeof CUSTOM_FIELD_ORIGINS)[number];

/**
 * Surface rules. These are the cells an operator checks on the screen.
 *
 * 🔴 `edit` is a set of statuses, not a boolean: edit permission in this system is already a status allow-list
 * (the initial status of a document is usually fully editable, and after it takes effect only a few cells stay open).
 * A boolean necessarily fights the state machine: either it stays editable after it takes effect, or it cannot be edited in the initial status.
 * Which statuses those are is declared by each module. The framework knows no status name — `businessVocabulary.test.ts` pins this gate.
 */
export interface CustomFieldSurfaces {
  /** Appears on the create form */
  readonly form: boolean;
  /** Required on create. Applies only to new documents: existing documents predate this cell, and forcing required would make all of them impossible to save */
  readonly required: boolean;
  /** Status keys in which editing is allowed. An empty array means it cannot be changed after creation */
  readonly editStatuses: readonly string[];
  /** List column */
  readonly list: boolean;
  /** Quick filter */
  readonly filter: boolean;
  /** The quick filter allows multiple selection (compiled to `in`). Meaningful only for choiceSet */
  readonly filterMultiple: boolean;
}

/** Pass-through source: which upstream module, and which ref on this module it comes through. */
export interface CustomFieldInherit {
  readonly module: string;
  /** The ref field key on this module that points at `module` */
  readonly viaRef: string;
}

/** A binding: "what role it has on which layer of this module". One field × one module × one layer = one row. */
export interface CustomFieldBindingRecord {
  readonly id: string;
  readonly fieldId: string;
  readonly module: string;
  /**
   * Which layer it lands on: `null` = the header; non-null = the key of that line table on this module.
   *
   * 🔴 This dimension exists because of cardinality, not flexibility. "Product" on a sales order lives on the line,
   * and N lines on one document are N products and N "base fabric" values. Forcing it onto the header requires inventing an aggregation rule
   * (first line? dedupe and join? leave blank when they disagree?), and all three make that cell unreadable.
   * On the line, each row has one value, the meaning is naturally definite, and "filter sales orders by base fabric" compiles to
   * the kernel's existing `exists (select 1 from line where ...)` — the query side writes no new line of code.
   */
  readonly lineTable: string | null;
  readonly origin: CustomFieldOrigin;
  readonly inherit: CustomFieldInherit | null;
  readonly surfaces: CustomFieldSurfaces;
  readonly sortOrder: number;
  readonly status: CustomFieldStatus;
}

/**
 * The field list of the layer this binding lands on.
 *
 * Header = `schema.fields`; a line = that subtable's `fields`. The merge point, validation,
 * table creation, and the write path all ask the same question, so there is only this one answer.
 */
export function bindingLayerFields(
  binding: Pick<CustomFieldBindingRecord, "lineTable">,
  target: ModuleSchema,
): readonly Field[] | null {
  if (binding.lineTable === null) return target.fields;
  const table = target.fields.find((f) => f.key === binding.lineTable && f.type === "subtable");
  return table?.fields ?? null;
}

// ── Runtime input checks ───────────────────────────────────────────────────
// These are not declaration-time schemaFail. They are user input: the caller classifies them as 400, not 500.

export class CustomFieldInputError extends Error {}

function fail(message: string): never {
  throw new CustomFieldInputError(message);
}

/** Places a custom field must never enter. Hard-rejected by the server, not constrained by documentation. */
const FORBIDDEN_SURFACES: Readonly<Record<string, string>> = Object.freeze({
  primary: "the primary key is fixed by the module declaration; a custom field cannot be the primary key",
  ref: "referential integrity needs a foreign key, and jsonb has none — to relate a document, have a developer add a declared field",
  effect: "a posting coordinate cannot be decided by runtime configuration; that would let an operator change the financial basis on a screen",
  numbering: "changing the document-number shape makes historical documents impossible to trace",
  permission: "the permission catalog is generated from the declaration and participates in digest checks; a new key grown at runtime would make the digest drift",
  transition: "a state-machine edge cannot be grown from configuration — an edge posts, and a wrong edge is a wrong ledger",
});

export function assertNotForbidden(aspect: string): void {
  const why = FORBIDDEN_SURFACES[aspect];
  if (why !== undefined) fail(`a custom field cannot be used for "${aspect}": ${why}`);
}

export function normalizeCustomFieldKey(raw: unknown): string {
  const key = requireText(raw, "field code");
  if (!isCustomFieldKey(key)) {
    fail(`field code "${key}" must be camel case starting with x and then an uppercase letter (for example xBaseFabric), length 2–42`);
  }
  return key;
}

/**
 * Check whether a binding holds on this module. Pure function, zero IO.
 *
 * 🔴 `inherit` plus editable is a combination that must be hard-rejected: a pass-through field is always overwritten from the source on save.
 * Allowing a person to edit it means the next save wipes their value — the user will think the system ate their input.
 */
export function validateBinding(
  binding: CustomFieldBindingRecord,
  target: ModuleSchema,
  sourceOf: (module: string) => ModuleSchema | null,
): void {
  if (target.customFields !== true) {
    fail(`"${target.label}" has not opened custom fields — which modules are open is decided by the module declaration and needs a release`);
  }
  if (!target.creatable.manual && (binding.surfaces.form || binding.surfaces.required)) {
    fail(`"${target.label}" is generated from an upstream document and cannot be configured as create-form entry or required on create`);
  }
  const statuses = new Set(target.lifecycle.statuses.map((s) => s.key));
  for (const key of binding.surfaces.editStatuses) {
    if (!statuses.has(key)) fail(`"${target.label}" has no status "${key}"`);
  }

  // ── Which layer it lands on ──
  const layer = bindingLayerFields(binding, target);
  if (layer === null) {
    fail(`"${target.label}" has no line table "${binding.lineTable ?? ""}"`);
  }
  if (binding.lineTable !== null) {
    /**
     * 🔴 The line layer only pass-through. It does not "fill this row itself".
     *
     * Not because it is inconvenient: whether a line can be edited does not use the header status allow-list
     * (`lifecycle.statuses[].editableFields` lists header field keys).
     * Opening `own` would first have to answer "when can this row be edited", which is a different matter.
     * Reject it explicitly now, rather than ship an option that turns out not to take effect when someone clicks save.
     */
    if (binding.origin !== "inherit") {
      fail("a custom field on a line currently supports only \"brought down from an upstream document\" — filling the row itself requires an editability rule for lines first");
    }
    /**
     * 🔴 The line layer does not enter header list columns: one header row cannot hold N values.
     *
     * Filtering may be on (the kernel compiles a line condition to "a row exists that satisfies"),
     * so a combination that looks contradictory and is correct can appear here: not a list column, and still filterable.
     */
    if (binding.surfaces.list) {
      fail("a field on a line cannot be a header list column — N lines on one document are N values, and the header row cannot hold them. Filtering may be on: filtering by it returns documents that contain a row that satisfies the condition");
    }
  }

  if (binding.origin === "own") {
    if (binding.inherit !== null) fail("a field filled on this module must not declare a pass-through source");
    return;
  }

  // ── origin === "inherit" ──
  const inherit = binding.inherit;
  if (inherit === null) fail("a pass-through field must say which upstream document it is brought down from");
  if (binding.surfaces.form) fail("a pass-through field is supplied by the system and cannot appear on the create form");
  if (binding.surfaces.required) fail("a pass-through field is supplied by the system; \"required\" means nothing for it");
  if (binding.surfaces.editStatuses.length > 0) {
    fail("a pass-through field is always overwritten from the source on save and must not be editable in any status — otherwise the user's input is silently wiped");
  }
  // 🔴 The ref of a pass-through path must be on the same layer: a line's value can only be brought down from a ref on that line.
  // Using the header's `customerId` to supply a line gives N lines the same value, which is a fake per-row value.
  const via = layer.find((f) => f.key === inherit.viaRef);
  if (!via) {
    fail(
      binding.lineTable === null
        ? `"${target.label}" has no field "${inherit.viaRef}", so it cannot be a pass-through path`
        : `"${target.label}" line "${binding.lineTable}" has no column "${inherit.viaRef}", so it cannot be a pass-through path — a line's value can only be brought down from a reference on that line`,
    );
  }
  if ((via.type !== "ref" && via.type !== "refLine") || via.ref !== inherit.module) {
    fail(`"${target.label}.${inherit.viaRef}" is not a reference to "${inherit.module}", so pass-through cannot run`);
  }
  const source = sourceOf(inherit.module);
  if (source === null) fail(`upstream module "${inherit.module}" was not found`);
  if (source.customFields !== true) fail(`"${source.label}" has not opened custom fields`);
  if (via.type === "refLine" && !source.fields.some((field) => field.type === "subtable" && field.key === via.through)) {
    fail(`"${source.label}" does not have the selected source line`);
  }
}

export function normalizeSurfaces(raw: unknown, valueKind: CustomFieldValueKind): CustomFieldSurfaces {
  const obj = requireObject(raw, "surfaces");
  const bool = (key: string): boolean => {
    const value = obj[key];
    if (value === undefined) return false;
    if (typeof value !== "boolean") fail(`surface "${key}" accepts only true / false`);
    return value;
  };
  const editRaw = obj["editStatuses"];
  const editStatuses = editRaw === undefined
    ? []
    : Array.isArray(editRaw)
      ? editRaw.map((s, i) => requireText(s, `editStatuses[${String(i)}]`))
      : fail("editStatuses must be an array of status keys");
  const filterMultiple = bool("filterMultiple");
  if (filterMultiple && valueKind !== "choiceSet" && valueKind !== "multiSelect") {
    fail("only a field whose values come from a data dictionary can use a multi-select filter");
  }
  return {
    form: bool("form"),
    required: bool("required"),
    editStatuses,
    list: bool("list"),
    filter: bool("filter"),
    filterMultiple,
  };
}

export function normalizeValueKind(raw: unknown): CustomFieldValueKind {
  return requireEnum(raw, CUSTOM_FIELD_VALUE_KINDS, "value source");
}

export function normalizeOrigin(raw: unknown): CustomFieldOrigin {
  return requireEnum(raw, CUSTOM_FIELD_ORIGINS, "value origin");
}

export function normalizeCustomFieldStatus(raw: unknown): CustomFieldStatus {
  return requireEnum(raw, CUSTOM_FIELD_STATUSES, "status");
}
