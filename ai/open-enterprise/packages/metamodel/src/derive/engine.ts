// ---------------------------------------------------------------------------
// State-machine engine — evaluate, do not execute
//
// The engine returns a plan, and the server executes it. That boundary gives three abilities:
//   · preview  — "what happens if this is pressed" can be computed for the user without writing the database
//   · test     — zero IO, so a unit test needs no database
//   · offline  — the builder CLI has no connection and can still compute buttons and rules
//
// The previous engine called loadRawStore() itself to find data, and had none of the three.
// ---------------------------------------------------------------------------

import { SchemaError, schemaFail } from "../schema/common.js";
import { resolveEffect, reverseOf, type ResolvedEffect } from "../schema/effects.js";
import { isSystemSupplied } from "../schema/fields.js";
import { transitionAction, type Occupancy, type Transition } from "../schema/lifecycle.js";
import type { ModuleSchema } from "../schema/module.js";
import { fail, PASS, resolvePreconditions, worst, type Precondition, type PreconditionResult } from "../schema/preconditions.js";
import { fieldLabelsOf } from "./labels.js";
import { checkUsesLines, describeCheck, evaluateCheck, evaluateGuardOnBill, type RuleContext } from "./primitives.js";
import { normalizeTransitionParams } from "../validate/instance.js";

/** Edges that can be pressed in the current status. Buttons are derived 100% from here — there is no "custom operation" entrance. */
export function availableTransitions(module: ModuleSchema, status: string): readonly Transition[] {
  return module.lifecycle.transitions.filter((t) => t.from === status && t.internal !== true);
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Whether the remaining-quantity coordinate lets this edge appear. `availableTransitions`
 * still recognizes status only. Hiding the button is the remaining-quantity's job.
 * It must not fall back to block (that band greys the button out and says why).
 *
 * A line remaining-quantity is allowed when `bill.lines` is absent: a list row has no
 * child table, and missing data is not the same as already shipped in full.
 *
 * Alongside `transitionWhenAllows`: remaining governs quantity, when governs shape.
 */
export function transitionRemainingAllows(
  edge: Transition,
  bill: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines?: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  },
): boolean {
  const remaining = edge.remaining;
  if (remaining === null || remaining === undefined) return true;
  const dot = remaining.indexOf(".");
  if (dot < 0) return isPositiveNumber(bill.header[remaining]);
  const table = remaining.slice(0, dot);
  const column = remaining.slice(dot + 1);
  const rows = bill.lines?.[table];
  if (rows === undefined) return true;
  return rows.some((row) => isPositiveNumber(row[column]));
}

/**
 * Build the initial action parameters from this document's lines, following billLines.seed.
 * An edge with no seed returns null, and the caller keeps the blank draft. With a seed,
 * only parameter keys that were declared are returned.
 */
export function seedTransitionParams(
  edge: Transition,
  bill: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  },
): Readonly<Record<string, unknown>> | null {
  const seeded: Record<string, unknown> = {};
  let any = false;
  for (const param of edge.params) {
    if (param.type !== "billLines" || param.seed === null || param.seed === undefined) continue;
    const spec = param.seed;
    const rows = bill.lines[spec.from] ?? [];
    const skipField = spec.skipNonPositive;
    seeded[param.key] = rows.flatMap((row) => {
      if (skipField !== null) {
        const skip = row[skipField];
        if (typeof skip !== "number" || !Number.isFinite(skip) || skip <= 0) return [];
      }
      const next: Record<string, unknown> = {};
      for (const [column, fromField] of Object.entries(spec.columns)) {
        next[column] = fromField === "id" ? row["id"] : row[fromField];
      }
      return [next];
    });
    any = true;
  }
  return any ? seeded : null;
}

/**
 * Applicability of an edge: the edge exists for this kind of document only when `when` holds.
 * No when means it exists unconditionally in that status.
 *
 * A thrown evaluation fails closed (the edge is hidden). Alongside remaining, not folded into one expression.
 */
export function transitionWhenAllows(
  edge: Transition,
  header: Readonly<Record<string, unknown>>,
): boolean {
  if (edge.when === null || edge.when === undefined) return true;
  return evaluateGuardOnBill(edge.when, header);
}

/**
 * Visible set: `availableTransitions(status, non-internal) ∩ remaining>0 ∩ when holds`.
 *
 * Detail, agent, and list share this when row data is present. It stays synchronous: `field_compare.evaluate` is synchronous itself.
 */
export function visibleTransitions(
  module: ModuleSchema,
  status: string,
  bill: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines?: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  },
): readonly Transition[] {
  return availableTransitions(module, status).filter(
    (edge) => transitionRemainingAllows(edge, bill) && transitionWhenAllows(edge, bill.header),
  );
}

/**
 * Resolve the one edge for (module, current status, action code). This is the only way in the repo to find an edge from a code.
 *
 * An edge's identity is `(code, from)`. The front end and the agent submit only the action
 * code. They never pick an edge by status. The server resolves it from the document's
 * current status. If it cannot resolve, it refuses in the language of the job and says
 * what can be done now. Saying only "this cannot be taken" makes the caller (especially
 * an agent) think it remembered the document id wrong, so it looks the document up again,
 * retries, and hits the same wall. The action name is followed by the code in parentheses for the agent.
 *
 * Call this before any ledger, rule, or candidate IO. An action whose status does not match should not read the reverse ledger first.
 */
export function transitionAt(module: ModuleSchema, status: unknown, code: string): Transition {
  if (typeof status !== "string" || !status) schemaFail("Document has no status, so it cannot be evaluated");
  const edge = module.lifecycle.transitions.find((candidate) => candidate.code === code && candidate.from === status);
  if (edge) return edge;
  const state = module.lifecycle.statuses.find((candidate) => candidate.key === status);
  if (!state) schemaFail(`"${module.label}" has no status "${status}"`);
  const now = availableTransitions(module, status);
  const next = now.length === 0
    ? "This document has no actions available right now."
    : `What can be done now: ${now.map((t) => `"${t.action}" (${t.code})`).join(", ")}.`;
  const action = transitionAction(module.lifecycle, code);
  if (action === null) {
    schemaFail(`"${module.label}" has no action "${code}". ${next}`);
  }
  schemaFail(`This document is "${state.label}" and cannot "${action.action}" (${code}). ${next}`);
}

