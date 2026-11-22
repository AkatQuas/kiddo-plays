// ---------------------------------------------------------------------------
// Instance validation — "does this **data** hold"
//
// Strictly symmetric with `validate.ts`: that side answers "does this **declaration** hold", and this side answers
// "given this declaration, does this data hold". The two have the same shape. That is not a coincidence. They are the two halves of one pattern:
// both live in the kernel, both do zero IO, and both return a **report** instead of throwing.
//
// Why this layer has to exist, instead of letting the database's column constraints be the validator:
//
//   · A column constraint recognizes only a **column name** (`delivery_date`). It does not recognize a label ("outbound date") — it has no schema
//   · PG aborts the whole statement at the first null, and **reports only one at a time**. Three missing fields take three round trips
//   · It **lets all of these through**: an empty string filled into a required ref, an enum filled with a value outside the options, an object concatenated by JS into
//     `'[object Object]'`. None of those violate a column constraint. After they are stored the screen is a blank, and "dirty data" looks identical to "this record never had a name"
//   · The most expensive one: once "the database rejected it" is returned directly as a user-input error 400, a real
//     server bug (the framework forgot a platform column, the generator built the wrong column) silently becomes "your input is wrong".
//     The 400 list in `http/app.ts` onError was **judged one by one**. This layer exists
//     so a user-input error is classified **before** it reaches the database, instead of widening that list
//
// One criterion, and there must not be a second. Numbers are parsed with `fieldNumber` (the same one formulas and line totals use),
// emptiness with `isEmptyValue` (the same one the `required_fields` precondition uses), and decimal places with
// `roundToScale` (the same consumer of the table-build precision `NUMERIC_PRECISION`). The consequence of writing each one separately
// is not an error: the form says "this number is illegal" and save says it is legal, or the reverse.
//
// ── An empty string and null are the same thing ───────────────────────────
// Both are normalized to `null` before storage. Otherwise "not filled" has two representations in the database,
// and a filter `where x is null` **misses half of them**, and that half does not report an error.
// ---------------------------------------------------------------------------

import { CUSTOM_FIELD_TIME } from "../schema/customField.js";
import { checkAttachmentValue, type AttachmentRef } from "../schema/attachment.js";
import {
  bindRefFilterViaEntities,
  EMPTY_REF_FILTER_RESOLUTION,
  refFilterOperands,
  resolveRefFilter,
  resolveRefPreselect,
  type RefFilter,
  type RefFilterCondition,
  type RefFilterResolution,
} from "../normalize/refFilter.js";
import {
  
  fieldNumber,
  isEmptyValue,
  isGeneratedHeaderField,
  isRefResolvedField,
  isPlannerSupplied,
  isSystemSupplied,
  refLinePairs,
  refSupplyOf,
  roundToScale,
  normalizeField,
  uniqueFieldsOf,
  NUMERIC_PRECISION,
  type Field,
  type LineRows,
} from "../schema/fields.js";
import { didYouMean, queryInputFail, SchemaError, schemaFail } from "../schema/common.js";
import type { ModuleSchema } from "../schema/module.js";
import type { Transition, TransitionParam } from "../schema/lifecycle.js";

/**
 * A **closed** classification of problems.
 *
 * It is closed so the UI can dispatch exhaustively (which ones are marked red on a field, which ones are bill-level).
 * Adding a tier means adding a cell on the consumer — that is the compile error that should exist when something was added and nobody handles it.
 *
 * `REF_NOT_FOUND` is produced by the **server** (it has to query the database, and the kernel does zero IO and cannot judge it), but the code is defined
 * here: if each side defines its own enum, the frontend has to recognize two sets, and the set it misses shows up as a problem
 * that is silently not displayed.
 */
export const BILL_ISSUE_CODES = [
  "REQUIRED_BLANK",
  "TYPE_MISMATCH",
  "ENUM_NOT_IN_OPTIONS",
  /** The stable code does not exist in the tenant dictionary. Produced by a write boundary that needs IO. */
  "CHOICE_SET_UNKNOWN",
  /** The stable code exists but is disabled, and cannot be used for a new field choice or change. Produced by the write boundary. */
  "CHOICE_SET_DISABLED",
  "NUMBER_OUT_OF_RANGE",
  "PERCENT_OUT_OF_RANGE",
  "DATE_MALFORMED",
  "DATETIME_MALFORMED",
  "LINES_NOT_ARRAY",
  "LINE_ROW_NOT_OBJECT",
  "LINE_MAX_ROWS",
  "REF_NOT_FOUND",
  /**
   * A unique field collided with an existing record. Same rule as `REF_NOT_FOUND`: produced by the **server** (it has to query the database),
   * and the code is defined here. Two enums, one on each side, would make the missed one silently not displayed.
   *
   * It is a **user-input error** (400, marked red field by field), and it is a different class from a concurrent hit on the database unique index
   * (`UniqueViolationError` → 409 "please retry"). Mixed together,
   * a real concurrency problem is forever treated as "you filled a duplicate", and the user is right no matter how many times they change it.
   */
  "UNIQUE_DUPLICATE",
  /**
   * The attachment value's shape does not hold (not an array / an element is missing a key / an object key is illegal / over the count limit).
   *
   * It is its own tier instead of being folded into `TYPE_MISMATCH`: an attachment value is a **structure**.
   * The sentence "text was required and a number was received" has nothing to say about it, and the next step the UI should offer for this cell
   * (pick the file again, delete the extra ones) is completely different from a scalar type error.
   * Where it fails is said by `message` (the reason from `checkAttachmentValue`).
   */
  "ATTACHMENT_MALFORMED",
  /**
   * The referenced record **exists**, but it does not satisfy the candidate filter declared on this cell (`Field.refFilter`).
   *
   * It is a separate tier from `REF_NOT_FOUND`, for the same reason as the `UNIQUE_DUPLICATE` / 409 pair:
   * the two sentences give the user completely different next steps. "Does not exist" points them at creating one. "Not in the allowed range"
   * points them at picking another. Collapsed into one sentence, a person who picked a workshop as the "production plant" is told
   * that workshop does not exist — and they created it yesterday, so they create it again, and are rejected again.
   *
   * Same rule as `REF_NOT_FOUND`: produced by the **server** (it has to query the database), and the code is defined in the kernel.
   */
  "REF_FILTER_MISMATCH",
  /**
   * The cell that the candidate filter depends on has no value yet (`$bill.x` / `$line.x` inside `refFilter` cannot be evaluated).
   *
   * This tier exists because **fail-open is not allowed**: falling back to "then do not filter" when the value cannot be read
   * silently widens "this order's production tasks" into "any production task", and it happens only when that cell happens to be empty —
   * no symptom, and almost impossible to reproduce. So it is an explicit conclusion that can be marked red on that cell.
   */
  "REF_FILTER_PENDING",
  /**
   * The source field of a frozen column (snapshot) is empty on the reference target.
   * Produced by the server when resolveRefs writes back: the reference exists but the source value is missing, a user-input problem → 400.
   */
  "SNAPSHOT_SOURCE_EMPTY",
  /**
   * On the final create-from write, the source line actually submitted no longer satisfies sourceStatuses / sourceRemaining.
   *
   * prepare and the candidates are only for the immediate experience. They cannot become write authorization. The server rechecks after the source owner lock and
   * produces this tier. It is separate from REF_FILTER_MISMATCH: that one is a field candidate filter, this one is create-flow eligibility.
   * The fix is to pick a source line that can still be generated, not to change the refFilter of an ordinary reference field.
   */
  "CREATE_FROM_SOURCE_INELIGIBLE",
  "UNIT_SET_MAIN_BLANK",
  "UNIT_SET_PAIR_MISMATCH",
  "UNIT_SET_DUPLICATE",
  "UNIT_SET_RATE_INVALID",
] as const;
export type BillIssueCode = (typeof BILL_ISSUE_CODES)[number];

export interface BillIssue {
  /**
   * For the machine: `"deliveryDate"` / `"lines[0].qty"`.
   *
   * A line uses an **index** (starting at 0), not `lineNo`: the UI uses it to locate that row in the editor,
   * and a row in the editor does not have a lineNo yet (that is generated by position when it is stored). The row number a person sees is in `label`,
   * index + 1, consistent with the `line_no` column in the database. Both are needed, so they are not merged into one.
   */
  readonly path: string;
  /** The place a person sees: `"outbound date"` / `"outbound lines, row 1 · unit price"` */
  readonly label: string;
  readonly code: BillIssueCode;
  /** One sentence a person sees. It already includes the label and can be shown directly */
  readonly message: string;
}

// ── The two coordinate grammars of `BillIssue` (the only copy) ────────────
//
// `path` and `label` used to be **inlined at every site** (six in this file, plus a seventh the push side would have to build).
// Each copy of the concatenation fails in silence: `lines[0].qty` missing a pair of brackets means the UI cannot locate by coordinate,
// that cell is never marked red, and the error banner still shows. `row 1 · unit price` missing a space is only ugly.
// Neither reports an error, so the only way to keep them is "there is only one copy".
//
// **`build` and `parse` live together**, like `linePathOf` / `parseLinePath` in `query.ts`:
// being able to build but not parse, or parse something that cannot be built back, is the most common way this kind of grammar goes bad.

/** Line coordinate: `lines[0].qty`. The index starts at 0 (the UI locates that row in the editor by index). */
export function lineIssuePath(table: string, index: number, field: string): string {
  return `${table}[${String(index)}].${field}`;
}

/** Whole-row coordinate (not down to a column): `lines[0]`. */
export function lineIssueRowPath(table: string, index: number): string {
  return `${table}[${String(index)}]`;
}

/** Row label shown to a person: `Shipment line 1`. The number is the index plus 1, matching stored `line_no`. */
export function lineIssueRowLabel(tableLabel: string, index: number): string {
  return `${tableLabel} line ${String(index + 1)}`;
}

/** Cell label shown to a person: `Shipment line 1 · Unit price`. */
export function lineIssueLabel(tableLabel: string, index: number, fieldLabel: string): string {
  return `${lineIssueRowLabel(tableLabel, index)} · ${fieldLabel}`;
}

