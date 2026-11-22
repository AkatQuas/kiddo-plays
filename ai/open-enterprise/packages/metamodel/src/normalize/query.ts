// ---------------------------------------------------------------------------
// Query — the data shape of advanced search and saved views.
//
// 🔴 Not a seventh concept: module declarations have no query key. This is the
// runtime instance of ⑥ ViewConfig. `views.list` is the default view a developer
// wrote; Query is the question the user is asking right now.
// CheckReport / EffectPlan sit at the same level: runtime value types, in the kernel.
//
// Why the kernel and not the frontend: a query has three consumers, and a copy
// in each one will drift —
//   · web      renders the advanced-query panel and must echo a saved query
//   · server   compiles it to SQL
//   · storage  serializes it into a user view (this structure, not SQL, not UI state)
//
// A query state invented in the frontend is a second source of truth for "what
// can be queried". What the server accepts and what the panel can draw evolve
// apart, and nobody can say which one is right.
//
// 🔴 Zero IO: this file checks structure and references. It does not run queries.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  didYouMean,
  queryInputFail,
  requireArray,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import { AGG_TEXT, hasRowValue, type Field, type FieldType } from "../schema/fields.js";
import { isPlatformField, PLATFORM_FIELD_TYPES, type ModuleSchema, type PlatformField } from "../schema/module.js";
import { COMPARATOR_TEXT, COMPARATORS } from "../derive/primitives.js";

/** Join operators. Only and / or. Negation uses the comparator's opposite (ne / not_in); there is no third join. */
export const QUERY_JOINS = ["and", "or"] as const;
export type QueryJoin = (typeof QUERY_JOINS)[number];

// ── comparators ───────────────────────────────────────────────────────────

/**
 * Comparators that exist only for queries. They are not binary comparisons, so
 * they stay out of the rule primitives (`COMPARATORS`).
 *
 * · `not_contains`  query-only negated fuzzy match (empty values do not match)
 * · `between`       ternary: the value is a range of length exactly 2
 * · `is_empty` / `not_empty`  unary: no right-hand value
 *
 * Forcing them into rules would give `field_compare` a required `right` that is
 * ignored (you must write `right: { value: null }` to pass normalize, and
 * `describe()` renders "remark must be empty null"). An ignored argument is the
 * last thing this repo should have. Adding them here and not there is deliberate.
 */
export const QUERY_ONLY_COMPARATORS = ["not_contains", "between", "is_empty", "not_empty"] as const;

/**
 * Every comparator advanced query can use = the binary set plus the query-only ones.
 *
 * 🔴 Composed, not copied: add one to `COMPARATORS` and it appears here. The two sets cannot drift.
 */
export const QUERY_COMPARATORS = [...COMPARATORS, ...QUERY_ONLY_COMPARATORS] as const;
export type QueryComparator = (typeof QUERY_COMPARATORS)[number];

/**
 * Human wording for comparators. Also composed: the binary wording comes from
 * `COMPARATOR_TEXT` (precondition `describe()` uses it). This only adds the
 * query-only part. A second copy would let the same `gte` say "not less than"
 * in a block message and something else on the filter panel.
 */
export const QUERY_COMPARATOR_TEXT: Readonly<Record<QueryComparator, string>> = Object.freeze({
  ...COMPARATOR_TEXT,
  not_contains: "does not contain",
  between: "between",
  is_empty: "is empty",
  not_empty: "is not empty",
});

/**
 * What shape a comparator's value has.
 *
 * 🔴 This is the criterion that separates "value not filled in" from "query for
 * empty". A `none` comparator has no value slot, so `eq + null` no longer has to
 * mean both "query empty" and "the user has not filled this in". The first has
 * its own spelling; the UI can treat the second as unfilled and block Apply.
 * One value slot cannot express two things.
 *
 * Three consumers read this one table: the kernel validates from it, the panel
 * renders the value slot from it, and the agent catalog describes from it.
 */
export type QueryValueShape = "scalar" | "list" | "range" | "none";

export const QUERY_VALUE_SHAPE: Readonly<Record<QueryComparator, QueryValueShape>> = Object.freeze({
  eq: "scalar",
  ne: "scalar",
  gt: "scalar",
  gte: "scalar",
  lt: "scalar",
  lte: "scalar",
  contains: "scalar",
  not_contains: "scalar",
  in: "list",
  not_in: "list",
  between: "range",
  is_empty: "none",
  not_empty: "none",
});

// ── relative time ─────────────────────────────────────────────────────────

/**
 * Relative-time tokens — the fixed set, closed.
 *
 * 🔴 Why the value shape lives in the kernel: "last 7 days" has three consumers
 * (the panel draws it, the server compiles it, `SavedView` serializes it).
 * Expanding it into two absolute dates in the frontend and storing those makes
 * the view silently expire the next day. It still returns data; the answer is
 * yesterday's question. That failure is silent, usable, and nobody goes looking.
 *
 * Evaluating a token into a range is the executor's job, and it must take an
 * explicit timezone: "this month" is two different ranges in two timezones.
 * The kernel does no IO. It does not know what time it is, and it should not.
 */
export const RELATIVE_DATES = [
  "today",
  "yesterday",
  "last_7d",
  "last_30d",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_3_months",
  "this_quarter",
  "last_quarter",
  "this_year",
  "ytd",
] as const;
export type RelativeDate = (typeof RELATIVE_DATES)[number];

export const RELATIVE_DATE_TEXT: Readonly<Record<RelativeDate, string>> = Object.freeze({
  today: "today",
  yesterday: "yesterday",
  last_7d: "last 7 days",
  last_30d: "last 30 days",
  this_week: "this week",
  last_week: "last week",
  this_month: "this month",
  last_month: "last month",
  last_3_months: "last three months (including this month, three calendar months)",
  this_quarter: "this quarter",
  last_quarter: "last quarter",
  this_year: "this year",
  ytd: "year to date",
});

/**
 * Relative-time tokens — the parameterized set. Also closed; each one carries an `n`.
 *
 * 🔴 Two hard gaps in the fixed set:
 * ① No parameter: "idle more than 2 days", "confirmed more than 7 days", and
 * "unsettled more than 30 days" cannot be written.
 * ② No future: the fixed set points only at the past or the current period, while
 * "arriving within 3 days" and "possibly short in the next 7 days" are everyday questions.
 * Three workarounds fail with no symptom, so they cannot be the fallback: the model
 * converting to absolute dates stores yesterday's answer as the question; using
 * `lt {$rel:'yesterday'}` for "more than 2 days" is off by a day; adding an "overdue
 * days" field fails because `formula` has only arithmetic, no date math, and no now.
 *
 * 🔴 The basis is fixed in the token name: `_days` is calendar days, `_hours` is
 * rolling, `_months` is calendar months. A `unit` key plus a `rolling` switch would
 * make "2 days" a dimension that can be omitted: from midnight today, or from this
 * instant. An omission shows up as an answer off by at most a day, and both readings
 * look true. A name that carries the basis has no omitted-basis case.
 *
 * Both calendar days and rolling hours are required because the questions differ.
 * A `date` field has no time of day ("planned arrival date" can only be asked in
 * calendar days; "arriving within 3 days" = today / tomorrow / the day after). On
 * `createdAt` / `updatedAt`, "untouched for more than 2 days" means 48 hours. With
 * only the calendar tier, a bill created today at 09:00 satisfies "more than 1 day"
 * at 00:01 tomorrow.
 */
export const RELATIVE_SPANS = [
  "last_n_days",
  "next_n_days",
  "last_n_hours",
  "next_n_hours",
  "last_n_months",
  "next_n_months",
] as const;
export type RelativeSpan = (typeof RELATIVE_SPANS)[number];

export type RelativeSpanUnit = "calendar_day" | "rolling_hour" | "calendar_month";

/**
 * The time basis of each parameterized token. This is the only criterion: the
 * kernel uses it to judge field type, the executor uses it to pick the range
 * algorithm, and the agent catalog uses it to write the description. If each
 * place judges on its own, one drifts first. The symptom is the same
 * `{$rel:'last_n_hours',n:48}` reading as two calendar days on the panel and as
 * a rolling 48 hours in SQL. Both are legal, and nothing says which is wrong.
 */
export const RELATIVE_SPAN_UNIT: Readonly<Record<RelativeSpan, RelativeSpanUnit>> = Object.freeze({
  last_n_days: "calendar_day",
  next_n_days: "calendar_day",
  last_n_hours: "rolling_hour",
  next_n_hours: "rolling_hour",
  last_n_months: "calendar_month",
  next_n_months: "calendar_month",
});

/**
 * Wording. Same discipline as `RELATIVE_DATE_TEXT` (one copy only). The shape
 * differs because this tier's wording has a hole: the catalog must say "last N
 * calendar days", and the UI must say "last 3 calendar days". Storing a
 * placeholder string and replacing it adds a format convention nobody checks.
 */
export const RELATIVE_SPAN_TEXT: Readonly<Record<RelativeSpan, (n: string) => string>> = Object.freeze({
  last_n_days: (n) => `last ${n} calendar days (including today)`,
  next_n_days: (n) => `next ${n} calendar days (including today)`,
  last_n_hours: (n) => `past ${n} hours (rolling)`,
  next_n_hours: (n) => `next ${n} hours (rolling)`,
  last_n_months: (n) => `last ${n} calendar months (including this month)`,
  next_n_months: (n) => `next ${n} calendar months (including this month)`,
});

