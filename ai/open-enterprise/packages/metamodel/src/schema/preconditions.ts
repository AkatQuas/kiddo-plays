// ---------------------------------------------------------------------------
// ⑤ Precondition — it lives on an edge, and it is the threshold of a transfer of responsibility
//
// "Business validation" is not a module. It is a cross-cutting concern, and it lands here.
// Every non-standard case converges on one exit: a precondition with source:'code' (this repo implements it as a parameterized primitive; see primitives.ts).
// ---------------------------------------------------------------------------

import { assertClosedKeys, requireEnum, requireObject, requireText, schemaFail } from "./common.js";
import { transitionAction, transitionActions, type TransitionActionSource } from "./lifecycle.js";
import {
  checkBillFields,
  normalizeCheck,
  normalizeGuardCheck,
  REQUIRED_FIELDS_PRIMITIVE,
  type NormalizedCheck,
} from "../derive/primitives.js";

/**
 * Four outcomes. Not a binary — this is the most concrete modeling difference between an ERP and a generic state machine:
 *
 *   hint   a notice, does not block
 *   warn   a warning, continues after the user confirms
 *   route  a detour: turn to an approval flow or another exit. An exit is required
 *   block  a hard stop
 */
export const LEVELS = ["hint", "warn", "route", "block"] as const;
export type Level = (typeof LEVELS)[number];

/** Severity order: when one edge has several conclusions, take the strictest */
export const LEVEL_SEVERITY: Readonly<Record<Level, number>> = Object.freeze({
  hint: 1,
  warn: 2,
  route: 3,
  block: 4,
});

/**
 * Three sources.
 *
 *   invariant  an invariant. Derived from the field model, always on and cannot be turned off — if it could, the field model would be fake
 *   gate       a business gate. A tenant may switch it
 *   code       the non-standard exit. Carried by a parameterized primitive
 */
export const PRECONDITION_SOURCES = ["invariant", "gate", "code"] as const;
export type PreconditionSource = (typeof PRECONDITION_SOURCES)[number];

/** Attached to every edge */
export const ALL_TRANSITIONS = "*";

/**
 * Primitives allowed inside `when`. A closed set. Today there is only one.
 *
 * The criterion is "applicability asks what shape this document itself is": whether it is a factory, whether there is a previous operation,
 * whether this cell is filled. That is exactly the whole content of `field_compare`, and it has two properties the other primitives cannot give:
 *
 *   · Zero IO — the applicability judgment runs once before this edge is evaluated. Letting it query the database
 *     (`related_agg` / `available_sufficient`) prepays a database round trip for a gate that may not apply at all,
 *     and adds another path that can throw.
 *   · It does not mean "no number was found, so false" — `ref_field_compare` returns
 *     `ok: false` when the reference is empty (that is the correct fail-closed for its main criterion), but once it is used as `when`,
 *     the same false flips to "this gate does not apply", which is fail-open.
 *     A guard that cannot get a number silently turns off the gate it guards, while each declaration looks correct on its own.
 *
 * 🔴 Before widening this set, answer how the second point holds for the new primitive.
 * Too narrow costs one error at modeling time whose reason can be stated. Too wide costs a gate that was turned off silently.
 *
 * The set itself is `GUARD_PRIMITIVES` in `primitives.ts` (`Transition.when` shares the same copy).
 */

