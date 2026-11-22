// ---------------------------------------------------------------------------
// ① Field
//
// Every field should be able to say which step of the flow needs it. Fields are inferred from the flow, not reverse-engineered from a database table.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  normalizeRowFilter,
  requireArray,
  requireCoordinateSegment,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
  type RowFilter,
} from "./common.js";
import {
  isRefFilterRef,
  normalizeRefFilter,
  normalizeRefPreselect,
  refFilterOperands,
  type RefFilter,
  type RefPreselect,
} from "../normalize/refFilter.js";

/**
 * Field types. A closed enum.
 *
 * Compared with the previous generation, three pairs of synonyms were collapsed (textarea=text, amount=money, boolean=bool).
 * Those existed to stay compatible with 42 old entities. This repo does not carry that. The cost of a synonym is that an AI has to guess which one to use.
 */
export const FIELD_TYPES = [
  "string",
  "text",
  "number",
  "money",
  "percent",
  "bool",
  "date",
  "datetime",
  "enum",
  "ref",
  /**
   * A line reference: the value is the id of one line on an upstream document. It may appear only on a line column.
   *
   * It is separate from `ref` because it points at a different thing. `ref` points at a document (it is in the module table,
   * it can be looked up, and it can open a detail page). `refLine` points at a line (it has no detail page of its own and can be reached only with its header).
   * Both are text columns underneath and both can join out a row, so merging them into one type would not error when the wrong one is used.
   * `relationsOf` would treat a line id as a document id when computing a link, and the detail page would get a 404 link.
   */
  "refLine",
  "phone",
  "attachment",
  "subtable",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Field types for which the renderer cannot supply a value: the ones a user cannot fill on create, no matter what.
 *
 * The criterion is "is there an input channel", not "is it easy to fill".
 *
 * ⚠️ This is currently an empty set. `refLine` used to be the only member (its candidates follow a sibling field on the same row,
 * and the `options` / `refSearch` channel passes candidates per field, which cannot express that linkage).
 * After the two-step picker was built (`parts/ReferencePicker.tsx`: pick the upstream document, then check lines),
 * it was removed from here as planned. `FieldControl`'s local throw and `SubtableEditor`'s forced read-only
 * were deleted in the same change. The three were three projections of one sentence, so only this site is edited.
 *
 * 🔴 An empty set does not mean the mechanism is useless. It is the registry for the next field type that has no control.
 * While it is empty, `hasManualInput` is constantly true, so the first class of `createBlockersOf` is no longer produced.
 * The second class (a required companion ref plus an optional line reference) is independent of it. The creation-path gate stays non-constant because of that class.
 * The proof is in `packages/loader/test/loader.test.ts` and `packages/metamodel/test/creatable.test.ts`.
 *
 * 🔴 It is still written as one closed set, rather than a `type === "xxx"` in the renderer, the line table, and the creation-path gate.
 * Scattered checks fail like this when a type is added back and one site is missed:
 * "the UI can fill it, but the gate still judges that it cannot create data", or the reverse, and both report nothing.
 */
export const NO_MANUAL_INPUT_TYPES: readonly FieldType[] = Object.freeze([]);

/** Whether this field has an input channel on the create form. false means the user cannot fill it, no matter what. */
export function hasManualInput(field: Field): boolean {
  return !NO_MANUAL_INPUT_TYPES.includes(field.type);
}

/** One item of a static enum. value is the stored code, label is the copy a role sees. Same shape as a reference dropdown. */
export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

const ENUM_OPTION_ITEM_KEYS = ["value", "label"] as const;

/**
 * The value is a system code (camelCase, SNAKE, or a long English token).
 * The screen needs a separate facing label. Unit symbols of at most three letters
 * (`kg`, `g`, `L`) are the label themselves. A value that is already prose is too.
 */
export function enumOptionNeedsFacingLabel(value: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return false;
  return value.length > 3 || value.includes("_");
}

/** When a declaration or a test gives only the code, the label is the value. */
export function asEnumOptions(values: readonly string[]): readonly EnumOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function enumOptionValues(options: readonly EnumOption[] | null | undefined): readonly string[] {
  return (options ?? []).map((option) => option.value);
}

export function hasEnumOption(options: readonly EnumOption[] | null | undefined, value: string): boolean {
  return (options ?? []).some((option) => option.value === value);
}

export function enumOptionLabel(field: Pick<Field, "options">, value: string): string {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

/** Dropdown candidates. `Field.options` is already this shape. No side table is assembled. */
export function enumFieldOptions(field: Pick<Field, "options">): readonly EnumOption[] {
  return field.options ?? [];
}

export function normalizeEnumOptions(raw: unknown, at: string): readonly EnumOption[] {
  if (!Array.isArray(raw)) schemaFail(`${at} must be an array`);
  const options: EnumOption[] = [];
  for (const [index, item] of raw.entries()) {
    const itemAt = `${at}[${String(index)}]`;
    if (typeof item === "string") {
      const value = requireText(item, itemAt);
      options.push({ value, label: value });
      continue;
    }
    const obj = requireObject(item, itemAt);
    assertClosedKeys(obj, ENUM_OPTION_ITEM_KEYS, itemAt);
    options.push({
      value: requireText(obj["value"], `${itemAt}.value`),
      label: requireText(obj["label"], `${itemAt}.label`),
    });
  }
  if (options.length === 0) schemaFail(`${at} must have at least one candidate value`);
  assertUniqueKeys(options.map((option) => option.value), `${at}.value`);
  assertUniqueKeys(options.map((option) => option.label), `${at}.label`);
  return options;
}

/** Field types a formula can compute. The result is a number, so the field that carries a formula must itself be one of these three. */
export const NUMERIC_FIELD_TYPES: readonly FieldType[] = Object.freeze(["number", "money", "percent"]);

export function isNumericFieldType(type: FieldType): boolean {
  return NUMERIC_FIELD_TYPES.includes(type);
}

/**
 * Formula operands: numeric cells, plus bool (evaluated as 0/1, so a switch column can be a multiplier).
 * The result cell must still be numeric. A bool may be a multiplier, not the formula column itself.
 */
export function isFormulaOperandType(type: FieldType): boolean {
  return isNumericFieldType(type) || type === "bool";
}

// ── Uniqueness ─────────────────────────────────────────────────────────────
//
// 🔴 Why `unique` is a general capability, not a special case opened for barcodes:
// The criterion is the same one as the escape-hatch section: a foreseeable n. "Scan a barcode and bring up the goods" holds only if
// one barcode points at exactly one goods record. Without uniqueness it does not hold architecturally. Cells of the same shape
// are everywhere: customer code, supplier code, bank account, identity number, external-system id. Any
// registration slot that must be unique in the business is missing this cell. n is clearly greater than 1.
//
// ⚠️ "It lives on Field, so it is not a seventh concept" is not an exemption (the escape-hatch section of AGENTS.md). The `MODULE_KEYS`
// gate covers only top-level keys. Adding a property on Field is also adding expressive power, and it has to pass the same criterion.
//
// 🔴 The unique range explicitly includes the tenant (table side: `uniqueIndex(tenant_id, column)`). Omitting the tenant does not
// error. A barcode tenant A has filled can never be filled by tenant B, and the rejection itself leaks that another tenant has the value.

/**
 * Whether "unique" holds on this type. Non-null is the reason for rejection.
 *
 * 🔴 `FieldType` is exhaustive, with no default branch. Adding a field type and missing a cell here is a compile error.
 * A new type that fell into a default branch would silently become "may be unique", and a unique index is a table-creation decision.
 * A wrong one is visible only when some tenant fills the same value a second time, and by then the table already has data.
 */
const UNIQUE_REFUSAL_BY_TYPE: Readonly<Record<FieldType, string | null>> = Object.freeze({
  string: null,
  phone: null,
  number: null,
  money: null,
  percent: null,
  date: null,
  datetime: null,
  ref: null,
  // A line reference appears only on a line column, and line columns are never unique (that dimension is rejected by
  // FIELD_UNIQUE_ON_LINE). This type dimension allows it, so the same fact is not reported once on each of two gates.
  refLine: null,
  text: "Long text is a note or a description, not a registration slot. A btree index row also has a 2704-byte limit, and exceeding it throws only at insert time, which neither table creation nor modeling can see",
  bool: "The value is only yes or no. Unique within a tenant means the whole table has at most two rows. That is not what the modeler meant to say",
  enum: "The value set is closed. Unique within a tenant means the whole table has at most as many rows as options. Same shape as bool",
  attachment:
    "The value is a set of files (see attachment.ts), not one registration slot. " +
    "'This cell may appear only once within the tenant' has no business reading for a list (the same contract hanging on two documents is normal), " +
    "and jsonb equality compares the whole array, so one extra file is a different value. What the modeler usually meant is 'this file must not be uploaded twice', which is a different fact",
  subtable: "A line table builds no column, so there is nowhere to put a unique index. Uniqueness on a line column has its own meaning; see FIELD_UNIQUE_ON_LINE",
});

/** Whether uniqueness holds on this field type. Non-null is the reason for rejection (the semantic gate shows it directly). */
export function uniqueRefusalOf(type: FieldType): string | null {
  return UNIQUE_REFUSAL_BY_TYPE[type];
}

/**
 * Fields in one layer that declare unique.
 *
 * 🔴 Table creation (emitting the unique index) and the write path (checking duplicates before insert) share this criterion. Two copies do not error:
 * an index is emitted and the checker does not check, so the user gets a 500 or 409 instead of "this value is duplicated" marked on the field;
 * or the checker checks and the index is not emitted, so the concurrency window is wide open and two simultaneous submits each say it is not a duplicate.
 *
 * The declaration layer guarantees `unique` implies `hasColumn` (derived fields and subtable are always rejected). This still fails fast:
 * if the gate is bypassed (a handwritten schema, JSON pasted back), the substitute shape is silently emitting one fewer unique index.
 */
export function uniqueFieldsOf(fields: readonly Field[]): readonly Field[] {
  const out = fields.filter((field) => field.unique);
  for (const field of out) {
    if (!hasColumn(field)) {
      schemaFail(`Field "${field.key}" is marked unique but builds no column (${field.type}). The declaration-layer gate should already have stopped this`);
    }
  }
  return out;
}

/**
 * Decimal precision of a numeric field.
 *
 * 🔴 The source of truth is the kernel, not the table builder. Two copies do not error: the generator builds the column at 4 places
 * while the write path computes a total at 6 places, and Postgres silently truncates on insert. The header total and the sum of the lines
 * then differ by one minor unit, and each number looks legal on its own. Table creation (column types in `builder/codegen.ts`) and the write-time total
 * (rounding in `computeLineAggregates`) must read the same copy.
 *
 * The three tiers are separate because the real ranges differ a lot:
 *   money    amounts, four decimal places (unit prices often use four, totals two)
 *   number   quantities, six decimal places (usage in chemical and weighing trades)
 *   percent  discount rates, four places
 */
export const NUMERIC_PRECISION: Readonly<
  Record<"number" | "money" | "percent", { readonly precision: number; readonly scale: number }>
> = Object.freeze({
  number: { precision: 18, scale: 6 },
  money: { precision: 18, scale: 4 },
  percent: { precision: 9, scale: 4 },
});

/**
 * Round to the decimal precision of the field type.
 *
 * Use `toFixed` rather than `Math.round(x * 10**scale) / 10**scale`. The latter multiplies and then divides,
 * and each floating-point operation introduces an error, so a value such as `1.005` rounds the wrong way.
 */
export function roundToScale(value: number, type: "number" | "money" | "percent", label: string): number {
  const rounded = Number(value.toFixed(NUMERIC_PRECISION[type].scale));
  if (!Number.isFinite(rounded)) schemaFail(`${label} is not a finite number after rounding (${String(value)})`);
  return rounded;
}

// ── Formulas ───────────────────────────────────────────────────────────────
//
// A formula is a structured expression tree, not a string DSL. The reason is the same one as the header of primitives.ts:
//
//   · statically analyzable — the validator can check that a referenced field exists, is on the same layer, and is numeric
//   · self-explanatory — describeFormula() renders words a person can read, and explain and the UI read the same copy
//   · easy for an AI to generate — a structured object plus TypeScript completion is far more accurate than a string expression
//
// Replacing it with a string such as "qty * price * (1 - discount/100)" means the first property needs a lexer before it can be answered,
// and the second can never be given. That is the same set of reasons for not choosing CEL or JSONLogic.

export const FORMULA_OPS = ["add", "sub", "mul", "div", "max"] as const;
export type FormulaOp = (typeof FORMULA_OPS)[number];

/**
 * An expression node. Four shapes, distinguished by key (the same spelling as `Operand` in primitives.ts).
 *
 * ```ts
 * { field: "qty" }                                  // a field on the same row
 * { value: 100 }                                    // a literal
 * { op: "mul", args: [ … ] }                        // an operation
 * { orElse: { of: { field: "discount" }, whenEmpty: 0 } }   // an explicit default
 * ```
 *
 * 🔴 `orElse` is the only exit for a default, and it is a declared architectural decision, not a silent fallback.
 * A line's `discount` may be left empty. "There is no discount" is a legal business fact, not a missing-value bug.
 * The difference: `?? 0` hidden in evaluation code is invisible, nobody can review it, and explain cannot say it.
 * `orElse` is written in the schema. The validator can see it, explain can say it, and the UI can show it.
 * Other than orElse, a field with no value, or a value that is not a number, always throws. It does not return 0.
 */
export type Expr =
  | { readonly field: string }
  | { readonly value: number }
  | { readonly op: FormulaOp; readonly args: readonly Expr[] }
  | { readonly orElse: { readonly of: Expr; readonly whenEmpty: number } };

/** The three shapes of derive. */
export const DERIVE_KINDS = ["rollup", "lookup", "formula"] as const;
export type DeriveKind = (typeof DERIVE_KINDS)[number];

/** Aggregation of a rollup, written `agg(field)`. count takes no field. */
export const DERIVE_AGGS = ["sum", "avg", "min", "max", "count"] as const;
export type DeriveAgg = (typeof DERIVE_AGGS)[number];

/**
 * Names of the aggregations.
 *
 * 🔴 The list footer totals (`SUMMARY_FN_TEXT`) reference this copy directly. They do not write another.
 * They are the same words. "total" is called total in a field explanation and total in the footer.
 * Two copies drift: one side changes and the other does not, and neither reports an error.
 */
export const AGG_TEXT: Readonly<Record<DeriveAgg, string>> = Object.freeze({
  sum: "total",
  count: "count",
  avg: "average",
  max: "maximum",
  min: "minimum",
});

/**
 * A derivation across documents.
 *
 * 🔴 Not a seventh concept. It lives on ① Field.
 *
 * Why it must be declarative rather than code: three consumers need it to be data.
 * The UI needs to know it is read-only and cannot be edited by hand. The replay engine needs to recompute it from a historical snapshot. An AI needs to know "you did not fill this number".
 */
export type Derive =
  | {
      readonly kind: "rollup";
      /** Downstream entity code. */
      readonly from: string;
      /** Field on the downstream row that points back at this document. */
      readonly match: string;
      /** Identity column on this layer that aligns with the downstream match. Omitted means this layer's id. */
      readonly on?: string | null;
      /**
       * Which layer of `from` is aggregated. `null` means header rows. Non-null means the rows of one line table under the header.
       *
       * 🔴 This dimension was forced by line references. It is not there for flexibility. Once a shipment spans several orders,
       * "how much of this order has shipped" is no longer "the header total of a few shipments". The shipment header no longer has
       * an order field at all. The aggregate has to go down to the line: `from='salesDelivery' through='lines'`.
       *
       * When it is non-null, two things change, and neither can be omitted:
       *   · `match` is resolved on that line table (`orderId` / `orderLineId` are columns on the line)
       *   · `where` still filters the header (`status` lives only on the header). A line has no state machine.
       */
      readonly through: string | null;
      readonly agg: DeriveAgg;
      /** null when the aggregation is count. */
      readonly measure: string | null;
      /** Filter on the downstream header. An array means in ("not yet settled" is naturally a set of statuses). */
      readonly where: RowFilter | null;
    }
  | {
      readonly kind: "lookup";
      readonly from: string;
      /** Foreign-key field on this row that points at from. */
      readonly match: string;
      /**
       * Which layer of `from` the value is taken from. `null` means the header. Non-null means one line table under the header.
       *
       * When it is non-null, the field `match` names must be a line reference (`refLine`). Its value is the id of one
       * line, not the id of a document. Both are text columns and both can join out a row,
       * so using the wrong one does not error. It brings back the row in the other table that happens to have the same id (in practice, null).
       */
      readonly through: string | null;
      /** Which field to take from the related row. */
      readonly field: string;
    }
  | {
      /**
       * A quantity computed on the same row (a line amount, a header net amount).
       *
       * It is a derive, same as rollup and lookup, rather than another field type. The three say the same thing:
       * the system supplies the value, and the user must not fill it. Two names for one fact (the old `type: "computed"`) give
       * a criterion such as `isSystemSupplied` two legs, and computed had neither a formula nor a result type,
       * so it could neither be computed nor converge on a comparator. After the merge the field keeps its real type (money) and the formula lives here.
       */
      readonly kind: "formula";
      readonly expr: Expr;
    };

/**
 * A reference snapshot: on save, copy a stored fact from the record the reference points at, and do not follow the source afterwards.
 *
 * `match` must be a `ref` or `refLine` on this layer, and `through` agrees with that reference's coordinate.
 * This is a declarative freeze, not a lookup (a lookup is derived at query time and has no column).
 */
export interface Snapshot {
  readonly from: string;
  readonly match: string;
  readonly through: string | null;
  readonly field: string;
  /**
   * `true` means the match reference may be empty. When it is empty the target snapshot is explicitly stored as null. When there is a reference it is still frozen from the source.
   *
   * The default is `false`, which keeps the closed constraint of an ordinary snapshot: the reference must exist. This switch relaxes only the
   * existence of the reference. It does not relax existence, visibility, candidate filtering, or source-field completeness of a non-empty reference.
   */
  readonly optional?: boolean;
}

/**
 * A reference default: when the reference is selected, prefill from the source record, but the user still owns this cell and may overwrite it.
 *
 * The coordinate shape matches `snapshot`. The meaning is deliberately different:
 * - `snapshot` is system-supplied, not writable by the client, and is always overwritten from the source on save;
 * - `refDefault` is only a starting value when the cell is empty. A non-empty value the user gave wins and is stored as given.
 *
 * The server applies the same default, so a browser, an Agent, and a direct API create do not grow two wordings.
 */
export interface ReferenceDefault {
  readonly from: string;
  readonly match: string;
  readonly through: string | null;
  readonly field: string;
}

/**
 * A unit choice on a business document.
 *
 * Candidates and the conversion rate are not redeclared on every document. `match` points at the product reference on the same layer, and the product module
 * provides the main unit, the auxiliary unit, and the rate "1 auxiliary unit = N main units" through `ModuleSchema.unitSet`.
 * `factorInto` is a numeric column on the same layer, written by the system with the selection: the main unit writes 1, the auxiliary unit writes the rate.
 */
export interface UnitChoice {
  readonly match: string;
  readonly factorInto: string;
}

// ── Line totals ────────────────────────────────────────────────────────────

/**
 * Aggregation. Only sum and count. It does not reuse the five tiers of `DERIVE_AGGS`.
 *
 * The criterion is "does an empty line set have a value". A total is stored in a column (see below), and `avg`, `min`, and `max` have
 * no value on an empty set. Storing a null means the next step, `effects.amount`, blows up at runtime when it posts,
 * or worse, the null is treated as 0. The empty set of `sum` and `count` is 0. That is arithmetic, not a fallback.
 *
 * Header totals in an ERP (quantity, amount, tax, piece count) really are only these two.
 * A `max` such as "latest due date" is a date concern, not a numeric total. Wait until there is a real n.
 */
export const LINE_AGG_AGGS = ["sum", "count"] as const;
export type LineAggAgg = (typeof LINE_AGG_AGGS)[number];

/**
 * The header equals the total of this document's lines.
 *
 * 🔴 Not a fourth `derive`, and not a seventh concept. It lives on ① Field, at the same rank as `derive` and `auto`.
 *
 * Why it must be separate from `derive`: the two supply a value by different mechanisms, and they also differ on whether a column is stored.
 *
 * |            | No column (computed at query time) | Has a column (the system writes) |
 * |------------|------------------------------|--------------------|
 * | Computed from existing data | `derive` (rollup/lookup/formula) | **`lineAgg`** |
 * | Sequence allocation | — | `auto` |
 *
 * `auto` was already the resident of the "system-supplied and has a column" cell, so this leg is not a foreign body pushed into the architecture.
 * It fills a split that already existed. All three enter `isSystemSupplied` (neither the user nor the agent may write them).
 * Table creation and the write-path split still look only at `isDerived`. `lineAgg` has a column, so not one word of that split changes.
 *
 * Why it is not a fourth derive computed at query time (consistency would then be free because nothing is stored): it would hit three places,
 * and all three are right.
 *   · `effects.amount` accepts only a stored fact (`EFFECT_AMOUNT_NOT_STORED`):
 *     a ledger only appends. Posting a number that can be recomputed at any time means that after the lines change, history and "the amount" never agree again.
 *   · `lookup` does not take a derived field (a downstream document needs the upstream order quantity for an over-ship comparison).
 *   · a `rollup` measure must be a column (a cross-module total such as "a customer's unsettled order amount" has to be able to aggregate it).
 * The cost is that consistency is now guaranteed by the single write entrance, and is no longer free. That is an explicit architectural decision.
 * The discipline is in AGENTS.md: every path that can write lines must recompute the total at the same time. None may be missed.
 */
export interface LineAgg {
  /** Which line table is aggregated. The key of a `type: 'subtable'` field of this module. */
  readonly of: string;
  readonly agg: LineAggAgg;
  /** null when the aggregation is count. */
  readonly measure: string | null;
}

/**
 * Why there is no `where`.
 *
 * `derive.rollup` has `where` ("the shipments that have already shipped") because the downstream document has a state machine.
 * "Which rows count" is a real business question there. A line has no lifecycle and no status.
 * "Does this line count toward the total" has no corresponding business fact on a line. A document's total is the sum of all of its lines.
 *
 * If a distinction is really needed (for example "gift lines are not included in the amount"), that is a business field on the line plus a second total field.
 * It is not a filter on the total. A filter immediately raises "which copy is the header total", and that question has no answer.
 */
function normalizeLineAgg(raw: unknown, label: string): LineAgg {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["of", "measure"], label);
  const of = requireText(obj["of"], `${label}.of`);
  const measureText = requireText(obj["measure"], `${label}.measure`);

  // The spelling matches derive.rollup's measure verbatim (`agg(field)`). Two spellings of one fact
  // mean an AI has to guess which one to use every time.
  const parsed = DERIVE_MEASURE.exec(measureText);
  if (!parsed?.[1]) {
    schemaFail(`${label}.measure "${measureText}" is illegal: the form is agg(field), for example sum(qty); count takes no field`);
  }
  const agg = requireEnum(parsed[1], LINE_AGG_AGGS, `${label}.measure aggregation`);
  const measure = parsed[2] ?? null;
  if (agg === "count" && measure !== null) schemaFail(`${label}.measure: count does not take a field argument`);
  if (agg !== "count" && measure === null) schemaFail(`${label}.measure: ${agg} must name a field, for example ${agg}(qty)`);

  return { of, agg, measure };
}

/** `Field.uniqueDefaultWithin`: the unique default pointer inside a coordinate. Entering that status demotes the old one. */
export interface UniqueDefaultWithin {
  readonly within: readonly string[];
  readonly status: string;
}

/** `Field.stampOnFirstEnter`: stamp a date or datetime the first time that status is entered. An existing value is not overwritten. */
export interface StampOnFirstEnter {
  readonly status: string;
}

/**
 * A system sequence inside a coordinate. The write path locks the coordinate by `within` and increments the format. It does not branch on module code.
 * `majorMinor` is V{major}.{minor}. The first version is V1.0, and later versions in the same coordinate increment minor.
 */
export interface GeneratedSequence {
  readonly kind: "majorMinor";
  readonly within: readonly string[];
}

// ── person: the "person" declaration on a field ──────────────────────────

export const PERSON_ROLES = ["creator", "receiver", "owner"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const PERSON_ROLE_TEXT: Readonly<Record<PersonRole, string>> = Object.freeze({
  creator: "Document creator",
  receiver: "Document receiver",
  owner: "Owner",
});

/**
 * How the thing stored in this cell is addressed to an account.
 *
 * 🔴 Three pure shapes, and no module name appears. A module name appears only in an L2 declaration (the value of `via.ref`).
 * The framework branches only on shape. It was once going to be written `via: 'worker' | 'productionOrg'`, which would weld
 * the business concepts "production worker" and "team" into the kernel. Adding a source of people would mean coming back to change the framework.
 *
 *   · `"self"`         the value of this cell is itself a platform user id.
 *   · `{ ref, field }` the value is a row id of another module. Follow it and read one cell of that module to get the account.
 *   · `{ members, by, field }`
 *                      the value is the row id of some container (a team, a department, a group).
 *                      Load every row in the members module whose by column equals this value, and take field from each row.
 *                      One-to-many lands on this branch. "Assigning work to a department means several people" needs no special-case code.
 */
export type PersonVia =
  | "self"
  | { readonly ref: string; readonly field: string }
  | { readonly members: string; readonly by: string; readonly field: string };

export interface PersonDecl {
  readonly role: PersonRole;
  readonly via: PersonVia;
}

const PERSON_KEYS = ["role", "via"] as const;

export function normalizePersonDecl(raw: unknown, at = "person"): PersonDecl {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, PERSON_KEYS, at);
  const role = requireEnum(obj["role"], PERSON_ROLES, `${at}.role`);
  const rawVia = obj["via"];
  if (rawVia === "self") return { role, via: "self" };
  const via = requireObject(rawVia, `${at}.via`, '"self", or { ref, field }, or { members, by, field }');
  if ("ref" in via) {
    assertClosedKeys(via, ["ref", "field"], `${at}.via`);
    return {
      role,
      via: { ref: requireText(via["ref"], `${at}.via.ref`), field: requireText(via["field"], `${at}.via.field`) },
    };
  }
  if ("members" in via) {
    assertClosedKeys(via, ["members", "by", "field"], `${at}.via`);
    return {
      role,
      via: {
        members: requireText(via["members"], `${at}.via.members`),
        by: requireText(via["by"], `${at}.via.by`),
        field: requireText(via["field"], `${at}.via.field`),
      },
    };
  }
  return schemaFail(`${at}.via must be "self", { ref, field }, or { members, by, field }`);
}

export interface Field {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** Shown by default on the list, and the main identity on the form. */
  readonly primary: boolean;
  /**
   * This cell may appear only once within a tenant. It is for an external identifier the user fills (a barcode, a customer code, an identity number,
   * an external-system id). The platform-issued `code` is owned by the `primary` index and is not marked again.
   *
   * It is fulfilled in two layers, and missing either one means it does not hold:
   *   · table creation emits `uniqueIndex(tenant_id, column)` (`builder/codegen.ts`), the last line of defense on the concurrency window;
   *   · the write path checks duplicates before insert (`uniqueSitesOf` plus one in-query in storage), which is the classifier of a user input error.
   *     Only that classifier can say which field was duplicated, the kind of per-field conclusion that can be marked red.
   * An index without a duplicate check turns one duplicated fill into a database error (the AGENTS.md rule "do not let a database column constraint
   * act as the validator" is about exactly this). A duplicate check without an index lets two concurrent writes each judge "not a duplicate".
   *
   * 🔴 Empty values do not take part in uniqueness. A Postgres unique index is NULLS DISTINCT by default, so many NULLs do not conflict,
   * and the value gate collapses an empty string to null (the header of `instance.ts`). "The barcode was not filled" is legal in the business,
   * and a batch of goods with no barcode must all be storable. The duplicate check skips empty values too, so the two sides use the same wording.
   *
   * 🔴 Composite uniqueness uses `uniqueWith`. Do not write "versions do not repeat under the same product" as a single-column
   * `unique: true`. That is unique across the whole tenant, and it misreads "motor V1.0" and "shaft V1.0" as duplicates.
   * The user reads that as "a BOM may have only 1 row", while what should be blocked is a repeated version number under one product.
   */
  readonly unique: boolean;
  /**
   * The other header fields (ordered) that, together with this field, form the unique coordinate within the tenant.
   * `unique: true` plus `uniqueWith: ["productId"]` means both the index and the duplicate check use
   * `(tenantId, productId, this field)`. The default `null` is the single column `(tenantId, this field)`.
   *
   * Meaningful only when `unique: true`. Companion columns must exist, have a column, and not be this field.
   */
  readonly uniqueWith: readonly string[] | null;
  /**
   * The unique default pointer inside a coordinate. This field must be a bool: the row that is true is the current pointer of that coordinate in the named status.
   *
   * `uniqueDefaultWithin: { within: ["productId"], status: "active" }` says
   * "at most one `isDefault` is true inside `productId` times `status=active`". When this document enters that status and is marked default,
   * the write path first demotes the old default in the same coordinate, in the same transaction. This is not the hard tenant-wide rejection of `unique`.
   * A rollback leaves the old default untouched.
   *
   * It enters the object only when declared. Consumers read it through `uniqueDefaultWithinOf`.
   */
  readonly uniqueDefaultWithin?: UniqueDefaultWithin | null;
  /** A system sequence inside a coordinate. A missing key means it is not declared. Used together with `systemGenerated`. */
  readonly generatedSequence?: GeneratedSequence | null;
  /**
   * Stamp this date or datetime field the first time the named status is entered. An existing value is not overwritten.
   *
   * `stampOnFirstEnter: { status: "active" }` says "write the calendar day when active is entered for the first time from the initial state".
   * date is written as the business day YYYY-MM-DD. datetime is written as the execution instant. Enabling again after a disable already has a value, and it is not rewritten.
   * It must hang on a `systemGenerated` date or datetime, it is written by the status persist,
   * and a person must not fill it.
   *
   * It enters the object only when declared. Consumers read it through `stampOnFirstEnterOf`.
   */
  readonly stampOnFirstEnter?: StampOnFirstEnter | null;
  /**
   * The platform allocates the number on create (`module.numbering`). It has a column, the system writes it, and a person must not fill it.
   *
   * Both this and derive are "system-supplied", but the mechanism differs. derive is computed from existing data and builds no column.
   * auto is sequence allocation and has a column. Both enter `isSystemSupplied`. Table creation splits on `isDerived`.
   */
  readonly auto: boolean;
  /**
   * Required only in the full value gate of an ordinary manual create. Planner, push, and generated writes do not require it.
   * The database column stays nullable, and a save patch does not treat a field that did not appear as a clear.
   */
  readonly requiredOnManualCreate?: boolean;
  /** An overridable starting value on create. `today` is only for date, `now` is only for datetime. */
  readonly createDefault?: "today" | "now" | null;
  /**
   * An overridable boolean default on create, given by a closed enum on the same layer.
   *
   * This is not a rule result, and it is not a second business truth. The classification only gives ordinary entry a starting answer. The caller may still
   * override it explicitly. The map must cover the source enum completely, so a newly added category does not silently land as `false`.
   */
  readonly createDefaultBy?: {
    readonly field: string;
    readonly values: Readonly<Record<string, boolean>>;
  } | null;
  /** Candidates when type === 'enum'. Same shape as a reference dropdown: value is stored, label is for a person. */
  readonly options: readonly EnumOption[] | null;
  /** When type === 'enum', candidates come from the tenant product dictionary. Choose one of options, choiceSet, and unitChoice. */
  readonly choiceSet: string | null;
  /**
   * When `type === 'enum'`, this cell is multi-select: the value is a set of codes, not one code.
   *
   * 🔴 Do not open a new FIELD_TYPE for multi-select. Where candidates come from, how they are checked, and how labels are shown
   * are verbatim the same three facts as single-select. Two types would each grow a second implementation.
   *
   * ⚠️ Use it only on a field that has no column (today that is a tenant custom field, and the value lands in a jsonb array).
   * A declared field that wants multi-select has to decide the stored shape first. One text column cannot hold a set of values,
   * so `validateModule` rejects `multiple` on the declaration side.
   */
  readonly multiple?: boolean;
  /**
   * A value-shape constraint when `type === 'string'`. The value gate enforces it. It is not a display hint.
   *
   * · `time`: zero-padded `HH:mm`. Zero-padding makes dictionary order match time order,
   *   so sorting and ranges are correct under the string rules. Without zero-padding that property collapses immediately,
   *   so it has to be a real gate, not a UI that "tries" to produce the right format.
   */
  readonly format?: "time";
  /** Entity code pointed at when type is 'ref', 'refLine', or 'subtable'. */
  readonly ref: string | null;
  /**
   * Which records this cell can select. The filter on reference candidates. Meaningful only on `ref` and `refLine`.
   *
   * 🔴 It is not "one more layer of validation". It projects a criterion that already exists onto the candidates ahead of time.
   * See the top of `refFilter.ts`. Before it, "a production plant must be a plant" lived only in
   * the `ref_field_compare` on the `submit` edge, while the dropdown still listed workshops, lines, and teams together.
   *
   * There is one criterion (`resolveRefFilter`, a pure function in the kernel), shared by the candidate side and the write side,
   * so "the dropdown can select it, but save says it is illegal" and "the dropdown cannot select it, but a handwritten id gets in"
   * are both structurally impossible. It does not depend on two SQL statements being written the same way.
   *
   * ⚠️ It does not replace preconditions. The two moments differ. The filter governs what can be picked at entry time.
   * A precondition governs whether this document holds when that edge is walked. A reference disabled after it is selected and before submit
   * is stopped only by the latter, so none of the existing `ref_field_compare` entries are deleted.
   */
  readonly refFilter: RefFilter | null;
  /**
   * Which record this cell selects by default. From the candidates `refFilter` circled, these conditions pick exactly one.
   *
   * The use is "after the production goods are selected, the BOM and the routing fall on that goods' default version, and can still be switched":
   * ```ts
   * { key: "bomId", type: "ref", ref: "bom",
   *   refFilter: { productId: { from: "$line.productId" }, status: "active" },
   *   refPreselect: { isDefault: true } }
   * ```
   *
   * Three hard rules. Missing one turns this mechanism into a wrong value whose cause cannot be found:
   *
   * 1. 🔴 The candidate set reuses the `refFilter` copy. It does not open another coordinate. The default must be a record the user can also select in the dropdown.
   *    A second query produces "a record the dropdown cannot select was filled in automatically", and each side looks normal on its own.
   * 2. 🔴 Fill only when there is exactly one. Zero or more than one is never filled. Do not guess and do not take the first. Two "default versions"
   *    in the candidates, and taking the first, yields a wrong value that looks completely normal (the other one is equally legal),
   *    and sorting by id or creation time means a different batch of data gets a different answer. "The default version is unique" has
   *    its own `single_default_*` gates on BOM and routing, but those are gates on the activate edge. The declaration layer does not assume they are constantly true.
   * 3. An overridable starting value, the same rule as `refDefault` and the opposite of `snapshot`. A non-empty value from the user or the Agent
   *    is stored as given, and the default is filled only when the cell is empty. So it does not enter `isSystemSupplied`. The user still owns this cell.
   *
   * The server fulfills it (`refPreselectSitesOf` projects the coordinate, and storage counts the rows). The browser, the Agent, and a direct API
   * share one criterion. The form copy is the experience (the goods selection is visible immediately). It is not a second criterion.
   */
  readonly refPreselect: RefPreselect | null;
  /**
   * The sibling shape of `refPreselect`: fill automatically when the candidate set itself has exactly one record, instead of picking "the default one" with an extra condition.
   *
   * Used where a coordinate has at most one candidate. The typical case is the single BOM or routing in effect for one product:
   * `refFilter: { productId, status: "active" }` has already narrowed the candidates to "the one currently in effect for that product",
   * and the lifecycle `singleActiveWithin` guarantees only one `active` for a product at a time, so the candidate set is naturally at most 1.
   * There is then no third field to write into `refPreselect` (`status` is already on `refFilter`, and a repeated key is
   * rejected by `REF_PRESELECT_KEY_SHADOWS_FILTER`), so this flag declares "a unique candidate is selected automatically":
   * ```ts
   * { key: "bomId", type: "ref", ref: "bom",
   *   refFilter: { productId: { from: "$line.productId" }, status: "active" },
   *   refPreselectSole: true }
   * ```
   *
   * It shares the fulfillment chain with `refPreselect` (`refPreselectSitesOf` projects the coordinate, storage counts the rows, and only exactly one is filled).
   * The difference is one sentence: the condition set is the `refFilter` copy, with no default condition stacked on it. The three hard constraints do not change:
   * the candidate set is not copied, only exactly one is filled, and the starting value is overridable. A `refFilter` is required (otherwise it counts "the one unique record" across the whole tenant).
   * It is mutually exclusive with `refPreselect`, `refDefault`, and the system-supplied mechanisms.
   */
  readonly refPreselectSole: boolean;
  /**
   * On a new empty table, lay out every candidate this column's `refFilter` circles as a row.
   *
   * The use is a completion receipt that, after a production order is selected, brings in the qualified supply that can still be received. It must be declared explicitly.
   * It must not take effect implicitly from "a line-table ref filtered by a header ref". That would pour the candidates of a customer receipt or a purchase receipt
   * into the draft a page at a time.
   *
   * Meaningful only on a line `ref`. The gate: there must be a `refFilter` that contains only `$bill.`, the table's
   * `maxRows` is not 1, and there is no required `refLine`. Consumers go through `headerEmptyFillOf`.
   */
  readonly headerEmptyFill?: true;
  /**
   * Which line table of the `ref` module this `refLine` points at. Null for every other type.
   *
   * 🔴 Required. It is not inferred from "that module has only one line table". What can be inferred today fails tomorrow when the upstream adds a line table
   * (an order adds a "gift lines" table), and the failure sits in the downstream module, where the person changing the declaration cannot see it.
   */
  readonly through: string | null;
  /**
   * When the same layer has several refs pointing at the same module, name the header companion ref of this refLine explicitly.
   * The default still uses the old one-to-one automatic pairing. Only a layer that is ambiguous needs the declaration.
   */
  readonly refOwner?: string | null;
  /**
   * A derive means a derived field: read-only, not editable by hand, computed by the framework.
   * Three shapes: rollup (aggregate downstream), lookup (bring across a relation), formula (computed on the same row).
   * 🔴 A derived field still keeps its real type (a line amount is money). The formula only says how it is computed.
   */
  readonly derive: Derive | null;
  /**
   * Computed from an expression on the same layer at save time, and stored in a column. The only difference from `derive.formula` is when it is stored:
   * calculate is a frozen business fact (it has a column). derive.formula is a projection recomputed at query time (it has no column).
   */
  readonly calculate: Expr | null;
  /** When the reference exists, the server freezes the source field. The client and the Agent cannot write it. */
  readonly snapshot: Snapshot | null;
  /** Prefill the source field when the reference is selected. The user and the Agent may overwrite it. The server fills the default only when the value is missing. */
  readonly refDefault: ReferenceDefault | null;
  /** Offer main and auxiliary unit candidates from the product reference on the same layer, and write the matching conversion factor into factorInto. */
  readonly unitChoice: UnitChoice | null;
  /**
   * The total of this document's lines. It has a column, the system writes it, and a person must not fill it (see `LineAgg`).
   *
   * Mutually exclusive with `derive`: one field cannot both be "computed at query time, no column" and "computed at write time, stored".
   * Mutually exclusive with `auto`: numbering is sequence allocation, a total is computed from the lines.
   */
  readonly lineAgg: LineAgg | null;
  /**
   * This cell holds a person, and a person who can be addressed to an account.
   *
   * 🔴 The only reason to declare it: `type` alone cannot tell them apart. "Equipment owner" and "buyer" are both
   * `type:"string"`, but the first stores a platform user id and the second is a name typed by hand. The repo has no system-user
   * module to ref (the identity source of truth is in the external identity gateway), so this difference is completely invisible in the type system.
   *
   * A field that is not marked does not appear in the notification recipient dropdown, so the user cannot configure a rule that can never be sent.
   * That is much better than letting them select it and then erroring at runtime.
   *
   * The platform field `createdBy` carries `{ role:"creator", via:"self" }` on its own. Modules do not write it.
   */
  readonly person?: PersonDecl | null;
  /** Not written by default. When and how to write it is in `domains/AGENTS.md`, "modeling invariants". */
  readonly help: string | null;
  /**
   * Which field of the source document this cell takes its value from on push. The default is the same layer (header to header, line column to line column).
   * When a line column writes this key and the source line has no such cell, it falls back to the source header. Spreading a header fact onto every line must be said explicitly.
   * A same name that happens to match does not take this path.
   *
   * The default push mapping is "same key, same type". It cannot express carrying a value under a different name, and a renamed carry is not a special case:
   *   · a shipment line's `price` wants the order line's net price after discount (`netPrice`), not the list price `price`
   *   · "purchase receipt from purchase order" and "invoice from shipment" are the same shape
   * The criterion is a foreseeable n, not today's n (the escape-hatch section of AGENTS.md), so it is a general key.
   * Do not open an if for salesDelivery inside the renderer or the executor.
   *
   * 🔴 It may point at a derived field of the source (`netPrice` is a formula). This does not violate
   * `EFFECT_AMOUNT_NOT_STORED`. That rule says a ledger amount accepts only a stored fact (a derive would be recomputed).
   * Here the evaluated result is frozen into the target's own column, the same discipline as a line freezing `spec` and `unit`.
   * After the freeze, the target's `amount` is computed from its own columns. A later change to the source discount wording does not rewrite a document already issued.
   *
   * ⚠️ The freeze point rounds once. The net price is stored at the decimal places of `money`, so `qty × netPrice` and
   * the order line's `amount` may differ in the last place when the discount does not divide evenly. That is the necessary cost of the wording "a shipment has its own deal price".
   * It is not a bug. A difference of zero would mean allocating by ratio, which is a different decision.
   */
  readonly pushFrom: string | null;
  /**
   * Columns of the line table when type === 'subtable'. Null for every other type.
   *
   * 🔴 Not a seventh concept. It lives on ① Field, at the same rank as `derive`, `options`, and `ref`.
   *
   * Why a line is not its own module: a line has no state machine of its own, no handoff, and no list page.
   * It meets none of the definitions of a module. Building a module file for the lines of every document is taxing 97%
   * for a 3% case, again.
   *
   * Only one level: a line table's columns must not nest another subtable. A line of a line has no counterpart in an ERP.
   * Opening that would force the renderer and table creation to handle unbounded depth.
   */
  readonly fields: readonly Field[] | null;
  /**
   * The maximum number of rows in a line table. Meaningful only on `type: 'subtable'`.
   * The write path and the form share it: more than that is rejected, and the UI no longer offers "add a row".
   */
  readonly maxRows?: number | null;
  /**
   * A line column brings an overridable default from a header cell. Meaningful only on a line-table column.
   * When that header cell changes, the consumer writes the same number into this column (the smallest implementation: always follow the header).
   */
  readonly defaultFrom?: { readonly header: string } | null;
  /**
   * Server logic on the write path overwrites this cell. A value the user filled is ignored.
   *
   * Unlike `auto`: `auto` goes through the platform number allocator, has a column, and is written by the sequence allocator.
   * `systemGenerated` is code on the write path (for example `billRepo` computing an internal code for `product.lines.barcode`
   * as `{headerCode}-{seq:03d}-{checksum}`) overwriting the value the client sent.
   *
   * Both enter `isSystemSupplied`: neither the user nor the agent may fill them, and they do not appear in a template.
   * The fulfillment mechanism on the write path differs, but the template and the value gate see the same meaning.
   *
   * 🔴 Additive, default false. No module is forced to declare it. Only a module that really has a "write path overwrites it"
   * field marks it (for example `product.lines.barcode`).
   */
  readonly systemGenerated?: boolean;
  /**
   * Only a declarative Planner `createBill` command may supply this cell, and only when generating the target document.
   *
   * The value enters the Planner preview fingerprint and is stored with the whole transaction after the user confirms. Ordinary create, save, import,
   * the UI, and the Agent have no write entry. Unlike `systemGenerated`, the framework does not compute or overwrite it itself.
   * The Planner must give the value explicitly, so table creation can safely emit NOT NULL.
   *
   * 🔴 Additive, default false. It is general write-channel semantics. It does not represent any module's business.
   */
  readonly plannerSupplied?: boolean;
  /**
   * 🔴 Additive, default false. Only the form and line UI do not render this cell. The database still has the column, the write path
   * still consumes it, and `views.list.columns` still follows the declaration.
   *
   * The use is "the column must exist (the write path, the list, and queries all need it), but the form should not let a person fill it by hand".
   *
   * It contradicts `unique` and `required`. The user cannot fill a hidden field, so attaching either of those blocks modeling forever.
   * The semantic gates `FIELD_HIDDEN_REQUIRED` and `FIELD_HIDDEN_UNIQUE` reject it directly.
   *
   * It does not affect `views.list`. List visibility is decided by the `columns` declaration. This key governs only the form renderer
   * (`SubtableEditor` / `FieldControl`). If a list also needs to hide it later, open `listHidden`.
   * Do not overload this key.
   */
  readonly hidden?: boolean;
}

const FIELD_KEYS = [
  "key",
  "label",
  "type",
  "required",
  "primary",
  "unique",
  "uniqueWith",
  "uniqueDefaultWithin",
  "generatedSequence",
  "stampOnFirstEnter",
  "auto",
  "requiredOnManualCreate",
  "createDefault",
  "createDefaultBy",
  "options",
  "choiceSet",
  "multiple",
  "format",
  "ref",
  "refFilter",
  "refPreselect",
  "refPreselectSole",
  "headerEmptyFill",
  "through",
  "refOwner",
  "derive",
  "calculate",
  "snapshot",
  "refDefault",
  "unitChoice",
  "lineAgg",
  "person",
  "help",
  "pushFrom",
  "fields",
  "maxRows",
  "defaultFrom",
  "systemGenerated",
  "plannerSupplied",
  "hidden",
] as const;

const DERIVE_MEASURE = /^([a-z]+)\(\s*([a-zA-Z_][a-zA-Z0-9_]*)?\s*\)$/;

// ── Formulas: normalization ────────────────────────────────────────────────

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    schemaFail(`${label} must be a finite number (received ${JSON.stringify(value)})`);
  }
  return value;
}

