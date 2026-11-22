// ---------------------------------------------------------------------------
// Capability projection of a flow — what one flow requires and what it produces
//
// ## Why this is derived, not declared
//
// The person arranging the flow writes steps on the canvas. "What is this flow's
// entry condition, and what is left when it finishes" is decided entirely by those
// steps. Asking a person to fill it in again is a second source of truth, and the
// second copy will drift: someone changes the entry step, requires does not follow,
// and the arranger wires against a stale entry condition. It connects, and only
// when it runs does anyone see that the document status is wrong.
//
// ## Three consumers, one projection
//
//   1. Cross-flow dependency: A.produces satisfies B.requires, so A is upstream of B
//      (the board's "blocked")
//   2. Executor prefix chain: requires says "a document in this status is needed",
//      and the prefix chain searches the shortest path from that
//   3. External capability list: requires/produces of published flows is the
//      machine-readable interface for "which jobs this system will do"
//      (cross-system orchestration and A2A capability cards are later projections of this same copy)
//
// ## The postings cell cannot be omitted
//
// The real shape hit while writing this projection: `receivable` has no non-internal
// edge. It is recorded entirely by `ar.in` on `salesDelivery.confirm`. So "this flow
// produced a receivable" cannot be inferred from the terminal status and the push alone.
//
// What downstream wants was never "there is a receivable document". It is "this
// amount has been posted". So the output must include the ledger entries written
// along the way. This cell is the real interface for cross-system connection.
//
// Zero IO: it only consumes the module table and the flow declaration.
// ---------------------------------------------------------------------------

import { gateOf } from "./operations.js";
import { fieldLabelsOf } from "./labels.js";
import { transitionEdges } from "./engine.js";
import { resolvePreconditions } from "../schema/preconditions.js";
import type { ModuleSchema } from "../schema/module.js";
import { transitionAction, type Transition } from "../schema/lifecycle.js";
import type { FlowSchema, FlowStep } from "../schema/flow.js";
import { flowStepEdges } from "../validate/flow.js";

/** Coordinate of one edge, in `module.transition` form. Coverage, impact, and the capability projection all align on it. */
export type EdgeKey = string;

export function edgeKeyOf(module: string, transition: string): EdgeKey {
  return `${module}.${transition}`;
}

/** One sentence the entry edge uses to stop a person. Same construction site as `explain`, the tool catalog, and the UI (`gateOf`). */
export interface FlowGuardText {
  readonly id: string;
  readonly level: string;
  /** The rule in words a business reader can follow. */
  readonly rule: string;
  readonly why: string;
}

/**
 * What must already exist in the system before this flow can run.
 *
 * `module` + `status` is the search target of the executor's prefix chain. `guards`
 * are "even if the status is right, these may still stop it" — the `block`-level
 * gates on the entry edge.
 */
export interface FlowRequires {
  /** Module of the entry step. Null when entry is manual/note (this flow has no entry that can be checked). */
  readonly module: string | null;
  /** `from` status of the entry edge. */
  readonly status: string | null;
  readonly guards: readonly FlowGuardText[];
  /** One sentence for a person. The detail page and the agent's task use it directly. */
  readonly text: string;
}

/**
 * What the system has left after this flow finishes.
 *
 * The three cells answer different questions and cannot stand in for each other:
 *   terminal   where each document stopped — the next flow's entry aligns on this
 *   documents  which new documents were created — including pushes and ones Planner built
 *   postings   which ledger entries were written — the cell downstream actually wants
 */
export interface FlowProduces {
  /** Module code → the status it stops in after this flow finishes. */
  readonly terminal: Readonly<Record<string, string>>;
  /** Downstream document module codes created along the way, deduped, in first-seen order. */
  readonly documents: readonly string[];
  /** Ledger entries written along the way, in `target.op` form (such as `ar.in`, `stock.out`), deduped, in first-seen order. */
  readonly postings: readonly string[];
}

export interface FlowCapability {
  readonly code: string;
  readonly label: string;
  readonly domain: string;
  readonly purpose: string;
  readonly owner: string | null;
  readonly triggerWords: readonly string[];
  /** Number of steps that walk an edge (`manual` / `note` do not count — they are not something the system can do). */
  readonly actionSteps: number;
  readonly requires: FlowRequires;
  readonly produces: FlowProduces;
  /** Edge coordinates this flow covers, deduped. */
  readonly edges: readonly EdgeKey[];
}