export interface Precondition {
  readonly id: string;
  /** A transition code, or ALL_TRANSITIONS */
  readonly onTransition: string;
  /** Runs when a manual document is created. A create gate belongs to no lifecycle edge. */
  readonly onCreate: boolean;
  readonly source: PreconditionSource;
  readonly level: Level;
  /** Where a route-level rule detours to */
  readonly exit: string | null;
  /** Filled in by derivation for an invariant; a gate / code must bring its own */
  readonly check: NormalizedCheck | null;
  /**
   * The condition tier: when this gate applies. `null` means it applies unconditionally (the default, and the great majority).
   *
   * 🔴 The criterion for adding this tier is `AGENTS.md`'s "the same kind appearing at least twice should move up", and the production domain hit it three times in one pass:
   *   · a workshop's parent must be a factory … and a factory has no parent (today this is forced into two edges, `activate` / `activateFactory`)
   *   · this operation's reportable quantity is at most the previous operation's accumulated good quantity … and the first operation has no previous one (today this gate simply cannot be attached)
   *   · a line that already has a work report must not change quantity … and a line with no work report may
   * The three have the same shape: "judge records of kind A, do not judge kind B" cannot be expressed in preconditions at all,
   * because every gate applies unconditionally to its edge, and `ref_field_compare` is fail-closed on an empty reference.
   *
   * 🔴 Why it lives on Precondition and is not stuffed into `check`: applicability is "when this door stands",
   * and "how to measure while it stands" is a different question. Stuffing it into `check` would make every primitive understand a concept it does not own,
   * and the whole value of a primitive is that each one answers only one question.
   *
   * 🔴 Why it is not a third state `onMissing: skip` on `ref_field_compare` (the other candidate):
   * that tier covers only one of the three cases, and it answers the first case wrong — "a workshop's parent must be a factory" must block
   * when the workshop has not filled a parent (it is an orphan node), and `skip` would let it through.
   * The real guard condition is on `$bill.orgType`, not on whether the reference is empty.
   *
   * ⚠️ Adding this tier also has to pass the criterion "adding a property on Field / Precondition is also adding expressive power"
   * (`AGENTS.md`). It does not enter `MODULE_KEYS` (that only governs top-level module keys), but the criterion is the same: n≥2 and
   * a foreseeable larger n — mixed sources on a purchase line and installment collection on a sale are the same shape.
   */
  readonly when: NormalizedCheck | null;
  /** The words shown to the user when it is not satisfied. When omitted, the primitive explains itself */
  readonly message: string | null;
  /** Why this rule exists — written for a person and for an AI. It does not take part in evaluation */
  readonly why: string;
  readonly enabled: boolean;
}

const PRECONDITION_KEYS = [
  "id",
  "onTransition",
  "onCreate",
  "source",
  "level",
  "exit",
  "check",
  "when",
  "message",
  "why",
  "enabled",
] as const;

export function normalizePrecondition(raw: unknown, label = "precondition"): Precondition {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, PRECONDITION_KEYS, label);
  const id = requireText(obj["id"], `${label}.id`);
  const at = `preconditions.${id}`;

  const source = requireEnum(obj["source"], PRECONDITION_SOURCES, `${at}.source`);
  const level = requireEnum(obj["level"], LEVELS, `${at}.level`);
  const onCreate = obj["onCreate"] === true;
  if (onCreate && level === "route") schemaFail(`${at}: a create precondition cannot use the route level`);

  const exitRaw = obj["exit"];
  const exit = exitRaw === undefined || exitRaw === null ? null : requireText(exitRaw, `${at}.exit`);
  // The same discipline as "effects must have reverseOn", appearing again: a thing with no exit must not exist
  if (level === "route" && !exit) {
    schemaFail(`${at}: a route level must give an exit — a rule with no exit is a wall, not a door`);
  }
  if (level !== "route" && exit) schemaFail(`${at}: exit is meaningful only at the route level`);

  const checkRaw = obj["check"];
  const check = checkRaw === undefined || checkRaw === null ? null : normalizeCheck(checkRaw, `${at}.check`);
  if (source !== "invariant" && !check) schemaFail(`${at}: a ${source} precondition must bring its own check`);

  const whenRaw = obj["when"];
  const when = whenRaw === undefined || whenRaw === null ? null : normalizeGuardCheck(whenRaw, `${at}.when`);
  // A guard is a per-edge judgment, not a per-line one: `ctx.line` does not exist at this position.
  // An operand of `field_compare` is already forbidden from `$line.` by default (`NO_LINE` in `normalizeOperand`),
  // so this does not need to be checked again — the closed prefix holds here automatically.
  if (when && !check) {
    schemaFail(`${at}.when: an applicability condition was given but there is no check — guarding a door that does not exist`);
  }

  const messageRaw = obj["message"];

  return {
    id,
    onTransition: requireText(obj["onTransition"], `${at}.onTransition`),
    onCreate,
    source,
    level,
    exit,
    check,
    when,
    message: messageRaw === undefined || messageRaw === null ? null : requireText(messageRaw, `${at}.message`),
    why: requireText(obj["why"], `${at}.why`),
    // 🔴 an invariant is always true and cannot be turned off
    enabled: source === "invariant" ? true : obj["enabled"] !== false,
  };
}

// ---------------------------------------------------------------------------
// The gates one edge actually has to pass — including those it inherited
// ---------------------------------------------------------------------------

/**
 * One gate in effect on one edge, and whether it was inherited.
 */