/**
 * Arity. `add`, `mul`, and `max` are associative and take n operands (at least 2). `sub` and `div` take exactly two.
 * `a - b - c` has two readings. Reject it at modeling time instead of picking one.
 */
const OP_EXACT_ARITY: Readonly<Record<FormulaOp, number | null>> = Object.freeze({
  add: null,
  mul: null,
  max: null,
  sub: 2,
  div: 2,
});

const EXPR_FORMS = ["field", "value", "op", "orElse"] as const;

/** Normalize an expression tree. A wrong shape throws at load time, not when some row is evaluated. */
export function normalizeExpr(raw: unknown, label: string): Expr {
  const obj = requireObject(raw, label);
  const forms = EXPR_FORMS.filter((k) => obj[k] !== undefined);
  if (forms.length !== 1) {
    schemaFail(
      `${label} must be one of { field } / { value } / { op, args } / { orElse }: ` +
        (forms.length === 0 ? "an empty node was received" : `received more than one of "${forms.join(", ")}"`),
    );
  }

  if (obj["field"] !== undefined) {
    assertClosedKeys(obj, ["field"], label);
    return { field: requireText(obj["field"], `${label}.field`) };
  }

  if (obj["value"] !== undefined) {
    assertClosedKeys(obj, ["value"], label);
    return { value: requireFiniteNumber(obj["value"], `${label}.value`) };
  }

  if (obj["orElse"] !== undefined) {
    assertClosedKeys(obj, ["orElse"], label);
    const inner = requireObject(obj["orElse"], `${label}.orElse`);
    assertClosedKeys(inner, ["of", "whenEmpty"], `${label}.orElse`);
    return {
      orElse: {
        of: normalizeExpr(inner["of"], `${label}.orElse.of`),
        whenEmpty: requireFiniteNumber(inner["whenEmpty"], `${label}.orElse.whenEmpty`),
      },
    };
  }

  assertClosedKeys(obj, ["op", "args"], label);
  const op = requireEnum(obj["op"], FORMULA_OPS, `${label}.op`);
  const args = requireArray(obj["args"], `${label}.args`).map((a, i) => normalizeExpr(a, `${label}.args[${i}]`));
  const exact = OP_EXACT_ARITY[op];
  if (exact === null) {
    if (args.length < 2) schemaFail(`${label}: ${op} needs at least two operands (received ${args.length})`);
  } else if (args.length !== exact) {
    schemaFail(`${label}: ${op} accepts exactly ${exact} operands (received ${args.length}). A multi-operand ${op} does not have one reading, and this does not guess for you`);
  }
  return { op, args };
}