const LINE_ISSUE_PATH = /^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*)$/;

/**
 * Parse a line coordinate. **A header coordinate returns `null`** (that is a bare field name, not this grammar).
 *
 * It is the other face of the same shape as `lineIssuePath`, so they live together: being able to build but not parse makes
 * a consumer such as "map the target bill's coordinate back to the source bill" write its own regex, and a wrong one **skips in silence** —
 * a miss falls back to the target coordinate, and the user is back to "nothing is marked red".
 */
export function parseLineIssuePath(
  path: string,
): { readonly table: string; readonly index: number; readonly field: string } | null {
  const hit = LINE_ISSUE_PATH.exec(path);
  if (!hit?.[1] || hit[2] === undefined || !hit[3]) return null;
  return { table: hit[1], index: Number(hit[2]), field: hit[3] };
}

/**
 * The validation result.
 *
 * It is a **discriminated union** instead of `{ ok, issues, values }`: the latter lets the caller use `values` without looking at `ok`,
 * so data that failed validation is still inserted, and that is code that compiles.
 * The union turns "read the value without checking" into a type error — the type gate is the only immediate feedback this system has.
 */
export type BillCheck =
  | {
      readonly ok: true;
      /** Normalized header values: empty → null, numbers converged to number and rounded to column scale, strings already trimmed */
      readonly header: Record<string, unknown>;
      /** Normalized line rows. Only the child-table keys that were passed in */
      readonly lines: Record<string, readonly Record<string, unknown>[]>;
    }
  | { readonly ok: false; readonly issues: readonly BillIssue[] };

/** Result of checking a transient line table inside action parameters. It shares the value criterion of `checkLevel` with stored lines. */
export type TransientLinesCheck =
  | { readonly ok: true; readonly rows: readonly Record<string, unknown>[] }
  | { readonly ok: false; readonly issues: readonly BillIssue[] };

/**
 * Completeness meaning of the header. **There is no default** — the difference between the two tiers is "does a missing field count as an error", and guessing wrong
 * is silent: treating a save as a create makes a request that only changes a remark fail required, because the other fields are not in the patch.
 */
type Completeness = "whole" | "patch";

interface Sink {
  readonly issues: BillIssue[];
}

function report(sink: Sink, path: string, label: string, code: BillIssueCode, message: string): void {
  sink.issues.push({ path, label, code, message });
}

// ── A single value ──────────────────────────────────────────────────────────

/**
 * Before judging empty, collapse "two spellings of the same thing" into one.
 *
 * Two rules, one reason (see the file header: "not filled" can have only one representation in the database):
 *   · Trim a string first — a space is not "filled", but `isEmptyValue(" ")` is false
 *   · Collapse an empty attachment array to null — `[]` and null are both "no attachment was sent", and `isEmptyValue([])`
 *     is false. Without the collapse, a required attachment cell sent as `[]` **passes the required check**, then stores an empty array
 *     in a NOT NULL column (or stores it as a second kind of "not filled"), and `where x is null` misses half from then on
 */
function blankNormalized(field: Field, raw: unknown): unknown {
  if (typeof raw === "string") return raw.trim();
  if (field.type === "attachment" && Array.isArray(raw) && raw.length === 0) return null;
  return raw;
}

function typeMismatch(field: Field, raw: unknown, expected: string): string {
  // For the user: say only "what this cell needs, and that what was filled is empty or not well formed". Do not leak system quantities such as "null", raw JSON, or typeof.
  const got =
  raw === null || raw === undefined
      ? "not filled in"
      : Array.isArray(raw)
     ? "a list of values was filled in"
        : typeof raw === "object"
          ? "the value is not well formed"
  : "the value does not match";
  return `"${field.label}" must be ${expected}; currently ${got}`;
}

/** A number: parse → round to column scale → judge the range. The order cannot be swapped. PG judges the rounded value */
function checkNumeric(
  field: Field,
  type: "number" | "money" | "percent",
  raw: unknown,
  path: string,
  label: string,
  sink: Sink,
): unknown {
  let parsed: number;
  try {
    // Borrow the **same** parser formulas and line totals use: it accepts numeric strings (a numeric column often arrives as a string through JSON,
    // which is a representation difference, not a fallback for a missing value). Catch here instead of writing the judgment again,
    // because "what counts as a number" must have only one definition — two copies drift, and the drift looks like
    // the form says illegal and save says legal (or the reverse), and neither side reports an error.
    parsed = fieldNumber(raw, `"${label}"`);
  } catch (error: unknown) {
    if (!(error instanceof SchemaError)) throw error;
    report(sink, path, label, "TYPE_MISMATCH", error.message);
    return undefined;
  }
  const rounded = roundToScale(parsed, type, `"${label}"`);
  // percent carries only a ratio in this repo (discount / tax rate / scrap rate). Its business definition is 0..100.
  // It lives in the write foundation instead of being repeated as a rule in each module: a negative tax rate, 150% scrap, and a 200% discount have no legal reading,
  // and they enter a formula and become an amount or quantity that looks normal. Waiting until the transition to stop them is already too late.
  if (type === "percent" && (rounded < 0 || rounded > 100)) {
    report(
      sink,
      path,
      label,
      "PERCENT_OUT_OF_RANGE",
      `"${label}" must be between 0 and 100 (received ${String(parsed)})`,
    );
    return undefined;
  }
  const { precision, scale } = NUMERIC_PRECISION[type];
  // The integer digits numeric(p,s) can represent are p - s. Beyond that PG throws 22003,
  // and that error's current shape is a 500 "internal server error"
  const ceiling = 10 ** (precision - scale);
  if (Math.abs(rounded) >= ceiling) {
    report(
      sink,
      path,
      label,
      "NUMBER_OUT_OF_RANGE",
      `"${label}" is outside the storable range: the integer part may have at most ${String(precision - scale)} digits (received ${String(parsed)})`,
    );
    return undefined;
  }
  return rounded;
}

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date: the shape, plus **that it really is that day**.
 *
 * `2026-02-30` passes the regex and is not a calendar day. PG throws 22007 — the current shape is a 500.
 * Build it in UTC and compare back. Do not use the local timezone: a local construction shifts the last day across a month boundary by one day in some timezones.
 */
function checkDate(raw: unknown, field: Field, path: string, label: string, sink: Sink): unknown {
  if (typeof raw !== "string") {
    report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "a date"));
    return undefined;
  }
  if (!DATE_SHAPE.test(raw)) {
    report(sink, path, label, "DATE_MALFORMED", `"${label}" is not a YYYY-MM-DD date: "${raw}"`);
    return undefined;
  }
  const at = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== raw) {
    report(sink, path, label, "DATE_MALFORMED", `"${label}" is not a real calendar day: "${raw}"`);
    return undefined;
  }
  return raw;
}

/**
 * One value. Returns the **normalized** value. When it does not pass, returns `undefined` and the problem has already been recorded.
 *
 * Exhaustive over `FieldType`, with no default branch: adding a field type and missing a case here is a
 * compile error. With a default, the new type would silently fall into "not judged", which is the shape this layer exists to eliminate.
 */