/**
 * Whether this action has an edge in this status. The test is `transitionAt`: if it resolves, the edge exists.
 *
 * For gates at the declaration layer (whether a flow connects, whether a route exit shares the start): they want a yes or no, not the refusal sentence.
 */
export function hasTransitionAt(module: ModuleSchema, status: string, code: string): boolean {
  try {
    transitionAt(module, status, code);
    return true;
  } catch (error: unknown) {
    if (error instanceof SchemaError) return false;
    throw error;
  }
}

/**
 * Every edge of one action (one per start status), in declaration order.
 *
 * Use this only when there is no document status in hand and the question is "which
 * statuses can this action leave, and which statuses does it land in": whether a flow
 * connects, whether a route exit shares the start, which statuses a push origin covers,
 * and listing the catalog by edge. When a document status is in hand and one concrete
 * edge is needed, go only through `transitionAt`.
 *
 * Throws if the module has no such action. Ask existence with `transitionAction` first, then ask for the edges.
 */
export function transitionEdges(module: ModuleSchema, code: string): readonly Transition[] {
  const edges = module.lifecycle.transitions.filter((edge) => edge.code === code);
  if (edges.length === 0) schemaFail(`"${module.label}" has no action "${code}"`);
  return edges;
}

/**
 * "How to get to this status". The mirror of `availableTransitions`: that one asks "standing here, where can I go", and this one asks "to stand here, where must I press what first".
 */
export interface StatusApproach {
  readonly status: string;
  /** Edges that turn a record into `status`. An empty array means it cannot be reached (initial status, or it can only be produced by a push / a direct seed insert). */
  readonly transitions: readonly Transition[];
}

/**
 * Which edges turn a record into these statuses.
 *
 * It exists because of a cross-module gap: `refFilter` can say "this cell may only
 * pick status ∈ inProgress", but it cannot say where to go to make it in progress.
 * The user reads "please pick another one", and there is no second one to pick —
 * what actually has to happen is to open that record on the target module and press
 * a button once. This information has always been inferable (in the target module's
 * state machine, which edge has `to` equal to the required status). Nobody had computed it.
 *
 * A self-loop does not count (`from === to`): it cannot move a record that is not
 * there yet. Reporting it as "go press this" sends the person to a button they cannot press now.
 *
 * An unrecognized status name returns empty. It does not throw. This derivation is for
 * copy, and "is the refFilter condition value a legal status of the target module" is
 * checked by `checkCrossReferences` at build time. Throwing again here only turns an
 * error that should be red at modeling time into a 500 at runtime.
 */
export function transitionsReaching(
  module: ModuleSchema,
  statuses: readonly string[],
): readonly StatusApproach[] {
  return statuses.map((status) => ({
    status,
    transitions: module.lifecycle.transitions.filter((t) => t.to === status && t.from !== t.to && t.internal !== true),
  }));
}

/** Which fields the user may fill when creating. The state machine constrains records already stored, not the first write. */
export function creatableFields(module: ModuleSchema): readonly string[] {
  return module.fields.filter((field) => !isSystemSupplied(field, module.fields)).map((field) => field.key);
}

/** Which stored fields can be changed in the current status. The Edit / Save button is derived from this. It is not configured separately. */
export function editableFields(module: ModuleSchema, status: string): readonly string[] {
  const state = module.lifecycle.statuses.find((s) => s.key === status);
  if (!state) schemaFail(`Unknown status "${status}"`);
  if (state.editable === "none") return [];
  const writable = creatableFields(module);
  if (state.editable === "full") return writable;
  const whitelist = state.editableFields ?? [];
  return writable.filter((k) => whitelist.includes(k));
}

/**
 * Code convention for occupancy edges. Do not add `kind` to MODULE_KEYS: leave / return recognize only disable / enable.
 *
 * A leave edge has from = in use, to = exited. A return edge does not take part in
 * occupancy classification. It only takes part in the audit exemption (disable, then
 * enable, then disable again: those occupancy-state audit rows are still not required to be kept).
 */
export const OCCUPANCY_LEAVE_CODES = ["disable"] as const;
export const OCCUPANCY_RETURN_CODES = ["enable"] as const;
export const OCCUPANCY_TRANSITION_CODES = [
  ...OCCUPANCY_LEAVE_CODES,
  ...OCCUPANCY_RETURN_CODES,
] as const;

export type OccupancyLeaveCode = (typeof OCCUPANCY_LEAVE_CODES)[number];
export type OccupancyReturnCode = (typeof OCCUPANCY_RETURN_CODES)[number];
export type OccupancyTransitionCode = (typeof OCCUPANCY_TRANSITION_CODES)[number];

export function isOccupancyLeaveCode(code: string): code is OccupancyLeaveCode {
  return (OCCUPANCY_LEAVE_CODES as readonly string[]).includes(code);
}

export function isOccupancyReturnCode(code: string): code is OccupancyReturnCode {
  return (OCCUPANCY_RETURN_CODES as readonly string[]).includes(code);
}

export function isOccupancyTransitionCode(code: string): code is OccupancyTransitionCode {
  return (OCCUPANCY_TRANSITION_CODES as readonly string[]).includes(code);
}

/**
 * Where the current status sits on the occupancy axis. Recognition looks only at from / to of occupancy leave edges. It does not branch on module code.
 *
 * When the same status is the from of one leave edge and the to of another, from / in-use wins:
 * if it is still standing on a cell it can leave, it is still in use.
 */
