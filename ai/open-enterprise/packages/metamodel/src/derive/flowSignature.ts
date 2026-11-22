// ---------------------------------------------------------------------------
// A flow's inputs and outputs — treat one flow as a function
//
// ## Why look at it this way
//
// A chain is several flows strung together. Whether they are strung correctly is,
// today, something a person has to remember ("after taking the order you must
// schedule production before you can ship") — and that can be computed. What each
// segment requires the system to already have, and what it leaves when it finishes,
// is written in the declaration. Once computed, a chain composes like pure functions:
// the previous segment's outputs feed the next segment's inputs, and a mismatch is
// marked on the spot instead of waiting until someone clicks and is rejected.
//
// This criterion saves a concrete hole: the previous flow leaves some document in
// status A, and the next flow explicitly forbids A (or requires it to reach B first).
// Each flow is fine on its own. Strung together they must stick — and the scene only
// shows "not in some status". Nobody knows a whole segment is missing in between.
// Which document and which status live in the domain lifecycle / related_agg. This file does not know modules.
//
// ## Three kinds of input, and they must not be mixed
//
//   `entry`  the starting document must be in a status. This is the only one that is "my own document".
//   `needs`  some other module must be in (or must not be in) certain statuses. They come from
//            `related_agg` gates on the edge — "among the production tasks under this document, completed ones are at least 1".
//   `leaves` where each module stops after the run. The next segment's `entry` and `needs` both align on it.
//
// ## What cannot be inferred must be said to be uninferable
//
// Some status changes are done by Planner (they are not on a lifecycle edge, so the
// declaration cannot infer leaves). So `leaves` is necessarily incomplete. Alignment
// therefore has two bands:
//
//   `broken`  the previous segment left some module in a status this segment explicitly forbids — a definite break.
//   `unknown` this segment wants some module in a status, and no segment in the chain declares that it produces it —
//             it may be synced by Planner, or a whole segment may really be missing.
//
// Reporting the second band as red too would turn almost every chain red, and then
// nobody would look at the hints. Reporting none of them would leave the gap the
// declaration cannot infer, and that only Planner fills, visible only when a person steps on it.
// ---------------------------------------------------------------------------

import type { ModuleSchema } from "../schema/module.js";
import type { FlowSchema } from "../schema/flow.js";
import { resolvePreconditions } from "../schema/preconditions.js";
import { flowCapabilityOf, type FlowCapability } from "./flowCapability.js";

type ModuleLookup = ReadonlyMap<string, ModuleSchema>;

/** "Some other module must (or must not) be in these statuses". `wanted` splits the two directions. */
export interface FlowNeed {
  /** The module being required. */
  readonly module: string;
  readonly moduleLabel: string;
  /** Statuses named by the gate. An empty array means any status (count the rows only). */
  readonly statuses: readonly string[];
  /**
   * `true`  at least this many must exist (`gte 1`, `gt 0`) — upstream must deliver it into these statuses;
   * `false` none may exist (`eq 0`, `lte 0`) — upstream must not leave it in these statuses.
   */
  readonly wanted: boolean;
  /** Which step wants it (the step key in the flow), so an error can point back. */
  readonly step: string;
  /** The gate's own sentence. */
  readonly why: string;
}

export interface FlowSignature {
  readonly code: string;
  readonly label: string;
  /** The starting document: there must be a `module` in `status`. Null when the start is an offline action. */
  readonly entry: { readonly module: string; readonly moduleLabel: string; readonly status: string } | null;
  readonly needs: readonly FlowNeed[];
  /** Where each module stops after the run. Does not include the ones Planner syncs (see the file header). */
  readonly leaves: Readonly<Record<string, string>>;
  /** Document modules created along the way. */
  readonly documents: readonly string[];
}

/**
 * Shape of a `related_agg` gate. Only this one can be read — other gates cannot say
 * "which module must be in which status".
 *
 * After normalization the parameters are in `params`, not spread on the check.
 * Reading them the way the declaration is written matches nothing, and the symptom
 * is "this flow has no cross-module precondition" — it looks completely normal,
 * except every chain becomes "it connects". The same hole was stepped on once on the prep-hints side.
 */
interface RelatedAgg {
  readonly primitive?: unknown;
  readonly params?: {
    readonly from?: unknown;
    readonly where?: unknown;
    readonly op?: unknown;
    readonly right?: { readonly value?: unknown };
  };
}

