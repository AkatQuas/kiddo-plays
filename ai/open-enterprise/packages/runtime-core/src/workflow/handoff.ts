// ---------------------------------------------------------------------------
// Instantiating a handoff — compile the declaration into rows of oe_handoff_task
//
// One handoff declaration is at once "who should do the work", "who should know", and "when to chase".
// All three compile into the same table.
// This file only computes which tasks to create. Writing them is HandoffRepo's job — the same zero-IO discipline
// as the kernel, one layer up: the computation is a pure function, unit-testable, and needs no database.
//
// `to` stores a role, not a person. People leave and change posts; a todo should not disappear with them.
// Resolving a concrete recipient is a read-side concern and is not pinned at write time.
// ---------------------------------------------------------------------------

import { handoffsForTransition, type HandoffKind, type ModuleSchema, type Transition } from "@open-erp/metamodel";
import type { Identity } from "../contracts/identity.js";

/** One handoff task waiting to be created. The repository generates the id — the executor does not issue ids, or there would be two sources of truth. */
export interface NewHandoffTask {
  readonly handoffId: string;
  readonly kind: HandoffKind;
  readonly module: string;
  readonly billId: string;
  readonly toRole: string;
  readonly title: string;
  /** Set only for remind */
  readonly dueAt: Date | null;
}

export interface HandoffTaskRecord extends NewHandoffTask {
  readonly id: string;
  readonly status: "open" | "done" | "cancelled";
  readonly createdAt: Date;
  readonly doneAt: Date | null;
  readonly doneBy: string | null;
}

export interface HandoffTaskQuery {
  /** Every module the current call surface is allowed to read. An empty array is an explicit empty result. */
  readonly modules: readonly string[];
  readonly kind: HandoffKind | null;
  /** Only tasks already due or due by this instant. null = do not filter by due time. */
  readonly dueBefore: Date | null;
  readonly limit: number;
  readonly offset: number;
}

/**
 * One page of handoff tasks.
 *
 * `total` is the count of every row that matches, not the count on this page. Those two used to be the same number
 * (`{ total: tasks.length }`), so "how many todos do I have" was constantly equal to the default limit —
 * a wrong answer that looks completely normal. The same field name on `bill_list` is the full-set count.
 * Two tools giving one word two meanings leaves a model with no way to tell them apart.
 */
export interface HandoffPage {
  readonly rows: readonly HandoffTaskRecord[];
  readonly total: number;
}

export interface HandoffRepo {
  /**
   * One page of open tasks the current identity's roles can receive.
   *
   * The read intersects `Identity.roles`, `toRole`, and `query.modules`. Any empty side is an explicit zero result,
   * not a fallback to the creator or to every task. The caller bounds `limit` to 1..200. `offset` pages.
   */
  list(identity: Identity, query: HandoffTaskQuery): Promise<HandoffPage>;

  /**
   * Create handoff tasks.
   *
   * Must be idempotent for "this bill already has an open task for this declaration". A bill that changes status
   * back and forth (withdraw, then submit again) recomputes the same todo. The recipient should not see seven identical copies.
   * The partial unique index (`oe_handoff_task_open_uq`) is the last line of defense,
   * but it rejects the second insert, and that second insert is normal business — so a conflict is ignored here, not thrown.
   */
  open(identity: Identity, tasks: readonly NewHandoffTask[]): Promise<void>;

  /**
   * Close a batch of open tasks that no longer mean anything.
   *
   * After a bill leaves a status, todos hanging on that status should not keep occupying the inbox.
   * "A sales order is waiting for review" still lit after the order has been reviewed is worse than no todo:
   * once an inbox has a false signal, people stop trusting it as a whole.
   */
  closeOpen(identity: Identity, module: string, billId: string, handoffIds: readonly string[]): Promise<void>;
}

const DUE_UNIT_MS: Readonly<Record<string, number>> = Object.freeze({
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
});

