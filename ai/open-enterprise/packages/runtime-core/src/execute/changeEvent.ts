// ---------------------------------------------------------------------------
// Data-change events — an outbox written inside the transaction
//
// ## Why this does not reuse the audit table
//
// `oe_audit_log` records only state-machine execution. `createBill` / `saveDraft` / `deleteBill`
// never enter that table (see AuditRepo). "Fire when a bill is created, edited, or deleted"
// is exactly those three, so reading the audit table cannot implement it. This is a separate journal.
//
// ## Why write inside the transaction and deliver outside it
//
// Writing inside the transaction guarantees "if the business commit happened, the event exists".
// A bill is never created while the reminder is lost.
// Actual delivery is asynchronous and outside the transaction. A delivery failure only writes an execution log
// and does not roll back the business write: nobody can accept a purchase order that fails to create because a reminder could not be sent.
//
// ## The line this layer does not cross
//
// This file answers only "what changed". It never answers "who cares".
//
// No module code, status literal, or rule match appears here, and it does not import the server layer.
// Matching rules belongs above this line. If the line breaks, the framework is no longer business-agnostic, and the boundary tests go red.
//
// The dependency is optional: omitting `changeEvents` is a no-op. Existing assembly and every existing test
// stay unchanged. That is not laziness. It makes "notifications were not installed" and "notifications were installed but did not fire"
// two distinguishable facts in the code.
// ---------------------------------------------------------------------------

import type { Identity } from "../contracts/identity.js";

export const CHANGE_EVENT_KINDS = ["create", "update", "delete", "transition"] as const;
export type ChangeEventKind = (typeof CHANGE_EVENT_KINDS)[number];

export interface NewChangeEvent {
  readonly module: string;
  readonly billId: string;
  readonly kind: ChangeEventKind;
  /** Only when kind=transition */
  readonly transitionCode: string | null;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  /**
   * Keys of the cells that changed.
   *
   * `create` / `delete` pass null — "the whole bill appeared / disappeared" is not "a few cells changed".
   * `update` / `transition` pass the actual diff; the layer above uses it for `watchFields`.
   */
  readonly changedFields: readonly string[] | null;
  /**
   * Header of the deleted row. Set only when `kind='delete'`; otherwise always null.
   *
   * The event is consumed outside the transaction, when the row is already gone.
   * Without keeping it, "also notify on delete" cannot be done. The measured symptom is that create and edit work
   * and only delete is silent, while the "delete" checkbox on the rule still looks perfectly normal.
   */
  readonly deletedHeader?: Readonly<Record<string, unknown>> | null;
  readonly at: Date;
}

export interface ChangeEventRepo {
  /**
   * Append one change event.
   *
   * It must be called in the same transaction as the business write. Calling it on the repositories
   * assembled outside the transaction yields "the business write rolled back but the event remains",
   * and a downstream consumer then sends a reminder about a bill that does not exist.
   */
  append(identity: Identity, event: NewChangeEvent): Promise<void>;
}

/**
 * Header diff.
 *
 * Compare only keys present on `after`. `saveDraft` receives a patch; a key that did not appear was not touched.
 * Comparing the full `before` key set would count "fields not submitted this time" as changes.
 *
 * Values are compared coarsely via JSON. The only consumer of this diff is `watchFields`
 * ("did the status cell change"), which needs "whether it changed", not "how".
 * To see how it changed, read the audit log.
 */
export function diffFields(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): readonly string[] {
  const changed: string[] = [];
  for (const key of Object.keys(after)) {
    if (!sameValue(before[key], after[key])) changed.push(key);
  }
  return changed;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Empty string and null are collapsed to the same thing on the write path (see the instance.ts header).
  // Follow that same rule here, or every save reports a pile of untouched blank cells as "changed".
  if (isBlank(a) && isBlank(b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}