export function occupancyOf(module: ModuleSchema, status: string): Occupancy {
  const state = module.lifecycle.statuses.find((s) => s.key === status);
  if (!state) schemaFail(`Unknown status "${status}"`);
  if (state.occupancy === "in-use" || state.occupancy === "retired" || state.occupancy === "none") {
    return state.occupancy;
  }
  const leaves = module.lifecycle.transitions.filter((edge) => isOccupancyLeaveCode(edge.code));
  if (leaves.some((edge) => edge.from === status)) return "in-use";
  if (leaves.some((edge) => edge.to === status)) return "retired";
  return "none";
}

/**
 * Master file / master data. The repo has no module kind: a single state (`singleState`) or occupancy (disable/enable).
 * Every status of a document has occupancy none.
 */
export function isMasterDataModule(module: ModuleSchema): boolean {
  if (module.lifecycle.statuses.length === 1) return true;
  return module.lifecycle.statuses.some((status) => occupancyOf(module, status.key) !== "none");
}

/** The occupancy leave edge on the current status (disable / leave employment). Null when there is none. The caller decides how to say that. */
export function occupancyLeaveFrom(module: ModuleSchema, status: string): Transition | null {
  return module.lifecycle.transitions.find((edge) => isOccupancyLeaveCode(edge.code) && edge.from === status) ?? null;
}

/**
 * When occupancy is retired, audit left by occupancy edges does not count as required to keep. An unrecognized edge fails closed and counts as required to keep.
 * Document / in use: audit in any status blocks deletion — that layer is not relaxed here.
 */
export function occupancyAuditBlocksRemoval(occupancy: Occupancy, transitionCode: string): boolean {
  if (occupancy !== "retired") return true;
  if (transitionCode === "") return true;
  return !isOccupancyTransitionCode(transitionCode);
}

/**
 * Can this record be deleted in the current status — the declaration-layer half.
 *
 * Occupancy (master data) and a document are not the same life:
 *
 *   · `in-use`  — enabled / employed. New business may reference it, so it cannot be deleted. The public action is disable / leave employment.
 *   · `retired` — disabled / left employment. The declaration layer allows a master file that can be created by hand. References / required audit trail are checked by
 *     `assertRemovable`. A pure push product (`creatable.manual === false`) still cannot be deleted.
 *   · `none`    — a draft or a document. Keep the old rule: `status.initial && creatable.manual`.
 *     Never having left the initial status means no status edge has been walked. A fact that has already moved must be undone by withdraw / void / reversal.
 *     Delete would erase that history with it. A document that can only be produced by an upstream push, once deleted, is gone for good.
 *
 * The criterion is not `editable === "full"`. That asks "can the fields still be changed". Borrowed to answer
 * "can this be deleted", it answered wrong in both directions, and the symptoms were opposite:
 *
 *   · `product.active` is `editable: "whitelist"` (it prevents changing the code / unit after the goods are in use),
 *     so a mis-created product with zero references also cannot be deleted — while the occupancy rule wants disable first, then delete.
 *   · `stockOut.rejected` does not set `editable`, so it defaults to `full`, so the delete button renders, but it has already moved,
 *     and the server must refuse, so the button is present and pressing it must fail.
 *
 * This is the only declaration-layer criterion. The kernel tool catalog (`operationsFor`), the agent's operation contract,
 * the delete button in the UI, and the server's `deleteBill` all share it.
 *
 * The precise half still lives in the server's `assertRemovable` (cross-module references / ledger / non-occupancy audit / push lineage).
 * It has to query the database, which the declaration layer cannot see — so this layer does not repeat that work.
 * Do not cut this layer away and leave only `assertRemovable` either: a "completed" document built by seed data inserted straight into the database
 * has no audit trail, and the runtime half alone would judge it deletable.
 */
export function deletableIn(module: ModuleSchema, status: string): boolean {
  const state = module.lifecycle.statuses.find((s) => s.key === status);
  if (!state) schemaFail(`Unknown status "${status}"`);
  const occupancy = occupancyOf(module, status);
  if (occupancy === "in-use") return false;
  if (occupancy === "retired") return module.creatable.manual;
  return state.initial && module.creatable.manual;
}

/**
 * "This document cannot be deleted, so how is it closed out" — actions on the current status that can stand in for delete (button copy).
 *
 * The criteria come entirely from the declaration. They do not recognize any action code:
 *   1. Prefer edges that leave this status, land in a terminal status, and are neither the primary action nor a system edge (cancel / void / disable).
 *      The primary action moves the flow forward. It is not retirement. After a stock-out is marked terminal, "confirm stock-out" also lands in a terminal status.
 *      It must not be recommended as a substitute for delete. internal is only for a cascading Planner. It is not a button on the current document.
 *   2. Otherwise: an edge that lands in a parking space — the target is not editable, is not terminal, and its outgoing edges are non-empty and all point back to this status.
 *
 * An empty array means this document has no close-out entrance. The caller says "please contact an administrator" as it is, and does not invent a button name.
 */
export function retirementExitsOf(module: ModuleSchema, status: string): readonly string[] {
  const byKey = new Map(module.lifecycle.statuses.map((s) => [s.key, s]));
  const out = availableTransitions(module, status);
  const terminal = out.filter((t) => t.primary !== true && byKey.get(t.to)?.terminal === true);
  if (terminal.length) return terminal.map((t) => t.action);

  return out
    .filter((t) => {
      const to = byKey.get(t.to);
      if (!to || to.terminal || to.editable !== "none") return false;
      const onward = module.lifecycle.transitions.filter((x) => x.from === t.to);
      // Outgoing edges are non-empty and all point back, so it is a parking space and not the next cell of the flow.
      return onward.length > 0 && onward.every((x) => x.to === status);
    })
    .map((t) => t.action);
}

/** Any status has `editable !== "none"`. An empty status list is false. A missing status is not treated as editable. */
export function hasEditableStatus(module: ModuleSchema): boolean {
  return module.lifecycle.statuses.some((status) => status.editable !== "none");
}

