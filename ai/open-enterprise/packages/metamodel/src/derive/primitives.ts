// ---------------------------------------------------------------------------
// Rule primitives — the controlled form in which code enters the system.
//
// This is not a hook. A hook is arbitrary code: static checks cannot see through
// it, an agent cannot generate it reliably, and a user cannot read it.
// A primitive is a parameterized structured declaration:
//
//   · statically analyzable — the checker can see whether the fields it names exist
//   · self-explaining — describe() renders a sentence a person can read
//   · easy for an agent to emit — a structured object plus TypeScript completion
//     beats a string-expression DSL
//
// Those three points are the whole reason this file does not use a general
// expression engine such as CEL or JSONLogic. Those engines can evaluate, but
// they cannot explain themselves, and they are worse to generate.
//
// Zero IO: reads go through the injected ctx.query. This file does not know
// what the database looks like.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  normalizeRowFilter,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
  type RowFilter,
} from "../schema/common.js";
import { type EffectRef, type EffectTarget } from "../schema/effects.js";
import { ledgerContract, ledgerLabel, listLedgerCodes } from "../normalize/ledger.js";
import { isEmptyValue, type Field } from "../schema/fields.js";

// -- comparators -------------------------------------------------------------

/**
 * Binary comparators used by rule primitives: `left op right`, both sides one operand.
 *
 * The query comparators (`QUERY_COMPARATORS` in `query.ts`) are a superset of this
 * set. "between" is ternary and "is empty / is not empty" is unary. Putting those
 * here would leave a required `right` that is ignored, and an ignored input is the
 * last thing this package should have (`field_compare` would render a sentence that
 * claims a remark must be empty while also printing null). The query set is built
 * as `[...COMPARATORS, ...]`, not copied.
 */
export const COMPARATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in", "contains"] as const;
export type Comparator = (typeof COMPARATORS)[number];

/**
 * The one wording for each comparator. The block message and the filter panel
 * must use this same string, or one `gte` ends up with two names.
 */
export const COMPARATOR_TEXT: Readonly<Record<Comparator, string>> = Object.freeze({
  eq: "equal to",
  ne: "not equal to",
  gt: "greater than",
  gte: "not less than",
  lt: "less than",
  lte: "not greater than",
  in: "in",
  not_in: "not in",
  contains: "contains",
});

/**
 * Compare a value as a number.
 *
 * `label` is what this value is called in a sentence (for example `line 2 "good qty"`),
 * not a primitive name. Call sites used to pass the primitive name, so a blank
 * numeric cell compared with `> 0` told the user that `lines_all` was not a number.
 * That word does not appear on the form. The error has to name the cell.
 *
 * Blank and non-numeric are different sentences. The next action is different:
 * fill the cell, or fix a value that is not a number. Folding both into
 * "not a number (actual null)" turns the common omission into a type error.
 */
/**
 * "This cell is blank" is said in one place.
 *
 * Emptiness uses `isEmptyValue`, the same predicate as write validation and
 * `required_fields`. A second copy makes save say the cell is filled and the
 * transition say it is blank, and each conclusion looks reasonable alone.
 */
function requirePresent(v: unknown, label: string): void {
  if (isEmptyValue(v)) schemaFail(`${label} is blank and cannot be compared`);
}

function numeric(v: unknown, label: string): number {
  requirePresent(v, label);
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    schemaFail(`${label} is not a number (actual ${JSON.stringify(v)}) and cannot be compared`);
  }
  return n;
}

// Date shape, not the field's declared type. compare() sees evaluated values.
// One side may be a $bill field and the other a literal, with no shared type.
//
// Postgres date / timestamp columns come back from drizzle-orm/postgres-js as
// 'YYYY-MM-DD' strings. Number() of that string is NaN. Sending a date comparison
// through numeric() makes `promiseDate >= orderDate` throw SchemaError in
// production, so a rule declared as warn becomes a hard block.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function isTemporal(v: unknown): boolean {
  if (v instanceof Date) return true;
  return typeof v === "string" && (ISO_DATE.test(v) || ISO_TIMESTAMP.test(v));
}

/**
 * Date to epoch milliseconds.
 *
 * 'YYYY-MM-DD' is UTC midnight (`Date.parse` and `new Date(s)` agree), so a date
 * string and a Date built from the same string compare directly. A shape that
 * looks like a date but does not parse ('2026-13-45', Invalid Date) throws.
 * Falling back to a number comparison would report "not a number" for a bad date.
 */
function temporal(v: unknown, label: string): number {
  const t = v instanceof Date ? v.getTime() : Date.parse(v as string);
  if (!Number.isFinite(t)) schemaFail(`${label} is not a valid date (actual ${JSON.stringify(v)}) and cannot be compared`);
  return t;
}

/**
 * Pair for an ordered comparison. Both dates compare as time; otherwise both
 * compare as numbers. Mixed kinds are not coerced: a silent conversion is a
 * meaningless boolean.
 *
 * `label` names the left value (see `numeric`). The right value is usually a
 * literal or another field, and is named from the left value. Primitive names
 * still do not appear.
 */
function orderable(left: unknown, right: unknown, label: string): readonly [number, number] {
  const rightLabel = `the value compared with ${label}`;
  // Check blank before type. `null` is "not filled", not "not a date".
  // The reverse order was hit: an empty date cell compared with `>= order date`
  // reported a type mismatch, while the user only needed to fill the cell.
  // Optional dates are normal (a draft whose promise date is not set yet).
  requirePresent(left, label);
  requirePresent(right, rightLabel);
  const leftIsDate = isTemporal(left);
  const rightIsDate = isTemporal(right);
  if (leftIsDate && rightIsDate) return [temporal(left, label), temporal(right, rightLabel)];
  if (leftIsDate !== rightIsDate) {
    schemaFail(
      `${label} is a ${leftIsDate ? "date" : "non-date"}, and ${rightLabel} is a ${rightIsDate ? "date" : "non-date"}; ` +
        `the two cannot be compared (${JSON.stringify(left)} / ${JSON.stringify(right)})`,
    );
  }
  return [numeric(left, label), numeric(right, rightLabel)];
}

/**
 * Equality for `eq` / `ne`.
 *
 * Two `Date` instances are never `===` (that is reference equality). A datetime
 * field arrives at the rule engine as a `Date`, so before this branch every
 * datetime `eq` was always false and every `ne` always true. `gt/gte/lt/lte` on
 * the same field were correct because they go through `orderable()` and `getTime()`.
 * Ordered comparison right and equality wrong is almost impossible to see by
 * reading the declaration.
 *
 * The measured case (`performanceSettlement.settle` / `source_report_time_matches`)
 * reported both sides as the same timestamp and still failed the gate. That is
 * the worst kind of message: the user doubts the system, not the data.
 *
 * The trigger is `instanceof Date`, not `isTemporal`. The latter also treats a
 * string such as "2026-08-04" as a date, because a date column is read as a
 * string. Using that as the trigger would change `eq` for ordinary strings: a
 * batch number that happens to look like a date would enter the mixed-kind
 * branch and throw, so the gate's color would depend on the shape of the data.
 * A `Date` instance does not appear on an ordinary string field, so triggering
 * on it does not leak.
 *
 * Mixed kinds (one `Date`, the other not a date at all) throw with the same
 * wording as `orderable`. That is a bad declaration (a datetime compared with a
 * number). This file has one answer for that case, and it is not a silent false.
 */
function sameValue(left: unknown, right: unknown, label: string): boolean {
  if (left instanceof Date || right instanceof Date) {
    const [l, r] = orderable(left, right, label);
    return l === r;
  }
  return left === right;
}

const ORDERED: Readonly<Record<"gt" | "gte" | "lt" | "lte", (a: number, b: number) => boolean>> = Object.freeze({
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
});

/**
 * Evaluate one comparison.
 *
 * `label` is what the left value is called (`line 2 "good qty"` / `"customer" status`).
 * Every error is built from it. Do not pass a primitive name. Those words
 * (`lines_all` / `field_compare`) are internal, and a user who sees them thinks
 * the system is broken. See `numeric`.
 */
export function compare(left: unknown, op: Comparator, right: unknown, label = "this value"): boolean {
  switch (op) {
    case "eq":
      // "equal to null" means blank. Emptiness uses `isEmptyValue`, the same
      // predicate as write validation. An empty string and undefined are the same
      // fact as null in storage. `===` would treat a manual order's empty plan
      // line as "a plan line is attached" and route the document the wrong way.
      if (isEmptyValue(left) || isEmptyValue(right)) {
        return isEmptyValue(left) && isEmptyValue(right);
      }
      // Not bare `===`: a datetime here is a `Date`, and two Dates for the same instant are never equal. See `sameValue`.
      return sameValue(left, right, label);
    case "ne":
      if (isEmptyValue(left) || isEmptyValue(right)) {
        return !(isEmptyValue(left) && isEmptyValue(right));
      }
      return !sameValue(left, right, label);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const [l, r] = orderable(left, right, label);
      return ORDERED[op](l, r);
    }
    case "in":
    case "not_in":
      // A declaration error, not a data-entry error: the right side must be a list.
      // Wording comes from COMPARATOR_TEXT, not a second dictionary.
      if (!Array.isArray(right)) {
        schemaFail(`${label} used "${COMPARATOR_TEXT[op]}", but the right side is not a list of values (${JSON.stringify(right)})`);
      }
      return op === "in" ? (right as unknown[]).includes(left) : !(right as unknown[]).includes(left);
    case "contains":
      if (typeof left !== "string") {
        schemaFail(`${label} is not text (actual ${JSON.stringify(left)}); "${COMPARATOR_TEXT.contains}" applies only to text`);
      }
      return left.includes(String(right));
  }
}

// -- operands ----------------------------------------------------------------

/**
 * An operand is a reference string or a literal.
 *
 * Reference prefixes are closed: `$bill.` header, `$param.` this action's
 * parameters, `$actor.` the actor, `$line.` the current detail line (only inside
 * lines_all / lines_any). A closed prefix is what lets a static check ask whether
 * the field this rule names exists.
 */
export type Operand = { readonly ref: string } | { readonly value: unknown };

export const REF_PREFIXES = ["$bill.", "$param.", "$actor.", "$line."] as const;

/**
 * Which context this primitive provides is declared by the primitive, not a global constant.
 *
 * `$line.` is available only from the per-line primitives (`lines_all` / `lines_any`).
 * Allowing it on another primitive would pass at declaration time and throw at
 * evaluation (`resolveOperand` schemaFails). An error that is visible while modeling
 * would wait until the first click, and the click would disable the whole edge.
 * The point of a closed prefix is that it can be checked statically.
 */
const NO_LINE = ["$bill.", "$param.", "$actor."] as const;

export function normalizeOperand(
  raw: unknown,
  label: string,
  allowed: readonly string[] = NO_LINE,
): Operand {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["ref", "value"], label);
  const hasRef = obj["ref"] !== undefined;
  const hasValue = obj["value"] !== undefined;
  if (hasRef === hasValue) schemaFail(`${label} must be exactly one of { ref } or { value }`);
  if (hasValue) return { value: obj["value"] };

  const ref = requireText(obj["ref"], `${label}.ref`);
  if (!allowed.some((p) => ref.startsWith(p))) {
    const why = REF_PREFIXES.some((p) => ref.startsWith(p))
      ? `this primitive does not provide that context (choices: ${allowed.join(" / ")}); $line. is available only inside lines_all / lines_any`
      : `unknown prefix; choices: ${allowed.join(" / ")}`;
    schemaFail(`${label}.ref "${ref}" ${why} (closed prefixes; static checks resolve references from them)`);
  }
  if (ref.split(".").length !== 2) schemaFail(`${label}.ref "${ref}" supports only one level, for example $bill.totalAmount`);
  return { ref };
}

/** Prefix shape: `related_agg.on` accepts a bare field name or `$line.`, and reports any other prefix instead of treating it as a field name. */
const ON_PREFIXED = /^\$/;

/** Shared shape of a prefix projection: the key inside `$<prefix>.<key>`. */
function keyUnder(operand: Operand, prefix: string): readonly string[] {
  if (!("ref" in operand)) return [];
  const [head, key] = operand.ref.split(".");
  return head === prefix && key ? [key] : [];
}

/** For static checks: which header fields of this module the rule references. */
export function billFieldsOf(operand: Operand): readonly string[] {
  return keyUnder(operand, "$bill");
}

/**
 * For static checks: which parameter keys of this action the rule references.
 *
 * Same reason as `actorKeysOf`: a misspelled parameter reads as `undefined`,
 * `eq` is always false, a block rule never passes, and a warn rule always pops.
 * Both look like "the business rule is too strict". Nobody suspects a typo.
 */
export function paramKeysOf(operand: Operand): readonly string[] {
  return keyUnder(operand, "$param");
}

/** For static checks: which detail-line columns the rule references (only per-line primitives have any). */
export function lineFieldsOf(operand: Operand): readonly string[] {
  return keyUnder(operand, "$line");
}

/**
 * Keys on the actor. A closed set, the same contract the server uses when it
 * projects Identity into `$actor`.
 *
 * It has to be closed. A bad `$bill.` key is caught by `PRECONDITION_FIELD_UNKNOWN`.
 * `$actor.` used to be unchecked. A bad key reads as `undefined`, so `eq` is
 * always false and a block rule never passes, which looks like a strict business
 * setting. Nobody suspects a typo.
 *
 * There is no single-value `role`. Identity carries a set of roles (`roles`).
 * Picking the first one as "the role" is an unexplained judgment for someone
 * with several roles. To test a role, write
 * `left: { value: "warehouse-manager" }, op: "in", right: { ref: "$actor.roles" }`.
 */
