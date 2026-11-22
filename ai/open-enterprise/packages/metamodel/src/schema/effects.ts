// ---------------------------------------------------------------------------
// Transition.effects — posting side effects
//
// 🔴 Not a seventh concept: it lives on ③ Transition.
//
// Reversibility can be guaranteed automatically only when it is declarative: writing the forward direction forces writing which edge rolls it back, so static checks can reject
// a side effect with no exit. This is the same discipline as "route must have an exit", appearing twice —
// a thing with no exit must not exist.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { schemaFail } from "./common.js";
import { ledgerContract, ledgerLabel, ledgerOpSigns, listLedgerCodes } from "../normalize/ledger.js";

/**
 * A posting target is a code in the ledger catalog, not a closed enum inside the kernel.
 *
 * The product source of truth is `domains/ledgers/`, loaded through `activateLedgerCatalog`.
 * The read path recognizes only a catalog that is already loaded; when it is not loaded, `listLedgerCodes` / `ledgerDefinitionOf` report an error explicitly.
 */
export type EffectTarget = string;

/**
 * Operations. `reserve/release` is a commitment (an exposure that has not happened yet, such as a purchase commitment after a purchase order is approved),
 * and `in/out` is actual (a fact that has happened, such as an inventory increase and a payable confirmation after receipt).
 * When a commitment becomes actual, the commitment side releases and the actual side posts in — two postings, not one.
 */
export const EFFECT_OPS = ["reserve", "release", "in", "out"] as const;

export type EffectOp = (typeof EFFECT_OPS)[number];

/** The sign of this op on a ledger. Missing from the table means this ledger does not accept it, and the caller must pass the modeling-time gate first */
export function effectOpSign(target: EffectTarget, op: EffectOp): 1 | -1 {
  const sign = ledgerOpSigns(target)[op];
  // A missing value fails fast and is not given a default sign: a default would turn "this ledger did not define this op"
  // into a balance that looks plausible
  if (sign === undefined) {
    throw new Error(`ledger ${target} has no sign defined for op "${op}" — allowed: ${effectOpsOf(target).join(" / ")}`);
  }
  return sign;
}

/** Ops a ledger allows — derived from the sign table, not a separately maintained list */
export function effectOpsOf(target: EffectTarget): readonly EffectOp[] {
  const signs = ledgerOpSigns(target);
  return EFFECT_OPS.filter((op) => signs[op] !== undefined);
}

/**
 * The ops that post a positive sign on a ledger — the only criterion for a signed sum.
 *
 * 🔴 The reason it exists is that the sign convention once had four copies: the global `POSITIVE_OPS` in `ledgerRepo.ts`,
 * a second copy inlined in the same file, a third copy written as SQL text in `query/inventory.ts`
 * (`op in ('reserve','in')`, which never read that constant), and a fourth copy in the web `OP_META`.
 * The first three were all `('reserve','in')` that year, so the agreement was a coincidence, not something someone maintained.
 * After signs are tiered per ledger, one copy that is missed means the same coordinate is two numbers on two pages, and neither reports an error.
 *
 * So: anywhere that needs a signed sum calls this function. Do not write another op list in place.
 */
export function positiveEffectOps(target: EffectTarget): readonly EffectOp[] {
  const positive = effectOpsOf(target).filter((op) => effectOpSign(target, op) === 1);
  // An empty set is not a state that can continue as "this ledger has no positive tier": a signed sum would record every row as a minus
  // and return a confident negative number. A misconfigured sign table throws on the spot
  if (positive.length === 0) throw new Error(`ledger ${target} has no positive op — the sign table is misconfigured, and a signed sum is meaningless`);
  return positive;
}

/**
 * The database constraint name for a ledger `(target, op)`. Written into the migration / drizzle `check()` / the same-source gate, and only here.
 *
 * What stops an illegal combination must be the database, not a guard column on the read side: `op` is bare text, and the modeling-time gate cannot stop
 * a migration, a direct SQL connection, or a bare e2e insert. Adding `__unsignedOps` on the read side only discovers that a bad row is already stored,
 * and every fake executor test has to know that column.
 */
export const EFFECT_LEDGER_OP_SIGNED_CONSTRAINT = "oe_effect_ledger_op_signed";

