import { defaultFromOf, type Field, type LineRows } from "../schema/fields.js";
import type { ModuleSchema } from "../schema/module.js";
import { calendarYmd } from "../schema/numbering.js";

export function createDefaultValue(
  field: Field,
  values: Readonly<Record<string, unknown>>,
  now: Date,
  timeZone: string,
): string | Date | boolean | null {
  if (field.createDefault === "today") return calendarYmd(now, timeZone).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  if (field.createDefault === "now") return new Date(now.getTime());
  const by = field.createDefaultBy;
  if (by !== null && by !== undefined) {
    const source = values[by.field];
    if (typeof source === "string" && Object.hasOwn(by.values, source)) return by.values[source] ?? null;
  }
  return null;
}

/** Refresh starter values the user has not overwritten when the source value changes. Do not call this when editing an existing fact. */
export function applyCreateDefaultByChange(
  fields: readonly Field[],
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
  sourceKey: string,
): Record<string, unknown> {
  const out = { ...next };
  for (const field of fields) {
    const by = field.createDefaultBy;
    if (by === null || by === undefined || by.field !== sourceKey) continue;
    const before = createDefaultValue(field, previous, new Date(0), "UTC");
    const after = createDefaultValue(field, next, new Date(0), "UTC");
    const current = previous[field.key];
    if (current === undefined || current === null || current === before) {
      if (after === null) delete out[field.key];
      else out[field.key] = after;
    }
  }
  return out;
}

function defaultsOf(
  fields: readonly Field[],
  values: Readonly<Record<string, unknown>>,
  now: Date,
  timeZone: string,
): Record<string, unknown> {
  const out = { ...values };
  for (const field of fields) {
    // Missing key = the caller did not supply a starter value; explicit null = the user cleared it.
    // The two must not be merged, or an optional default time can never be cleared
    // while the clear button on screen looks completely successful.
    if (Object.hasOwn(out, field.key)) continue;
    const value = createDefaultValue(field, out, now, timeZone);
    if (value !== null) out[field.key] = value;
  }
  return out;
}

/** When a header cell changes, write the same value into line columns that declare defaultFrom. */
export function applyLineDefaultFrom(
  schema: ModuleSchema,
  sourceKey: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): Record<string, readonly Record<string, unknown>[]> {
  const sourceValue = header[sourceKey] ?? null;
  const next: Record<string, readonly Record<string, unknown>[]> = { ...lines };
  let changed = false;
  for (const table of schema.fields) {
    if (table.type !== "subtable" || table.fields === null) continue;
    const columns = table.fields.filter((column) => defaultFromOf(column)?.header === sourceKey);
    if (columns.length === 0) continue;
    const rows = next[table.key];
    if (rows === undefined) continue;
    next[table.key] = rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const column of columns) out[column.key] = sourceValue;
      return out;
    });
    changed = true;
  }
  return changed ? next : { ...lines };
}

/** Shared by the create write path and the create form. A value the caller set explicitly (including null) always wins. */
export function applyCreateDefaults(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows,
  now: Date,
  timeZone: string,
): { readonly header: Record<string, unknown>; readonly lines: Record<string, readonly Record<string, unknown>[]> } {
  const normalizedLines: Record<string, readonly Record<string, unknown>[]> = {};
  for (const [key, rows] of Object.entries(lines)) {
    const table = schema.fields.find((field) => field.type === "subtable" && field.key === key);
    normalizedLines[key] = table?.fields
      ? rows.map((row) => defaultsOf(table.fields ?? [], row, now, timeZone))
      : rows.map((row) => ({ ...row }));
  }
  return { header: defaultsOf(schema.fields, header, now, timeZone), lines: normalizedLines };
}