export const ACTOR_KEYS = ["userId", "orgId", "tenantId", "roles", "agentId"] as const;
export type ActorKey = (typeof ACTOR_KEYS)[number];

/**
 * Wording for the actor keys. One copy, same discipline as `COMPARATOR_TEXT`.
 *
 * Unlike `$bill.` / `$line.` / `$param.`, this cell does not come from a module
 * declaration. `$actor.` is a global closed set, so the names are global too.
 * Putting them in `FieldLabels` would let two modules name `roles` differently.
 */
export const ACTOR_KEY_TEXT: Readonly<Record<ActorKey, string>> = Object.freeze({
  userId: "Actor",
  orgId: "Actor organization",
  tenantId: "Tenant",
  roles: "Actor roles",
  agentId: "Agent that started this action",
});

/** For static checks: which actor keys the rule references. */
export function actorKeysOf(operand: Operand): readonly string[] {
  return keyUnder(operand, "$actor");
}

// -- evaluation context (injected by the caller; the kernel does not implement it)

export interface RuleQuery {
  /**
   * Load one referenced record by id. An empty `through` reads the header.
   * A non-empty `through` reads one row of that detail table on the target module.
   *
   * Line-level source facts must use this opening too. A delivery line's product
   * and price must be pinned to the order line. Copying those fields into local
   * hidden columns that "look the same" creates a second fact that can be tampered with.
   */
  get(
    entity: string,
    id: unknown,
    through?: string | null,
  ): Promise<Readonly<Record<string, unknown>> | null>;
  /**
   * List a related row set.
   *
   * `through` null reads header rows. Non-null reads rows of that detail table.
   * `where` (`{ status: 'shipped' }`) still filters the header. Detail lines have
   * no state machine.
   *
   * The implementation must not drop the condition because the detail layer has
   * no status column. That would count drafts and reversed rows into the running
   * total, producing a number that looks normal and is too large, and that number
   * is the left side of the over-issue gate.
   */
  list(
    entity: string,
    where: Readonly<Record<string, unknown>>,
    through?: string | null,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
  /**
   * Tenant-scoped system-invariant aggregate. Returns one number, not rows or ids.
   *
   * Only `invariant_related_agg` calls this. Ordinary `related_agg` always uses
   * the actor-scoped `list` above. A caller must not pass a scope argument to
   * upgrade the read into a cross-person read.
   */
  invariantAggregate?(
    entity: string,
    where: Readonly<Record<string, unknown>>,
    through: string | null,
    agg: "sum" | "min",
    measure: string,
  ): Promise<number | null>;
  /**
   * Balance is a ledger sum. The coordinate is `target x subjectId x scopeId`,
   * the same coordinate effects use when they post, so the account the check
   * reads and the account the posting writes are the same cell.
   *
   * The implementation must throw when `stock` is missing scopeId. It must not
   * fall back to a total across every warehouse. Inventory is stored per
   * warehouse, so "is the Shanghai warehouse enough to ship" has no answer, and
   * a cross-warehouse total looks perfectly normal. A non-stock target that is
   * given a scopeId also throws: that number has no reading.
   *
   * If the balance cannot be read, throw. Do not return 0. Treating a missing
   * balance as 0 lets an over-stock posting through under a pure-balance reading.
   */
  balance(target: EffectTarget, subjectId: string, scopeId: string | null): Promise<number>;
}

/**
 * Field key to the name the user sees on the form. The three slots match the
 * three module-local closed prefixes (`$bill.` / `$line.` / `$param.`).
 * `$actor.` is the global set and uses `ACTOR_KEY_TEXT`.
 *
 * Names only. The primitive wants "what this cell is called on the screen".
 * Handing it the whole schema invites a branch on `field.type` inside a
 * primitive, which is why the declaration layer (`validate.ts`) and the
 * instance layer (this file) are separate.
 *
 * Built by `fieldLabelsOf` in `labels.ts`. This file does not depend on
 * `ModuleSchema`, or primitives -> module -> preconditions -> primitives cycles.
 *
 * Names from another module are not here (`related_agg.from`,
 * `ref_field_compare.entity`, and their fields). Those need the other module's
 * declaration, and the kernel is zero-IO: `ctx` has only this module. Those
 * spots still report code / key. That is a known gap. Do not stuff a second
 * module into this slot to fill it. The right shape is the caller swapping
 * words from the catalog on the way out.
 */
export interface FieldLabels {
  readonly bill: Readonly<Record<string, string>>;
  readonly line: Readonly<Record<string, string>>;
  readonly param: Readonly<Record<string, string>>;
}

/**
 * What a key is called. If it is not in the table, return the key itself.
 *
 * This fallback is not fail-open default filling. A rule may legally reference
 * a platform field (`$bill.status` / `$bill.orgId`), and platform fields have
 * no modeler-written label. Reporting `status` is the right answer. The kind of
 * bug this would hide (a field that does not exist) is rejected at modeling
 * time by `PRECONDITION_FIELD_UNKNOWN`, not by runtime behavior here.
 */
export function labelOfKey(labels: FieldLabels, prefix: string, key: string): string {
  switch (prefix) {
    case "$bill":
      return labels.bill[key] ?? key;
    case "$line":
      return labels.line[key] ?? key;
    case "$param":
      return labels.param[key] ?? key;
    case "$actor":
      return ACTOR_KEY_TEXT[key as ActorKey] ?? key;
    default:
      return key;
  }
}

export interface RuleContext {
  readonly bill: Readonly<Record<string, unknown>>;
  readonly lines: readonly Readonly<Record<string, unknown>>[];
  readonly params: Readonly<Record<string, unknown>>;
  readonly actor: Readonly<Record<string, unknown>>;
  /**
   * Field names for this module and this edge.
   *
   * Required, with no default. Optional would let a caller skip it "this once",
   * and the symptom is error text that falls back to the key: zero errors, and
   * only the user can see the degradation. Required means a missing value does
   * not compile (`RuleContext` is constructed in one place, `engine.ts`).
   */
  readonly labels: FieldLabels;
  readonly now: Date;
  readonly query: RuleQuery;
  /** The current line while lines_all / lines_any evaluates. */
  readonly line?: Readonly<Record<string, unknown>>;
}

export function resolveOperand(operand: Operand, ctx: RuleContext, label: string): unknown {
  if ("value" in operand) return operand.value;
  const [prefix, key] = operand.ref.split(".");
  if (!key) schemaFail(`${label}.ref "${operand.ref}" is missing a field name`);
  switch (prefix) {
    case "$bill":
      return ctx.bill[key];
    case "$param":
      return ctx.params[key];
    case "$actor":
      return ctx.actor[key];
    case "$line":
      if (!ctx.line) schemaFail(`${label}.ref "${operand.ref}": $line is available only inside lines_all / lines_any`);
      return ctx.line[key];
    default:
      return schemaFail(`${label}.ref "${operand.ref}" has an unknown prefix`);
  }
}

/**
 * What an operand is called in a sentence.
 *
 * `labels` is a required parameter, not an optional hardening. Optional means a
 * call site will forget it, and the symptom is "this cell is called warehouseId".
 * The user cannot find that word on the form. Required means a new reference
 * does not compile (the same discipline as `allowed` on `readBody`).
 */
function operandText(operand: Operand, labels: FieldLabels): string {
  if ("value" in operand) return valueText(operand.value);
  const [prefix, key] = operand.ref.split(".");
  if (!key || !prefix) return operand.ref;
  return labelOfKey(labels, prefix, key);
}

/**
 * How a value is printed in a sentence the user reads.
 *
 * A blank value prints "(empty)", not `null`. Emptiness uses `isEmptyValue`,
 * the same predicate as the eq / ne branches of `compare`, write validation
 * (`instance.ts`), and `required_fields`. The sentence and the gate judge the
 * same fact. Printing `null` produced a sentence the user cannot read: every
 * line's plan line must equal null. The form has no value called null. The
 * gate only meant "leave this cell blank".
 *
 * A non-empty value is still printed with `JSON.stringify`, quotes included.
 * Do not strip the quotes. The outbound status glossary (`applyStatusGlossary`
 * on the server) swaps a status key for its label by the `"key"` shape. Dropping
 * the quotes makes that swap miss silently, and an English status key shows up
 * on the screen while both sides of the code look correct alone.
 */
function valueText(value: unknown): string {
  return isEmptyValue(value) ? "(empty)" : JSON.stringify(value);
}

/**
 * Wording when `eq` / `ne` hits an empty literal. Returns null for any other case.
 *
 * The predicate is the same one the eq / ne branches of `compare` use
 * (`isEmptyValue`, not `===`), so "equal to null" already means "this cell has
 * no value". Only the wording changes, not the judgment.
 *
 * Pulled out so `describe` and `detail` share one copy. Two copies put "must be
 * left blank" on the rule and "required equal to null" on the actual, and the
 * reader thinks those are two gates.
 */
function emptinessText(op: Comparator, right: Operand): string | null {
  if ((op !== "eq" && op !== "ne") || !("value" in right) || !isEmptyValue(right.value)) return null;
  return op === "eq" ? "be empty (leave this cell blank)" : "have a value (this cell cannot be left blank)";
}

/**
 * The "must ..." half: what the rule itself says (`describe`), without this evaluation.
 */
function comparisonText(op: Comparator, right: Operand, labels: FieldLabels): string {
  return emptinessText(op, right) ?? `be ${COMPARATOR_TEXT[op]} ${operandText(right, labels)}`;
}

/**
 * The "required ..." half: the sentence shown when this evaluation fails (`detail`).
 *
 * When the right operand is a reference, the sentence must name it and say what
 * it is right now. Printing only the value produced a threshold with no source:
 * "required not greater than 0", where 0 was the open amount brought down from
 * an upstream invoice that has not been approved yet. The user read that as
 * "the system requires a payment of 0". Naming the cell tells them to approve
 * the invoice, not to edit this document's amount.
 */
function expectationText(op: Comparator, right: Operand, value: unknown, labels: FieldLabels): string {
  const emptiness = emptinessText(op, right);
  if (emptiness !== null) return `required to ${emptiness}`;
  // A space before a literal (`required not greater than 100`). A named cell
  // carries its own quotes, so no extra separator is required.
  const what = "value" in right ? ` ${valueText(value)}` : ` ${operandLabel(right, labels)} (${valueText(value)})`;
  return `required ${COMPARATOR_TEXT[op]}${what}`;
}

/**
 * How an operand is named inside an error. A field is quoted so the user can
 * find that cell on the form. A literal is printed as-is. This is the only
 * source of `compare`'s `label`. If each call site builds its own sentence,
 * one of them will pass a primitive name again, and that path stays invisible
 * until someone hits it.
 */
function operandLabel(operand: Operand, labels: FieldLabels): string {
  return "value" in operand ? JSON.stringify(operand.value) : `"${operandText(operand, labels)}"`;
}

// -- primitives --------------------------------------------------------------

export interface CheckOutcome {
  readonly ok: boolean;
  /** Sentence when the check fails. Include the actual numbers. "Condition not met" is useless. */
  readonly detail: string;
}

export interface Primitive<P> {
  readonly name: string;
  /** Normalize and check parameters. A bad parameter throws at load time, not at evaluation. */
  normalize(raw: Record<string, unknown>, label: string): P;
  /** Evaluate. Zero IO. Data comes through ctx.query. */
  evaluate(params: P, ctx: RuleContext): Promise<CheckOutcome> | CheckOutcome;
  /**
   * Self-explanation: render the rule itself as a sentence for the UI and for agents.
   *
   * `labels` is the same table `evaluate` receives. `rule` (what the rule says)
   * and `detail` (what this run computed) sit next to each other. One saying
   * "ship warehouse" and the other saying "warehouseId" is read as two facts.
   */
  describe(params: P, labels: FieldLabels): string;
  /** For static checks: which header fields of this module the rule references. */
  billFields(params: P): readonly string[];
  /** For static checks: which actor keys the rule references. */
  actorKeys(params: P): readonly string[];
  /**
   * For static checks: which parameter keys of this action the rule references.
   *
   * Four closed prefixes need four projections. Drop one and "closed means
   * statically checkable" is only a sentence for that prefix.
   */
  paramKeys(params: P): readonly string[];
  /** For static checks: which detail-line columns the rule references. Only a primitive that can supply a line context returns any. */
  lineFields(params: P): readonly string[];
  /**
   * Whether evaluation reads `ctx.lines`.
   *
   * This is not `lineFields`. Without it the only approximation is "which line
   * columns are referenced". `lines_not_empty` references no column and its
   * whole predicate is the line set. The approximation would mark it as not
   * needing line context, and it is the primitive that needs it most. The
   * reverse is `related_agg`, whose per-line flag is derived (`perLine`) and
   * only the primitive can say it accurately.
   */
  usesLines(params: P): boolean;
}

interface CompareParams {
  readonly left: Operand;
  readonly op: Comparator;
  readonly right: Operand;
}

/**
 * The sentence shown when one comparison fails.
 *
 * For `in` / `not_in` the operands are reversed relative to the other
 * comparators: the set is on the right, the value being tested is on the left.
 * Every role gate in this package has that shape
 * (`left: { value: "warehouse-manager" }, op: "in", right: { ref: "$actor.roles" }`),
 * because identity carries a set of roles, not a single role.
 *
 * The generic template (`left is actually X, required op right`) rendered:
 *   "warehouse-manager" is actually "warehouse-manager", required in ["salesperson"]
 * That states the requirement as the fact and the fact as the requirement.
 * It was confirmed against the role gates, which are the checks most likely to stop a user.
 */
function compareDetail(p: CompareParams, left: unknown, right: unknown, labels: FieldLabels): string {
  if (p.op === "in" || p.op === "not_in") {
    return (
      `requires ${JSON.stringify(left)} ${COMPARATOR_TEXT[p.op]} ${operandLabel(p.right, labels)}, ` +
      `while ${operandLabel(p.right, labels)} is actually ${JSON.stringify(right)}`
    );
  }
  return `${operandText(p.left, labels)} is ${valueText(left)}, ${expectationText(p.op, p.right, right, labels)}`;
}

/**
 * The closed set of guard primitives shared by `Precondition.when` and `Transition.when`.
 *
 * Today only `field_compare`. Applicability asks about the shape of this document.
 * It must be zero IO, and "could not read a value" must not flip into "this edge
 * or gate does not apply". Before widening the set, read the two sections in
 * `schema/preconditions.ts` on why too wide is fail-open.
 */
export const GUARD_PRIMITIVES = ["field_compare"] as const;

const fieldCompare: Primitive<CompareParams> = {
  name: "field_compare",
  normalize(raw, label) {
    assertClosedKeys(raw, ["left", "op", "right"], label);
    return {
      left: normalizeOperand(raw["left"], `${label}.left`),
      op: requireEnum(raw["op"], COMPARATORS, `${label}.op`),
      right: normalizeOperand(raw["right"], `${label}.right`),
    };
  },
  evaluate(p, ctx) {
    const left = resolveOperand(p.left, ctx, "left");
    const right = resolveOperand(p.right, ctx, "right");
    const ok = compare(left, p.op, right, operandLabel(p.left, ctx.labels));
    return { ok, detail: compareDetail(p, left, right, ctx.labels) };
  },
  describe: (p, labels) => `${operandText(p.left, labels)} must ${comparisonText(p.op, p.right, labels)}`,
  billFields: (p) => [...billFieldsOf(p.left), ...billFieldsOf(p.right)],
  actorKeys: (p) => [...actorKeysOf(p.left), ...actorKeysOf(p.right)],
  paramKeys: (p) => [...paramKeysOf(p.left), ...paramKeysOf(p.right)],
  lineFields: () => [],
  usesLines: () => false,
};

interface RequiredParams {
  readonly fields: readonly string[];
}

const requiredFields: Primitive<RequiredParams> = {
  name: "required_fields",
  normalize(raw, label) {
    assertClosedKeys(raw, ["fields"], label);
    const list = raw["fields"];
    if (!Array.isArray(list) || !list.length) schemaFail(`${label}.fields must be a non-empty array`);
    return { fields: list.map((f, i) => requireText(f, `${label}.fields[${i}]`)) };
  },
  evaluate(p, ctx) {
    // Emptiness uses `isEmptyValue`. Do not write a second copy here. Write
    // validation (`instance.ts`) judges the same fact: whether this field is
    // filled. Two definitions drift into "save says it is filled, the transition
    // says it is blank" (or the reverse), and each conclusion looks reasonable.
    // Report the label, not the key. A user who clicks submit and sees a raw
    // key cannot find that word on the form. The labels are on `ctx.labels`.
    const missing = p.fields.filter((f) => isEmptyValue(ctx.bill[f]));
    return {
      ok: missing.length === 0,
      detail: missing.length
        ? `Missing required fields: ${missing.map((f) => labelOfKey(ctx.labels, "$bill", f)).join(", ")}`
        : "Required fields are complete",
    };
  },
  describe: (p, labels) => `${p.fields.map((f) => labelOfKey(labels, "$bill", f)).join(", ")} must have a value`,
  billFields: (p) => p.fields,
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: () => [],
  usesLines: () => false,
};

const linesNotEmpty: Primitive<Record<string, never>> = {
  name: "lines_not_empty",
  normalize(raw, label) {
    assertClosedKeys(raw, [], label);
    return {};
  },
  evaluate(_p, ctx) {
    return { ok: ctx.lines.length > 0, detail: ctx.lines.length ? `${ctx.lines.length} detail lines` : "There are no detail lines" };
  },
  describe: () => "There must be at least one detail line",
  billFields: () => [],
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: () => [],
  usesLines: () => true,
};

/**
 * Detail lines must be left empty.
 *
 * The pair of `lines_not_empty`. Some compound documents share one header and
 * one detail structure, but one kind of operation (for example reversing funds
 * only) must not carry detail lines that would be read as a business allocation.
 * Checking that the line total is zero does not replace this structural
 * predicate: positive and negative lines can cancel and still leave a forged
 * detail fact.
 */
const linesEmpty: Primitive<Record<string, never>> = {
  name: "lines_empty",
  normalize(raw, label) {
    assertClosedKeys(raw, [], label);
    return {};
  },
  evaluate(_p, ctx) {
    return { ok: ctx.lines.length === 0, detail: ctx.lines.length ? `still has ${ctx.lines.length} detail lines` : "There are no detail lines" };
  },
  describe: () => "Detail lines must be left empty",
  billFields: () => [],
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: () => [],
  usesLines: () => true,
};

export interface LinesRequiredIfRefFieldParams {
  readonly via: string;
  readonly entity: string;
  readonly field: string;
  readonly values: readonly string[];
}

/**
 * The referenced header decides whether this document must carry detail lines.
 *
 * Unlike `Precondition.when + lines_not_empty`, this primitive re-reads the
 * referenced fact. A lookup-derived field on this document that never entered
 * the evaluation projection would otherwise make the guard always false and
 * silently skip a whole block gate.
 */
const linesRequiredIfRefField: Primitive<LinesRequiredIfRefFieldParams> = {
  name: "lines_required_if_ref_field",
  normalize(raw, label) {
    assertClosedKeys(raw, ["via", "entity", "field", "values"], label);
    const values = raw["values"];
    if (!Array.isArray(values) || values.length === 0) schemaFail(`${label}.values must be a non-empty array`);
    return {
      via: requireText(raw["via"], `${label}.via`),
      entity: requireText(raw["entity"], `${label}.entity`),
      field: requireText(raw["field"], `${label}.field`),
      values: values.map((value, index) => requireText(value, `${label}.values[${index}]`)),
    };
  },
  async evaluate(p, ctx) {
    const refId = ctx.bill[p.via];
    const viaLabel = labelOfKey(ctx.labels, "$bill", p.via);
    if (isEmptyValue(refId)) {
      return { ok: false, detail: `"${viaLabel}" is blank, so whether detail lines are required cannot be confirmed` };
    }
    const target = await ctx.query.get(p.entity, refId);
    if (!target) {
      return { ok: false, detail: `"${viaLabel}" points to ${p.entity}#${String(refId)}, which does not exist` };
    }
    const actual = target[p.field];
    if (isEmptyValue(actual)) {
      return { ok: false, detail: `"${viaLabel}" points to ${p.entity}.${p.field}, which is blank, so whether detail lines are required cannot be confirmed` };
    }
    if (!p.values.includes(String(actual))) {
      return { ok: true, detail: `${p.entity}.${p.field} is ${valueText(actual)}; detail lines are not required` };
    }
    return {
      ok: ctx.lines.length > 0,
      detail: ctx.lines.length
        ? `${p.entity}.${p.field} is ${valueText(actual)}, with ${ctx.lines.length} detail lines`
        : `${p.entity}.${p.field} is ${valueText(actual)}. There are no detail lines`,
    };
  },
  describe: (p, labels) =>
    `When "${labelOfKey(labels, "$bill", p.via)}" points to ${p.entity}.${p.field} in ${p.values.join(", ")}, there must be at least one detail line`,
  billFields: (p) => [p.via],
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: () => [],
  usesLines: () => true,
};

interface LineRefRequiredIfParams {
  readonly refField: string;
  readonly via: string;
  readonly entity: string;
  readonly targetField: string;
  readonly whenValues: readonly string[];
}

/**
 * Conditional required on a detail line: one kind of line must pin a reference
 * version or source.
 *
 * This is the general shape of "a semi-finished BOM component must freeze its
 * child BOM when it takes effect". The engine does not contain a business code.
 * Raw materials, packaging, and other lines may still leave that reference blank.
 */
const lineRefRequiredIf: Primitive<LineRefRequiredIfParams> = {
  name: "line_ref_required_if_ref_field",
  normalize(raw, label) {
    assertClosedKeys(raw, ["refField", "via", "entity", "targetField", "whenValues"], label);
    const values = raw["whenValues"];
    if (!Array.isArray(values) || values.length === 0) schemaFail(`${label}.whenValues must be a non-empty array`);
    return {
      refField: requireText(raw["refField"], `${label}.refField`),
      via: requireText(raw["via"], `${label}.via`),
      entity: requireText(raw["entity"], `${label}.entity`),
      targetField: requireText(raw["targetField"], `${label}.targetField`),
      whenValues: values.map((value, index) => requireText(value, `${label}.whenValues[${index}]`)),
    };
  },
  evaluate(p, ctx) {
    const bad: number[] = [];
    return (async () => {
      for (const [index, line] of ctx.lines.entries()) {
        const targetId = line[p.via];
        if (isEmptyValue(targetId)) { bad.push(index + 1); continue; }
        const target = await ctx.query.get(p.entity, targetId);
        if (!target || p.whenValues.includes(String(target[p.targetField])) && isEmptyValue(line[p.refField])) bad.push(index + 1);
      }
      return {
        ok: bad.length === 0,
        detail: bad.length
          ? `line ${bad.join(", ")} ${labelOfKey(ctx.labels, "$line", p.refField)} is blank, so the version cannot be frozen`
          : "Every detail line that must freeze a version is filled",
      };
    })();
  },
  describe: (p, labels) =>
    `When the ${labelOfKey(labels, "$line", p.via)} on a detail line points to ${p.entity}.${p.targetField} in ${p.whenValues.join(", ")}, ${labelOfKey(labels, "$line", p.refField)} must have a value`,
  billFields: () => [],
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: (p) => [p.refField, p.via],
  usesLines: () => true,
};

/**
 * Acyclic check for a recursive cross-record reference. Used on the BOM
 * activation edge: a one-hop gate at save time cannot stop A -> B -> A. This
 * primitive walks active records inside the transaction and returns a readable
 * block conclusion when it finds a cycle.
 */
interface RecursiveRefFreeParams {
  readonly entity: string;
  readonly root: string;
  readonly lines: string;
  readonly component: string;
  readonly child: string | null;
  readonly activeStatus: string;
}
const recursiveRefFree: Primitive<RecursiveRefFreeParams> = {
  name: "recursive_ref_free",
  normalize(raw, label) {
    assertClosedKeys(raw, ["entity", "root", "lines", "component", "child", "activeStatus"], label);
    return {
      entity: requireText(raw["entity"], `${label}.entity`),
      root: requireText(raw["root"], `${label}.root`),
      lines: requireText(raw["lines"], `${label}.lines`),
      component: requireText(raw["component"], `${label}.component`),
      child: raw["child"] === undefined || raw["child"] === null ? null : requireText(raw["child"], `${label}.child`),
      activeStatus: requireText(raw["activeStatus"], `${label}.activeStatus`),
    };
  },
  async evaluate(p, ctx) {
    const rootId = ctx.bill[p.root];
    if (typeof rootId !== "string" || rootId === "") return { ok: false, detail: `"${p.root}" is blank, so a structure cycle cannot be checked` };
    const walk = async (
      entityId: string,
      path: readonly string[],
      current = false,
      recordId: string | null = null,
    ): Promise<string | null> => {
      if (path.includes(entityId)) return [...path, entityId].join(" -> ");
      let key: string;
      let record: Readonly<Record<string, unknown>> | null;
      if (current) {
        key = "__current__";
        record = ctx.bill;
      } else if (recordId !== null) {
        key = recordId;
        record = await ctx.query.get(p.entity, recordId);
      } else {
        const rows = await ctx.query.list(p.entity, { [p.root]: entityId, status: p.activeStatus });
        const first = rows[0];
        if (!first || typeof first["id"] !== "string") return null;
        key = first["id"];
        record = await ctx.query.get(p.entity, key);
      }
      if (!record) return null;
      const lines = record[p.lines];
      if (!Array.isArray(lines)) return null;
      for (const line of lines) {
        const child = line?.[p.component];
        if (typeof child !== "string" || child === "") continue;
        const explicit = p.child === null ? null : line?.[p.child];
        const hit = typeof explicit === "string" && explicit !== ""
          ? await (async () => {
              const childRecord = await ctx.query.get(p.entity, explicit);
              if (!childRecord || childRecord[p.root] !== child) return null;
              return await walk(child, [...path, entityId], false, explicit);
            })()
          : await walk(child, [...path, entityId]);
        if (hit) return hit;
      }
      return null;
    };
    const cycle = await walk(rootId, [], true);
    return cycle
      ? { ok: false, detail: `BOM has a cyclic reference: ${cycle}. Fix the BOM structure before activating` }
      : { ok: true, detail: "BOM structure has no cyclic reference" };
  },
  describe: () => "The BOM structure must not contain an indirect cyclic reference",
  billFields: (p) => [p.root],
  actorKeys: () => [],
  paramKeys: () => [],
  lineFields: () => [],
  usesLines: () => false,
};

const linesAll: Primitive<CompareParams> = {
  name: "lines_all",
  normalize(raw, label) {
    // The only primitive that can supply a line context, so the only one that allows `$line.`.
    assertClosedKeys(raw, ["left", "op", "right"], label);
    return {
      left: normalizeOperand(raw["left"], `${label}.left`, REF_PREFIXES),
      op: requireEnum(raw["op"], COMPARATORS, `${label}.op`),
      right: normalizeOperand(raw["right"], `${label}.right`, REF_PREFIXES),
    };
  },
  evaluate(p, ctx) {
    const bad: number[] = [];
    ctx.lines.forEach((line, index) => {
      const scoped: RuleContext = { ...ctx, line };
      const left = resolveOperand(p.left, scoped, "left");
      const right = resolveOperand(p.right, scoped, "right");
      // The label carries the line number. A per-line error that does not say which line makes the user guess row by row.
      if (!compare(left, p.op, right, `line ${index + 1} ${operandLabel(p.left, ctx.labels)}`)) bad.push(index + 1);
    });
    return {
      ok: bad.length === 0,
      // Do not repeat the whole rule ("every line's X must ..."). The line
      // numbers already point at the failing rows. Saying "every line" again
      // reads as "all rows failed".
      detail: bad.length
        ? `line ${bad.join(", ")} does not satisfy: ${operandText(p.left, ctx.labels)} must ${comparisonText(p.op, p.right, ctx.labels)}`
        : "Every detail line satisfies the check",
    };
  },
  describe: (p, labels) => `Every line's ${operandText(p.left, labels)} must ${comparisonText(p.op, p.right, labels)}`,
  billFields: (p) => [...billFieldsOf(p.left), ...billFieldsOf(p.right)],
  actorKeys: (p) => [...actorKeysOf(p.left), ...actorKeysOf(p.right)],
  paramKeys: (p) => [...paramKeysOf(p.left), ...paramKeysOf(p.right)],
  lineFields: (p) => [...lineFieldsOf(p.left), ...lineFieldsOf(p.right)],
  usesLines: () => true,
};

/**
 * At least one line satisfies the comparison.
 *
 * Same operand and comparator contract as `lines_all`. Only the quantifier
 * differs. Evaluation still walks every detail line. Short-circuiting on the
 * first hit would swallow a later blank or a later bad type, so the same data
 * would fail closed or not depending on row order.
 */
const linesAny: Primitive<CompareParams> = {
  name: "lines_any",
  normalize(raw, label) {
    assertClosedKeys(raw, ["left", "op", "right"], label);
    return {
      left: normalizeOperand(raw["left"], `${label}.left`, REF_PREFIXES),
      op: requireEnum(raw["op"], COMPARATORS, `${label}.op`),
      right: normalizeOperand(raw["right"], `${label}.right`, REF_PREFIXES),
    };
  },
  evaluate(p, ctx) {
    const matched: number[] = [];
    ctx.lines.forEach((line, index) => {
      const scoped: RuleContext = { ...ctx, line };
      const left = resolveOperand(p.left, scoped, "left");
      const right = resolveOperand(p.right, scoped, "right");
      if (compare(left, p.op, right, `line ${index + 1} ${operandLabel(p.left, ctx.labels)}`)) {
        matched.push(index + 1);
      }
    });
    return {
      ok: matched.length > 0,
      detail: matched.length > 0
        ? `line ${matched.join(", ")} satisfies: ${operandText(p.left, ctx.labels)} must ${comparisonText(p.op, p.right, ctx.labels)}`
        : `No detail line satisfies: ${operandText(p.left, ctx.labels)} must ${comparisonText(p.op, p.right, ctx.labels)}`,
    };
  },
  describe: (p, labels) => `At least one line's ${operandText(p.left, labels)} must ${comparisonText(p.op, p.right, labels)}`,
  billFields: (p) => [...billFieldsOf(p.left), ...billFieldsOf(p.right)],
  actorKeys: (p) => [...actorKeysOf(p.left), ...actorKeysOf(p.right)],
  paramKeys: (p) => [...paramKeysOf(p.left), ...paramKeysOf(p.right)],
  lineFields: (p) => [...lineFieldsOf(p.left), ...lineFieldsOf(p.right)],
  usesLines: () => true,
};

/**
 * Aggregation modes for `related_agg`.
 *
 * Do not copy the "aggregation is only sum / count" rule from `lineAgg`. That
 * rule exists because a total is stored in a `notNull` column: the total of an
 * empty detail set is 0 (arithmetic), while the minimum of an empty detail set
 * does not exist, so a `notNull` column has nothing to store. `related_agg`
 * stores nothing. It is the left side of a gate and lives for one evaluation.
 * "This run cannot compute a value" is a conclusion the gate can say (see the
 * empty-row branch in evaluate). The two constraints are on different axes.
 *
 * Only `min` is added, not `max` / `avg`:
 *   · `min` has one concrete source, the bottleneck: a completion receipt must
 *     not exceed the smallest reported good quantity across operations. That
 *     "the short board sets the cap" pattern shows up in more than one place
 *     in manufacturing.
 *   · `max` / `avg` have no caller today. Their presence on rollup aggregates
 *     is not a reason. A rollup is a display summary. `related_agg` is a gate.
 *     A wrong display is visible. A wrong gate looks like a pass. Each extra
 *     mode is another combination of empty row set and `plus` that has to be
 *     decided on purpose.
 */
export const RELATED_AGG_AGGS = ["sum", "count", "min"] as const;
export type RelatedAggAgg = (typeof RELATED_AGG_AGGS)[number];

/** English for the aggregates this primitive actually evaluates. A sum is "total". */
const RELATED_AGG_TEXT: Readonly<Record<RelatedAggAgg, string>> = Object.freeze({
  sum: "total",
  count: "count",
  min: "minimum",
});

export interface RelatedAggregation {
  /** Derived from the primitive name, not a declaration key. Ordinary totals and tenant-invariant totals are two closed entries. */
  readonly readScope: "actor" | "tenantInvariant";
  /** Downstream entity. */
  readonly from: string;
  /**
   * Which layer of `from` is summarized. `null` means header rows. Non-null
   * means one detail table under the header.
   *
   * This dimension was forced by combined shipments. Once one shipment can span
   * several orders, "cumulative shipped must not exceed the order quantity" can
   * no longer be said on the header: the shipment header has no `orderId`, and
   * its quantity is the sum of several orders. It has to be summarized by order
   * line: `from='salesDelivery' through='lines' match='orderLineId'`.
   *
   * `where` still filters the header (detail lines have no state machine), the
   * same contract as `derive.rollup`.
   */
  readonly through: string | null;
  /** The field on the downstream row that points back at this document. When `through` is set, this is a detail column. */
  readonly match: string;
  /**
   * The field on this document used as the link key. The default is id. When a
   * master record asks "do I still have open documents", the link key is the
   * master record's own id, while the downstream points back by supplierId.
   * The field names differ.
   *
   * Write a field name (`id` / `customerId`) or a `$line.` detail column
   * (`$line.orderLineId`). The latter makes this rule evaluate per line: each
   * line of a combined shipment belongs to a different order line, and
   * "cumulative must not exceed the order quantity" holds only at line grain
   * on that document.
   *
   * It is an identity coordinate, not an arbitrary cell: `id` (this document or
   * this line), a `ref` column (a header), or a `refLine` column (a detail
   * row). All three mean "whose total is this". The predicate is closed in
   * `relatedAggKeySpaceOf` (the kernel derives the coordinate space) plus
   * `checkCrossReferences` (the cross-module check that `on` and `match` land
   * in the same space).
   *
   * Allowing `refLine` is not a widening. It makes a shape that is already in
   * use checkable. "How much of the upstream line is left" is written as
   * `on: "$line.<refLine column>"` in many places. Before the gate existed, a
   * wrong column (writing `sourceOrderId` for `sourceOrderLineId`, or pointing
   * `match` at another table) said nothing at modeling time. At runtime `list()`
   * compared an order id with a detail-line id column, matched nothing, the
   * total was 0, and the cap gate always passed, with `verdict = pass` looking
   * completely normal.
   */
  readonly on: string;
  readonly agg: RelatedAggAgg;
  /** null when agg === 'count'. */
  readonly measure: string | null;
  /** Filter on the downstream rows, for example `{ status: "awaitingReceipt" }`. An array means in, for example `{ status: ["awaitingShipment", "partiallyShipped"] }`. */
  readonly where: RowFilter | null;
  readonly op: Comparator;
  readonly right: Operand;
  /**
   * The quantity this document contributes. `null` means this document is not included.
   *
   * It must be declared. There is no safe default, and each direction has a failure:
   *
   *   · Omit it when `where` excludes this document: the left side is only
   *     history, so "cumulative must not exceed the cap" always passes the
   *     first document that crosses the cap and fires on the next one. The
   *     whole run is `verdict = pass`, with no symptom. Measured: order 4000,
   *     already shipped 1500, this document 3000, judged `1500 <= 4000`, posted
   *     two ledger lines, cumulative 4500, over-shipped by 500.
   *   · Include it when `where` is empty and this document is already in the
   *     row set: this document's quantity is counted twice.
   *
   * Which one holds depends on whether the row set `where` draws includes this
   * document. The framework cannot derive that, so the modeler makes the choice
   * explicitly, the same discipline as `effects.subject`.
   *
   * When `agg` is `"min"`, `plus` must be `null` (rejected at normalize, not at
   * runtime). The same key would be two operations that the declaration cannot
   * tell apart: under sum / count it is addition (accumulate, then compare with
   * the cap); under min the only composition that makes sense is "take the
   * smaller". A modeler who writes `plus: { ref: "$bill.qty" }` is thinking of
   * the first, and min would compute the second. The gate would pass every time
   * and mean something else. In the bottleneck use this document is not a member
   * of that row set (a completion receipt does not produce an operation's good
   * quantity), so `null` is the only writing that holds. If a second case
   * appears where this document is a member and must be included in the min,
   * add that meaning explicitly. Do not leave a default that reads as addition.
   */
  readonly plus: Operand | null;
  /**
   * Derived, not declared: `$line.` in `on`, `right`, or `plus` means per-line.
   *
   * There is no separate key, same discipline as `effects.perLine` and
   * `available_sufficient.perLine`. A key would immediately allow a contradictory
   * declaration (`perLine: false` while referencing `$line.qty`).
   */
  readonly perLine: boolean;
}

/** The only prefix `related_agg.on` accepts. Any other prefix is rejected at normalize (see `ON_PREFIXED`). */
const ON_LINE = "$line.";

/**
 * Which layer `on` sits on, and which cell it names.
 *
 * One function, not four copies of `startsWith("$line.")`. Evaluation (reading
 * the coordinate), the static projections (`billFields` / `lineFields`), the
 * description (naming the coordinate), and the two gates must read the same
 * answer. A copy that forgets to strip the prefix looks up a field named
 * `$line.orderLineId`, gets undefined, the coordinate is missing, and the gate
 * reports "cannot link" on every line while the declaration is correct.
 */
export function relatedAggKeyOf(p: RelatedAggregation): EffectRef {
  return p.on.startsWith(ON_LINE) ? { from: "line", field: p.on.slice(ON_LINE.length) } : { from: "bill", field: p.on };
}

/**
 * Which coordinate space a link key lands in: the "who" of "whose total is this".
 *
 * Three cases, the whole set:
 *   · `id`      => the layer the key sits on (this document / this line, or a row of the downstream table itself)
 *   · `ref`     => the target module's header
 *   · `refLine` => that detail table of the target module
 * Any other type returns `null`. A quantity, an amount, and a status are not
 * identities. Using them as a link key matches "every row whose quantity happens
 * to be equal", and that total has a value and looks completely normal.
 *
 * The predicate lives in the kernel, not separately in validate and the loader.
 * The `on` side is derived from this module's declaration and the `match` side
 * from the target module's declaration. Both sides must use the same ruler.
 * Two rulers let the gate believe the sides match while `list()` compares a
 * header id with a detail-line id column, matches nothing, the total is always
 * 0, and the cap gate always passes (the floor gate always blocks), with no error.
 *
 * `through` is part of the space, not a decoration. `(salesOrder, null)` and
 * `(salesOrder, lines)` are two disjoint id sets. Drop that dimension and
 * "order id matches order-line id" is judged as a match.
 */
export interface KeySpace {
  readonly module: string;
  /** null = header layer; non-null = that detail table. */
  readonly through: string | null;
}

export function keySpaceOf(key: string, field: Field | undefined, own: KeySpace): KeySpace | null {
  // `id` is a platform field (it must not be declared), so `field` is missing. Judge that first; do not treat it as "column does not exist".
  if (key === "id") return own;
  if (!field || field.ref === null) return null;
  if (field.type === "ref") return { module: field.ref, through: null };
  if (field.type === "refLine") return { module: field.ref, through: field.through };
  return null;
}

export function sameKeySpace(a: KeySpace, b: KeySpace): boolean {
  return a.module === b.module && a.through === b.through;
}

/** Sentence for a coordinate space: `productionOrder detail table "lines"`. */
export function keySpaceText(space: KeySpace): string {
  return space.through === null ? `${space.module} header` : `${space.module} detail table "${space.through}"`;
}

/**
 * What a link key is called.
 *
 * `id` does not go through `labelOfKey`. It is a platform field with no
 * modeler-written label, so the fallback would print `id`, and the screen has
 * no such word. "this document" / "this line" matches what the user can see,
 * and it separates the two grains (writing `id` and `$line.id` in the same
 * declaration is two different gates).
 *
 * A named cell is quoted. `id` is not. Same contract as `operandLabel`: the
 * quotes mean "this cell is on the form, go look there", and "this line" is not a cell.
 */
function relatedAggKeyText(p: RelatedAggregation, labels: FieldLabels): string {
  const key = relatedAggKeyOf(p);
  if (key.field === "id") return key.from === "line" ? "this line" : "this document";
  return `"${labelOfKey(labels, `$${key.from}`, key.field)}"`;
}

/** Compare an aggregate of a related row set. Typical use: cumulative received quantity must not exceed the order quantity. */
const relatedAgg: Primitive<RelatedAggregation> = {
  name: "related_agg",
  normalize(raw, label) {
    assertClosedKeys(raw, ["from", "through", "match", "on", "agg", "measure", "where", "op", "right", "plus"], label);
    const agg = requireEnum(raw["agg"], RELATED_AGG_AGGS, `${label}.agg`);
    const measureRaw = raw["measure"];
    const measure = measureRaw === undefined || measureRaw === null ? null : requireText(measureRaw, `${label}.measure`);
    if (agg !== "count" && !measure) schemaFail(`${label}: ${agg} requires measure`);
    if (agg === "count" && measure) schemaFail(`${label}: count does not accept measure`);
    const onRaw = raw["on"];
    const whereRaw = raw["where"];
    const throughRaw = raw["through"];
    // `plus` absent and `plus: null` are different. The first is "never considered".
    // The second is "considered, and this document is not included". `in` rather
    // than an undefined check forces that decision. See RelatedAggregation.plus.
    if (!("plus" in raw)) {
      schemaFail(
        `${label}.plus must be declared explicitly: write the quantity this document contributes (for example { ref: "$bill.qty" }), ` +
          `or write null to leave this document out (when the row set drawn by where already includes this document). ` +
          `Without the declaration, a gate such as "cumulative must not exceed the cap" passes the first document that crosses the cap, with no symptom`,
      );
    }
    const plusRaw = raw["plus"];
    const on = onRaw === undefined || onRaw === null ? "id" : requireText(onRaw, `${label}.on`);
    const right = normalizeOperand(raw["right"], `${label}.right`, REF_PREFIXES);
    const plus = plusRaw === null ? null : normalizeOperand(plusRaw, `${label}.plus`, REF_PREFIXES);
    // See RelatedAggregation.plus: the same key is "add" under sum and can only
    // be "take the smaller" under min, and the declaration cannot tell them apart.
    // Reject it here. Do not leave a default that reads as addition.
    if (agg === "min" && plus !== null) {
      schemaFail(
        `${label}: when agg=min, plus must be null. min reads the smallest value in the related row set. ` +
          `This document is not a member of that row set (writing plus usually means "accumulate, then compare with the cap", which is sum). ` +
          `To include this document, use sum, or put this document's quantity on right`,
      );
    }

    // Per-line predicate: any of the three positions references `$line.`. `on` written as `$line.xxx` is the main shape.
    const onLine = on.startsWith(ON_LINE);
    if (!onLine && ON_PREFIXED.test(on)) {
      schemaFail(
        `${label}.on "${on}": only a header field name (for example id / customerId) or a $line. detail column is accepted. ` +
          `Any other prefix has no reading here (a link key must be a fact already stored)`,
      );
    }
    const perLine = onLine || lineFieldsOf(right).length > 0 || (plus !== null && lineFieldsOf(plus).length > 0);
    // Same gate as effects / available_sufficient: when judging per line, this
    // document's contribution must also come from the line. Comparing the
    // header total with each line's cap makes every line "pass" and the
    // conclusion is wrong: a combined document of 300, this line only 100, and
    // every line asks the order line whether 300 fits.
    if (perLine && plus !== null && lineFieldsOf(plus).length === 0) {
      schemaFail(
        `${label}: this rule judges by detail line ($line. appears in on / right), so plus must also come from a detail line (for example { ref: "$line.qty" }). ` +
          `Otherwise every line compares the whole document's quantity with this line's cap, every line passes, and the conclusion is wrong`,
      );
    }
    return {
      readScope: "actor",
      from: requireText(raw["from"], `${label}.from`),
      through: throughRaw === undefined || throughRaw === null ? null : requireText(throughRaw, `${label}.through`),
      match: requireText(raw["match"], `${label}.match`),
      on,
      agg,
      measure,
      where: whereRaw === undefined || whereRaw === null ? null : normalizeRowFilter(whereRaw, `${label}.where`),
      op: requireEnum(raw["op"], COMPARATORS, `${label}.op`),
      right,
      plus,
      perLine,
    };
  },
  async evaluate(p, ctx) {
    /**
     * Value when the link coordinate cannot be read.
     *
     * Do not throw. "That cell on this document is blank" is a business
     * conclusion, not a system fault. A document with mixed line sources (half
     * tied to an upstream plan line, half typed in) is a real shape. The user
     * should split the document or fill the source, not read "this rule cannot
     * be computed right now". Same discipline as "a missing required parameter
     * is a block conclusion, not an exception", and the same shape as
     * `ref_field_compare` in this file (`via is blank, so ... cannot be checked`).
     * One fact in this package gets one answer.
     *
     * Still fail-closed (`ok: false`). Failing to link the downstream means this
     * cumulative gate verified nothing, and "not verified" is never "passed".
     */
    const MISSING = Symbol("related_agg.missing-coordinate");
    const key = relatedAggKeyOf(p);
    const coordinateOf = (line: Readonly<Record<string, unknown>> | null): unknown | typeof MISSING => {
      // Per-line with no line context: the declaration and the evaluation disagree. That is not a data problem. Throw as before.
      if (key.from === "line" && !line) schemaFail(`related_agg: ${p.on} references a detail line, but there is no line context`);
      const source = key.from === "line" ? (line as Readonly<Record<string, unknown>>) : ctx.bill;
      // A refLine column reads the upstream line's id. `$line.id` is this line's
      // own id. The only difference here is which cell is read. The coordinate
      // space was already compared by `keySpaceOf` at modeling time. Evaluation
      // does not judge it again. Two judgments are two rulers, and the one that
      // drifts has no symptom.
      const id = source[key.field];
      return id === undefined || id === null || id === "" ? MISSING : id;
    };
    /** What the link key is called (`$line.planLineId` becomes the source-plan-line label). */
    const onText = relatedAggKeyText(p, ctx.labels);
    const missingText = `${onText} has no value, so it cannot be linked to ${p.from}; the cumulative gate cannot decide and refuses to pass on that basis`;
    /** What this measure is called. sum says total, min says minimum. */
    const what = p.agg === "count" ? "row count" : `${p.measure} ${RELATED_AGG_TEXT[p.agg]}`;

    /**
     * Aggregate of the related row set. `null` means this aggregate has no value
     * on this row set (only min does).
     *
     * The min of an empty row set must not become 0 and must not become +infinity.
     *   · As 0 it is a lie. "The minimum reported good quantity is 0" reads as
     *     "0 were reported", while the fact is that no operation has reported yet.
     *     The user goes looking for a report and finds an empty list.
     *   · As +infinity (or skipping the gate): when `op` is `gte` / `lte` the
     *     gate passes silently, and the thing it passes is "receipt before any
     *     operation has reported", which is the shape that most needs to be
     *     blocked, with no symptom.
     * So return `null`, and let `judge` turn it into a fail-closed sentence.
     * Same discipline as "per-line mode with zero detail lines does not pass silently".
     */
    const historyByCoordinate = new Map<string, Promise<number | null>>();
    const historyOf = (id: unknown): Promise<number | null> => {
      const key = JSON.stringify(id);
      const prior = historyByCoordinate.get(key);
      if (prior) return prior;
      const queried = (async (): Promise<number | null> => {
        if (p.readScope === "tenantInvariant") {
          // The invariant primitive already rejects count at normalize. No silent fallback here.
          if (p.agg === "count" || p.measure === null) {
            schemaFail(`invariant_related_agg accepts only sum / min with a measure`);
          }
          const aggregate = ctx.query.invariantAggregate;
          if (!aggregate) schemaFail(`invariant_related_agg: runtime did not inject a system-invariant aggregate`);
          return await aggregate(
            p.from,
            { [p.match]: id, ...(p.where ?? {}) },
            p.through,
            p.agg,
            p.measure,
          );
        }
        const rows = await ctx.query.list(p.from, { [p.match]: id, ...(p.where ?? {}) }, p.through);
        if (p.agg === "count") return rows.length;
        const values = rows.map((row) => numeric(row[p.measure as string], `${p.from}.${p.measure}`));
        // The empty row set of sum is 0: that is the identity of addition, not a fallback.
        if (p.agg === "sum") return values.reduce((sum, v) => sum + v, 0);
        // Do not use `Math.min(...values)`. The row-set cap is RULE_QUERY_MAX_ROWS (10 000).
        // Spreading that into arguments is an unnecessary risk on the engine's stack.
        return values.length ? values.reduce((low, v) => (v < low ? v : low)) : null;
      })();
      historyByCoordinate.set(key, queried);
      return queried;
    };

    /** One judgment on one link key. Once per line when per-line, once for the header. */
    const judge = async (
      scoped: RuleContext,
      line: Readonly<Record<string, unknown>> | null,
      groupedMine: number | null,
    ): Promise<{ readonly ok: boolean; readonly text: string }> => {
      const id = coordinateOf(line);
      if (id === MISSING) return { ok: false, text: missingText };
      const history = await historyOf(id);
      const layer = p.through === null ? p.from : `${p.from} detail lines`;
      if (history === null) {
        return {
          ok: false,
          text: `${layer} has none, so "${what}" cannot be obtained — refusing to pass on that basis`,
        };
      }
      // This document's contribution. If it cannot be read, throw. Do not treat
      // it as 0. "How much is this shipment" unreadable and judged as "not over"
      // is exactly the pass this dimension exists to prevent.
      const mine =
        groupedMine ??
        (p.plus === null ? 0 : numeric(resolveOperand(p.plus, scoped, "plus"), operandLabel(p.plus, ctx.labels)));
      // `plus` holds only under sum / count, and its composition is addition.
      // min already requires plus === null at normalize (see RelatedAggregation.plus).
      // The branch, rather than an unconditional add, keeps "min does not add"
      // visible at the evaluation site. Otherwise a future min + plus would add
      // by default, which is the silent mis-calculation this constraint prevents.
      const left = p.agg === "min" ? history : tidy(history + mine);
      const right = resolveOperand(p.right, scoped, "right");
      const breakdown = p.plus === null ? `${left}` : `${left} (existing ${history} + this document ${mine})`;
      return {
        ok: compare(left, p.op, right, `${p.from} ${what}`),
        // The right operand must name its source. The cap is almost always
        // `$bill.x` (invoice amount / statement amount / planned quantity).
        // Printing only the number makes "required not greater than 0" look like
        // the system is demanding an absurd value, when it is saying "the
        // upstream document has approved 0 so far". See `expectationText`.
        text: `${p.from} ${what} is ${breakdown}, ${expectationText(p.op, p.right, right, ctx.labels)}`,
      };
    };

    if (!p.perLine) {
      const one = await judge(ctx, null, null);
      return { ok: one.ok, detail: one.text };
    }

    // Zero lines in per-line mode must not pass silently. An empty for-loop
    // would make a block rule always true. "Must have detail lines" is another
    // rule's job, but when that rule is absent this one must not decide for it.
    if (!ctx.lines.length) {
      return { ok: false, detail: `This document has no detail lines, so the per-line cumulative gate cannot decide — refusing to pass on that basis` };
    }

    // One document may split the same source line into several lines (batch,
    // bin, and other business dimensions). A cumulative cap judges "how much
    // this source coordinate has taken on", so this document's contribution
    // must be grouped by the `on` coordinate first. Adding each line on its own
    // would judge 6 + 6 against a cap of 10 as two passes of 6 <= 10.
    const mineByCoordinate = new Map<string, number>();
    if (p.plus !== null) {
      for (const line of ctx.lines) {
        const id = coordinateOf(line);
        // A line with a missing coordinate does not enter the group. It has no
        // coordinate to group by, and judge reports it as a failure on its own.
        // Stuffing it into an "undefined" bucket would add this line's quantity
        // onto the cumulative of the other lines.
        if (id === MISSING) continue;
        const scoped = { ...ctx, line };
        const mine = numeric(resolveOperand(p.plus, scoped, "plus"), operandLabel(p.plus, ctx.labels));
        const key = JSON.stringify(id);
        mineByCoordinate.set(key, tidy((mineByCoordinate.get(key) ?? 0) + mine));
      }
    }

    const bad: string[] = [];
    for (const [index, line] of ctx.lines.entries()) {
      const id = coordinateOf(line);
      const groupedMine =
        p.plus === null || id === MISSING ? 0 : (mineByCoordinate.get(JSON.stringify(id)) ?? 0);
      const one = await judge({ ...ctx, line }, line, groupedMine);
      if (!one.ok) bad.push(`line ${index + 1}: ${one.text}`);
    }
    return {
      ok: bad.length === 0,
      detail: bad.length ? bad.join("; ") : `${ctx.lines.length} lines; each line satisfies the check`,
    };
  },
  describe: (p, labels) => {
    const scope = p.where
      ? ` (limited to ${Object.entries(p.where)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? v.map(String).join("/") : String(v)}`)
          .join(", ")})`
      : "";
    const what = p.agg === "count" ? "row count" : `${p.measure} ${RELATED_AGG_TEXT[p.agg]}`;
    // The description must say whether this document is included. People and
    // agents both read this sentence. A wrong one makes an agent explain "why
    // it did not block" from a meaning that does not hold.
    const mine = p.plus === null ? "" : `plus this document's ${operandText(p.plus, labels)} `;
    // Per-line or not must be said. The same sentence at two grains is two
    // different contracts ("the whole document must not exceed" and "each line
    // must not exceed on its own").
    const grain = p.perLine ? "Per detail line: " : "";
    const layer = p.through === null ? p.from : `${p.from} detail lines`;
    // The coordinate must be said. "Cumulative must not exceed the cap" computed
    // by this document, by this line, or by the upstream order line this line
    // points at are three different gates. The first two were already in
    // `grain`. The third used to be missing entirely. A reader of "Per detail
    // line: ... must be not greater than order quantity" could not tell whose
    // cumulative that was. The true answer is the third.
    const by = ` (aligned by ${relatedAggKeyText(p, labels)})`;
    return `${grain}${layer}${scope} ${what} ${mine}must ${comparisonText(p.op, p.right, labels)}${by}`;
  },
  billFields: (p) => {
    const key = relatedAggKeyOf(p);
    return [
      // `id` is included too. The existence check lets it through as `isPlatformField`, same rule as `$line.id`.
      ...(key.from === "bill" ? [key.field] : []),
      ...billFieldsOf(p.right),
      ...(p.plus ? billFieldsOf(p.plus) : []),
    ];
  },
  actorKeys: (p) => [...actorKeysOf(p.right), ...(p.plus ? actorKeysOf(p.plus) : [])],
  paramKeys: (p) => [...paramKeysOf(p.right), ...(p.plus ? paramKeysOf(p.plus) : [])],
  // When `on` is `$line.xxx` it is also a line-field reference and must be in
  // this projection. Otherwise a misspelled column (`orderLine` for `orderLineId`)
  // is invisible at modeling time, and at evaluation the whole edge is unusable.
  lineFields: (p) => {
    const key = relatedAggKeyOf(p);
    return [
      ...(key.from === "line" ? [key.field] : []),
      ...lineFieldsOf(p.right),
      ...(p.plus ? lineFieldsOf(p.plus) : []),
    ];
  },
  usesLines: (p) => p.perLine,
};

