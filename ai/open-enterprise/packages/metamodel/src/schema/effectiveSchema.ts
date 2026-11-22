// ---------------------------------------------------------------------------
// The only merge point: declaration ⊕ tenant custom fields = the module this tenant sees
//
// 🔴 There is only one. HTTP delivery merges once, write validation merges once,
// query compilation merges once. Three implementations will drift, and the symptom
// is "the form accepts it, save says the field does not exist" or "the list can
// filter it, the detail page cannot see it".
// The repo contract "each business rule keeps a single pure predicate… two
// implementations that claim to say the same thing will drift" is about this.
// Every consumer must take the schema from here.
//
// Pure function, zero IO: the caller loads the overlay for the tenant and passes
// it in. Same discipline as `recipients.ts`.
// ---------------------------------------------------------------------------

import {
  CUSTOM_FIELD_TYPE_OF,
  bindingLayerFields,
  isMultiValued,
  type CustomFieldBindingRecord,
  type CustomFieldRecord,
} from "./customField.js";
import { normalizeField } from "./fields.js";
import type { ModuleSchema } from "./module.js";

/** One binding plus the field definition it points at. The caller is responsible for pairing them. */
export interface EffectiveCustomField {
  readonly field: CustomFieldRecord;
  readonly binding: CustomFieldBindingRecord;
}

/** Title of the synthesized field group. This is the sentence business users see. */
export const CUSTOM_FIELD_GROUP = "Additional information";

/**
 * @param declared The module declaration in the catalog. Shared by every tenant, immutable. This function never mutates it.
 * @param overlay  Enabled bindings for this tenant and this module. An empty array returns `declared` unchanged.
 *
 * 🔴 An empty overlay must return the same object reference (not a new object with equal contents).
 * A tenant that does not use custom fields then pays zero extra cost and has zero behavior difference
 * on every hot path, and reference equality gives regression tests a hard criterion: the existing
 * tests must still pass with no wording change.
 */