/**
 * Upper bound on N.
 *
 * 🔴 The bound is not about the database being slow. A wrong value must be
 * rejected before it is compiled into SQL: treating milliseconds as days
 * (`n: 86400000`), or reversing the unit, compiles into a condition that is
 * syntactically legal and constantly empty or constantly full. An empty result
 * is read as "there is no such bill". 3650 is about ten years. A longer range
 * is a static question: write an absolute date range, not a relative tier.
 */
export const RELATIVE_SPAN_MAX_N = 3650;

/** Every relative token = fixed set union parameterized set. Composed: add a tier and every place that recognizes them follows. */
export const RELATIVE_TOKENS = [...RELATIVE_DATES, ...RELATIVE_SPANS] as const;
export type RelativeToken = (typeof RELATIVE_TOKENS)[number];

/** A fixed-tier value. The `$rel` prefix is deliberate: it cannot be confused with any legal absolute date string. */
export interface RelativeDateToken {
  readonly $rel: RelativeDate;
}

/** A parameterized-tier value. `n` sits beside the token, not nested: an extra layer is easier for a model to misshape, and there is no second parameter to put there. */
export interface RelativeDateSpan {
  readonly $rel: RelativeSpan;
  readonly n: number;
}

export type RelativeDateValue = RelativeDateToken | RelativeDateSpan;

/** Shape only, not legality. Legality is thrown by `normalizeRelativeDate`. */
export function isRelativeDateValue(value: unknown): value is RelativeDateValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "$rel" in value;
}

export function isRelativeSpanToken(token: string): token is RelativeSpan {
  return (RELATIVE_SPANS as readonly string[]).includes(token);
}

/** Whether a relative value is the parameterized tier. The criterion is the token name, not whether `n` is present. A missing `n` is an error, not another shape. */
export function isRelativeSpanValue(value: RelativeDateValue): value is RelativeDateSpan {
  return isRelativeSpanToken(value.$rel);
}

/**
 * The legality criterion for N. The kernel and the executor share this one:
 * `normalizeQuery` rejects once, and the compiler rejects again (the compiler
 * must be safe on its own and cannot depend on an upstream gate). Both gates
 * must judge the same thing. Two copies mean one is loosened first, and an
 * `n: -3` compiles into SQL on some path.
 */
export function isRelativeSpanN(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= RELATIVE_SPAN_MAX_N;
}

/** How a relative value reads in words. One wording only; the panel summary and the agent description both take it. */
export function relativeDateLabel(value: RelativeDateValue): string {
  return isRelativeSpanValue(value)
    ? RELATIVE_SPAN_TEXT[value.$rel](String(value.n))
    : RELATIVE_DATE_TEXT[value.$rel];
}

/**
 * Relative time is only on date / datetime, and only with these comparators.
 * `ne` is excluded: negating a range has two readings about whether empty counts.
 *
 * The rolling-hour tier is narrowed again inside those two types (datetime only).
 * The criterion is in `normalizeRelativeDate`: a `date` column has no time of day,
 * so folding "48 hours from now" onto a date silently drops the hours. The answer
 * collapses to a calendar-day boundary while the user thinks they asked for a rolling duration.
 */
const RELATIVE_OK_OPS: readonly QueryComparator[] = Object.freeze(["eq", "gt", "gte", "lt", "lte", "between"]);
const RELATIVE_OK_TYPES: readonly FieldType[] = Object.freeze(["date", "datetime"]);

function normalizeRelativeDate(raw: unknown, type: FieldType, label: string): RelativeDateValue {
  const obj = requireObject(raw, label);
  // 🔴 Use requireEnum, not String(x): the token is compiled into a date range.
  // An unknown value must not be silently stuffed into SQL as a string.
  const rel = requireEnum(obj["$rel"], RELATIVE_TOKENS, `${label}.$rel`);

  if (!isRelativeSpanToken(rel)) {
    // A fixed tier that carries `n` is always rejected: `{$rel:'today', n:3}` has
    // no legal reading, and silently ignoring the 3 lets the caller think they asked for three days.
    assertClosedKeys(obj, ["$rel"], label);
    return { $rel: rel };
  }

  assertClosedKeys(obj, ["$rel", "n"], label);
  const n = obj["n"];
  if (n === undefined || n === null) {
    queryInputFail(
      "RELATIVE_SPAN_N_REQUIRED",
      `${label}.n`,
      `${label}.n is missing. "${rel}" is a parameterized token, and N is the only source of its range length. ` +
        `This dimension has no safe default: filling in 1 or 7 silently answers a question the user did not ask`,
      `To query this month use {"op":"eq","value":{"$rel":"this_month"}}; otherwise pass an integer 1..${String(RELATIVE_SPAN_MAX_N)} as ${label}.n`,
    );
  }
  if (!isRelativeSpanN(n)) {
    queryInputFail(
      "RELATIVE_SPAN_N_OUT_OF_RANGE",
      `${label}.n`,
      `${label}.n must be an integer from 1 to ${RELATIVE_SPAN_MAX_N}; received ${JSON.stringify(n)}. ` +
        `A negative or oversized value compiles into a syntactically legal condition that is constantly empty or constantly full, and an empty result is read as "there is no such bill"`,
      `To query this month use {"op":"eq","value":{"$rel":"this_month"}}; otherwise pass an integer 1..${String(RELATIVE_SPAN_MAX_N)} as ${label}.n`,
    );
  }
  if (RELATIVE_SPAN_UNIT[rel] === "rolling_hour" && type !== "datetime") {
    schemaFail(
      `${label}: "${rel}" is a rolling-hour tier and can be used only on a datetime field (current type is ${type}). ` +
        `A date column has no time of day, so the hours are silently dropped and the answer collapses to a calendar-day boundary, ` +
        `while the asker thinks they asked "the last ${String(n)} hours". For calendar days use last_n_days / next_n_days`,
    );
  }
  return { $rel: rel, n };
}

// ── condition tree ────────────────────────────────────────────────────────

/** A field operand always refers to the current document, never a caller-provided SQL expression. */
export interface QueryFieldValue { readonly $field: string }
export function isQueryFieldValue(value: unknown): value is QueryFieldValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "$field" in value;
}
export const QUERY_FIELD_COMPARATORS: readonly QueryComparator[] = ["eq", "ne", "gt", "gte", "lt", "lte"];

/** Shared by validation and the notification picker. No implicit date/time or reference conversion. */
export function queryFieldsComparable(module: ModuleSchema, leftKey: string, rightKey: string): boolean {
  const left = fieldOf(module, leftKey) ?? platformQueryFields(module.lifecycle.statuses).find((field) => field.key === leftKey);
  const right = fieldOf(module, rightKey) ?? platformQueryFields(module.lifecycle.statuses).find((field) => field.key === rightKey);
  if (!left || !right || left.multiple || right.multiple) return false;
  const numeric = ["number", "money", "percent"];
  const textual = ["string", "text"];
  if (numeric.includes(left.type) && numeric.includes(right.type)) return true;
  if (textual.includes(left.type) && textual.includes(right.type)) return true;
  if (left.type !== right.type) return false;
  if (left.type === "ref" || left.type === "refLine") return left.ref === right.ref && left.through === right.through;
  if (left.type === "enum") return left.choiceSet !== null && left.choiceSet === right.choiceSet;
  return ["date", "datetime", "bool"].includes(left.type);
}

export function assertQueryFieldComparison(module: ModuleSchema, field: string, op: QueryComparator, raw: QueryFieldValue, label: string): void {
  assertClosedKeys(requireObject(raw, label), ["$field"], label);
  const right = requireText(raw.$field, `${label}.$field`);
  if (!QUERY_FIELD_COMPARATORS.includes(op)) schemaFail(`${label}: this comparison does not accept a field as the value`);
  queryTypeOf(module, field, label);
  queryTypeOf(module, right, label);
  if (!queryFieldsComparable(module, field, right)) schemaFail(`${label}: the two fields have different data types or related objects and cannot be compared`);
}

export interface QueryCondition {
  readonly kind: "cond";
  /** A field key of this module, or a platform field (status / createdBy / createdAt …). */
  readonly field: string;
  readonly op: QueryComparator;
  readonly value: unknown;
}

export interface QueryGroup {
  readonly kind: "group";
  readonly join: QueryJoin;
  readonly children: readonly QueryNode[];
}

/** A condition tree. Nested groups are allowed. "A and (B or C)" is everyday ERP, and a flat list cannot express it. */
export type QueryNode = QueryCondition | QueryGroup;

export interface QuerySort {
  readonly field: string;
  readonly desc: boolean;
}

/**
 * One query.
 *
 * `search` and `where` are two things. `search` fuzzy-matches the columns declared
 * in `views.list.searchable`; it is the search box. `where` is the structured
 * condition tree; it is the advanced-query panel. Folding them together makes
 * "which columns does the search box apply to" unanswerable.
 */