const DURATION = /^(\d+(?:\.\d+)?)([smhd])$/;

/**
 * `'2d'` → the due instant.
 *
 * normalizeHandoff already checked the syntax. Parsing again here still fails fast:
 * a due that cannot be parsed, if it degraded to "due immediately" or "never due",
 * would silently change chase behavior, with no error.
 */
export function dueAtFrom(now: Date, due: string): Date {
  const hit = DURATION.exec(due.trim());
  const amount = hit?.[1];
  const unit = hit?.[2];
  if (!amount || !unit) {
    throw new Error(`Handoff due "${due}" cannot be parsed: the form is a number plus a unit s/m/h/d, for example '2d'`);
  }
  const ms = DUE_UNIT_MS[unit];
  if (ms === undefined) throw new Error(`Handoff due "${due}" has an unknown unit`);
  return new Date(now.getTime() + Number(amount) * ms);
}

/**
 * Which handoff tasks to create after an edge has been walked.
 *
 * Both mount points are realized here:
 *   - `onTransition` matches this edge — the edge finished
 *   - `onStatus` matches the destination — the bill entered that status
 *
 * Both can match different declarations at once (approve both notifies the warehouse and enters awaiting-shipment with a chase),
 * so the result is a union, not a choice of one.
 */
export function instantiateHandoffs(
  schema: ModuleSchema,
  edge: Transition,
  billId: string,
  now: Date,
): readonly NewHandoffTask[] {
  const hits = handoffsForTransition(schema.handoff, edge);
  return hits.map((h) => taskOf(schema, h, billId, now));
}

/**
 * Handoff tasks to create when a new bill is inserted.
 *
 * A bill lands in the initial status without walking any edge, so `instantiateHandoffs` never hits
 * an `onStatus: <initial>` declaration. A modeler who writes "a draft needs someone to complete it" would get
 * no todo on any new bill, and `yarn test` would not say a word: "a todo was configured but the new bill has none" has no symptom.
 * Treating "create bill" as an enter-initial-status event makes the declaration mean what it says.
 *
 * Returning to the initial status from another status already works (withdraw walks an edge), so that declaration
 * does not need to be forbidden at modeling time. Forbidding it would also forbid "notify the salesperson when it returns to draft".
 */
export function initialHandoffs(schema: ModuleSchema, billId: string, now: Date): readonly NewHandoffTask[] {
  const initial = schema.lifecycle.statuses.find((s) => s.initial);
  // The validator guarantees exactly one initial status. None means the load-time gate was bypassed. Do not guess one.
  if (!initial) throw new Error(`Module ${schema.code} has no initial status — a new bill has no way to decide which handoffs to create`);
  return schema.handoff.filter((h) => h.onStatus === initial.key).map((h) => taskOf(schema, h, billId, now));
}

function taskOf(
  schema: ModuleSchema,
  h: ModuleSchema["handoff"][number],
  billId: string,
  now: Date,
): NewHandoffTask {
  if (h.kind === "remind" && !h.due) {
    // The shape gate already refused this. Refuse again here: a reminder with no due instant never chases,
    // and "a reminder was configured but never chases" cannot be found by looking.
    throw new Error(`Handoff ${schema.code}.${h.id} is remind but has no due — a reminder that never chases is the same as not configuring one`);
  }
  return {
    handoffId: h.id,
    kind: h.kind,
    module: schema.code,
    billId,
    toRole: h.to,
    title: h.title,
    dueAt: h.due ? dueAtFrom(now, h.due) : null,
  };
}

/**
 * When a bill leaves a status, every open task hanging on that status is voided.
 *
 * A self-loop (`ship_more`: shipping → shipping) is not voided: the bill did not leave that status,
 * and the todo still holds.
 */
export function staleHandoffIds(schema: ModuleSchema, from: string, to: string): readonly string[] {
  if (from === to) return [];
  return schema.handoff.filter((h) => h.onStatus === from).map((h) => h.id);
}
