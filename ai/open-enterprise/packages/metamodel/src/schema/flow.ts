// ---------------------------------------------------------------------------
// Business flow — a process declaration organized by verbs
//
// ## Why it exists
//
// A module declaration is organized by nouns: which cells, statuses, and edges `salesOrder` has.
// One thing people say in the business — turning a sales order into production — spans five edges
// across `salesOrder`, `productionOrder`, and `productionTask`, and the system has no place that names that turn.
//
// Product and the business then have nothing they can review: a module declaration answers "what this document has",
// not "which steps this piece of work must walk through".
//
// ## 🔴 flow is not a process engine
//
// It does not drive execution. The only write path is still `evaluate → execute`. A flow is
// a specification plus a routing entry plus an impact index: these steps, in this order, done by whom, blocked by what.
// Making it an engine would be a second write path, which this repo must not have.
//
// ## 🔴 Every step must point at an edge that is already declared
//
// That is the difference between a flow and a prose script, and the only source of its value. A wrong sentence in prose
// has no gate that can catch it (process scripts under `domains/*/skills/` have already drifted from the declaration in more than one place);
// each step of a flow writes `module + transition`, so deleting that edge breaks the flow immediately.
// That is a load failure, not "the document went stale".
//
// ## A flow creates no new edge
//
// It adds three kinds of information the system does not have today: order (which edge comes after this one),
// the responsible role (which post should click this step — not the same thing as a module `handoff`'s "who to notify when done"),
// and business intent (what this is called, what problem it solves, who owns it). Edges, statuses, guards, and posting
// are read only from `domains/*/modules/`. Not one of those words is changed.
//
// ## The declaration is the seed. The tenant database is the source of truth
//
// Same shape, word for word, as `domains/*/authorization.ts`: `flows/<domain>/*.ts` is the product baseline,
// seeded by code on first deploy. The version a factory later edits on the canvas lives in the tenant database, and seeding does not overwrite it.
// That is how "the factory arranges its own flows" and "the baseline upgrades with the version" can both be true.
//
// 🔴 Zero IO: it only consumes the declaration. Cross-module checks (whether the edge exists, whether statuses connect) live in `validate/flow.ts`.
// That layer needs the module catalog. This file only does the checks this one declaration can see for itself.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireEnum,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";

/** An optional span of text. An empty string and a missing value are the same thing: both mean this cell was not filled, not that it was filled with empty. */
function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  const text = requireText(value, label);
  return text.trim() === "" ? null : text;
}

/**
 * What kind of step this is.
 *
 * 🔴 Only `action` and `query` are machine-checkable — they point at a real edge and a real module.
 * `manual` / `note` are filler for a person to read. They do not take part in the status-continuity check, and therefore must not carry any system meaning.
 *
 * Leaving `module` off `manual` is deliberate: once it can point at a module, someone will use it as a placeholder for "the system cannot do this yet, but I will draw it anyway", and a reader will take what was drawn as real.
 * The right way to express a missing edge is to leave this flow in "to be completed", not to draw a fake node.
 */
export const FLOW_STEP_KINDS = ["action", "query", "manual", "note"] as const;
export type FlowStepKind = (typeof FLOW_STEP_KINDS)[number];

// 🔴 A flow's own four statuses are not at this layer. The layering rule is the reason: a declaration under `flows/<domain>/`
// is a product-baseline seed and carries no status. "Which step this flow is edited to now" exists only in the tenant database.
// It is a lifecycle the framework records. It lives, together with the six actions, in `@open-erp/runtime-core`
// `contracts/flowLifecycle.ts`, on the same side as the handoff / staged framework statuses, and there is only that one copy.

/**
 * One line leaving this step.
 *
 * 🔴 A branch condition can only be a target status. It cannot be an expression.
 *
 * The moment an expression is allowed, flow becomes a programming language, and the meaning written in that language
 * exists only inside the flow — that is a second source of truth. `whenStatus` must be a status this step's edge can actually reach
 * (`validate/flow.ts` checks each one), so it is a table lookup, not an evaluation.
 *
 * `whenStatus` of `null` means continue with no condition.
 */
export interface FlowBranch {
  /** The next step key. A cross-flow branch written as `#<code>` is resolved by the layer above. This layer only accepts a key inside this flow */
  readonly to: string;
  readonly whenStatus: string | null;
  /** Text on the line, for example "on a short delivery". Display only. It does not take part in the decision */
  readonly label: string | null;
}

/**
 * A coordinate on the canvas.
 *
 * 🔴 It is the arranger's asset, not a render cache: dragging an exception branch to the lower right and lining the trunk up as one vertical line
 * is itself how they express what matters. Relaying out automatically on every open would erase the last expression.
 *
 * 🔴 It may be omitted (`null`): a flow written by a coding agent does not care about layout. When it is omitted the front end
 * lays it out automatically and persists it the first time a person opens it. Do not reject an agent-written flow because one coordinate is missing.
 */