export interface Query {
  readonly where: QueryNode | null;
  /**
   * Search terms. One term is a string; a batch is an array. The semantics match:
   * fuzzy match on the `views.list.searchable` columns, and both terms and columns are or-ed.
   *
   * 🔴 The array branch is for asking a batch of names at once (20 goods names in
   * one material; looking them up one by one is 20 round trips). A single string
   * behaves exactly as before: one term compiles to the same condition.
   *
   * `limit` is the quota for the whole batch, not for each term. Twenty terms with
   * limit 10 can easily return 10 rows that all hit the first term and none for the
   * other 19, and the caller sees "looked it up; nothing". The only way to know the
   * answer is complete is `total <= number of rows returned`. Otherwise the batch
   * was truncated: raise the limit, or query the terms separately.
   */
  readonly search: string | readonly string[] | null;
  readonly sort: readonly QuerySort[];
  readonly limit: number;
  readonly offset: number;
}

/**
 * Flatten `search` back into the one sentence a search box can show.
 *
 * 🔴 The human side has one input, which is inherently a single term. The array
 * branch can only come from an agent (a model asking a batch of names at once).
 * This function is for the UI and the URL, not for the query. The query side
 * always uses `searchTerms()`, where many terms stay many terms.
 *
 * Joining many terms with spaces only lets a person see all of them. It does not
 * round-trip: parsing it back becomes one term that contains spaces. That is a
 * boundary, not a defect. The UI never produces many terms, and there is no second
 * box to put them in. A URL that carries many terms needs a multi-value format on
 * `LIST_URL_KEYS.search` first. That is a separate change.
 */
export function searchText(search: string | readonly string[] | null | undefined): string {
  return searchTerms(search).join(" ");
}

/**
 * How many search terms one query may carry. The cap is hard, for the same reason
 * as `QUERY_MAX_LIMIT`: the term count multiplies into the SQL or-branches
 * (terms times searchable columns). With no cap, someone will eventually take the database down with it.
 *
 * ## Why 100 and not 20
 *
 * 20 was estimated from "20 goods names in one material", and real materials are
 * larger: a sales contract with 49 customer names, an order sheet with 51 rows.
 * Past the cap the model gets a 400 and then retries in batches. Each batch is a
 * full model round trip, 10 to 60 seconds, while those terms in one SQL statement
 * stay on the order of a second even when slow. "If it can be queried once, do not
 * take another model round" is an order-of-magnitude gap on this path, not a constant factor.
 *
 * The cap is still hard; it only moved. 100 terms times searchable columns (at most
 * 5 in this repo) is 500 ilike branches, still one statement, still bounded by
 * `limit`. What takes a database down is no cap, not 100. Going higher means
 * changing how `search` is implemented (a trigram index or full-text index), not raising this number again.
 */
export const QUERY_MAX_SEARCH_TERMS = 100;

/**
 * Normalize `search` into a term list. Empty terms are dropped. All empty is the same as no search.
 *
 * 🔴 Consumers (the permission gate and SQL compilation) share this function and
 * do not expand the value themselves. If the two places drift on what counts as a
 * valid search term, the gate lets it through as "no search" while the compiler
 * still adds a condition (or the reverse). Each side looks fine on its own.
 */
export function searchTerms(search: string | readonly string[] | null | undefined): readonly string[] {
  if (search === null || search === undefined) return [];
  const raw = typeof search === "string" ? [search] : search;
  return raw.map((term) => term.trim()).filter((term) => term !== "");
}

/** Maximum rows per page. The cap is hard: an uncapped list query will eventually be used to take the database down. */
export const QUERY_MAX_LIMIT = 200;
export const QUERY_DEFAULT_LIMIT = 50;

/**
 * Comparators allowed for each field type.
 *
 * 🔴 This lives in the kernel because three consumers must see the same set: the
 * candidates the advanced-query panel draws, the candidates the agent tool catalog
 * tells the model, and the set the server accepts when compiling SQL. A copy in
 * each place means the panel can compose it, the model will send it, and the
 * server rejects it, and nobody can say which one is right.
 *
 * `null` means this field type cannot be queried (it does not mean "allow every comparator").
 */
export const COMPARATORS_BY_TYPE: Readonly<Record<FieldType, readonly QueryComparator[] | null>> = Object.freeze({
  // 🔴 `in` is not added in passing. `code` (bill number) and `id` are both
  // strings, and "take a batch of identifiers and resolve them to words once" is
  // one of the most frequent ERP reads (N goods ids from a bill's lines, then one
  // lookup of their names and specs). Without it the caller can only send N eqs
  // or N gets. In practice the model hit `id in [...]` / `code in [...]` five times in a row.
  // `text` does not get `in`: enumerating a batch of values against long text has no reading.
  string: ["eq", "ne", "in", "not_in", "contains", "not_contains", "is_empty", "not_empty"],
  text: ["eq", "ne", "contains", "not_contains", "is_empty", "not_empty"],
  phone: ["eq", "ne", "contains", "not_contains", "is_empty", "not_empty"],
  // A range is the everyday question for numbers and dates ("100,000 to 500,000").
  // Splitting it into gte plus lte makes the condition count 2, makes the summary
  // unreadable, and makes the user invent the "and".
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"],
  money: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"],
  percent: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"],
  date: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"],
  datetime: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "is_empty", "not_empty"],
  enum: ["eq", "ne", "in", "not_in", "is_empty", "not_empty"],
  ref: ["eq", "ne", "in", "not_in", "is_empty", "not_empty"],
  // A line reference is queryable too: it is a column of ids. Querying it is how
  // you answer "which outbound lines reference this order line", and that is the
  // whole foundation of over-issue control and progress write-back.
  refLine: ["eq", "ne", "in", "not_in", "is_empty", "not_empty"],
  // bool also needs "is empty": a three-state boolean in ERP is yes / no / not filled in,
  // and "not filled in" is not the same business fact as "no".
  bool: ["eq", "is_empty", "not_empty"],
  // A subtable is not a value; an attachment has no comparable value. Neither has a reading for "equal to what".
  subtable: null,
  attachment: null,
});

export function isQueryableType(type: FieldType): boolean {
  return COMPARATORS_BY_TYPE[type] !== null;
}

/** Comparators a field may use. Unqueryable types throw. They do not fall back to "allow all". */
export function comparatorsFor(type: FieldType, label = "field"): readonly QueryComparator[] {
  const list = COMPARATORS_BY_TYPE[type];
  if (!list) schemaFail(`${label}: type ${type} cannot be a query condition`);
  return list;
}

// ── queryable shape of platform fields ───────────────────────────────────

/**
 * Platform fields a user can see. Filters, the agent, and list column settings share this one list.
 *
 * This is not `PLATFORM_FIELDS`. That table includes `tenantId` / `orgId` (pure
 * plumbing, never exposed). This table is "can be queried and projected". `id` is
 * an internal primary key, but `bill_list` must return it (together with `module`
 * it is the bill handle), and agent tools need to know `id` is a legal queryable
 * field. `status` is visible on the list by default. The four audit columns
 * (`AUDIT_LIST_FIELDS`) are appended after the business columns by default; after
 * a module declares `hideAudit: true` they remain only as column-setting candidates.
 *
 * 🔴 One copy only. The agent and the panel each copied it once, and after `updatedAt` drifted neither side reported an error.
 */
export const PLATFORM_QUERY_FIELDS: readonly { readonly key: PlatformField; readonly label: string }[] =
  Object.freeze([
    { key: "id", label: "ID" },
    { key: "status", label: "Status" },
    { key: "createdBy", label: "Created by" },
    { key: "createdAt", label: "Created at" },
    { key: "updatedBy", label: "Updated by" },
    { key: "updatedAt", label: "Last updated at" },
  ]);

/**
 * Framework audit fields. They are not business fields and must not be written into `views.list.columns`.
 * `planListColumns` appends them after the business columns by default (`hideAudit: true` turns that off).
 */
export const AUDIT_LIST_FIELDS = ["createdBy", "createdAt", "updatedBy", "updatedAt"] as const;
export type AuditListField = (typeof AUDIT_LIST_FIELDS)[number];

/**
 * Compile platform fields into `Field` so the panel treats them the same as business fields.
 *
 * Status candidates are passed in by the caller from `lifecycle.statuses` as-is.
 * The kernel does not know concrete status names, and it does not treat a key as
 * display copy. Data scope, advanced query, and the agent tool catalog all read this one list.
 */
export function platformQueryFields(
  statuses: readonly { readonly key: string; readonly label: string }[],
): readonly Field[] {
  if (statuses.length === 0) {
    schemaFail("platformQueryFields: lifecycle.statuses is empty, so the platform field status has no candidates");
  }
  return PLATFORM_QUERY_FIELDS.map((p) => ({
    key: p.key,
    label: p.label,
    type: PLATFORM_FIELD_TYPES[p.key],
    required: false,
    primary: false,
    // Uniqueness of platform fields is guaranteed by the framework (`id` is the
    // primary key), not by the `Field.unique` declaration. That bit is for business
    // fields, and the table builder does not read it on platform fields.
    unique: false,
    uniqueWith: null,
    auto: false,
    options: p.key === "status" ? statuses.map((status) => ({ value: status.key, label: status.label })) : null,
    choiceSet: null,
    // createdBy / updatedBy point at a person entity, but writing an entity code
    // into the kernel is hard-coding. The candidate person list is supplied by the layer above through optionsFor.
    ref: null,
    // No ref means no candidate set, so there is nowhere to send a filter (the refFilter reverse-closure gate also rejects this combination).
    refFilter: null,
    // Same reason: no candidate set means there is no "default among the candidates".
    refPreselect: null,
    refPreselectSole: false,
    through: null,
    derive: null,
    calculate: null,
    snapshot: null,
    refDefault: null,
    unitChoice: null,
    lineAgg: null,
    help: null,
    // Platform fields do not participate in push-down. The framework fills them on
    // write (status takes the initial state; audit fields take the current identity).
    // Carrying them from the source bill would make the pushed draft inherit the upstream creator and created time.
    pushFrom: null,
    fields: null,
  }));
}