export interface ResolvedPrecondition {
  readonly rule: Precondition;
  /**
   * null = declared on this edge itself; non-null = the edge that declared this rule.
   *
   * It is the declaring source, not the previous hop on the inheritance chain: on a chain a → b → c, a user blocked on c by a rule declared on a
   * would be sent to look at an edge that does not have this declaration at all if told "inherited from b".
   */
  readonly inheritedFrom: string | null;
}

/**
 * 🔴 An exit edge inherits the gates of its start edge, except the one that uses it as the exit.
 *
 * Why this is not an optional policy but the meaning of `route` itself:
 * `route` says "do not take this edge, take that one" — the exit edge is an alternate path with the same start and the same end
 * (the `PRECONDITION_EXIT_*` gates force that). Gates are attached by `onTransition`,
 * so the alternate path inherits none of them by default: an exit set up to bypass gate A
 * also bypasses B, C, and D, and nothing anywhere says so.
 *
 * A consequence that was measured: `salesDelivery.confirm` carries "do not over-ship",
 * and its route exit `confirm_over_stock` (the edge taken when stock is short) does not carry it —
 * so an over-shipped delivery was confirmed through the exception edge, and the goods and the ledger both followed.
 *
 * The exclusion is derived. It needs no new declaration: the rules that use this edge as `exit`
 * are exactly the ones this edge was designed to bypass. Every other one is kept.
 *
 * The start edge may itself be someone else's exit, so this recurses; `seen` catches a cycle caused by a modeling error
 * (A's exit is B and B's exit is A). A cycle has no solution, so it throws.
 *
 * ⚠️ There is no switch for "do not inherit this one". When an exit edge really needs one gate relaxed on its own,
 * the right answer is usually "that gate should have been attached to a specific edge" rather than opening a back door on inheritance —
 * talk about it again when there are really n≥2 instances.
 */