type ModuleLookup = ReadonlyMap<string, ModuleSchema>;

/**
 * Cells in the projection that hold only one status (entry status, terminal) must
 * pick one representative edge from several: the one whose start is earliest in the
 * status table — the one reached first when the flow walks from the beginning.
 *
 * Used only when the flow context cannot give a unique start (the entry, or a line
 * with no condition). When it can, `flowStepEdges` has already narrowed to one.
 * The place that judges whether it connects (`validateFlow`) does not pick a
 * representative; it judges by the set.
 */
function earliestEdge(module: ModuleSchema, edges: readonly Transition[]): Transition {
  const order = (edge: Transition): number =>
    module.lifecycle.statuses.findIndex((status) => status.key === edge.from);
  const [first, ...rest] = edges;
  if (first === undefined) throw new Error(`Action on "${module.label}" has no edge — transitionEdges must not return empty`);
  return rest.reduce((best, edge) => (order(edge) < order(best) ? edge : best), first);
}

/** Push target: the declaration may be a string or an object. After normalization both are read from `push`. */
function pushTargetOf(transition: Transition): string | null {
  const raw: unknown = transition.push;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { module?: unknown }).module === "string") {
    return (raw as { module: string }).module;
  }
  return null;
}

function guardsOf(module: ModuleSchema, transitionCode: string): readonly FlowGuardText[] {
  // Gates hang on the action: every edge of the same action shares the same gates and the same parameter names.
  const labels = fieldLabelsOf(module, transitionAction(module.lifecycle, transitionCode));
  return resolvePreconditions(module, transitionCode)
    .map(({ rule, inheritedFrom }) => gateOf(rule, inheritedFrom, labels))
    // Take block only. warn does not stop a person. Counting it as an entry condition
    // makes the arranger think the flow cannot connect. route must not count either —
    // it is exactly "which edge to take after being stopped", an exit, not a threshold.
    .filter((gate) => gate.level === "block")
    .map((gate) => ({ id: gate.id, level: gate.level, rule: gate.rule, why: gate.why }));
}

/** Only `action` / `query` point at a real module. `manual` / `note` are always null (the shape gate already guarantees that). */
function actionSteps(flow: FlowSchema): readonly FlowStep[] {
  return flow.steps.filter((step) => step.kind === "action" && step.module !== null && step.transition !== null);
}

function requiresOf(flow: FlowSchema, modules: ModuleLookup): FlowRequires {
  const entry = flow.steps.find((step) => step.key === flow.entry) ?? null;
  if (entry === null || entry.kind !== "action" || entry.module === null || entry.transition === null) {
    // entry is manual/note: this flow starts from an offline action. The system has
    // no entry that can be checked. Do not invent a fake entry condition — the
    // arranger sees module null and knows it cannot connect, which is correct.
    return { module: null, status: null, guards: [], text: "No system entry (the start is an offline action)" };
  }
  const module = modules.get(entry.module);
  if (!module) {
    return { module: entry.module, status: null, guards: [], text: `Module "${entry.module}" is not in the module table` };
  }
  if (transitionAction(module.lifecycle, entry.transition) === null) {
    return {
      module: entry.module,
      status: null,
      guards: [],
      text: `Module "${module.label}" has no action "${entry.transition}"`,
    };
  }
  // The entry has no previous step to connect to. The flow walks from the start, and
  // the entry status is the earliest status this action can leave from.
  const transition = earliestEdge(module, transitionEdges(module, entry.transition));
  const guards = guardsOf(module, entry.transition);
  const head = `${module.label} is in "${transition.from}"`;
  return {
    module: entry.module,
    status: transition.from,
    guards,
    text: guards.length === 0 ? head : `${head}, and: ${guards.map((g) => g.rule).join("; ")}`,
  };
}

