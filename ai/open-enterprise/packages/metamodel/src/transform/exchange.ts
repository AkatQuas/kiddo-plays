// ---------------------------------------------------------------------------
// Import / export — "which columns, what they are called, how a value is written into a cell / read back"
//
// This file is the **rule**, not the format: it does not know CSV, Excel, or HTTP.
// The concrete encoding is `packages/server/src/runtime/csv.ts`; the day this becomes xlsx, that is the file to replace.
// The cut exists because this repo already hit this class of problem: once the rule follows the format,
// "exported columns" and "list-page columns" become two declarations, one side changes and the other does not follow, and neither side errors.
//
// **Do not open a new declaration slot.** Exported columns = the `views.list` set (through `resolveListColumns`,
// the same source as the list page, character for character); imported columns = "fields the user can fill" on this module, also derived.
// Making "which columns export shows" a new schema key would add a concept and have to pass the `MODULE_KEYS` rule,
// while `views.list` is already the source of truth for "how this module is presented" — the same rule as `ReferencePicker`.
// ---------------------------------------------------------------------------

import { isEmptyValue, isSystemSupplied, type Field } from "../schema/fields.js";
import type { ModuleSchema } from "../schema/module.js";
import { PLATFORM_QUERY_FIELDS } from "../normalize/query.js";
import { resolveRefFilter, type RefFilterCondition } from "../normalize/refFilter.js";

/**
 * One column of an exchange file.
 *
 * `path` is the field coordinate (`code` / `lines.qty`), and `label` is the **display header**.
 * Both are required: a person reads the label, the machine recognizes the path, and on import only the label is available.
 */
export interface ExchangeColumn {
  readonly path: string;
  readonly label: string;
  /**
   * An ordinary column is only value; a choiceSet field expands into code + choiceLabel columns.
   * The two columns share a path. The caller uses kind to implement "import prefers code, and a unique current name is compatible".
   */
  readonly kind: "value" | "choiceCode" | "choiceLabel";
  /** A platform field (status / audit) has no `Field`; the value becomes text as-is. */
  readonly field: Field | null;
}

function columnsForField(path: string, field: Field): readonly ExchangeColumn[] {
  if (field.choiceSet === null) return [{ path, label: field.label, kind: "value", field }];
  return [
    { path, label: `${field.label} code`, kind: "choiceCode", field },
    { path, label: `${field.label} name`, kind: "choiceLabel", field },
  ];
}

/**
 * Display name of a platform field.
 *
 * Take the `PLATFORM_QUERY_FIELDS` list and **do not copy a table here**. It is already the
 * only source of truth for "what a user-visible platform field is called" (filters / agent / list column settings share it);
 * a copy would mean that one day the display name of `updatedAt` changes while the exported header stays old, and neither side errors.
 * Consequence: `id` / `tenantId` / `orgId` are naturally absent — they are plumbing, not business UI, and not export.
 */
function platformLabel(path: string): string | null {
  return PLATFORM_QUERY_FIELDS.find((p) => p.key === path)?.label ?? null;
}

/** Look up a header-layer field by key; an `a.b` shape drills one level into a line column (lines have only one level; see AGENTS.md). */
function fieldAt(schema: ModuleSchema, path: string): Field | null {
  const parts = path.split(".");
  const top = schema.fields.find((f) => f.key === parts[0]);
  if (!top) return null;
  if (parts.length === 1) return top;
  if (parts.length !== 2 || top.type !== "subtable" || !top.fields) return null;
  return top.fields.find((f) => f.key === parts[1]) ?? null;
}

/**
 * Which columns to export.
 *
 * `visible` is exactly the columns the list page is showing right now (the `field` of
 * `resolveListColumns(...).columns`), so "what you see is what you get" is a structural result, not a coincidence of two maintained lists.
 *
 * `canExpose` is injected by the caller (the server passes `authorizer.canExposeField`) — the kernel is zero IO
 * and does not know identity. This parameter is **required and has no default**: a default of "everything visible"
 * would let a caller who forgot to pass it export an over-privileged file that looks completely normal.
 */
