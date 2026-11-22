// ---------------------------------------------------------------------------
// Composite flow — string several flows into one complete chain
//
// ## 🔴 Why it is not "one longer flow"
//
// "Order to production", "dispatch to work report", and "finished goods into stock"
// are each one complete business matter: someone owns it, it can run alone, and it
// can be reviewed alone. After they are spliced into a twenty-step flow, those three
// matters can no longer be discussed on their own — and on the floor it is exactly
// three groups of people, each owning a segment.
//
// A composite has only two uses, and neither is "doing the work":
//   · a demo — show a customer, end to end, how this system is strung together;
//   · an automated test — one command runs the whole core chain, and a break in any segment is known immediately.
//
// So it references flows only, not edges: how a child flow walks inside itself is
// its own business. This layer only answers "which one runs first, which one next".
// Writing the steps again here would be a second source of truth.
//
// ## 🔴 Order is hard, not a suggestion
//
// "Finished goods into stock" must come after "dispatch to work report" — with no
// work report there is no quantity that can be received. So a composite is an ordered
// list, not a set. Running it out of order shows up as some middle flow finding no
// document it can run, and the error points at that flow, not at the order.
// ---------------------------------------------------------------------------

import { assertClosedKeys, requireArray, requireObject, requireText, schemaFail } from "./common.js";

export interface CompositeLink {
  /** Child flow code */
  readonly flow: string;
  /**
   * What this segment does in the whole chain. Say it in business language, not "run the xxx flow".
   * A demo reads this aloud.
   */
  readonly say: string;
  /**
   * Stop when it cannot run (the default), or record it and continue.
   *
   * 🔴 `optional` is for segments that depend on the data (purchasing runs only when material is short).
   * Using it to skip a flow that is actually broken turns the green light of the whole chain into a lie.
   */
  readonly optional: boolean;
  /**
   * Branch-group name. Segments with the same name are several roads at the same fork, and a run takes only one of them.
   * `null` = this segment is the trunk and will always be reached.
   *
   * 🔴 Why a group name, not "the previous segment's code": a fork may have three roads
   * (schedule ourselves / subcontract / buy the finished good). Expressing that as "who replaces whom"
   * points back and forth, and adding a third road means editing the first two. Name the fork.
   * Each road says which fork it belongs to.
   *
   * 🔴 Segments in the same group must sit next to each other. A trunk segment in the middle
   * means "which one runs first" can only be read from list order, and that is exactly the
   * question a fork is supposed to answer — a person chooses on the spot, the list order does not.
   */
  readonly branch: string | null;
}

export interface CompositeSchema {
  readonly code: string;
  readonly label: string;
  /** What problem this chain solves. The first line a reviewer reads */
  readonly purpose: string;
  /** Which positions are involved */
  readonly roles: readonly string[];
  /** Ordered: the previous one finishes before the next one starts */
  readonly links: readonly CompositeLink[];
}

export type CompositeShape = Omit<CompositeSchema, "code">;

/**
 * Proof that the shape gate has passed. Same law, word for word, as `FLOW_DRAFT`.
 *
 * A Symbol, non-enumerable: it does not enter `JSON.stringify`, and gates that walk
 * `Object.keys` such as `assertClosedKeys` do not see it. Sealing drops it with the spread.
 */
export const COMPOSITE_DRAFT: unique symbol = Symbol.for("open-erp.compositeDraft");

/**
 * Product of `defineComposite({...})`: shape gate passed, stamped, and still without an identity.
 *
 * A different type from `CompositeSchema`, so TypeScript blocks misuse: a draft has no `code`
 * and cannot be passed to anything that consumes `CompositeSchema`; a bare object has no proof
 * key and cannot be passed to `sealComposite`.
 */
export interface CompositeDraft extends CompositeShape {
  readonly [COMPOSITE_DRAFT]: true;
}

const COMPOSITE_KEYS = ["label", "purpose", "roles", "links"] as const;
const LINK_KEYS = ["flow", "say", "optional", "branch"] as const;
const CODE_SHAPE = /^[a-z][a-zA-Z0-9-]*$/;