function checkValue(field: Field, raw: unknown, path: string, label: string, sink: Sink): unknown {
  switch (field.type) {
    case "string":
    case "text":
    case "phone": {
      if (typeof raw !== "string") {
        report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "text"));
        return undefined;
      }
      const trimmed = raw.trim();
      // A time is a zero-padded `HH:mm`. This has to be a real gate, not something the UI "tries" to produce:
      // without zero padding, or outside the range, the property "dictionary order is time order" collapses immediately,
      // and sorting and ranges are built on that property
      if (field.format === "time" && trimmed !== "" && !CUSTOM_FIELD_TIME.test(trimmed)) {
        report(sink, path, label, "TYPE_MISMATCH",
          `"${label}" must be a 24-hour HH:mm time (for example 09:30 or 14:05); received "${trimmed}"`);
        return undefined;
      }
      return trimmed;
    }

    case "enum": {
      // Multiple: the value is a set of codes. Judge each item with the same rules as a single choice, and say which item is wrong —
      // saying only "the format is wrong" makes the user try the values one by one
      if (field.multiple === true) {
        if (!Array.isArray(raw)) {
          report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "a set of options"));
          return undefined;
        }
        const picked: string[] = [];
        for (const [index, item] of raw.entries()) {
          if (typeof item !== "string" || item.trim() === "") {
            report(sink, path, label, "TYPE_MISMATCH", `"${label}" item ${String(index + 1)} is not an option`);
            return undefined;
          }
          const value = item.trim();
          // When the options come from a dictionary, storage checks them against the enabled items, the same rule as a single choice
          if (field.choiceSet === null && field.options !== null
            && !field.options.some((option) => option.value === value)) {
            report(sink, path, label, "ENUM_NOT_IN_OPTIONS", `"${label}" does not recognize option "${value}"`);
            return undefined;
          }
          if (!picked.includes(value)) picked.push(value);
        }
        return picked;
      }
      if (typeof raw !== "string") {
        report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "text"));
        return undefined;
      }
      const value = raw.trim();
      // Options for unitChoice / choiceSet both come from an IO boundary and are not copied again into static options: the first is checked
      // when the product unit is resolved, and the second checks enabled items in the tenant dictionary store. The pure kernel only tightens the value shape.
      if (field.unitChoice !== null || field.choiceSet !== null) return value;
      const options = field.options ?? schemaFail(`field "${field.key}" is an enum with no options — the declaration gate should already have rejected this`);
      if (!options.some((option) => option.value === value)) {
        report(
          sink,
          path,
          label,
          "ENUM_NOT_IN_OPTIONS",
          `"${label}" must be one of ${options.map((o) => `"${o.label}"`).join(" / ")}; received "${value}"`,
        );
        return undefined;
      }
      return value;
    }

    case "ref":
    case "refLine":
      // Only the shape is judged. **Whether the record it points at exists requires a database query**, and the kernel does zero IO and cannot judge it —
      // that hop is on the server, inside the same transaction, and produces REF_NOT_FOUND.
      // refLine has the same shape: the value is a line id, and like ref it is a string
      if (typeof raw !== "string") {
        report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "one related record"));
        return undefined;
      }
      return raw.trim();

    case "number":
    case "money":
    case "percent":
      return checkNumeric(field, field.type, raw, path, label, sink);

    case "bool":
      // "true" / 1 are not accepted: that would be a guess about **representation**, and the wrong guess is silent
      // (`"false"` is a truthy string, and would be stored as true)
      if (typeof raw !== "boolean") {
        report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "yes or no"));
        return undefined;
      }
      return raw;

    case "date":
      return checkDate(raw, field, path, label, sink);

    case "datetime": {
      // The normalized result is a Date (see below: drizzle timestamp mode:'date' wants a Date).
      // The write path runs the value gate **again** (`assertResolvedWrite`, after snapshot / refDefault have been filled).
      // A cell that already turned an ISO string into a Date on the first pass comes in again — this has to be idempotent.
      // Accepting only string means any create with a required datetime (such as a production task generated by release)
      // fails the second gate with "a timestamp was required and an object was received", even though the first gate passed.
      if (raw instanceof Date) {
        if (!Number.isFinite(raw.getTime())) {
          report(sink, path, label, "DATETIME_MALFORMED", `"${label}" is not a valid time`);
          return undefined;
        }
        return raw;
      }
      if (typeof raw !== "string") {
        report(sink, path, label, "TYPE_MISMATCH", typeMismatch(field, raw, "a date and time"));
        return undefined;
      }
      const ms = Date.parse(raw);
      if (!Number.isFinite(ms)) {
        report(sink, path, label, "DATETIME_MALFORMED", `"${label}" is not a parseable timestamp: "${raw}"`);
        return undefined;
      }
      // Converge to a Date: a `timestamp({ withTimezone: true })` column is
      // `mode: 'date'` in drizzle, and giving it a string blows up in the driver (another 500)
      return new Date(ms);
    }

    case "attachment": {
      // The source of truth for the value shape is `attachment.ts` (table build, the value gate, upload and download, and the control all read the same copy).
      // Here only "given that declaration, does this data hold" is done — whether the object is in the bucket, and whether the key belongs to this tenant,
      // both need an identity or IO. Those two hops are on the server (same as REF_NOT_FOUND for `ref`)
      const checked = checkAttachmentValue(raw);
      if (!checked.ok) {
        report(sink, path, label, "ATTACHMENT_MALFORMED", `"${label}" ${checked.reason}`);
        return undefined;
      }
      // An empty array was already collapsed to null in `blankNormalized`, so it cannot reach here. Reaching here means that step was bypassed,
      // and storing a `[]` in the column would give "not filled" two representations in the database (see the file header)
      if (checked.value.length === 0) {
        return schemaFail(`field "${field.key}" attachment arrived as an empty array — blank normalization should already have turned it into null`);
      }
      return checked.value;
    }

    case "subtable":
      // Lines go through the lines parameter. Seeing one in the header values means the headerWrite key gate was bypassed —
      // that is not a user-input error. The framework's own invariant broke, so it should throw, not report
      return schemaFail(`field "${field.key}" is a line table and must not appear in header values — it should go through the lines parameter`);
  }
}

// ── One layer (header / one line) ───────────────────────────────────────────

/** Fields a user can fill: declared, not system-supplied, and not a line table */
function fillable(fields: readonly Field[], channel: "user" | "planner" = "user"): readonly Field[] {
  return fields.filter(
    (field) =>
      (!isSystemSupplied(field, fields) || (channel === "planner" && isPlannerSupplied(field))) &&
      field.type !== "subtable",
  );
}

/**
 * This cell is empty, but the **server still has a way to supply a value**, so the required conclusion waits until that supply finishes.
 *
 * Three sources, different criteria, the same shape — each asks whether the premise of the supply is present:
 *   · `refDefault` looks at whether the match cell is filled (the source record is the one it points at);
 *   · `unitChoice` also looks at match: it may already be in the input, or the same round of reference resolution guarantees it will be filled. When the unit is left empty,
 *     storage fills the default again from the source product's main unit;
 *   · `refPreselect` / `refPreselectSole` look at whether the candidate set's dynamic operands are filled (when the candidate set has no referent, nothing can be picked).
 *
 * When the premise is **absent**, report required immediately and do not wait until after IO: that is a pure data-entry problem (no product was chosen).
 * Waiting only says the same sentence one round trip later, and the cell the user has to change is exactly the same.
 *
 * The reverse is also true: leaving it empty when the premise is present is **not a pass**. After storage supplies the value it runs the same value gate again
 * (`assertResolvedWrite`), and when it cannot pick exactly one that pass still reports `REQUIRED_BLANK`.
 * This layer only decides whether the conclusion is given now or after the supply. It does not decide the conclusion itself.
 *
 * @param scope whether this layer is the header or a line — `$line.` has a referent only on a line,
 *   and a `$bill.` operand on a line is not visible at this layer (`values` has only this row), so it is left to the pass after the supply.
 */
function blankMayBeSupplied(
  field: Field,
  fields: readonly Field[],
  values: Readonly<Record<string, unknown>>,
  scope: "bill" | "line",
): boolean {
  if (field.refDefault !== null && !isEmptyValue(values[field.refDefault.match])) return true;
  if (field.unitChoice !== null) {
    if (!isEmptyValue(values[field.unitChoice.match])) return true;
    const match = fields.find((candidate) => candidate.key === field.unitChoice?.match);
    const supply = match ? refSupplyOf(match, fields) : null;
    if (supply?.stage === "resolved" && supply.guaranteed) return true;
  }
  if (field.refPreselect === null && !field.refPreselectSole) return false;
  return refFilterOperands(field.refFilter).every(
    (operand) => operand.scope !== scope || !isEmptyValue(values[operand.key]),
  );
}

function checkLevel(
  fields: readonly Field[],
  values: Readonly<Record<string, unknown>>,
  completeness: Completeness,
  pathOf: (key: string) => string,
  labelOf: (field: Field) => string,
  sink: Sink,
  scope: "bill" | "line",
  channel: "user" | "planner" = "user",
  manualWholeWrite = false,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fillable(fields, channel)) {
    const present = Object.hasOwn(values, field.key);
    // patch tier: absent means it was not touched, and the value in the database stays. whole tier: absent means it was not filled
    if (!present && completeness === "patch") continue;

    const raw = blankNormalized(field, values[field.key]);
    const path = pathOf(field.key);
    const label = labelOf(field);

    if (isEmptyValue(raw)) {
      if (field.required || (manualWholeWrite && field.requiredOnManualCreate === true) || (channel === "planner" && isPlannerSupplied(field))) {
        // A reference default / candidate default selection can be filled only after the server has queried the database. The kernel does zero IO, so this cell may be temporarily missing.
        // After resolveRefs, storage runs the same complete value gate again on the final value (`assertResolvedWrite`).
        // When the premise of the fill is also absent, still report required immediately, so a pure entry problem is not dragged past IO.
        if (blankMayBeSupplied(field, fields, values, scope)) {
          out[field.key] = null;
          continue;
        }
        report(
          sink,
          path,
          label,
          "REQUIRED_BLANK",
          isPlannerSupplied(field)
            ? `the system must freeze "${label}" when it creates this document, and the current plan did not supply it`
            : `"${label}" is required`,
        );
        continue;
      }
      // An empty string / undefined is always collapsed to null — see the file header
      out[field.key] = null;
      continue;
    }

    const value = checkValue(field, raw, path, label, sink);
    if (value !== undefined) out[field.key] = value;
  }
  return out;
}

/**
 * Check a `billLines` action parameter. It is not a persisted line table of some bill, but the row structure is still a
 * `subtable` Field, so required, type, enum, and numeric scale all reuse the same value gate as an ordinary line.
 *
 * `allowMissingRequired`: true while preparing the action's initial values. A seed can carry only the columns it already knows
 * (this step's quantity). A required cell filled only in the dialog (for example the push target's header cell) may be temporarily missing.
 * preview / execute do not pass this flag, and a miss is still REQUIRED_BLANK.
 */
export function checkTransientLines(
  field: Field,
  value: unknown,
  options: { readonly allowMissingRequired?: boolean } = {},
): TransientLinesCheck {
  if (field.type !== "subtable" || !field.fields?.length) {
    return schemaFail(`action line table "${field.key}" must be a subtable with column declarations`);
  }
  const sink: Sink = { issues: [] };
  if (!Array.isArray(value)) {
    report(sink, field.key, field.label, "LINES_NOT_ARRAY", `"${field.label}" must be a set of detail lines`);
    return { ok: false, issues: sink.issues };
  }
  const rows: Record<string, unknown>[] = [];
  for (const [index, row] of value.entries()) {
    const rowLabel = lineIssueRowLabel(field.label, index);
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      report(sink, lineIssueRowPath(field.key, index), rowLabel, "LINE_ROW_NOT_OBJECT", `${rowLabel} is not a row`);
      continue;
    }
    const declared = new Set(field.fields.map((column) => column.key));
    const unknown = Object.keys(row).filter((key) => !declared.has(key));
    if (unknown.length > 0) {
      schemaFail(
        `action line table "${field.label}" line ${String(index + 1)} does not accept columns "${unknown.join(", ")}" — ` +
          `only ${[...declared].join(" / ")} are allowed`,
      );
    }
    rows.push(
      checkLevel(
        field.fields,
        row as Record<string, unknown>,
        options.allowMissingRequired === true ? "patch" : "whole",
        (key) => lineIssuePath(field.key, index, key),
        (column) => lineIssueLabel(field.label, index, column.label),
        sink,
        "line",
      ),
    );
  }
  return sink.issues.length ? { ok: false, issues: sink.issues } : { ok: true, rows };
}

export interface TransitionParamsCheck {
  readonly params: Readonly<Record<string, unknown>>;
  readonly issues: readonly BillIssue[];
}