export function exportColumnsOf(
  schema: ModuleSchema,
  visible: readonly string[],
  canExpose: (path: string) => boolean,
): readonly ExchangeColumn[] {
  const out: ExchangeColumn[] = [];
  for (const path of visible) {
    if (!canExpose(path)) continue;
    const platform = platformLabel(path);
    if (platform !== null) {
      out.push({ path, label: platform, kind: "value", field: null });
      continue;
    }
    const field = fieldAt(schema, path);
    // A name in the list columns that the module does not have means this SavedView drifted from the schema.
    // Skip rather than throw: one stale saved view must not make the whole export unavailable (the list page itself lives the same way).
    if (!field) continue;
    out.push(...columnsForField(path, field));
  }
  return out;
}

/**
 * Which columns the import template has — **only header fields the user can fill**.
 *
 * Each exclusion has a reason:
 *   · `isSystemSupplied` (`auto` / `derive` / `lineAgg` / `snapshot`): writing it hits the **key gate** (400).
 *     A column in the template that is destined to be rejected teaches the user to fill something that does not count.
 *   · `subtable`: lines are "N rows of one bill", and a flat one-cell-per-row layout cannot express that. **Do not pretend it can be imported** —
 *     v1 imports headers only. Carrying lines for real is "one header sheet + one line sheet, joined by bill number", which is another round,
 *     and leaving a half-finished column now would make the user think the lines were imported.
 *   · Platform fields: `status` is decided by the state machine (an import creates an initial draft), and audit fields are written by the framework.
 *
 * Deliberately unrelated to `views.list`: which columns the list shows is a **presentation** decision (it may show only 5),
 * while omitting a required field from the import template makes **every row fail**. The two rules are on different axes.
 */
export function importColumnsOf(schema: ModuleSchema): readonly ExchangeColumn[] {
  return schema.fields
    .filter((field) => field.type !== "subtable" && !isSystemSupplied(field, schema.fields))
    .flatMap((field) => columnsForField(field.key, field));
}

/**
 * Which columns the import template **sends** — `importColumnsOf` without the choiceSet code column.
 *
 * Splitting this from `importColumnsOf` is deliberate; the two rules are on different axes:
 *   · This one is the **blank sheet sent to a person**: codes (`cutting` / `sewing`) are internal keys,
 *     and the person only has names. Sending a column of English codes makes the user either copy the example `cutting` and create the wrong kind of record,
 *     or type a display name into the code column and be rejected — and neither looks like a template problem (KDocs #190).
 *   · `importColumnsOf` is **which headers are recognized**: the code column must still be recognized. An old template that was downloaded,
 *     or a file exported, edited, and imported back, still carries it. Refusing it becomes "column N's header is not a field of this module" and the whole file is rejected.
 *     "Code first; if the code is empty, resolve by name" stays as it is (`choiceLabelResolver`).
 *
 * The name column's candidate dropdown stays (`importCandidateSourceOf` with `want:"label"`), so dropping the code column
 * does not make the user guess the name: the dropdown is the names this tenant has enabled right now.
 */
export function importTemplateColumnsOf(schema: ModuleSchema): readonly ExchangeColumn[] {
  return importColumnsOf(schema).filter((column) => column.kind !== "choiceCode");
}

/**
 * Which columns the import template's line sheet uses — a **dotted path**, such as `lines.qty`.
 *
 * Same shape of rule as `importColumnsOf`: `isSystemSupplied` is always excluded.
 * A field with `systemGenerated: true` (for example `product.lines.barcode`) is therefore excluded —
 * the write path overwrites its value, and putting it in the template teaches the user to fill a cell that does not count.
 *
 * An unknown `subtableKey`, or a field that is not a subtable, returns an empty array (it does not throw) —
 * the caller decides at the route layer "a subtable means two sheets, otherwise one sheet". The rule itself does not error.
 *
 * **One level only**: a line table's columns must not nest another subtable (see the comment on Field.fields).
 */