export interface FlowPoint {
  readonly x: number;
  readonly y: number;
}

export interface FlowStep {
  readonly key: string;
  readonly label: string;
  readonly kind: FlowStepKind;
  /** Required for `action` / `query`; always null for `manual` / `note` */
  readonly module: string | null;
  /** Required for `action` — the code of that edge */
  readonly transition: string | null;
  /** Used by `query`: the query condition, the same shape as the kernel `Query.where`. Cross-module validation runs it through `normalizeQuery` */
  readonly where: unknown;
  /** Responsible role (a post code, for example `production-planner`). It is a role, not a person */
  readonly actor: string | null;
  /** One sentence for the business to read: what this step does, and what is true when it is done */
  readonly note: string | null;
  readonly next: readonly FlowBranch[];
  /** Canvas coordinate. A flow written by an agent may omit it */
  readonly at: FlowPoint | null;
}

export interface FlowSchema {
  /**
   * Identity — not in the declaration. The loader derives it from the file path and injects it through `sealFlow`:
   * the file name is the code, the directory name is the domain. Writing it into the declaration would be a second source of truth for the same fact, and a rename would drift.
   */
  readonly code: string;
  readonly label: string;
  /** Same as `code`: a flow belongs to the directory it lives in, injected at seal time */
  readonly domain: string;
  /** One sentence that says which business problem this flow solves. It is the first line a reviewer reads */
  readonly purpose: string;
  /**
   * Responsible role (a post code). It is a role, not a person.
   *
   * 🔴 This cell is the right answer to "changing A breaks B": before an edge is changed, the system can answer which flows it appears in
   * and who the responsible role of each of those is — call the people who should look, instead of hoping someone reads a graph of 335 edges on their own.
   */
  readonly owner: string | null;
  /**
   * Which posts this flow concerns. That is a different question from `owner` (who is responsible for this flow):
   * the owner of an order-to-shipment flow is sales, but the warehouse and finance both have work inside it.
   *
   * 🔴 The use is filtering: a worker who opens the flow handbook wants the few that concern them,
   * not all thirty to pick through. So this cell should list a few extra rather than miss one —
   * the post that was missed will think the system has nothing for them to do.
   */
  readonly roles: readonly string[];
  /**
   * Routing trigger words. They enter the same index as shortcut questions.
   *
   * 🔴 Switching to a flow does not get slower: what is replaced is the carrier of the precompiled plan (one query to a string of edges),
   * not the routing method. Routing is still normalized exact text plus aliases plus lexical scoring, with zero model calls.
   */
  readonly triggerWords: readonly string[];
  /** Entry step key */
  readonly entry: string;
  readonly steps: readonly FlowStep[];
}

/**
 * The product of the shape gate (`normalizeFlow`): keys are normalized, but it still has no identity.
 *
 * Only someone who has the file path (the loader) knows `code` / `domain`, so they do not enter this layer.
 */
export type FlowShape = Omit<FlowSchema, "code" | "domain">;

/**
 * The token that the shape gate has passed. The same rule, word for word, as `MODULE_DRAFT`.
 *
 * It is a Symbol and non-enumerable: it does not enter `JSON.stringify`, and a gate that walks `Object.keys`
 * such as `assertClosedKeys` does not see it. It is dropped when the object is spread at seal time.
 */
export const FLOW_DRAFT: unique symbol = Symbol.for("open-erp.flowDraft");

/**
 * The product of `defineFlow({...})`: past the shape gate, stamped, and without an identity.
 *
 * It and `FlowSchema` are two types, and TypeScript blocks the misuse: a draft lacks `code` / `domain`
 * and cannot be handed to any mouth that consumes `FlowSchema`; a bare object lacks the token and cannot enter `sealFlow`.
 */
export interface FlowDraft extends FlowShape {
  readonly [FLOW_DRAFT]: true;
}

const FLOW_KEYS = ["label", "purpose", "owner", "roles", "triggerWords", "entry", "steps"] as const;
const STEP_KEYS = ["key", "label", "kind", "module", "transition", "where", "actor", "note", "next", "at"] as const;
const BRANCH_KEYS = ["to", "whenStatus", "label"] as const;

/**
 * Shape of a flow code and a step key: starts with a lowercase letter, and contains only letters, digits, and hyphens.
 *
 * ⚠️ This is not the same kind of coordinate as `requireCoordinateSegment` (lowerCamel, used for a module code):
 * a flow code enters a URL and the outward capability list, where kebab fits better than camel; and a role code
 * (`production-planner`) already contains a hyphen.
 */
const CODE_SHAPE = /^[a-z][a-zA-Z0-9-]*$/;