function scalarParamField(param: TransitionParam): Field {
  const type = param.type === "text" ? "string" : param.type;
  if (type === "billLines") return schemaFail(`billLines parameter "${param.key}" is not a scalar`);
  return normalizeField({
    key: param.key,
    label: param.label,
    type,
    required: param.required,
    ...(type === "ref" ? { ref: param.ref } : {}),
    ...(type === "enum" ? { options: param.options } : {}),
  });
}

/**
 * The only normalization entry for one Transition's parameters. preview / execute / Planner / audit must consume the
 * `params` returned here. They must not judge a gate with the normalized value while handing the raw string or extra columns to an effect.
 */
export function normalizeTransitionParams(
  edge: Transition,
  raw: Readonly<Record<string, unknown>>,
  options: {
    /** During the preparer stage every required parameter may be temporarily missing, left for the user to fill in the action dialog. */
    readonly allowMissingRequired?: boolean;
    /** Only this small set of parameters supplied by the action preparer may be temporarily missing (for example the moment the action happens). */
    readonly allowMissingRequiredFor?: readonly string[];
  } = {},
): TransitionParamsCheck {
  const declared = new Set(edge.params.map((param) => param.key));
  const unknown = Object.keys(raw).filter((key) => !declared.has(key));
  if (unknown.length > 0) {
    // "Declared: none" is itself the most useful sentence (it says plainly that nothing is accepted), but it lives only inside the sentence.
    // Once it is structured, the caller knows what to pass without parsing prose — invented parameter names are closed by these two cells.
    queryInputFail(
      "EDGE_PARAM_UNKNOWN",
      `edge "${edge.code}"`,
      `edge "${edge.code}" does not accept parameters "${unknown.join(", ")}" — declared: ${[...declared].join(", ") || "none"}`,
      declared.size
        ? `pass only the parameters listed in valid`
        : `this edge accepts no parameters; run it directly`,
      {
        valid: [...declared],
        didYouMean: didYouMean(unknown[0] ?? "", [...declared]),
        fixable: "machine",
      },
    );
  }

  const sink: Sink = { issues: [] };
  const params: Record<string, unknown> = {};
  for (const param of edge.params) {
    const present = Object.hasOwn(raw, param.key);
    const value = raw[param.key];
    // Absence and an empty value are not parameters that can be normalized. "Absence" during prepare may legally be left
    // for the later dialog to fill. Handing undefined straight to the scalar value gate misdiagnoses it as a value that was provided
    // but has the wrong type, and "the preparer has no default" cannot be told apart from "the preparer returned a bad default".
    const blank = !present || isEmptyValue(value) || (param.type === "billLines" && Array.isArray(value) && value.length === 0);
    if (blank) {
      // The action's initial values only provide defaults it already knows (for example the time frozen for this operation).
      // Other required input is still filled by the form after it opens. Keep "absent" and "the user explicitly cleared it" apart:
      // the former may be left during prepare, and the latter is always a fill error.
      const missingAllowed =
        (options.allowMissingRequired === true && !present) ||
        (options.allowMissingRequiredFor?.includes(param.key) === true && !present);
      if (param.required && !missingAllowed) {
        report(sink, param.key, param.label, "REQUIRED_BLANK", `"${param.label}" is required`);
      }
      if (present) params[param.key] = null;
      continue;
    }

    if (param.type === "billLines") {
      const lineField = param.lineField ?? schemaFail(`billLines parameter "${param.key}" is missing lineField`);
      const checked = checkTransientLines(lineField, value, {
        allowMissingRequired: options.allowMissingRequired === true,
      });
      if (checked.ok) params[param.key] = checked.rows;
      else sink.issues.push(...checked.issues);
      continue;
    }

    const field = scalarParamField(param);
    const normalized = checkValue(field, blankNormalized(field, value), param.key, param.label, sink);
    if (normalized !== undefined) params[param.key] = normalized;
  }
  return { params, issues: sink.issues };
}

/**
 * The combined-value invariant of one unitSet source record. An update must merge the old database values with the patch before calling;
 * looking at the patch alone cannot tell "auxiliary was not changed" from "auxiliary was cleared".
 */
export function unitSetIssuesOf(
  schema: ModuleSchema,
  values: Readonly<Record<string, unknown>>,
): readonly BillIssue[] {
  const unitSet = schema.unitSet;
  if (unitSet == null) return [];
  const sink: Sink = { issues: [] };
  const labelOf = (key: string): string => schema.fields.find((field) => field.key === key)?.label ?? key;
  const blank = (value: unknown): boolean => isEmptyValue(value) || (typeof value === "string" && value.trim() === "");
  const main = values[unitSet.main];
  const auxiliary = values[unitSet.auxiliary];
  const rate = values[unitSet.conversionRate];
  if (blank(main)) {
    report(
      sink,
      unitSet.main,
      labelOf(unitSet.main),
      "UNIT_SET_MAIN_BLANK",
      `"${labelOf(unitSet.main)}" cannot be empty: a business document's unit choices start from the main unit`,
    );
  }
  const hasAuxiliary = !blank(auxiliary);
  const hasRate = !blank(rate);
  if (hasAuxiliary !== hasRate) {
    const path = hasAuxiliary ? unitSet.conversionRate : unitSet.auxiliary;
    report(
      sink,
      path,
      labelOf(path),
      "UNIT_SET_PAIR_MISMATCH",
      `"${labelOf(unitSet.auxiliary)}" and "${labelOf(unitSet.conversionRate)}" must both be filled in or both left blank`,
    );
  }
  if (!blank(main) && hasAuxiliary && String(main).trim() === String(auxiliary).trim()) {
    report(
      sink,
      unitSet.auxiliary,
      labelOf(unitSet.auxiliary),
      "UNIT_SET_DUPLICATE",
      `the main unit and the auxiliary unit cannot be the same; when there is no second unit, leave both the auxiliary unit and the conversion rate blank`,
    );
  }
  if (hasRate) {
    let numeric: number | null = null;
    try {
      numeric = fieldNumber(rate, labelOf(unitSet.conversionRate));
    } catch {
      // An ordinary TYPE_MISMATCH already reports the value's type error. This still states the unitSet business constraint.
    }
    if (numeric === null || numeric <= 0) {
      report(
        sink,
        unitSet.conversionRate,
        labelOf(unitSet.conversionRate),
        "UNIT_SET_RATE_INVALID",
        `"${labelOf(unitSet.conversionRate)}" must be greater than 0; the convention is 1 auxiliary unit = N main units`,
      );
    }
  }
  return sink.issues;
}

export interface ResolvedUnitChoice {
  readonly value: string;
  readonly factor: number;
  readonly source: "user" | "refDefault" | "main";
}

/** Stable identity of one dictionary item: code is stored, label is shown, and the two are the same option. */
export interface ChoiceIdentity {
  readonly code: string;
  readonly label: string;
}

/**
 * When a product unitSet hangs a choiceSet, the main and auxiliary cells share that dictionary's code↔label.
 * When it does not, this is empty: units are still compared exactly against the original text on the product master.
 */
export function unitChoiceIdentitiesOf(
  sourceSchema: ModuleSchema,
  choiceSets: readonly { readonly code: string; readonly items: readonly ChoiceIdentity[] }[],
): readonly ChoiceIdentity[] {
  const unitSet = sourceSchema.unitSet;
  if (unitSet === null) return [];
  const wanted = new Set<string>();
  for (const key of [unitSet.main, unitSet.auxiliary]) {
    const field = sourceSchema.fields.find((candidate) => candidate.key === key);
    if (field?.choiceSet) wanted.add(field.choiceSet);
  }
  if (wanted.size === 0) return [];
  const out: ChoiceIdentity[] = [];
  const seen = new Set<string>();
  for (const set of choiceSets) {
    if (!wanted.has(set.code)) continue;
    for (const item of set.items) {
      if (seen.has(item.code)) continue;
      seen.add(item.code);
      out.push({ code: item.code, label: item.label });
    }
  }
  return out;
}

/** The code and the label of the same dictionary item are the same unit. With no identities, only exact equality counts. */
export function sameChoiceValue(
  left: string,
  right: string,
  identities: readonly ChoiceIdentity[],
): boolean {
  if (left === right) return true;
  if (identities.length === 0) return false;
  const idOf = (value: string): string | null => {
    const hit = identities.find((item) => item.code === value || item.label === value);
    return hit === undefined ? null : hit.code;
  };
  const a = idOf(left);
  const b = idOf(right);
  return a !== null && a === b;
}

/**
 * Converge a product unitSet and a bill's unit choice into the one value that is stored.
 * An empty value defaults to the main unit. The main-unit factor is always 1. The auxiliary-unit factor is conversionRate (1 auxiliary = N main).
 * The stored value is always the original text of that cell on the product master (code or a historical label). A third spelling is not invented.
 */
export function resolveUnitChoice(
  schema: ModuleSchema,
  source: Readonly<Record<string, unknown>>,
  userValue: unknown,
  refDefaultValue: unknown = null,
  identities: readonly ChoiceIdentity[] = [],
): ResolvedUnitChoice {
  const unitSet = schema.unitSet ?? schemaFail(`module "${schema.code}" has no unitSet`);
  const issues = unitSetIssuesOf(schema, source);
  if (issues.length > 0) {
    schemaFail(`module "${schema.code}" has an invalid unit set: ${issues.map((issue) => issue.message).join("; ")}`);
  }
  const main = String(source[unitSet.main]).trim();
  const auxiliaryRaw = source[unitSet.auxiliary];
  const auxiliary = isEmptyValue(auxiliaryRaw) ? null : String(auxiliaryRaw).trim();
  const nonBlank = (value: unknown): string | null => {
    if (isEmptyValue(value) || (typeof value === "string" && value.trim() === "")) return null;
    return typeof value === "string" ? value.trim() : String(value);
  };
  const user = nonBlank(userValue);
  const inherited = nonBlank(refDefaultValue);
  const value = user ?? inherited ?? main;
  const valueSource: ResolvedUnitChoice["source"] = user !== null ? "user" : inherited !== null ? "refDefault" : "main";
  if (sameChoiceValue(value, main, identities)) return { value: main, factor: 1, source: valueSource };
  if (auxiliary !== null && sameChoiceValue(value, auxiliary, identities)) {
    return {
      value: auxiliary,
      factor: fieldNumber(source[unitSet.conversionRate], `module "${schema.code}" auxiliary-unit conversion rate`),
      source: valueSource,
    };
  }
  return schemaFail(
    `unit "${value}" is not among the choices recorded on module "${schema.code}"; only main unit "${main}" is allowed` +
      (auxiliary === null ? "" : ` or auxiliary unit "${auxiliary}"`),
  );
}

