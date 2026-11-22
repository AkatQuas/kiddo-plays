// ---------------------------------------------------------------------------
// Cross-module flow validation — "does the edge this flow names really exist, and does it connect?"
//
// `schema/flow.ts` only checks what one declaration can see by itself (shape, unique keys,
// a branch pointing at a real step of this flow). This layer needs the **whole module table**:
// whether the edge exists, whether statuses connect, and whether the role is known.
//
// ## Two severities. The rule is "typo or intent"
//
//   `fatal`  the edge does not exist / the module does not exist / the role does not exist / the query is illegal
//            — in a declaration that lives in git these **can only be written wrong**, so load time fails immediately.
//
//   `gap`    finishing the previous step does not meet the next / the branch condition cannot reach that edge / a step is unreachable
//            — these **may be deliberate**: the person arranging the flow knows an edge is missing, draws the picture through, and
//            waits for development to fill it. That is why the "to be completed" tier exists. Record it; do not fail.
//
// They are split because the correct handling differs. If everything hard-fails, "I know an edge is missing here"
// has nowhere to be expressed, and the person can only delete the step — after which nobody knows what the system lacks.
// If everything is only recorded, a misspelled transition silently downgrades the flow to "to be completed",
// and that is a typo, not a requirement.
//
// ## System edges join the continuity judgment, but they do not enter the step table
//
// A real shape in production: after `productionOrder.complete` ("complete") finishes, `salesOrder` is still
// "inProduction"; the next step "ship" requires "awaitingShipment". The bridge is
// `salesOrder.releaseToShip` ("production finished, ready to ship") — `internal: true`, **nobody can click it**.
//
// A system edge cannot enter the step table: the executor would then wait on a button that does not exist. It must still join
// the continuity judgment, or every normal business flow would be misreported as "does not connect". So:
// **a hop through one or more internal edges is allowed, and that stretch is marked** (the detail page shows "the system advances this automatically").
//
// Zero IO. It needs the **complete** module table: on a partial table "missing edge" and "never related" look identical.
// ---------------------------------------------------------------------------

import { hasTransitionAt, transitionAt, transitionEdges } from "../derive/engine.js";
import { normalizeQuery } from "../normalize/query.js";
import type { ModuleSchema } from "../schema/module.js";
import { transitionAction, type Transition } from "../schema/lifecycle.js";
import type { FlowSchema, FlowStep } from "../schema/flow.js";

export type FlowProblemSeverity = "fatal" | "gap";

export interface FlowProblem {
  readonly flow: string;
  /** Key of the step that has the problem; null for a problem of the whole flow. */
  readonly step: string | null;
  readonly severity: FlowProblemSeverity;
  /** Stable code. The board classifies by it, and the frontend picks copy by it. */
  readonly code: string;
  readonly message: string;
}

export interface FlowValidateInput {
  /** The **complete** module table. */
  readonly modules: ReadonlyMap<string, ModuleSchema>;
  /**
   * Declared role codes.
   *
   * An empty set means the caller did not provide a role catalog, so **skip this check** — do not use a blank list to reject
   * every role (that would turn "you did not tell me the choices" into "everything you wrote is wrong"). Same as quickAsk's
   * insightScenarios.
   */
  readonly roles: ReadonlySet<string>;
}

/**
 * Statuses the bill of this step may land in after the step finishes. A non-action step has no landing.
 *
 * It is a set, not a single value: a step names an action code, and the same action has one edge on each of several statuses, with different landings.
 * When the flow context can determine the start, the set has one status; when it cannot, it is the landing of every edge of this action.
 */