/**
 * A tenant-level settlement invariant is its own primitive, not a scope switch
 * on `related_agg` that any caller can flip. The two share parameters and the
 * coordinate gates. The only difference at runtime is that this one reads a
 * single tenant-scoped aggregate.
 */
const invariantRelatedAgg: Primitive<RelatedAggregation> = {
  ...relatedAgg,
  name: "invariant_related_agg",
  normalize(raw, label) {
    const normalized = relatedAgg.normalize(raw, label);
    if (normalized.agg === "count") {
      schemaFail(`${label}: invariant_related_agg does not accept count yet; only sum / min are allowed`);
    }
    return { ...normalized, readScope: "tenantInvariant" };
  },
  describe: (p, labels) => `Tenant-wide invariant: ${relatedAgg.describe(p, labels)}`,
};

/**
 * The landing of the second hop. The path is written in `via`
 * (`$bill.taskId.prevProcessTaskId`). This only says which module and which
 * layer the second hop lands on.
 *
 * The landing must be declared. It is not derived from the previous hop's field
 * declaration: the kernel is zero IO and can see only one module at a time.
 * The first hop's landing can still be derived from this module's `ref`
 * (`validate` cross-checks `entity` that way). The second hop's cell lives on
 * another module, which normalize cannot reach, and at evaluation the first
 * argument of `ctx.query.get` is the module code. A "decide at runtime" opening
 * postpones a modeling error until the first click.
 *
 * There is no third hop. This structure has no nested `then`, and
 * `assertClosedKeys` rejects an extra key. The depth cap is structural, not a
 * length check. See the predicate on `parseViaPath`.
 */