function fieldOf(module: ModuleSchema, key: string): Field | null {
  return module.fields.find((f) => f.key === key) ?? null;
}

/**
 * Comparators allowed on a line condition.
 *
 * The meaning is fixed as "there exists a line that satisfies it" (compiled to an
 * `exists` subquery). The only criterion is whether, under that meaning, the
 * comparator has a second equally natural reading.
 *
 * 🔴 Negations have no unique reading and are always rejected. A bill has N lines,
 * so `lines.orderId ne X` has two readings: "there exists a line that is not X" and
 * "no line is X". An outbound bill that merged orders A and B hits `ne A` under the
 * first and misses it under the second. Both result sets are fully legal, and the
 * user cannot tell which one they got. Rejecting is better than picking one.
 * `not_in` is the same, and so are `is_empty` / `not_empty` ("one line is unfilled"
 * is not "the whole bill is unfilled").
 *
 * 🔴 Orderings and ranges are not in that group. Under "there exists a line" they
 * are unique: "there exists a line whose planned arrival date is before today" has
 * no second reading. ERP naturally puts the most important criteria on the line
 * (planned arrival date, quantity still to issue). Banning them for the same reason
 * as negation would make line-level threshold queries absent entirely. The executor
 * needs no change: `compileLineExists` hands the value to the shared
 * `compileComparison`, still compiles the same `exists`, and the row-count meaning stays.
 *
 * Passing here is not final availability. After `normalizeQuery` the condition still
 * has to pass `comparatorsFor(column type)`. Both gates must pass (a date column has no `in` to begin with).
 */
export const LINE_PATH_COMPARATORS: readonly QueryComparator[] = Object.freeze([
  "eq",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
]);

/** Shape of a line condition path: `<line-table key>.<column key>`. One level, matching the one level of lines. */
export interface LinePath {
  readonly table: Field;
  readonly column: Field;
}

/**
 * Separator of a line path. Construction and parsing share this constant. Each
 * side inventing its own does not show up as an error: one side's key differs by
 * one character from the shape the other side recognizes, and both think they are right.
 */
const LINE_PATH_SEP = ".";

/**
 * Whether a query field name is a line path. Shape only; it does not look up the
 * declaration. Looking up the declaration is `parseLinePath`'s job.
 *
 * This projection exists because consumers split in two. Callers of `parseLinePath`
 * hold a whole `ModuleSchema` (kernel normalize, server compile). The filter panel
 * only has a slice of `fields`, and all it needs to ask is "is this candidate a
 * line". Requiring a schema for that question forces the render layer to carry an extra parameter.
 */
export function isLinePath(key: string): boolean {
  return key.includes(LINE_PATH_SEP);
}

/**
 * Build the field name of a line condition.
 *
 * 🔴 This is the other face of the same shape as `parseLinePath`, so they live
 * together. Two places used to assemble it separately (`reverseQueryFieldOf` and
 * the filter panel's candidates). One wrong character shows up as "the relations
 * panel jumps there and finds nothing" or "the panel can compose it and the server
 * does not accept it". Neither side reports an error.
 */
export function linePathOf(table: string, column: string): string {
  if (isLinePath(table) || isLinePath(column)) {
    schemaFail(
      `linePathOf: "${table}" / "${column}" must not contain "${LINE_PATH_SEP}". Lines have only one level; ` +
        `an extra level is parsed back as a mistake`,
    );
  }
  return `${table}${LINE_PATH_SEP}${column}`;
}

/**
 * Parse a field name that may contain a dot. No dot returns null (a header field, the original path).
 *
 * A dotted name that cannot be parsed throws. It does not fall back to "treat this
 * as a header field with that name". The fallback reports a mistyped condition as
 * "the module has no field lines.orderId", when the real problem is a wrong column name.
 */
export function parseLinePath(module: ModuleSchema, key: string, label: string): LinePath | null {
  if (!isLinePath(key)) return null;
  const parts = key.split(LINE_PATH_SEP);
  if (parts.length !== 2) {
    schemaFail(`${label}: "${key}" supports only one line-path level (for example lines${LINE_PATH_SEP}orderId). Lines have only one level`);
  }
  const [tableKey, columnKey] = parts as [string, string];
  const table = fieldOf(module, tableKey);
  if (!table || table.type !== "subtable" || !table.fields) {
    const tables = module.fields.filter((f) => f.type === "subtable").map((f) => f.key);
    queryInputFail(
      "LINE_TABLE_UNKNOWN",
      label,
      `${label}: module "${module.code}" has no line table "${tableKey}"`,
      tables.length
        ? `Write a line path as <line table>${LINE_PATH_SEP}<column>. This module's line tables are in valid`
        : `Module "${module.code}" has no line table, so a condition can use only header fields`,
      { valid: tables, didYouMean: didYouMean(tableKey, tables), fixable: "machine", read: readQueryHint(module) },
    );
  }
  const column = table.fields.find((f) => f.key === columnKey);
  if (!column) {
    const columns = table.fields.filter((f) => isQueryableType(f.type)).map((f) => f.key);
    queryInputFail(
      "LINE_COLUMN_UNKNOWN",
      label,
      `${label}: line table "${tableKey}" has no column "${columnKey}"`,
      `Replace the column name with one from valid (the condition still needs the ${tableKey}${LINE_PATH_SEP} prefix)`,
      { valid: columns, didYouMean: didYouMean(columnKey, columns), fixable: "machine", read: readQueryHint(module) },
    );
  }
  if (!isQueryableType(column.type)) {
    const columns = table.fields.filter((f) => isQueryableType(f.type)).map((f) => f.key);
    queryInputFail(
      "LINE_COLUMN_NOT_QUERYABLE",
      label,
      `${label}: "${key}" is type ${column.type} and cannot be a query condition`,
      `Pick a queryable column (see valid). Type ${column.type} has no comparable value`,
      { valid: columns, fixable: "machine", read: readQueryHint(module) },
    );
  }
  return { table, column };
}

/** Where to look up the full set of filterable fields. Today the only entry is `module_describe`; point this at a path once erp-fs lands. */
function readQueryHint(module: ModuleSchema): string {
  return `module_describe({ module: "${module.code}", section: "query" })`;
}

/**
 * Every field name this module can put in a condition (header plus platform).
 *
 * 🔴 Line columns are not expanded. They need a `lines.` prefix, and there may be
 * several times as many of them as header fields. Stuffing the whole set into one
 * error pushes the response past the budget gate, and the budget gate cuts off
 * exactly this teaching information. Legal line columns are given per table on
 * `LINE_COLUMN_UNKNOWN`: the model gets the table it wrote wrong.
 */
function queryableKeys(module: ModuleSchema): readonly string[] {
  const declared = module.fields.filter((f) => isQueryableType(f.type)).map((f) => f.key);
  const platform = platformQueryFields(module.lifecycle.statuses).map((f) => f.key);
  return [...declared, ...platform];
}

/**
 * The type of a field name in a query. Unqueryable names throw.
 *
 * 🔴 Platform fields also get a type (`PLATFORM_FIELD_TYPES`) and are no longer
 * passed through. Passing them through lets `{ field: "createdAt", op: "contains" }`
 * clear the kernel and be rejected only when the server compiles. "The panel can
 * compose it, the model will send it, and the server does not accept it" is exactly what this table exists to remove.
 */
function queryTypeOf(module: ModuleSchema, key: string, label: string): FieldType {
  if (isPlatformField(key)) return PLATFORM_FIELD_TYPES[key as PlatformField];
  const field = fieldOf(module, key);
  if (!field) {
    // 🔴 This is the error a model hits most often (writing `orderDate` for `createdAt`).
    // Saying only "no such field" leaves it to guess again. Giving the legal set and the nearest candidate lets it correct in one try.
    const valid = queryableKeys(module);
    queryInputFail(
      "QUERY_FIELD_UNKNOWN",
      label,
      `${label}: module "${module.code}" has no field "${key}"`,
      `Replace field with one from valid. A criterion on a line needs the lines${LINE_PATH_SEP} prefix`,
      { valid, didYouMean: didYouMean(key, valid), fixable: "machine", read: readQueryHint(module) },
    );
  }
  // Queryability has one criterion: COMPARATORS_BY_TYPE.
  // A subtable is not a value and an attachment has no comparable value. Both are said in that table.
  // A derived field (including formula) keeps its real type, so it is queryable: the executor compiles it to an expression or a subquery.
  if (!isQueryableType(field.type)) {
    queryInputFail(
      "QUERY_FIELD_NOT_QUERYABLE",
      label,
      `${label}: "${key}" is type ${field.type} and cannot be a query condition`,
      field.type === "subtable"
        ? `A criterion on lines is written ${key}${LINE_PATH_SEP}<column>, not as a comparison of the whole line table`
        : `Pick a queryable field (see valid). Type ${field.type} has no comparable value`,
      { valid: queryableKeys(module), fixable: "machine", read: readQueryHint(module) },
    );
  }
  return field.type;
}