/** Every field key referenced in an expression, deduped. Static checks look up references from this. */
export function formulaFields(expr: Expr): readonly string[] {
  const out = new Set<string>();
  const walk = (node: Expr): void => {
    if ("field" in node) {
      out.add(node.field);
      return;
    }
    if ("value" in node) return;
    if ("orElse" in node) {
      walk(node.orElse.of);
      return;
    }
    for (const a of node.args) walk(a);
  };
  walk(expr);
  return [...out];
}

// ── Formulas: self-explanation ─────────────────────────────────────────────

const OP_TEXT: Readonly<Record<FormulaOp, string>> = Object.freeze({
  add: " + ",
  sub: " - ",
  mul: " × ",
  div: " ÷ ",
  max: ", ",
});

function precedenceOf(expr: Expr): number {
  if (!("op" in expr)) return 3;
  if (expr.op === "max") return 3;
  return expr.op === "add" || expr.op === "sub" ? 1 : 2;
}

/**
 * Render a formula in words a person can read. explain and the UI use this same copy.
 * "Where this number came from" should not have a second wording.
 */
export function describeFormula(expr: Expr): string {
  if ("field" in expr) return expr.field;
  if ("value" in expr) return String(expr.value);
  if ("orElse" in expr) {
    const inner = expr.orElse.of;
    const text = "op" in inner ? `(${describeFormula(inner)})` : describeFormula(inner);
    return `${text} (empty counts as ${String(expr.orElse.whenEmpty)})`;
  }
  const self = precedenceOf(expr);
  const op = expr.op;
  if (op === "max") return `max(${expr.args.map(describeFormula).join(OP_TEXT.max)})`;
  return expr.args
    .map((arg, i) => {
      const child = describeFormula(arg);
      // A lower-precedence child must be parenthesized. The right operand of subtract or divide must be parenthesized at the same precedence too.
      // a - (b - c) is not the same as a - b - c. Dropping the parentheses in the words makes it a different formula.
      const samePrecRight = i > 0 && (op === "sub" || op === "div") && precedenceOf(arg) === self;
      return precedenceOf(arg) < self || samePrecRight ? `(${child})` : child;
    })
    .join(OP_TEXT[op]);
}