/** The legal `(target, op)` pairs expanded from the sign table. The CHECK must allow exactly this set. One extra or one missing is drift. */
export function effectLedgerSignedPairs(): readonly { readonly target: EffectTarget; readonly op: EffectOp }[] {
  return listLedgerCodes().flatMap((target) => effectOpsOf(target).map((op) => ({ target, op })));
}

function sqlInLiterals(values: readonly string[]): string {
  // A closed enum, so there is no quote to escape. Literals are written so the migration text and the gate compare the same string.
  return values.map((value) => `'${value}'`).join(", ");
}

/**
 * Generate the CHECK predicate from the loaded ledger catalog.
 *
 * 🔴 This is the only generator of the constraint and the catalog. If SQL handwritten into a migration drifts from here,
 * the next time a commitment tier is added to a ledger: modeling time allows it, the insert is rejected by the database, and a posting that should succeed returns 500.
 * The gate compares one predicate in three places: the latest migration, the end-state snapshot, and this function.
 *
 * Grouped by "the set of allowed ops", so the same combination is not copied five times — the copied copy is the one that grows apart from the table.
 */
export function effectLedgerOpSignedCheckPredicate(): string {
  const groups = new Map<string, EffectTarget[]>();
  for (const target of listLedgerCodes()) {
    const key = effectOpsOf(target).join("\0");
    const list = groups.get(key) ?? [];
    list.push(target);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([opsKey, targets]) => {
      const ops = opsKey.split("\0");
      return `(target in (${sqlInLiterals(targets)}) and op in (${sqlInLiterals(ops)}))`;
    })
    .join(" or ");
}

/**
 * A signed-amount CASE, with no `else`. The only generator of the sum on the read path.
 *
 * It used to be `case when op in (positive tier) then amount else -amount end`. That `else`
 * read "an op this ledger did not define a sign for" as a confident negative number. After signs are looked up per ledger,
 * a global `('in','reserve')` is wrong for `stock` — the commitment tier is not defined on that ledger.
 *
 * `ledgerNetSum` (production) and the e2e `balanceSum` both go through here. Copying another op list is forbidden.
 */
export function ledgerNetCaseSql(target: EffectTarget): string {
  const ops = effectOpsOf(target);
  if (ops.length === 0) {
    throw new Error(`ledger ${target} has no op with a defined sign — a signed sum is meaningless`);
  }
  const branches = ops.map((op) => {
    const expr = effectOpSign(target, op) === 1 ? "amount" : "-amount";
    return `when op = ${sqlInLiterals([op])} then ${expr}`;
  });
  return `case ${branches.join(" ")} end`;
}

/**
 * Several ledgers: the outer layer dispatches by target to each ledger's own CASE.
 *
 * Used when upgrading an e2e query that does `group by target`. It is still the generator above,
 * not a second sign table — each ledger's branch is `ledgerNetCaseSql(target)`.
 */
export function ledgerNetCaseSqlFor(targets: readonly EffectTarget[]): string {
  if (targets.length === 0) {
    throw new Error("a signed sum must name at least one ledger");
  }
  if (targets.length === 1) {
    const only = targets[0];
    if (only === undefined) throw new Error("a signed sum must name at least one ledger");
    return ledgerNetCaseSql(only);
  }
  const branches = targets.map((target) => `when target = ${sqlInLiterals([target])} then ${ledgerNetCaseSql(target)}`);
  return `case ${branches.join(" ")} end`;
}

/** Op map for a reverse run: reserve↔release, in↔out. The reverseOn edge rolls back by this table */
export const EFFECT_REVERSE_OPS: Readonly<Record<EffectOp, EffectOp>> = Object.freeze({
  reserve: "release",
  release: "reserve",
  in: "out",
  out: "in",
});

/**
 * Groupable dimensions of a ledger. Closed: they are the ledger's own columns, not module fields.
 *
 * A ledger and a document are two kinds of fact: the queryable fields of a document are declared by each module (call `module_describe` first when the fields are uncertain;
 * a verified narrow Skill may call `bill_list` directly),
 * and the columns of a ledger are fixed by the framework, so this list can be written down at modeling time and projected straight into the tool-surface enum.
 * One missing dimension is not "not supported yet". It is "this question has no answer on the ledger" — `amount` is not in this list,
 * because it is the quantity being aggregated, not an axis to group by.
 */