/**
 * Can be created by hand, `capabilities.create === "system"`, or a push / pick-document after assembly can produce data.
 * When `manual` is true, `pushedFrom` is not read. `"system"` also returns true when `manual` is false and `pushedFrom` is still null.
 * `manual` false, create not `"system"`, and `pushedFrom` still null means the assembly step was skipped. It must not be treated as "there is no push origin".
 */
export function hasCreatePath(module: ModuleSchema): boolean {
  if (module.creatable.manual) return true;
  if (module.capabilities.create === "system") return true;
  const pushedFrom = module.creatable.pushedFrom;
  if (pushedFrom === null) {
    schemaFail(
      `module "${module.code}" push origins have not been resolved yet (pushedFrom is null) — ` +
        `this module table did not go through loadCatalog's withPushOrigins assembly step, so the create path cannot be judged`,
    );
  }
  return pushedFrom.length > 0 || module.views.createFrom.length > 0;
}

export interface CheckReport {
  readonly id: string;
  readonly level: Precondition["level"];
  readonly ok: boolean;
  /** Plain-language description of the rule itself. */
  readonly rule: string;
  /** What this evaluation actually found, with numbers. */
  readonly detail: string;
  readonly why: string;
  /**
   * Non-null means this gate was not declared on this edge. The value is the edge that declared it (not the previous hop on the inheritance chain).
   *
   * It is carried out instead of being quietly merged in. When an "exception release" is blocked by a rule it did not write,
   * the user must be able to see where that rule came from, or the sentence reads as if the system is making things up.
   * Pointing at the previous hop is worse than saying nothing — the user goes to look at an edge that does not have this declaration.
   */
  readonly inheritedFrom: string | null;
  /**
   * This rule could not be evaluated (evaluation threw). It is not "evaluated and did not hold".
   *
   * Both are recorded as `ok: false` (fail closed), but they must be distinguishable:
   * "available stock in this warehouse is not enough to ship" is a business conclusion, and the user knows the next step;
   * "this rule cannot be evaluated" is a sentence from the system side, and the next step is usually to fill in one cell or ask someone to look.
   * Mixed into one sentence, a soft rule that cannot be evaluated because of an empty value is read as a business gate that really failed,
   * and the user can edit that field any number of times and still be right that it should not have failed that way.
   */
  /**
   * The sentence to say to the user when this one did not pass — word for word the same as `verdict.message` when `worst()` picks it
   * (the modeler's `message` wins; if it was not written, use `detail`; when it cannot be evaluated, always use `detail`).
   *
   * Only with this can "every one that did not pass" be listed without changing the wording. `verdict` holds only one
   * (`worst()` returns a single result, and within a band it takes the first in declaration order). When the renderer wants to list all of them,
   * it has only `rule` (the rule itself) and `detail` (what this evaluation computed). The sentence the modeler wrote is not in there.
   * Each side composing its own copy shows up as: when this gate blocks alone, the screen says "available stock in this warehouse is short; replenish or change warehouse first",
   * and when it blocks together with other gates it becomes a machine-voiced detail — and both sentences are "correct".
   *
   * On an `ok: true` report it has no meaning (it will not be shown). It takes `detail` so the shape stays complete.
   */
  readonly message: string;
  readonly unevaluated: boolean;
  /**
   * This gate does not apply this time (`when` evaluated to false), so it was not measured at all.
   *
   * That is a different fact from `ok: true`, and they must stay apart. "Measured, and it passed" and "not measured this time"
   * mean different next steps for the user. Mixed into one sentence, "why did this gate not stop me"
   * is answered with "it passed" — and the truth is it never applied, so the user goes looking for a data problem that does not exist.
   *
   * A gate that does not apply still appears in `checks`. It does not quietly disappear. A gate present on this document
   * and absent on that one is exactly the "sometimes it pops, sometimes it does not" shape AGENTS.md keeps naming:
   * it has no symptom, and the user cannot form an expectation. A gap has to be visible and countable.
   */
  readonly skipped: boolean;
  /**
   * Where this conclusion came from: `param` = the value gate on action parameters (a required value is missing / the type does not match),
   * `precondition` = a precondition the modeler declared on this edge.
   *
   * An explicit field. Do not guess from an `id` prefix again. Two consumers used to each call `id.startsWith("params.")`:
   * the server permission projection used it to decide "should this be shown outside", and the UI used it to decide "can this button be pressed".
   * For the first half, `id` is composed by the framework (`params.<path>`). For the second half it is a string the modeler chose —
   * a precondition named `params.foo` fools both places at once, and the two lies differ:
   * one leaks the business-rule text to someone who is not allowed to see it, and the other treats a real business gate as "not filled in yet" and lets it pass.
   *
   * They must stay apart because of the consumer: the `param` band says "you have not filled this in yet",
   * and collecting parameters is the reason the action dialog exists; the `precondition` band says "even filled in, this cannot proceed".
   * Mixed into one sentence, a dialog opened to collect parameters refuses to submit because the parameters have not been received yet —
   * this was stepped on in practice (multi-person dispatch: two rows filled, the total matches, and "confirm execution" stays grey forever).
   */
  readonly origin: "param" | "precondition";
}

/**
 * The posting plan of one edge.
 *
 * `forward` is the side effect this edge itself declares. It is definitely to be written.
 *
 * `reversals` are candidates. They are not ledger rows that are definitely to be written.
 *
 * They are inferred from the declaration: scan the whole module and find every effect that lists this edge in reverseOn.
 * But "declared to be rolled back by me" is not "that ledger row was actually posted" — the same status may have several ways in
 * (a stock-out's normal confirm and an over-stock release both deduct inventory). After the walk, only one of them really landed a row.
 * Reversing everything the declaration names adds it back twice, and inventory gains a copy from nowhere.
 *
 * So the executor must reconcile this candidate list against the ledger: reverse only rows in `oe_effect_ledger`
 * that really exist and have not been reversed yet. The kernel is zero IO. It cannot do that, and it should not —
 * it only answers "who should be rolled back according to the declaration". "Which rows were actually posted" is a fact in the database.
 *
 * The database's unique index on `reversalOf` is the last line of defense (reversing the same row twice is rejected),
 * but it covers concurrency and replay. It does not replace the reconciliation here.
 */
