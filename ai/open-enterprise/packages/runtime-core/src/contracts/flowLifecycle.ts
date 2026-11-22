// ---------------------------------------------------------------------------
// A business flow's own lifecycle — the only definition
//
// One copy, not three. This used to be written in three places (the declared status list,
// the action table in storage, and the HTTP check `status === "draft"`). Three places
// "saying the same thing" is the failure mode this repo keeps naming: the UI offers buttons
// from one set, the backend allows another, the button clicks, the request is refused,
// and the user has no way to see what they did wrong.
//
// It lives in `contracts/` rather than `metamodel` because flow status is a tenant fact,
// not a declaration a developer commits to git. The declaration under `flows/<domain>/` has no status —
// it is seed data. "Which step this flow has reached" exists only in the tenant database.
// Metamodel owns declarations. This file owns the lifecycle of a framework record,
// on the same side as the framework statuses for handoff and staged actions.
//
// Status keys are English: a flow is a framework asset, not a business bill.
// Its status never appears on a bill a business user reads (the UI shows the label).
// That is separate from module statuses, whose keys stay as declared.
// ---------------------------------------------------------------------------

/**
 * Four statuses. There is no fifth.
 *
 * - `draft` Composing — product and business edit it on the canvas. Only this status can change content.
 * - `review` In review — it has been handed over for someone to look at. Who may review is a local agreement;
 *   it differs by factory. The system only records who submitted and who reviewed.
 * - `dev` Needs completion — the diagram is coherent and the system cannot do it yet (a missing edge or page).
 *   This status exists so that fact becomes something numbered, owned by a role, and trackable,
 *   rather than a sentence left in a chat. It is also the only exit for the person composing the flow to "propose an edge".
 * - `published` Published — routing can hit it, and it enters the business-flow handbook.
 *
 * A published flow cannot be edited directly. To change it, drop back to composing and walk execution and review again.
 * Otherwise the word "published" guarantees nothing.
 *
 * There is no archive status. History lives version by version in the revision table.
 * Another terminal status would only add a "restore" entry that then has to be explained.
 */
export const FLOW_STATUSES = ["draft", "review", "dev", "published"] as const;
export type FlowWorkStatus = (typeof FLOW_STATUSES)[number];

/**
 * Words shown in the UI.
 *
 * `review` is "In review", not "pendingReview": in this product "pendingReview" is a bill status
 * (sales orders and production orders both have that status). A flow board and a bill list often sit side by side.
 * The same word in both places forces the reader to decide which kind of thing it means, and that decision carries no information.
 * "In review" says the same fact and can only mean this flow.
 */
export const FLOW_STATUS_LABELS: Readonly<Record<FlowWorkStatus, string>> = Object.freeze({
  draft: "Composing",
  review: "In review",
  dev: "Needs completion",
  published: "Published",
});

/**
 * Six actions. This is the only definition: HTTP decides which buttons to show from it, and storage allows writes from it.
 *
 * `needReason` is not decoration. A rejection or a "call development" with no reason says nothing —
 * the next person sees the status change and does not know why, and the person who knew may already be off the project.
 * "Submit" does not need a reason, because the action itself carries no extra information (the content is in the version).
 */
export const FLOW_ACTIONS = Object.freeze({
  submit: { from: ["draft"], to: "review", label: "Submit", needReason: false },
  approve: { from: ["review"], to: "published", label: "Approve and publish", needReason: true },
  reject: { from: ["review"], to: "draft", label: "Reject", needReason: true },
  needDev: { from: ["draft", "review"], to: "dev", label: "Mark as not doable", needReason: true },
  devDone: { from: ["dev"], to: "draft", label: "Filled in", needReason: true },
  revise: { from: ["published"], to: "draft", label: "Revise this flow", needReason: true },
} as const satisfies Readonly<Record<string, {
  readonly from: readonly FlowWorkStatus[];
  readonly to: FlowWorkStatus;
  readonly label: string;
  readonly needReason: boolean;
}>>);

export type FlowAction = keyof typeof FLOW_ACTIONS;
export const FLOW_ACTION_KEYS = Object.keys(FLOW_ACTIONS) as readonly FlowAction[];

export function isFlowAction(value: string): value is FlowAction {
  return (FLOW_ACTION_KEYS as readonly string[]).includes(value);
}

/** Actions available from a status. The UI offers buttons from this; it does not list them itself. */
export function actionsFrom(status: FlowWorkStatus): readonly FlowAction[] {
  return FLOW_ACTION_KEYS.filter((action) =>
    (FLOW_ACTIONS[action].from as readonly string[]).includes(status),
  );
}

/**
 * Whether content can be edited now.
 *
 * Callers must not compare the word themselves. Comparing a literal means that after the state machine changes,
 * the storage allow-rule and the UI's "show the editor" decision drift apart, and each side still looks legal on its own.
 */
export function isFlowEditable(status: FlowWorkStatus): boolean {
  return actionsFrom(status).includes("submit");
}