function requireCode(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!CODE_SHAPE.test(text)) {
    schemaFail(
      `${label} "${text}" has an illegal shape — it must start with a lowercase letter and contain only letters, digits, and hyphens (it enters a URL and a routing index key)`,
    );
  }
  return text;
}

function normalizeBranch(raw: unknown, at: string): FlowBranch {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, BRANCH_KEYS, at);
  return {
    to: requireCode(obj["to"], `${at}.to`),
    whenStatus: optionalText(obj["whenStatus"], `${at}.whenStatus`),
    label: optionalText(obj["label"], `${at}.label`),
  };
}

function normalizePoint(raw: unknown, at: string): FlowPoint | null {
  if (raw === undefined || raw === null) return null;
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, ["x", "y"], at);
  const num = (value: unknown, label: string): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) schemaFail(`${label} must be a finite number`);
    return Math.round(value as number);
  };
  return { x: num(obj["x"], `${at}.x`), y: num(obj["y"], `${at}.y`) };
}

function normalizeStep(raw: unknown, index: number, label: string): FlowStep {
  const at = `${label}.steps[${String(index)}]`;
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, STEP_KEYS, at);

  const key = requireCode(obj["key"], `${at}.key`);
  const kind = requireEnum(obj["kind"], FLOW_STEP_KINDS, `${at}.kind`);
  const module = optionalText(obj["module"], `${at}.module`);
  const transition = optionalText(obj["transition"], `${at}.transition`);

  // 🔴 The shape gate tightens here and does not wait for cross-module validation: that layer needs the module catalog, and "an action wrote no
  // transition" is an error this declaration can see for itself. If it leaks to the next layer the error becomes
  // "edge null was not found" — which does not point back at the cell that was written wrong.
  if (kind === "action") {
    if (module === null) schemaFail(`${at}: kind is action, so module is required (which document this step's edge is on)`);
    if (transition === null) schemaFail(`${at}: kind is action, so transition is required (which edge it walks)`);
  }
  if (kind === "query") {
    if (module === null) schemaFail(`${at}: kind is query, so module is required (which document it queries)`);
    if (transition !== null) schemaFail(`${at}: kind is query but a transition was written — a query does not walk an edge`);
  }
  if ((kind === "manual" || kind === "note") && (module !== null || transition !== null)) {
    schemaFail(
      `${at}: kind is ${kind}, so module / transition must not be written — it is filler for a person to read. ` +
        `Once it can point at a module, someone will use it as a placeholder for "the system cannot do this yet, but I will draw it anyway", and a reader will take what was drawn as real. ` +
        `If an edge is missing, leave this flow as to-be-completed. Do not draw a fake node`,
    );
  }
  if (kind !== "query" && obj["where"] !== undefined && obj["where"] !== null) {
    schemaFail(`${at}: only a step whose kind is query has where`);
  }

  return {
    key,
    label: requireText(obj["label"], `${at}.label`),
    kind,
    module,
    transition,
    where: obj["where"] ?? null,
    actor: optionalText(obj["actor"], `${at}.actor`),
    note: optionalText(obj["note"], `${at}.note`),
    next: requireArray(obj["next"] ?? [], `${at}.next`).map((branch, i) =>
      normalizeBranch(branch, `${at}.next[${String(i)}]`),
    ),
    at: normalizePoint(obj["at"], `${at}.at`),
  };
}

/**
 * Normalize one flow declaration.
 *
 * It only does the checks this declaration can see for itself: shape, unique keys, a branch pointing at a real step inside this flow,
 * and an entry that exists. Cross-module checks (whether the edge exists, whether statuses connect, whether the role is known) live in
 * `validate/flow.ts` — that layer needs the module catalog and the post catalog.
 */