function producesOf(flow: FlowSchema, modules: ModuleLookup): FlowProduces {
  const terminal: Record<string, string> = {};
  const documents: string[] = [];
  const postings: string[] = [];
  const edgesOfStep = flowStepEdges(flow, modules);

  for (const step of actionSteps(flow)) {
    const module = modules.get(step.module!);
    if (!module) continue;
    const edges = edgesOfStep.get(step.key);
    if (edges === undefined) continue;
    // Effects and push declarations are identical, word for word, on every edge of
    // the same action (`normalizeLifecycle` guarantees it). The only difference is
    // the start and the landing. The landing is the edge the flow context narrowed to.
    const transition = earliestEdge(module, edges);

    // When the same module is walked more than once, the later walk overwrites the
    // earlier one — the terminal status is the last one. Step order is declaration
    // order, so this does not need to run the graph. It overwrites in order.
    terminal[module.code] = transition.to;

    const pushed = pushTargetOf(transition);
    if (pushed !== null && !documents.includes(pushed)) documents.push(pushed);

    for (const effect of transition.effects) {
      const key = `${effect.target}.${effect.op}`;
      if (!postings.includes(key)) postings.push(key);
    }
  }

  // Documents Planner creates are not on `push` (`productionOrder.release` creates
  // production tasks through Planner, and its `push` is null). So scan the module
  // table again: whoever's `creatable.pushedFrom` points at an edge this flow covers
  // is an output of this flow.
  //
  // Without this stretch, the "release to production" flow claims it produced
  // nothing, while it actually created a batch of production tasks — so the next
  // flow cannot connect, and neither side reports an error.
  const covered = new Set(actionSteps(flow).map((step) => edgeKeyOf(step.module!, step.transition!)));
  for (const module of modules.values()) {
    for (const origin of module.creatable.pushedFrom ?? []) {
      if (!covered.has(edgeKeyOf(origin.module, origin.transition))) continue;
      if (!documents.includes(module.code)) documents.push(module.code);
    }
  }

  return { terminal, documents, postings };
}

/**
 * Project one flow into a capability declaration.
 *
 * The module table passed in may be partial (for example only one domain is loaded).
 * The projection says the missing part cannot be found. It does not skip it silently.
 * A silent skip shows up as a capability list missing a cell, while the consumer
 * believes the flow really does not produce that thing.
 */
export function flowCapabilityOf(flow: FlowSchema, modules: ModuleLookup): FlowCapability {
  const steps = actionSteps(flow);
  const edges: EdgeKey[] = [];
  for (const step of steps) {
    const key = edgeKeyOf(step.module!, step.transition!);
    if (!edges.includes(key)) edges.push(key);
  }
  return {
    code: flow.code,
    label: flow.label,
    domain: flow.domain,
    purpose: flow.purpose,
    owner: flow.owner,
    triggerWords: flow.triggerWords,
    actionSteps: steps.length,
    requires: requiresOf(flow, modules),
    produces: producesOf(flow, modules),
    edges,
  };
}

/** One dependency edge: the output of `from` satisfies the entry of `to`. */
export interface FlowDependency {
  readonly from: string;
  readonly to: string;
  /**
   * The criterion. Two kinds, different strength:
   *   `status`  from left some module in to's entry status — a strong dependency, a real connection
   *   `posting` the ledger entry from wrote is the one to wants — cross-system connection uses this kind
   */
  readonly via: "status" | "posting";
  readonly detail: string;
}

/**
 * Derive dependencies between flows from the capability projection.
 *
 * Do not maintain a dependency table by hand. A hand-written copy will drift:
 * someone changes the entry step, the table does not follow, and the board's
 * "blocked #385" becomes false.
 *
 * There are only two criteria, both from the projection itself:
 *   1. A.produces.terminal[m] === B.requires.status and B.requires.module === m
 *   2. A.produces.postings covers the upstream ledger entries B declares it needs
 *      (used across systems; this repo does not produce that case yet)
 *
 * A flow depending on itself is excluded. It is possible for a flow's terminal
 * status to equal its own entry status (a flow that can run again). That is not a dependency.
 */