export const LEDGER_DIMENSIONS = [
  "subjectId",
  "scopeId",
  "op",
  "sourceModule",
  "transitionCode",
  "postingPeriod",
] as const;
export type LedgerDimension = (typeof LEDGER_DIMENSIONS)[number];

/**
 * Ledger measures.
 *
 * 🔴 `net` and `sum` are two different questions. Mixing them silently gives the wrong number:
 *   · `net` sums with a sign by the direction of `EFFECT_OPS` (reserve/in positive, release/out negative) — that is the balance;
 *   · `sum` ignores direction and adds the amounts — use it with `where.op=out` when asking "how much went out in these 90 days".
 * Using `sum` on a set that was not narrowed by op yields "the total of ins and outs", and that number has no business reading.
 *
 * `last_occurred_at` answers "when was the last time" — the truth of questions like "how long since it moved" is here.
 * A balance cannot answer that: a balance only says how much there is now, not which day the previous posting was.
 */
export const LEDGER_MEASURE_FNS = ["net", "sum", "count", "last_occurred_at"] as const;
export type LedgerMeasureFn = (typeof LEDGER_MEASURE_FNS)[number];

/**
 * A normalized amount.
 *
 * The difference from the previous generation: there the normalized value was still `number | string`, and every evaluation re-parsed the string with a regex
 * — the same grammar implemented in two places, and drift is a silent wrong ledger. Here it is parsed once at normalize time, and downstream only looks it up.
 *
 * The grammar is deliberately closed (a numeric literal, or a single `{headerField}` reference). Closed is what lets a static check know whether the reference exists.
 * 🔴 Payload expressions are not recognized: a posting amount must come from a fact already stored, not from a value brought in by this request.
 */
export type EffectAmount =
  | { readonly kind: "literal"; readonly value: number }
  | { readonly kind: "field"; readonly from: EffectFrom; readonly field: string };

/**
 * Where the value comes from: the header, or a line.
 *
 * The line tier was forced by inventory: one outbound document ships three products,
 * and the sentence "inventory decreases by 100" cannot hold at the header — 100 of which product?
 * So an inventory posting must expand per line, and per line it must be able to reference a field on the line.
 */
export const EFFECT_FROMS = ["bill", "line"] as const;
export type EffectFrom = (typeof EFFECT_FROMS)[number];

/** A reference to one field. The prefix is closed (`$bill.` / `$line.`), the same spelling as an operand of a rule primitive. */
export interface EffectRef {
  readonly from: EffectFrom;
  readonly field: string;
}

export interface Effect {
  readonly target: EffectTarget;
  readonly op: EffectOp;
  /**
   * Whose account this posting is on. Written `$bill.customerId` / `$line.productId`.
   *
   * 🔴 It must be declared explicitly. The framework does not guess it from the target. The guessing scheme ("find the field whose ref is customer")
   * has no answer when a module has two customer references (the invoicing party / the receiving party), and `explain` cannot say it —
   * a posting that cannot say whose account it is on cannot be reconciled afterwards.
   */
  readonly subject: EffectRef;
  /** The second dimension. Only stock has one (the warehouse). Every other target must be null */
  readonly scope: EffectRef | null;
  readonly amount: EffectAmount;
  /**
   * Edges that can undo this side effect. Multi-valued: one reservation often has more than one undo path —
   * the payable exposure of a purchase order is released by unapproval, and it is also released when receipt completes.
   *
   * A single value forces two bad outcomes: either invent a rollback edge that does not exist in the business just to pass validation, or declare only one of them
   * and silently miss the ledger on the remaining paths. The latter is the hidden variant of "added on approval, forgot to subtract on unapproval".
   *
   * An empty array is the same as not writing it, and the semantic gate EFFECT_REVERSE_MISSING reports it — the shape layer does not block, so the validation report
   * can list every problem at once instead of stopping at the first throw.
   */
  readonly reverseOn: readonly string[];
  /**
   * Whether it expands into several ledger rows per line. Derived, not declared.
   *
   * The criterion: if `$line.` appears in subject / scope / amount, this side effect is per line.
   * It is not given its own `per: 'lines'` key, because that would immediately produce a kind of declaration that can contradict itself
   * (`per: 'bill'` while referencing `$line.qty`), and the validator could only reject it afterwards — a derived property does not have that problem.
   */
  readonly perLine: boolean;
}