export interface EffectPlan {
  readonly forward: readonly ResolvedEffect[];
  readonly reversals: readonly { readonly fromTransition: string; readonly effect: ResolvedEffect }[];
  /** Used only on the external DTO after permission projection. Internal evaluation never sets it. */
  readonly hiddenCount?: number;
}

export interface TransitionDecision {
  readonly transition: Transition;
  readonly from: string;
  readonly to: string;
  /** The merged conclusion: the strictest of the four bands. */
  readonly verdict: PreconditionResult;
  /** Line-by-line detail, so the user can see why it cannot proceed. */
  readonly checks: readonly CheckReport[];
  readonly plan: EffectPlan;
  /** Action parameters produced by the only normalization entrance. Rules, Planner, audit, and execution must consume this copy. */
  readonly params: Readonly<Record<string, unknown>>;
}



/**
 * Compute which side effects to roll back when this edge is taken.
 *
 * Scan every edge of the module, find the effects that list this edge in reverseOn, and invert them by EFFECT_REVERSE_OPS.
 * The whole candidate (amount + coordinates) is evaluated from the current document, not from the snapshot taken when it was posted.
 * The two halves are different in kind. Do not mix them:
 *
 * · Sharing the amount source is deliberate: occupancy ledger rows (`ap reserve`) already float with the header amount.
 *   Using the snapshot releases the wrong amount after the document is edited. Reconciliation on the execution side therefore does not compare amounts.
 * · Coordinates (subject / scope) are the reconciliation key: `reconcileReversals` uses them to find the forward row in the ledger
 *   (`row.subjectId === effect.subjectId && row.scopeId === effect.scopeId`).
 *   A miss drops the candidate. So the coordinates must be the same value as when it was posted —
 *   once a subject / scope field an effect references is editable on an already-posted document, this reconciliation fails silently:
 *   the customer changes from A to B and then close runs, the candidate computes B, the ledger holds A, nothing matches,
 *   the occupancy on A stays open forever, the screen shows "closed", and the balance is a completely legal number that is too large.
 *
 * This contract is currently only a convention. There is no gate: `validate` does not check whether a field an effect coordinate references
 * is editable in a status reachable after posting. Both domain modules dodge it today (a status after posting is either terminal and not editable,
 * or the whitelist has no coordinate field), so it cannot fire. Opening `editable:'full'` on a post-posting status of a new module
 * steps on it, and the whole path reports nothing.
 */
function planEffects(
  module: ModuleSchema,
  edge: Transition,
  bill: Readonly<Record<string, unknown>>,
  lines: readonly Readonly<Record<string, unknown>>[],
  /**
   * Source edges the runtime derived from the real ledger that still have unreversed facts.
   *
   * `undefined` keeps the pure-kernel meaning of declaration candidates. When a set is passed, mutually exclusive branches that never happened
   * are excluded before subject / scope are resolved. Otherwise a reversal of the sales branch goes to resolve the purchase branch's supplierId.
   * Even when the ledger has already proved the purchase branch never ran, it fails first on an empty coordinate and never reaches execution-side reconciliation.
   */
  reversalSources?: ReadonlySet<string>,
): EffectPlan {
  // flatMap: one `stock out` declared on three line rows expands into three ledger rows.
  const forward = edge.effects.flatMap((effect, i) =>
    resolveEffect(effect, bill, lines, `lifecycle.transitions.${edge.code}.effects[${i}]`),
  );

  const reversals: { fromTransition: string; effect: ResolvedEffect }[] = [];
  for (const other of effectDeclarations(module)) {
    if (reversalSources !== undefined && !reversalSources.has(other.code)) continue;
    other.effects.forEach((effect, i) => {
      if (!effect.reverseOn.includes(edge.code)) return;
      for (const resolved of resolveEffect(effect, bill, lines, `lifecycle.transitions.${other.code}.effects[${i}]`)) {
        reversals.push({ fromTransition: other.code, effect: reverseOf(resolved) });
      }
    });
  }

  return { forward, reversals };
}

/**
 * The ledger records only the action code, not the start status. Effects of edges with the same code are identical word for word (`normalizeLifecycle` guarantees it),
 * so when scanning reversal candidates each code takes only one edge. Otherwise the same ledger row is reversed once per start status.
 *
 * Every place that "scans the whole module for who listed some action in reverseOn" (evaluation, seed replay, catalog) goes through this copy.
 */
export function effectDeclarations(module: ModuleSchema): readonly Transition[] {
  const seen = new Set<string>();
  return module.lifecycle.transitions.filter((edge) => {
    if (seen.has(edge.code)) return false;
    seen.add(edge.code);
    return true;
  });
}