export interface ReferenceHop {
  /**
   * The column (a reference column) on the first hop's landing row. Derived
   * from the second segment of the `via` path, not declared separately. Two
   * declarations are two sources of truth, and the one that drifts makes
   * `describe` print a different path from the one evaluation walks.
   */
  readonly field: string;
  /** Entity the second hop lands on. */
  readonly entity: string;
  /** null = lands on the header; non-null = lands on this detail table. */
  readonly through: string | null;
}

export interface ReferenceComparison {
  /**
   * The foreign-key coordinate on this document (the first hop). `ref` points
   * at a header, `refLine` at a detail line.
   *
   * Declared as a path: one hop `$bill.customerId`, two hops
   * `$bill.taskId.prevProcessTaskId`. After normalize the first segment stays
   * here and the second goes into `then.field`.
   */
  readonly via: EffectRef;
  /** Entity the first hop lands on. */
  readonly entity: string;
  /** null = the first hop lands on the header; non-null = it lands on this detail table of the referenced module. */
  readonly through: string | null;
  /**
   * The second hop. `null` means one hop (the great majority today).
   *
   * Hard cap of 2. A third hop is rejected at modeling time. The reason is not
   * "two hops are enough". It is that two hops are still statically checkable:
   * every hop's landing is written in the declaration, `checkCrossReferences`
   * checks each hop's column, type, and that the module it points at is the
   * next hop's landing, and `explain` can say the whole path. Past an arbitrary
   * depth this rule becomes a query language: unbounded path length means the
   * gate can only check "looks like", and `describe` can only print a string of
   * dots. The whole value of this primitive is that those two things stay clear.
   */
  readonly then: ReferenceHop | null;
  /** The field on the destination row (the second hop's landing when there is a second hop). */
  readonly field: string;
  readonly op: Comparator;
  readonly right: Operand;
  /** Per-line when via or right lands on a detail line. */
  readonly perLine: boolean;
}