const AMOUNT_BILL_REF = /^\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}$/;
const AMOUNT_LINE_REF = /^\{\s*\$line\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}$/;
const AMOUNT_LITERAL = /^-?\d+(\.\d+)?$/;

function parseAmount(raw: unknown, label: string): EffectAmount {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) schemaFail(`${label}.amount is not a finite number`);
    return { kind: "literal", value: raw };
  }
  if (typeof raw !== "string" || !raw.trim()) {
    schemaFail(`${label}.amount must be a number, '{headerField}', or '{$line.lineField}'`);
  }
  const trimmed = raw.trim();
  const line = AMOUNT_LINE_REF.exec(trimmed);
  if (line?.[1]) return { kind: "field", from: "line", field: line[1] };
  // A bare `{field}` is the header. `{$bill.field}` is deliberately not offered as a synonym —
  // two spellings of the same thing make an AI guess which one to use every time
  const bill = AMOUNT_BILL_REF.exec(trimmed);
  if (bill?.[1]) return { kind: "field", from: "bill", field: bill[1] };
  if (AMOUNT_LITERAL.test(trimmed)) return { kind: "literal", value: Number(trimmed) };
  return schemaFail(`${label}.amount "${raw}" is illegal: only a numeric literal, '{headerField}', or '{$line.lineField}' is supported`);
}

const EFFECT_REF = /^\$(bill|line)\.([a-zA-Z_][a-zA-Z0-9_]*)$/;

function parseRef(raw: unknown, label: string): EffectRef {
  if (typeof raw !== "string" || !raw.trim()) {
    schemaFail(`${label} must be '$bill.field' or '$line.field'`);
  }
  const hit = EFFECT_REF.exec(raw.trim());
  if (!hit?.[1] || !hit[2]) {
    schemaFail(`${label} "${String(raw)}" is illegal: the form is '$bill.field' or '$line.field' (the prefix is closed, and the validator looks up the reference from it)`);
  }
  return { from: hit[1] as EffectFrom, field: hit[2] };
}

/**
 * The shape layer. `strictObject` owns key closure (adding a key to an effect is adding a concept, and it must pass the gate first);
 * enums and semantics are left to normalizeEffect below, because the error must be able to point at a path (which edge, which effect),
 * and only the caller knows the path.
 */
const EffectShape = z.strictObject({
  target: z.unknown(),
  op: z.unknown(),
  // All marked optional so the shape layer lets them through, and a missing one is reported by normalizeEffect —
  // the shape layer can only say "the declaration is illegal". It cannot say "subject is missing, and this posting must be on the customer's account"
  subject: z.unknown().optional(),
  scope: z.unknown().optional(),
  amount: z.unknown(),
  reverseOn: z.unknown().optional(),
});

function requireDeclText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) schemaFail(`${label} must be a non-empty string`);
  return value.trim();
}