// ── Formulas: evaluation ───────────────────────────────────────────────────
//
// 🔴 A pure function, zero IO. It accepts only one argument, "one row of data". A formula always references fields on the same row.
// A derivation across rows or documents is rollup or lookup, and is not opened here.

/**
 * The only criterion of "not filled".
 *
 * 🔴 Exported. The `required_fields` precondition, instance validation (`instance.ts`), and formula evaluation
 * must judge the same fact. Two copies do not error: the form says "filled" and the gate says "not filled",
 * or the reverse, and each conclusion looks reasonable on its own.
 *
 * A blank string is not in this set. The caller trims first (`trimmed` in `instance.ts`). That boundary is deliberate:
 * formula evaluation must not quietly change the value it was given.
 */
export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * A field value, as a number.
 *
 * A numeric string that can be parsed is accepted. A numeric column often arrives as a string through JSON (decimal keeps precision).
 * That is a difference of representation, not a missing-value fallback. What cannot be parsed still throws.
 *
 * 🔴 Exported. Write validation (`instance.ts`) and formula / line-total evaluation must judge the same
 * "what counts as a number". Two copies will drift, and the drift shows up as the same value being legal before save and illegal after, or the reverse.
 */
export function fieldNumber(raw: unknown, label: string): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) schemaFail(`${label} is not a finite number: ${String(raw)}`);
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) schemaFail(`${label} expected a number, received "${raw}"`);
    return n;
  }
  return schemaFail(`${label} expected a number, received ${typeof raw}`);
}

function apply(op: FormulaOp, args: readonly number[]): number {
  if (op === "add") return args.reduce((a, b) => a + b, 0);
  if (op === "mul") return args.reduce((a, b) => a * b, 1);
  if (op === "max") return Math.max(...args);
  const [left, right] = args;
  // Arity was pinned by normalizeExpr. This only lets the type converge. It does not silently fill a default.
  if (left === undefined || right === undefined) schemaFail(`formula: ${op} is missing an operand`);
  if (op === "sub") return left - right;
  if (right === 0) schemaFail("formula: divisor is 0. Dividing by zero has no value. It does not return 0 and it does not return infinity");
  return left / right;
}

/**
 * "Is this key a formula column" inside one layer. Used by `evalNode` to resolve a formula that references a formula.
 *
 * 🔴 Without it the computation is silently wrong. A formula column builds no column, so the row data has no such key,
 * `isEmptyValue` treats it as empty, lenient mode returns null, and that row is left out of the total.
 * This was measured: `amount = qty × netPrice` (netPrice is itself a formula) stored the header `totalAmount` as 0,
 * and 0 is a completely legal total. A shipment of 3600 was posted to receivables as 0.
 *
 * A chain of references is a shape the declaration layer already accepts. `validate.ts` has `findCycle` specifically to find cycles between formulas,
 * and looking for a cycle presupposes that a formula may reference a formula. If the evaluator does not follow, a shape the gate accepts cannot be computed at runtime.
 */
export type FormulaResolver = (key: string) => Expr | null;

/**
 * When lenient is true, "the field was not filled" returns null (for the editing UI). When false, it throws.
 * In both modes a type error and division by zero always throw. Only "not filled" has two readings.
 *
 * `seen` stops a cycle. `findCycle` in `validate.ts` should have stopped it first. Reaching here means the declaration missed the gate
 * (a handwritten schema, JSON pasted back), and a silent infinite recursion shows up as the whole process overflowing its stack.
 */
function evalNode(
  expr: Expr,
  row: Readonly<Record<string, unknown>>,
  lenient: boolean,
  resolver: FormulaResolver | null = null,
  seen: readonly string[] = [],
): number | null {
  if ("field" in expr) {
    const raw = row[expr.field];
    if (isEmptyValue(raw)) {
      // 🔴 When the stored value cannot be read, first ask whether it is a formula column on the same layer. A formula builds no column,
      // so it is absent from the row data by nature. That is not "not filled".
      const nested = resolver?.(expr.field) ?? null;
      if (nested !== null) {
        if (seen.includes(expr.field)) {
          return schemaFail(
            `formula reference cycle: ${[...seen, expr.field].join(" → ")}. The declaration missed the FORMULA_CYCLE gate`,
          );
        }
        return evalNode(nested, row, lenient, resolver, [...seen, expr.field]);
      }
      if (lenient) return null;
      return schemaFail(
        `formula field "${expr.field}" has no value. An empty value must declare its default with orElse. It is not silently treated as 0`,
      );
    }
    // A bool is 0/1: a switch column may be a multiplier. Recognized only inside formula evaluation, not inside fieldNumber.
    // Recognized only inside formula evaluation, not inside fieldNumber. The write gate of a numeric cell still does not accept true/false.
    if (typeof raw === "boolean") return raw ? 1 : 0;
    return fieldNumber(raw, `formula field "${expr.field}"`);
  }
  if ("value" in expr) return expr.value;
  if ("orElse" in expr) {
    // 🔴 This step is a declared default, not a silent fallback. It is written in the schema, and explain can say it.
    const inner = evalNode(expr.orElse.of, row, true, resolver, seen);
    return inner === null ? expr.orElse.whenEmpty : inner;
  }
  const args: number[] = [];
  for (const arg of expr.args) {
    const v = evalNode(arg, row, lenient, resolver, seen);
    // null is possible only in lenient mode: a field inside a subexpression was not filled, so the whole expression cannot be computed yet.
    if (v === null) return null;
    args.push(v);
  }
  return apply(expr.op, args);
}

/**
 * Evaluate. A pure function, zero IO. The server uses it at query time to compute formula columns (a formula builds no column; see codegen).
 *
 * A field with no value, a value that is not a number, and a divisor of 0 all throw. To accept an empty value, write `orElse` in the declaration.
 */
export function evaluateFormula(
  expr: Expr,
  row: Readonly<Record<string, unknown>>,
  /** Formula columns on the same layer (used when a formula references a formula). Omit it to accept only stored values. */
  resolver: FormulaResolver | null = null,
): number {
  const value = evalNode(expr, row, false, resolver);
  if (value === null) return schemaFail("formula evaluation produced an empty value. That must not happen outside lenient mode, so the evaluator was broken");
  return value;
}

/**
 * Build a formula resolver from one layer of field declarations.
 *
 * 🔴 One source of truth. Everywhere a formula is evaluated (header totals, query projections, line-table footers) builds it from here,
 * and does not each write "find the ones whose derive.kind === 'formula'". Two copies show up as
 * some consumers supporting chained references and some not, and the side that does not computes 0 (a legal but wrong number).
 */
export function formulaResolverOf(fields: readonly Field[]): FormulaResolver {
  const byKey = new Map<string, Expr>();
  for (const f of fields) {
    if (f.derive !== null && f.derive.kind === "formula") byKey.set(f.key, f.derive.expr);
    if (f.calculate != null) byKey.set(f.key, f.calculate);
  }
  return (key) => byKey.get(key) ?? null;
}

/**
 * Evaluate, but return null instead of throwing when an input field has not been filled yet.
 *
 * For the editing UI. A line that was just added has empty qty and price by nature.
 * "Cannot be computed yet" is a fact, not an error. Return null (shown as "pending") rather than 0.
 * A total would treat 0 as a real zero amount, and the books would be wrong.
 * A wrong type and a divisor of 0 still throw. Those two are real errors.
 */
export function evaluateFormulaOrNull(
  expr: Expr,
  row: Readonly<Record<string, unknown>>,
  /** Formula columns on the same layer (used when a formula references a formula). Omit it to accept only stored values. */
  resolver: FormulaResolver | null = null,
): number | null {
  return evalNode(expr, row, true, resolver);
}

/**
 * The visible value of one layer during editing. Local formulas and stored calculations are evaluated against the current draft immediately. Other fields are returned as-is.
 *
 * `calculate` is still computed and frozen by the server save transaction. This does not write the draft back. It lets the user, after changing any
 * operand, see the result that will be saved. Otherwise the unit factor has already gone from 100 to 1 while the main-unit quantity still shows
 * the previously stored 2000, and jumps to 20 only after save. One row would state two contradictory facts at once.
 * The resolver is taken from the whole layer, so calculate and formula referencing each other use the same dependency graph as the server.
 */
export function evaluateLocalDraftValue(
  field: Field,
  row: Readonly<Record<string, unknown>>,
  fields: readonly Field[],
): unknown {
  const expr = field.calculate ?? (field.derive?.kind === "formula" ? field.derive.expr : null);
  return expr === null ? row[field.key] : evaluateFormulaOrNull(expr, row, formulaResolverOf(fields));
}

// ── derive ──────────────────────────────────────────────────────────────────

function normalizeDerive(raw: unknown, label: string): Derive {
  const obj = requireObject(raw, label);
  const kind = requireEnum(obj["kind"], DERIVE_KINDS, `${label}.kind`);

  // A formula looks only at this row. It has no from or match. Those two keys belong to a cross-document derivation.
  if (kind === "formula") {
    assertClosedKeys(obj, ["kind", "expr"], label);
    return { kind, expr: normalizeExpr(obj["expr"], `${label}.expr`) };
  }

  const from = requireText(obj["from"], `${label}.from`);
  const match = requireText(obj["match"], `${label}.match`);
  // Which layer. Absent means the header (the classic shape). Non-null drills into the rows of that line table.
  // There is no default of "drill automatically". A declaration that meant to aggregate the header would silently aggregate lines,
  // and the result would be a larger number that looks completely normal.
  const throughRaw = obj["through"];
  const through = throughRaw === undefined || throughRaw === null ? null : requireText(throughRaw, `${label}.through`);

  if (kind === "lookup") {
    assertClosedKeys(obj, ["kind", "from", "match", "through", "field"], label);
    return { kind, from, match, through, field: requireText(obj["field"], `${label}.field`) };
  }

  assertClosedKeys(obj, ["kind", "from", "match", "on", "through", "measure", "where"], label);
  const onRaw = obj["on"];
  const on = onRaw === undefined || onRaw === null ? null : requireCoordinateSegment(onRaw, `${label}.on`);
  if (on === "id") schemaFail(`${label}.on: when aggregating by this layer's id, omit on. Do not redeclare a platform field`);
  const measureText = requireText(obj["measure"], `${label}.measure`);
  const parsed = DERIVE_MEASURE.exec(measureText);
  if (!parsed?.[1]) {
    schemaFail(`${label}.measure "${measureText}" is illegal: the form is agg(field), for example sum(qty); count takes no field`);
  }
  const agg = requireEnum(parsed[1], DERIVE_AGGS, `${label}.measure aggregation`);
  const measure = parsed[2] ?? null;
  if (agg === "count" && measure !== null) schemaFail(`${label}.measure: count does not take a field argument`);
  if (agg !== "count" && measure === null) schemaFail(`${label}.measure: ${agg} must name a field, for example ${agg}(qty)`);

  const whereRaw = obj["where"];
  // The same normalizer as related_agg's where. An array means in ("not yet settled" is naturally a set of statuses).
  // A value may only be a scalar or an array of scalars. Allowing an object opens a mini query language nobody implements.
  const where = whereRaw === undefined || whereRaw === null ? null : normalizeRowFilter(whereRaw, `${label}.where`);
  return on === null
    ? { kind, from, match, through, agg, measure, where }
    : { kind, from, match, on, through, agg, measure, where };
}

function normalizeUniqueDefaultWithin(raw: unknown, at: string, type: FieldType): UniqueDefaultWithin {
  if (type !== "bool") schemaFail(`${at} may be attached only to a bool field (this field is ${type})`);
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["within", "status"] as const, at);
  const withinRaw = requireArray(obj["within"], `${at}.within`);
  if (withinRaw.length === 0) schemaFail(`${at}.within must not be an empty array: a coordinate needs at least one dimension`);
  return {
    within: withinRaw.map((item, i) => requireCoordinateSegment(item, `${at}.within[${i}]`)),
    status: requireText(obj["status"], `${at}.status`),
  };
}

function normalizeGeneratedSequence(raw: unknown, at: string): GeneratedSequence {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["kind", "within"] as const, at);
  const kind = requireEnum(obj["kind"], ["majorMinor"] as const, `${at}.kind`);
  const withinRaw = requireArray(obj["within"], `${at}.within`);
  if (withinRaw.length === 0) schemaFail(`${at}.within must not be an empty array: a sequence needs at least one coordinate dimension`);
  return {
    kind,
    within: withinRaw.map((item, i) => requireCoordinateSegment(item, `${at}.within[${i}]`)),
  };
}