function normalizeNode(module: ModuleSchema, raw: unknown, label: string): QueryNode {
  const obj = requireObject(raw, label);
  const kind = requireEnum(obj["kind"], ["cond", "group"] as const, `${label}.kind`);

  if (kind === "group") {
    assertClosedKeys(obj, ["kind", "join", "children"], label);
    const children = requireArray(obj["children"], `${label}.children`);
    // A nested empty group has no legal reading: it is neither always true nor always false.
    // An empty group at the top-level `where` is collapsed to null in `normalizeQuery` and does not reach here.
    if (!children.length) schemaFail(`${label}.children must not be empty. An empty condition group has no definite meaning`);
    return {
      kind,
      join: requireEnum(obj["join"], QUERY_JOINS, `${label}.join`),
      children: children.map((c, i) => normalizeNode(module, c, `${label}.children[${i}]`)),
    };
  }

  assertClosedKeys(obj, ["kind", "field", "op", "value"], label);
  const field = requireText(obj["field"], `${label}.field`);

  // A line condition (`lines.orderId`). A merged outbound bill pushes "which order"
  // off the header onto the line, so a reverse lookup of downstream bills can only
  // be asked at this level. The meaning is fixed as "there exists a line" that matches; the rows returned are still headers.
  const linePath = parseLinePath(module, field, label);
  if (linePath) {
    const op = requireEnum(obj["op"], QUERY_COMPARATORS, `${label}.op`);
    if (!LINE_PATH_COMPARATORS.includes(op)) {
      schemaFail(
        `${label}: line condition "${field}" supports only ${LINE_PATH_COMPARATORS.join(" / ")} (received "${op}"). ` +
          `A bill has N lines, so negation and empty-checks have two equally natural readings at this level (a line exists that is not X / no line is X), ` +
          `and both result sets are legal while the user cannot tell which one they got`,
      );
    }
    const allowed = comparatorsFor(linePath.column.type, `${label}: "${field}"`);
    if (!allowed.includes(op)) {
      schemaFail(
        `${label}: "${field}" is type ${linePath.column.type} and does not support comparator "${op}". Available: ${allowed.join(" / ")}`,
      );
    }
    if (obj["value"] === undefined) schemaFail(`${label}.value is missing`);
    return { kind, field, op, value: normalizeValue(obj["value"], op, linePath.column.type, `${label}.value`) };
  }

  const type = queryTypeOf(module, field, label);
  const op = requireEnum(obj["op"], QUERY_COMPARATORS, `${label}.op`);

  // The comparator must match the field type. This gate used to run only when
  // the server compiled, so the same condition was legal to the kernel and illegal
  // to the server. Both sides were "right", and nobody could say which to trust.
  const allowed = comparatorsFor(type, `${label}: "${field}"`);
  if (!allowed.includes(op)) {
    schemaFail(
      `${label}: "${field}" is type ${type} and does not support comparator "${op}". Available: ${allowed.join(" / ")}`,
    );
  }

  // undefined and null are two different things in SQL and must not be blurred.
  if (obj["value"] === undefined) schemaFail(`${label}.value is missing. To query an empty value, write the comparison as is_empty`);
  if (isQueryFieldValue(obj["value"])) {
    const value = obj["value"];
    assertQueryFieldComparison(module, field, op, value, `${label}.value`);
    return { kind, field, op, value: { $field: value.$field } };
  }
  return { kind, field, op, value: normalizeValue(obj["value"], op, type, `${label}.value`) };
}

/**
 * Check a value's shape against its comparator.
 *
 * 🔴 A mismatched shape throws. It is not guessed. Guessing silently changes the
 * result set either way: treating a scalar `between` as `eq` returns extra rows;
 * taking the first two of three elements returns fewer rows.
 */
function normalizeValue(raw: unknown, op: QueryComparator, type: FieldType, label: string): unknown {
  const relativeOk = RELATIVE_OK_TYPES.includes(type) && RELATIVE_OK_OPS.includes(op);

  /** Shared by range endpoints and scalars: accept a relative token, otherwise pass the value through (the executor binds the value). */
  const endpoint = (value: unknown, at: string): unknown => {
    if (isQueryFieldValue(value)) schemaFail(`${at}: a field value supports only a direct comparison between header fields`);
    if (!isRelativeDateValue(value)) return value;
    if (!relativeOk) {
      schemaFail(
        `${at}: relative time can be used only on date / datetime fields, and only with ${RELATIVE_OK_OPS.join(" / ")}. ` +
          `This is "${op}" on ${type}. An unrecognized value shape must not be silently stuffed into SQL as a string`,
      );
    }
    // 🔴 Carry the field type all the way in. The rolling-hour tier is valid only
    // on datetime, and this is the only place that knows both "the value is a relative tier" and "what type the field is".
    return normalizeRelativeDate(value, type, at);
  };

  switch (QUERY_VALUE_SHAPE[op]) {
    case "none":
      // Once "is empty" has its own comparator, the value slot must be empty.
      // A value means the caller is still using the old spelling, and that old
      // spelling (eq + null) is exactly where "the user has not filled this in" and "query for empty" shared one representation.
      if (raw !== null) {
        schemaFail(`${label}: "${op}" does not accept a value (received ${JSON.stringify(raw)}). Write null`);
      }
      return null;

    case "list": {
      const list = requireArray(raw, label);
      // An empty set has a definite reading: in [] matches nobody, not_in [] matches everybody. That is a legal question, not a missing value.
      return list.map((v, i) => {
        // `x in (null)` and `x not in (null)` are both constantly unknown in SQL, so no row is returned.
        // The second is the trap: the user reads it as "exclude the unfilled", and it actually means "return nothing".
        if (v === null) schemaFail(`${label}[${i}]: a candidate value must not be null. To ask about empty values use is_empty / not_empty`);
        return endpoint(v, `${label}[${i}]`);
      });
    }

    case "range": {
      const list = requireArray(raw, label);
      if (list.length !== 2) {
        schemaFail(`${label}: the value of "${op}" must be a range array of length exactly 2; received ${list.length} items`);
      }
      const [lo, hi] = [endpoint(list[0], `${label}[0]`), endpoint(list[1], `${label}[1]`)];
      if (lo === null || lo === undefined || hi === null || hi === undefined) {
        schemaFail(`${label}: both ends of "${op}" must have a value. To query an empty value, change the comparison to is_empty`);
      }
      // A relative value is a complete half-open range, not one endpoint. Putting
      // two ranges into between produces a third basis, "start of the first range
      // through end of the second". The most common mechanical patch,
      // this_month + next_n_days(1), quietly becomes "start of the month through tomorrow", not this month.
      if (isRelativeDateValue(lo) || isRelativeDateValue(hi)) {
        const fixed = [lo, hi].find(
          (value): value is RelativeDateToken =>
            isRelativeDateValue(value) && !isRelativeSpanValue(value),
        );
        const hint = fixed
          ? `To query "${relativeDateLabel(fixed)}" use op=eq and value=${JSON.stringify(fixed)}. between accepts only two absolute date/time endpoints`
          : "For a relative period use op=eq and a single token. between accepts only two absolute date/time endpoints";
        queryInputFail(
          "RELATIVE_RANGE_NOT_BETWEEN_ENDPOINT",
          label,
          `${label}: a relative-time token means a complete period and cannot be a between endpoint`,
          hint,
        );
      }
      // A reversed range is always false. It still returns a result set (an empty
      // one), and the user reads an empty result as "there is no such bill".
      // Judge only when both ends are comparable scalars. A mix of a relative token and an absolute value cannot be compared statically and is left to the executor.
      if (typeof lo === typeof hi && (typeof lo === "number" || typeof lo === "string") && lo > (hi as typeof lo)) {
        queryInputFail(
          "QUERY_RANGE_REVERSED",
          label,
          `${label}: range lower bound ${JSON.stringify(lo)} is greater than upper bound ${JSON.stringify(hi)}. A reversed range never matches anything`,
          "Order the two absolute endpoints of between from smaller to larger in time or number. For a complete period such as this month, use op=eq plus a single relative token",
        );
      }
      return [lo, hi];
    }

    case "scalar":
      if (Array.isArray(raw)) schemaFail(`${label}: the value of "${op}" cannot be an array`);
      // 🔴 One question keeps one spelling. `eq null` used to be both the explicit
      // spelling of "query empty" and the UI's intermediate state for "the user has
      // not filled this in". One value slot cannot express two things. Adding a
      // condition and applying it unfilled compiled to `is null`, the list went to
      // zero, and the user read "my bills disappeared". Empty values are now asked only with is_empty / not_empty.
      if (raw === null) {
        schemaFail(`${label}: the value of "${op}" cannot be null. To ask about an empty value, change the comparison to is_empty / not_empty`);
      }
      return endpoint(raw, label);
  }
}