interface Landing {
  readonly module: string;
  readonly statuses: readonly string[];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

/** "A" or "B" — how a set of statuses is read in copy. */
function oneOf(statuses: readonly string[]): string {
  return statuses.map((status) => `"${status}"`).join(" or ");
}

/**
 * The edges an action step **can actually take** in this flow.
 *
 * A flow step names an action code. When the flow itself can give a start — every line into this step wrote
 * `whenStatus` (that is "which status the next edge starts from") — resolve those edges with `transitionAt`;
 * when it cannot (the entry, or a line with no condition), count every edge of this action.
 * A start written on the line that has no edge for this action is `FLOW_BRANCH_STATUS_MISMATCH`'s job. This function does not
 * narrow that to an empty set; it still counts every edge's landing — otherwise one typo would erase every downstream continuity judgment.
 *
 * A step whose module or action does not exist, or whose action is a system edge, does not appear in the result (`validateFlow` reports fatal separately).
 */
export function flowStepEdges(
  flow: FlowSchema,
  modules: ReadonlyMap<string, ModuleSchema>,
): ReadonlyMap<string, readonly Transition[]> {
  const incoming = new Map<string, (string | null)[]>();
  for (const step of flow.steps) {
    for (const branch of step.next) {
      const list = incoming.get(branch.to) ?? [];
      list.push(branch.whenStatus);
      incoming.set(branch.to, list);
    }
  }
  const out = new Map<string, readonly Transition[]>();
  for (const step of flow.steps) {
    if (step.kind !== "action" || step.module === null || step.transition === null) continue;
    const module = modules.get(step.module);
    if (module === undefined) continue;
    const action = transitionAction(module.lifecycle, step.transition);
    if (action === null || action.internal === true) continue;
    const all = transitionEdges(module, step.transition);
    const froms = incoming.get(step.key) ?? [];
    if (froms.length === 0 || froms.includes(null)) {
      out.set(step.key, all);
      continue;
    }
    const code = step.transition;
    const resolved = unique(froms as readonly string[])
      .filter((status) => hasTransitionAt(module, status, code))
      .map((status) => transitionAt(module, status, code));
    out.set(step.key, resolved.length > 0 ? resolved : all);
  }
  return out;
}

/**
 * Every status reachable from `start` by walking only `internal` edges (including start itself).
 *
 * Walking only system edges is deliberate: an edge a person can click is the **next step**, not a "bridge". Counting those too
 * would declare "if the graph connects at all, it connects", which is exactly what this gate exists to stop.
 */
function reachableByInternal(module: ModuleSchema, start: string): ReadonlySet<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const edge of module.lifecycle.transitions) {
      if (edge.internal !== true || edge.from !== at || seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return seen;
}

/** The system edge used as a bridge, so the sentence "the system advances this automatically" can name it. */
function internalPathText(module: ModuleSchema, from: string, to: string): string {
  for (const edge of module.lifecycle.transitions) {
    if (edge.internal !== true || edge.from !== from) continue;
    if (edge.to === to) return `${module.label} "${edge.action || edge.code}"`;
  }
  return `the system advance of ${module.label}`;
}

/** Whether two bills are linked: a ref field pointing at the other exists in either direction (including line columns). */
function linked(a: ModuleSchema, b: ModuleSchema): boolean {
  const pointsAt = (from: ModuleSchema, target: string): boolean => {
    for (const field of from.fields) {
      if (field.type === "ref" && field.ref === target) return true;
      if (field.type !== "subtable") continue;
      for (const column of field.fields ?? []) {
        if (column.type === "ref" && column.ref === target) return true;
      }
    }
    return false;
  };
  return pointsAt(a, b.code) || pointsAt(b, a.code);
}

/**
 * Validate one flow. Returns the problem list and **does not throw** — the caller decides failure or record from the severity.
 */
export function validateFlow(flow: FlowSchema, input: FlowValidateInput): readonly FlowProblem[] {
  const problems: FlowProblem[] = [];
  const add = (step: string | null, severity: FlowProblemSeverity, code: string, message: string): void => {
    problems.push({ flow: flow.code, step, severity, code, message });
  };

  const byKey = new Map(flow.steps.map((step) => [step.key, step] as const));
  /** step key → where this step lands. A non-action step has none. */
  const landing = new Map<string, Landing>();
  const edgesOfStep = flowStepEdges(flow, input.modules);

  // ── Step by step: does the coordinate exist ──
  for (const step of flow.steps) {
    if (step.actor !== null && input.roles.size > 0 && !input.roles.has(step.actor)) {
      add(
        step.key,
        "fatal",
        "FLOW_ACTOR_UNKNOWN",
        `responsible role "${step.actor}" does not exist — choices: ${[...input.roles].sort().join(" / ")}`,
      );
    }
    // ── Branches: reject only a real duplicate ──
    //
    // **Two outgoing lines that start from the same status are the branch itself.** After a sales order is approved it is "awaitingShipment",
    // and from there it can either go to production or ship to completion — a real business fork,
    // and which leg to take is judged on the spot. Treating "two outgoing lines from the same start status" as an error once blocked this most common
    // branch shape; likewise, "a conditioned line plus an unconditioned line" was blocked once (the unconditioned line is "otherwise").
    //
    // Both mistakes were the same mistake: reading `whenStatus` as "which status it lands in", when it says
    // **which status the next edge must start from** — the legs of a branch often share a source.
    //
    // "Once A is configured, B cannot be added" is **not blocked here**: that belongs to the plus menu (a coordinate already configured
    // is removed from the candidates). Blocking it in validation makes a person draw it wrong and then get scolded.
    //
    // The only case with no answer is a duplicate: two lines point at the same step, or at the same edge.
    const seenTo = new Set<string>();
    const edgeSeen = new Map<string, string>();
    for (const branch of step.next) {
      if (seenTo.has(branch.to)) {
        add(step.key, "fatal", "FLOW_BRANCH_AMBIGUOUS",
          `two lines both point at "${branch.to}" — the same thing was drawn twice`);
      }
      seenTo.add(branch.to);

      const target = byKey.get(branch.to);
      if (target === undefined || target.module === null || target.transition === null) continue;
      const key = `${target.module}.${target.transition}`;
      const first = edgeSeen.get(key);
      if (first !== undefined) {
        add(step.key, "fatal", "FLOW_BRANCH_AMBIGUOUS",
          `"${first}" and "${target.label}" are the same action (${key}) — ` +
            `a branch must split onto different actions, otherwise both paths do the same thing`);
      }
      edgeSeen.set(key, target.label);
    }

    if (step.module === null) continue;

    const module = input.modules.get(step.module);
    if (!module) {
      add(step.key, "fatal", "FLOW_MODULE_UNKNOWN", `module "${step.module}" does not exist`);
      continue;
    }

    if (step.kind === "query") {
      try {
        normalizeQuery(module, { where: step.where ?? null }, `flow "${flow.code}" step "${step.key}".where`);
      } catch (cause) {
        add(
          step.key,
          "fatal",
          "FLOW_QUERY_INVALID",
          `query condition is illegal — ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
      continue;
    }

    // kind === 'action' (the shape gate already guarantees transition is non-empty)
    const action = transitionAction(module.lifecycle, step.transition!);
    if (!action) {
      const usable = module.lifecycle.transitions
        .filter((t) => t.internal !== true)
        .map((t) => `${t.code} (${t.action}: ${t.from}→${t.to})`);
      add(
        step.key,
        "fatal",
        "FLOW_TRANSITION_UNKNOWN",
        `module "${module.label}" has no action "${step.transition}". ` +
          `Edges a person can click: ${usable.join(", ") || "(none)"}`,
      );
      continue;
    }
    if (action.internal === true) {
      add(
        step.key,
        "fatal",
        "FLOW_TRANSITION_INTERNAL",
        `"${step.transition}" is a system edge (internal), and nobody can click it — ` +
          `it cannot be a step of a flow. A system advance is recognized automatically in the continuity judgment and does not need to be written`,
      );
      continue;
    }
    const edges = edgesOfStep.get(step.key);
    if (edges === undefined) throw new Error(`flow "${flow.code}" step "${step.key}" resolved no edges — flowStepEdges and this validation drifted`);
    landing.set(step.key, { module: module.code, statuses: unique(edges.map((edge) => edge.to)) });
  }

  // ── Each branch: is the condition right, and does it connect ──
  for (const step of flow.steps) {
    for (const branch of step.next) {
      const target = byKey.get(branch.to)!; // normalizeFlow already guarantees it exists
      checkBranch(step, branch.whenStatus, branch.label, target);
    }
  }

  function checkBranch(
    from: FlowStep,
    whenStatus: string | null,
    branchLabel: string | null,
    to: FlowStep,
  ): void {
    // The target is an offline note: it expresses no system semantics, so continuity is not judged.
    if (to.kind === "manual" || to.kind === "note") return;

    const toModule = to.module === null ? null : input.modules.get(to.module);
    if (!toModule) return; // FLOW_MODULE_UNKNOWN was already reported above

    // Statuses the next action can start from (the starts of all of its edges). When the action does not exist or is a system edge,
    // fatal was already reported above, and there is no start to judge here.
    const toAction = to.kind === "action" ? transitionAction(toModule.lifecycle, to.transition!) : null;
    const startable =
      toAction === null || toAction.internal === true
        ? null
        : unique(transitionEdges(toModule, toAction.code).map((edge) => edge.from));

    // A branch condition must be a status the target action can really start from. Written wrong, this branch can never be taken,
    // and the UI shows nothing unusual — so it deserves its own report.
    if (whenStatus !== null && startable !== null && !startable.includes(whenStatus)) {
      add(
        from.key,
        "gap",
        "FLOW_BRANCH_STATUS_MISMATCH",
        `branch${branchLabel ? ` "${branchLabel}"` : ""} condition is "${whenStatus}", ` +
          `but the next step "${to.label}" must start from ${oneOf(startable)} — this branch cannot be taken`,
      );
    }

    const landed = landing.get(from.key);
    if (!landed || startable === null) return; // the previous step is not an action, or the next step is a query: no status to connect

    // This line wrote a start and it matches, so the next step starts from that one status; otherwise judge by every start of this action.
    const needed = whenStatus !== null && startable.includes(whenStatus) ? [whenStatus] : startable;

    if (landed.module === toModule.code) {
      if (landed.statuses.some((status) => needed.includes(status))) return;
      for (const status of landed.statuses) {
        const bridged = reachableByInternal(toModule, status);
        const target = needed.find((one) => bridged.has(one));
        if (target === undefined) continue;
        add(
          from.key,
          "gap",
          "FLOW_SYSTEM_BRIDGE",
          `finishing this step is "${status}", and the next step needs "${target}" — in between ` +
            `${internalPathText(toModule, status, target)} advances automatically. This is not an error, ` +
            `and the detail page marks this stretch "the system advances this automatically"`,
        );
        return;
      }
      add(
        from.key,
        "gap",
        "FLOW_STATUS_DISCONTINUOUS",
        `finishing this step lands ${toModule.label} on ${oneOf(landed.statuses)}, ` +
          `but the next step "${to.label}" must start from ${oneOf(needed)} — a step is missing in between. ` +
          `Either a step was not drawn here, or the system is missing an edge`,
      );
      return;
    }

    // Across modules: the statuses belong to two different bills, so status continuity is not judged; **linkage** is.
    // Two steps with no linkage placed together make a reader assume a cause, and the system has none.
    const fromModule = input.modules.get(landed.module);
    if (!fromModule) return;

    const pushedHere = (toModule.creatable.pushedFrom ?? []).some(
      (origin) => origin.module === from.module && origin.transition === from.transition,
    );
    if (pushedHere) return;
    if (linked(fromModule, toModule)) return;

    add(
      from.key,
      "gap",
      "FLOW_NO_LINKAGE",
      `the previous step is on ${fromModule.label} and the next step is on ${toModule.label}, ` +
        `and the two bills have neither a push nor a reference — placed together a reader would assume a cause, but the system has none`,
    );
  }

  // ── Unreachable steps ──
  const reached = new Set<string>([flow.entry]);
  const queue = [flow.entry];
  while (queue.length > 0) {
    const at = byKey.get(queue.shift()!);
    if (!at) continue;
    for (const branch of at.next) {
      if (reached.has(branch.to)) continue;
      reached.add(branch.to);
      queue.push(branch.to);
    }
  }
  // The error names the **step label**, not the key. This copy is shown on the board and the canvas,
  // and the readers there are product and sales — they cannot read `issue`, and they can read "confirm material issue" at a glance.
  const entryLabel = byKey.get(flow.entry)?.label ?? flow.entry;
  for (const step of flow.steps) {
    if (reached.has(step.key)) continue;
    add(
      step.key,
      "gap",
      "FLOW_STEP_UNREACHABLE",
      `walking from the start "${entryLabel}" never reaches this step — either a line pointing here is missing, or this step should be deleted`,
    );
  }

  return problems;
}

/** A fatal problem means the declaration was written wrong, and load time should fail. */
export function hasFatal(problems: readonly FlowProblem[]): boolean {
  return problems.some((problem) => problem.severity === "fatal");
}

/**
 * Derive flow status from the problem list.
 *
 * Only "is there a gap" is distinguished: `draft` / `review` are states of the **arrangement process**, stored in the tenant database,
 * and are not derived from the declaration. A product baseline in git can only be "usable" or "something is missing".
 *
 * `FLOW_SYSTEM_BRIDGE` is not a gap — it is the normal shape of a normal business flow,
 * and it is recorded only so the detail page can mark that stretch.
 */
export function isGapBlocking(problem: FlowProblem): boolean {
  return problem.severity === "gap" && problem.code !== "FLOW_SYSTEM_BRIDGE";
}