function normalizeStampOnFirstEnter(raw: unknown, at: string, type: FieldType): StampOnFirstEnter {
  if (type !== "date" && type !== "datetime") {
    schemaFail(`${at} may be attached only to a date or datetime field (this field is ${type})`);
  }
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["status"] as const, at);
  return { status: requireText(obj["status"], `${at}.status`) };
}

export function normalizeField(raw: unknown, label = "field", allowSubtable = true): Field {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, FIELD_KEYS, label);
  const key = requireCoordinateSegment(obj["key"], `${label}.key`);
  const at = `fields.${key}`;
  const type = requireEnum(obj["type"], FIELD_TYPES, `${at}.type`);
  const multipleRaw = obj["multiple"];
  if (multipleRaw !== undefined && multipleRaw !== true) {
    schemaFail(`${at}.multiple accepts only true. Omitting it means single-select`);
  }
  const multiple = multipleRaw === true;
  const formatRaw = obj["format"];
  if (formatRaw !== undefined && formatRaw !== "time") {
    schemaFail(`${at}.format currently accepts only "time"`);
  }
  if (formatRaw !== undefined && type !== "string") {
    schemaFail(`${at}.format is meaningful only on string`);
  }
  if (multiple && type !== "enum") {
    schemaFail(`${at}.multiple is meaningful only on enum. Multi-select candidates come from the same place as single-select, and other types have no 'set of values' shape`);
  }
  const createDefaultRaw = obj["createDefault"];
  const createDefault =
    createDefaultRaw === undefined || createDefaultRaw === null
      ? null
      : requireEnum(createDefaultRaw, ["today", "now"] as const, `${at}.createDefault`);
  const createDefaultByRaw = obj["createDefaultBy"];
  const createDefaultBy = (() => {
    if (createDefaultByRaw === undefined || createDefaultByRaw === null) return null;
    if (type !== "bool") schemaFail(`${at}.createDefaultBy may be attached only to a bool field (this field is ${type})`);
    const config = requireObject(createDefaultByRaw, `${at}.createDefaultBy`);
    assertClosedKeys(config, ["field", "values"] as const, `${at}.createDefaultBy`);
    const source = requireCoordinateSegment(config["field"], `${at}.createDefaultBy.field`);
    const rawValues = requireObject(config["values"], `${at}.createDefaultBy.values`);
    const values: Record<string, boolean> = {};
    for (const [sourceValue, value] of Object.entries(rawValues)) {
      if (typeof value !== "boolean") {
        schemaFail(`${at}.createDefaultBy.values.${sourceValue} must be true or false`);
      }
      values[sourceValue] = value;
    }
    if (Object.keys(values).length === 0) schemaFail(`${at}.createDefaultBy.values must not be empty`);
    return { field: source, values };
  })();
  if (createDefault === "today" && type !== "date") {
    schemaFail(`${at}.createDefault="today" may be attached only to a date field (this field is ${type})`);
  }
  if (createDefault === "now" && type !== "datetime") {
    schemaFail(`${at}.createDefault="now" may be attached only to a datetime field (this field is ${type})`);
  }
  if (type === "subtable" && !allowSubtable) {
    schemaFail(`${at}: a line table's columns must not nest another subtable. Lines are only one level deep. A line of a line has no counterpart in an ERP`);
  }

  const optionsRaw = obj["options"];
  const choiceSetRaw = obj["choiceSet"];
  const unitChoiceRaw = obj["unitChoice"];
  let options: readonly EnumOption[] | null = null;
  if (optionsRaw !== undefined && optionsRaw !== null) {
    // Closed in the reverse direction, the same shape as `fields` below. Only enum understands `options`.
    // Hanging it on another type is a dead declaration. The modeler thinks the values were constrained, and nothing was constrained.
    if (type !== "enum") schemaFail(`${at}.options is meaningful only on an enum field (this field is ${type})`);
    options = normalizeEnumOptions(optionsRaw, `${at}.options`);
  }
  const choiceSet =
    choiceSetRaw === undefined || choiceSetRaw === null
      ? null
      : requireText(choiceSetRaw, `${at}.choiceSet`);
  if (choiceSet !== null && type !== "enum") {
    schemaFail(`${at}.choiceSet is meaningful only on an enum field (this field is ${type})`);
  }
  const candidateSources = [options !== null, choiceSet !== null, unitChoiceRaw !== undefined && unitChoiceRaw !== null]
    .filter(Boolean).length;
  if (type === "enum" && candidateSources === 0) {
    schemaFail(`${at}: an enum field must declare exactly one of options, choiceSet, and unitChoice as its candidate source`);
  }

  const refRaw = obj["ref"];
  const ref = refRaw === undefined || refRaw === null ? null : requireText(refRaw, `${at}.ref`);
  // 🔴 The reverse direction must be closed too. Allowing `{type:'string', ref:'customer'}` breaks in two ways.
  // The loader's checkCrossReferences does not look at type and reports it as "module customer does not exist".
  // The hint is to build a module, when what should be done is to delete this ref.
  // If the ref target happens to exist, relationsOf filters on type === 'ref' and does not recognize it,
  // the customer detail page grows no reverse-lookup panel, and the modeler thinks a reference was declared, with zero errors.
  // A subtable's ref is the line-table name, not a module code, so it is in the allowed set.
  if (ref && type !== "ref" && type !== "refLine" && type !== "subtable") {
    schemaFail(`${at}.ref is meaningful only on a ref, refLine, or subtable field (this field is ${type})`);
  }
  if ((type === "ref" || type === "refLine" || type === "subtable") && !ref) {
    schemaFail(`${at}: a ${type} field must give the ref of the entity it points at`);
  }

  const refFilterRaw = obj["refFilter"];
  const refFilter =
    refFilterRaw === undefined || refFilterRaw === null ? null : normalizeRefFilter(refFilterRaw, `${at}.refFilter`);
  // Closed in the reverse direction, the same shape as `options` and `ref` above. Only a reference type has candidates.
  // Hanging it elsewhere is a dead declaration. The modeler thinks the range was constrained, nothing was constrained, and there is zero error.
  if (refFilter && type !== "ref") {
    schemaFail(
      type === "refLine"
        ? `${at}.refFilter does not support refLine (today n=0). Line candidates were already narrowed by the 'pick which upstream document first' step, ` +
            `and when another filter is really needed it is usually that first document-picking step, which selects a ref`
        : `${at}.refFilter is meaningful only on a ref field (this field is ${type}). ` +
            `Only a reference has a candidate set. Other types have nothing to filter`,
    );
  }
  // `$line.` has no referent on a header. Evaluating a header field has no row in hand. If it were allowed,
  // `resolveRefFilter` would treat it as "that cell has not been filled yet", so a declaration error shows up as
  // "please fill X first", and the user cannot find that cell anywhere on the form.
  if (refFilter && allowSubtable) {
    for (const [key, operand] of Object.entries(refFilter)) {
      if (isRefFilterRef(operand) && operand.from.startsWith("$line.")) {
        schemaFail(
          `${at}.refFilter.${key} uses ${operand.from}, but this field is on the header. ` +
            `Header evaluation has no current row. To take a value per row, put the reference on a line column`,
        );
      }
    }
  }
  // A self-reference is constantly empty. Filtering this cell's candidates by this cell's own value stays pending until the first selection,
  // and after a selection the candidates contain only itself. Neither is what anyone meant to say.
  if (refFilter) {
    for (const [k, operand] of Object.entries(refFilter)) {
      if (isRefFilterRef(operand) && operand.from.slice(operand.from.indexOf(".") + 1) === key) {
        schemaFail(`${at}.refFilter.${k} points at this field itself (${operand.from}). The candidates are constantly empty or constantly only itself`);
      }
    }
  }

  const refPreselectRaw = obj["refPreselect"];
  const refPreselect =
    refPreselectRaw === undefined || refPreselectRaw === null
      ? null
      : normalizeRefPreselect(refPreselectRaw, `${at}.refPreselect`);
  // Same reverse closure as refFilter. On a type with no candidate set, "which one is selected by default" is a dead declaration.
  if (refPreselect && type !== "ref") {
    schemaFail(
      `${at}.refPreselect is meaningful only on a ref field (this field is ${type}). ` +
        `It picks one record from the candidates, and only a record reference has a candidate set`,
    );
  }

  const refPreselectSole = obj["refPreselectSole"] === true;
  if (refPreselectSole && type !== "ref") {
    schemaFail(
      `${at}.refPreselectSole is meaningful only on a ref field (this field is ${type}). ` +
        `It fills the single record in the candidates, and only a record reference has a candidate set`,
    );
  }
  // Both write "when this cell is empty, fill the default record from the candidates". Only the way of picking differs (extra conditions versus a unique candidate).
  // Declaring both gives two fulfillment chains competing for the same empty cell. Which one runs first depends on implementation order, and both results are legal.
  if (refPreselectSole && refPreselect !== null) {
    schemaFail(
      `${at}: refPreselect and refPreselectSole are mutually exclusive. The first picks the default from the candidates by conditions, ` +
        `the second requires the candidate set itself to be unique. One cell can have only one preselect wording`,
    );
  }

  if (obj["headerEmptyFill"] === true && type !== "ref") {
    schemaFail(
      `${at}.headerEmptyFill is meaningful only on a ref field (this field is ${type}). ` +
        `It lays out the records in this column's candidate set, and only a record reference has a candidate set`,
    );
  }
  const headerEmptyFill = obj["headerEmptyFill"] === true ? true : undefined;

  const throughRaw = obj["through"];
  const through = throughRaw === undefined || throughRaw === null ? null : requireText(throughRaw, `${at}.through`);
  const refOwnerRaw = obj["refOwner"];
  const refOwner = refOwnerRaw === undefined || refOwnerRaw === null
    ? null
    : requireCoordinateSegment(refOwnerRaw, `${at}.refOwner`);
  if (through && type !== "refLine") {
    schemaFail(`${at}.through is meaningful only on a refLine field (this field is ${type})`);
  }
  if (refOwner !== null && type !== "refLine") {
    schemaFail(`${at}.refOwner is meaningful only on a refLine field (this field is ${type})`);
  }
  if (type === "refLine") {
    // 🔴 Do not infer. The upstream having only one line table today does not mean it still will tomorrow, and the person who adds the second
    // is in the upstream module and cannot see the downstream resolving line references on the assumption that there is only one.
    if (!through) {
      schemaFail(
        `${at}: a refLine must give through (which line table of module "${String(ref)}"). ` +
          `Do not infer it from 'there is only one line table over there'. When the upstream later adds a second, the inference silently changes meaning in an unrelated module`,
      );
    }
    if (allowSubtable) {
      // allowSubtable true means this layer is the header (the line-column layer passes false).
      schemaFail(
        `${at}: a refLine may be declared only on a line column. A header pointing at one line has no business reading: ` +
          `when one document merges several upstream documents, the 'source line' on the header can point at only one of them, and it looks completely normal`,
      );
    }
  }

  const deriveRaw = obj["derive"];
  const derive = deriveRaw === undefined || deriveRaw === null ? null : normalizeDerive(deriveRaw, `${at}.derive`);
  const calculateRaw = obj["calculate"];
  const calculate =
    calculateRaw === undefined || calculateRaw === null ? null : normalizeExpr(calculateRaw, `${at}.calculate`);
  const snapshotRaw = obj["snapshot"];
  let snapshot: Snapshot | null = null;
  if (snapshotRaw !== undefined && snapshotRaw !== null) {
    const rawSnapshot = requireObject(snapshotRaw, `${at}.snapshot`);
    assertClosedKeys(rawSnapshot, ["from", "match", "through", "field", "optional"], `${at}.snapshot`);
    const throughRaw = rawSnapshot["through"];
    const optionalRaw = rawSnapshot["optional"];
    if (optionalRaw !== undefined && typeof optionalRaw !== "boolean") {
      schemaFail(`${at}.snapshot.optional must be a boolean`);
    }
    snapshot = {
      from: requireText(rawSnapshot["from"], `${at}.snapshot.from`),
      match: requireText(rawSnapshot["match"], `${at}.snapshot.match`),
      through: throughRaw === undefined || throughRaw === null ? null : requireText(throughRaw, `${at}.snapshot.through`),
      field: requireText(rawSnapshot["field"], `${at}.snapshot.field`),
      ...(optionalRaw === true ? { optional: true } : {}),
    };
  }
  const refDefaultRaw = obj["refDefault"];
  let refDefault: ReferenceDefault | null = null;
  if (refDefaultRaw !== undefined && refDefaultRaw !== null) {
    const rawDefault = requireObject(refDefaultRaw, `${at}.refDefault`);
    assertClosedKeys(rawDefault, ["from", "match", "through", "field"], `${at}.refDefault`);
    const throughRaw = rawDefault["through"];
    refDefault = {
      from: requireText(rawDefault["from"], `${at}.refDefault.from`),
      match: requireText(rawDefault["match"], `${at}.refDefault.match`),
      through: throughRaw === undefined || throughRaw === null ? null : requireText(throughRaw, `${at}.refDefault.through`),
      field: requireText(rawDefault["field"], `${at}.refDefault.field`),
    };
  }
  let unitChoice: UnitChoice | null = null;
  if (unitChoiceRaw !== undefined && unitChoiceRaw !== null) {
    const rawChoice = requireObject(unitChoiceRaw, `${at}.unitChoice`);
    assertClosedKeys(rawChoice, ["match", "factorInto"], `${at}.unitChoice`);
    unitChoice = {
      match: requireCoordinateSegment(rawChoice["match"], `${at}.unitChoice.match`),
      factorInto: requireCoordinateSegment(rawChoice["factorInto"], `${at}.unitChoice.factorInto`),
    };
  }
  if (unitChoice !== null && type !== "string" && type !== "enum") {
    schemaFail(`${at}.unitChoice may be attached only to a string or enum field (this field is ${type})`);
  }
  if (unitChoice !== null && options !== null) {
    schemaFail(`${at}: unitChoice and options are mutually exclusive. Unit candidates recognize only the product unitSet as their source of truth`);
  }
  if (choiceSet !== null && (options !== null || unitChoice !== null)) {
    schemaFail(`${at}: choiceSet is mutually exclusive with options and unitChoice. An enum can have only one candidate source of truth`);
  }
  if (unitChoice !== null && snapshot !== null) {
    schemaFail(`${at}: unitChoice and snapshot are mutually exclusive. A unit is a choosable value, not a reference snapshot that cannot be edited`);
  }
  const auto = obj["auto"] === true;
  const lineAggRaw = obj["lineAgg"];
  const lineAgg = lineAggRaw === undefined || lineAggRaw === null ? null : normalizeLineAgg(lineAggRaw, `${at}.lineAgg`);

  // 🔴 The system-supplied legs are pairwise mutually exclusive. One field can have only one supply mechanism.
  //
  // This mutually exclusive group must come before the type gates below. `auto` requires string and `lineAgg` requires a number.
  // When both appear, which type gate is hit first depends on how it was written, so the same error is reported in two ways depending on the field type,
  // and one of them ("auto may be attached only to string") sends the person to change the type. That is not the real fault here.
  if (auto && derive) {
    schemaFail(`${at}: auto and derive are mutually exclusive. Numbering is sequence allocation, and derive is computed from existing data`);
  }
  // Giving both derive and lineAgg says "no column, computed at query time" and "stored, computed at write time" at once.
  // Table creation splits on isDerived and listens to derive (no column), while the write path writes a column that does not exist.
  if (lineAgg && derive) {
    schemaFail(
      `${at}: derive and lineAgg are mutually exclusive. derive builds no column and is computed at query time; lineAgg stores a column and is computed on save. ` +
        `Use lineAgg when this document's line total must be posted or looked up downstream. Use derive for a display-only wording`,
    );
  }
  if (lineAgg && auto) {
    schemaFail(`${at}: auto and lineAgg are mutually exclusive. Numbering is sequence allocation, and a total is computed from the lines`);
  }
  const mechanisms = [
    auto ? "auto" : null,
    derive ? "derive" : null,
    calculate ? "calculate" : null,
    lineAgg ? "lineAgg" : null,
    snapshot ? "snapshot" : null,
  ].filter((value): value is string => value !== null);
  if (createDefault !== null && createDefaultBy !== null) {
    schemaFail(`${at}.createDefault and createDefaultBy are mutually exclusive. A field can have only one create starting value`);
  }
  if ((createDefault !== null || createDefaultBy !== null) && mechanisms.length > 0) {
    schemaFail(
      `${at} create defaults cannot be declared together with ${mechanisms.join(", ")}. ` +
        `A create starting value may be overwritten by the user, and these mechanisms are system-supplied and not writable`,
    );
  }
  if (mechanisms.length > 1) {
    schemaFail(`${at}: ${mechanisms.join(", ")} are mutually exclusive. A field can have only one system-supplied source`);
  }
  if (unitChoice !== null && mechanisms.length > 0) {
    schemaFail(
      `${at}.unitChoice cannot be declared together with ${mechanisms.join(", ")}. The unit cell is chosen by the user from the product's main and auxiliary units, ` +
        `and it is not a system-supplied field`,
    );
  }
  if (refDefault !== null && mechanisms.length > 0) {
    schemaFail(
      `${at}.refDefault cannot be declared together with ${mechanisms.join(", ")}. ` +
        `A reference default is an overridable user value, and these mechanisms are system-supplied and not writable`,
    );
  }
  if (refPreselect !== null && mechanisms.length > 0) {
    schemaFail(
      `${at}.refPreselect cannot be declared together with ${mechanisms.join(", ")}. ` +
        `A candidate default selection is an overridable user value, and these mechanisms are system-supplied and not writable`,
    );
  }
  if (refPreselectSole && mechanisms.length > 0) {
    schemaFail(
      `${at}.refPreselectSole cannot be declared together with ${mechanisms.join(", ")}. ` +
        `Filling the unique candidate automatically is an overridable user value, and these mechanisms are system-supplied and not writable`,
    );
  }
  if (refPreselectSole && refDefault !== null) {
    schemaFail(
      `${at}: refPreselectSole and refDefault are mutually exclusive. Both fill a value only when this cell is empty, ` +
        `and declaring both gives one cell two default sources`,
    );
  }
  // Both starting values write the same cell, and only when it is empty. Declaring both gives two sources competing for one empty cell.
  // Which one runs first depends on implementation order, and both results are legal references, so picking the wrong one has no symptom.
  if (refPreselect !== null && refDefault !== null) {
    schemaFail(
      `${at}: refPreselect and refDefault are mutually exclusive. Both fill a value only when this cell is empty, ` +
        `and declaring both gives one cell two default sources. Use refDefault to copy a cell from the upstream document. ` +
        `Use refPreselect to pick the default record from this cell's own candidates`,
    );
  }

  if (auto && type !== "string") {
    schemaFail(`${at}: auto may be attached only to string (a document number is a text identity, not a number)`);
  }
  // A total evaluates to a number. If the field that carries it is not numeric, the value has no usable presentation or comparator.
  // Same criterion as FORMULA_RESULT_NOT_NUMERIC.
  if (lineAgg && !isNumericFieldType(type)) {
    schemaFail(
      `${at}: lineAgg evaluates to a number, but the field was declared as ${type}. Change it to one of ${NUMERIC_FIELD_TYPES.join(" / ")}`,
    );
  }
  if (calculate && !isNumericFieldType(type)) {
    schemaFail(
      `${at}: calculate evaluates to a number, but the field was declared as ${type}. Change it to one of ${NUMERIC_FIELD_TYPES.join(" / ")}`,
    );
  }

  const personRaw = obj["person"];
  const person = personRaw === undefined || personRaw === null ? null : normalizePersonDecl(personRaw, `${at}.person`);
  // 🔴 `person` hangs only on a cell that can hold one person or one row id. Hanging it on number or date
  // does not error at declaration time. It resolves to an empty recipient at the moment a notification is sent, and nobody then knows the fault was here.
  if (person !== null && type !== "string" && type !== "ref") {
    schemaFail(`${at}.person may be attached only to a string or ref field. "${type}" cannot hold an addressable person`);
  }
  const helpRaw = obj["help"];

  const pushFromRaw = obj["pushFrom"];
  const pushFrom = pushFromRaw === undefined || pushFromRaw === null ? null : requireText(pushFromRaw, `${at}.pushFrom`);
  // Closed in the reverse direction, the same shape as `options` and `ref`. A system-supplied field is already skipped on push
  // (the framework computes it). Giving it `pushFrom` is a dead declaration. The modeler thinks a source was named, and it does not take effect.
  if (pushFrom !== null && (auto || derive !== null || calculate !== null || lineAgg !== null)) {
    schemaFail(
      `${at}.pushFrom cannot be attached to a system-supplied field (this field is ${auto ? "auto" : derive ? derive.kind : calculate ? "calculate" : "lineAgg"}). ` +
        `On push the framework computes it, so a named source does not take effect`,
    );
  }
  if (pushFrom !== null && type === "subtable") {
    schemaFail(`${at}.pushFrom cannot be attached to a subtable. A line table pairs by the same key, and each column's source is declared on that column`);
  }

  // Columns of a line table. A subtable must declare columns. A line table with no column declaration cannot be rendered,
  // and it tempts the client to hard-code a set of columns, which is where schema-driven behavior starts to fail.
  const subRaw = obj["fields"];
  let fields: readonly Field[] | null = null;
  if (subRaw !== undefined && subRaw !== null) {
    if (type !== "subtable") schemaFail(`${at}.fields is meaningful only on a subtable field (this field is ${type})`);
    const list = requireArray(subRaw, `${at}.fields`).map((f, i) =>
      normalizeField(f, `${at}.fields[${i}]`, false),
    );
    if (!list.length) schemaFail(`${at}.fields must not be empty`);
    assertUniqueKeys(
      list.map((f) => f.key),
      `${at}.fields`,
    );
    fields = list;
  }
  if (type === "subtable" && !fields) schemaFail(`${at}: a subtable field must declare its columns with fields`);

  const maxRowsRaw = obj["maxRows"];
  let maxRows: number | null = null;
  if (maxRowsRaw !== undefined && maxRowsRaw !== null) {
    if (type !== "subtable") {
      schemaFail(`${at}.maxRows is meaningful only on a subtable field (this field is ${type})`);
    }
    if (typeof maxRowsRaw !== "number" || !Number.isInteger(maxRowsRaw) || maxRowsRaw < 1) {
      schemaFail(`${at}.maxRows must be an integer >= 1 (received ${JSON.stringify(maxRowsRaw)})`);
    }
    maxRows = maxRowsRaw;
  }

  const defaultFromRaw = obj["defaultFrom"];
  let defaultFrom: { readonly header: string } | null = null;
  if (defaultFromRaw !== undefined && defaultFromRaw !== null) {
    if (type === "subtable") {
      schemaFail(`${at}.defaultFrom may be attached only to a line column, not to the whole line table`);
    }
    if (allowSubtable) {
      schemaFail(`${at}.defaultFrom may be attached only to a line column (brought from a header cell), not to a header field`);
    }
    const df = requireObject(defaultFromRaw, `${at}.defaultFrom`);
    assertClosedKeys(df, ["header"], `${at}.defaultFrom`);
    defaultFrom = { header: requireText(df["header"], `${at}.defaultFrom.header`) };
  }

  const uniqueDefaultWithinRaw = obj["uniqueDefaultWithin"];
  const uniqueDefaultWithin =
    uniqueDefaultWithinRaw === undefined || uniqueDefaultWithinRaw === null
      ? null
      : normalizeUniqueDefaultWithin(uniqueDefaultWithinRaw, `${at}.uniqueDefaultWithin`, type);
  const generatedSequenceRaw = obj["generatedSequence"];
  const generatedSequence =
    generatedSequenceRaw === undefined || generatedSequenceRaw === null
      ? null
      : normalizeGeneratedSequence(generatedSequenceRaw, `${at}.generatedSequence`);
  const stampOnFirstEnterRaw = obj["stampOnFirstEnter"];
  const stampOnFirstEnter =
    stampOnFirstEnterRaw === undefined || stampOnFirstEnterRaw === null
      ? null
      : normalizeStampOnFirstEnter(stampOnFirstEnterRaw, `${at}.stampOnFirstEnter`, type);

  // 🔴 hidden enters the object only when declared. It is an optional key, and a missing key means false.
  // Consumers always fall back with `=== true`. A default is not forced, so the schema JSON projection
  // does not add a `"hidden": false` placeholder on every field (an agent result budget is counted in characters,
  // and a productionTask operation subtable with many fields times 30 characters pushes a partition past the 6000 limit).
  const hidden = obj["hidden"] === true ? true : undefined;
  return {
    key,
    label: obj["label"] === undefined || obj["label"] === null ? key : requireText(obj["label"], `${at}.label`),
    type,
    required: obj["required"] === true,
    primary: obj["primary"] === true,
    // Combinations that do not hold (derived, a line column, bool and enum, stacked with primary) are rejected one by one in the semantic gate.
    // They are not thrown here. Those checks report everything at once, and the first throw from the shape layer would replace the whole report.
    unique: obj["unique"] === true,
    uniqueWith: (() => {
      const rawWith = obj["uniqueWith"];
      if (rawWith === undefined || rawWith === null) return null;
      if (!Array.isArray(rawWith)) schemaFail(`${at}.uniqueWith must be an array of field keys`);
      if (!rawWith.length) schemaFail(`${at}.uniqueWith must not be an empty array. For a single-column unique, omit this key`);
      return rawWith.map((item, i) => requireText(item, `${at}.uniqueWith[${i}]`));
    })(),
    ...(uniqueDefaultWithin !== null ? { uniqueDefaultWithin } : {}),
    ...(generatedSequence !== null ? { generatedSequence } : {}),
    ...(stampOnFirstEnter !== null ? { stampOnFirstEnter } : {}),
    auto,
    ...(obj["requiredOnManualCreate"] === true ? { requiredOnManualCreate: true } : {}),
    createDefault,
    ...(createDefaultBy !== null ? { createDefaultBy } : {}),
    options,
    choiceSet,
    ...(multiple ? { multiple: true } : {}),
    ...(formatRaw === undefined ? {} : { format: formatRaw as "time" }),
    ref,
    refFilter,
    refPreselect,
    refPreselectSole,
    ...(headerEmptyFill !== undefined ? { headerEmptyFill } : {}),
    through,
    ...(refOwner !== null ? { refOwner } : {}),
    derive,
    calculate,
    snapshot,
    refDefault,
    unitChoice,
    lineAgg,
    person,
    help: helpRaw === undefined || helpRaw === null ? null : requireText(helpRaw, `${at}.help`),
    pushFrom,
    fields,
    // 🔴 It must be carried out explicitly. assertClosedKeys only judges what is allowed, not what is read.
    // Missing this line makes `normalizeModule` silently drop `systemGenerated: true`,
    // while `isSystemSupplied` still expects it, so a "the write path overwrites it" field still appears in the template.
    systemGenerated: obj["systemGenerated"] === true,
    ...(obj["plannerSupplied"] === true ? { plannerSupplied: true } : {}),
    ...(hidden !== undefined ? { hidden } : {}),
    ...(maxRows !== null ? { maxRows } : {}),
    ...(defaultFrom !== null ? { defaultFrom } : {}),
  };
}