/**
 * Models often write "no filter" as `{ kind: "group", join: "and", children: [] }`.
 * That has a unique reading only at the where root (= no where). A nested empty group is still rejected.
 */
function isVacuousWhereGroup(raw: unknown, label: string): boolean {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  /**
   * 🔴 `{}` is also "no filter".
   *
   * Only `{kind:"group", children:[]}` used to be recognized, so a model sending
   * `where: {}` hit "query.where.kind \"undefined\" is unknown" when all it meant
   * was "do not filter". In practice it then sent an empty group: the same meaning, two round trips.
   *
   * Only a completely empty object is recognized. An object with keys (`{field:"code"}`)
   * still goes through `normalizeNode` and errors. That is a real mistake. Treating
   * it as "no filter" would turn one filter into a full-table return.
   */
  if (Object.keys(obj).length === 0) return true;
  if (obj["kind"] !== "group") return false;
  if (!Array.isArray(obj["children"]) || obj["children"].length > 0) return false;
  assertClosedKeys(obj, ["kind", "join", "children"], label);
  requireEnum(obj["join"], QUERY_JOINS, `${label}.join`);
  return true;
}

/**
 * Normalize one query request.
 *
 * 🔴 This is a security boundary, not just data cleaning. Query conditions come
 * from the browser. Without checking field names, a constructed `field` can ask
 * for a column the module never meant to expose. Passing validation means every
 * name in the condition is a field this module declared, or a platform field.
 */
/**
 * `search` accepts two spellings: one term (a string) or a batch of terms (an array of strings).
 *
 * 🔴 The array must pass `requireText` term by term. A `null` mixed into the term
 * list, if not stopped, reaches `ilike` as a condition that matches nothing, and
 * the empty result looks identical to "there really is none".
 */
function normalizeSearch(raw: unknown, label: string): string | readonly string[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return requireText(raw, label);
  if (raw.length > QUERY_MAX_SEARCH_TERMS) {
    schemaFail(`${label} allows at most ${QUERY_MAX_SEARCH_TERMS} terms at once; received ${raw.length}`);
  }
  // `requireText` already rejects empty or blank strings and trims. Same rule as the single-term branch:
  // `search: ""` throws today, so an empty string mixed into the array has no reason to be more lenient.
  return raw.map((term, i) => requireText(term, `${label}[${String(i)}]`));
}

export function normalizeQuery(module: ModuleSchema, raw: unknown, label = "query"): Query {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["where", "search", "sort", "limit", "offset"], label);

  const whereRaw = obj["where"];
  const searchRaw = obj["search"];
  const sortRaw = obj["sort"];

  const sort = sortRaw === undefined || sortRaw === null
    ? []
    : requireArray(sortRaw, `${label}.sort`).map((s, i) => {
        const at = `${label}.sort[${i}]`;
        const o = requireObject(s, at);
        assertClosedKeys(o, ["field", "desc"], at);
        const field = requireText(o["field"], `${at}.field`);
        queryTypeOf(module, field, at);
        return { field, desc: o["desc"] === true };
      });

  const limitRaw = obj["limit"];
  const limit = limitRaw === undefined || limitRaw === null ? QUERY_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) schemaFail(`${label}.limit must be a positive integer`);
  if (limit > QUERY_MAX_LIMIT) schemaFail(`${label}.limit is at most ${QUERY_MAX_LIMIT}; received ${limit}`);

  const offsetRaw = obj["offset"];
  const offset = offsetRaw === undefined || offsetRaw === null ? 0 : Number(offsetRaw);
  if (!Number.isInteger(offset) || offset < 0) schemaFail(`${label}.offset must be a non-negative integer`);

  return {
    where:
      whereRaw === undefined || whereRaw === null || isVacuousWhereGroup(whereRaw, `${label}.where`)
        ? null
        : normalizeNode(module, whereRaw, `${label}.where`),
    search: normalizeSearch(searchRaw, `${label}.search`),
    sort,
    limit,
    offset,
  };
}

// ── saved views ───────────────────────────────────────────────────────────

/**
 * A user's override of columns.
 *
 * 🔴 Store only the delta, not the whole column list. That gives the system one
 * key property: add a field to `salesOrder` and restart, and a user who already
 * saved a view can still see it. Storing the whole list makes a new field
 * permanently invisible to everyone who saved a view. That is how the promise
 * "change the schema and the UI changes" fails, and it fails with no sound.
 */
/**
 * Aggregation shown in the footer.
 *
 * 🔴 Same basis as the line-table total (`SubtableEditor`): only `number` / `money` have a business meaning.
 * Summing `percent` adds percentages into a number that has no reading.
 */
export const SUMMARY_FNS = ["sum", "count", "avg", "max", "min"] as const;
export type SummaryFn = (typeof SUMMARY_FNS)[number];

/**
 * 🔴 Reference `AGG_TEXT` directly. Do not copy it. `SUMMARY_FNS` and `DERIVE_AGGS`
 * are the same five words, one used in the footer and one in field descriptions.
 * After two copies, one side changes and the other does not, and "the same
 * aggregate has two names" is reported nowhere.
 */
export const SUMMARY_FN_TEXT: Readonly<Record<SummaryFn, string>> = AGG_TEXT;

/** Field types that can carry an aggregate. This is the only criterion. The UI and the server share it. */
export function isSummarizableType(type: FieldType): boolean {
  return type === "number" || type === "money";
}

export interface ColumnOverride {
  readonly field: string;
  readonly hidden: boolean;
  /** Width in pixels; null = use the default. */
  readonly width: number | null;
  /** Insertion index in the default order; null = do not change the order. */
  readonly order: number | null;
  /**
   * Which aggregate the footer applies to this column; null = no total.
   *
   * 🔴 It lives on the column, not as a separate `summaries` array on `SavedView`.
   * An aggregate is a property of the column, at the same level as hidden / width / order.
   * It then inherits the "store only the delta" rule and hides and moves with the
   * column. There is no orphan state where a total points at a field that has already been deleted.
   */
  readonly summary: SummaryFn | null;
}

/**
 * Aggregates a list request should compute along the way.
 *
 * 🔴 Not part of `Query`. `Query` is "what is being asked" (it goes in the address
 * bar and in SavedView.query). An aggregate is another projection of that batch of
 * answers, derived from the column `summary` delta (it goes in SavedView.columns).
 * Mixing it into Query turns "check a total" into "ask a different question": the
 * address bar changes, dirty lights up, and the user only wanted to see the total.
 */
export interface SummarySpec {
  readonly field: string;
  readonly fn: SummaryFn;
}

/** Key of an aggregate result. If the frontend and backend each assemble it, they drift, so the spelling lives in one place. */
export function summaryKey(spec: SummarySpec): string {
  return `${spec.field}:${spec.fn}`;
}

/**
 * Normalize the aggregates in one request.
 *
 * 🔴 A security boundary at the same level as `normalizeQuery`. Field names come
 * from the browser and must fall back onto an allow-list before they are compiled
 * into SQL. This is stricter than a column override: a field that does not exist
 * in the request is the caller writing it wrong, not historical data, so it throws.
 */
export function normalizeAggregates(module: ModuleSchema, raw: unknown, label = "aggregates"): readonly SummarySpec[] {
  if (raw === undefined || raw === null) return [];
  return requireArray(raw, label).map((item, i) => {
    const at = `${label}[${String(i)}]`;
    const obj = requireObject(item, at);
    assertClosedKeys(obj, ["field", "fn"], at);
    const key = requireText(obj["field"], `${at}.field`);
    const fn = requireEnum(obj["fn"], SUMMARY_FNS, `${at}.fn`);
    if (isPlatformField(key)) {
      schemaFail(
        `${at}: platform field "${key}" is not numeric and cannot be aggregated. ` +
          `aggregates are the single-value totals in the list footer (what these bills add up to). ` +
          `To group by ${key} and count each group, use analysis_sql: SELECT ${key}, COUNT(*) AS n FROM <the table from module_describe analysis> GROUP BY 1 LIMIT 20`,
      );
    }
    const field = fieldOf(module, key);
    if (field === null) {
      schemaFail(`${at}: module "${module.code}" has no field "${key}"`);
    }
    if (!isSummarizableType(field.type)) {
      schemaFail(
        `${at}: "${field.label}" is type ${field.type} and cannot be aggregated. Only number / money have a business meaning. ` +
          `To count how many bills there are, read total in the response. To group by ${field.label} and count each group, use analysis_sql: ` +
          `SELECT <column>, COUNT(*) AS n FROM <the table from module_describe analysis> GROUP BY 1 LIMIT 20`,
      );
    }
    return { field: key, fn };
  });
}