/** Normalize one side-effect declaration. Key closure, the closed target/op enums, and the amount grammar fail fast here. */
export function normalizeEffect(raw: unknown, label = "effect"): Effect {
  const shaped = EffectShape.safeParse(raw);
  if (!shaped.success) {
    const unknownKey = shaped.error.issues.find((i) => i.code === "unrecognized_keys");
    if (unknownKey && "keys" in unknownKey) {
      schemaFail(
        `${label} unknown key "${(unknownKey.keys as string[]).join(", ")}": only target / op / subject / scope / amount / reverseOn allowed`,
      );
    }
    schemaFail(`${label} effect declaration is illegal: ${JSON.stringify(raw)}`);
  }
  const { target, op, subject, scope, amount, reverseOn } = shaped.data;

  const targets = listLedgerCodes();
  if (!targets.includes(target as EffectTarget)) {
    schemaFail(`${label}.target "${String(target)}" is unknown; allowed: ${targets.join(" / ")} (closed enum; unknown values are rejected)`);
  }
  if (!EFFECT_OPS.includes(op as EffectOp)) {
    schemaFail(`${label}.op "${String(op)}" is unknown; allowed: ${EFFECT_OPS.join(" / ")} (closed enum; unknown values are rejected)`);
  }

  const codes: string[] = [];
  if (reverseOn !== undefined && reverseOn !== null) {
    const declared = Array.isArray(reverseOn) ? reverseOn : [reverseOn];
    declared.forEach((code, index) => {
      const at = Array.isArray(reverseOn) ? `${label}.reverseOn[${index}]` : `${label}.reverseOn`;
      const text = requireDeclText(code, at);
      // Writing the same edge twice doubles the reverse posting, and there is no legal reading — the shape layer rejects it
      if (codes.includes(text)) schemaFail(`${at} declared rollback edge "${text}" more than once`);
      codes.push(text);
    });
  }

  // 🔴 The legal target × op pairs sit at the same layer as the target × scope arity: both look only at these two values
  // and need no module context, so they also throw at normalize time (checking again in validate is dead code)
  const allowedOps = effectOpsOf(target as EffectTarget);
  if (!allowedOps.includes(op as EffectOp)) {
    schemaFail(
      `${label}: the ${target} ledger does not accept op "${String(op)}"; allowed: ${allowedOps.join(" / ")}. ` +
        `The commitment tier of inventory (reserve / release) has no defined sign on this ledger — an inventory balance is the quantity on hand, ` +
        `and a reservation should make available smaller (a minus sign), while reserve on ap / ar / gl makes the exposure larger (a plus sign). ` +
        `Posting without a sign has the net effect "reserve one amount and available goes up", ` +
        `and available_sufficient reads exactly this balance, with zero symptoms the whole way. ` +
        `To express "this batch of goods is already taken", the practice today is a business status (document status / an accumulated gate), not a stock reserve posting`,
    );
  }

  const contract = ledgerContract(target as EffectTarget);
  if (subject === undefined || subject === null) {
    schemaFail(
      `${label}.subject is missing: the ${target} ledger must be posted to ${contract.subject}, written like '$bill.customerId' — ` +
        `a posting that cannot say whose account it is on cannot be reconciled afterwards`,
    );
  }
  const parsedSubject = parseRef(subject, `${label}.subject`);
  const parsedScope = scope === undefined || scope === null ? null : parseRef(scope, `${label}.scope`);

  // Only inventory has a scope. Posting a "warehouse" on receivables has no reading, and allowing it would let each module post its own
  if (contract.scope === null && parsedScope) {
    schemaFail(`${label}.scope: the ${target} ledger is one-dimensional and does not accept scope (only stock needs to land in a warehouse)`);
  }
  if (contract.scope !== null && !parsedScope) {
    schemaFail(
      `${label}.scope is missing: the ${target} ledger must land on ${contract.scope}, or "how much is in which warehouse" has no answer — ` +
        `written like '$bill.warehouseId'`,
    );
  }

  const parsedAmount = parseAmount(amount, label);
  const perLine =
    parsedSubject.from === "line" || parsedScope?.from === "line" || (parsedAmount.kind === "field" && parsedAmount.from === "line");

  // 🔴 When expanding per line, the amount must also come from the line. Otherwise N lines each post the header total,
  // and the ledger multiplies by N — while each row looks like one legal ledger line and is very hard to find afterwards
  if (perLine && !(parsedAmount.kind === "field" && parsedAmount.from === "line")) {
    schemaFail(
      `${label}: subject/scope referenced $line, so this effect expands per line, ` +
        `and amount must also come from the line (for example '{$line.qty}') — otherwise each line posts the header amount and the ledger would double`,
    );
  }

  return {
    target: target as EffectTarget,
    op: op as EffectOp,
    subject: parsedSubject,
    scope: parsedScope,
    amount: parsedAmount,
    reverseOn: Object.freeze(codes),
    perLine,
  };
}

/**
 * The English name of a posting operation. The ledger name goes through `ledgerLabel` (the loaded catalog). The kernel does not keep a second TARGET_TEXT.
 */
export const OP_TEXT: Readonly<Record<EffectOp, string>> = Object.freeze({
  reserve: "Reserve",
  release: "Release",
  in: "Increase",
  out: "Decrease",
});

/**
 * Render one side-effect declaration as plain words.
 *
 * 🔴 A person and a model read the same copy: the posting preview on the screen and the consequence text in the agent tool catalog
 * both come from here. Writing each their own copy makes the tool description and the real behavior evolve apart, and nobody notices the drift —
 * that is how the `desc` of the previous generation's 33 handwritten tools came loose from the executor.
 */
