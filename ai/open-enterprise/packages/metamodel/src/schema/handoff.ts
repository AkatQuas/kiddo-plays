// ---------------------------------------------------------------------------
// ④ Handoff — responsibility handoff: to-do / notify / remind
//
// "Message notification" is not a module. It is a cross-cutting concern, and this is where it lands.
// One handoff is the only declaration of both "who must do the work" and "who must know" —
// declare it once, and the to-do list, the push, and the timeout reminder all compile from it.
// ---------------------------------------------------------------------------

import { assertClosedKeys, requireEnum, requireObject, requireText, schemaFail } from "./common.js";
import { isRbacRoleCode } from "./access.js";
import type { Transition } from "./lifecycle.js";

/**
 * Three kinds of handoff:
 *   todo    A to-do. Someone must do something, or the flow stalls
 *   notify  A notice. No action is required, but someone must know
 *   remind  A reminder. Chase when the action is still undone at the due time
 */
export const HANDOFF_KINDS = ["todo", "notify", "remind"] as const;
export type HandoffKind = (typeof HANDOFF_KINDS)[number];

/**
 * Mount point: a status or an edge.
 *   onStatus      fires when the document enters a status
 *   onTransition  fires when an edge completes
 */
export interface Handoff {
  readonly id: string;
  readonly kind: HandoffKind;
  /** Exactly one of the two; the other is null */
  readonly onStatus: string | null;
  readonly onTransition: string | null;
  /**
   * Recipient. Resolves to a position role — do not introduce a second role source.
   * If it cannot be resolved, fail closed (nobody receives it, and that is an error).
   * There is no fallback such as "send it to the creator by default".
   */
  readonly to: string;
  readonly title: string;
  /** Trigger window when kind === 'remind', for example '2d' / '4h' */
  readonly due: string | null;
  readonly why: string;
}

/**
 * The handoffs one status edge actually produces. Runtime task creation and the
 * operation contract share this check, so the consequence an agent reads and the
 * tasks execute actually writes cannot drift apart.
 */
export function handoffsForTransition(
  handoffs: readonly Handoff[],
  transition: Pick<Transition, "code" | "to">,
): readonly Handoff[] {
  return handoffs.filter(
    (handoff) => handoff.onTransition === transition.code || handoff.onStatus === transition.to,
  );
}

const HANDOFF_KEYS = ["id", "kind", "onStatus", "onTransition", "to", "title", "due", "why"] as const;

const DURATION = /^\d+(\.\d+)?[smhd]$/;
export function normalizeHandoff(raw: unknown, label = "handoff"): Handoff {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, HANDOFF_KEYS, label);
  const id = requireText(obj["id"], `${label}.id`);
  const at = `handoff.${id}`;

  const statusRaw = obj["onStatus"];
  const transitionRaw = obj["onTransition"];
  const onStatus = statusRaw === undefined || statusRaw === null ? null : requireText(statusRaw, `${at}.onStatus`);
  const onTransition =
    transitionRaw === undefined || transitionRaw === null ? null : requireText(transitionRaw, `${at}.onTransition`);

  if (!onStatus && !onTransition) schemaFail(`${at}: must be mounted on exactly one of onStatus or onTransition`);
  if (onStatus && onTransition) schemaFail(`${at}: onStatus and onTransition are mutually exclusive`);

  const kind = requireEnum(obj["kind"], HANDOFF_KINDS, `${at}.kind`);
  const dueRaw = obj["due"];
  const due = dueRaw === undefined || dueRaw === null ? null : requireText(dueRaw, `${at}.due`);
  if (kind === "remind" && !due) schemaFail(`${at}: remind must set due, for example '2d'`);
  if (kind !== "remind" && due) schemaFail(`${at}: due is meaningful only on remind`);
  if (due && !DURATION.test(due)) schemaFail(`${at}.due "${due}" is illegal: a number plus a unit s/m/h/d, for example '2d'`);

  const to = requireText(obj["to"], `${at}.to`);
  if (!isRbacRoleCode(to)) {
    schemaFail(`${at}.to must be a stable RBAC role code (2..64 characters of lowercase letters, digits, underscores, or hyphens), not the display name "${to}"`);
  }

  return {
    id,
    kind,
    onStatus,
    onTransition,
    to,
    title: requireText(obj["title"], `${at}.title`),
    due,
    why: requireText(obj["why"], `${at}.why`),
  };
}