export function normalizeFlow(raw: unknown, label = "flow"): FlowShape {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, FLOW_KEYS, label);

  const steps = requireArray(obj["steps"], `${label}.steps`).map((step, index) =>
    normalizeStep(step, index, label),
  );
  if (steps.length === 0) {
    schemaFail(`${label} has no steps — an empty flow says nothing, and deleting it is better than keeping it`);
  }

  const keys = new Set<string>();
  for (const step of steps) {
    if (keys.has(step.key)) {
      schemaFail(`${label} step key "${step.key}" is duplicated — a branch uses it to point, and a duplicate points at the wrong place`);
    }
    keys.add(step.key);
  }

  // A branch that points at a step that does not exist inside this flow: consistency inside this file, a hard failure.
  // (A cross-flow branch uses a code reference, takes another path, and is not written into next.to)
  for (const step of steps) {
    for (const branch of step.next) {
      if (!keys.has(branch.to)) {
        schemaFail(
          `${label} step "${step.key}" branches to "${branch.to}", ` +
            `but this flow has no such step — steps in this flow: ${[...keys].join(" / ")}`,
        );
      }
      if (branch.to === step.key) {
        schemaFail(`${label} step "${step.key}" branches to itself — a reader will think this step must be done twice`);
      }
    }
  }

  const entryRaw = optionalText(obj["entry"], `${label}.entry`);
  const entry = entryRaw ?? steps[0]!.key;
  if (!keys.has(entry)) {
    schemaFail(`${label}.entry "${entry}" is not any step in this flow`);
  }

  const triggerWords = requireArray(obj["triggerWords"] ?? [], `${label}.triggerWords`).map(
    (word, i) => requireText(word, `${label}.triggerWords[${String(i)}]`),
  );
  const seenWord = new Set<string>();
  for (const word of triggerWords) {
    if (seenWord.has(word)) schemaFail(`${label}.triggerWords repeats "${word}"`);
    seenWord.add(word);
  }

  const roles = requireArray(obj["roles"] ?? [], `${label}.roles`).map(
    (role, i) => requireText(role, `${label}.roles[${String(i)}]`),
  );
  const seenRole = new Set<string>();
  for (const role of roles) {
    if (seenRole.has(role)) schemaFail(`${label}.roles repeats "${role}"`);
    seenRole.add(role);
  }

  const purpose = requireText(obj["purpose"], `${label}.purpose`);
  if (purpose.length < 8) {
    schemaFail(
      `${label}.purpose is too short — it is the first line a reviewer reads, and it must say which business problem this flow solves, ` +
        `not copy the name again`,
    );
  }

  return {
    label: requireText(obj["label"], `${label}.label`),
    purpose,
    owner: optionalText(obj["owner"], `${label}.owner`),
    roles,
    triggerWords,
    entry,
    steps,
  };
}

/**
 * The only authoring entry for a flow declaration. A flow file is always `export default defineFlow({...})`.
 *
 * It runs only the shape layer and produces a draft with no identity: `code` comes from the file name and `domain` comes from the directory name.
 * They cannot be written in the declaration, so there is no second source of truth that can drift. The cross-module semantic gate (whether the edge exists, whether statuses connect)
 * stays in `validate/flow.ts`, and the loader runs it after every module is assembled.
 */
export function defineFlow(raw: unknown, label = "flow"): FlowDraft {
  return brandAsFlowDraft(normalizeFlow(raw, label));
}

/** The identity of one flow. On the production path the only source is the file path, derived by the loader and then injected. */
export interface FlowIdentity {
  readonly code: string;
  readonly domain: string;
}

/**
 * Seal — inject the identity derived from the path into the draft, and produce a complete `FlowSchema`.
 *
 * 🔴 The identity itself must pass the gate: `code` goes through flow's own `requireCode` (kebab, see `CODE_SHAPE` —
 * it is not the same kind of coordinate as a module's `requireCoordinateSegment`), and `domain` goes through non-empty text.
 * This used to be fulfilled on the side by the declaration. After that slot was removed it must be filled at the injection point,
 * or a malformed file name silently becomes a malformed flow code, and that code enters a URL and a routing index key.
 */
export function sealFlow(draft: FlowDraft, identity: FlowIdentity): FlowSchema {
  // Sealing a bare object past the shape gate means the key-closure and step gates never run. The token is the only criterion
  if (!isFlowDraft(draft)) {
    schemaFail("what was sealed is not the product of defineFlow({...}) — an object that has not passed the shape gate must not receive an identity");
  }
  const shape: FlowShape = draft;
  return {
    ...shape,
    code: requireCode(identity.code, "flow.code"),
    domain: requireText(identity.domain, "flow.domain"),
  };
}

function brandAsFlowDraft(shape: FlowShape): FlowDraft {
  Object.defineProperty(shape, FLOW_DRAFT, { value: true, enumerable: false, writable: false });
  return shape as FlowDraft;
}

/** Is this object the product of `defineFlow()`? */
export function isFlowDraft(value: unknown): value is FlowDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[FLOW_DRAFT] === true
  );
}

/**
 * Every coordinate in one flow that points at a real edge, in `module.transition` form.
 * Coverage and impact are both computed from it.
 */
export function flowActionKeys(flow: FlowSchema): readonly string[] {
  const out: string[] = [];
  for (const step of flow.steps) {
    if (step.kind !== "action" || step.module === null || step.transition === null) continue;
    out.push(`${step.module}.${step.transition}`);
  }
  return out;
}

/** Modules one flow touches, deduped in first-seen order. `manual` / `note` contribute none. */
export function flowModuleCodes(flow: FlowSchema): readonly string[] {
  const out: string[] = [];
  for (const step of flow.steps) {
    if (step.module === null || out.includes(step.module)) continue;
    out.push(step.module);
  }
  return out;
}