/**
 * Compare a field on a referenced record.
 *
 * Header example: the supplier must be active.
 * Detail example: a delivery line's product and price must equal the order-line
 * fact that `orderLineId` points at.
 */
const refFieldCompare: Primitive<ReferenceComparison> = {
  name: "ref_field_compare",
  normalize(raw, label) {
    assertClosedKeys(raw, ["via", "entity", "through", "then", "field", "op", "right"], label);
    const viaRaw = requireText(raw["via"], `${label}.via`);
    // Existing header declarations may say `via: "customerId"`. New declarations
    // write `$line.orderLineId` explicitly. Only these two coordinates are
    // allowed, so an arbitrary path cannot bypass the static field projection.
    const path = parseViaPath(viaRaw.startsWith("$") ? viaRaw : `$bill.${viaRaw}`, `${label}.via`);
    const via = path.via;
    const throughRaw = raw["through"];
    const through =
      throughRaw === undefined || throughRaw === null
        ? null
        : requireText(throughRaw, `${label}.through`);
    const right = normalizeOperand(raw["right"], `${label}.right`, REF_PREFIXES);

    // The path and the landing must correspond, and both directions are rejected.
    //   · A two-segment path with no second-hop landing means evaluation does
    //     not know which module to read.
    //   · A second-hop landing with a one-segment path means that hop has no
    //     entry column, can never be reached, and the gate judges only the
    //     first hop against a declaration that looks configured.
    // Both have zero symptoms, so both are said at modeling time.
    const thenRaw = raw["then"];
    const hasThen = thenRaw !== undefined && thenRaw !== null;
    if (path.second !== null && !hasThen) {
      schemaFail(
        `${label}.via "${viaRaw}" is a two-hop path, so then: { entity, through } is required. ` +
          `The kernel cannot derive which module the second hop lands on (zero IO, it can see only this module), ` +
          `and the first argument of ctx.query.get is the module code`,
      );
    }
    if (path.second === null && hasThen) {
      schemaFail(
        `${label}.then gives a second-hop landing, but via "${viaRaw}" has only one hop. ` +
          `The path is written in via (for example "$bill.taskId.prevProcessTaskId") and the landing in then. The two must come as a pair`,
      );
    }
    let then: ReferenceHop | null = null;
    if (hasThen && path.second !== null) {
      const obj = requireObject(thenRaw, `${label}.then`);
      // The closed keys are the depth cap: there is no nested then / via here. A third hop throws.
      assertClosedKeys(obj, ["entity", "through"], `${label}.then`);
      const hopThroughRaw = obj["through"];
      then = {
        field: path.second,
        entity: requireText(obj["entity"], `${label}.then.entity`),
        through:
          hopThroughRaw === undefined || hopThroughRaw === null
            ? null
            : requireText(hopThroughRaw, `${label}.then.through`),
      };
    }

    return {
      via,
      entity: requireText(raw["entity"], `${label}.entity`),
      through,
      then,
      field: requireText(raw["field"], `${label}.field`),
      op: requireEnum(raw["op"], COMPARATORS, `${label}.op`),
      right,
      perLine: via.from === "line" || lineFieldsOf(right).length > 0,
    };
  },
  async evaluate(p, ctx) {
    const judge = async (
      scoped: RuleContext,
      line: Readonly<Record<string, unknown>> | null,
      index: number | null,
    ): Promise<CheckOutcome> => {
      const source = p.via.from === "bill" ? ctx.bill : line;
      if (!source) schemaFail(`ref_field_compare: ${coordText(p.via)} references a detail line, but there is no line context`);
      const refId = source[p.via.field];
      const at = index === null ? "" : `line ${index + 1}: `;
      const target = `${p.entity}${p.through ? `.${p.through}` : ""}`;
      /**
       * Which record the sentence is about.
       *
       * "purchase plan status is draft", said alone, is read by someone standing
       * on their own document as "my document is a draft". The gate is talking
       * about the upstream document picked in the purchase-plan cell. Naming the
       * coordinate makes the subject clear, and it matches the `describe`
       * sentence ("the record X points to ..."). Rule and actual sit next to
       * each other. Different subjects are read as two facts.
       */
      const whose = `${at}"${coordLabel(p.via, scoped.labels)}" points to ${target}`;
      // The destination. One hop: the first landing. Two hops: the then landing.
      // The error names the destination (which table's cell was not checked), not which stop along the way.
      const destination = p.then === null ? target : hopText(p.then);
      if (refId === undefined || refId === null || refId === "") {
        return {
          ok: false,
          detail: `${at}"${coordLabel(p.via, scoped.labels)}" is blank, so ${destination}.${p.field} cannot be checked`,
        };
      }
      const row = await ctx.query.get(p.entity, refId, p.through);
      if (!row) {
        return { ok: false, detail: `${whose}#${String(refId)} does not exist` };
      }

      /**
       * The second hop.
       *
       * Which hop broke must be said. "Production task is blank" and
       * "the completion warehouse on the production task that production task
       * points to is blank" are two sentences and two edits: the first fills a
       * cell on this document, the second fills a cell on the upstream document.
       * One sentence ("cannot read the completion warehouse") sends the user
       * looking for a field that does not exist on their form.
       *
       * An empty intermediate hop is fail-closed, same rule as an empty
       * reference on a one-hop path. A broken path means this gate verified
       * nothing, and "not verified" is never "passed". To allow "that upstream
       * cell is optional", the exit is `Precondition.when` (a guard), not a
       * fail-open main predicate. See GUARD_PRIMITIVES in preconditions.ts.
       */
      let leftRow = row;
      let leftWhose = whose;
      if (p.then !== null) {
        const hopId = row[p.then.field];
        if (hopId === undefined || hopId === null || hopId === "") {
          return {
            ok: false,
            detail: `${whose} field "${p.then.field}" is blank, so ${destination}.${p.field} cannot be checked`,
          };
        }
        const hopRow = await ctx.query.get(p.then.entity, hopId, p.then.through);
        leftWhose = `${whose} field "${p.then.field}" points to ${destination}`;
        if (!hopRow) {
          return { ok: false, detail: `${leftWhose}#${String(hopId)} does not exist` };
        }
        leftRow = hopRow;
      }

      const left = leftRow[p.field];
      const right = resolveOperand(p.right, scoped, "right");
      return {
        ok: compare(left, p.op, right, `${leftWhose} field "${p.field}"`),
        detail: `${leftWhose} ${p.field} is ${valueText(left)}, ${expectationText(p.op, p.right, right, scoped.labels)}`,
      };
    };

    if (!p.perLine) return await judge(ctx, null, null);
    // Same fail-closed boundary as the other per-line primitives: zero lines means nothing was verified, not that verification passed.
    if (!ctx.lines.length) {
      return { ok: false, detail: "This document has no detail lines, so the per-line related-fact check cannot decide — refusing to pass on that basis" };
    }
    const bad: string[] = [];
    for (const [index, line] of ctx.lines.entries()) {
      const one = await judge({ ...ctx, line }, line, index);
      if (!one.ok) bad.push(one.detail);
    }
    return {
      ok: bad.length === 0,
      detail: bad.length ? bad.join("; ") : `${ctx.lines.length} ${ctx.lines.length === 1 ? "line" : "lines"}; each line's related facts match`,
    };
  },
  // On two hops the whole path is printed. Printing only the destination
  // ("productionOrder completion warehouse must ...") sends the user looking
  // on their own document for a production order that is not there. They filled
  // a task, and the order came from the task. The full path answers "which cell to edit".
  describe: (p, labels) =>
    `${p.perLine ? "Per detail line: " : ""}"${coordLabel(p.via, labels)}" points to ` +
    `${p.entity}${p.through ? `.${p.through}` : ""}` +
    `${p.then === null ? "" : ` field "${p.then.field}" points to ${hopText(p.then)}`}, ` +
    `and its ${p.field} must ${comparisonText(p.op, p.right, labels)}`,
  billFields: (p) => [
    ...(p.via.from === "bill" ? [p.via.field] : []),
    ...billFieldsOf(p.right),
  ],
  actorKeys: (p) => actorKeysOf(p.right),
  paramKeys: (p) => paramKeysOf(p.right),
  lineFields: (p) => [
    ...(p.via.from === "line" ? [p.via.field] : []),
    ...lineFieldsOf(p.right),
  ],
  usesLines: (p) => p.perLine,
};