// ── The whole bill ──────────────────────────────────────────────────────────

function checkBill(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows | null,
  completeness: Completeness,
  channel: "user" | "planner" = "user",
): BillCheck {
  const sink: Sink = { issues: [] };

  const checkedHeader = checkLevel(
    schema.fields,
    header,
    completeness,
    (key) => key,
    (field) => field.label,
    sink,
    "bill",
    channel,
    completeness === "whole" && channel === "user",
  );
  if (completeness === "whole") sink.issues.push(...unitSetIssuesOf(schema, header));

  const checkedLines: Record<string, readonly Record<string, unknown>[]> = {};
  for (const [key, rows] of Object.entries(lines ?? {})) {
    const table = schema.fields.find((f) => f.key === key && f.type === "subtable");
    // An unknown line-table key means **the caller used the interface wrong**, not an entry problem — the storage layer already threw.
    // Do not report it again, and do not swallow it in silence: skipping it would make "the lines were not saved" show up as zero errors
    if (!table) {
      schemaFail(`module "${schema.code}" has no line table "${key}" — the key gate should already have rejected this`);
    }
    if (!Array.isArray(rows)) {
      report(sink, key, table.label, "LINES_NOT_ARRAY", `"${table.label}" must be a set of detail lines`);
      continue;
    }
    const declared = table.fields ?? schemaFail(`line table "${key}" has no column declarations — the declaration gate should already have rejected this`);
    const out: Record<string, unknown>[] = [];
    for (const [index, row] of rows.entries()) {
      // The row number a person sees uses index + 1 (consistent with line_no in the database). path uses index (the UI locates by index)
      const rowLabel = lineIssueRowLabel(table.label, index);
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        report(sink, lineIssueRowPath(key, index), rowLabel, "LINE_ROW_NOT_OBJECT", `${rowLabel} is not a row`);
        continue;
      }
      out.push(
        // A line is **always whole**, even when the bill is a patch: lines are replaced as a whole table
        // (delete + writeLines inside `save`), so what was passed in is the full content after replacement.
        // Judging it as a patch would let "clear a required field on one row while saving" pass in silence
        checkLevel(
          declared,
          row as Record<string, unknown>,
          "whole",
          (k) => lineIssuePath(key, index, k),
          (f) => lineIssueLabel(table.label, index, f.label),
          sink,
          "line",
          channel,
          completeness === "whole" && channel === "user",
        ),
      );
    }
    checkedLines[key] = out;
  }

  // A required line table: at least one row when storing (whole) or when this write replaces the whole table (patch and lines were passed).
  // Header `required` governs columns. A line table is not a column, and fillable excludes it, so it has to be judged here on its own.
  if (lines !== null) {
    for (const table of schema.fields) {
      if (table.type !== "subtable" || !table.required) continue;
      if (completeness === "patch" && !Object.hasOwn(lines, table.key)) continue;
      const rows = checkedLines[table.key] ?? [];
      if (rows.length > 0) continue;
      report(
        sink,
        table.key,
        table.label,
        "REQUIRED_BLANK",
        `"${table.label}" is required; enter at least one line`,
      );
    }
    for (const table of schema.fields) {
      if (table.type !== "subtable") continue;
      const maxRows = table.maxRows ?? null;
      if (maxRows === null) continue;
      if (completeness === "patch" && lines !== null && !Object.hasOwn(lines, table.key)) continue;
      const rows = checkedLines[table.key] ?? [];
      if (rows.length <= maxRows) continue;
      report(
        sink,
        table.key,
        table.label,
        "LINE_MAX_ROWS",
        `"${table.label}" may have at most ${String(maxRows)} lines.`,
      );
    }
  }

  if (sink.issues.length) return { ok: false, issues: sink.issues };
  return { ok: true, header: checkedHeader, lines: checkedLines };
}

/**
 * Create: the header is judged as the **whole record**. Not one required field may be missing.
 *
 * "Required" in this repo means **required the moment it is stored**, and a draft is not an exception — `required` is compiled into a NOT NULL column
 * (`builder/codegen.ts`). A field that may be missing on a draft and required on submit is expressed as not required, plus
 * a `required_fields` precondition on that edge. Each tier has its own exit. required does not need to become
 * "the moment it takes effect depends on status" (that is the job of preconditions, and mixing the two concepts makes them fight).
 */
export function checkNewBill(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows,
): BillCheck {
  return checkBill(schema, header, lines, "whole");
}

/** Planner-generated bill: also accept plannerSupplied fields, and still reuse the same type and enum value gate. */
export function checkGeneratedBill(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: LineRows,
): BillCheck {
  return checkBill(schema, header, lines, "whole", "planner");
}

/**
 * The server writes system-generated header facts (`isGeneratedHeaderField`): keys accept only that class, and values use the same value gate as a manual write.
 *
 * Writing any other cell is a caller bug, and it throws. A manual write's `checkBillPatch` does not accept this class. The two do not interchange.
 */
export function checkGeneratedHeader(
  schema: ModuleSchema,
  patch: Readonly<Record<string, unknown>>,
): BillCheck {
  const sink: Sink = { issues: [] };
  const header: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(patch)) {
    const field = schema.fields.find((candidate) => candidate.key === key);
    if (field === undefined || !isGeneratedHeaderField(field)) {
      schemaFail(`module "${schema.code}" field "${key}" is not a system-generated header field, so a system write does not accept it`);
    }
    const value = blankNormalized(field, raw);
    if (isEmptyValue(value)) {
      if (field.required) report(sink, key, field.label, "REQUIRED_BLANK", `"${field.label}" is required`);
      else header[key] = null;
      continue;
    }
    const checked = checkValue(field, value, key, field.label, sink);
    if (checked !== undefined) header[key] = checked;
  }
  if (sink.issues.length) return { ok: false, issues: sink.issues };
  return { ok: true, header, lines: {} };
}

/**
 * Save: the header is judged as a **patch** — a key that did not appear was not touched, not left unfilled.
 *
 * Appearing but empty **still** fails required: that is "clear a value that was already there", and it does not hold any more than never filling it.
 *
 * `lines` null means only the header changes, and not one line is touched.
 */
export function checkBillPatch(
  schema: ModuleSchema,
  patch: Readonly<Record<string, unknown>>,
  lines: LineRows | null,
): BillCheck {
  return checkBill(schema, patch, lines, "patch");
}

/**
 * Every reference coordinate this write touches: the `ref` / `refLine` fields that have a value.
 *
 * For the server's existence check — **the kernel does not query the database, but "which ones to check" is derived from the declaration**,
 * so this list lives in the kernel. If the server scans fields itself, it will scan the header and forget the lines
 * (or the reverse). That is inevitable, and the missed half shows up as a dangling reference stored as if nothing were wrong.
 *
 * `refLine` is collected too. Collecting only `ref` is not allowed. They are the **same class** of bug (a reference pointing at something that does not exist).
 * The only difference is which table is queried. Missing the line half looks like this: the day the first `refLine` field lands,
 * a dangling line reference passes in silence, and the whole reason for this layer is to eliminate that shape.
 */
export interface RefSite {
  /** Module code being referenced. */
  readonly entity: string;
  /**
   * `null` points at the **header** of `entity` (`ref`).
   * Non-null points at **one row** of that line table under `entity` (`refLine`; the value comes from the declared `through`).
   *
   * This dimension cannot be dropped. Both are text columns and both can join to a row. Querying the wrong table does not throw.
   * It only hits a row that happens to share the id in the other table. In practice that is a miss, so good data is judged dangling.
   */
  readonly through: string | null;
  readonly id: string;
  readonly path: string;
  readonly label: string;
  /**
   * When this coordinate is a `refLine`, which cell the resolved upstream `bill_id` should be written back to.
   *
   * `null` is an ordinary ref. Non-null is the companion header ref. Projecting the coordinate from the declaration
   * means the server does not scan the fields again and does not parse the human path string.
   */
  readonly companion: {
    readonly table: string;
    readonly row: number;
    readonly field: string;
  } | null;
  /**
   * The candidate filter for this cell, **already evaluated against this document's current values**.
   *
   * It uses the **same** `resolveRefFilter` as the candidate side (`refOptions` / the picker),
   * not two copies of the same SQL. The rule that the candidate scope and refOptions match word for word
   * therefore does not depend on discipline on this axis: there is one criterion, and both sides only compile it into their own where.
   *
   * A non-empty `pending` means a cell the filter depends on is not filled in yet. **The write side must reject it.** Letting it through quietly widens
   * "production tasks of this order" into "any production task", and that happens only when that cell happens to be empty.
   *
   * "Not filled in" has two kinds, see `filterAwaits` below. A cell the user should fill is one thing.
   * A cell the system fills later in this same write, and that is still empty right now, is another.
   */
  readonly filter: RefFilterResolution;
  /**
   * This cell's candidate filter **depends on a value this write fills in later** — and the coordinates needed to recompute it.
   *
   * It exists because of a deadlock that is **structurally unsolvable** (first observed while entering a production release):
   * the candidates of `lines.bomId` are narrowed by `$line.productId`, and `productId` is a `snapshot` frozen from the source order line
   * (system-supplied, and the write gate forbids the client to write it). If the write path judges the candidate filter **before**
   * reference resolution, that cell is always empty, so it is always `REF_FILTER_PENDING` "please fill it first" —
   * and the user interface has no such input, so it can never be filled. Both roads are blocked, and the whole module cannot create a bill.
   *
   * The criterion is the kernel's one `isRefResolvedField` (the same axis as the two-hop classification `refSupplyOf`),
   * not each consumer writing its own "what system-supplied means". `null` means the `filter` in hand is already the final conclusion
   * (no filter was declared, or every operand in `pending` is a cell the user should fill — that tier is still rejected,
   * and it is correct that `productionTask.bomId` depends on the `productId` the user chose).
   *
   * **It is a static property of this coordinate, not a "not finished computing" flag**: `recheckRefSiteFilters`
   * only replaces `filter`, and this cell stays as it is. The write side uses it to split the wording of `pending` into two sentences —
   * "you have not filled it" and "the upstream did not freeze a value" point at completely different next steps. Collapsed into one sentence,
   * a user with no input box is repeatedly told to fill a cell they cannot fill.
   */
  readonly filterAwaits: {
    /** The original declaration. Recomputation still goes through `resolveRefFilter` (the one shared by the candidate side and the write side). Only the evaluation context changes */
    readonly declared: RefFilter;
    /** Which row to look at when evaluating a `$line.` operand. `null` means a header field (the operand can only be `$bill.`) */
    readonly table: string | null;
    readonly row: number | null;
    /** Operands in `pending` that the system will fill in, kept as `$bill.x` / `$line.x`. */
    readonly operands: readonly string[];
    /** Fields of this layer used to fill `via.entity` when closing a row after recomputation. The same copy as the first `bindRefFilterViaEntities` */
    readonly headerFields: readonly Field[];
    readonly lineFields: readonly Field[] | null;
  } | null;
  /** Fields this same reference query must freeze back. The source and the reference existence check share one query result. */
  readonly snapshots: readonly {
    readonly sourceField: string;
    readonly target: {
      readonly table: string | null;
      readonly row: number | null;
      readonly field: string;
      readonly path: string;
      readonly label: string;
    };
  }[];
  /** Overridable defaults this same reference should provide. Applied only when the target is currently empty */
  readonly defaults: readonly {
    readonly sourceField: string;
    readonly target: {
      readonly table: string | null;
      readonly row: number | null;
      readonly field: string;
      readonly path: string;
      readonly label: string;
    };
  }[];
}