/**
 * Compute the edge's posting plan, but when this edge has already been stopped by block, swallow an evaluation failure from `planEffects`
 * (an empty subject / a non-numeric amount, that kind of `SchemaError`) into an empty plan.
 *
 * It exists as the second landing of one discipline. Above, `engine.ts` keeps saying "if one rule cannot be evaluated,
 * only that one fails; do not take the whole edge's evaluation with it" (a missing required parameter and a single rule throwing
 * were each isolated). Only `planEffects` kept running unconditionally outside that discipline — and it throws too:
 * `resolveEffect → pickId` hits an empty coordinate and `schemaFail`s. So a purchase order whose supplier has not been chosen yet
 * takes `approve`. It should be stopped by the block gate `supplier_required` and reported in plain language
 * as "missing required item: supplier". Instead the posting jargon `planEffects` throws first,
 * "effects[0].subject references '$bill.supplierId', which has no value…… refusing to post", short-circuits —
 * verdict / checks are all taken away, the user cannot read it, and the batch entrance can only relay it as is.
 *
 * Swallow only when the verdict is already block. Do not swallow unconditionally:
 *   · block means this edge will not execute at all. That ledger row does not need to be laid out for the user, and a sentence of
 *     posting jargon must not cover the plain-language block that should be shown. An empty plan is honest — because it really will not post.
 *   · pass / warn / route / hint means the edge may really execute (after a warn is confirmed, this edge is taken). Then
 *     "subject has no value" is a real incomplete datum, and it must still throw `SchemaError`: the HTTP layer
 *     routes it to 400 by type (the caller's mistake), not 500 (a server fault). That routing discipline
 *     is locked by "a failure on the evaluation path must be a SchemaError" in `engine.test.ts`.
 *
 * A non-`SchemaError` (a real accident) is always rethrown as it is. No band swallows it.
 */
function planEffectsForDecision(
  module: ModuleSchema,
  edge: Transition,
  bill: Readonly<Record<string, unknown>>,
  lines: readonly Readonly<Record<string, unknown>>[],
  reversalSources: ReadonlySet<string> | undefined,
  verdict: PreconditionResult,
): EffectPlan {
  const blocked = !verdict.pass && verdict.level === "block";
  try {
    return planEffects(module, edge, bill, lines, reversalSources);
  } catch (error: unknown) {
    if (blocked && error instanceof SchemaError) return { forward: [], reversals: [] };
    throw error;
  }
}

/**
 * When this edge is taken, which places really have to read line rows. An empty array means this evaluation looks at no row.
 *
 * It exists because "how many line tables the module declares" and "does this evaluation need an unambiguous row set"
 * are two questions, and treating them as one is wrong twice at once:
 * on a module with one line table, `$line.` may not be referenced; on a module with two line tables, `$line.` is always unsolvable —
 * but an edge that neither posts per line nor looks at the row set (this module's confirm, or a reversal) never touches `ctx.lines` during evaluation.
 * Rejecting that kind of edge because of the table count is refusing to answer every question because "an unsolvable question might be asked".
 *
 * The criterion can only be read from the declaration. Do not scan strings:
 *   · On the rule side, ask the primitive itself (`checkUsesLines`), because per-line or not is a derived property (`perLine`),
 *     and `lines_not_empty` does not reference any row or column at all
 *   · On the posting side it is word-for-word the same shape as `planEffects`: this edge's forward effects, plus effects other edges declare
 *     to be rolled back by this edge. Looking only at the forward side misses the whole reversal side — and that is exactly an edge such as "un-approve releases occupancy",
 *     which has zero effects of its own and still has to reverse the ledger per line
 *
 * What comes back is a plain-language location (which rule / which effect index of which edge). The caller uses it to tell the modeler
 * "who needs line context". Saying only "ambiguous" sends the person off to guess.
 */
export function lineContextDemands(
  module: ModuleSchema,
  edge: Transition,
  reversalSources?: ReadonlySet<string>,
): readonly string[] {
  const code = edge.code;
  const demands: string[] = [];
  for (const { rule, inheritedFrom } of resolvePreconditions(module, code)) {
    if (!rule.check || !checkUsesLines(rule.check)) continue;
    demands.push(`precondition "${rule.id}"${inheritedFrom === null ? "" : ` (inherited from "${inheritedFrom}")`}`);
  }
  edge.effects.forEach((effect, i) => {
    if (effect.perLine) demands.push(`this edge's effects[${i}] (posts per line)`);
  });
  for (const other of effectDeclarations(module)) {
    if (reversalSources !== undefined && !reversalSources.has(other.code)) continue;
    other.effects.forEach((effect, i) => {
      if (!effect.perLine || !effect.reverseOn.includes(code)) return;
      demands.push(`edge "${other.code}" effects[${i}] (declared to be reversed by this edge, per line)`);
    });
  }
  return demands;
}

/**
 * Source transitions this edge might reverse, according to the declaration.
 *
 * This only answers "does the ledger need to be queried". It does not answer "which one really happened". The latter must be read at runtime
 * from the current document's unreversed ledger rows. The scan stays in the metamodel so Runtime and Agent do not each rewrite
 * the `reverseOn` criterion.
 */
export function reversalSourceTransitions(module: ModuleSchema, edge: Transition): readonly string[] {
  return effectDeclarations(module)
    .filter((transition) => transition.effects.some((effect) => effect.reverseOn.includes(edge.code)))
    .map((transition) => transition.code);
}

export interface EvaluateInput {
  readonly module: ModuleSchema;
  readonly bill: Readonly<Record<string, unknown>>;
  readonly lines: readonly Readonly<Record<string, unknown>>[];
  readonly params: Readonly<Record<string, unknown>>;
  readonly actor: Readonly<Record<string, unknown>>;
  readonly now: Date;
  readonly query: RuleContext["query"];
  /**
   * Source edges the real ledger has proved still have unreversed facts. When omitted, every declaration candidate is returned, for pure modeling evaluation.
   * A Runtime / Agent preview must pass the set computed from ledger rows.
   */
  readonly reversalSources?: ReadonlySet<string>;
}

export interface CreatePreconditionInput {
  readonly module: ModuleSchema;
  readonly bill: Readonly<Record<string, unknown>>;
  readonly lines: readonly Readonly<Record<string, unknown>>[];
  readonly actor: Readonly<Record<string, unknown>>;
  readonly now: Date;
  readonly query: RuleContext["query"];
}