// -- available quantity ------------------------------------------------------

/**
 * Coordinate grammar, the same `$bill.` / `$line.` writing as effects (`EffectRef`).
 *
 * This is not "looks like". The account the check reads and the account the
 * posting writes must land in the same cell. Two coordinate grammars eventually
 * produce "the check reads the Shanghai warehouse and the posting deducts the
 * Beijing warehouse", and each declaration looks correct alone.
 *
 * The grammar's authority is `effects.ts` (`parseRef`, not exported). This is
 * its second consumer and should converge on one export.
 */
const COORD_REF = /^\$(bill|line)\.([a-zA-Z_][a-zA-Z0-9_]*)$/;

function parseCoord(raw: unknown, label: string): EffectRef {
  if (typeof raw !== "string" || !raw.trim()) schemaFail(`${label} must be '$bill.field' or '$line.field'`);
  const hit = COORD_REF.exec((raw as string).trim());
  if (!hit?.[1] || !hit[2]) {
    schemaFail(`${label} "${String(raw)}" is invalid: write '$bill.field' or '$line.field', the same coordinates as effects subject/scope`);
  }
  return { from: hit[1] as EffectRef["from"], field: hit[2] };
}

function coordText(ref: EffectRef): string {
  return `$${ref.from}.${ref.field}`;
}