/**
 * Which operands in `pending` point at cells **this write fills in later** (snapshot / the `refLine` companion column).
 *
 * When that cell cannot be found, treat it as "the user did not fill it in", **not** as "the system will fill it". The difference is fail-open versus
 * fail-closed. Judging it "will be filled" waits forever for a field that does not exist, and the wait shows up as the candidate filter
 * quietly stopping (`pending` is swallowed). Judging it "not filled in" still raises `REF_FILTER_PENDING`.
 * A bad declaration is already gated (`checkCrossReferences` checks both coordinates at build time). This layer does not paper over that.
 */
function awaitedFilterOperands(
  pending: readonly string[],
  headerFields: readonly Field[],
  layerFields: readonly Field[],
): readonly string[] {
  return pending.filter((from) => {
    // The prefix is closed to `$bill.` / `$line.` (`normalizeRefFilter` already checked the shape),
    // so this only chooses the layer: `$line.` reads this layer's columns, everything else reads the header.
    const layer = from.startsWith("$line.") ? layerFields : headerFields;
    const key = from.slice(from.indexOf(".") + 1);
    const operand = layer.find((candidate) => candidate.key === key);
    return operand !== undefined && isRefResolvedField(operand, layer);
  });
}

export function refSitesOf(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  /**
   * Evaluation context for `$bill.` operands in `refFilter`. **The default is `header` itself** (on create,
   * the header passed in is the whole document).
   *
   * On save (patch) the caller must pass **the stored header plus this patch**.
   * Using only the patch was observed: a material issue already has `productionOrderId` stored,
   * and changing only `productionTaskId` makes `refFilter: { from: "$bill.productionOrderId" }`
   * miss the operand and return `REF_FILTER_PENDING` ("that cell has no value — fill it first") —
   * while that cell **has a value**. The sentence sends the person to change a field that is already filled, and it fights the patch meaning
   * ("a key that did not appear was not touched"). Following the error's own advice, "a patch should carry only the writable keys being changed",
   * then hits this gate.
   *
   * **It applies only to operands, not to "which coordinates to check".** The site set still looks only at `header`
   * (the cells this write actually sent). Merging it into the site set would run every stored reference on the document
   * through the candidate filter again. A reference that was legal yesterday and excluded today would make
   * an unrelated save fail. That is what "the filter applies when searching candidates, not when loading a label by id" is there to prevent.
   *
   * After the merge, a value that still cannot be read is still rejected as `REF_FILTER_PENDING`. The reason that tier exists
   * (the upstream is not filled in, so the candidates cannot be computed) is unchanged. This only changes what "not filled in" means.
   */
  filterHeader: Readonly<Record<string, unknown>> = header,
): readonly RefSite[] {
  const out: RefSite[] = [];
  const collect = (
    fields: readonly Field[],
    values: Readonly<Record<string, unknown>>,
    pathOf: (key: string) => string,
    labelOf: (field: Field) => string,
    companionOf: (field: Field) => RefSite["companion"],
    snapshotsOf: (field: Field) => RefSite["snapshots"],
    defaultsOf: (field: Field) => RefSite["defaults"],
    /** Line columns pass this row's values (the `$line.` context). The header passes null. */
    rowValues: Readonly<Record<string, unknown>> | null,
    /** Where this layer sits on the document. Used only by `filterAwaits`: recomputing the filter must see the row **after** it is filled in. */
    at: { readonly table: string | null; readonly row: number | null },
  ): void => {
    for (const field of fields) {
      // This collects the **user input** tier. The criterion is `refSupplyOf` (the kernel's only definition of when a value appears).
      // It used to be `fillable(fields)` plus a type check, with the same result per field. The tier split exists so
      // the second hop (`chainedRefSitesOf` collects the `resolved` tier) **reads the same definition** —
      // two implicit definitions of "arrives late" were the source of the accounts-payable 500.
      if (refSupplyOf(field, fields)?.stage !== "input") continue;
      const value = values[field.key];
      if (typeof value !== "string" || !value) continue;
      const entity =
        field.ref ?? schemaFail(`field "${field.key}" is ${field.type} but has no ref target — the declaration gate should already have rejected this`);
      // A refLine `through` is required by the declaration layer. Without it there is no line table to query.
      const through =
        field.type === "ref"
          ? null
          : (field.through ?? schemaFail(`field "${field.key}" is refLine but has no through — the declaration gate should already have rejected this`));
      const defaults = defaultsOf(field);
      const declared = field.refFilter;
      // Operands use `filterHeader` (on create that is the header; on save it is the stored header plus the patch).
      // The site set still looks only at `values`. The two sources are different on purpose. See the note on `filterHeader`.
      const filter = bindRefFilterViaEntities(
        schema.fields,
        rowValues === null ? null : fields,
        resolveRefFilter(declared, filterHeader, rowValues),
      );
      // "Cannot read a value" has two kinds: a cell the user should fill is empty (still rejected), and a cell this write fills later
      // is still empty right now (wait). The criterion is the kernel's `isRefResolvedField`. See `filterAwaits`.
      const awaited =
        declared === null ? [] : awaitedFilterOperands(filter.pending, schema.fields, fields);
      out.push({
        entity,
        through,
        id: value,
        path: pathOf(field.key),
        label: labelOf(field),
        companion: companionOf(field),
        filter,
        filterAwaits:
          declared === null || awaited.length === 0
            ? null
            : {
                declared,
                table: at.table,
                row: at.row,
                operands: awaited,
                headerFields: schema.fields,
                lineFields: rowValues === null ? null : fields,
              },
        snapshots: snapshotsOf(field),
        defaults,
      });
    }
  };

  collect(
    schema.fields,
    header,
    (key) => key,
    (field) => field.label,
    () => null,
    (field) =>
      schema.fields
        .filter((candidate) => candidate.snapshot?.match === field.key)
        .map((candidate) => ({
          sourceField: candidate.snapshot?.field ?? schemaFail(`field "${candidate.key}" snapshot is missing its declaration`),
          target: {
            table: null,
            row: null,
            field: candidate.key,
            path: candidate.key,
            label: candidate.label,
          },
        })),
    (field) =>
      schema.fields
        .filter((candidate) => candidate.refDefault?.match === field.key && isEmptyValue(header[candidate.key]))
        .map((candidate) => ({
          sourceField: candidate.refDefault?.field ?? schemaFail(`field "${candidate.key}" refDefault is missing its declaration`),
          target: {
            table: null,
            row: null,
            field: candidate.key,
            path: candidate.key,
            label: candidate.label,
          },
        })),
    null,
    { table: null, row: null },
  );
  for (const [key, rows] of Object.entries(lines)) {
    const table = schema.fields.find((f) => f.key === key && f.type === "subtable");
    if (!table?.fields) continue;
    const companions = new Map(refLinePairs(table.fields).map((pair) => [pair.line.key, pair.bill.key]));
    for (const [index, row] of rows.entries()) {
      collect(
        table.fields,
        row,
        (k) => lineIssuePath(key, index, k),
        (f) => lineIssueLabel(table.label, index, f.label),
        (field) => {
          if (field.type !== "refLine") return null;
          const companion = companions.get(field.key);
          if (!companion) {
            return schemaFail(`line reference "${field.key}" has no companion header reference — the declaration gate should already have rejected this`);
          }
          return { table: key, row: index, field: companion };
        },
        (field) =>
          (table.fields ?? [])
            .filter((candidate) => candidate.snapshot?.match === field.key)
            .map((candidate) => ({
              sourceField: candidate.snapshot?.field ?? schemaFail(`field "${candidate.key}" snapshot is missing its declaration`),
              target: {
                table: key,
                row: index,
                field: candidate.key,
                path: lineIssuePath(key, index, candidate.key),
                label: lineIssueLabel(table.label, index, candidate.label),
              },
            })),
        (field) =>
          (table.fields ?? [])
            .filter((candidate) => candidate.refDefault?.match === field.key && isEmptyValue(row[candidate.key]))
            .map((candidate) => ({
              sourceField: candidate.refDefault?.field ?? schemaFail(`field "${candidate.key}" refDefault is missing its declaration`),
              target: {
                table: key,
                row: index,
                field: candidate.key,
                path: lineIssuePath(key, index, candidate.key),
                label: lineIssueLabel(table.label, index, candidate.label),
              },
            })),
        row,
        { table: key, row: index },
      );
    }
  }
  return out;
}

