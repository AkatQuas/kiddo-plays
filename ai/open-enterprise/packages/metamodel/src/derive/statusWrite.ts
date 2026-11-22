// ---------------------------------------------------------------------------
// Declarative side effects of writing a status — the unique default pointer
// inside a coordinate, and the stamp applied on first entry
//
// The write path recognizes only these two declarations, not a module code.
// `billRepo.setStatus`, a create that lands in the effective initial status,
// and the matching unit test share this decision: demotion and the stamp are
// computed from the same row snapshot, then the caller persists them in order
// inside one transaction.
// ---------------------------------------------------------------------------

import {
  isEmptyValue,
  stampOnFirstEnterOf,
  uniqueDefaultWithinOf,
  type Field,
} from "../schema/fields.js";
import type { ModuleSchema } from "../schema/module.js";
import { calendarYmd } from "../schema/numbering.js";

export interface UniqueDefaultDemotion {
  readonly field: string;
  readonly status: string;
  readonly within: Readonly<Record<string, string>>;
}

/** On entering the effective status, move the other effective records in the same coordinate to `toStatus` (only one effective record per coordinate). */
export interface StatusSupersede {
  readonly within: Readonly<Record<string, string>>;
  readonly fromStatus: string;
  readonly toStatus: string;
}

export interface StatusWritePlan {
  readonly demote: readonly UniqueDefaultDemotion[];
  readonly supersede: readonly StatusSupersede[];
  readonly stamp: Readonly<Record<string, string>>;
}

function businessDay(now: Date, timeZone: string): string {
  return calendarYmd(now, timeZone).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
}

function stampValue(field: Field, now: Date, timeZone: string): string {
  return field.type === "datetime" ? now.toISOString() : businessDay(now, timeZone);
}

function coordinateValue(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function uniqueDefaultDemotions(
  schema: ModuleSchema,
  to: string,
  row: Readonly<Record<string, unknown>>,
): readonly UniqueDefaultDemotion[] {
  const out: UniqueDefaultDemotion[] = [];
  for (const field of schema.fields) {
    const spec = uniqueDefaultWithinOf(field);
    if (spec === null || spec.status !== to) continue;
    if (row[field.key] !== true) continue;
    const within: Record<string, string> = {};
    let complete = true;
    for (const key of spec.within) {
      const value = coordinateValue(row[key]);
      if (value === null) {
        complete = false;
        break;
      }
      within[key] = value;
    }
    if (!complete) continue;
    out.push({ field: field.key, status: spec.status, within });
  }
  return out;
}

/**
 * Which sibling records to demote when entering status `to` (only one effective record per coordinate).
 * Unlike `uniqueDefaultDemotions`, this does not look at whether some field is true.
 * It produces a plan whenever the record enters `singleActiveWithin.status`.
 * An incomplete coordinate (one dimension of `within` has no value) is skipped —
 * the sibling set cannot be drawn, so it is not guessed.
 */
export function statusSupersessions(
  schema: ModuleSchema,
  to: string,
  row: Readonly<Record<string, unknown>>,
): readonly StatusSupersede[] {
  const spec = schema.lifecycle.singleActiveWithin;
  if (spec === null || spec.status !== to) return [];
  const within: Record<string, string> = {};
  for (const key of spec.within) {
    const value = coordinateValue(row[key]);
    if (value === null) return [];
    within[key] = value;
  }
  return [{ within, fromStatus: spec.status, toStatus: spec.supersedeTo }];
}

/** Header columns the demotion coordinate must read when entering `to`. Storage SELECTs them into the snapshot. */
export function statusWriteCoordinateKeys(schema: ModuleSchema, to: string): readonly string[] {
  const spec = schema.lifecycle.singleActiveWithin;
  return spec !== null && spec.status === to ? spec.within : [];
}

export function firstEnterStamps(
  schema: ModuleSchema,
  from: string,
  to: string,
  row: Readonly<Record<string, unknown>>,
  now: Date,
  timeZone: string,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const field of schema.fields) {
    const spec = stampOnFirstEnterOf(field);
    if (spec === null || spec.status !== to || from === spec.status) continue;
    if (!isEmptyValue(row[field.key])) continue;
    out[field.key] = stampValue(field, now, timeZone);
  }
  return out;
}

/**
 * Declarative side effects of one setStatus. Demotion and the stamp are both
 * computed from the row snapshot before entry. The caller must demote first
 * and then advance this document (including the stamp) in the same transaction.
 * If any step fails, the whole group rolls back.
 */
export function statusWritePlan(
  schema: ModuleSchema,
  from: string,
  to: string,
  row: Readonly<Record<string, unknown>>,
  now: Date,
  timeZone: string,
): StatusWritePlan {
  return {
    demote: uniqueDefaultDemotions(schema, to, row),
    supersede: statusSupersessions(schema, to, row),
    stamp: firstEnterStamps(schema, from, to, row, now, timeZone),
  };
}

export function statusWriteFieldsOf(schema: ModuleSchema, to: string): readonly Field[] {
  return schema.fields.filter((field) => {
    const unique = uniqueDefaultWithinOf(field);
    if (unique !== null && unique.status === to) return true;
    const stamp = stampOnFirstEnterOf(field);
    return stamp !== null && stamp.status === to;
  });
}