/** Sentence for a landing: `processAssignment` / `productionOrder.lines`. */
function hopText(hop: ReferenceHop): string {
  return `${hop.entity}${hop.through ? `.${hop.through}` : ""}`;
}

/** Shape of one path segment, the same identifier grammar as the second half of `COORD_REF`. */
const PATH_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Upper bound on the depth of a `via` path.
 *
 * It is 2, not "2 for now". The reason is not "enough". It is that two hops
 * are still checked hop by hop: every landing is written in the declaration
 * (`entity` / `then.entity`), `checkCrossReferences` checks that the column
 * exists, that it is a reference, and that the module it points at is the next
 * hop's landing, and `explain` can print the whole path.
 *
 * A third hop turns this primitive into a query language: unbounded path length
 * means landings become an array, the gate degrades from "check each hop" to
 * "looks like", and `describe` can only print a string of dots. The whole value
 * of this primitive is that those two things stay clear (see the three points
 * at the top of this file). A deeper link has another exit: `derive.lookup`
 * (computed at query time, not stored).
 */
const MAX_VIA_HOPS = 2;

/**
 * A `via` path becomes the first-hop coordinate plus the second segment's field name.
 *
 * Separate from `parseCoord` rather than widening it. subject / scope on
 * available quantity are ledger coordinates. That grammar must match effects
 * character for character, and it is always one hop (whose account this is
 * cannot "go around twice"). Widening `parseCoord` would let a ledger coordinate
 * accept a path, and an extra hop there has no reading.
 */
function parseViaPath(raw: string, label: string): { readonly via: EffectRef; readonly second: string | null } {
  const parts = raw.trim().split(".");
  const head = parts[0];
  if (head !== "$bill" && head !== "$line") {
    schemaFail(`${label} "${raw}" is invalid: write '$bill.field' or '$line.field' (a second hop adds one more segment: '$bill.a.b')`);
  }
  const hops = parts.slice(1);
  if (!hops.length) schemaFail(`${label} "${raw}" is missing a field name`);
  if (hops.length > MAX_VIA_HOPS) {
    schemaFail(
      `${label} "${raw}" has ${hops.length} hops; the cap is ${MAX_VIA_HOPS}. ` +
        `Deeper than that cannot be checked hop by hop (landings would have to become an array, the gate could only check "looks like", and describe could only print a string of dots). ` +
        `For a deeper link use derive.lookup (computed at query time, not stored). Do not turn this gate into a query language`,
    );
  }
  for (const [i, segment] of hops.entries()) {
    if (!PATH_SEGMENT.test(segment)) schemaFail(`${label} "${raw}" hop ${i + 1} "${segment}" is not a legal field name`);
  }
  return {
    via: { from: head === "$bill" ? "bill" : "line", field: hops[0] as string },
    second: hops[1] ?? null,
  };
}

/**
 * What a coordinate is called (`$line.productId` becomes the product label).
 *
 * This is not a duplicate of `coordText`. A declaration-time error says
 * `$line.productId` (the modeler edits the declaration). An evaluation-time
 * sentence says the form label (the user fills the form). Two readers, two
 * vocabularies. One copy would say the wrong thing to one of them.
 */
function coordLabel(ref: EffectRef, labels: FieldLabels): string {
  return labelOfKey(labels, `$${ref.from}`, ref.field);
}