/**
 * Recompute the candidate filter for coordinates that wait on a system-supplied value, using the header and lines **after** they are filled in.
 *
 * The criterion is still the same `resolveRefFilter` — the candidate side (`refOptions` / the picker) and the write side
 * share **that one** pure function. Only the evaluation context changes (after the first hop writes snapshot values and
 * the `refLine` companion column back onto the row). There is no second criterion and no second where.
 * Two copies of the same SQL are what this capability exists to eliminate.
 *
 * **`filterAwaits` stays. It is not cleared.** It is a static property of the coordinate ("this cell's candidates
 * depend on a system-supplied value"), not a "not finished computing" flag. The write side uses it to split `pending` into
 * two sentences. A value that still cannot be read after recomputation means the upstream cell was empty (legal: the source is optional and
 * froze to null). Telling the user to "fill it first" is an instruction they cannot carry out.
 *
 * A coordinate with `filterAwaits === null` is returned unchanged: its `filter` was already final on the first hop.
 */
export function recheckRefSiteFilters(
  sites: readonly RefSite[],
  /** Context for `$bill.` operands. On save this is also the stored header plus the header resolved so far. */
  filterHeader: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): readonly RefSite[] {
  return sites.map((site) => {
    const awaits = site.filterAwaits;
    if (awaits === null) return site;
    const rowValues =
      awaits.table === null
        ? null
        : (lines[awaits.table]?.[awaits.row ?? -1] ??
          schemaFail(
            `recomputing the candidate filter: coordinate "${site.path}" has no line ${awaits.table}[${String(awaits.row)}] — ` +
              `refSitesOf does not match the resolved line order`,
          ));
    return {
      ...site,
      filter: bindRefFilterViaEntities(
        awaits.headerFields,
        awaits.lineFields,
        resolveRefFilter(awaits.declared, filterHeader, rowValues),
      ),
    };
  });
}

/**
 * Which cells in this write **the server should fill with one default reference** (`Field.refPreselect`).
 *
 * It complements `refSitesOf`. That list collects references **that have a value** (to check they exist).
 * This list collects references **that are empty and declare a default** (to pick one and fill it in).
 * Both live in the kernel for the same reason: which coordinates to check is derived from the declaration.
 * If the server scans fields itself it will eventually miss the header or the lines, and the missed half has no symptom (the cell is simply not filled automatically).
 *
 * Three filters, each blocking one class of mistake:
 *   · **A cell that already has a value stays out** (`isEmptyValue`). A default is a starting value, not an overwrite.
 *     Letting it in would replace the record the user just chose.
 *   · **A pending candidate set stays out.** Until the upstream cell is filled, "the default BOM of this product" has nothing to point at.
 *     Picking any row then is a guess. Leaving it empty is not fail-open: the cell's own required check still applies later.
 *   · The condition is **one evaluation** of `refFilter` plus `refPreselect` (`resolveRefPreselect`),
 *     not one list for candidates and another for the default. Two lists drifting means a record the dropdown cannot offer is filled in automatically.
 *
 * **`conditions` says which rows to choose among, not which row to pick.** "Fill only when there is exactly one" is applied by the consumer
 * counting rows (the server). This layer does not sort and does not take the first row. Sorting means a different data set gives the same document
 * a different answer, and both answers are legal references, so nothing can say which one is wrong.
 */
export interface RefPreselectSite {
  /** Which module the candidates come from. */
  readonly entity: string;
  /** Candidate set plus default conditions, already evaluated against this document. This is what is compiled into the where. */
  readonly conditions: readonly RefFilterCondition[];
  /** Which cell the chosen id is written back to. `table === null` means the header. */
  readonly target: {
    readonly table: string | null;
    readonly row: number | null;
    readonly field: string;
    readonly path: string;
    readonly label: string;
  };
}

export function refPreselectSitesOf(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): readonly RefPreselectSite[] {
  const out: RefPreselectSite[] = [];
  const collect = (
    fields: readonly Field[],
    values: Readonly<Record<string, unknown>>,
    rowValues: Readonly<Record<string, unknown>> | null,
    table: string | null,
    row: number | null,
    pathOf: (key: string) => string,
    labelOf: (field: Field) => string,
  ): void => {
    for (const field of fillable(fields)) {
      if (field.type !== "ref" || (field.refPreselect === null && !field.refPreselectSole)) continue;
      if (!isEmptyValue(values[field.key])) continue;
      const resolved = resolveRefPreselect(
        field.refFilter,
        field.refPreselect,
        field.refPreselectSole,
        header,
        rowValues,
      );
      if (resolved === null || resolved.pending.length > 0) continue;
      const entity =
        field.ref ?? schemaFail(`field "${field.key}" is a ref but has no ref target — the declaration gate should already have rejected this`);
      out.push({
        entity,
        conditions: resolved.conditions,
        target: { table, row, field: field.key, path: pathOf(field.key), label: labelOf(field) },
      });
    }
  };

  collect(schema.fields, header, null, null, null, (key) => key, (field) => field.label);
  for (const [key, rows] of Object.entries(lines)) {
    const table = schema.fields.find((f) => f.key === key && f.type === "subtable");
    if (!table?.fields) continue;
    for (const [index, row] of rows.entries()) {
      collect(
        table.fields,
        row,
        row,
        key,
        index,
        (k) => lineIssuePath(key, index, k),
        (field) => lineIssueLabel(table.label, index, field.label),
      );
    }
  }
  return out;
}

/**
 * Coordinates to look up when a second-stage consumer uses a ref that **only appears during the first hop**.
 *
 * `refSitesOf` collects only the `input` tier (the value is in the write body). A system-supplied ref is not in the write body.
 * It appears on the resolved row only after the first hop's `applySites`. This list collects that tier
 * (`resolved` in `refSupplyOf`). The criterion is the kernel's. **This function does not define "arrives late" itself.**
 *
 * Both sources are in the `resolved` tier, and both exist in this repo:
 *   · `via: "chain"`     settlement line `operationId` comes from the work report, and `pieceRate` comes from `operationId`;
 *   · `via: "companion"` the payable reconciliation line `receiptId` (the header companion of `receiptLineId`)
 *                        is filled by the first hop's join, and `documentNo` / `businessDate` come from `receiptId`.
 * The second used to fall through the gap. The old entry condition was "this field is also a snapshot", which a companion column does not meet,
 * so those two columns stayed empty until PG's NOT NULL, and save became a 500. The same class showed up a second time,
 * so the criterion moved up into the one `refSupplyOf` (the same class appearing twice or more should move up).
 *
 * `unitChoice.match` is another consumer of the same stage. The source coordinate first snapshots `productId`, then must
 * query product.unitSet, freeze unit and factor, then calculate baseQty. If this only accepts snapshot dependents,
 * a productId with no second snapshot is skipped and calculate always sees an empty factor. The storage layer must not fill
 * `factor = 1`. That would post an auxiliary unit as if it were the main unit. That product ref must take the same second-hop query.
 *
 * Only **one** hop is recognized. There is no third hop. `refSupplyOf` judges "a value that needs a third hop" as `unreachable`,
 * and the modeling gate `SNAPSHOT_MATCH_UNRESOLVED` rejects it at modeling time. There is no path that explodes only at runtime.
 * `already` is the paths the first hop already queried, so the same cell is not queried again.
 *
 * **No `refFilter`** (`EMPTY_REF_FILTER_RESOLUTION`). That is intentional.
 * A candidate filter says which rows this cell can **choose**. A user cannot choose this tier's value. The server
 * computes it from the upstream row's `bill_id` or the previous hop's snapshot. Returning
 * `REF_FILTER_MISMATCH` ("please pick another") for a cell the user cannot touch points at a dropdown that is not on the screen.
 * This cell's legality is guarded by **its source**. A companion column is guarded by the first hop's refLine existence plus `moduleScopedWhere`.
 * A chained column is guarded by the previous hop's candidate filter.
 */
export function chainedRefSitesOf(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  already: ReadonlySet<string>,
): readonly RefSite[] {
  const out: RefSite[] = [];
  const collect = (
    fields: readonly Field[],
    values: Readonly<Record<string, unknown>>,
    pathOf: (key: string) => string,
    labelOf: (field: Field) => string,
    targetTable: string | null,
    targetRow: number | null,
    rowLabelPrefix: string,
  ): void => {
    for (const field of fields) {
      const supply = refSupplyOf(field, fields);
      if (supply?.stage !== "resolved") continue;
      if (field.type !== "ref") {
        // The `resolved` tier can only be a ref today (`refSupplyOf` judges a system-supplied refLine as
        // `unreachable`). Reaching here means the tier split and this function's query shape have drifted.
        // Skipping in silence leaves those cells empty forever, which is what this capability exists to eliminate.
        schemaFail(`field "${field.key}" is ${field.type} but landed on the second hop — the second hop looks up a header by document id only`);
      }
      const dependents = fields.filter((candidate) => candidate.snapshot?.match === field.key);
      const suppliesUnitChoice = fields.some((candidate) => candidate.unitChoice?.match === field.key);
      if (dependents.length === 0 && !suppliesUnitChoice) continue;
      const value = values[field.key];
      if (typeof value !== "string" || !value) continue;
      const path = pathOf(field.key);
      if (already.has(path)) continue;
      const entity =
        field.ref ?? schemaFail(`field "${field.key}" is a ref but has no ref target — the declaration gate should already have rejected this`);
      out.push({
        entity,
        through: null,
        id: value,
        path,
        label: labelOf(field),
        companion: null,
        filter: EMPTY_REF_FILTER_RESOLUTION,
        // No filter means there is nobody to wait on (see above: the user cannot choose this tier's value).
        filterAwaits: null,
        snapshots: dependents.map((candidate) => ({
          sourceField: candidate.snapshot?.field ?? schemaFail(`field "${candidate.key}" snapshot is missing its declaration`),
          target: {
            table: targetTable,
            row: targetRow,
            field: candidate.key,
            path: targetTable === null ? candidate.key : `${targetTable}[${String(targetRow)}].${candidate.key}`,
            label: rowLabelPrefix === "" ? candidate.label : `${rowLabelPrefix} · ${candidate.label}`,
          },
        })),
        // This function only carries system-supplied refs of the second stage. A refDefault chain is not expanded here.
        // The second hop starts from a **system-supplied** ref. The user cannot put that cell
        // in the write body, and `refDefault` means "a starting value filled only when the user left it empty".
        // On a chain the user cannot touch, that has nothing to point at.
        // To let refDefault follow the chain, `dependents` above must first recognize `refDefault?.match`.
        // That is a separate decision (it changes when the second hop is evaluated) and should not be slipped in here.
        defaults: [],
      });
    }
  };

  collect(schema.fields, header, (key) => key, (field) => field.label, null, null, "");
  for (const [key, rows] of Object.entries(lines)) {
    const table = schema.fields.find((f) => f.key === key && f.type === "subtable");
    if (!table?.fields) continue;
    for (const [index, row] of rows.entries()) {
      const rowLabel = lineIssueRowLabel(table.label, index);
      collect(
        table.fields,
        row,
        (k) => lineIssuePath(key, index, k),
        (f) => lineIssueLabel(table.label, index, f.label),
        key,
        index,
        rowLabel,
      );
    }
  }
  return out;
}