export function flowDependenciesOf(capabilities: readonly FlowCapability[]): readonly FlowDependency[] {
  const out: FlowDependency[] = [];
  for (const to of capabilities) {
    if (to.requires.module === null || to.requires.status === null) continue;
    for (const from of capabilities) {
      if (from.code === to.code) continue;
      const landed = from.produces.terminal[to.requires.module];
      if (landed === undefined || landed !== to.requires.status) continue;
      out.push({
        from: from.code,
        to: to.code,
        via: "status",
        detail: `"${from.label}" leaves ${to.requires.module} in "${landed}", which is the entry of "${to.label}"`,
      });
    }
  }
  return out;
}

// -- Coverage and impact ----------------------------------------------------
//
// Coverage and impact measure edges a person can press.
//   1. Coverage: how many of these edges belong to some flow? The rest are actions nobody has claimed.
//   2. Impact: before changing an edge, answer "which flows it appears in, and who owns them".

/** One edge a person can press. `internal` is excluded: a system edge should not have a person claiming it. */
export interface ActionCoordinate {
  readonly module: string;
  readonly moduleLabel: string;
  readonly domain: string;
  readonly transition: string;
  /** The word on the button. */
  readonly action: string;
  readonly from: string;
  readonly to: string;
  /**
   * Display name of the status.
   *
   * Do not send only the key: some modules' status keys are already English
   * (`stockIn` is draft/pending/approved/voided). Places shown to the business
   * recognize only the label. Missing these two cells shows up as "pending → approved" on the screen.
   */
  readonly fromLabel: string;
  readonly toLabel: string;
  /** Whether walking it moves the ledger. Unclaimed plus it posts is the batch to fill in first. */
  readonly posts: boolean;
}

export function humanActionsOf(modules: Iterable<ModuleSchema>): readonly ActionCoordinate[] {
  const out: ActionCoordinate[] = [];
  for (const module of modules) {
    const statusLabel = (key: string): string =>
      module.lifecycle.statuses.find((status) => status.key === key)?.label ?? key;
    for (const edge of module.lifecycle.transitions) {
      if (edge.internal === true) continue;
      out.push({
        module: module.code,
        moduleLabel: module.label,
        domain: module.domain,
        transition: edge.code,
        action: edge.action,
        from: edge.from,
        to: edge.to,
        fromLabel: statusLabel(edge.from),
        toLabel: statusLabel(edge.to),
        posts: edge.effects.length > 0,
      });
    }
  }
  return out;
}

export interface FlowCoverage {
  readonly total: number;
  readonly covered: number;
  /** Edges no flow has claimed. Ones that post are sorted first. */
  readonly uncovered: readonly ActionCoordinate[];
  /** `module.transition` → flow codes that claim it. One edge can be covered by several flows. */
  readonly byEdge: ReadonlyMap<EdgeKey, readonly string[]>;
  /** Domain code → how much of that domain is claimed. */
  readonly byDomain: ReadonlyMap<string, { readonly total: number; readonly covered: number }>;
}

export function flowCoverageOf(
  capabilities: readonly FlowCapability[],
  modules: Iterable<ModuleSchema>,
): FlowCoverage {
  const actions = humanActionsOf(modules);
  const byEdge = new Map<EdgeKey, string[]>();
  for (const capability of capabilities) {
    for (const edge of capability.edges) {
      const list = byEdge.get(edge) ?? [];
      if (!list.includes(capability.code)) list.push(capability.code);
      byEdge.set(edge, list);
    }
  }

  const byDomain = new Map<string, { total: number; covered: number }>();
  const uncovered: ActionCoordinate[] = [];
  let covered = 0;
  for (const action of actions) {
    const bucket = byDomain.get(action.domain) ?? { total: 0, covered: 0 };
    bucket.total += 1;
    if (byEdge.has(edgeKeyOf(action.module, action.transition))) {
      bucket.covered += 1;
      covered += 1;
    } else {
      uncovered.push(action);
    }
    byDomain.set(action.domain, bucket);
  }

  // Ones that move the ledger come first: that is the most expensive batch while nobody has claimed them.
  uncovered.sort((a, b) => (a.posts === b.posts ? 0 : a.posts ? -1 : 1));
  return { total: actions.length, covered, uncovered, byEdge, byDomain };
}