/** Floating-point dust (the 481600 - 490000 kind) should not show up in a difference the user reads. */
function tidy(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Where a cap comes from. Supplying it switches the available-quantity
 * algorithm. Omitting it is a pure balance. The difference is declared, not implicit.
 *
 * `via` is the foreign key on this document (for example supplierId), `entity`
 * is the referenced entity, and `field` is the cap column on that record.
 */
export interface AvailabilityLimit {
  readonly via: string;
  readonly entity: string;
  readonly field: string;
}

export interface AvailabilityParams {
  readonly target: EffectTarget;
  readonly subject: EffectRef;
  readonly scope: EffectRef | null;
  /** The quantity this action will take. */
  readonly need: EffectRef;
  readonly limit: AvailabilityLimit | null;
  /** Derived, not declared: `$line.` in subject / scope / need means per-line. */
  readonly perLine: boolean;
}

function coordId(ref: EffectRef, ctx: RuleContext, line: Readonly<Record<string, unknown>> | null, what: string): string {
  const row = ref.from === "bill" ? ctx.bill : line;
  if (!row) schemaFail(`available_sufficient: ${coordText(ref)} references a detail line, but there is no line context`);
  const raw = row[ref.field];
  // If the subject cannot be read there is no "whose account this reservation is on", and no "is it enough". Do not fall back to a total or skip.
  if (typeof raw !== "string" || !raw) {
    schemaFail(`available_sufficient: ${coordText(ref)} has no value, so this reservation cannot be tied to a specific ${what}; refusing to conclude`);
  }
  return raw;
}

interface Judged {
  readonly ok: boolean;
  readonly text: string;
  /** Available minus needed. When every line passes, this picks the tightest line to report. */
  readonly slack: number;
}

/**
 * Is the available quantity enough for the quantity this action will take.
 *
 * The parameterized axes are `target x subject x scope`, not the business word
 * "inventory". Over stock (`stock`, product x warehouse) and over a subject's
 * exposure cap (`ap`, supplier) are the same problem twice. One primitive, not two.
 *
 * Two algorithms, distinguished by whether `limit` is declared:
 *   · no limit  -> available = ledger balance (inventory: opening receipts minus shipped)
 *   · with limit -> available = cap field minus already used (the cap column on the record minus that subject's net ledger)
 *
 * The capped form must not degrade into `ref_field_compare` ("cap >= this document's amount").
 * That writing never looks at how much is already used. With a cap of 500000 and
 * 18400 already used (only 481600 available), a document of 490000 still passes,
 * and the conclusion looks completely normal: the cap really is >= the document
 * amount, and the rule really "passed".
 */
const availableSufficient: Primitive<AvailabilityParams> = {
  name: "available_sufficient",
  normalize(raw, label) {
    assertClosedKeys(raw, ["target", "subject", "scope", "need", "limit"], label);
    const target = requireEnum(raw["target"], listLedgerCodes(), `${label}.target`);
    const subject = parseCoord(raw["subject"], `${label}.subject`);
    const scopeRaw = raw["scope"];
    const scope = scopeRaw === undefined || scopeRaw === null ? null : parseCoord(scopeRaw, `${label}.scope`);
    const need = parseCoord(raw["need"], `${label}.need`);

    // The arity of target x scope is what the ledger contract says, the same
    // table as effects. These two throw at normalize rather than entering the
    // semantic report because they do not need module context, matching
    // normalizeEffect. Checking them again in validate is dead code.
    const contract = ledgerContract(target);
    if (contract.scope !== null && !scope) {
      schemaFail(
        `${label}.scope is missing: available quantity for ${target} is scoped to ${contract.scope}, so scope is required (for example '$bill.warehouseId'). ` +
          `Inventory is not warehouse-free, and "which warehouse is enough" has no answer`,
      );
    }
    if (contract.scope === null && scope) {
      schemaFail(`${label}.scope: the ${target} ledger is one-dimensional and does not accept scope (only stock is scoped to a warehouse)`);
    }

    const limitRaw = raw["limit"];
    let limit: AvailabilityLimit | null = null;
    if (limitRaw !== undefined && limitRaw !== null) {
      const obj = requireObject(limitRaw, `${label}.limit`);
      assertClosedKeys(obj, ["via", "entity", "field"], `${label}.limit`);
      limit = {
        via: requireText(obj["via"], `${label}.limit.via`),
        entity: requireText(obj["entity"], `${label}.limit.entity`),
        field: requireText(obj["field"], `${label}.limit.field`),
      };
    }

    const perLine = subject.from === "line" || scope?.from === "line" || need.from === "line";
    // Same gate as effects "if per line, the amount must come from the line".
    // A per-line subject with a header quantity asks every product whether the
    // whole document fits. Each line "passes" alone and the conclusion is wrong.
    if (perLine && need.from !== "line") {
      schemaFail(
        `${label}: subject/scope references $line, so this rule judges by detail line and need must also come from a detail line (for example '$line.qty'). ` +
          `Otherwise every line compares the header quantity, which is not the quantity this line will take`,
      );
    }
    return { target, subject, scope, need, limit, perLine };
  },

  async evaluate(p, ctx) {
    const contract = ledgerContract(p.target);

    // The cap lives on the record the header points at. One document has one customer / supplier, so read it once.
    let ceiling: number | null = null;
    if (p.limit) {
      const refId = ctx.bill[p.limit.via];
      if (refId === undefined || refId === null || refId === "") {
        return {
          ok: false,
          detail:
            `"${labelOfKey(ctx.labels, "$bill", p.limit.via)}" is blank, ` +
            `so ${p.limit.entity}.${p.limit.field} cannot be read and available quantity cannot be judged`,
        };
      }
      const row = await ctx.query.get(p.limit.entity, refId);
      if (!row) return { ok: false, detail: `${p.limit.entity}#${String(refId)} does not exist, so ${p.limit.field} cannot be read` };
      ceiling = numeric(row[p.limit.field], `${p.limit.entity} "${p.limit.field}"`);
    }

    const cache = new Map<string, number>();
    const running = new Map<string, number>();
    // The separator is the escaped `\u0000`, not a raw NUL byte in the source.
    // A raw NUL makes grep / ripgrep treat the whole file as binary and skip it
    // silently, so the largest gate file in this package would always return
    // zero hits for every grep-based check, and "not found" looks identical to
    // "this code is not here". The runtime value is the same.
    const keyOf = (subjectId: string, scopeId: string | null): string => `${subjectId}\u0000${scopeId ?? ""}`;

    const availableOf = async (subjectId: string, scopeId: string | null): Promise<number> => {
      const key = keyOf(subjectId, scopeId);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const posted = await ctx.query.balance(p.target, subjectId, scopeId);
      // A missing balance is not 0. Treating it as 0 lets an over-stock posting through, and the pass looks completely normal.
      if (typeof posted !== "number" || !Number.isFinite(posted)) {
        schemaFail(
          `available_sufficient: ${ledgerLabel(p.target)} balance is unavailable (${subjectId}${scopeId ? ` x ${scopeId}` : ""}); ` +
            `refusing to conclude that there is enough on that basis`,
        );
      }
      const value = ceiling === null ? posted : tidy(ceiling - posted);
      cache.set(key, value);
      return value;
    };

    const judge = async (line: Readonly<Record<string, unknown>> | null, index: number | null): Promise<Judged> => {
      const subjectId = coordId(p.subject, ctx, line, contract.subject);
      const scopeId = p.scope ? coordId(p.scope, ctx, line, contract.scope ?? "scope") : null;
      const needRow = p.need.from === "bill" ? ctx.bill : line;
      if (!needRow) schemaFail(`available_sufficient: ${coordText(p.need)} references a detail line, but there is no line context`);
      // Same discipline as compare's label: say `line 2 "quantity" is blank`,
      // not `available_sufficient $line.qty`. The latter is an internal word and is not on the screen.
      const need = numeric(
        needRow[p.need.field],
        `${index === null ? "" : `line ${index + 1} `}"${coordLabel(p.need, ctx.labels)}"`,
      );

      // When the same product is split across two lines, each line "enough" does not mean the sum is enough. Judge by the running subject total.
      const key = keyOf(subjectId, scopeId);
      const cumulative = tidy((running.get(key) ?? 0) + need);
      running.set(key, cumulative);

      const available = await availableOf(subjectId, scopeId);
      const at = index === null ? "" : `line ${index + 1}`;
      const where = `${contract.subject} "${subjectId}"`;
      const scope = scopeId ? ` ${contract.scope} "${scopeId}"` : "";
      const how =
        ceiling === null || !p.limit ? "" : ` (${p.limit.field} ${ceiling} - already used ${tidy(ceiling - available)})`;
      const want = cumulative === need ? `need ${need}` : `need ${need}, this document cumulative ${cumulative}`;
      const slack = tidy(available - cumulative);
      if (slack >= 0) return { ok: true, text: `${at} ${where}${scope} available ${available}${how}, ${want}`, slack };
      return { ok: false, text: `${at} ${where} short by ${tidy(-slack)}`, slack };
    };

    if (!p.perLine) {
      const one = await judge(null, null);
      return { ok: one.ok, detail: one.text };
    }
    // Per-line with no lines: this rule judged nothing, and "not judged" is never "enough".
    if (!ctx.lines.length) {
      return { ok: false, detail: `This rule judges available quantity by detail line, but the document has no detail lines — not judged does not mean enough` };
    }
    const bad: string[] = [];
    let tightest: Judged | null = null;
    for (const [index, line] of ctx.lines.entries()) {
      const one = await judge(line, index);
      if (!one.ok) bad.push(one.text);
      if (!tightest || one.slack < tightest.slack) tightest = one;
    }
    if (bad.length) {
      const billCode = typeof ctx.bill["code"] === "string" ? ctx.bill["code"] : "";
      const header = billCode ? `${billCode} short:\n` : "";
      return { ok: false, detail: `${header}${bad.join("\n")}` };
    }
    // A pass also reports numbers, and it reports the tightest line. "All enough"
    // does not say how much room is left, and "3 left" versus "3000 left" is a different next decision.
    return {
      ok: true,
      detail: `All ${ctx.lines.length} lines have enough available quantity. Tightest line: ${tightest?.text ?? ""}`,
    };
  },

  describe: (p, labels) => {
    // Both algorithms have to be said. "Is the balance enough" drops the capped form.
    const source = p.limit ? `${p.limit.entity} ${p.limit.field} minus already used` : "ledger balance";
    const at = `"${coordLabel(p.subject, labels)}"${p.scope ? ` x "${coordLabel(p.scope, labels)}"` : ""}`;
    const per = p.perLine ? "each line's " : "";
    // The ledger name goes through `ledgerLabel`. Printing `p.target` would not
    // drift; it would not be translated at all. The gate would say "stock
    // available quantity" while the posting preview on the same screen says the
    // ledger's label. The cross-module glossary cannot reach it: that table
    // holds module codes and field keys, and `target` is the closed ledger
    // enum, which belongs to no module.
    return `${ledgerLabel(p.target)} available quantity (${source}) must be not less than ${per}"${coordLabel(p.need, labels)}", counted by ${at}`;
  },

  billFields: (p) =>
    [p.subject, p.scope, p.need]
      .filter((r): r is EffectRef => r !== null && r.from === "bill")
      .map((r) => r.field)
      .concat(p.limit ? [p.limit.via] : []),
  actorKeys: () => [],
  paramKeys: () => [],
  // `$line.` inside a coordinate is drilled into the detail table by validate, the same predicate as the per-line primitives.
  lineFields: (p) =>
    [p.subject, p.scope, p.need].filter((r): r is EffectRef => r !== null && r.from === "line").map((r) => r.field),
  usesLines: (p) => p.perLine,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- primitive parameter types differ; the registry dispatches by name
const REGISTRY = new Map<string, Primitive<any>>(
  [
    fieldCompare,
    requiredFields,
    linesNotEmpty,
    linesEmpty,
    linesRequiredIfRefField,
    lineRefRequiredIf,
    recursiveRefFree,
    linesAll,
    linesAny,
    relatedAgg,
    invariantRelatedAgg,
    refFieldCompare,
    availableSufficient,
  ].map((p) => [
    p.name,
    p,
  ]),
);

export const PRIMITIVE_NAMES = [...REGISTRY.keys()] as readonly string[];

/** One rule declaration: `{ primitive: "field_compare", ...params }`. */
export interface RuleCheck {
  readonly primitive: string;
  readonly [param: string]: unknown;
}

export interface NormalizedCheck {
  readonly primitive: string;
  readonly params: unknown;
}

export function normalizeCheck(raw: unknown, label = "check"): NormalizedCheck {
  const obj = requireObject(raw, label);
  const name = requireText(obj["primitive"], `${label}.primitive`);
  const primitive = REGISTRY.get(name);
  if (!primitive) {
    schemaFail(`${label}.primitive "${name}" is unknown; choices: ${PRIMITIVE_NAMES.join(" / ")}`);
  }
  const { primitive: _drop, ...params } = obj;
  return { primitive: name, params: primitive.normalize(params, label) };
}

/**
 * Normalize a guard slot (`Precondition.when` / `Transition.when`): run
 * `normalizeCheck`, then reject any primitive that is not in `GUARD_PRIMITIVES`
 * at modeling time.
 */
export function normalizeGuardCheck(raw: unknown, label: string): NormalizedCheck {
  const check = normalizeCheck(raw, label);
  if (!(GUARD_PRIMITIVES as readonly string[]).includes(check.primitive)) {
    schemaFail(
      `${label} accepts only ${GUARD_PRIMITIVES.join(" / ")} (received "${check.primitive}"): ` +
        `applicability asks what shape this document itself has, which is a zero-IO comparison. ` +
        `A primitive that queries has two problems here: it pays a round trip for a gate that may not apply at all, ` +
        `and the false it returns when it cannot read a value flips, in a guard slot, into "this gate does not apply", ` +
        `so a guard that cannot read silently turns off the gate it guards (fail-open)`,
    );
  }
  return check;
}

export async function evaluateCheck(check: NormalizedCheck, ctx: RuleContext): Promise<CheckOutcome> {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return await primitive.evaluate(check.params, ctx);
}

/**
 * Evaluate a guard synchronously. Serves `GUARD_PRIMITIVES` only.
 *
 * Used by `visibleTransitions`: list, detail, and agent are synchronous paths.
 * A throw is fail-closed: if applicability cannot be judged, the edge is treated as absent.
 */
export function evaluateGuardOnBill(
  check: NormalizedCheck,
  billHeader: Readonly<Record<string, unknown>>,
): boolean {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive || !(GUARD_PRIMITIVES as readonly string[]).includes(check.primitive)) return false;
  try {
    const outcome = primitive.evaluate(check.params, {
      bill: billHeader,
      lines: [],
      params: {},
      actor: {},
      labels: { bill: {}, line: {}, param: {} },
      now: new Date(0),
      query: {
        get() { throw new Error("guard evaluation must not query the database"); },
        list() { throw new Error("guard evaluation must not query the database"); },
        balance() { throw new Error("guard evaluation must not query the database"); },
      },
    });
    if (typeof (outcome as Promise<CheckOutcome>).then === "function") return false;
    return (outcome as CheckOutcome).ok;
  } catch {
    return false;
  }
}

/**
 * Render a rule as a sentence. This is the capability an expression engine such as CEL cannot give.
 *
 * `labels` is required. `rule` (what the rule says) and `detail` (what this run
 * computed) sit next to each other on the screen. One saying `warehouseId` and
 * the other saying the warehouse label is read as two different things. Every
 * call site has a `ModuleSchema` (engine, operations, builder-explain). Compute
 * it with `fieldLabelsOf` from `labels.ts`. Do not cache it. It is a pure function.
 */
export function describeCheck(check: NormalizedCheck, labels: FieldLabels): string {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.describe(check.params, labels);
}

/** For static checks: which header fields of this module the rule references. */
export function checkBillFields(check: NormalizedCheck): readonly string[] {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.billFields(check.params);
}

/** For static checks: which actor keys the rule references. The predicate is the closed set ACTOR_KEYS. */
export function checkActorKeys(check: NormalizedCheck): readonly string[] {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.actorKeys(check.params);
}

/** For static checks: which parameter keys of this action the rule references. The predicate is the params this edge itself declares. */
export function checkParamKeys(check: NormalizedCheck): readonly string[] {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.paramKeys(check.params);
}

/** For static checks: which detail-line columns the rule references. The predicate is the column declaration of the module's single detail table. */
export function checkLineFields(check: NormalizedCheck): readonly string[] {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.lineFields(check.params);
}

/**
 * Whether this rule reads the detail-line set when it evaluates.
 *
 * The predicate is what the primitive reports (`usesLines`), not "does the
 * declaration mention `$line.`". The latter misses `lines_not_empty`: it
 * references no column and its whole judgment is the line set itself.
 */
export function checkUsesLines(check: NormalizedCheck): boolean {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  return primitive.usesLines(check.params);
}

export interface ExternalCheckField {
  readonly module: string;
  /** A header field, or `<subtable>.<column>`. */
  readonly field: string;
}

export interface CheckDependencies {
  readonly billFields: readonly string[];
  readonly lineFields: readonly string[];
  readonly actorKeys: readonly string[];
  readonly paramKeys: readonly string[];
  readonly externalFields: readonly ExternalCheckField[];
  readonly usesLines: boolean;
  /** The detail includes an existing ledger balance, not only an evaluation of fields this document can read. */
  readonly readsLedger: boolean;
}

/**
 * The complete read set of one rule. Authorization projection and declaration
 * checks share the field projections the primitive registry provides. They do
 * not parse `detail` text to guess whether it contains a sensitive value.
 */
export function checkDependencies(check: NormalizedCheck): CheckDependencies {
  const primitive = REGISTRY.get(check.primitive);
  if (!primitive) schemaFail(`primitive "${check.primitive}" is not registered`);
  const externalFields: ExternalCheckField[] = [];

  if (check.primitive === relatedAgg.name || check.primitive === invariantRelatedAgg.name) {
    const p = check.params as RelatedAggregation;
    externalFields.push({ module: p.from, field: p.through === null ? p.match : `${p.through}.${p.match}` });
    if (p.measure !== null) {
      externalFields.push({ module: p.from, field: p.through === null ? p.measure : `${p.through}.${p.measure}` });
    }
    for (const field of Object.keys(p.where ?? {})) externalFields.push({ module: p.from, field });
  } else if (check.primitive === refFieldCompare.name) {
    const p = check.params as ReferenceComparison;
    const at = (through: string | null, field: string): string => (through === null ? field : `${through}.${field}`);
    if (p.then !== null) {
      // Two hops report two cells. The cell along the way (the reference column
      // on the first hop's landing) is really read, and it shows up in detail
      // ("... field sourceOrderId points to ..."). Dropping a cell makes the
      // authorization projection believe the rule never read it, so a reference
      // that should have been stripped is still sent out.
      externalFields.push({ module: p.entity, field: at(p.through, p.then.field) });
      externalFields.push({ module: p.then.entity, field: at(p.then.through, p.field) });
    } else {
      externalFields.push({ module: p.entity, field: at(p.through, p.field) });
    }
  } else if (check.primitive === linesRequiredIfRefField.name) {
    const p = check.params as LinesRequiredIfRefFieldParams;
    externalFields.push({ module: p.entity, field: p.field });
  } else if (check.primitive === availableSufficient.name) {
    const p = check.params as AvailabilityParams;
    if (p.limit !== null) externalFields.push({ module: p.limit.entity, field: p.limit.field });
  }

  return {
    billFields: primitive.billFields(check.params),
    lineFields: primitive.lineFields(check.params),
    actorKeys: primitive.actorKeys(check.params),
    paramKeys: primitive.paramKeys(check.params),
    externalFields,
    usesLines: primitive.usesLines(check.params),
    readsLedger: check.primitive === availableSufficient.name,
  };
}

export const AVAILABILITY_PRIMITIVE = availableSufficient.name;

/**
 * The only carrier of "optional on a draft, required on submit" (see `transitionRequiredFieldsOf`).
 *
 * The name is taken from the registry, not typed again by a consumer. A second
 * copy of `"required_fields"` means renaming the primitive makes the projection
 * match nothing, quietly. The second-tier required signal disappears from the
 * screen, and nothing else was watching it. Same discipline as `AVAILABILITY_PRIMITIVE`.
 */
export const REQUIRED_FIELDS_PRIMITIVE = requiredFields.name;

/**
 * For static checks: is this rule an available-quantity comparison? If so, hand back its coordinates.
 *
 * Hand back the normalized shape. Do not make validate `as`-assert it. An
 * assertion copies the parameter structure into the gate. Rename a parameter
 * and the gate silently checks the wrong thing.
 */
export function availabilityOf(check: NormalizedCheck): AvailabilityParams | null {
  return check.primitive === availableSufficient.name ? (check.params as AvailabilityParams) : null;
}

/** Static checks and cross-module gates read the normalized metadata of `ref_field_compare`. */
export function referenceComparisonOf(check: NormalizedCheck): ReferenceComparison | null {
  return check.primitive === refFieldCompare.name ? (check.params as ReferenceComparison) : null;
}

/** Static checks and cross-module gates read the normalized metadata of the conditional detail-required primitive. */
export function linesRequiredIfRefFieldOf(check: NormalizedCheck): LinesRequiredIfRefFieldParams | null {
  return check.primitive === linesRequiredIfRefField.name
    ? (check.params as LinesRequiredIfRefFieldParams)
    : null;
}

/**
 * Static checks and cross-module gates read the normalized metadata of `related_agg`.
 *
 * Same rule as the two above: hand back the normalized shape. Do not let the
 * gate `as`-assert a copy of the parameter structure. After a copy, renaming a
 * parameter makes the gate check the wrong thing, and a gate that checks the
 * wrong thing does not error. It passes.
 */
export function relatedAggregationOf(check: NormalizedCheck): RelatedAggregation | null {
  return check.primitive === relatedAgg.name || check.primitive === invariantRelatedAgg.name
    ? (check.params as RelatedAggregation)
    : null;
}