/** Evaluate the create gates declared for a manual create. They share the same primitives and report shape as a lifecycle edge. */
export async function evaluateCreatePreconditions(input: CreatePreconditionInput): Promise<{
  readonly verdict: PreconditionResult;
  readonly checks: readonly CheckReport[];
}> {
  const labels = fieldLabelsOf(input.module, null);
  const ctx: RuleContext = {
    bill: input.bill,
    lines: input.lines,
    params: {},
    actor: input.actor,
    labels,
    now: input.now,
    query: input.query,
  };
  const checks: CheckReport[] = [];
  const results: PreconditionResult[] = [];
  for (const pc of input.module.preconditions.filter((rule) => rule.onCreate && rule.enabled)) {
    if (!pc.check) schemaFail(`Create precondition ${pc.id} has no check, so it cannot be evaluated`);
    const rule = describeCheck(pc.check, labels);
    if (pc.when) {
      let applies = false;
      try {
        applies = (await evaluateCheck(pc.when, ctx)).ok;
      } catch {
        applies = true;
      }
      if (!applies) continue;
    }
    let outcome: { readonly ok: boolean; readonly detail: string };
    let unevaluated = false;
    try {
      outcome = await evaluateCheck(pc.check, ctx);
    } catch (error: unknown) {
      unevaluated = true;
      outcome = { ok: false, detail: `This rule cannot be evaluated right now: ${error instanceof Error ? error.message : String(error)}` };
    }
    const message = unevaluated ? outcome.detail : (pc.message ?? outcome.detail);
    checks.push({
      id: pc.id,
      level: unevaluated && pc.level === "route" ? "block" : pc.level,
      ok: outcome.ok,
      rule,
      detail: outcome.detail,
      message,
      why: pc.why,
      inheritedFrom: null,
      unevaluated,
      skipped: false,
      origin: "precondition",
    });
    if (outcome.ok) results.push(PASS);
    else results.push(pc.level === "route" && !unevaluated ? fail("route", message, pc.exit ?? undefined) : fail(unevaluated ? "block" : pc.level, message));
  }
  return { verdict: worst(results), checks };
}

/**
 * Evaluate one edge: whether it can be taken, why, and what it would post.
 *
 * It does not write the database and it does not change status. The caller stops on a block verdict, switches to exit on route,
 * asks the user to confirm on warn, and executes the plan directly on pass/hint.
 */