/**
 * Every unique coordinate this write touches: fields marked `unique` that actually carry a value this time.
 *
 * It has the **same shape** as `refSitesOf`, on purpose. They are two halves of one pattern. The kernel does no IO and cannot judge
 * "whether it is already stored", but "which ones to check" is **derived from the declaration**, so the list lives in the kernel. If the server scans fields itself,
 * adding a unique field and missing the scan means that field's duplicate check **quietly does not run**:
 * a duplicate still returns 201, until someone asks why two products share a barcode.
 *
 * **Skip empty values**, for the same reason as NULLS DISTINCT on the table. "No barcode" is legal.
 * A batch of products with no barcode must all be storable. The value gate already turns an empty string into null (see the file header), so emptiness here
 * uses the same `isEmptyValue`. The two must be one definition, or the duplicate check and the index will disagree.
 *
 * **Header only.** A line column may not be unique (`FIELD_UNIQUE_ON_LINE`: uniqueness has two readings,
 * and only the one that can be stated is supported). Hitting one here fails fast. If the gate were bypassed, the substitute shape would be
 * "declared, but never checked": a constraint the modeler believes exists does not.
 *
 * Patch (save) is naturally correct. A key absent from the patch is absent from `header`, so it is not checked.
 * That value did not change, and the stored row already satisfies uniqueness.
 */
export interface UniqueSite {
  /** Field key (the source of the header column name; for a composite unique, the cell that declares `unique`). */
  readonly key: string;
  /** Machine path, the same shape as `BillIssue.path`. */
  readonly path: string;
  /** Label shown to a person. */
  readonly label: string;
  /** Normalized value. Empty values do not appear here. */
  readonly value: unknown;
  /**
   * Companion columns of a composite unique (`uniqueWith`). An empty array means a single-column unique.
   * The duplicate check and the table index both compare this field plus these columns.
   */
  readonly with: readonly { readonly key: string; readonly value: unknown; readonly label: string }[];
}

export function uniqueSitesOf(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
): readonly UniqueSite[] {
  for (const table of schema.fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    for (const column of table.fields) {
      if (column.unique) {
        schemaFail(`line column "${table.key}.${column.key}" is marked unique — the declaration gate should already have rejected this`);
      }
    }
  }

  const byKey = new Map(schema.fields.map((f) => [f.key, f]));
  const out: UniqueSite[] = [];
  for (const field of uniqueFieldsOf(schema.fields)) {
    if (!Object.hasOwn(header, field.key)) continue;
    const value = header[field.key];
    if (isEmptyValue(value)) continue;
    const peers: { key: string; value: unknown; label: string }[] = [];
    let peersReady = true;
    for (const peerKey of field.uniqueWith ?? []) {
      // A companion column is absent from this write (the patch did not touch it) or empty: the composite coordinate is incomplete, so this site is skipped.
      // Same shape as "an empty value does not take part" for a single column. Missing one dimension means there is no unique key to check.
      if (!Object.hasOwn(header, peerKey)) {
        peersReady = false;
        break;
      }
      const peerValue = header[peerKey];
      if (isEmptyValue(peerValue)) {
        peersReady = false;
        break;
      }
      const peerField = byKey.get(peerKey);
      if (!peerField) schemaFail(`uniqueWith "${peerKey}" does not name a field — the declaration gate should already have rejected this`);
      peers.push({ key: peerKey, value: peerValue, label: peerField.label });
    }
    if (!peersReady) continue;
    out.push({ key: field.key, path: field.key, label: field.label, value, with: peers });
  }
  return out;
}

/**
 * Every coordinate in the declaration **that carries an attachment**: header attachment fields plus each line table's attachment columns.
 *
 * The split with `attachmentSitesOf` is declaration versus value. This list only asks which cells the declaration says should exist
 * (independent of whether there is data). The other asks, on top of that, what those cells contain in the values brought in this time.
 * `attachmentSitesOf` consumes it directly, so **which coordinates carry an attachment is judged in exactly one place**.
 *
 * Two consumers. Missing one coordinate fails in opposite directions, and both failures have no symptom:
 *   · The write path (`attachmentSitesOf` → `assertAttachmentsOwned`) missing it lets another tenant's object key
 *     into the document, and later a document the caller may read downloads someone else's file.
 *   · The reaper (the server's `reapAttachments.ts` scans the database for orphans) missing it treats an attachment **that is still referenced**
 *     as an orphan and deletes it, and no layer reports the deletion.
 * The second must not be a hand-written module list on the server. That list will not fail when the next module declares an attachment.
 */
export interface AttachmentColumn {
  /** The line table's field key for a line column, or `null` for the header. */
  readonly table: string | null;
  /** Field key of the column that carries the attachment (the source of that column when the table is built). */
  readonly key: string;
  /**
   * Field coordinate. The same text the upload endpoint uses in the object key, and the same `field` argument
   * `resolveAttachmentField` receives. A header is `contract`. A line column is `lines.photos`.
   *
   * No row index. Lines are replaced as a whole table (`save` deletes and inserts again), so a stored row index is meaningless at once.
   */
  readonly path: string;
  /** Label shown to a person. A line column reads "lines · report photos", the same shape as `resolveAttachmentField`. */
  readonly label: string;
}

export function attachmentColumnsOf(schema: ModuleSchema): readonly AttachmentColumn[] {
  const out: AttachmentColumn[] = [];
  for (const field of fillable(schema.fields)) {
    if (field.type !== "attachment") continue;
    out.push({ table: null, key: field.key, path: field.key, label: field.label });
  }
  // Lines are a separate pass. `fillable` drops the subtable itself (it has no column). The column declaration is one level down.
  for (const table of schema.fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    for (const field of fillable(table.fields)) {
      if (field.type !== "attachment") continue;
      out.push({
        table: table.key,
        key: field.key,
        path: `${table.key}.${field.key}`,
        label: `${table.label} · ${field.label}`,
      });
    }
  }
  return out;
}

/**
 * Every attachment coordinate this write touches: `attachment` fields that actually carry a value this time.
 *
 * The **same shape** as `refSitesOf` and `uniqueSitesOf`, the third half of the same pattern.
 * The kernel does no IO and has no identity, so it cannot judge which tenant an object key belongs to. But which coordinates to check
 * is **derived from the declaration**, so the list lives in the kernel (`attachmentColumnsOf`, which this function consumes).
 * If the server scans fields itself, it will scan the header and forget the lines, or the reverse. That will happen.
 * The missed half means a client can write another tenant's object key into the document
 * and later download that file through a document it is allowed to read. No layer reports it.
 *
 * Both header and lines are collected. Missing the line half of `ref` leaves a dangling reference. Missing it here lets a file be read without permission.
 */
export interface AttachmentSite {
  /** Machine path, the same shape as `BillIssue.path`: `"contract"` / `"lines[0].photos"`. */
  readonly path: string;
  /** Label shown to a person. */
  readonly label: string;
  /** Normalized attachments. The value gate has already run, and the shape holds. */
  readonly refs: readonly AttachmentRef[];
}

export function attachmentSitesOf(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): readonly AttachmentSite[] {
  const out: AttachmentSite[] = [];
  const collect = (value: unknown, columnKey: string, path: string, label: string): void => {
    if (value === null || value === undefined) return;
    const checked = checkAttachmentValue(value);
    // The value gate already ran. An ill-formed shape here means the call order changed. Do not skip it in silence.
    // Skipping means this cell's tenant check does not run, which is the shape this function exists to eliminate.
    if (!checked.ok) {
      schemaFail(`field "${columnKey}" attachment value is not well formed (${checked.reason}) — the value gate should already have rejected this`);
    }
    if (checked.value.length === 0) return;
    out.push({ path, label, refs: checked.value });
  };

  for (const column of attachmentColumnsOf(schema)) {
    if (column.table === null) {
      collect(header[column.key], column.key, column.path, column.label);
      continue;
    }
    const rows = lines[column.table];
    if (rows === undefined) continue;
    const table = schema.fields.find((f) => f.key === column.table && f.type === "subtable");
    // The coordinate is derived from the declaration, so the line table can be found. Not finding it means the call order changed.
    if (!table) schemaFail(`line table "${column.table}" is not in the declaration — attachmentColumnsOf just derived this coordinate from it`);
    const fieldLabel = table.fields?.find((f) => f.key === column.key)?.label ?? column.key;
    for (const [index, row] of rows.entries()) {
      collect(
        row[column.key],
        column.key,
        lineIssuePath(column.table, index, column.key),
        lineIssueLabel(table.label, index, fieldLabel),
      );
    }
  }
  return out;
}