/** A derived field: computed at query time, and it builds no column. The three kinds are treated the same. */
export function isDerived(field: Field): boolean {
  // 🔴 Use `!= null` rather than `!== null`. A field from the wire or an old process may be missing the key
  // (`undefined`). `undefined !== null` is true, which would classify every ordinary writable field as derived.
  return field.derive != null;
}

/**
 * Whether this field has a column in the table.
 *
 * 🔴 Table creation, seed persistence, and the write gate share this criterion. Two copies do not error:
 * the generator builds a column and the persister does not write it (the column stays empty), or the reverse (writing a column that does not exist
 * blows up only at Postgres). Each rule has its own reason.
 *   · `derive` (rollup / lookup / formula) never builds a column. Storing a copy means that one day
 *     it will disagree with the source, and nobody will know which one to trust (same as "do not build a balance table").
 *   · `subtable` builds no column. It is another table (`oe_<module>_<field>`).
 * `auto` has a column. It is a value the system writes in, not a value computed at query time.
 */
export function hasColumn(field: Field): boolean {
  return !isDerived(field) && field.type !== "subtable";
}

/**
 * Whether a value for this field can be read out of one row.
 *
 * It differs from `hasColumn` by one leg, and that leg is intentional. `derive` has no column, but a row projection
 * still has a value, computed by an expression at query time (`projection()` in `storage-pg` emits a subquery for a derived column,
 * not a column name). Judging "can this cell be read" with `hasColumn` would classify a column such as `customerName`,
 * which is on the list right now, as unreadable.
 *
 * Two cases cannot be read, each for its own reason:
 *   · `subtable`: it is another table, and one row cannot hold N rows;
 *   · `attachment`: the value is a list of file handles, not one readable cell (the body goes through attachment_read).
 *
 * 🔴 This is a different axis from the analysis catalog's `hasColumn && type !== "attachment"`. Do not merge them.
 * That one asks "can this column name be written in SQL", and the answer must be a physical column, so `derive` goes into
 * `missingFacts` there. This function asks "does this cell have a value in a row", and a derived column does.
 * Merging them is wrong one way or the other: either analysis SQL references a column that does not exist, or the list cannot click
 * a column that is clearly displayed.
 */
export function hasRowValue(field: Field): boolean {
  if (field.type === "subtable" || field.type === "attachment") return false;
  return hasColumn(field) || isDerived(field);
}

/** A numbering field: allocated on create, it has a column, and a person must not fill it. */
export function isAutoNumbered(field: Field): boolean {
  return field.auto === true;
}

/** A line-total field: computed from the lines on save, it has a column, and a person must not fill it. */
export function isLineAggregated(field: Field): boolean {
  return field.lineAgg != null;
}

/** Whether this field is the conversion-factor landing cell of some unitChoice on the same layer. */
export function isUnitChoiceFactor(field: Field, fields: readonly Field[]): boolean {
  return fields.some((candidate) => candidate.unitChoice?.factorInto === field.key);
}

/**
 * One line reference and its header companion reference.
 *
 * `line` is the business input (the upstream line id). `bill` is the upstream document id stored only so it can be looked up in reverse.
 * The latter is not a second input. When storage checks that `line` exists it has already joined the header, and it can write
 * `bill_id` from that same row.
 */
export interface RefLinePair {
  readonly line: Field;
  readonly bill: Field;
}

/**
 * Every `refLine` to `ref` pairing in one line table.
 *
 * Pairing looks only at the same layer and the same target module. The declaration layer guarantees at most one pair per target. This still fails fast,
 * because the write path, the form, and seeds all depend on this result. A sick declaration must not degrade into "just take the first".
 */
export function refLinePairs(fields: readonly Field[]): readonly RefLinePair[] {
  const pairs: RefLinePair[] = [];
  const claimed = new Set<string>();
  for (const line of fields.filter((field) => field.type === "refLine")) {
    const explicit = line.refOwner ?? null;
    const lines = fields.filter((field) => field.type === "refLine" && field.ref === line.ref);
    const bills = fields.filter((field) => field.type === "ref" && field.ref === line.ref);
    const bill = explicit === null
      ? lines.length === 1 && bills.length === 1 ? bills[0] : undefined
      : fields.find((field) => field.key === explicit && field.type === "ref" && field.ref === line.ref);
    if (!bill) {
      if (explicit === null) {
        schemaFail(
          `Line reference "${line.key}" points at "${String(line.ref)}". The same layer must pair exactly one refLine with one ref. ` +
            `Actual refLine=${String(lines.length)}, ref=${String(bills.length)}. The declaration-layer gate should already have stopped this`,
        );
      }
      schemaFail(`Line reference "${line.key}" declares refOwner "${String(explicit)}", which is not a same-row ref of the same target. The declaration-layer gate should already have stopped this`);
    }
    if (claimed.has(bill.key)) {
      schemaFail(`Header companion reference "${bill.key}" is shared by more than one refLine. The declaration-layer gate should already have stopped this`);
    }
    claimed.add(bill.key);
    pairs.push({ line, bill });
  }
  return pairs;
}