/** An optional numeric slot. `null` means "do not change". A non-number is the caller writing it wrong. */
function optionalNumber(raw: Record<string, unknown>, key: string, label: string): number | null {
  const value = raw[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    schemaFail(`${label}.${key} must be a number or null; received ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Normalize the shape of a column override (it does not know the schema).
 *
 * The four keys must all be present (`field` / `hidden` / `width` / `order`). An
 * override that writes only `{ field, hidden }` cannot tell whether width and order
 * mean "keep the default" or "were not stored". The write side is a payload the
 * caller assembled, not historical data. A missing key is a mistake, so it throws.
 *
 * `summary` is the only exemption: an old row missing it is read as `null`. That
 * is not a fallback hiding an error. Views saved before this dimension shipped
 * really have no total. Throwing would scrap every old user's view the moment they
 * open the list. A key that is present with the wrong type (a string `"total"`)
 * still throws: that is the caller writing it wrong, not historical data.
 */
export function normalizeColumnOverrides(raw: unknown, label = "columns"): readonly ColumnOverride[] {
  return requireArray(raw, label).map((item, i) => {
    const at = `${label}[${String(i)}]`;
    const obj = requireObject(item, at);
    assertClosedKeys(obj, ["field", "hidden", "width", "order", "summary"], at);
    const missing = (["field", "hidden", "width", "order"] as const).filter((k) => !(k in obj));
    if (missing.length) {
      schemaFail(
        `${at} is missing keys "${missing.join(", ")}". A partial override cannot tell "keep the default" from "was not stored". ` +
          `To leave a dimension unchanged, write it as null (write false for hidden)`,
      );
    }
    const summary = obj["summary"];
    return {
      field: requireText(obj["field"], `${at}.field`),
      hidden: obj["hidden"] === true,
      width: optionalNumber(obj, "width", at),
      order: optionalNumber(obj, "order", at),
      summary:
        summary === undefined || summary === null ? null : requireEnum(summary, SUMMARY_FNS, `${at}.summary`),
    };
  });
}

/**
 * An aggregate can be attached only to a numeric column.
 *
 * 🔴 A violation throws. It is not silently ignored. Silent ignore looks like the
 * user checked "total", the save succeeded, and that item never appears in the
 * footer, with nowhere that can say why.
 *
 * An override that names a deleted field does not throw. A user view is historical
 * data, not a declaration. Same discipline as `resolveColumns` ignoring a stale
 * reference (those overrides never render).
 */
export function assertSummaryTargets(
  module: ModuleSchema,
  overrides: readonly ColumnOverride[],
  label = "columns",
): void {
  for (const o of overrides) {
    if (o.summary === null) continue;
    if (isPlatformField(o.field)) {
      schemaFail(`${label}: platform field "${o.field}" is not numeric and cannot carry a total`);
    }
    const field = fieldOf(module, o.field);
    if (field === null) continue;
    if (!isSummarizableType(field.type)) {
      schemaFail(
        `${label}: "${field.label}" is type ${field.type} and cannot carry a total. ` +
          `A total has a business meaning only for number / money (the same basis as the line-table total)`,
      );
    }
  }
}

/**
 * A view a user saved = a query plus a column layout.
 *
 * `ownerId` null means a shared view (an administrator built it for the whole department).
 */
export interface SavedView {
  readonly id: string;
  readonly module: string;
  readonly name: string;
  readonly ownerId: string | null;
  readonly query: Query;
  readonly columns: readonly ColumnOverride[];
  readonly isDefault: boolean;
}

// ── view configuration (new implementation) ──────────────────────────────

/**
 * A filter condition: the filter rules of a user-defined view.
 *
 * Similar to a Query where condition, and simpler:
 * - only a comparison of a single field; no nested and/or
 * - dynamic time values are supported (valueType = "dynamic")
 */
export interface FilterCondition {
  readonly field: string;
  readonly operator: QueryComparator;
  readonly value: unknown;
  readonly valueType?: "static" | "dynamic";
}

/**
 * A sort rule: the sort configuration of a user-defined view.
 */
export interface SortRule {
  readonly field: string;
  readonly order: "asc" | "desc";
  readonly priority: number;
}

/**
 * A user view: a user-defined view (new implementation).
 *
 * A view system independent of SavedView. The difference:
 * - SavedView uses a query + columns structure (the old implementation)
 * - UserView uses filters + displayFields + sortRules (the new implementation)
 *
 * Used by the frontend view-configuration feature (PRD 2026-09-14).
 */
export interface UserView {
  readonly id: string;
  readonly module: string;
  readonly name: string;
  readonly icon: string;
  readonly userId: string;
  readonly ownerName: string;
  readonly scope: "all" | "custom";
  readonly scopeUserIds: readonly string[];
  readonly scopeDeptIds: readonly string[];
  readonly canManage: boolean;
  readonly filters: readonly FilterCondition[];
  readonly displayFields: readonly string[];
  readonly sortRules: readonly SortRule[];
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Input for creating or updating a user view.
 */
export interface UserViewInput {
  readonly id?: string | null;
  readonly module: string;
  readonly name: string;
  readonly icon: string;
  readonly filters: readonly FilterCondition[];
  readonly displayFields: readonly string[];
  readonly sortRules: readonly SortRule[];
  readonly scope?: "all" | "custom";
  readonly scopeUserIds?: readonly string[];
  readonly scopeDeptIds?: readonly string[];
}

/**
 * How list columns are decided (the only entry).
 *
 * - **defaults** = the module's `views.list.columns`, guaranteed to include `status`
 *   (unless `hideStatus: true`), then `AUDIT_LIST_FIELDS` appended (unless `hideAudit: true`)
 * - **universe** = defaults union `PLATFORM_QUERY_FIELDS` (the same list as filters / the agent)
 *
 * No extra concept: user-visible platform fields are only the `PLATFORM_QUERY_FIELDS`
 * table. `id` / `tenantId` / `orgId` are not in it and never enter a business list.
 *
 * 🔴 `hideStatus`: master data (goods / customer / supplier) declares it, and
 * defaults no longer force status. The candidate universe still keeps status (the
 * user can turn it on in column settings). The criterion is the explicit
 * `ListView.hideStatus` declaration, not a derivation from lifecycle. Deriving it
 * would drop the business concept "master data" into a metamodel criterion, and the basis would drift.
 *
 * 🔴 `hideAudit`: the four audit columns are framework fields, appended after the
 * business columns by default. If the module `columns` already wrote one of those
 * keys, this deduplicates and keeps order, and does not insert it a second time.
 */
export function planListColumns(
  declared: readonly string[],
  hideStatus: boolean = false,
  hideAudit: boolean = false,
): {
  readonly defaults: readonly string[];
  readonly universe: readonly string[];
} {
  const withStatus = declared.includes("status") || !hideStatus;
  const withStatusDefaults: readonly string[] = withStatus
    ? declared.includes("status")
      ? declared
      : declared.length === 0
        ? ["status"]
        : [declared[0]!, "status", ...declared.slice(1)]
    : declared;
  const seen = new Set(withStatusDefaults);
  const audit = hideAudit ? [] : AUDIT_LIST_FIELDS.filter((k) => !seen.has(k));
  const defaults: readonly string[] = [...withStatusDefaults, ...audit];
  const extras = PLATFORM_QUERY_FIELDS.map((p) => p.key).filter((k) => !new Set(defaults).has(k));
  return { defaults, universe: [...defaults, ...extras] };
}

/**
 * The candidate universe of a read projection: which cells of a row of this module can be named.
 *
 * ## Why `planListColumns`'s universe cannot be reused
 *
 * That one answers "which columns the list page shows a person": defaults union
 * platform fields. `customer` defaults are
 * `code/name/shortName/servicePriority/contact/phone/settlementDays`, and `address`
 * is not among them. A person cannot add it even by opening column settings. "I
 * just batch-edited 51 addresses; list them so I can check" needs exactly
 * `address`. A presentation basis cannot answer a read question.
 *
 * The criteria are on different axes. This is the second landing of the same
 * discipline (the first is `importColumnsOf`: "which columns the list shows is a
 * presentation decision; an import template that omits a required field fails every row").
 * The two axes here are: can it be read (this function) and what is shown by default (`planListColumns`).
 *
 * ## Why this is derived, not a new declaration slot
 *
 * Adding a key such as `views.list.readable` has to pass the closed-key gate, and
 * it immediately adds another list to maintain. Adding a field to a module and
 * forgetting to add it to that list means the model cannot name it, and nothing
 * turns red. A derived set follows the declaration on its own.
 *
 * Criterion = `hasRowValue` (a value can be read from a row: exclude line tables
 * and attachments; derived columns are included, see that function) union `PLATFORM_QUERY_FIELDS`.
 *
 * 🔴 `id` is not in the return value. It is not a column you can name. Together
 * with `module` it is the bill handle, and every row always carries it (see the
 * row projection of `bill_list`). Putting it in the candidate set makes the model think it has to name it to get it.
 *
 * 🔴 Permission is not at this layer. The kernel does not know identity. Before
 * it is shown to a model it must also pass `canExposeField` (`module_describe` and `bill_list` each do that on their own side; see server).
 */
export function projectableColumnsOf(schema: ModuleSchema): readonly string[] {
  const declared = schema.fields.filter(hasRowValue).map((field) => field.key);
  const seen = new Set(declared);
  return [...declared, ...PLATFORM_QUERY_FIELDS.map((p) => p.key).filter((key) => !seen.has(key))];
}

/**
 * Columns a model named, turned into a checked projection. Omitting them is `null` (= use the module's default list columns).
 *
 * 🔴 Not one cell may be skipped silently. That is the whole reason this function
 * exists. The production incident looked like "the model thought it had the data
 * and it did not": it printed a 51-row checklist, and the database had really read
 * only 1 row. Naming a column that does not exist or cannot be read must be
 * rejected on the spot, with what to use instead. Returning the rest as usual is
 * not allowed: a table missing a column looks identical to a complete table, and a person will treat it as the checklist.
 */
export function normalizeProjection(
  schema: ModuleSchema,
  raw: unknown,
  at: string,
): readonly string[] | null {
  if (raw === undefined || raw === null) return null;
  const list = requireArray(raw, at);
  if (list.length === 0) {
    schemaFail(
      `${at}: an empty array was given. That means "no columns at all", and there is no such reading. ` +
        `To use the module's default list columns, do not pass this parameter. To name columns, give at least one. ` +
        `Example: fields:["code","name","address"]`,
    );
  }
  const allowed = new Set(projectableColumnsOf(schema));
  const out: string[] = [];
  const rejected: string[] = [];
  for (const [index, entry] of list.entries()) {
    const key = requireText(entry, `${at}[${String(index)}]`);
    if (!allowed.has(key)) {
      rejected.push(key);
      continue;
    }
    // Naming a column twice is not an error; it is the model's accent. Deduplicate and keep order (that order is the header order).
    if (!out.includes(key)) out.push(key);
  }
  if (rejected.length > 0) refuseProjection(schema, rejected[0]!, at, out, rejected);
  return out;
}