/** `where: { status: "completed" }` or `{ status: [...] }`. Other keys that cannot be read count as unrestricted. */
function statusesIn(where: unknown): readonly string[] {
  if (where === null || typeof where !== "object") return [];
  const raw = (where as Record<string, unknown>)["status"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((one): one is string => typeof one === "string");
  return [];
}

/**
 * "At least some must exist" versus "none may exist".
 *
 * A comparison that cannot be read (a range, or a comparison against another field)
 * returns null, and the whole row is dropped. The cost of guessing a direction is
 * reading "must not exist" as "must exist", so the alignment check reports the opposite —
 * which is worse than not reporting.
 */
function directionOf(op: unknown, value: unknown): boolean | null {
  if (typeof value !== "number") return null;
  if ((op === "gte" || op === "gt") && value >= 0) return true;
  if ((op === "eq" || op === "lte") && value === 0) return false;
  if (op === "lt" && value <= 1) return false;
  return null;
}

function needsOf(flow: FlowSchema, modules: ModuleLookup): readonly FlowNeed[] {
  const out: FlowNeed[] = [];
  const seen = new Set<string>();
  for (const step of flow.steps) {
    if (step.kind !== "action" || step.module === null || step.transition === null) continue;
    const host = modules.get(step.module);
    if (host === undefined) continue;
    for (const { rule } of resolvePreconditions(host, step.transition)) {
      if (rule.level !== "block") continue;
      const check = rule.check as RelatedAgg | null;
      if (check === null || check.primitive !== "related_agg") continue;
      const params = check.params;
      if (params === undefined) continue;
      const from = typeof params.from === "string" ? params.from : null;
      if (from === null) continue;
      const wanted = directionOf(params.op, params.right?.value);
      if (wanted === null) continue;
      const statuses = statusesIn(params.where);
      const target = modules.get(from);
      const key = `${from}|${String(wanted)}|${statuses.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        module: from,
        moduleLabel: target?.label ?? from,
        statuses,
        wanted,
        step: step.key,
        why: rule.why,
      });
    }
  }
  return out;
}

export function flowSignatureOf(flow: FlowSchema, modules: ModuleLookup): FlowSignature {
  const capability: FlowCapability = flowCapabilityOf(flow, modules);
  const entryModule = capability.requires.module;
  const entryStatus = capability.requires.status;
  return {
    code: flow.code,
    label: flow.label,
    entry: entryModule === null || entryStatus === null
      ? null
      : {
          module: entryModule,
          moduleLabel: modules.get(entryModule)?.label ?? entryModule,
          status: entryStatus,
        },
    needs: needsOf(flow, modules),
    leaves: capability.produces.terminal,
    documents: capability.produces.documents,
  };
}

// -- Chain alignment --------------------------------------------------------

export type AlignmentLevel = "broken" | "unknown";

/**
 * Whether a person has to click to walk from status `from` to any status in `targets`.
 *
 * This layer is the criterion for "should this be marked red". A production task goes
 * from "inProduction" to "completed" through report-complete synced (internal) →
 * receipt-complete synced (internal) → confirm complete (a person must click).
 * Nothing in any flow owns that last click, so it is a break. The other way around,
 * a path that is internal the whole way is something the system syncs itself. It is
 * normal that the chain does not show it. Marking it red only makes people stop looking at these hints.
 */
function pathKind(
  module: ModuleSchema | undefined,
  from: string,
  targets: readonly string[],
): { readonly kind: "auto" | "manual" | "none"; readonly action: string | null } {
  if (module === undefined || targets.length === 0) return { kind: "none", action: null };
  const want = new Set(targets);
  // Walk internal edges first: if that reaches the target, the system syncs itself there.
  for (const onlyInternal of [true, false]) {
    const seen = new Set([from]);
    let front = [from];
    let firstManual: string | null = null;
    while (front.length > 0) {
      const next: string[] = [];
      for (const at of front) {
        for (const edge of module.lifecycle.transitions) {
          if (edge.from !== at) continue;
          if (onlyInternal && edge.internal !== true) continue;
          if (!onlyInternal && edge.internal !== true && firstManual === null) firstManual = edge.action;
          if (want.has(edge.to)) {
            return { kind: onlyInternal ? "auto" : "manual", action: onlyInternal ? null : firstManual };
          }
          if (seen.has(edge.to)) continue;
          seen.add(edge.to);
          next.push(edge.to);
        }
      }
      front = next;
    }
  }
  return { kind: "none", action: null };
}

export interface AlignmentIssue {
  /** Which segment (starting at 0). */
  readonly at: number;
  readonly flow: string;
  readonly level: AlignmentLevel;
  /** One sentence for the business to read, shown directly. */
  readonly text: string;
}

/**
 * String several flows together in order and check, segment by segment, whether they connect.
 *
 * Accumulate in order. Do not compare only adjacent pairs. A document that A creates
 * in a chain may not be used until D, with B and C in between — comparing only the
 * two neighbors hides that dependency.
 */
export function chainAlignmentOf(
  signatures: readonly FlowSignature[],
  modules: ModuleLookup = new Map(),
): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  /** So far, which status each module was left in. */
  const state = new Map<string, string>();
  /** So far, which modules have been created. */
  const born = new Set<string>();

  signatures.forEach((one, at) => {
    const say = (level: AlignmentLevel, text: string): void => {
      issues.push({ at, flow: one.code, level, text });
    };

    if (one.entry !== null) {
      const now = state.get(one.entry.module);
      if (now !== undefined && now !== one.entry.status) {
        /**
         * A path that system edges can walk the whole way is not a break. "Moving into
         * production" is now pushed by Planner at the moment the production task is
         * approved, and the flow does not show it — the previous segment's output stops
         * at "releasing", and the next segment wants "inProduction". Read literally that
         * is a break, but in practice it walks there by itself. The cost of marking it
         * red is that "production schedule to start" is flagged as unable to connect
         * even though it runs, and people then stop looking at these hints.
         */
        const road = pathKind(modules.get(one.entry.module), now, [one.entry.status]);
        if (road.kind === "auto") {
          say("unknown",
            `Segment ${String(at + 1)} "${one.label}" needs ${one.entry.moduleLabel} in "${one.entry.status}", `
            + `but the previous segment left it in "${now}" — the system will sync it automatically`);
        } else {
          say("broken",
            `Segment ${String(at + 1)} "${one.label}" needs a ${one.entry.moduleLabel} in "${one.entry.status}", `
            + `but earlier segments left it in "${now}"`
            + (road.action === null ? "" : ` — a segment is missing: someone must press "${road.action}"`));
        }
      } else if (now === undefined && !born.has(one.entry.module) && at > 0) {
        /**
         * A document that can be created by hand is not a gap: a material issue or a
         * finished-goods receipt is opened by this segment itself. It is normal that
         * earlier segments never touched it. Reporting that too would let a six-segment
         * chain produce three or four "unclear" lines, and they are all noise — the one
         * that actually needs to be read gets buried.
         */
        if (modules.get(one.entry.module)?.creatable.manual !== true) {
          say("unknown",
            `Segment ${String(at + 1)} "${one.label}" starts from ${one.entry.moduleLabel}, `
            + `but it can only be produced by an upstream push — the chain is missing the segment that produces it`);
        }
      }
    }

    for (const need of one.needs) {
      const now = state.get(need.module);
      if (need.wanted) {
        // Must exist: upstream has to deliver it into these statuses.
        if (now !== undefined && need.statuses.length > 0 && !need.statuses.includes(now)) {
          const road = pathKind(modules.get(need.module), now, need.statuses);
          if (road.kind === "auto") {
            say("unknown",
              `Segment ${String(at + 1)} "${one.label}" requires ${need.moduleLabel} to be in `
              + `"${need.statuses.join("/")}", but it is "${now}" — the system will sync it automatically, and the chain does not show that step`);
          } else {
            say("broken",
              `Segment ${String(at + 1)} "${one.label}" requires ${need.moduleLabel} to have at least one record in `
              + `"${need.statuses.join("/")}", but earlier segments left it in "${now}"`
              + (road.action === null
                ? ", and it cannot be reached from there"
                : ` — a segment is missing: someone must press "${road.action}"`));
          }
        } else if (now === undefined) {
          say("unknown",
            `Segment ${String(at + 1)} "${one.label}" requires ${need.moduleLabel} `
            + (need.statuses.length === 0 ? "to have a record" : `to be in "${need.statuses.join("/")}"`)
            + `, and no segment in the chain declares that it produces one (the system may sync it automatically, or a segment may be missing)`);
        }
      } else if (now !== undefined && need.statuses.includes(now)) {
        // "Must not exist" is violated. This band does not look at how the path is walked.
        // Being left in the forbidden status is itself the break.
        // Must not exist: upstream left it exactly in the forbidden status — a definite break.
        say("broken",
          `Segment ${String(at + 1)} "${one.label}" does not allow ${need.moduleLabel} to remain in "${now}", `
          + `but earlier segments left it there — ${need.why}`);
      }
    }

    for (const [module, status] of Object.entries(one.leaves)) state.set(module, status);
    for (const module of one.documents) born.add(module);
  });

  return issues;
}