/** Whether this field is the header companion column of some `refLine`. The answer exists only when the same-layer field set is in hand. */
export function isRefLineCompanion(field: Field, fields: readonly Field[]): boolean {
  if (field.type !== "ref") return false;
  return refLinePairs(fields).some((pair) => pair.bill === field);
}

/**
 * System-supplied: neither the user nor the Agent may write it.
 *
 * Five legs: derive (computed at query time), auto (numbering), lineAgg (computed from the lines on save),
 * snapshot (frozen from the source when the reference is resolved), and the header companion reference brought out by a `refLine` relationship on a line.
 *
 * The last one is a same-layer relationship, so `fields` is passed only when processing line columns. A header call does not pass it.
 * Table creation and column projection must still split on `isDerived`. auto, lineAgg, and a companion ref all have columns,
 * and splitting on this function would swallow those columns too.
 *
 * 🔴 `snapshot`, `derive`, and `lineAgg` all use `!= null` (blocking both `null` and `undefined`).
 * If an outbound server schema is missing the key (an old process, a projection that forgot to write it, JSON that omits null), the field is `undefined`.
 * `undefined !== null` is true, which would classify every writable field on the whole form as system-supplied.
 * The UI would be all dashed "calculated / numbered" boxes, nothing could be changed, and the schema in Network would look completely normal.
 */
export function isSystemSupplied(field: Field, fields?: readonly Field[]): boolean {
  return (
    field.systemGenerated === true ||
    isPlannerSupplied(field) ||
    isDerived(field) ||
    isAutoNumbered(field) ||
    isLineAggregated(field) ||
    field.calculate != null ||
    field.snapshot != null ||
    (fields !== undefined && isUnitChoiceFactor(field, fields)) ||
    (fields !== undefined && isRefLineCompanion(field, fields))
  );
}

/**
 * A header fact the server writes after the document is created: a `systemGenerated` header scalar.
 * Storage `setGeneratedHeader`, the Planner setGeneratedHeader command, and an internal system save share this criterion.
 */
export function isGeneratedHeaderField(field: Field): boolean {
  return field.systemGenerated === true && field.type !== "subtable";
}

/** Supplied only by a declarative Planner when generating a document. The ordinary write path and the public schema do not expose it. */
export function isPlannerSupplied(field: Field): boolean {
  return field.plannerSupplied === true;
}

/**
 * 🔴 The criterion of `Field.hidden`. Hidden from the manual form, the line UI, and the contract the Agent may fill.
 * It does not affect the database column, an authorized record read, or `views.list`.
 */
export function isHidden(field: Field): boolean {
  return field.hidden === true;
}

/**
 * Exactly one `hidden + systemGenerated` bool on the source module. The columns of a filter view (for example a production bill of materials)
 * are given by the declaration. Packages only execute them and do not name a business field.
 */
export function requireHiddenSystemGeneratedBool(fields: readonly Field[], at: string): Field {
  const hits = fields.filter((field) => field.type === "bool" && field.hidden === true && field.systemGenerated === true);
  if (hits.length !== 1) {
    schemaFail(`${at}: exactly one hidden+systemGenerated bool filter column must be declared, found ${String(hits.length)}`);
  }
  return hits[0]!;
}

/** The criterion of `Field.uniqueDefaultWithin`. A missing key means it is not declared. */
export function uniqueDefaultWithinOf(field: Field): UniqueDefaultWithin | null {
  return field.uniqueDefaultWithin ?? null;
}

/** The criterion of `Field.generatedSequence`. A missing key means it is not declared. */
export function generatedSequenceOf(field: Field): GeneratedSequence | null {
  return field.generatedSequence ?? null;
}

/** The criterion of `Field.stampOnFirstEnter`. A missing key means it is not declared. */
export function stampOnFirstEnterOf(field: Field): StampOnFirstEnter | null {
  return field.stampOnFirstEnter ?? null;
}

/**
 * Whether this column declared "once the header is filled, lay the candidate rows onto the empty table".
 *
 * 🔴 `=== true` rather than `!= null`. On a schema that went over the wire this key may be entirely missing
 * (it enters the object only when declared). A missing key means it was not declared.
 */
export function headerEmptyFillOf(field: Field): boolean {
  return field.headerEmptyFill === true;
}

export interface HeaderEmptyFillSite {
  readonly table: Field;
  readonly column: Field;
  /** Server coordinate, for example `lines.productionCompletionId`. */
  readonly path: string;
  /** Every `$bill.` operand in this column's `refFilter`. Candidates are asked only after they are all filled. */
  readonly headerKeys: readonly string[];
}

/**
 * Every line column on this schema that explicitly declared empty-table row fill. Undeclared columns do not enter.
 */
export function headerEmptyFillSitesOf(fields: readonly Field[]): readonly HeaderEmptyFillSite[] {
  const out: HeaderEmptyFillSite[] = [];
  for (const table of fields) {
    if (table.type !== "subtable" || table.fields == null) continue;
    for (const column of table.fields) {
      if (!headerEmptyFillOf(column)) continue;
      const headerKeys = [
        ...new Set(
          refFilterOperands(column.refFilter)
            .filter((operand) => operand.scope === "bill")
            .map((operand) => operand.key),
        ),
      ];
      out.push({ table, column, path: `${table.key}.${column.key}`, headerKeys });
    }
  }
  return out;
}

export function maxRowsOf(field: Field): number | null {
  return field.maxRows ?? null;
}

export function defaultFromOf(field: Field): { readonly header: string } | null {
  return field.defaultFrom ?? null;
}

/**
 * A required field that cannot be filled on create. This cell blocks manual create for the whole module.
 *
 * Two classes. The second is the one most often missed:
 *   ① a type the renderer has no input channel for (see `NO_MANUAL_INPUT_TYPES`; currently an empty set);
 *   ② a required header companion ref whose paired line reference is not required. That column's value is filled
 *      only by the `refLine` join, and the write gate forbids the client to write it. The line reference may be left empty, so nobody
 *      gives the companion column a value. The value gate skips system-supplied fields entirely (`fillable`), so it walks all the way to Postgres
 *      NOT NULL. A user-input problem becomes an unreadable 500, which is the shape the discipline "do not let a database column constraint
 *      act as the validator" is about.
 *
 * 🔴 ② is independent of the render channel, and it is permanent. After the picker was built, ① is empty, and ②
 *    still holds. The two required flags close together (the user must select a line, so the server can always fill the companion id).
 *    One required and one optional is a hole. The creation-path gate stays non-constant because of this class.
 *
 * Both optional does not count: leaving them empty can still be stored, and the manual-create path stays open.
 * Both required does not count either: the picker brings the line id back in one step, and the companion column is filled by the same join in `resolveRefs`.
 */
export interface CreateBlocker {
  /** A header path is the field key. A line path is `<subtable>.<column>`, the same key shape as `pushDefaults`. */
  readonly path: string;
  readonly label: string;
  readonly type: FieldType;
  /** Why it cannot be filled. Words a person can read, shared by the UI and explain. Do not write a second copy. */
  readonly why: string;
}

/**
 * The cells in one layer (the header, or the columns of one line table) that block manual create.
 *
 * 🔴 Pairing does not go through `refLinePairs`. That copy fails fast on a sick declaration, and this function runs inside
 * `normalizeModule` (the shape layer). A pairing error in one layer would throw here and replace the semantic layer's
 * "list everything at once" report. The user would see a shape error instead of the one they actually need to change.
 * This only needs "is there a line reference of the same target on the same layer". A sick declaration is still reported by the semantic gate.
 */
function blockersInLayer(fields: readonly Field[], pathOf: (key: string) => string): readonly CreateBlocker[] {
  const out: CreateBlocker[] = [];
  const lineRefs = fields.filter((field) => field.type === "refLine");
  for (const field of fields) {
    if (isPlannerSupplied(field)) {
      out.push({
        path: pathOf(field.key),
        label: field.label,
        type: field.type,
        why: "This cell must be frozen by the upstream action's Planner. Ordinary create, import, the UI, and the Agent have no write entry",
      });
      continue;
    }
    if (field.required && field.systemGenerated === true) {
      out.push({
        path: pathOf(field.key),
        label: field.label,
        type: field.type,
        why: "This cell is supplied by the server write path. Ordinary create, import, the UI, and the Agent have no write entry",
      });
      continue;
    }
    if (!field.required) continue;
    if (!hasManualInput(field)) {
      out.push({
        path: pathOf(field.key),
        label: field.label,
        type: field.type,
        why: `${field.type} has no input channel on the renderer yet (see NO_MANUAL_INPUT_TYPES). Today it is filled only by push`,
      });
      continue;
    }
    if (field.type !== "ref") continue;
    const sameTargetLines = lineRefs.filter((line) => line.ref === field.ref);
    const sameTargetBills = fields.filter((candidate) => candidate.type === "ref" && candidate.ref === field.ref);
    const paired = sameTargetLines.find((line) => line.refOwner === field.key)
      ?? (sameTargetLines.length === 1 && sameTargetBills.length === 1 && sameTargetBills[0] === field
        ? sameTargetLines[0]
        : undefined);
    if (!paired) continue;
    // A companion column's value is filled only from that refLine hop's join. So when it is required, the paired line reference must also be
    // required. Otherwise the user leaves the line reference empty, this column has no source, and the value gate skips system-supplied fields entirely.
    if (!hasManualInput(paired)) {
      out.push({
        path: pathOf(field.key),
        label: field.label,
        type: field.type,
        why: `It is the companion column of line reference "${paired.label}". The value is filled only from that hop's join, and the client must not write it`,
      });
      continue;
    }
    if (!paired.required) {
      out.push({
        path: pathOf(field.key),
        label: field.label,
        type: field.type,
        why:
          `It is the companion column of line reference "${paired.label}". The value is filled only from that hop's join, and the client must not write it. ` +
          `"${paired.label}" is not required, so leaving it empty leaves this column with no source. ` +
          `Either also make "${paired.label}" required (a companion document exists only after a line is selected), or make this column optional`,
      });
    }
  }
  return out;
}

/** The cells in the whole module (header plus every line table) that block manual create. Empty means it can be created by hand. */
export function createBlockersOf(fields: readonly Field[]): readonly CreateBlocker[] {
  const out: CreateBlocker[] = [...blockersInLayer(fields, (key) => key)];
  for (const table of fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    out.push(...blockersInLayer(table.fields, (key) => `${table.key}.${key}`));
  }
  return out;
}

// ── Supply mechanism: where this number actually comes from ───────────────

/** The system-supplied mechanisms. `null` (not in this list) means the user filled it. */
export type FieldSupply =
  | "formula"
  | "rollup"
  | "lookup"
  | "calculate"
  | "lineAgg"
  | "auto"
  | "snapshot"
  | "unitFactor"
  | "refOwner";

export function supplyOf(field: Field, fields?: readonly Field[]): FieldSupply | null {
  if (field.derive) return field.derive.kind;
  if (field.calculate) return "calculate";
  if (field.lineAgg) return "lineAgg";
  if (field.auto) return "auto";
  if (field.snapshot) return "snapshot";
  if (fields !== undefined && isUnitChoiceFactor(field, fields)) return "unitFactor";
  if (fields !== undefined && isRefLineCompanion(field, fields)) return "refOwner";
  return null;
}

/**
 * Short labels of the supply mechanisms. The field badge in the UI and the CLI explain share this copy.
 *
 * 🔴 Two copies were measured to drift (see TARGET_TEXT in `effects.ts`): the same thing has two names in two places,
 * and nothing reports the drift. It matters here. When the user sees "I am not allowed to fill this", the only explanation they can read
 * is this label. A wrong label sends them looking for a switch that does not exist.
 */
export const SUPPLY_TEXT: Readonly<Record<FieldSupply, string>> = Object.freeze({
  formula: "Calculated",
  rollup: "Rolled up",
  lookup: "Looked up",
  calculate: "Stored calculation",
  lineAgg: "Line total",
  auto: "Numbered",
  snapshot: "Reference snapshot",
  unitFactor: "Unit conversion",
  refOwner: "Ownership",
});

/**
 * Words a person can read for "where this number came from".
 *
 * An FDE uses explain to reconcile with a customer, and the UI uses it as the field hint. Saying only "computed by the system" says nothing.
 * `auto` returns null. Numbering has no formula. Its explanation is the numbering rule.
 */
export function describeSupply(field: Field, fields?: readonly Field[]): string | null {
  const derive = field.derive;
  if (derive) {
    if (derive.kind === "formula") return describeFormula(derive.expr);
    if (derive.kind === "lookup") return `Brought ${derive.field} from "${derive.from}"`;
    const related = (derive.on ?? null) === null ? "pointing back at this document" : `"${derive.match}" equals this row's "${derive.on}"`;
    return derive.agg === "count"
      ? `Row count in "${derive.from}" ${related}`
      : `Rows in "${derive.from}" ${related}, ${AGG_TEXT[derive.agg]} ${derive.measure ?? ""}`;
  }
  if (field.calculate) return `${describeFormula(field.calculate)} (computed and frozen on save)`;
  const agg = field.lineAgg;
  if (agg) {
    return agg.agg === "count" ? `Row count of lines "${agg.of}"` : `Total of ${agg.measure ?? ""} on lines "${agg.of}"`;
  }
  if (field.snapshot) return `Reference ${field.snapshot.field} from "${field.snapshot.from}" and freeze it`;
  if (fields !== undefined && isUnitChoiceFactor(field, fields)) {
    const owner = fields.find((candidate) => candidate.unitChoice?.factorInto === field.key);
    if (!owner?.unitChoice) schemaFail(`Unit-conversion factor "${field.key}" has no unitChoice source`);
    return `Written with "${owner.label}": 1 for the main unit, the product conversion rate for the auxiliary unit`;
  }
  if (fields !== undefined && isRefLineCompanion(field, fields)) {
    const pair = refLinePairs(fields).find((candidate) => candidate.bill === field);
    if (!pair) schemaFail(`Companion reference "${field.key}" has no matching refLine. The declaration-layer gate should already have stopped this`);
    return `Determined by the document that owns the same-row "${pair.line.label}"`;
  }
  return null;
}

// ── When a reference is supplied ───────────────────────────────────────────
//
// 🔴 "When does this cell's value appear" has exactly one criterion in the whole repo.
//
// ⚠️ This is a different axis from `supplyOf` above. Do not merge them into one notion of "supply".
// That one answers "who supplied the value" (the mechanisms, used for the UI badges Calculated / Numbered / Reference snapshot).
// This one answers "when it is supplied" (which hop of the write path). One cell can have mechanism `snapshot`
// and stage the second hop, or mechanism `refOwner` and the same second hop.
// Folding them into one enum makes "the mechanism changed" and "the stage changed" knock out each other's consumers.
//
// It used to be assumed implicitly in four places, and the four assumptions disagreed. That is why this capability exists:
//   · `refSitesOf` (first hop) — the value is in the write body now, otherwise `continue`;
//   · `chainedRefSitesOf` (second hop) — recognizes only one kind of late arrival, "this is itself a snapshot";
//   · `SNAPSHOT_MATCH_OPTIONAL` (modeling gate) — writes chain depth as an inline `chainOk` expression;
//   · `snapshotColumnNotNull` (table creation) — does not look at timing at all, only at whether the source exists.
// What fell through the gap was a 500. The "business document number / business date" on an accounts-payable reconciliation line freezes a companion ref
// (`receiptId`). Its value is filled only during the first hop. The first hop cannot see it (it is not in the write body),
// and the second hop does not recognize it (it is not itself a snapshot), so those two columns stay empty all the way to Postgres NOT NULL.
//
// There are only three stages, and they can be derived from the declaration. No runtime information is required.