export function normalizeComposite(raw: unknown, label = "composite"): CompositeShape {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, COMPOSITE_KEYS, label);
  const name = requireText(obj["label"], `${label}.label`);
  const purpose = requireText(obj["purpose"], `${label}.purpose`);
  if (purpose.length < 8) {
    schemaFail(`${label}.purpose is too short — say what this chain is strung together to accomplish`);
  }

  const roles = requireArray(obj["roles"] ?? [], `${label}.roles`).map(
    (role, i) => requireText(role, `${label}.roles[${String(i)}]`),
  );

  const rawLinks = requireArray(obj["links"], `${label}.links`);
  if (rawLinks.length < 2) {
    schemaFail(
      `${label}.links has only ${String(rawLinks.length)} — ` +
        `a composite flow must string at least two together; with only one, just run that one`,
    );
  }
  const seen = new Set<string>();
  const links = rawLinks.map((entry, i): CompositeLink => {
    const at = `${label}.links[${String(i)}]`;
    const one = requireObject(entry, at);
    assertClosedKeys(one, LINK_KEYS, at);
    const flow = requireText(one["flow"], `${at}.flow`);
    if (seen.has(flow)) {
      schemaFail(
        `${at}: flow "${flow}" appears twice — running the same child flow twice in one chain ` +
          `either finds no document the second time, or pushes the first run's result again`,
      );
    }
    seen.add(flow);
    const say = requireText(one["say"], `${at}.say`);
    const optional = one["optional"];
    if (optional !== undefined && typeof optional !== "boolean") {
      schemaFail(`${at}.optional accepts only a boolean`);
    }
    const branchRaw = one["branch"];
    if (branchRaw !== undefined && branchRaw !== null && typeof branchRaw !== "string") {
      schemaFail(`${at}.branch accepts only a string (the fork's name) or null`);
    }
    const branch = typeof branchRaw === "string" && branchRaw.trim() !== "" ? branchRaw.trim() : null;
    return { flow, say, optional: optional === true, branch };
  });

  assertBranchesContiguous(links, label);

  return { label: name, purpose, roles, links };
}

/**
 * Two hard rules for a branch group.
 *
 * 🔴 A group has at least two segments: a "fork" with only one road is not a fork.
 * It is the trunk wearing a label, and the UI would draw a multiple-choice question with one option.
 *
 * 🔴 Segments in the same group must be contiguous: a trunk segment in the middle means
 * "which one runs first" can only be read from list order, and a fork exists precisely to hand that decision to a person.
 */
function assertBranchesContiguous(links: readonly CompositeLink[], label: string): void {
  const seen = new Map<string, { first: number; last: number; count: number }>();
  links.forEach((link, i) => {
    if (link.branch === null) return;
    const hit = seen.get(link.branch);
    if (hit === undefined) seen.set(link.branch, { first: i, last: i, count: 1 });
    else seen.set(link.branch, { first: hit.first, last: i, count: hit.count + 1 });
  });
  for (const [branch, span] of seen) {
    if (span.count < 2) {
      schemaFail(
        `${label}: fork "${branch}" has only one segment — a fork needs at least two roads to choose from. ` +
          `With only one it is the trunk; drop branch`,
      );
    }
    if (span.last - span.first + 1 !== span.count) {
      schemaFail(
        `${label}: fork "${branch}" has other segments in the middle (segments ${String(span.first + 1)}–${String(span.last + 1)})` +
          ` — the roads of one fork must sit next to each other, or "which one runs first" can only be read from list order`,
      );
    }
  }
}

/** Declaration entry. Default-exported from `flows/_composites/<code>.ts`. code is derived from the file name and cannot be written in the declaration. */
export function defineComposite(raw: unknown, label = "composite"): CompositeDraft {
  return brandAsCompositeDraft(normalizeComposite(raw, label));
}

/** Identity of one composite flow. On the production path the only source is the file name, derived by the loader and then injected. */
export interface CompositeIdentity {
  readonly code: string;
}

/**
 * Seal — inject the identity derived from the path into the draft, producing a complete `CompositeSchema`.
 *
 * 🔴 The identity itself must pass the gate: `code` enters the address bar, so the file name must be kebab.
 * After the declaration slot was removed, this is the only place that can stop a malformed file name —
 * otherwise it silently becomes a code that cannot enter a route.
 */
export function sealComposite(draft: CompositeDraft, identity: CompositeIdentity): CompositeSchema {
  // A bare object sealed while bypassing the shape gate means the closed-key gate and the links gate never run. The proof is the only criterion.
  if (!isCompositeDraft(draft)) {
    schemaFail("sealComposite received something other than a defineComposite({...}) result — an object that has not passed the shape gate cannot receive an identity");
  }
  const shape: CompositeShape = draft;
  const code = requireText(identity.code, "composite.code");
  if (!CODE_SHAPE.test(code)) {
    schemaFail(`composite.code "${code}" has the wrong shape — it must start with a lowercase letter and contain only letters, digits, and hyphens (it enters the address bar)`);
  }
  return { ...shape, code };
}

function brandAsCompositeDraft(shape: CompositeShape): CompositeDraft {
  Object.defineProperty(shape, COMPOSITE_DRAFT, { value: true, enumerable: false, writable: false });
  return shape as CompositeDraft;
}

/** Is this object a product of `defineComposite()`? */
export function isCompositeDraft(value: unknown): value is CompositeDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[COMPOSITE_DRAFT] === true
  );
}