export function importSubtableColumnsOf(
  schema: ModuleSchema,
  subtableKey: string,
): readonly ExchangeColumn[] {
  const sub = schema.fields.find((f) => f.key === subtableKey && f.type === "subtable");
  // `sub.fields` is typed `readonly Field[] | null`, while `isSystemSupplied` accepts
  // `undefined` and not `null`. Narrowing onto a local non-null variable gives TS a stable type after the narrow
  // and avoids reading `sub.fields` again inside filter / map (each read would re-run the narrow).
  const lineFields = sub?.fields;
  if (!lineFields) return [];
  return lineFields
    .filter((field) => !isSystemSupplied(field, lineFields))
    .flatMap((field) => columnsForField(`${subtableKey}.${field.key}`, field));
}

/**
 * The example row of an import template — a sample that is **shaped correctly** for the column type and that a person can edit.
 *
 * The template emits headers only, not lines (see `importColumnsOf`). The example fills headers only too:
 * an import creates an initial draft, and lines can be filled later. The example's job is to show what each cell should look like,
 * not to run the whole business chain for the user.
 *
 * A reference column is filled with the prompt "an existing code or a name that matches the system", not a fake id — import resolves by name,
 * and a fake uuid only makes the first row fail for a reason that looks like a broken template.
 */
export function importExampleRow(columns: readonly ExchangeColumn[]): readonly string[] {
  return columns.map((column) => {
    const field = column.field;
    if (!field) return "";
    switch (field.type) {
      case "enum":
        // Valid candidates of a tenant dictionary need IO (and disabled items must be excluded). The pure template layer must not present the product's default first item
        // as the tenant's current first item. Only a static enum can give a stable example.
        return field.choiceSet === null ? field.options?.[0]?.value ?? "" : "";
      case "ref":
        return `Enter an existing ${field.label} code or name`;
      case "refLine":
        return "";
      case "date":
        return "2026-08-04";
      case "datetime":
        return "2026-08-04 10:00:00";
      case "number":
        return "1";
      case "money":
        return "100.00";
      case "percent":
        return "13";
      case "bool":
        return "yes";
      case "phone":
        return "13800138000";
      case "string":
      case "text":
        return `Example ${field.label}`;
      case "attachment":
      case "subtable":
        return "";
      default: {
        const _exhaustive: never = field.type;
        return _exhaustive;
      }
    }
  });
}

/**
 * The **source** of "which values this column may contain". A rule, not the values — reading values needs IO, and this is zero IO.
 *
 * Why it exists: those template columns already have candidates (`enum` options, the tenant dictionary, a `ref`'s
 * candidate set), and CSV cannot carry "this cell may only contain these". The template therefore gave **one example value**.
 * The user cannot see that a pricing type can also be "hourly" or "mixed", and cannot see what their own team is called,
 * so they guess from the example and learn they guessed wrong only when import errors (bug9).
 *
 * **Do not invent a new allow-list here.** Each of the four branches points back at an existing source of truth:
 *   · `enum`: the `options` on the field declaration (static, available immediately)
 *   · `choiceSet`: the tenant dictionary's code (needs IO; only the coordinate is given, and the caller fetches it)
 *   · `ref`: the target entity plus the conditions `resolveRefFilter` already computed (needs IO, same as above)
 *   · `bool`: yes / no
 * A copy would drift silently when a team is added or removed or an enum is renamed — "the dropdown offers it, but import rejects it".
 */
export type ImportCandidateSource =
  /** Static candidates; the values are already in hand. */
  | { readonly kind: "enum"; readonly values: readonly string[] }
  /** yes / no */
  | { readonly kind: "bool"; readonly values: readonly string[] }
  /** Tenant product dictionary: fetch by code (excluding disabled items). The caller owns the IO. */
  | { readonly kind: "choiceSet"; readonly code: string; readonly want: "value" | "label" }
  /** Reference: look up by entity plus candidate conditions. The caller owns the IO. */
  | { readonly kind: "ref"; readonly entity: string; readonly filter: readonly RefFilterCondition[] };