export function describeEffect(effect: Effect): string {
  const amount =
    effect.amount.kind === "literal" ? String(effect.amount.value) : `${effect.amount.field}`;
  const per = effect.perLine ? "per line" : "";
  const subject = `posted to ${effect.subject.field}`;
  const scope = effect.scope ? ` × ${effect.scope.field}` : "";
  return `${ledgerLabel(effect.target)} ${OP_TEXT[effect.op]} ${amount}${per ? ` (${per})` : ""} ${subject}${scope}`;
}

/** A preview result: one ledger row. The amount and the subject have both been resolved against the given document. */
export interface ResolvedEffect {
  readonly target: EffectTarget;
  readonly op: EffectOp;
  readonly amount: number;
  /** Which kind of entity the posting hangs on (the subject from the loaded catalog, not a guess) */
  readonly subjectType: string;
  readonly subjectId: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  /** Which line when expanded per line (from 0); null for a header-level posting */
  readonly lineIndex: number | null;
  readonly reverseOn: readonly string[];
}

// 🔴 A failure on the evaluation path always goes through SchemaError (`schemaFail`), not a bare Error:
// "this document's customerId is empty" is the caller's mistake, and the HTTP layer routes by type to 400.
// A bare Error falls into the 500 tier, so half of the same kind of incomplete-document error is recorded as a server fault,
// and alert noise covers a real server bug. Same practice as coordId / numeric in `primitives.ts`.
function pickNumber(row: Readonly<Record<string, unknown>>, field: string, label: string): number {
  const raw = row[field];
  const value = Number(raw);
  // A posting amount has no reading of "default 0": a posting whose amount cannot be read, recorded as 0, is worse than not recording it —
  // it makes the balance look as if it was computed
  if (raw === undefined || raw === null || raw === "" || !Number.isFinite(value)) {
    schemaFail(`${label}.amount referenced "${field}", which has no value or is not a number, so it cannot be previewed`);
  }
  return value;
}

function pickId(row: Readonly<Record<string, unknown>>, ref: EffectRef, label: string, what: string): string {
  const raw = row[ref.field];
  if (typeof raw !== "string" || !raw) {
    schemaFail(`${label}.${what} referenced "$${ref.from}.${ref.field}", which has no value — this posting cannot be attached to a concrete ${what}, so posting is refused`);
  }
  return raw;
}

/**
 * Resolve the ledger rows one side effect will write for a given document. A pure function, zero writes.
 *
 * 🔴 It returns an array: one `stock out` declaration on an outbound document with three lines is three ledger rows.
 * One ledger row can belong to only one product — combining the outbound of three products into one row
 * means "how much of this product is left" can never be computed, and once combined it can never be split apart.
 */
export function resolveEffect(
  effect: Effect,
  bill: Readonly<Record<string, unknown>>,
  lines: readonly Readonly<Record<string, unknown>>[],
  label: string,
): readonly ResolvedEffect[] {
  const contract = ledgerContract(effect.target);
  const rowFor = (ref: EffectRef, line: Readonly<Record<string, unknown>> | null): Readonly<Record<string, unknown>> => {
    if (ref.from === "bill") return bill;
    if (!line) schemaFail(`${label}: $line was referenced but there is no line context`);
    return line;
  };

  const build = (line: Readonly<Record<string, unknown>> | null, lineIndex: number | null): ResolvedEffect => ({
    target: effect.target,
    op: effect.op,
    amount:
      effect.amount.kind === "literal"
        ? effect.amount.value
        : pickNumber(rowFor({ from: effect.amount.from, field: effect.amount.field }, line), effect.amount.field, label),
    subjectType: contract.subject,
    subjectId: pickId(rowFor(effect.subject, line), effect.subject, label, "subject"),
    scopeType: contract.scope,
    scopeId: effect.scope ? pickId(rowFor(effect.scope, line), effect.scope, label, "scope") : null,
    lineIndex,
    reverseOn: effect.reverseOn,
  });

  if (!effect.perLine) return [build(null, null)];
  if (!lines.length) {
    schemaFail(`${label}: this effect expands per line, but the document has no lines — an empty document should not reach posting`);
  }
  return lines.map((line, i) => build(line, i));
}

/** Preview of the reverse run (the ledger when walking the reverseOn edge): op is inverted by EFFECT_REVERSE_OPS, and the amount is the same source. */
export function reverseOf(resolved: ResolvedEffect): ResolvedEffect {
  return { ...resolved, op: EFFECT_REVERSE_OPS[resolved.op] };
}