/** Who should be called in before an edge is changed. */
export interface FlowImpact {
  readonly flow: string;
  readonly label: string;
  readonly owner: string | null;
  /** Which step of this flow this edge is (starting at 1). */
  readonly stepNo: number;
  readonly stepKey: string;
  readonly stepLabel: string;
  /**
   * Whether some other step wrote this edge's exit status into a branch condition.
   *
   * This cell is the typical shape of "changing A breaks B": when the exit status
   * changes, the main step can still be walked, and the branch that still names the
   * old status can never be taken again — and the screen shows nothing wrong.
   */
  readonly branchesOnOutcome: readonly string[];
}

export function flowImpactOf(
  edge: EdgeKey,
  flows: readonly FlowSchema[],
  modules: ModuleLookup,
): readonly FlowImpact[] {
  const out: FlowImpact[] = [];
  for (const flow of flows) {
    const steps = actionSteps(flow);
    const index = steps.findIndex((step) => edgeKeyOf(step.module!, step.transition!) === edge);
    if (index < 0) continue;
    const step = steps[index]!;
    // Possible exit statuses of this step in this flow: one when context can fix the
    // start, otherwise every landing of this action.
    const outcomes = new Set((flowStepEdges(flow, modules).get(step.key) ?? []).map((one) => one.to));

    const branchesOnOutcome: string[] = [];
    for (const other of flow.steps) {
      for (const branch of other.next) {
        if (branch.whenStatus !== null && outcomes.has(branch.whenStatus)) {
          branchesOnOutcome.push(`${other.key} → ${branch.to}`);
        }
      }
    }
    out.push({
      flow: flow.code,
      label: flow.label,
      owner: flow.owner,
      stepNo: index + 1,
      stepKey: step.key,
      stepLabel: step.label,
      branchesOnOutcome,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// "What can follow this step" — the only source of the plus menu while arranging
//
// Candidates are computed. They are not picked by a person from all 235 actions
// in the system. The first version laid a pile of actions on the left to drag,
// and nobody knew which one to drag: after a flow reaches "sales order · approved",
// only a few things in the system can actually follow, and the other two hundred
// are noise. Making a person find the signal in the noise pushes the whole judgment
// of "how this flow should go" onto them, which is something the system already knows.
//
// Three kinds of candidate, each with its own criterion:
//
//   Same document, onward   The document is still in hand. Edges that leave the landing status. The most common kind.
//   Pushed new document     The previous step pushed a new document (release to production → production order).
//                           Edges that leave that new document's initial status.
//   Received new document   Another module declared "I can be pushed out of this document" (`creatable.pushedFrom`).
//                           The difference from "pushed new document" is direction: the first can be seen from this edge,
//                           the second requires scanning the whole table to see who points at me.
//
// What has already been used does not appear again. Two outgoing lines from the same
// start status can only decide "which way" by array order, and that is not a business
// judgment (the FLOW_BRANCH_AMBIGUOUS check says exactly that). So the plus menu
// removes the ones already wired from the candidates, instead of letting the person
// wire them and then reporting an error.
// ---------------------------------------------------------------------------

/** One action that can follow. */
export interface NextCandidate {
  readonly module: string;
  readonly moduleLabel: string;
  readonly domain: string;
  readonly transition: string;
  /** The words on the button. */
  readonly action: string;
  readonly from: string;
  readonly to: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  /** Why it can follow: continue the same document / a new document the previous step pushed / a new document that receives the upstream. */
  readonly why: "same-bill" | "pushed" | "handoff";
  /** One reason a person can read. Shown directly on the menu. */
  readonly reason: string;
  readonly posts: boolean;
  /** This edge exists only for one kind of document (the edge's `when`). */
  readonly conditional: boolean;
}

function statusLabelOf(module: ModuleSchema, key: string): string {
  return module.lifecycle.statuses.find((one) => one.key === key)?.label ?? key;
}

function candidateOf(
  module: ModuleSchema,
  edge: ModuleSchema["lifecycle"]["transitions"][number],
  why: NextCandidate["why"],
  reason: string,
): NextCandidate {
  return {
    module: module.code,
    moduleLabel: module.label,
    domain: module.domain,
    transition: edge.code,
    action: edge.action,
    from: edge.from,
    to: edge.to,
    fromLabel: statusLabelOf(module, edge.from),
    toLabel: statusLabelOf(module, edge.to),
    why,
    reason,
    posts: edge.effects.length > 0,
    conditional: (edge as { readonly when?: unknown }).when != null,
  };
}

/** Initial status of this module. If none is declared initial, take the first. */
function initialStatusOf(module: ModuleSchema): string | null {
  return module.lifecycle.statuses.find((one) => one.initial)?.key
    ?? module.lifecycle.statuses[0]?.key
    ?? null;
}

/**
 * "What can be the first step of a flow" — on a document that can be created by
 * hand, the edges that leave the initial status.
 *
 * Only documents that can be created by hand are offered. A document that can only
 * be generated by an upstream push (a receivable is the typical case) cannot be a
 * start. Listing it means the person picks it and then finds the flow cannot begin at all.
 */
export function entryCandidatesOf(modules: Iterable<ModuleSchema>): readonly NextCandidate[] {
  const out: NextCandidate[] = [];
  for (const module of modules) {
    if (!module.creatable.manual) continue;
    const initial = initialStatusOf(module);
    if (initial === null) continue;
    for (const edge of module.lifecycle.transitions) {
      if (edge.internal === true || edge.from !== initial) continue;
      out.push(candidateOf(module, edge, "same-bill",
        `Create a ${module.label}, then ${edge.action}`));
    }
  }
  return out;
}

/**
 * What can be done after a given edge.
 *
 * `used` is the outgoing coordinates this step has already wired (`module.edge`).
 * They are removed from the candidates — see "what has already been used does not appear again" at the top of the file.
 */
export function nextCandidatesOf(
  modules: ReadonlyMap<string, ModuleSchema>,
  at: { readonly module: string; readonly transition: string },
  used: ReadonlySet<string> = new Set(),
): readonly NextCandidate[] {
  const host = modules.get(at.module);
  if (host === undefined) return [];
  const action = transitionAction(host.lifecycle, at.transition);
  if (action === null) return [];
  // The plus menu has no document status. Every edge of this action might be the previous step, so landings are taken from all of them.
  const edges = transitionEdges(host, at.transition);

  const out: NextCandidate[] = [];
  const push = (one: NextCandidate): void => {
    if (used.has(`${one.module}.${one.transition}`)) return;
    // List the same edge only once: it may be both "same document, onward" and pointed at by a handoff somewhere.
    if (out.some((prev) => prev.module === one.module && prev.transition === one.transition)) return;
    out.push(one);
  };

  // 1. The same document, continuing from the landing status.
  for (const landed of new Set(edges.map((edge) => edge.to))) {
    for (const nextEdge of host.lifecycle.transitions) {
      if (nextEdge.internal === true || nextEdge.from !== landed) continue;
      // Self-loops (continue shipping, additional release) stay: they are real business actions.
      push(candidateOf(host, nextEdge, "same-bill",
        `After this ${host.label} reaches "${statusLabelOf(host, landed)}", continue with ${nextEdge.action}`));
    }
  }

  // 2. The new document this action pushes, leaving its initial status. Push declarations of the same action are identical word for word.
  for (const pushed of new Set(edges.flatMap((edge) => (edge.push === null ? [] : [edge.push])))) {
    const target = modules.get(pushed);
    const initial = target === undefined ? null : initialStatusOf(target);
    if (target === undefined || initial === null) continue;
    for (const nextEdge of target.lifecycle.transitions) {
      if (nextEdge.internal === true || nextEdge.from !== initial) continue;
      push(candidateOf(target, nextEdge, "pushed",
        `${action.action} creates a ${target.label}, then ${nextEdge.action}`));
    }
  }

  // 3. Another module declared "I can be pushed out by this edge".
  for (const target of modules.values()) {
    const origins = target.creatable.pushedFrom ?? [];
    if (!origins.some((one) => one.module === at.module && one.transition === at.transition)) continue;
    const initial = initialStatusOf(target);
    if (initial === null) continue;
    for (const nextEdge of target.lifecycle.transitions) {
      if (nextEdge.internal === true || nextEdge.from !== initial) continue;
      push(candidateOf(target, nextEdge, "handoff",
        `After ${action.action} there is a ${target.label} to handle, then ${nextEdge.action}`));
    }
  }

  return out;
}