/**
 * The candidate source of this column, or `null` when there is none (free text / date / number have no candidates).
 *
 * A `ref`'s conditions go through `resolveRefFilter` — **the same function on the candidate side and the write side**, not two copies that happen to
 * look alike. `worker.productionOrgId` declares `{status:"active", orgType:"team"}`.
 * Skipping that condition would stuff factories / workshops / lines into the template dropdown, and they **cannot be stored**:
 * the write-side gate still rejects them. That is the phenomenon this function exists to remove (too wide = selectable, but save rejects it).
 *
 * A non-empty `pending` means the candidate set depends on **the current value of another cell of this bill** (for example "pick the product before the BOM"),
 * and the template is a blank sheet, so that cell has no value yet. Return `null` (**no dropdown**) rather than
 * falling back to the full set: fail-open is exactly the symptom this capability must not have — the dropdown lists
 * records the current context must not offer. Leave it blank for the user to fill, and let the write side judge it on import.
 */
export function importCandidateSourceOf(column: ExchangeColumn): ImportCandidateSource | null {
  const field = column.field;
  if (!field) return null;

  if (column.kind === "choiceCode" || column.kind === "choiceLabel") {
    // A choiceSet expands into code + name columns. Both candidates come from the same dictionary and take a different side of it.
    return field.choiceSet === null
      ? null
      : { kind: "choiceSet", code: field.choiceSet, want: column.kind === "choiceCode" ? "value" : "label" };
  }

  switch (field.type) {
    case "enum": {
      // An enum that carries a choiceSet does not reach here (it already expanded into two columns). This is a fallback against a deformed declaration.
      if (field.choiceSet !== null) return null;
      const values = (field.options ?? []).map((option) => option.value);
      return values.length === 0 ? null : { kind: "enum", values };
    }
    case "bool":
      return { kind: "bool", values: ["yes", "no"] };
    case "ref": {
      if (field.ref === null) return null;
      // The template is a blank sheet: the header has no values, and there is no line context.
      const resolved = resolveRefFilter(field.refFilter, {}, null);
      if (resolved.pending.length > 0) return null;
      return { kind: "ref", entity: field.ref, filter: resolved.conditions };
    }
    default:
      return null;
  }
}

/**
 * Turn a stored value into a name a person can read. Injected by the caller — the kernel is zero IO, and turning a `ref` around needs the database.
 *
 * `undefined` means it could not be turned around. `cellOf` then **shows the raw value** rather than a blank:
 * an empty reference cell would be read as "this cell was not filled", when it actually has a value and only the name could not be fetched.
 */
export type CellDisplay = (column: ExchangeColumn, value: unknown) => string | undefined;

/**
 * One value → one cell of text.
 *
 * An empty value is always an empty cell. Do not write "null" / "undefined": those strings become content when imported back.
 * Emptiness uses `isEmptyValue` (the one the kernel already has) and is not written again here —
 * two definitions drifting looks like "empty on export, filled on import".
 *
 * **References and status must be turned into words a person can read** (via `display`). Export is for a person to read and to edit and import back,
 * and a column of uuids and a column of `active` are both unreadable and unfillable.
 * Observed: a customer record exported `customerId` as `5f8933de-…` and `status` as `active`,
 * and the business side could neither check nor edit the sheet. The rule is the same, character for character, as the `?ids=` round:
 * **"what each of these stored values is called" belongs to the label table**, and that table exists in one place.
 */
