// ---------------------------------------------------------------------------
// Action params preparer
//
// A catalog module may prepare the initial values for a transition's parameter
// dialog. It is not a seventh module concept, and it is not a preview: the
// preparer is read-only and returns only parameters. preview / execute still
// re-evaluate from the values the user finally edits.
// ---------------------------------------------------------------------------

import { requireObject, requireText, schemaFail } from "../schema/common.js";
import type { PlannerBillSnapshot, PlannerReadContext } from "./planner.js";

export interface ActionPreparerContext {
  readonly module: string;
  readonly transition: string;
  readonly bill: PlannerBillSnapshot;
  readonly read: PlannerReadContext;
  /** Business clock shared with preview / execute; the preparer must not read the system clock itself. */
  readonly now: Date;
  /** Current platform operator; optional only to keep old fixtures that call the preparer directly. */
  readonly actor?: Readonly<{ userId: string }>;
  /** Context the caller already knows when the dialog opens. Absent is equivalent to an empty object. */
  readonly params?: Readonly<Record<string, unknown>>;
}

export type ActionParams = Readonly<Record<string, unknown>>;
export type ActionPreparer = (
  context: ActionPreparerContext,
) => ActionParams | Promise<ActionParams>;
export type ActionPreparers = Readonly<Record<string, ActionPreparer>>;

/** The loader does not guess from function shape whether a registry passed through the kernel entry. */
export const DEFINED_ACTION_PREPARERS_BY_KERNEL = Symbol.for("open-erp.definedActionPreparers");

export function defineActionPreparers<const T extends ActionPreparers>(preparers: T): T {
  const obj = requireObject(preparers, "actionPreparers");
  const entries = Object.entries(obj);
  if (!entries.length) schemaFail("actionPreparers must not be empty — do not export this named value when there are no parameter defaults");
  for (const [transition, prepare] of entries) {
    requireText(transition, "actionPreparers transition code");
    if (typeof prepare !== "function") schemaFail(`actionPreparers.${transition} must be a function`);
  }
  Object.defineProperty(preparers, DEFINED_ACTION_PREPARERS_BY_KERNEL, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return preparers;
}

export function isDefinedActionPreparers(value: unknown): value is ActionPreparers {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_ACTION_PREPARERS_BY_KERNEL] === true
  );
}