export function effectiveSchema(
  declared: ModuleSchema,
  overlay: readonly EffectiveCustomField[],
): ModuleSchema {
  // Capability declarations belong to the module declaration. Merging custom fields does not change them.
  if (declared.customFields !== true || overlay.length === 0) return declared;

  const ordered = [...overlay].sort((a, b) => a.binding.sortOrder - b.binding.sortOrder);
  const header = ordered.filter(({ binding }) => binding.lineTable === null);
  const onLines = ordered.filter(({ binding }) => binding.lineTable !== null);
  const extra = header.map(fieldOf);

  /**
   * Line-layer bindings are grouped by line table and merged into that subtable's `fields`.
   *
   * 🔴 Merging them in is enough — query compilation (`lineScope` reads `field.fields`),
   * projection (`lineSelection` walks the same `projection`), and table creation (the line
   * table gains one more `custom` column) are all layer-agnostic. Nowhere needs a branch
   * of the form "if this is the line layer…". That is why this dimension lives on the
   * binding instead of opening a separate "line custom fields" system.
   */
  const byLineTable = new Map<string, EffectiveCustomField[]>();
  for (const item of onLines) {
    const key = item.binding.lineTable ?? "";
    byLineTable.set(key, [...(byLineTable.get(key) ?? []), item]);
  }
  const fieldsWithLines = (base: readonly ModuleSchema["fields"][number][]): readonly ModuleSchema["fields"][number][] =>
    byLineTable.size === 0
      ? base
      : base.map((field) => {
          const add = byLineTable.get(field.key);
          if (field.type !== "subtable" || add === undefined) return field;
          return { ...field, fields: [...(field.fields ?? []), ...add.map(fieldOf)] };
        });

  function fieldOf({ field, binding }: EffectiveCustomField) {
    const raw: Record<string, unknown> = {
      key: field.key,
      label: field.label,
      type: CUSTOM_FIELD_TYPE_OF[field.valueKind],
      ...(field.choiceSetCode === null ? {} : { choiceSet: field.choiceSetCode }),
      ...(isMultiValued(field.valueKind) ? { multiple: true } : {}),
      // The `HH:mm` shape of a time is enforced by the value gate, not by the UI "trying" to produce it —
      // "lexicographic order is time order" is the foundation of sorting and ranges
      ...(field.valueKind === "time" ? { format: "time" as const } : {}),
      ...(field.help === null ? {} : { help: field.help }),
      // Required applies only to new documents: existing documents predate this cell,
      // and requiring it on them would make every old document impossible to save
      ...(binding.surfaces.required ? { requiredOnManualCreate: true } : {}),
      // Pass-through synthesizes one snapshot and reuses the freeze logic that already runs today:
      // system-supplied / not writable by the client / always overwritten from the source on save.
      // No new line of execution code.
      ...(binding.origin === "inherit" && binding.inherit !== null
        ? {
            snapshot: {
              from: binding.inherit.module,
              match: binding.inherit.viaRef,
              through: bindingLayerFields(binding, declared)?.find((source) => source.key === binding.inherit?.viaRef)?.through ?? null,
              field: field.key,
              // Upstream rows that existed before the field was configured have no cell to freeze.
              // A missing value lands as null instead of refusing to create the document.
              optional: true,
            },
          }
        : {}),
      // What does not appear on the form is hidden, but it is still stored and still queryable
      ...(binding.surfaces.form || binding.origin === "inherit" ? {} : { hidden: true }),
    };
    // Go through normalizeField instead of hand-building a Field: every shape check,
    // default, and mutual-exclusion gate lives there. Hand-building copies a rule that will drift.
    return normalizeField(
      raw,
      `customField.${declared.code}.${binding.lineTable === null ? "" : `${binding.lineTable}.`}${field.key}`,
      false,
    );
  }

  const formFields = header
    .filter(({ binding }) => binding.surfaces.form && binding.origin === "own")
    .map(({ field }) => field.key);
  // The line layer does not enter header list columns (`validateBinding` already hard-rejects that), so only the header batch is considered here
  const listColumns = header.filter(({ binding }) => binding.surfaces.list).map(({ field }) => field.key);
  /**
   * Filter fields. The line layer is written as a line path `<line table>.<field>`.
   *
   * 🔴 The path itself is the answer to "which layer is this cell on". Do not open
   * a side channel to tell the frontend. The kernel's `parseLinePath` recognizes
   * this shape, compiles it to "a row exists that satisfies", and still returns header rows.
   */
  const filterFields = ordered
    .filter(({ binding }) => binding.surfaces.filter)
    .map(({ field, binding }) => (binding.lineTable === null ? field.key : `${binding.lineTable}.${field.key}`));

  return {
    ...declared,
    fields: [...fieldsWithLines(declared.fields), ...extra],
    lifecycle: {
      ...declared.lifecycle,
      statuses: declared.lifecycle.statuses.map((status) => {
        // Only a whitelist status needs an append — `full` already allows everything,
        // `none` is deliberately locked, and neither should be rewritten by a tenant setting
        if (status.editable !== "whitelist" || status.editableFields === null) return status;
        // The line layer is read-only pass-through and does not join the header editable whitelist
        const allowed = header
          .filter(({ binding }) => binding.surfaces.editStatuses.includes(status.key))
          .map(({ field }) => field.key);
        if (allowed.length === 0) return status;
        return { ...status, editableFields: [...status.editableFields, ...allowed] };
      }),
    },
    views: {
      ...declared.views,
      form: formFields.length === 0
        ? declared.views.form
        : [...declared.views.form, { title: CUSTOM_FIELD_GROUP, fields: formFields }],
      list: {
        ...declared.views.list,
        columns: [...declared.views.list.columns, ...listColumns],
        filters: [...declared.views.list.filters, ...filterFields],
      },
    },
  };
}

/**
 * Custom-field keys on this module that allow multi-select filtering.
 * The query compiler uses this to widen `eq` into `in`; the UI uses it to turn the dropdown into a multi-select.
 */
export function multiSelectFilterKeys(overlay: readonly EffectiveCustomField[]): readonly string[] {
  return overlay
    .filter(({ binding }) => binding.surfaces.filter && binding.surfaces.filterMultiple)
    .map(({ field }) => field.key);
}