/**
 * Reject, and also give a `fields` value that can be resent as-is.
 *
 * 🔴 Most readers of this error are models. A model is poor at composing a correct
 * parameter object from prose and good at copying JSON. Saying only "take
 * projectable from module_describe; do not guess field names" has a measured cost:
 * another full round trip (10 to 60 seconds), and the next try is likely another
 * guess (in the field: `workerName` rejected, then `teamId`, rejected again).
 *
 * The remaining columns were already legal, and the server knows that now.
 * Assembling them and handing them over turns this round from "one round trip plus
 * one guess" into "one copy".
 *
 * It is still a rejection, not a quiet drop of those columns. A table missing a
 * column looks identical to a complete table, and a silent projection lets a model
 * treat a short table as the checklist (the discipline at the top of this file).
 */
function replayableFields(kept: readonly string[], schema: ModuleSchema): string {
  const fields = kept.length > 0 ? kept : projectableColumnsOf(schema).slice(0, 4);
  return `Resend like this (drop the columns that cannot be named; keep the rest as-is): fields:${JSON.stringify(fields)}`;
}

/**
 * A name outside the candidate set was named. Each kind gets its own replacement,
 * not one generic "field does not exist".
 *
 * `kept` / `rejected` put a replayable correction on the error (see `replayableFields`):
 * several wrong columns in one call are reported once, instead of the caller hitting them one by one.
 */
function refuseProjection(
  schema: ModuleSchema,
  key: string,
  at: string,
  kept: readonly string[] = [],
  rejected: readonly string[] = [],
): never {
  const alsoBad = rejected.filter((name) => name !== key);
  const others = alsoBad.length > 0 ? ` (also named wrong in the same call: ${alsoBad.join(", ")})` : "";
  const example = `${others}${replayableFields(kept, schema)}`;
  if (key.includes(".")) {
    schemaFail(
      `${at}: "${key}" is a line-column path, and one row of bill_list is a bill header, which cannot hold N lines. ` +
        `For one bill's lines use bill_get. To filter or aggregate by line use analysis_sql. ${example}`,
    );
  }
  const field = schema.fields.find((candidate) => candidate.key === key);
  if (field === undefined) {
    schemaFail(
      `${at}: "${schema.label}" has no projectable column "${key}". ` +
        `Projectable columns = fields in this module's declaration that yield a value, union platform fields (${PLATFORM_QUERY_FIELDS.map((p) => p.key).join("/")}). ` +
        `Take the set the current identity can actually get from projectable on module_describe(module="${schema.code}", section="query"). Do not guess field names. ${example}`,
    );
  }
  if (field.type === "subtable") {
    schemaFail(
      `${at}: "${field.label}" is a line table, not a cell on the header. One list row cannot hold its N lines. ` +
        `For the lines use bill_get (name that bill). To aggregate by line use analysis_sql. ${example}`,
    );
  }
  if (field.type === "attachment") {
    schemaFail(
      `${at}: "${field.label}" is an attachment cell. The value is a list of file handles, not a readable column. ` +
        `For file contents use attachment_read (the key comes from that cell in bill_get). Do not put handles in the table. ${example}`,
    );
  }
  schemaFail(`${at}: "${field.label}" cannot be read from a row. ${example}`);
}

/**
 * Factory-default totals: sum the first 2 money columns among the declared default columns.
 *
 * Why a factory default exists: "how much money is this filtered batch in total" is
 * the most frequent question on a list page. Defaulting to empty means defaulting
 * to no answer. Turning it off writes an override of `summary: null`, and
 * `null !== "sum"` makes that override non-neutral, so it can be turned off and it stays off.
 *
 * 🔴 The criterion looks only at the declaration, not at current visibility.
 * Looking at visibility means hiding one column changes another column's "default",
 * so a delta that changed nothing suddenly becomes non-neutral. The user did nothing, and the view is dirty.
 *
 * 🔴 It lives in the kernel, not in the renderer. It is half the answer to "which
 * footer totals does this `SavedView.columns` mean". Leaving it in the renderer
 * has been measured: server export and the agent's list tool compute "no totals"
 * from `resolveColumns()`, while the user's screen shows two total columns, and neither side reports an error.
 */
export function planListSummaries(
  defaults: readonly string[],
  fields: readonly Field[],
): ReadonlyMap<string, SummaryFn> {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const money = defaults.filter((key) => byKey.get(key)?.type === "money").slice(0, 2);
  return new Map(money.map((key) => [key, "sum" as SummaryFn]));
}

/** The final presentation of one column: which field, how wide, and whether the footer totals it. The three share one delta. There is no second column state. */
export interface ResolvedColumn {
  readonly field: string;
  readonly width: number | null;
  readonly summary: SummaryFn | null;
}

/**
 * Combine default columns and user overrides into the columns that should actually render.
 *
 * Omitting `universe` means defaults. Omitting `summaryDefaults` means no factory totals.
 * A default column with no override is visible. A non-default column with no override
 * is hidden. An override outside the universe is ignored.
 *
 * The criterion for the total dimension is whether an override is present, not
 * whether the override's value is truthy. When an override is present it always
 * wins (turning a total off writes `summary: null`). The factory default applies
 * only when there is no override. Writing `?? factory default` would make the "turn the total off" delta never take effect.
 *
 * This is the lower half. To answer "what does this `SavedView.columns` mean on
 * this module", call `resolveListColumns(schema, overrides)`. It returns the
 * default columns, the candidate universe, the factory totals, and the combined result in one call. The caller does not assemble the four.
 */
export function resolveColumns(
  defaults: readonly string[],
  overrides: readonly ColumnOverride[],
  universe: readonly string[] = defaults,
  summaryDefaults: ReadonlyMap<string, SummaryFn> = new Map(),
): readonly ResolvedColumn[] {
  const byField = new Map(overrides.map((o) => [o.field, o]));
  const defaultSet = new Set(defaults);
  const visible = universe.filter((f) => {
    const o = byField.get(f);
    if (o !== undefined) return !o.hidden;
    return defaultSet.has(f);
  });
  const ordered = [...visible].sort((a, b) => {
    const oa = byField.get(a)?.order ?? universe.indexOf(a);
    const ob = byField.get(b)?.order ?? universe.indexOf(b);
    return oa - ob;
  });
  return ordered.map((field) => {
    const o = byField.get(field);
    return {
      field,
      width: o?.width ?? null,
      summary: o === undefined ? (summaryDefaults.get(field) ?? null) : o.summary,
    };
  });
}

/** The full picture of a module's list columns. All four pieces in one call, so the caller does not assemble them. */
export interface ListColumnPlan {
  /** Columns visible by default (`views.list.columns`, guaranteed to include status). */
  readonly defaults: readonly string[];
  /** Candidate universe = defaults union `PLATFORM_QUERY_FIELDS`. */
  readonly universe: readonly string[];
  /** Factory-default totals. Neutrality checks and footer totals both read this. */
  readonly summaryDefaults: ReadonlyMap<string, SummaryFn>;
  /** Combined result: the columns that should actually render under this delta. */
  readonly columns: readonly ResolvedColumn[];
}

/**
 * 🔴 The only entry for "what does this `SavedView.columns` mean on this module".
 *
 * Splitting it into `planListColumns` + `planListSummaries` + `resolveColumns` and
 * calling each step separately means every consumer has to know how the three fit
 * together. Skipping the factory-total step has no symptom: the screen shows two
 * total columns, the exported table footer has none, and neither side reports an error.
 */
export function resolveListColumns(
  schema: ModuleSchema,
  overrides: readonly ColumnOverride[],
): ListColumnPlan {
  const { defaults, universe } = planListColumns(
    schema.views.list.columns,
    schema.views.list.hideStatus,
    schema.views.list.hideAudit,
  );
  const summaryDefaults = planListSummaries(defaults, schema.fields);
  return {
    defaults,
    universe,
    summaryDefaults,
    columns: resolveColumns(defaults, overrides, universe, summaryDefaults),
  };
}