/** When a reference cell's value appears. The write path has only two hops today, which is why the third stage exists. */
export type RefSupplyStage =
  /** The user gives it in the write body (a fillable ref or refLine). The first hop, `refSitesOf`, takes it. */
  | "input"
  /** The system fills it while the first hop resolves references. The second hop, `chainedRefSitesOf`, is the first place that can see it. */
  | "resolved"
  /** No hop will ever give it a value. A snapshot hanging on it can never be frozen. */
  | "unreachable";

/** Why it landed in that stage. The stages exist so a modeling-gate error can say what to change next. */
export type RefSupplyVia =
  /** The user can fill it. */
  | "input"
  /** The header companion column of a `refLine`. The same join that checks the line exists takes `bill_id` and fills it. */
  | "companion"
  /** This is itself a snapshot, and its match is user input, so the first hop freezes it. */
  | "chain"
  /** This is a snapshot, but its match also waits until after the first hop. That needs a third hop, and the write path has only two. */
  | "depth"
  /** The snapshot chain is a cycle. */
  | "cycle"
  /** The match coordinate is not a ref or refLine on the same layer (another declaration gate reports it). */
  | "broken"
  /** A `refLine` declared as system-supplied. The second hop looks up the header by document id and cannot fill a line. */
  | "line"
  /** A reference produced by `derive`, `auto`, or `lineAgg`. It is not on the reference-resolution axis. */
  | "derived";

export interface RefSupply {
  readonly stage: RefSupplyStage;
  readonly via: RefSupplyVia;
  /**
   * Is this cell guaranteed to have a value. A second dimension, orthogonal to `stage`.
   *
   * `stage` says when it appears. This dimension says whether it can appear. Both have to hold
   * before a snapshot hanging on this cell can freeze a value and the target column can be NOT NULL.
   */
  readonly guaranteed: boolean;
  /** One sentence a person can read. Shared by the modeling gate and `explain`. Do not write a second copy. */
  readonly why: string;
}

/**
 * The tolerant copy of the same question as `refLinePairs`: only "is there a line reference of the same target on the same layer".
 *
 * 🔴 It does not go through `refLinePairs` (same reason as `blockersInLayer`). That copy fails fast on a sick declaration,
 * and this function's consumers include `validate.ts`. A semantic gate is a report, not a throw.
 * Throwing a pairing error here would replace the whole "report everything at once" report. The user would see one
 * shape error instead of the ones they actually need to change. A sick pairing (several refLines or several refs for one target)
 * is still reported by `REF_LINE_BILL_PARTNER_AMBIGUOUS`.
 */
function pairedLineRefOf(field: Field, fields: readonly Field[]): Field | null {
  if (field.type !== "ref") return null;
  const lines = fields.filter((candidate) => candidate.type === "refLine" && candidate.ref === field.ref);
  const bills = fields.filter((candidate) => candidate.type === "ref" && candidate.ref === field.ref);
  const explicit = lines.find((candidate) => candidate.refOwner === field.key);
  if (explicit !== undefined) return explicit;
  return lines.length === 1 && bills.length === 1 && bills[0] === field ? (lines[0] ?? null) : null;
}

function walkRefSupply(field: Field, fields: readonly Field[], stack: readonly string[]): RefSupply {
  // 🔴 The stage order lines up, item by item, with the order `resolveRefs` actually writes this cell (the companion is filled back
  // after the snapshot is frozen, so the companion wins). If the criterion is in a different order from the path it describes,
  // this "when it appears" is describing a path that does not exist.
  const paired = pairedLineRefOf(field, fields);
  if (paired !== null) {
    // A companion column's value comes from the join of the paired refLine. A required line reference always joins out a bill_id.
    // Optional is a hole (class ② of `createBlockersOf` is exactly this).
    return {
      stage: "resolved",
      via: "companion",
      guaranteed: paired.required,
      why:
        `"${field.label}" is the header companion column of line reference "${paired.label}". ` +
        `The value is filled by the same join that checks the line exists on the first hop${paired.required ? "" : ". That line reference is optional, so leaving it empty leaves this cell with no source"}`,
    };
  }
  if (field.snapshot != null) {
    if (field.type !== "ref") {
      return {
        stage: "unreachable",
        via: "line",
        guaranteed: false,
        why: `"${field.label}" is a system-supplied refLine. The second hop looks up the header by document id and cannot fill a line`,
      };
    }
    if (stack.includes(field.key)) {
      return {
        stage: "unreachable",
        via: "cycle",
        guaranteed: false,
        why: `The snapshot chain of "${field.label}" is a cycle: ${[...stack, field.key].join(" → ")}`,
      };
    }
    const match = fields.find((candidate) => candidate.key === field.snapshot?.match);
    if (!match || (match.type !== "ref" && match.type !== "refLine")) {
      return {
        stage: "unreachable",
        via: "broken",
        guaranteed: false,
        why: `The snapshot coordinate "${String(field.snapshot.match)}" of "${field.label}" is not a ref or refLine on the same layer`,
      };
    }
    const upstream = walkRefSupply(match, fields, [...stack, field.key]);
    // 🔴 Only one layer is recognized: `refSitesOf` (first hop) then `chainedRefSitesOf` (second hop). There is no third hop.
    // If the upstream waits until after the first hop, this cell waits until after the second hop, and by then nobody evaluates again.
    return upstream.stage === "input"
      ? {
          stage: "resolved",
          via: "chain",
          guaranteed: upstream.guaranteed,
          why: `"${field.label}" is itself a snapshot, frozen on the first hop from "${match.label}"`,
        }
      : {
          stage: "unreachable",
          via: "depth",
          guaranteed: false,
          why:
            `"${field.label}" is frozen from "${match.label}", and "${match.label}" itself has no value until after the first hop` +
            ` (${upstream.why}). That would need a third hop, and the write path has only two`,
        };
  }
  if (isDerived(field) || isAutoNumbered(field) || isLineAggregated(field)) {
    return {
      stage: "unreachable",
      via: "derived",
      guaranteed: false,
      why: `"${field.label}" comes from derive, auto, or lineAgg, and is not on the reference-resolution axis`,
    };
  }
  return {
    stage: "input",
    via: "input",
    guaranteed: field.required,
    why: `"${field.label}" is given by the user in the write body${field.required ? ", and it is required" : ", but it is optional"}`,
  };
}

/**
 * When, and by whom, a reference cell's value appears. The stages on the reference-resolution axis.
 *
 * Zero IO. It eats only the declaration. A field that is not ref or refLine has no answer on this axis and returns `null`
 * (not a made-up stage: a stage that was invented will eventually be treated as real somewhere).
 *
 * Each of the four consumers only compiles its output into its own shape:
 *   · `refSitesOf`            — the first hop takes the `input` stage;
 *   · `chainedRefSitesOf`     — the second hop takes the `resolved` stage;
 *   · `validate.ts`           — a snapshot whose match lands in the `unreachable` stage is red at modeling time;
 *   · `snapshotColumnNotNull` — the timing dimension and the source-existence dimension together decide whether the column may be null.
 */
export function refSupplyOf(field: Field, fields: readonly Field[]): RefSupply | null {
  if (field.type !== "ref" && field.type !== "refLine") return null;
  return walkRefSupply(field, fields, []);
}

/**
 * Whether this cell's value will be filled by reference resolution, meaning it appears on the row only after the write path's two hops
 * (snapshot freeze, or the `refLine` companion column).
 *
 * It is the same axis as `refSupplyOf` (AGENTS.md, "when this cell's value appears"), only wider.
 * `refSupplyOf` answers only ref and refLine (everything else returns `null`), while a dynamic operand of `refFilter`
 * may point at any cell. In the shapes this repo has today, `$line.productId` happens to be a ref (it can answer),
 * while a snapshot frozen the same way for "spec" or "unit" is a string (it answers `null`).
 * Without this layer every consumer would write its own "what counts as filled by the system", which is exactly what lifting the two-hop criterion into
 * one `refSupplyOf` was meant to remove. The accounts-payable reconciliation 500 was the product of each site writing its own copy.
 *
 * 🔴 Only the reference-resolution axis is recognized, not `derive`, `auto`, or `lineAgg`. Those three are not written back onto the row by `resolveRefs`
 * (derive builds no column, auto happens at numbering, lineAgg happens at the total). Counting them in
 * promises a "wait" that will not be fulfilled. That cell is still empty at the end, and a candidate filter that depends on it
 * silently swallows a negative conclusion (`pending`) on the waiting side. The symptom is exactly
 * "the dropdown lists everything", which is the phenomenon the `refFilter` capability exists to remove.
 */
export function isRefResolvedField(field: Field, siblings: readonly Field[]): boolean {
  return field.snapshot != null || isRefLineCompanion(field, siblings);
}

// ── Line totals: evaluation ────────────────────────────────────────────────
//
// 🔴 A pure function, zero IO. The write path (storage and seeds) and the editing UI share this copy.
// This is the only consistency guarantee after lineAgg stores a column. The total is no longer free because nothing is stored.
// It is guaranteed because every place that computes it computes the same declaration. Two copies do not error.
// The total seen before save and the total stored after save differ by a little, and each number looks legal on its own.

/** Line rows grouped by line-table field key. A missing key means that line table has zero rows. */
export type LineRows = Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;

/** An empty value returns null (this row is not finished yet). Everything else goes to strict parsing. A wrong type still throws. */
function fieldNumberOrNull(raw: unknown, label: string): number | null {
  if (isEmptyValue(raw)) return null;
  return fieldNumber(raw, label);
}

/**
 * Can this column be computed at save time, meaning can it be a measure of a total.
 *
 * 🔴 There is one criterion, shared by three places: the static gate (`LINE_AGG_MEASURE_NOT_LOCAL`),
 * the evaluator (`measureOnRow`), and the line-table footer (`SubtableEditor`).
 * Two copies were measured: the gate checks only declared measure columns, while the footer tries to sum every column.
 * A line table with a line-level rollup (an order line's "already shipped for this line") is entirely green statically and saves normally,
 * and opening the form blows up the whole page inside the evaluator. The gap sits in the half the gate cannot see.
 */
export function isLocalMeasure(field: Field): boolean {
  return field.derive === null || field.derive.kind === "formula";
}

/**
 * Read the measure value off one row.
 *
 * A formula column has no stored value (it builds no column) and is computed from the declaration. When the inputs are not all filled it returns null,
 * and that row is left out of the total. The display wording matches the line-table footer verbatim (`SubtableEditor.columnSum`).
 * "Count an unfinished row as 0" makes the total while editing smaller than the real value, and it looks completely normal.
 */
function measureOnRow(
  col: Field,
  row: Readonly<Record<string, unknown>>,
  label: string,
  /** The formula resolver of the same layer. Required when the measure column is itself a formula that references another formula column. */
  resolver: FormulaResolver | null = null,
): number | null {
  const derive = col.derive;
  if (derive === null) return fieldNumberOrNull(row[col.key], label);
  if (derive.kind === "formula") return evaluateFormulaOrNull(derive.expr, row, resolver);
  // lookup and rollup have to query the database and cannot be computed on the write path. The semantic gate LINE_AGG_MEASURE_NOT_LOCAL rejects them.
  // This throws again because, if the gate is bypassed (a handwritten schema, JSON pasted back), the substitute shape is a silent wrong total.
  return schemaFail(
    `${label}: measure column "${col.key}" is a ${derive.kind} derivation and has a value only after a database query. ` +
      `Something that cannot be computed on save cannot enter a total (a measure can only be a line column or a formula on the same row)`,
  );
}

/**
 * Add up one column of the lines.
 *
 * 🔴 Exported. The header total (`computeLineAggregates`) and the "total" row of the line-table footer
 * (`SubtableEditor`) must be the same addition. Two copies do not error.
 * The footer shows 906 and the header shows 905.99. The user watches two numbers on the same screen, both calling themselves a total, disagree,
 * and nothing says which one is wrong.
 *
 * An empty set is 0 (arithmetic). A row that cannot be computed is left out (that row is not finished yet).
 */
export function sumLineColumn(
  col: Field,
  rows: readonly Readonly<Record<string, unknown>>[],
  what = "line total",
  /**
   * Every column of this line table. Required when the measure is a formula that references another formula column on the same row (a line amount referencing the deal price).
   * Without it that column is absent from the row data by nature (a formula builds no column),
   * so every row fails to compute, all of them are skipped, and the total lands as 0. 0 is a completely legal number.
   */
  columns: readonly Field[] | null = null,
): number {
  const resolver = columns === null ? null : formulaResolverOf(columns);
  let sum = 0;
  for (const [i, row] of rows.entries()) {
    const value = measureOnRow(col, row, `${what} row ${String(i + 1)}`, resolver);
    if (value !== null) sum += value;
  }
  return sum;
}

/**
 * Compute the value of every lineAgg field on one document.
 *
 * The empty set of `sum` and `count` is 0. That is arithmetic, not a `?? 0` fallback that writes "could not be read" as 0.
 * The result is rounded to the decimal precision of the carrying field, the same source as the column precision at table creation (`NUMERIC_PRECISION`).
 * Without rounding, Postgres silently truncates on insert, and the header total and the sum of the lines differ by one minor unit from then on.
 */
export function computeLineAggregates(
  fields: readonly Field[],
  lines: LineRows,
  what = "line total",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of fields) {
    const spec = field.lineAgg;
    if (!spec) continue;
    const at = `${what}「${field.key}」`;

    const table = fields.find((f) => f.key === spec.of);
    if (!table || table.type !== "subtable" || !table.fields) {
      schemaFail(`${at}: of points at "${spec.of}", which is not a line table of this module. The static gate should already have stopped this`);
    }
    // A missing key means this line table has no rows. The total is 0, not "cannot be computed".
    const rows = lines[spec.of] ?? [];

    if (spec.agg === "count") {
      out[field.key] = rows.length;
      continue;
    }

    const col = table.fields.find((f) => f.key === spec.measure);
    if (!col) schemaFail(`${at}: line table "${spec.of}" has no measure column "${String(spec.measure)}". The static gate should already have stopped this`);

    // 🔴 Pass every column of the line table. When the measure column is itself a formula, it may reference another formula column on the same row
    // (line amount = quantity times deal price, and the deal price is also a formula). Without them every row fails to compute
    // and the total lands as 0. A shipment of 3600 is posted to receivables as 0, and the books look legal everywhere.
    const sum = sumLineColumn(col, rows, at, table.fields);
    // The shape gate guarantees the carrying field is numeric. This only converges the type.
    if (field.type !== "number" && field.type !== "money" && field.type !== "percent") {
      schemaFail(`${at}: the carrying field is ${field.type}, which is not numeric. The shape gate should already have stopped this`);
    }
    out[field.key] = roundToScale(sum, field.type, at);
  }
  return out;
}

/**
 * Write gate: any patch that tries to write a system-supplied field is rejected.
 * It is not silently dropped. A silent drop makes the caller think the write succeeded.
 *
 * A system cell whose read-back matches is removed by the caller through `omitMatchingSystemWriteKeys` before it arrives here.
 */
export function assertNoSystemSuppliedWrites(
  fields: readonly Field[],
  patch: Readonly<Record<string, unknown>>,
  channel: "user" | "planner" = "user",
): void {
  const blocked = fields
    .filter(
      (field) => isSystemSupplied(field, fields) && !(channel === "planner" && isPlannerSupplied(field)),
    )
    .map((f) => f.key);
  const hit = Object.keys(patch).filter((k) => blocked.includes(k));
  if (hit.length) {
    schemaFail(`Fields "${hit.join(", ")}" are computed by the system and do not accept writes`);
  }
}