export async function evaluateTransition(input: EvaluateInput, code: string): Promise<TransitionDecision> {
  const { module, bill } = input;
  const edge = transitionAt(module, bill["status"], code);

  // The name table is computed once here for every rule. A rule error says the word the user sees on the form
  // ("shipping warehouse"), not the field key (`warehouseId`). The edge code is included because the name of `$param.`
  // differs per edge (a rule hanging on `*` is not allowed to reference `$param.`, so it cannot pick the wrong one).
  const labels = fieldLabelsOf(module, edge);
  // A hidden parameter is a fact the action preparer generates (such as the moment the action opened). It is normal that it is not present on the first evaluation.
  // Only that kind of absence is let through. A required parameter the user can see still forms a block. The execution entrance still requires every parameter to be present.
  const normalizedParams = normalizeTransitionParams(edge, input.params, {
    allowMissingRequiredFor: edge.params.filter((param) => param.hidden).map((param) => param.key),
  });
  const ctx: RuleContext = {
    bill,
    lines: input.lines,
    params: normalizedParams.params,
    actor: input.actor,
    labels,
    now: input.now,
    query: input.query,
  };

  const checks: CheckReport[] = [];
  const results: PreconditionResult[] = [];

  // Applicability of the edge comes before the gates. when false or not holding means this edge does not exist for the current document.
  // A plain-language block. Do not schemaFail into a 500. A throw fails closed (treat as not applicable).
  // The opposite of a gate when, where "threw means applicable": that is "do not turn the gate off". Here it is "do not let an edge that should not be taken run".
  if (edge.when) {
    let applies = false;
    let detail = "This action does not apply to the current document";
    try {
      const guard = await evaluateCheck(edge.when, ctx);
      applies = guard.ok;
      detail = guard.detail;
    } catch (error: unknown) {
      applies = false;
      detail = error instanceof Error ? error.message : String(error);
    }
    if (!applies) {
      const message = `This action does not apply to the current document: ${detail}`;
      const verdict = fail("block", message);
      return {
        transition: edge,
        from: edge.from,
        to: edge.to,
        verdict,
        checks: [
          {
            id: "when",
            level: "block",
            ok: false,
            rule: describeCheck(edge.when, labels),
            detail,
            message,
            why: "This kind of document cannot take this action",
            inheritedFrom: null,
            unevaluated: false,
            skipped: false,
            origin: "precondition",
          },
        ],
           plan: planEffectsForDecision(module, edge, bill, input.lines, input.reversalSources, verdict),
        params: normalizedParams.params,
      };
    }
  }

  // A missing required parameter is a block-level conclusion, not an exception.
  //
  // This used to schemaFail directly, so the whole evaluateTransition short-circuited — the plan was dropped with it.
  // The consequence: a posting edge with a required parameter never showed "how much this document will record, and on whose account" in the confirm dialog,
  // only "it still cannot be computed right now". The user pressed confirm, and preview + run wrote the database in one breath.
  // "A ledger row must not be written before the user has seen it" did not hold on that path, and the dialog looked completely normal.
  //
  // And the plan does not depend on parameters (`planEffects(module, edge, bill, lines)` does not take params) —
  // "cannot be computed" is false. Whether a parameter is missing belongs to the verdict dimension. It has nothing to do with whether the ledger can be laid out.
  // Parameters are closed too: a key the edge did not declare is always rejected.
  //
  // Same discipline as the closed prefix on rule operands — an extra key silently enters RuleContext and the audit,
  // so "I did pass reason" becomes a symptom whose cause cannot be found (one letter was misspelled).
  // It lives here rather than on the HTTP route: CLI, the agent tool surface, and HTTP share this one gate.
  for (const issue of normalizedParams.issues) {
    const param = edge.params.find((candidate) => issue.path === candidate.key || issue.path.startsWith(`${candidate.key}[`));
    const label = param?.label ?? issue.label;
    const missingWholeParam = issue.code === "REQUIRED_BLANK" && issue.path === param?.key;
    const message = missingWholeParam ? `Missing required parameter "${label}"` : `Action parameter "${label}" is invalid: ${issue.message}`;
    checks.push({
      id: `params.${issue.path}`,
      level: "block",
      ok: false,
      rule: missingWholeParam ? `This action must fill in "${label}"` : `"${label}" must match the declared field structure`,
      detail: issue.message,
      message,
      why: "Action parameters share the value gate with ordinary fields and lines. The action cannot run when the type or a required value does not hold.",
      inheritedFrom: null,
      unevaluated: false,
      skipped: false,
      origin: "param",
    });
    results.push(fail("block", message));
  }

  for (const { rule: pc, inheritedFrom } of resolvePreconditions(module, code)) {
    if (!pc.check) schemaFail(`Precondition ${pc.id} has no check, so it cannot be evaluated`);
    const rule = describeCheck(pc.check, labels);

    // Condition band: first ask whether this gate applies this time.
    //
    // Neither meaning can be reversed:
    //   · `when` false means this gate does not apply, so record a `skipped` pass.
    //     That is not "passed" (nothing was measured, so it cannot count as qualified), but its contribution to the verdict really is PASS.
    //   · `when` cannot be evaluated (it throws) means it applies as usual. It is not skipped.
    //     The reverse is the worst kind of fail-open: a guard that cannot get a value silently turns off the
    //     block-level gate it guards, both declarations look correct on their own, and the screen says not one word.
    //     The safe answer to "applicability cannot be judged" is always "then judge it".
    if (pc.when) {
      let applies = true;
      let why = "";
      try {
        const guard = await evaluateCheck(pc.when, ctx);
        applies = guard.ok;
        why = guard.detail;
      } catch (error: unknown) {
        // The guard cannot be evaluated, so treat it as applicable and keep the reason in detail (the main criterion below still runs).
        applies = true;
        why = `The applicability condition cannot be evaluated (${error instanceof Error ? error.message : String(error)}); treating it as applicable`;
      }
      if (!applies) {
        checks.push({
          id: pc.id,
          level: pc.level,
          ok: true,
          rule: `Only when ${describeCheck(pc.when, labels)}: ${rule}`,
          detail: `Not applicable this time: ${why}`,
          message: `Not applicable this time: ${why}`,
          why: pc.why,
          inheritedFrom,
          unevaluated: false,
          skipped: true,
          origin: "precondition",
        });
        results.push(PASS);
        continue;
      }
    }

    // If one rule cannot be evaluated, only that one fails. Do not take the whole edge's evaluation with it.
    //
    // Word for word the same discipline as "a missing required parameter is a block-level conclusion, not an exception" above,
    // only the place differs: that one governs parameters, this one governs rule evaluation.
    //
    // There used to be no per-rule isolation here, so any rule throwing (the most common shape: a nullable field hitting
    // an ordering comparison such as `gt/gte/lt/lte`, where an empty value cannot be compared) short-circuited the whole `evaluateTransition` —
    // no verdict, no checks, no plan. Measured: a draft missing `promiseDate` took
    // `submit`, and the whole edge blew up. The consequence was not only that one click failing. The modeler no longer dared to
    // downgrade that field to optional, even though "a draft whose delivery date is not decided yet" is common in real business.
    //
    // This is not "a throw counts as passed" (that is fail-open, the fallback this system should least have):
    // anything that cannot be evaluated is `ok: false`, and `checks` says which one and why.
    let outcome: { readonly ok: boolean; readonly detail: string };
    let unevaluated = false;
    try {
      outcome = await evaluateCheck(pc.check, ctx);
    } catch (error: unknown) {
      unevaluated = true;
      outcome = {
        ok: false,
        detail: `This rule cannot be evaluated right now: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // A `route` band that cannot be evaluated must drop to block. It must not change path automatically.
    //
    // For the other three bands, "cannot be evaluated" and "did not pass" are handled the same way (both tell the user). route is not:
    // it is a business conclusion — "this condition holds, so take the exception path instead". The exception path exists
    // so that a person one level up bears the risk. Translating "I cannot judge" into "the condition holds, go take the exception"
    // means the system made a reroute decision for the business with no basis, and the whole path has zero symptoms.
    const level = unevaluated && pc.level === "route" ? "block" : pc.level;

    // When it cannot be evaluated, do not substitute `pc.message`: that sentence describes a business failure
    // ("available stock in this warehouse is short"). Using it to describe an evaluation failure is a sentence that does not match the facts.
    //
    // Computed before the push, and `checks` and `results` share this one value: the renderer lists "every one that did not pass",
    // and what it lists must be word for word the same as what is shown when only this one blocks.
    const message = unevaluated ? outcome.detail : (pc.message ?? outcome.detail);

    checks.push({
      id: pc.id,
      level,
      ok: outcome.ok,
      // When there is a condition band, say the condition in the rule: a gate that says "the parent must be a factory" does not block a factory itself.
      // If it is not made clear that it applies only when this is not a factory, the reader thinks the gate is broken.
      rule: pc.when ? `Only when ${describeCheck(pc.when, labels)}: ${rule}` : rule,
      detail: outcome.detail,
      message,
      why: pc.why,
      inheritedFrom,
      unevaluated,
      skipped: false,
      origin: "precondition",
    });
    if (outcome.ok) {
      results.push(PASS);
      continue;
    }
    results.push(level === "route" ? fail("route", message, pc.exit ?? undefined) : fail(level, message));
  }

  const verdict = worst(results);
  return {
    transition: edge,
    from: edge.from,
    to: edge.to,
    verdict,
    checks,
    plan: planEffectsForDecision(module, edge, bill, input.lines, input.reversalSources, verdict),
    params: normalizedParams.params,
  };
}