export function resolvePreconditions(
  module: { readonly preconditions: readonly Precondition[] },
  code: string,
  seen: readonly string[] = [],
): readonly ResolvedPrecondition[] {
  if (seen.includes(code)) {
    schemaFail(`precondition inheritance cycle: ${[...seen, code].join(" → ")} — two edges are each other's route exit, which has no solution`);
  }

  // Rules that use this edge as their exit: their onTransition is this edge's start edge,
  // and the rule itself is the one this edge was designed to bypass
  const routedHere = module.preconditions.filter((p) => p.enabled && p.exit === code);
  const bypassed = new Set(routedHere.map((p) => p.id));

  // 🔴 Exclusions are derived by rule id, so a rule this edge hits itself and a rule it inherited are treated the same.
  //
  // Checking bypassed only on the inheritance path contradicts one way of writing it: a rule
  // `{ onTransition: "*", level: "route", exit: "approve_exception" }`
  // hits itself through `*` when `approve_exception` is evaluated — so the system's answer is
  // "please take the exception release", and that is exactly what the user clicked. That exit can never be taken,
  // and yarn test stays green (`*` is explicitly excluded from PRECONDITION_EXIT_UNREACHABLE).
  const own = module.preconditions
    .filter((p) => !p.onCreate)
    .filter((p) => p.enabled && (p.onTransition === code || p.onTransition === ALL_TRANSITIONS))
    .filter((p) => !bypassed.has(p.id))
    .map((rule): ResolvedPrecondition => ({ rule, inheritedFrom: null }));

  const byId = new Map(own.map((r) => [r.rule.id, r]));
  for (const origin of new Set(routedHere.map((p) => p.onTransition))) {
    for (const inherited of resolvePreconditions(module, origin, [...seen, code])) {
      if (bypassed.has(inherited.rule.id)) continue;
      // This edge declared the same id itself, so its own wins: an explicit override of the inherited one, and it is not evaluated twice
      if (byId.has(inherited.rule.id)) continue;
      // If the entry that came back from recursion already has a source, that is the edge that declared it — keep it, do not overwrite it with this layer's origin.
      // Overwriting points the user at the middle hop of a chain, and that edge has nothing written on it
      byId.set(inherited.rule.id, { rule: inherited.rule, inheritedFrom: inherited.inheritedFrom ?? origin });
    }
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// "A draft may omit it, submit requires it" — project the second tier of required into something the screen can read
// ---------------------------------------------------------------------------

/**
 * One requirement that "this cell must have a value on that edge".
 *
 * It is not a new declaration slot. It is the reverse projection of a `required_fields` precondition: the declaration says
 * "this edge wants these cells", and the screen asks "which edges want this cell".
 */
export interface FieldRequiredOnTransition {
  /** The edge that requires it (a transition code) */
  readonly transition: string;
  /** The id of the rule that made the requirement — this is what a user looks up when they go to change the declaration */
  readonly ruleId: string;
  /**
   * The tier of this rule.
   *
   * 🔴 Only `block` is really "it cannot be taken if this is empty". `warn` / `hint` do not block, and drawing them as required is a lie;
   * `route` is even less required — it says "do not take this edge, take that one". The consumer chooses the tier.
   * This projection does not filter it out: after filtering, "why this cell has an asterisk" can no longer be answered from the data.
   */
  readonly level: Level;
  /**
   * Non-null means this rule was inherited from the `inheritedFrom` edge (a route exit edge inherits the start edge's gates).
   *
   * 🔴 It must be carried all the way to the screen and the CLI, the same discipline as `ResolvedPrecondition.inheritedFrom`:
   * a rule this edge did not write still wants this cell, and if the source is not said, the user's next step is to edit a declaration that does not exist.
   */
  readonly inheritedFrom: string | null;
  /**
   * This rule has a `when` guard, so the requirement is conditional (it holds only for one kind of document).
   *
   * 🔴 Flattening it into an unconditional required is another form of lying: after "only a factory must fill a parent" is drawn as a red star,
   * a workshop document shows a star that cannot be filled and should not be filled, and it blocks nothing.
   */
  readonly conditional: boolean;
  /** The sentence the rule wrote itself; null when omitted (the primitive explains itself) */
  readonly message: string | null;
}

/**
 * Which fields are wanted by `required_fields` on which edges — field key to the edges that want it.
 *
 * ── Why this projection is needed ────────────────────────────────────────
 *
 * "Required" in this repo is two tiers (AGENTS.md, "validation is two layers"):
 *   · `Field.required` — required as soon as it is stored, drafts included (compiled to a NOT NULL column);
 *   · a `required_fields` precondition on an edge — a draft may omit it, and submit requires it.
 *
 * Both tiers are deliberate: changing `salesOrder.warehouseId` (which warehouse ships waits for warehouse scheduling)
 * and `promiseDate` (a phone order whose delivery date is not set yet) to `required` would make that kind of draft impossible to store,
 * and push-down and one-sentence document creation by an AI would 400 with it.
 *
 * 🔴 What was missing was never the criterion. It was the screen saying the second tier: the renderer's only basis for a red star is `field.required`,
 * and it does not read preconditions at all. So "required on submit" has zero visual signal on the form — the user is told only after filling it in and clicking submit,
 * which is exactly when this tier most needs to be said in advance. This is a gap in the framework, not a bug in one module,
 * so the exit is a derivation (declaration to a consumable value), not a third required slot on `Field`.
 *
 * ── Three points ─────────────────────────────────────────────────────────
 *
 * 🔴 It must go through `resolvePreconditions`. It must not scan `module.preconditions` directly:
 * a route exit edge inherits every gate of the start edge. A direct scan would show none of the inherited required cells on the exception edge,
 * while the user on that edge would still be blocked by them — "the screen says less than the gate" is exactly what the inheritance mechanism prevents.
 * `onTransition: "*"` is the same: `resolvePreconditions` expands it onto every edge.
 *
 * 🔴 It recognizes only header fields: `required_fields` evaluation reads `ctx.bill[key]` (the primitive's own definition),
 * and line columns are outside its expressive range. Required on a line is still only the one tier of `Field.required`.
 *
 * 🔴 It does not filter tiers for the consumer, and it does not drop cells that are already `required`: it only answers "what the declaration wrote".
 * Choosing a tier (only `block` counts as required) and deduping (do not draw a second star when the first tier already drew one) are presentation decisions.
 * Mixing them into the derivation would make one projection unable to serve the form, `explain`, and the agent contract at the same time.
 *
 * A zero-IO pure function. Parameters are taken by structure (same as `resolvePreconditions`). It does not consume `ModuleSchema` —
 * the kernel does not create a module ↔ preconditions cycle for one projection.
 */
export function transitionRequiredFieldsOf(module: {
  readonly preconditions: readonly Precondition[];
  readonly lifecycle: { readonly transitions: readonly TransitionActionSource[] };
}): ReadonlyMap<string, readonly FieldRequiredOnTransition[]> {
  const out = new Map<string, FieldRequiredOnTransition[]>();

  // Gates are attached by action code. Several starts of the same action share one set of gates: walk by action, not by edge
  for (const edge of transitionActions(module.lifecycle)) {
    for (const resolved of resolvePreconditions(module, edge.code)) {
      const check = resolved.rule.check;
      if (check === null || check.primitive !== REQUIRED_FIELDS_PRIMITIVE) continue;
      // The field list uses the primitive's own `billFields` projection (for `required_fields` that copy is exactly `p.fields`).
      // Do not `as` a parameter structure out here — same note as `availabilityOf`:
      // after a parameter structure is copied, a renamed parameter on the primitive makes this look up the wrong thing silently
      for (const key of checkBillFields(check)) {
        const list = out.get(key) ?? [];
        // The same rule writing the same cell twice counts once; a same-named rule across edges is two real requirements, and both stay
        if (list.some((e) => e.transition === edge.code && e.ruleId === resolved.rule.id)) continue;
        list.push({
          transition: edge.code,
          ruleId: resolved.rule.id,
          level: resolved.rule.level,
          inheritedFrom: resolved.inheritedFrom,
          conditional: resolved.rule.when !== null,
          message: resolved.rule.message,
        });
        out.set(key, list);
      }
    }
  }

  return out;
}

/**
 * Plain words for the form's second tier of required: it may be empty now, and it must be filled before these edges.
 *
 * Only `block` rules with no `when` are included — `warn` does not stop a person, and a conditional gate holds for only one kind of document.
 * The shape is separate from `transitionRequiredFieldsOf`: that one is "what the declaration wrote", and this one is
 * "what the screen should say". Consumers must not each write their own sentence, or the console and the kernel form drift into two wordings.
 */
export function requiredLaterHintsOf(module: {
  readonly preconditions: readonly Precondition[];
  readonly lifecycle: { readonly transitions: readonly TransitionActionSource[] };
}): Readonly<Record<string, string>> {
  const actionOf = (code: string): string => {
    const action = transitionAction(module.lifecycle, code);
    // The entry was projected from these actions; not finding one can only mean the derivation and the declaration disagree
    if (action === null) schemaFail(`second-tier required points at an action "${code}" that does not exist`);
    return action.action;
  };
  const out: Record<string, string> = {};
  for (const [key, entries] of transitionRequiredFieldsOf(module)) {
    const hard = entries.filter((entry) => entry.level === "block" && !entry.conditional);
    if (hard.length === 0) continue;
    const where = [...new Set(hard.map((entry) => actionOf(entry.transition)))];
    const inherited = [
      ...new Set(hard.map((entry) => entry.inheritedFrom).filter((value): value is string => value !== null)),
    ];
    out[key] =
      `May be left empty for now; required before "${where.join('" / "')}"` +
      (inherited.length > 0 ? ` (rule inherited from ${inherited.join(", ")})` : "");
  }
  return out;
}

/** An invariant cannot be turned off: any write that tries to turn it off is stopped here */
export function setPreconditionEnabled(pc: Precondition, enabled: boolean): Precondition {
  if (pc.source === "invariant") {
    schemaFail(`precondition ${pc.id} is an invariant and cannot be turned off — if it could, the field model would be fake`);
  }
  return { ...pc, enabled };
}

// ---------------------------------------------------------------------------
// Evaluation result — four shapes, and there is no fifth
// ---------------------------------------------------------------------------

export type PreconditionResult =
  | { readonly pass: true }
  | {
      readonly pass: false;
      readonly level: Exclude<Level, "route">;
      readonly message: string;
      /** An external permission projection may replace the hidden warn text with an opaque token. */
      readonly confirmationToken?: string;
    }
  | { readonly pass: false; readonly level: "route"; readonly message: string; readonly exit: string };

export const PASS: PreconditionResult = Object.freeze({ pass: true });

export function fail(level: Level, message: string, exit?: string): PreconditionResult {
  if (level === "route") {
    if (!exit) schemaFail("a route level must give an exit — a rule with no exit is a wall, not a door");
    return Object.freeze({ pass: false, level, message, exit });
  }
  return Object.freeze({ pass: false, level, message });
}

/** Merge several conclusions on the same edge: take the strictest; at the same level take the first. All pass means pass. */
export function worst(results: readonly PreconditionResult[]): PreconditionResult {
  let out: PreconditionResult = PASS;
  let severity = 0;
  for (const r of results) {
    if (r.pass) continue;
    const s = LEVEL_SEVERITY[r.level];
    if (s > severity) {
      severity = s;
      out = r;
    }
  }
  return out;
}