function exportDateTime(value: unknown, timeZone: string): string | null {
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

export function cellOf(
  column: ExchangeColumn,
  value: unknown,
  timeZone: string,
  display?: CellDisplay,
): string {
  if (isEmptyValue(value)) return "";
  // Audit instants and business datetimes are written in a person-readable form in the tenant time zone for every module export.
  // Do not emit ISO directly: ISO is a UTC representation with T/Z/milliseconds, and Excel often treats it as ordinary text.
  if (
    column.field?.type === "datetime" ||
    (column.field === null && (column.path === "createdAt" || column.path === "updatedAt"))
  ) {
    const formatted = exportDateTime(value, timeZone);
    if (formatted !== null) return formatted;
  }
  // choiceCode must always keep the stable code; only its companion choiceLabel column resolves the current name.
  const shown = column.kind === "choiceCode" ? undefined : display?.(column, value);
  if (shown !== undefined) return shown;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "yes" : "no";
  // An object (an attachment's AttachmentRef list, and so on) is not flattened to `[object Object]`: that is a false sentence.
  // What is exported is its JSON, which can at least be read and checked.
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * One cell of text → a value that can be handed to the write path.
 *
 * **Restore shape only; do not validate.** Whether the type is right, the enum is in range, or the reference dangles
 * is judged entirely by the value gate (`instance.ts`) on the write path — that is the only rule, and it produces
 * **per-field** issues (it can mark that cell). Judging it here first would be a second rule,
 * and two rules drifting looks like "import says it is fine, save says it is not".
 *
 * An empty cell is always `undefined` (= this column gave no value), not an empty string: an empty string on a required field is
 * collapsed to null and then rejected by the value gate, which is the same meaning; on an **optional** field, an empty string and "not filled" differ under patch semantics.
 */
/**
 * The write edge collapses "yes/no, 1/0, true/false" into a real boolean.
 *
 * The value gate (`instance.ts`) accepts only `typeof === "boolean"` and does not guess a representation there —
 * `"false"` is a truthy string, and guessing wrong would silently store true. Import, a non-FieldControl,
 * and refDefault copying a source value are the paths that meet these representations; an unrecognized value is handed back to the value gate as TYPE_MISMATCH.
 */
export function coerceWriteBool(raw: unknown): unknown {
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === 0) return raw === 1;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (["yes", "true", "TRUE", "1", "Y", "y"].includes(trimmed)) return true;
  if (["no", "false", "FALSE", "0", "N", "n"].includes(trimmed)) return false;
  return raw;
}

/** Restore the representation only for a bool cell; other types pass through. */
export function coerceWriteValue(field: Field, value: unknown): unknown {
  return field.type === "bool" ? coerceWriteBool(value) : value;
}

export function parseCell(column: ExchangeColumn, text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const field = column.field;
  if (!field) return trimmed;
  switch (field.type) {
    case "number":
    case "money":
    case "percent": {
      // Do not judge "is this a number" here: if it cannot be parsed, pass the **original text** on so the value gate can report
      // "this cell is not a number" and mark that field. Throwing here would produce a sentence with no field coordinate.
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : trimmed;
    }
    case "bool":
      return coerceWriteBool(trimmed);
    default:
      return trimmed;
  }
}

/**
 * One header row of text → column coordinates. **Recognize the display label**, because the template is filled by a person, and the person only has the label.
 *
 * An unrecognized header **throws** and is not dropped silently: dropping a column silently means none of that column's values went in,
 * while the import result says "all succeeded". A duplicate label also throws — guessing which column by order when two columns share a name
 * does not error when the guess is wrong; the value just lands in the other cell.
 */
export function matchImportHeader(
  columns: readonly ExchangeColumn[],
  header: readonly string[],
): readonly ExchangeColumn[] {
  const byLabel = new Map<string, ExchangeColumn[]>();
  for (const column of columns) {
    const hit = byLabel.get(column.label);
    if (hit) hit.push(column);
    else byLabel.set(column.label, [column]);
  }
  const known = columns.map((c) => c.label).join(", ");
  return header.map((raw, i) => {
    const label = raw.trim();
    const hit = byLabel.get(label);
    if (!hit || !hit[0]) {
      throw new Error(`column ${i + 1} header "${label}" is not a field of this module. Available columns: ${known}`);
    }
    if (hit.length > 1) {
      throw new Error(`header "${label}" matches ${hit.length} fields on this module, so this column cannot be identified`);
    }
    return hit[0];
  });
}

/**
 * Whether this column is one that "must be turned into words before a person can read it".
 *
 * Three kinds: a `ref` (the value is a uuid), the platform `status` (the value is a status key), and the name column
 * that accompanies a choiceSet. A static `enum` is not among them; a choiceSet's stable code column must never be overwritten by a name.
 */
export function needsLabel(column: ExchangeColumn): boolean {
  if (column.kind === "choiceLabel") return true;
  if (column.field === null) return column.path === "status";
  return column.field.type === "ref";
}

/** The stable part of an export file name. It carries the module label and the date — one desktop will have many copies. */
export function exchangeFileName(schema: ModuleSchema, ymd: string, suffix: string): string {
  return `${schema.label}-${ymd}.${suffix}`;
}
