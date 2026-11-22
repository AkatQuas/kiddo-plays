// ---------------------------------------------------------------------------
// Executor — evaluate to execute. **The only write path in the whole system**
//
// Nothing else may change status or write the ledger. Escape-hatch components, agent tools, and the CLI
// all come through here. Bypassing it also bypasses preconditions, audit, and posting, and the UI shows nothing wrong.
//
// 🔴 One edge runs as **a single transaction**: evaluate, change status, write the audit, write forward ledger rows,
// write reversal ledger rows, write handoffs, push the draft, write references. Any failure rolls the whole thing back.
// Separate commits leave an unrecoverable middle state: status changed but the books did not post. The bill looks approved,
// stock was never deducted, and a later count finds the gap with no trail back to which execution caused it.
// ---------------------------------------------------------------------------

import {
  hasTransitionAt,
  transitionAction,
  transitionAt,
  normalizeExecutionPlan,
  deletableIn,
  occupancyLeaveFrom,
  occupancyOf,
  retirementExitsOf,
  editableFields,
  evaluateTransition,
  evaluateCreatePreconditions,
  isPushFillable,
  isSystemSupplied,
  isPlannerSupplied,
  classifyBillWriteEnvelope,
  omitMatchingSystemWriteKeys,
  lineContextDemands,
  reversalSourceTransitions,
  periodBookOf,
  pushLineValues,
  pushSourceField,
  pushSourceIssueCoordinate,
  pushSourceTable,
  resolvePostingPeriod,
  modulePermissionKey,
  schemaFail,
  EFFECT_REVERSE_OPS,
  type ActorKey,
  type BillIssue,
  type CheckReport,
  type EffectTarget,
  type ExecutionPlan,
  type Field,
  type ModuleSchema,
  type PeriodBook,
  type PushLineMapping,
  type ResolvedEffect,
  type Transition,
  type TransitionDecision,
} from "@open-erp/metamodel";
import { requireRuntimeModule, type RuntimeCatalog } from "../contracts/catalog.js";
import { requireIdentity, roleCodesOf, type Identity } from "../contracts/identity.js";
import type { RuntimeAuthorizer } from "../contracts/authorization.js";
import { warningConfirmationToken } from "../contracts/warningToken.js";
import { BillInvalidError, BillNotFoundError, RepoError, StagedActionError, StaleRevisionError } from "../contracts/errors.js";
import { STAGED_STATUS_LABELS } from "../contracts/repositories.js";
import type {
  BillRecord,
  LedgerRow,
  NewLedgerRow,
  Repos,
  StagedActionRecord,
  TransactionOptions,
  UserViewRepo,
} from "../contracts/repositories.js";
import {
  initialHandoffs,
  instantiateHandoffs,
  staleHandoffIds,
  type HandoffRepo,
  type NewHandoffTask,
} from "../workflow/handoff.js";
import { createRuleQuery } from "../workflow/ruleQuery.js";
import { applyPushBillLines, splitPushDrafts } from "./pushBillLines.js";
import {
  assertVisibleChildSet,
  initialStatusOf,
  listCompositeChildren,
} from "./compositeArchive.js";

// -- Repository contracts filled in here ------------------------------------------------
//
// 🔴 `repo/types.ts` only gave bills / ledger / staged, but executing one edge writes five
// framework tables. Audit, handoff, and reference contracts are filled in here. They sit at the same layer as `Repos`,
// they just have not moved into that file yet (see the delivery report's contract gap).
// Defined on the runtime side instead of inline SQL: the executor only knows interfaces, so unit tests can use an in-memory implementation
// and do not need a database. Same zero-IO discipline as the kernel, one layer up.

/** One persisted audit row. `idempotencyKey` is also the test for whether this edge has already run */
import { diffFields, type ChangeEventRepo, type NewChangeEvent } from "./changeEvent.js";
import {
  operationLogBillCode,
  operationLogTransitionAction,
  type NewOperationLog,
  type OperationLogRepo,
} from "./operationLog.js";

export interface AuditEntry {
  readonly id: string;
  readonly module: string;
  readonly billId: string;
  readonly transitionCode: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  /** pass / hint / warn / route / block */
  readonly verdict: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly checks: readonly CheckReport[];
  readonly actorId: string;
  readonly policyVersion: string;
  readonly decisionId: string;
  readonly at: Date;
  /** Present only on programmatic calls (agent / retry / push). A person clicking a button is null */
  readonly idempotencyKey: string | null;
  /** Full plan when a Planner transition runs. null for an ordinary transition. */
  readonly executionPlan: ExecutionPlan | null;
  /** SHA-256 of the source transition decision plus executionPlan. Must be null exactly when executionPlan is null. */
  readonly planFingerprint: string | null;
}

export type NewAuditEntry = Omit<AuditEntry, "id" | "actorId" | "policyVersion" | "decisionId">;

export interface AuditRepo {
  /**
   * Whether this edge has already run with this idempotency key.
   *
   * 🔴 Idempotency lives on the audit, not on a second table. The audit is already the record that this execution happened.
   * Another table would be a second source of truth for the same fact, and two sources of truth will disagree:
   * a row in the audit and nothing in the idempotency table, with no way to decide which to trust.
   *
   * Called only when a key is present. An empty key is not looked up. NULLs are not equal in that unique index,
   * so asking whether an audit with a NULL key exists both finds nothing and means nothing:
   * a person clicking twice is two real intents, not a replay.
   */
  find(
    identity: Identity,
    module: string,
    billId: string,
    transitionCode: string,
    idempotencyKey: string,
  ): Promise<AuditEntry | null>;

  /**
   * Executions that happened on this bill, **most recent first**.
   *
   * 🔴 This exists because a demo-day gap is guaranteed to be asked: the status `rejected` is there,
   * **the rejection reason is not visible**. The reason is an edge parameter (`params`), and by `AGENTS.md` a parameter
   * structurally cannot land on a bill field (`TRANSITION_PARAM_SHADOWS_FIELD` exists for that). It only enters this audit table.
   * Adding a `rejectReason` field on the bill would create a second source of truth. The right shape is to **project** the audit onto the detail page.
   *
   * Both scope layers are required, and the order must not flip. The caller must **first** go through `bills.get` (`moduleScopedWhere`)
   * and confirm this row is visible, then read its history. Checking only `scopedWhere` (tenant) turns this endpoint
   * into a probe that uses an id to learn about bills inside someone else's data scope. It does not return the bill,
   * but status changes, action times, and actors are enough to reconstruct what happened to it.
   */
  list(identity: Identity, module: string, billId: string, limit: number): Promise<readonly AuditEntry[]>;

  append(identity: Identity, entry: NewAuditEntry): Promise<AuditEntry>;
}

/** Which bill a Planner createBill command actually created. Append-only, pointing back at the source transition audit. */
export interface PlannedCreatedBill {
  readonly commandId: string;
  readonly module: string;
  readonly billId: string;
  /** Position in ExecutionPlan.commands. Replay returns rows in the original plan order. */
  readonly ordinal: number;
}

export interface PlanResultRepo {
  append(
    identity: Identity,
    auditId: string,
    rows: readonly PlannedCreatedBill[],
  ): Promise<void>;
  list(identity: Identity, auditId: string): Promise<readonly PlannedCreatedBill[]>;
}

/** A reference between bills (produced by push). `tgtLineId` is unique: one target line can come from only one source line */
export interface NewReference {
  readonly srcModule: string;
  readonly srcId: string;
  readonly srcLineId: string | null;
  readonly tgtModule: string;
  readonly tgtId: string;
  readonly tgtLineId: string | null;
}

/** Narrowest outbound shape for a reverse reference lookup. Business fields still go through BillRepo.get. */
export interface ReferencedBill {
  readonly id: string;
  readonly status: string;
}

export interface ReferencedBillPage {
  readonly rows: readonly ReferencedBill[];
  readonly truncated: boolean;
}

export interface ReferenceRepo {
  append(identity: Identity, rows: readonly NewReference[]): Promise<void>;
  /**
   * Forward walk from a known source coordinate and target module. The implementation must be tenant-scoped, trimmed by the target data scope,
   * deduped, ordered by target id ascending, and compute truncated with limit + 1.
   */
  listTargets(
    identity: Identity,
    sourceModule: string,
    sourceId: string,
    targetModule: string,
    limit: number,
  ): Promise<ReferencedBillPage>;
}

/**
 * Every repository the executor needs.
 *
 * `transition` is narrowed to return this interface: audit / handoff / reference must land in **the same transaction**.
 * A transaction handle that only has bills/ledger/staged would let those three tables write quietly outside the transaction.
 */
export interface ExecutionRepos extends Repos {
  /** Business action a person checks. Production repositories rebind this to the same transaction as the business write. */
  readonly humanActions?: import("../contracts/humanAction.js").HumanActionRepo;
  readonly audit: AuditRepo;
  readonly handoff: HandoffRepo;
  readonly references: ReferenceRepo;
  readonly planResults: PlanResultRepo;
  /**
   * Data-change outbox. **Optional**. Omit it and the call is a no-op.
   *
   * 🔴 This slot only records what changed. It never decides who cares. Rule matching belongs upstairs.
   * The moment a module code or a business concept appears here, the framework is no longer business-agnostic (see the changeEvent.ts header).
   */
  readonly changeEvents?: ChangeEventRepo;
  /**
   * Operation log. **Optional**. Omit it and the call is a no-op, so existing in-memory executor tests do not all have to change.
   *
   * Production `assemble()` always installs it. `transaction()` rebinds the whole repository set onto tx,
   * so a line written inside the business callback lives and dies with the bill.
   */
  readonly operationLogs?: OperationLogRepo;
  readonly userViews: UserViewRepo;
  transaction<T>(fn: (repos: ExecutionRepos) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

// -- Runtime dependencies --------------------------------------------------------------

export interface RuntimeDeps<
  Catalog extends RuntimeCatalog = RuntimeCatalog,
  Authorizer extends RuntimeAuthorizer = RuntimeAuthorizer,
> {
  /** Module table. **The only source of truth**. The runtime must not import domain modules itself */
  readonly catalog: Catalog;
  readonly repos: ExecutionRepos;
  /** The only permission decider, shared by people and agents. */
  readonly authorizer: Authorizer;
  /** Injected clock. Audit time, ledger occurredAt, and remind due dates all come from it, so tests can pin it */
  readonly now: () => Date;
  /**
   * Side effect after a bill write succeeds (for example ownership sync declared by the catalog).
   * Default does nothing. The implementation must stay business-agnostic and only follow coordinates the catalog declares.
   *
   * 🔴 This and change-fact recording (`ExecutionRepos.changeEvents`) are **two different things. Do not merge them**:
   * this one is called **outside** the transaction (it receives `deps.repos`, not the tx-bound set),
   * while the change outbox must be **inside** the transaction. Its whole value is that a rolled-back business write takes the event with it.
   * Moving the outbox here means downstream can emit a reminder about a bill that does not exist.
   * Moving this hook into the transaction would change the failure semantics of existing side effects. Keep both, and say so.
   */
  readonly afterBillWrite?: (input: {
    readonly repos: ExecutionRepos;
    readonly identity: Identity;
    readonly module: string;
    readonly action: "create" | "save" | "delete" | "transition";
    readonly before: BillRecord | null;
    readonly after: BillRecord | null;
  }) => Promise<void>;
}

/**
 * The clock is read once per transaction. Later `now()` calls return that same instant.
 *
 * A push's transition and the downstream create, a composite archive's parent and children, and one batch of writes must share one instant.
 * Call sites keep using `deps.now()` and do not pass a separate clock. Wrapping a clock that is already pinned still returns the original value.
 */
export function pinClock<T extends { readonly now: () => Date }>(deps: T): T {
  let at: Date | undefined;
  return {
    ...deps,
    now: () => (at ??= deps.now()),
  };
}

// -- Refusal ---------------------------------------------------------------------------

/**
 * This edge does not run, and why.
 *
 * 🔴 `message` and `checks` are carried out unchanged. **Never replace them with a generic failure.**
 * "Available stock in this warehouse is short; a warehouse supervisor must release over stock" is the most valuable output of this system:
 * it tells the user what to do next. A generic error throws away the whole precondition machinery.
 */
export class TransitionRefusedError extends Error {
  override readonly name = "TransitionRefusedError";
  constructor(
    readonly module: string,
    readonly level: "block" | "warn" | "route",
    message: string,
    readonly decision: TransitionDecision,
    /** Only on the route level: which edge to take instead */
    readonly exit: string | null,
  ) {
    super(message);
  }
}

/** The judgment computed at propose time does not match the recomputation now. The approver saw A; what would be stored is B */
export class StagedDecisionDriftError extends Error {
  override readonly name = "StagedDecisionDriftError";
  constructor(
    readonly module: string,
    message: string,
    readonly differences: readonly string[],
    readonly current: TransitionDecision,
  ) {
    super(message);
  }
}

// -- Reads and projection --------------------------------------------------------------

/**
 * Identity to `$actor` in rules.
 *
 * 🔴 The key set must match the kernel `ACTOR_KEYS` **character for character**. That is what the gate checks
 * (`PRECONDITION_ACTOR_KEY_UNKNOWN` rejects a reference that names the wrong key).
 * If the two sides drift, the symptom is not an error. A block-level rule **never passes**.
 * It looks like the business configuration is too strict, and nobody suspects the key names do not match.
 *
 * There is no single-valued `role`. An identity carries **a set** of post roles. Picking the first one as "the role"
 * produces a judgment with no explainable reason for a person who holds several posts.
 *
 * `agentId` comes from `Identity` (the request-scoped snapshot after RuntimeAuthorizer resolves the gateway principal).
 * It is no longer hardcoded null. Hardcoding null is not conservative. It turns **unknown** into a value a rule can read:
 * a modeler writes "only a person may press this", it passes for every caller, and there is no symptom.
 */
export function actorOf(identity: Identity): Readonly<Record<string, unknown>> {
  const actor: Record<ActorKey, unknown> = {
    userId: identity.userId,
    orgId: identity.orgId,
    tenantId: identity.tenantId,
    roles: [...roleCodesOf(identity)],
    agentId: identity.agentId,
  };
  return actor;
}

function subtableFields(schema: ModuleSchema): readonly Field[] {
  return schema.fields.filter((f) => f.type === "subtable");
}

/**
 * The detail lines the kernel evaluation needs.
 *
 * 🔴 The refusal test is whether **this evaluation needs line context** (`lineContextDemands`), not how many detail tables the module declares.
 * Those are different. N detail tables are a supported shape (`lineAgg.of` names one explicitly, the query layer resolves by table name,
 * the declaration layer allows it). Only `$line.` is unresolvable under several detail tables. An edge that neither posts per line
 * nor reads the line set never asks the question. Refusing every edge by table count would make that class of edge unusable,
 * with the symptom "this bill cannot do anything", while the declaration itself is correct.
 *
 * When it really is unresolvable, still refuse, and more specifically than before: name which rule or which effect needs to read lines.
 */
export function linesOf(
  schema: ModuleSchema,
  record: BillRecord,
  /** Which edge this evaluation is for. Whether line context is required lives on the edge, not on the module */
  edge: Transition,
  /** Resolve only reversal sources that actually happened. The default keeps every candidate the declaration layer named. */
  reversalSources?: ReadonlySet<string>,
): readonly Readonly<Record<string, unknown>>[] {
  const tables = subtableFields(schema);
  if (!tables.length) return [];
  if (tables.length === 1) {
    const key = tables[0]?.key;
    if (key === undefined) throw new Error(`Module ${schema.code} detail-table field is missing a key`);
    // A missing key means this detail table has no rows. That is not a missing-value fallback. It is how BillRecord.lines is read:
    // rows are grouped by detail-table field key, so a detail table with no rows simply has no key
    const rows = record.lines[key];
    return rows === undefined ? [] : rows;
  }

  const demands = lineContextDemands(schema, edge, reversalSources);
  if (demands.length) {
    throw new Error(
      `Module ${schema.code} declares ${tables.length} detail tables (${tables.map((t) => t.key).join(", ")}),` +
        `and ${demands.join(", ")} on edge "${edge.code}" need to read detail lines — $line cannot be resolved, refusing to evaluate.` +
        `Collapse the declaration to one detail table, or name the detail table explicitly on this rule`,
    );
  }
  // 🔴 An empty array is not "this bill has no lines". It is the fact just proved above: this evaluation reads no lines.
  // Substituting either of the two tables would be a lie. The rule would conclude from a table it never meant to read.
  // If someone later adds a per-line rule or posting to this edge, the gate above throws first and does not silently allow an empty line set
  return [];
}

function lineIdAt(lines: readonly Readonly<Record<string, unknown>>[], index: number): string {
  const row = lines[index];
  if (!row) throw new Error(`Posting needs detail line ${index + 1}, but the bill has no such line — refusing to post`);
  const id = row["id"];
  if (typeof id !== "string" || !id) {
    throw new Error(`Detail line ${index + 1} has no id, so the ledger cannot point back at a concrete line — refusing to post`);
  }
  return id;
}

function verdictText(decision: TransitionDecision): string {
  return decision.verdict.pass ? "pass" : decision.verdict.level;
}

// -- Evaluation ------------------------------------------------------------------------

export interface EvaluateArgs {
  readonly identity: Identity;
  readonly module: string;
  readonly billId: string;
  /** Business action code. The edge is resolved from the bill's current status via `transitionAt`. The caller never picks an edge by status */
  readonly transition: string;
  readonly params: Readonly<Record<string, unknown>>;
  /**
   * Bill revision the caller has seen. When non-null, the first thing after the read is to compare it, before status, edge, and gates
   * (see `readAtRevision`). preview, propose, execute, Planner dry-run and execution, and batch all come through here.
   *
   * `null` is only for callers that are not anchored to one read: the agent entry, system-internal edges, the consequence of `setStatus` inside a plan,
   * and composite-archive cascade. A human HTTP entry must pass the revision the detail or list view actually read.
   */
  readonly expectedRevision: number | null;
}

/**
 * In a batch of reads anchored to "the revision the caller saw", one bill cannot be read (deleted, or out of scope).
 *
 * A versioned bill that cannot be read was deleted after the caller opened it. That is a revision conflict
 * (`StaleRevisionError`, actualRevision = null), not a 404. Callers without a revision (agent / internal path)
 * rethrow the repository error unchanged. Only a miss of **this batch's own bills** counts. A miss while locking a reference coordinate is some other bill,
 * and that error stays as it was.
 */
export async function staleIfGone<T>(
  module: string,
  items: readonly { readonly id: string; readonly expectedRevision: number | null }[],
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    if (!(error instanceof BillNotFoundError) || error.module !== module) throw error;
    const item = items.find((candidate) => candidate.id === error.billId);
    if (item === undefined || item.expectedRevision === null) throw error;
    throw new StaleRevisionError(module, item.id, item.expectedRevision, null);
  }
}

/**
 * Read one bill at "the revision the caller saw". The **first** thing after the read is the revision compare, before status, edge, gates, and editability.
 *
 * 🔴 The order must not flip. If the revision does not match and we then judge status, the refusal talks about a bill the caller never saw
 * ("this bill is now 'finished' and cannot ..."). They will think they pressed the wrong button. The truth is someone else moved it first.
 * Compare the revision first and they get "this bill changed after you opened it". The next step is to reopen it. That is the right next step.
 *
 * `expectedRevision === null` skips the compare. A missing row is handled by `staleIfGone`.
 */
export async function readAtRevision(
  module: string,
  billId: string,
  expectedRevision: number | null,
  read: () => Promise<BillRecord>,
): Promise<BillRecord> {
  const record = await staleIfGone(module, [{ id: billId, expectedRevision }], read);
  if (expectedRevision !== null && record.revision !== expectedRevision) {
    throw new StaleRevisionError(module, billId, expectedRevision, record.revision);
  }
  return record;
}

export interface Evaluated {
  readonly schema: ModuleSchema;
  readonly record: BillRecord;
  readonly lines: readonly Readonly<Record<string, unknown>>[];
  readonly decision: TransitionDecision;
}

/**
 * Where the authority to run this edge comes from.
 *
 * | Level | Who is pressing | Does the target edge's execute grant required? |
 * |---|---|---|
 * | `"actor"` | The caller (a person pressing a button / an agent calling `bill_execute` / CLI) | **Yes** |
 * | `"plan"`  | The `setStatus` side effect of an **already authorized** source transition | No |
 * | `"internal"` | Code explicitly calling a system edge marked `internal:true` in the schema | No |
 *
 * 🔴 The `"plan"` level uses the **same words** as `push` (`AGENTS.md`: a transition grant covers the
 * full side effect it declares). A person authorized to press "release" authorized **the whole thing that edge declares**:
 * create N tasks, write lineage, and move those N orders to "releasing".
 * Asking again for the target edge's execute grant treats a declared side effect as the user's second operation.
 * The symptom is a post that can release, then rolls the whole group back halfway because it cannot "manually approve a production order",
 * and the refusal names a button they never pressed.
 *
 * 🔴 **The only thing loosened is the target edge's grant.** The target module's `read` and data scope are still checked (if the bill cannot be read,
 * it cannot be read; `moduleScopedWhere` loses nothing). The target edge's preconditions are still checked (a block rolls the whole group
 * back). The target edge's effects / handoff / push still fire.
 *
 * 🔴 It is a **positional argument**, not a field on `ExecuteArgs`. Those arg objects are assembled from the request body in HTTP routes.
 * One extra optional key is one more path where "put it in the body and skip authorization" works,
 * and once that path exists, grep will not find it and tests will not catch it.
 */
export type TransitionAuthority = "actor" | "plan" | "internal";

/** Evaluate only. Do not persist and do not change status. preview / propose / execute share this one implementation */
export async function evaluate(
  deps: RuntimeDeps,
  args: EvaluateArgs & { readonly forUpdate?: boolean },
  repos: ExecutionRepos = deps.repos,
  /** See `TransitionAuthority`. The default is the **strict level**, not a fallback */
  authority: TransitionAuthority = "actor",
): Promise<Evaluated> {
  requireIdentity(args.identity);
  const schema = requireRuntimeModule(deps.catalog, args.module).schema;
  deps.authorizer.assertModule(args.identity, args.module, "read");
  if (authority === "actor") deps.authorizer.assertTransition(args.identity, args.module, args.transition);
  const record = await readAtRevision(args.module, args.billId, args.expectedRevision, () =>
    args.forUpdate
      ? repos.bills.lockForAction(args.identity, args.module, args.billId)
      : repos.bills.get(args.identity, args.module, args.billId));
  const edge = transitionAt(schema, record.header["status"], args.transition);
  // When mutually exclusive posting branches share one reversal action, ask the ledger which branch
  // actually happened before resolving effect coordinates. Reconciling afterwards is too late: an unposted branch's subject/scope may already be empty,
  // and resolution throws before reconciliation is ever reached.
  const hasReversalDeclarations = reversalSourceTransitions(schema, edge).length > 0;
  const posted = hasReversalDeclarations
    ? await repos.ledger.rowsOf(args.identity, args.module, args.billId)
    : null;
  const reversalSources = posted === null ? undefined : openReversalSourceTransitions(posted);
  const lines = linesOf(schema, record, edge, reversalSources);
  const decision = await evaluateTransition(
    {
      module: schema,
      bill: record.header,
      lines,
      params: args.params,
      actor: actorOf(args.identity),
      now: deps.now(),
      query: createRuleQuery({
        identity: args.identity,
        catalog: deps.catalog,
        bills: repos.bills,
        ledger: repos.ledger,
        // 🔴 Lock ledger coordinates only for the evaluation that will persist. evaluate is shared by preview / propose /
        // execute, and this switch is how they differ. A preview taking the lock would stall posting for a pure display
        forUpdate: args.forUpdate ?? false,
      }),
      ...(reversalSources === undefined ? {} : { reversalSources }),
    },
    args.transition,
  );
  // 🔴 Candidates become facts. `planEffects` scans the whole module by declaration. An edge listed in two `reverseOn` clauses
  // appears twice. **Only the ledger** knows which one actually posted (the kernel has zero IO and cannot do this).
  // It lives in `evaluate` rather than at each call site: preview / propose / execute share it.
  // Missing one site means that site's numbers differ from what will actually happen.
  //
  // Read the ledger only when there really are candidates. Most edges have no reversal candidate, so this costs nothing.
  if (decision.plan.reversals.length === 0 || posted === null) return { schema, record, lines, decision };
  return { schema, record, lines, decision: reconcilePlanForPreview(decision, posted, lines) };
}

/**
 * Four verdict levels, and whether to execute.
 *
 *   block  refuse. Carry the reason out unchanged
 *   route  do not take this edge. Return the exit to take
 *   warn   continue only if the request carries the confirmation token
 *   hint   execute as usual (a hint is not a gate)
 *
 * 🔴 Exported for `packages/runtime-core/src/command/planner.ts`, **not for it to copy**: Planner is an extension of transition,
 * not a second state machine. "Blocked by a gate" must be the same test and the same behavior on both paths.
 * Planner calls this explicitly only at "no plan (block short-circuit)". The other levels are still judged inside this file's
 * `executeTransitionCore`, inside the transaction.
 */
export function assertExecutable(module: string, decision: TransitionDecision, confirmedWarning: string | null): void {
  const v = decision.verdict;
  if (v.pass) return;
  if (v.level === "block") throw new TransitionRefusedError(module, "block", v.message, decision, null);
  if (v.level === "route") throw new TransitionRefusedError(module, "route", v.message, decision, v.exit);
  if (v.level !== "warn") return;

  // 🔴 What is confirmed is **that sentence**, not a true.
  //
  // Evaluation happens inside the transaction (the frontend preview may already be stale), so "the warning the user confirmed"
  // and "the warning that would block now" are not necessarily the same. Someone else just changed the bill, and a different warning appeared.
  // A bare boolean would also let through this **new warning nobody has seen**, with no symptom.
  if (confirmedWarning === null) throw new TransitionRefusedError(module, "warn", v.message, decision, null);
  if (confirmedWarning !== v.message && confirmedWarning !== warningConfirmationToken(v.message)) {
    throw new TransitionRefusedError(
      module,
      "warn",
      `Confirmed "${confirmedWarning}", but the warning now is "${v.message}" —` +
        `the bill or its context changed in between. Look again, then confirm`,
      decision,
      null,
    );
  }
}

// -- Posting period --------------------------------------------------------------------

/**
 * Which period each kind of ledger entry in this execution belongs to.
 *
 * Returns a `target → period.code` lookup, not a per-line computation:
 * **one execution can have only one belonging decision**. Computing per line would, on a multi-line stock-out that runs at the instant a period rolls,
 * book the first lines in March and the later lines in April, and each line would look legal on its own.
 *
 * Resolve per `book`, not per target. Inventory and finance period boundaries do not line up in a real company.
 * `salesDelivery.confirm` moves stock (inventory) and ar (finance) together, and each book takes its own period.
 *
 * Every ledger row has a posting period (`posting_period` is NOT NULL). Sub-ledgers are assigned by `periodBookOf`.
 * Do not decide it inline and do not default it. A guessed posting period would be written silently into an append-only ledger.
 *
 * ⚠️ This stage has **no period-close gate**. Periods stay open, so `shiftedFrom` is always null.
 * When period close lands, connect `shiftedFrom` to the warn level plus `confirmedWarning` (a shifted period must not be silent),
 * and lock the period before reading it ("the period is open" and writing the ledger are two instants, the same TOCTOU as `setStatus`).
 */
async function postingPeriodResolver(
  repos: ExecutionRepos,
  identity: Identity,
  decision: TransitionDecision,
  at: Date,
): Promise<(target: EffectTarget) => string> {
  const targets = new Set<EffectTarget>([
    ...decision.plan.forward.map((e) => e.target),
    ...decision.plan.reversals.map((r) => r.effect.target),
  ]);
  // An edge that does not post does not read the period table. A status-only edge must not become impassable because periods are unconfigured
  if (!targets.size) return () => "";

  const books = new Set<PeriodBook>();
  for (const target of targets) books.add(periodBookOf(target));

  const resolved = new Map<PeriodBook, string>();
  // Books in alphabetical order. Later this will lock period rows, and unordered locks deadlock
  for (const book of [...books].sort()) {
    const periods = await repos.periods.list(identity, book);
    resolved.set(book, resolvePostingPeriod(periods, book, at).period.code);
  }

  return (target: EffectTarget): string => {
    const book = periodBookOf(target);
    const code = resolved.get(book);
    // Throw if it cannot be resolved. Falling back to an empty string would silently store a ledger row that belongs to no period
    if (!code) throw new Error(`Posting-period resolution: ${target} (${book}) produced no result — refusing to book an entry that cannot say which period it belongs to`);
    return code;
  };
}

// -- Ledger: forward -------------------------------------------------------------------

function forwardRows(
  decision: TransitionDecision,
  module: string,
  billId: string,
  lines: readonly Readonly<Record<string, unknown>>[],
  occurredAt: Date,
  periodOfTarget: (target: EffectTarget) => string,
): readonly NewLedgerRow[] {
  return decision.plan.forward.map((effect) => ({
    effect,
    sourceModule: module,
    sourceId: billId,
    sourceLineId: effect.lineIndex === null ? null : lineIdAt(lines, effect.lineIndex),
    transitionCode: decision.transition.code,
    reversalOf: null,
    occurredAt,
    postingPeriod: periodOfTarget(effect.target),
  }));
}

// -- Ledger: reversal (reconcile with the ledger; do not write every declaration) ------

/** Whether a candidate and a ledger row are the same entry. **Do not compare amount**. Amount comes from the current bill; see below */
function matches(row: LedgerRow, fromTransition: string, effect: ResolvedEffect): boolean {
  return (
    row.transitionCode === fromTransition &&
    row.target === effect.target &&
    // The candidate's op has already been inverted by reverseOf. Invert it back to get the original entry's op
    row.op === EFFECT_REVERSE_OPS[effect.op] &&
    row.subjectType === effect.subjectType &&
    row.subjectId === effect.subjectId &&
    row.scopeType === effect.scopeType &&
    row.scopeId === effect.scopeId
  );
}

/**
 * Reconcile reversal candidates with the ledger, and reverse only rows that **really posted and have not yet been reversed**.
 *
 * 🔴 This is the easiest place in the executor to get wrong, and the hardest place to notice.
 *
 * `plan.reversals` are candidates derived from the **declaration**: scan the whole module for every effect that lists this edge in `reverseOn`.
 * A sales delivery has two edges that both deduct stock (`confirm` and `confirm_over_stock`),
 * and both declare that `close` / `finish` / `unapprove` release them. Walking `close` therefore yields two candidates,
 * but the bill can have taken only one of them, and only one actually posted.
 * Reversing every declaration adds the stock back twice. Inventory gains a copy from nowhere, and the balance looks perfectly normal
 * (it is a legal number, just too large).
 *
 * Reconciliation rules:
 *   · A candidate row matches a ledger row whose `reversalOf` is empty (forward) and that no other row has reversed
 *   · Match on (transitionCode, target, op, subject, scope, **line**), and **consume one to one**
 *     — three detail lines of the same item and warehouse on a stock-out produce three ledger rows, and three candidates must reverse one each
 *   · A candidate that does not match is **dropped**. The declaration says this edge should roll it back, but that entry never posted
 *   · `reversalOf` points at the id of the row being reversed. `sourceLineId` follows that same row
 *
 * 🔴 The line dimension cannot be dropped. The candidate amount comes from **the current bill's candidate line**. The reversed row's id comes from the matched
 * ledger row. If those are not the same line, three lines of 100/200/300 can post "line 1 reversed 300".
 * The item-by-warehouse balance still sums to 0 (so a balance check never finds it), and the cost paid for posting per line
 * (once collapsed into one row it can never be split again) is erased at the reversal step.
 * Open-row order does not help. Rows from one posting share `occurredAt` exactly, and the real order is randomUUID.
 *
 * The amount comes from the **candidate** (the current bill), not the historical value on the reversed row. That is a deliberate choice in the kernel `planEffects`:
 * occupancy entries float with the header amount, and a snapshot would release the wrong amount after an edit.
 * The unique index on `reversalOf` is the last line of defense (reversing the same row twice is rejected).
 * It covers concurrency and replay. It does not replace this reconciliation.
 */
/**
 * The **reconciliation** half of candidate times ledger: which candidates really have an unreversed matching row.
 *
 * 🔴 Split out because it has **two consumers**, and they need different things from "time":
 *   · execution needs it to build reversal rows (it needs `occurredAt` / posting period);
 *   · **preview only needs which rows are real**, and preview **must not produce a posting-period decision**
 *     (that decision exists only for an execution; see AGENTS.md, "posting period is a decision, not a function of occurredAt").
 * Inventing an `at` during preview just to reuse a function forges a decision. That is worse than writing one more function.
 *
 * 🔴 **Both sides must share this one function.** `planEffects` in `engine.ts` scans the whole module by declaration.
 * Every effect that lists this edge in `reverseOn` is a candidate. It computes **candidates**, not facts,
 * and zero-IO kernel code cannot reconcile (its own comment says so).
 * Previously only execution reconciled and preview did not. The measured consequence:
 * `stockOut.void` is listed in `reverseOn` by both `approve` and `confirm_over_stock`,
 * so a bill that **only went through ordinary approval**, when voided, showed a confirm dialog saying "fact 4".
 * 2000 and 1500 each appeared twice, promising to return 7000, while only 3500 had actually been taken.
 * Execution was right (one reversal row per line). **Only the number shown to the person was wrong.**
 *
 * `AGENTS.md` calls "posting requires confirmation" this system's safety gate. The original line is
 * **"a ledger entry must not be stored before the user has seen it"**. A confirm box that doubles the amount
 * cancels that gate: the number the user sees is not what will happen, and it looks completely normal.
 *
 * -- 🔴 "The same edge is listed in several `reverseOn` clauses" does **not** mean the amount doubles --
 *
 * The test is whether those source edges are mutually exclusive paths. A full-repo scan finds two kinds. Do not mix them:
 *
 *   **Class A: exclusive paths** (the bill took only one; the extra candidate is fake)
 *     `stockOut.void`        ← `approve` / `confirm_over_stock`
 *     `purchaseOrder.{unapprove,finish,close}`
 *                            ← `approve` / `approve_plan`
 *
 *   **Class B: one edge moves two books** (`confirm.effects[0]` + `[1]` = stock + ap)
 *     `subcontractIssue` / `subcontractMaterialReturn` / `subcontractReceipt` /
 *     `subcontractReturn` / `purchaseReceipt`
 *     — **both reversals are real and should both be shown.** They were already correct.
 *
 * Reconciliation holds for both classes (keep the ones that really posted), so do **not** hunt class B just because "this edge is listed twice".
 * Those modules have no bug. The symptom looks exactly like class A, so a search will "find" something.
 */
export function openReversalMatches(
  decision: TransitionDecision,
  ledgerRows: readonly LedgerRow[],
  lines: readonly Readonly<Record<string, unknown>>[],
): readonly { readonly candidate: TransitionDecision["plan"]["reversals"][number]; readonly hit: LedgerRow }[] {
  const alreadyReversed = new Set(
    ledgerRows.filter((r) => r.reversalOf !== null).map((r) => r.reversalOf as string),
  );
  const open = ledgerRows.filter((r) => r.reversalOf === null && !alreadyReversed.has(r.id));
  const consumed = new Set<string>();

  const out: { candidate: TransitionDecision["plan"]["reversals"][number]; hit: LedgerRow }[] = [];
  for (const candidate of decision.plan.reversals) {
    // A header-level candidate (lineIndex null) matches only a header-level ledger row: both sides null means the same entry.
    // A per-line candidate resolves the line first, then requires the ledger row to point at that same line
    const lineId = candidate.effect.lineIndex === null ? null : lineIdAt(lines, candidate.effect.lineIndex);
    const hit = open.find(
      (r) => !consumed.has(r.id) && r.sourceLineId === lineId && matches(r, candidate.fromTransition, candidate.effect),
    );
    if (!hit) continue;
    consumed.add(hit.id);
    out.push({ candidate, hit });
  }
  return out;
}

/**
 * Source transitions that still have an unreversed fact in the real ledger.
 *
 * This is a coarse filter before resolving candidates. `openReversalMatches` still pairs book, direction, subject, scope,
 * and detail line one by one. The two layers must not be merged: the coarse filter avoids resolving empty coordinates of a branch that never happened, and the fine match avoids reversing too much.
 */
export function openReversalSourceTransitions(ledgerRows: readonly LedgerRow[]): ReadonlySet<string> {
  const alreadyReversed = new Set(
    ledgerRows.filter((row) => row.reversalOf !== null).map((row) => row.reversalOf as string),
  );
  return new Set(
    ledgerRows
      .filter((row) => row.reversalOf === null && !alreadyReversed.has(row.id))
      .map((row) => row.transitionCode),
  );
}

/**
 * Narrow **candidates** down to **what will actually happen**, then hand that to the outbound projection.
 *
 * 🔴 Preview and the agent entry share this one filter. Do not write a second copy. The loosest of three tests
 * decides what a user will someday see. Same discipline as `queryLedger` (the human side and the tool surface share one resolution).
 */
export function reconcilePlanForPreview(
  decision: TransitionDecision,
  ledgerRows: readonly LedgerRow[],
  lines: readonly Readonly<Record<string, unknown>>[],
): TransitionDecision {
  if (decision.plan.reversals.length === 0) return decision;
  const kept = openReversalMatches(decision, ledgerRows, lines).map((m) => m.candidate);
  if (kept.length === decision.plan.reversals.length) return decision;
  return { ...decision, plan: { ...decision.plan, reversals: kept } };
}

export function reconcileReversals(
  decision: TransitionDecision,
  ledgerRows: readonly LedgerRow[],
  module: string,
  billId: string,
  /** Detail lines of the current bill. A candidate's `lineIndex` is resolved to a lineId through them. Pairing must land on a line */
  lines: readonly Readonly<Record<string, unknown>>[],
  occurredAt: Date,
  periodOfTarget: (target: EffectTarget) => string,
): readonly NewLedgerRow[] {
  const out: NewLedgerRow[] = [];
  for (const { candidate, hit } of openReversalMatches(decision, ledgerRows, lines)) {
    out.push({
      effect: candidate.effect,
      sourceModule: module,
      sourceId: billId,
      sourceLineId: hit.sourceLineId,
      // Record this execution's edge: this reversal is an entry posted by **this edge**
      transitionCode: decision.transition.code,
      reversalOf: hit.id,
      occurredAt,
      // 🔴 The posting period is computed for **this execution**, not copied from the reversed row. Reversing an entry in a closed period
      // is done by booking a reversal in the period that is still open (a current-period correction of a prior-period error),
      // not by inserting a row into a period that has already been reported. The latter makes a report that once existed
      // disappear from the system, while both versions are legal and both can be derived from the ledger.
      postingPeriod: periodOfTarget(candidate.effect.target),
    });
  }
  return out;
}

// -- Push -----------------------------------------------------------------------------

/**
 * Whether a target field can take the same-named field from the source bill: same key, same type, same ref target, and neither side is system-supplied.
 *
 * 🔴 The test must match the kernel `isPushFillable`. That offline gate
 * (`PUSH_TARGET_REQUIRED_UNFILLABLE`) asks exactly "can the required fields be filled from here?".
 * So this function only **finds that field**. Whether it counts as fillable is decided by the kernel's copy:
 * if the two tests drift, the gate is all green and runtime returns 400, which is exactly what the gate exists to prevent.
 */
function copyableFrom(source: ModuleSchema, target: Field): Field | null {
  if (!isPushFillable(source, target, null, isSystemSupplied)) return null;
  // Which field to read is decided by the kernel `pushSourceField` (`pushFrom` first, otherwise the same key).
  // Do not assemble it again here. A gate that judged netPrice while this code reads price is the same kind of drift
  return pushSourceField(source, target, null);
}

export interface PushDraft {
  readonly header: Record<string, unknown>;
  readonly lines: Record<string, readonly Readonly<Record<string, unknown>>[]>;
  /** If detail lines were carried over, the source and target detail-table field keys. Line references pair by index */
  readonly lineLink: { readonly sourceKey: string; readonly targetKey: string } | null;
}

/**
 * A push preview draft may carry snapshot cells (the UI shows the frozen value immediately).
 * The persist envelope must strip those keys. They are system-supplied, and a user or Planner envelope that includes them hits the key gate.
 * A reference (such as salesOrderId) freezes the same cell via snapshot after it is written.
 *
 * Strip only `snapshot != null`. Do not strip other system-supplied values, and do not change the pushFrom declaration.
 */
export function persistablePushDraft(target: ModuleSchema, draft: PushDraft): PushDraft {
  const headerSnap = new Set(target.fields.filter((field) => field.snapshot != null).map((field) => field.key));
  const header = Object.fromEntries(Object.entries(draft.header).filter(([key]) => !headerSnap.has(key)));
  const lines: Record<string, readonly Readonly<Record<string, unknown>>[]> = {};
  for (const [key, rows] of Object.entries(draft.lines)) {
    const table = target.fields.find((field) => field.key === key);
    const colSnap = new Set((table?.fields ?? []).filter((column) => column.snapshot != null).map((column) => column.key));
    lines[key] = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => !colSnap.has(column))));
  }
  return { header, lines, lineLink: draft.lineLink };
}

/**
 * When a push fails, **map the issue coordinate back onto the source bill**.
 *
 * 🔴 S1 F-03: `salesOrder/so-0005` presses "release to production" and gets 400. The issue reports
 * `lines[0].productId`, which is a detail line on the **target bill**. The user is standing on the source page,
 * that cell does not exist in front of them, it cannot be highlighted or edited, and the copy tells them to "pick another row",
 * but they have no such dropdown.
 *
 * The mapping test lives in the kernel (`pushSourceIssueCoordinate`), and it is the same pair used **when the value is actually copied**:
 * `pushSourceTable` / `pushSourceField`. It is not a second copy that merely looks the same.
 *
 * 🔴 **The unmappable case must be said explicitly.** Do not quietly keep the target coordinate:
 * cells fixed by `pushDefaults`, and the target's own quantities and dates, really have no matching cell on the source bill.
 * Keeping the target coordinate means the UI still cannot mark it red, and nothing on screen can say why.
 * That is F-03 itself.
 */
/**
 * @internal Exported **only for the regression line** (same as `foreignGlossary` in `publicProjection`):
 * if this mapping breaks it does not throw. The issue coordinate falls back to the target draft, which is the original F-03,
 * and the symptom is "the UI cannot mark a single red box", with no other signal. Without a unit test, nothing goes red.
 */
export function remapPushIssues(
  source: ModuleSchema,
  target: ModuleSchema,
  issues: readonly BillIssue[],
  line: PushLineMapping | null = null,
): readonly BillIssue[] {
  return issues.map((issue) => {
    const at = pushSourceIssueCoordinate(source, target, issue.path, line);
    if (at === null) {
      return {
        ...issue,
        // Leaving the coordinate empty is **not** falling back to the target coordinate. `path` is how the UI finds the cell.
        // A coordinate that does not exist on this bill makes the UI quietly find nothing and do nothing
        path: "",
        label: `"${issue.label}" while pushing "${target.label}"`,
        message:
          `Creating "${target.label}" by push does not hold: ${issue.message}` +
          ` (this cell is generated by the push, and this bill has no matching place to edit)`,
      };
    }
    return {
      ...issue,
      path: at.path,
      label: at.label,
      // Do not delete a word of the original. It says **why** it does not hold, and only the target module can say that part.
      // The added prefix points at the cell the user can see right now, the one that was just marked red
      message: `"${at.label}" does not hold when creating "${target.label}" by push: ${issue.message}`,
    };
  });
}

/**
 * Record one change fact.
 *
 * 🔴 `repos` must be **the set inside the transaction**. Calling this on repositories assembled outside the transaction yields
 * "the business write rolled back but the event remains", and downstream sends a reminder about a bill that does not exist.
 */
async function recordChange(repos: ExecutionRepos, identity: Identity, event: NewChangeEvent): Promise<void> {
  await repos.changeEvents?.append(identity, event);
}

/**
 * Record one operation-log row. `repos` must be the set inside the transaction, for the same reason as `recordChange`:
 * writing outside the transaction leaves "the business write rolled back but the log remains".
 *
 * Write it immediately before the change fact. If the next step fails in the same callback, both roll back together.
 * If the repository is not installed, this is a no-op. Do not branch on whether it is present.
 */
async function recordOperation(repos: ExecutionRepos, identity: Identity, entry: NewOperationLog): Promise<void> {
  await repos.operationLogs?.append(identity, entry);
}

/** Status after persist. null if it cannot be read. This cell is only for recording what it became. It does not take part in decisions. */
function statusOf(record: BillRecord): string | null {
  const status = record.header["status"];
  return typeof status === "string" && status !== "" ? status : null;
}

async function createGeneratedPushBill(
  deps: RuntimeDeps,
  repos: ExecutionRepos,
  identity: Identity,
  source: ModuleSchema,
  target: ModuleSchema,
  draft: PushDraft,
  line: PushLineMapping | null,
  /** Not recorded when the outer transition is internal. A push a person pressed records the create of this new bill. */
  recordOperationLog: boolean,
): Promise<BillRecord> {
  // Only a buildPushDraft result can reach here. HTTP and Agent have no target-payload entry.
  // The target schema's key gate, required and type checks, and same-tenant reference checks are still fully enforced by the repository.
  // Snapshot cells stay only on the preview draft. The write envelope strips them and the reference freezes them, so they do not hit "field not accepted".
  const persist = persistablePushDraft(target, draft);
  let created: BillRecord;
  try {
    created = await repos.bills.createGenerated(identity, target.code, persist.header, persist.lines);
  } catch (error) {
    // 🔴 Catch only the value-gate class (per-field issues). A key-gate `RepoError` is one sentence and has no coordinate,
    // and that error means **the caller used the wrong interface**. On the push side that is a framework bug, so rethrow it unchanged
    if (!(error instanceof BillInvalidError)) throw error;
    throw new BillInvalidError(
      `Push from this bill "${source.label}" creating "${target.label}"`,
      remapPushIssues(source, target, error.issues, line),
    );
  }
  const tasks = initialHandoffs(target, created.id, deps.now());
  if (tasks.length) await repos.handoff.open(identity, tasks);
  const at = deps.now();
  if (recordOperationLog) {
    await recordOperation(repos, identity, {
      module: target.code,
      billId: created.id,
      billCode: operationLogBillCode(target, created.header),
      kind: "create",
      action: null,
      at,
    });
  }
  // 🔴 A bill created by push is also a create. Missing this spot is subtle: a purchase order created by hand fires a reminder,
  // and the one pushed from a purchase plan **does not**, while the two bills look identical on screen.
  // The change fact is still recorded. The operation log is separate: the branch above does not write it when the outer call is internal.
  await recordChange(repos, identity, {
    module: target.code,
    billId: created.id,
    kind: "create",
    transitionCode: null,
    fromStatus: null,
    toStatus: statusOf(created),
    changedFields: null,
    at,
  });
  return created;
}

/**
 * Compute the downstream draft from the upstream bill.
 *
 * 🔴 The mapping rules are **generic**. There is no `if (module === 'salesOrder')`:
 *   1. A `ref` on the target header points back at the source module **and has no explicit `pushFrom`** → source bill id
 *   2. A `refLine` on the target detail points back at the source module → the line id of **that corresponding row**. The companion header
 *      `ref` on the same row does not enter the draft. When the repository validates refLine it is uniquely carried from that row's bill_id
 *   3. Other fields: if the source bill has a field with the same key, type, and ref, carry the value (or the cell `pushFrom` names)
 *   4. Do **not** carry `primary`. The document number belongs to each bill. Two bills sharing one number cannot be referenced later
 *   5. Skip system-supplied fields on both sides (anything with derive, including rollup / lookup / formula)
 *   6. An object push pairs detail tables uniquely by `push.line`. A string push keeps the refLine.through / same-key derivation
 *
 * Required fields that cannot be carried are **left empty**. A draft is for a person to complete. Guessing a value makes them think it is real.
 */
export function buildPushDraft(
  source: ModuleSchema,
  target: ModuleSchema,
  record: BillRecord,
  /**
   * Cells this edge fixes (`Transition.pushDefaults`).
   *
   * 🔴 Build time already guarantees they do not overlap the copy (`checkCrossReferences` rejects a key that could already be carried from the source bill).
   * Runtime still fills only empty cells, so a bypassed catalog check or a stale catalog cannot let a constant silently overwrite a source fact.
   */
  pushDefaults: Readonly<Record<string, string | number>> | null,
  line: PushLineMapping | null = null,
): PushDraft {
  const header: Record<string, unknown> = {};
  const lines: Record<string, readonly Readonly<Record<string, unknown>>[]> = {};
  let lineLink: { sourceKey: string; targetKey: string } | null = null;

  for (const field of target.fields) {
    // plannerSupplied still must not guess a value from a same-named field. Ordinary push is itself a controlled
    // createGenerated write path, and an explicit pushFrom may freeze a system source coordinate onto the target.
    if (isPlannerSupplied(field)) {
      if (isPushFillable(source, field, null, isSystemSupplied)) {
        const from = pushSourceField(source, field, null);
        const value = from ? record.header[from.key] : undefined;
        if (value !== undefined && value !== null) header[field.key] = value;
      }
      continue;
    }
    if (isSystemSupplied(field)) continue;

    // 🔴 **Derivation is the default. The declaration is the decision.** "ref points at the source module ⇒ fill the source bill id" is a **derivation**
    // rule. It guesses from `{ type:'ref', ref:'<source module>' }` that the modeler wanted the source bill.
    // `pushFrom` is the source the modeler **said explicitly**, and explicit always beats a guess.
    //
    // The measured consequence of omitting this condition: `processReport` has two refs both pointing at `processAssignment`
    // — `processAssignmentId` (which assignment this report is for) and `prevProcessAssignmentId`
    // (`pushFrom: "prevProcessAssignmentId"`, the previous assignment; sequential-production release checks use it for the previous cumulative qualified quantity).
    // This rule used to fire unconditionally, so pushing a report from an assignment **filled both cells with the current assignment id**,
    // and the `pushFrom` declaration was dead. The symptom is "previous step == this step", and the release check then uses this step's own
    // cumulative qualified quantity as the ceiling. The gate always passes, and each cell on its own is a legal assignment id.
    //
    // 🔴 The offline gate cannot see this class. `PUSH_TARGET_REQUIRED_UNFILLABLE` asks "can these required fields
    // be filled?", and this cell can be filled (it is just filled wrong). A declaration that got overwritten has no machine gate after it.
    if (field.type === "ref" && field.ref === source.code && field.pushFrom === null) {
      header[field.key] = record.id;
      continue;
    }
    if (field.primary) continue;

    if (field.type === "subtable") {
      // 🔴 Which source detail table to pair is the kernel's `pushSourceTable`. The test is the **explicit declaration** `refLine.through`,
      // not "the two detail tables happen to share a name". This used to look up `field.key` on the source module,
      // and a different name returned `undefined`, so the whole detail table carried no rows. The 12 same-named push edges happen to be right today,
      // so there is no symptom. The cost of the test and the gate each having their own copy is in that function's comment
      const sourceTable = pushSourceTable(source, field, line);
      const columns = field.fields;
      if (!sourceTable?.fields || !columns) continue;
      const sourceRows = record.lines[sourceTable.key];
      if (!sourceRows?.length) continue;
      // 🔴 Per-line mapping uses the kernel's `pushLineValues`. The manual picker (pick an upstream bill, then check rows)
      // uses the same function. Separate copies mean the same order lines, pushed through "ship" versus built by hand as a
      // stock-out, carry different fields (whether net price came across decides how much receivable is booked), and both bills are legal
      const copied = sourceRows.map((row) =>
        pushLineValues(source, field, record.id, row, isSystemSupplied, line, record.header),
      );
      lines[field.key] = copied;
      lineLink = { sourceKey: sourceTable.key, targetKey: field.key };
      continue;
    }

    const from = copyableFrom(source, field);
    if (!from) continue;
    const value = record.header[from.key];
    if (value === undefined || value === null) continue;
    header[field.key] = value;
  }

  if (pushDefaults) {
    for (const [key, value] of Object.entries(pushDefaults)) {
      const dot = key.indexOf(".");
      if (dot < 0) {
        if (!Object.hasOwn(header, key)) header[key] = value;
        continue;
      }
      const tableKey = key.slice(0, dot);
      const column = key.slice(dot + 1);
      const rows = lines[tableKey];
      // When the source detail table has no rows there is nothing to fill. That is not an error. It means this bill has no lines.
      // The key's legality is guaranteed by the build-time gate. Runtime does not check it again
      if (!rows) continue;
      lines[tableKey] = rows.map((row) => (Object.hasOwn(row, column) ? row : { ...row, [column]: value }));
    }
  }

  return { header, lines, lineLink };
}

// -- Execute ---------------------------------------------------------------------------

export interface ExecuteArgs extends EvaluateArgs {
  /**
   * Confirmation of a warn-level verdict: **the exact warning text the user confirmed**. null if they have not confirmed.
   *
   * If the request does not carry it, do not execute. The server must not assume "they already confirmed" for the user.
   * Why the original sentence is stored instead of a boolean: see `assertExecutable`.
   */
  readonly confirmedWarning: string | null;
  /**
   * Idempotency key. A repeated request for the same (bill, edge, key) does not post twice.
   *
   * Model retries are normal (timeout, context truncation, self-doubt). Without a key, one confirmation deducts stock twice,
   * and each ledger row looks legal on its own.
   *
   * 🔴 `null` means **do not test for replay**, not "use a default key". A person clicking twice is two real
   * intents. Merging them makes "I clearly clicked twice, why did it happen once" impossible to explain.
   * Programmatic calls (agent / automatic retry / push) must carry a key. Repetition on that side is replay.
   */
  readonly idempotencyKey: string | null;
  /**
   * "The judgment the person saw and approved". When present, compare it **inside the transaction** with the recomputation now, and throw on mismatch
   * `StagedDecisionDriftError`.
   *
   * 🔴 The compare must happen here, not on the caller's side. What gets stored is the decision recomputed inside the transaction.
   * Comparing once outside the transaction only narrows the window where "the approver saw A and what was stored is B".
   * Someone else can still edit the bill or ship goods in between, the two judgments still diverge, and afterwards the decision in staged and the
   * checks in the audit both look "normal", with no way to reproduce it.
   *
   * This expected value exists only when confirming a staged action. A person pressing the button directly passes `null` (what they saw is now).
   */
  readonly expectedDecision?: TransitionDecision | null;
}

export interface ExecuteResult {
  readonly outcome: "executed" | "replayed";
  readonly audit: AuditEntry;
  readonly bill: BillRecord;
  readonly from: string;
  readonly to: string;
  /** null on replay: that judgment is in the audit, and recomputing now is no longer valid (the bill is no longer in the start status) */
  readonly decision: TransitionDecision | null;
  readonly posted: readonly NewLedgerRow[];
  readonly handoffs: readonly NewHandoffTask[];
  readonly references: readonly NewReference[];
  /** The first downstream bill. When split into several, this still points at the first. The full list is `pushedBills`. */
  readonly pushed: WrittenBillRef | null;
  /** Every downstream bill this push created, in split order. `[]` when there is no push or this is an idempotent replay. */
  readonly pushedBills: readonly WrittenBillRef[];
}

/**
 * A bill reference in a write result. `revision` is this bill's version after the transaction's write. The caller uses it for the next write
 * and does not have to read again just for a version number.
 */
export interface WrittenBillRef {
  readonly module: string;
  readonly id: string;
  readonly revision: number;
}

interface PlanAuditContext {
  readonly executionPlan: ExecutionPlan;
  readonly planFingerprint: string;
}

interface ExecuteCoreOptions {
  /** A Planner edge writes plan facts into the source transition's audit. Ordinary edges and plan-driven status changes are null */
  readonly planAudit: PlanAuditContext | null;
  /** See `TransitionAuthority` */
  readonly authority: TransitionAuthority;
  /** Evaluation Planner already finished inside the write-set lock. When passed, do not evaluate again. */
  readonly evaluated?: Evaluated;
}

async function cascadeCompositeParent(
  deps: RuntimeDeps,
  repos: ExecutionRepos,
  args: ExecuteArgs,
  schema: ModuleSchema,
  decision: TransitionDecision,
  authority: TransitionAuthority,
): Promise<void> {
  const spec = schema.views.composite;
  if (spec === null) return;
  if (decision.to === initialStatusOf(schema)) return;
  const child = requireRuntimeModule(deps.catalog, spec.child);
  const code = decision.transition.code;
  if (transitionAction(child.schema.lifecycle, code) === null) return;
  const lookup = { catalog: deps.catalog, repos, authorizer: deps.authorizer };
  const composite = { parent: schema, child: child.schema, parentField: spec.parentField };
  const children = await listCompositeChildren(lookup, args.identity, composite, args.billId);
  await assertVisibleChildSet(lookup, args.identity, composite, args.billId, children);
  for (const row of children) {
    // Whichever action the parent took, the child row takes the same action, resolving the edge from the child row's **own** current status.
    // A child row whose status has no such action does not follow
    const status = row.header["status"];
    if (typeof status !== "string" || !status) {
      throw new Error(`Composite archive ${spec.child}#${row.id} is missing status and cannot follow the parent cascade`);
    }
    if (!hasTransitionAt(child.schema, status, code)) continue;
    await executeTransitionCore(
      { ...deps, repos },
      {
        identity: args.identity,
        module: spec.child,
        billId: row.id,
        transition: code,
        params: {},
        confirmedWarning: null,
        idempotencyKey: null,
        expectedRevision: row.revision,
      },
      { planAudit: null, authority },
    );
  }
}

/**
 * Walk one edge. **One transaction**, fixed order.
 *
 * Evaluation is inside the transaction, not outside it. The frontend preview may already be stale (someone just shipped a batch),
 * and posting from a stale conclusion is another way "the approver saw A and what was stored is B" happens.
 */
async function executeTransitionCore(
  deps: RuntimeDeps,
  args: ExecuteArgs,
  options: ExecuteCoreOptions,
): Promise<ExecuteResult> {
  const planAudit = options.planAudit;
  requireIdentity(args.identity);
  let before: BillRecord | null = null;
  const result = await deps.repos.transaction(async (repos) => {
    // This transition, the creates it pushes, and the composite cascade share the instant read the first time.
    const tx = pinClock({ ...deps, repos });
    // Authorization must come before idempotent replay. Replay only means "do not produce the business fact a second time". It is not an authorization bypass.
    // Otherwise, after the grant is revoked, a principal who still knows the old idempotencyKey can read back the historical execution result.
    deps.authorizer.assertModule(args.identity, args.module, "read");
    if (options.authority === "actor") {
      deps.authorizer.assertTransition(args.identity, args.module, args.transition);
    }

    // 0. Idempotency: if this edge already ran with this key, do not run it again. With no key, do not test for replay
    const replay =
      args.idempotencyKey === null
        ? null
        : await repos.audit.find(args.identity, args.module, args.billId, args.transition, args.idempotencyKey);
    if (replay) {
      return {
        outcome: "replayed" as const,
        audit: replay,
        bill: await repos.bills.get(args.identity, args.module, args.billId),
        from: replay.fromStatus,
        to: replay.toStatus,
        decision: null,
        posted: [],
        handoffs: [],
        references: [],
        pushed: null,
        pushedBills: [],
      };
    }

    // 1. Evaluate. 🔴 forUpdate: an availability check locks the ledger coordinate before reading it. Otherwise two concurrent postings
    // each read "still enough", each post, and stock goes negative, while both checks really did pass, with no anomaly to see
    const evaluated = options.evaluated ?? (await evaluate(
      tx,
      { ...args, forUpdate: true },
      repos,
      options.authority,
    ));
    if (evaluated.record.id !== args.billId || evaluated.record.revision < 0) {
      throw new Error("Planner execution consumed a post-lock evaluation that does not match the current source bill");
    }
    // The revision was already compared at the moment evaluate read the bill (before status and gates). Do not compare a second time here
    const { schema, record, lines, decision } = evaluated;
    before = record;

    // 2. Drift: compare the judgment the person approved with **this one** (the one about to be stored).
    // This is before assertExecutable. When the bill has changed so the edge can no longer run, "it changed after propose" explains
    // what happened better than "this edge cannot run now", and it is also the reason for rejecting that staged action
    if (args.expectedDecision) {
      const diffs = compareDecisions(args.expectedDecision, decision);
      if (diffs.length) {
        throw new StagedDecisionDriftError(
          args.module,
          `Refusing to execute — the judgment computed at propose time does not match now. ${driftReason(diffs)}`,
          diffs,
          decision,
        );
      }
    }
    assertExecutable(args.module, decision, args.confirmedWarning);

    const edge: Transition = decision.transition;
    // Do not record it when the edge itself is system-internal. Plan-driven moves and a person pressing a button both look at this flag, not at authority.
    const logEdge = edge.internal !== true;
    const at = tx.now();

    // 3. Change status
    await repos.bills.setStatus(
      args.identity,
      args.module,
      args.billId,
      decision.from,
      decision.to,
      record.revision,
    );

    // 4. Write the audit (including the full checks: a later inquiry asks "what number did that stock check see at the time")
    const audit = await repos.audit.append(args.identity, {
      module: args.module,
      billId: args.billId,
      transitionCode: edge.code,
      fromStatus: decision.from,
      toStatus: decision.to,
      verdict: verdictText(decision),
      params: decision.params,
      checks: decision.checks,
      at,
      idempotencyKey: args.idempotencyKey,
      executionPlan: planAudit === null ? null : planAudit.executionPlan,
      planFingerprint: planAudit === null ? null : planAudit.planFingerprint,
    });

    // 5/6. Ledger: forward rows, plus reversals after reconciliation with the ledger
    const periodOfTarget = await postingPeriodResolver(repos, args.identity, decision, at);
    const forward = forwardRows(decision, args.module, args.billId, lines, at, periodOfTarget);
    const existing = await repos.ledger.rowsOf(args.identity, args.module, args.billId);
    const reversals = reconcileReversals(decision, existing, args.module, args.billId, lines, at, periodOfTarget);
    const posted = [...forward, ...reversals];
    if (posted.length) await repos.ledger.append(args.identity, posted);

    // 7. Handoffs: open the ones the new status should create, cancel the ones leaving the old status should cancel
    const stale = staleHandoffIds(schema, decision.from, decision.to);
    if (stale.length) await repos.handoff.closeOpen(args.identity, args.module, args.billId, stale);
    const handoffs = instantiateHandoffs(schema, edge, args.billId, at);
    if (handoffs.length) await repos.handoff.open(args.identity, handoffs);

    // 8. Push draft + write references
    const pushedBills: WrittenBillRef[] = [];
    const references: NewReference[] = [];
    if (edge.push) {
      const targetSchema = requireRuntimeModule(deps.catalog, edge.push).schema;
      const built = buildPushDraft(schema, targetSchema, record, edge.pushDefaults, edge.pushLine);
      const applied = applyPushBillLines(schema, targetSchema, edge, record, built, decision.params);
      const chunks = splitPushDrafts(targetSchema, applied);
      for (const chunk of chunks) {
        const created = await createGeneratedPushBill(
          tx,
          repos,
          args.identity,
          schema,
          targetSchema,
          chunk.draft,
          edge.pushLine,
          logEdge,
        );
        // A pushed bill is not edited again inside this transaction. The revision returned by create is the revision after the write
        pushedBills.push({ module: edge.push, id: created.id, revision: created.revision });

        const link = chunk.draft.lineLink;
        const sourceRows = link ? chunk.sourceRows : undefined;
        const targetRows = link ? created.lines[link.targetKey] : undefined;
        if (link && sourceRows?.length) {
          if (!targetRows || targetRows.length !== sourceRows.length) {
            throw new Error(
              `Push ${schema.code} → ${edge.push}: source bill has ${sourceRows.length} lines, persisted ${targetRows?.length ?? 0} lines —` +
                `when the counts do not match, references cannot be paired, refusing to write a reference set that does not line up`,
            );
          }
          sourceRows.forEach((row, i) => {
            references.push({
              srcModule: args.module,
              srcId: args.billId,
              srcLineId: lineIdAt(sourceRows, i),
              tgtModule: edge.push as string,
              tgtId: created.id,
              tgtLineId: lineIdAt(targetRows, i),
            });
          });
        } else {
          references.push({
            srcModule: args.module,
            srcId: args.billId,
            srcLineId: null,
            tgtModule: edge.push,
            tgtId: created.id,
            tgtLineId: null,
          });
        }
      }
      if (references.length) await repos.references.append(args.identity, references);
    }

    await cascadeCompositeParent(tx, repos, args, schema, decision, options.authority);

    // Change facts go to the outbox. This bill records "this edge ran". Bills created by the push
    // each record their own create inside `createGeneratedPushBill`. The two facts are not mixed into one record.
    // Replay already returned above and will not write a second row. System-internal edges do not write an operation log.
    const after = await repos.bills.get(args.identity, args.module, args.billId);
    if (logEdge) {
      await recordOperation(repos, args.identity, {
        module: args.module,
        billId: args.billId,
        billCode: operationLogBillCode(schema, after.header),
        kind: "transition",
        action: operationLogTransitionAction(schema, decision.transition.code),
        at,
      });
    }
    await recordChange(repos, args.identity, {
      module: args.module,
      billId: args.billId,
      kind: "transition",
      transitionCode: decision.transition.code,
      fromStatus: decision.from,
      toStatus: decision.to,
      changedFields: diffFields(record.header, after.header),
      at,
    });

    return {
      outcome: "executed" as const,
      audit,
      bill: after,
      from: decision.from,
      to: decision.to,
      decision,
      posted,
      handoffs,
      references,
      pushed: pushedBills[0] ?? null,
      pushedBills,
    };
  });
  if (result.outcome === "executed") {
    if (before === null) {
      throw new Error(
        `Missing the before-image of the bill after executing ${args.module}#${args.billId} ${args.transition}`,
      );
    }
    if (deps.afterBillWrite) {
      await deps.afterBillWrite({
        repos: deps.repos,
        identity: args.identity,
        module: args.module,
        action: "transition",
        before,
        after: result.bill,
      });
    }
  }
  return result;
}

/**
 * Public execute entry for an ordinary transition. An edge bound to a Planner cannot bypass plan recomputation and the batch transaction from here.
 */
export async function executeTransition(deps: RuntimeDeps, args: ExecuteArgs): Promise<ExecuteResult> {
  const planner = requireRuntimeModule(deps.catalog, args.module).planners.get(args.transition);
  if (planner !== undefined) {
    throw new Error(
      `Edge ${args.transition} on module ${args.module} is bound to a Planner. Preview first and use the plan execute entry,` +
        `do not execute only the source transition`,
    );
  }
  return await executeTransitionCore(deps, args, { planAudit: null, authority: "actor" });
}

/** Called only from packages/runtime-core/src/command/planner.ts: write plan facts into the same audit row as the source transition. */
export async function executeTransitionWithinPlan(
  deps: RuntimeDeps,
  args: ExecuteArgs,
  executionPlan: ExecutionPlan,
  planFingerprint: string,
  repos: ExecutionRepos,
): Promise<ExecuteResult> {
  const planner = requireRuntimeModule(deps.catalog, args.module).planners.get(args.transition);
  if (planner === undefined) {
    throw new Error(`Edge ${args.transition} on module ${args.module} has no Planner, so it cannot write a plan audit`);
  }
  if (!/^[0-9a-f]{64}$/.test(planFingerprint)) {
    throw new Error("Planner audit planFingerprint must be the SHA-256 of the source transition decision plus the canonical ExecutionPlan");
  }
  return await executeTransitionCore({ ...deps, repos }, args, {
    planAudit: { executionPlan: normalizeExecutionPlan(executionPlan), planFingerprint },
    authority: "actor",
  });
}

/** The edge an `ExecutionPlan` `setStatus` command is going to drive. */
export interface PlanEffectTransitionArgs {
  readonly identity: Identity;
  readonly module: string;
  readonly billId: string;
  readonly transition: string;
}

/**
 * Drive a target bill along one edge as the `setStatus` side effect of an **already authorized source transition**.
 *
 * 🔴 **This is not a second write path.** It is `executeTransitionCore`: the same evaluation,
 * the same four verdict levels, the same status change / audit / posting / handoff / push. The only difference from `executeTransition`
 * is the `authority: "plan"` slot (the test is written on `TransitionAuthority`).
 * A bare setStatus repository method is the shape this capability most easily goes wrong in. It would skip
 * the target edge's preconditions, handoff, and effects, while the bill looks completely normal on screen.
 *
 * 🔴 **The target edge must not itself be bound to a Planner.** A nested plan has no fingerprint. The outer user confirmed the outer
 * plan and never saw a word of the inner one, and Planner recursion still has no depth limit.
 * The day "release should also release the next level" is really needed, the right shape is for the outer Planner to flatten both levels of commands
 * **into the same plan in one shot**, so they enter the same fingerprint.
 *
 * 🔴 **`params` is always empty, `confirmedWarning` is always null, `idempotencyKey` is always null**:
 *   · `params` is a closed set declared per edge, and it only reaches rules and the audit. Letting a program invent a "rejection reason"
 *     or any other sentence written on the spot means nobody can later tell which sentence a person said;
 *   · a warn-level confirmation is **the sentence the user saw**. Forwarding the source edge's confirmation text to the target edge
 *     uses a confirmation about A to let through a warning about B, with no symptom. If the target edge is warn,
 *     that means `TransitionRefusedError` and the whole group rolls back. That is correct: nobody has seen that sentence;
 *   · replay is judged on the **outer envelope** (the source transition's audit plus `oe_execution_created_bill`).
 *     Hanging another key here would, on a hit, silently return `replayed`, and that outcome on this path can only be a bug.
 */
export async function executeTransitionAsPlanEffect(
  deps: RuntimeDeps,
  args: PlanEffectTransitionArgs,
): Promise<ExecuteResult> {
  if (requireRuntimeModule(deps.catalog, args.module).planners.has(args.transition)) {
    throw new Error(
      `The execution plan wants to drive ${args.module}.${args.transition}, but that edge is itself bound to a Planner — ` +
        `a nested plan has no fingerprint, so the plan the outer user confirmed cannot see it. Flatten both levels of commands into the same plan`,
    );
  }
  return await executeTransitionCore(
    deps,
    { ...args, params: {}, confirmedWarning: null, idempotencyKey: null, expectedRevision: null },
    { planAudit: null, authority: "plan" },
  );
}

function assertWriteEnvelopeSystemValues(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null,
  stored: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  } | null,
  what: string,
): void {
  const classified = classifyBillWriteEnvelope(schema, header, lines, "user", stored);
  if (classified.conflicts.length) {
    throw new RepoError(`${what}: ${classified.conflicts.map((item) => item.message).join("; ")}`);
  }
}

export type InternalTransitionArgs = ExecuteArgs;

/**
 * Execute a system edge the schema explicitly marks internal.
 *
 * An `internal` edge deliberately stays out of the user permission catalog and does not appear in the HTTP/Agent general action list, so when a program drives it
 * it must not also require a transition grant that will never exist. This entry skips only that slot and fully reuses core's read authorization,
 * data scope, status and preconditions, transaction, audit, effects, handoff, and concurrency checks.
 */
export async function executeInternalTransition(
  deps: RuntimeDeps,
  args: InternalTransitionArgs,
): Promise<ExecuteResult> {
  const module = requireRuntimeModule(deps.catalog, args.module);
  // Whether it is a system edge is a fact of the action layer: every edge of the same action agrees on internal
  if (transitionAction(module.schema.lifecycle, args.transition)?.internal !== true) {
    throw new Error(`Edge ${args.transition} on module ${args.module} is not internal and cannot use the system-internal entry`);
  }
  if (module.planners.has(args.transition)) {
    throw new Error(`Internal edge ${args.transition} on module ${args.module} is bound to a Planner and cannot bypass the plan execute entry`);
  }
  return await executeTransitionCore(deps, args, { planAudit: null, authority: "internal" });
}

// -- Create (no gate, no posting, no state machine) ------------------------------------

/**
 * Create a bill, and realize the "entered the initial status" event.
 *
 * Routes do not call `bills.create` directly and go through this layer for one reason: handoff declarations hanging on the initial status would otherwise never
 * be instantiated (create does not pass through any edge). See `initialHandoffs`.
 *
 * 🔴 **Same transaction** as the create. If the bill lands and the todo does not, the inbox is silently missing one item,
 * and there is no symptom. Inside the repository, an executor that is already in a transaction gets a SAVEPOINT. The semantics do not change.
 */
export async function createBill(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): Promise<BillRecord> {
  requireIdentity(identity);
  const schema = requireRuntimeModule(deps.catalog, module).schema;
  // 🔴 Same manual entry as ListPage `createBlocked`. Hiding "New" in the UI is not enough.
  // HTTP, Agent direct create, batch create, and import all come through here. Missing this layer only moves the entry from the menu to the API.
  // System-generated modules use `createInternalBill`. Status-edge push uses `createGenerated`. Neither goes through this function.
  if (!schema.creatable.manual) {
    const origins = schema.creatable.pushedFrom ?? [];
    // One source module may have several transitions (for example the same "subcontract receipt" name under different statuses).
    // Flow assembly must keep those edges, but the user-facing hint says each "source module + action name" only once.
    const displayedOrigins = origins.filter((origin, index) =>
      origins.findIndex((candidate) =>
        candidate.module === origin.module && candidate.action === origin.action,
      ) === index,
    );
    const how =
      displayedOrigins.length > 0
        ? `This bill is produced by ${displayedOrigins.map((o) => `"${o.moduleLabel}" / "${o.action}"`).join(", ")} and cannot be created by hand`
        : `This bill cannot be created by hand right now: ${schema.creatable.blockers
            .map((b) => `${b.label} (${b.path}): ${b.why}`)
            .join("; ")}`;
    throw new RepoError(how);
  }
  assertWriteEnvelopeSystemValues(schema, header, lines, null, `Creating "${schema.label}"`);
  deps.authorizer.assertModule(identity, module, "create");
  const createPreconditions = schema.preconditions.filter((rule) => rule.onCreate && rule.enabled);
  if (createPreconditions.length > 0) {
    const subtable = schema.fields.find((field) => field.type === "subtable");
    const createLines = subtable === undefined ? [] : (lines[subtable.key] ?? []);
    const decision = await evaluateCreatePreconditions({
      module: schema,
      bill: header,
      lines: createLines,
      actor: actorOf(identity),
      now: deps.now(),
      query: createRuleQuery({
        identity,
        catalog: deps.catalog,
        bills: deps.repos.bills,
        ledger: deps.repos.ledger,
      }),
    });
    if (!decision.verdict.pass) {
      throw new RepoError(decision.verdict.message);
    }
  }
  deps.authorizer.assertWritePayload(identity, module, header, lines);
  const created = await deps.repos.transaction(async (repos) => {
    const created = await repos.bills.create(identity, module, header, lines);
    const tasks = initialHandoffs(schema, created.id, deps.now());
    if (tasks.length) await repos.handoff.open(identity, tasks);
    const at = deps.now();
    await recordOperation(repos, identity, {
      module,
      billId: created.id,
      billCode: operationLogBillCode(schema, created.header),
      kind: "create",
      action: null,
      at,
    });
    await recordChange(repos, identity, {
      module,
      billId: created.id,
      kind: "create",
      transitionCode: null,
      fromStatus: null,
      toStatus: statusOf(created),
      changedFields: null,
      at,
    });
    return created;
  });
  if (deps.afterBillWrite) {
    await deps.afterBillWrite({ repos: deps.repos, identity, module, action: "create", before: null, after: created });
  }
  return created;
}

/** A bill generated inside a Planner plan: the payload is already inside the fingerprint the user confirmed, and it still passes the full key, value, and reference gates. */
export async function createPlannedBill(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
): Promise<BillRecord> {
  requireIdentity(identity);
  const schema = requireRuntimeModule(deps.catalog, module).schema;
  return await deps.repos.transaction(async (repos) => {
    const created = await repos.bills.createGenerated(identity, module, header, lines);
    const tasks = initialHandoffs(schema, created.id, deps.now());
    if (tasks.length) await repos.handoff.open(identity, tasks);
    const at = deps.now();
    // System-generated bills (`createInternalBill` also comes through here) do not write an operation log. A business bill generated inside a plan records the create.
    if (schema.capabilities.create !== "system") {
      await recordOperation(repos, identity, {
        module,
        billId: created.id,
        billCode: operationLogBillCode(schema, created.header),
        kind: "create",
        action: null,
        at,
      });
    }
    await recordChange(repos, identity, {
      module,
      billId: created.id,
      kind: "create",
      transitionCode: null,
      fromStatus: null,
      toStatus: statusOf(created),
      changedFields: null,
      at,
    });
    return created;
  });
}

// -- System-internal writes (do not borrow a person's grant) ---------------------------
//
// Same discipline as `executeInternalTransition`: a human coordinate that is not in the permission catalog, and should not be,
// must not be required again when a program drives it. Skip only the human-grant slot. Read authorization, data scope, key and value gates,
// revision optimistic lock, and change facts stay. The caller is a server job. HTTP and Agent do not expose these two entries.

/**
 * Create a bill on a system-generated module (`capabilities.create === "system"`).
 *
 * The person's coordinate is "generate" (module create), judged at the caller. The row is stored by a system job and does not borrow a person's
 * create or field write. Persistence is the same path as a Planner-generated bill (`createGenerated` + initial-status todos + change fact).
 */
export async function createInternalBill(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  header: Readonly<Record<string, unknown>>,
): Promise<BillRecord> {
  requireIdentity(identity);
  const schema = requireRuntimeModule(deps.catalog, module).schema;
  if (schema.capabilities.create !== "system") {
    throw new Error(`Module ${module} is not a system-generated module and cannot use the system-internal create entry`);
  }
  deps.authorizer.assertModule(identity, module, "read");
  const created = await createPlannedBill(deps, identity, module, header, {});
  if (deps.afterBillWrite) {
    await deps.afterBillWrite({ repos: deps.repos, identity, module, action: "create", before: null, after: created });
  }
  return created;
}

/**
 * Write system-generated header facts (`isGeneratedHeaderField`): generation result, failure reason, stamp.
 *
 * A person's save is `saveDraft`. It requires update and per-field write, and it changes cells the current status allows a person to change.
 * This changes system cells a person has no entry to. The key gate and value gate are in `setGeneratedHeader`.
 */
export async function saveInternalHeader(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  id: string,
  patch: Readonly<Record<string, unknown>>,
  expectedRevision: number,
): Promise<BillRecord> {
  requireIdentity(identity);
  requireRuntimeModule(deps.catalog, module);
  deps.authorizer.assertModule(identity, module, "read");
  const record = await readAtRevision(module, id, expectedRevision, () => deps.repos.bills.get(identity, module, id));
  // A system stamp does not enter the operation log. The change fact is still written, and the reminder path stays.
  const saved = await deps.repos.transaction(async (repos) => {
    const saved = await repos.bills.setGeneratedHeader(identity, module, id, patch, expectedRevision);
    await recordChange(repos, identity, {
      module,
      billId: id,
      kind: "update",
      transitionCode: null,
      fromStatus: null,
      toStatus: statusOf(saved),
      changedFields: diffFields(record.header, saved.header),
      at: deps.now(),
    });
    return saved;
  });
  if (deps.afterBillWrite) {
    await deps.afterBillWrite({ repos: deps.repos, identity, module, action: "save", before: record, after: saved });
  }
  return saved;
}

// -- Save draft (no gate, no posting, no state machine) --------------------------------

/**
 * Save the fields the current status allows to be changed.
 *
 * Called out separately instead of treated as an edge: it does not change status, does not post, and does not run preconditions.
 * Which fields can change is derived by `editableFields(schema, status)`, not configured on its own.
 * Out-of-range keys are rejected by the repository (silently dropping them would make the caller think the write succeeded).
 */
export async function saveDraft(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  id: string,
  patch: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null,
  expectedRevision: number | null,
): Promise<BillRecord> {
  requireIdentity(identity);
  const schema = requireRuntimeModule(deps.catalog, module).schema;
  deps.authorizer.assertModule(identity, module, "read");
  if (deps.authorizer.catalog.byKey.has(modulePermissionKey(module, "update"))) {
    deps.authorizer.assertModule(identity, module, "update");
  } else {
    schemaFail(`"${schema.label}" has no editable status and cannot be modified`);
  }
  const record = await readAtRevision(module, id, expectedRevision, () => deps.repos.bills.get(identity, module, id));
  assertWriteEnvelopeSystemValues(
    schema,
    patch,
    lines,
    { header: record.header, lines: record.lines },
    `Saving "${schema.label}"`,
  );
  const strippedPatch = omitMatchingSystemWriteKeys(schema.fields, patch, "user", record.header);
  let strippedLines = lines;
  if (lines !== null) {
    const next: Record<string, readonly Record<string, unknown>[]> = {};
    for (const [table, rows] of Object.entries(lines)) {
      const field = schema.fields.find((candidate) => candidate.key === table && candidate.type === "subtable");
      const storedRows = record.lines[table] ?? [];
      next[table] = rows.map((row) => {
        const storedRow =
          typeof row["id"] === "string"
            ? (storedRows.find((candidate) => candidate["id"] === row["id"]) ?? null)
            : null;
        return omitMatchingSystemWriteKeys(field?.fields ?? [], row, "user", storedRow);
      });
    }
    strippedLines = next;
  }
  deps.authorizer.assertWritePayload(identity, module, strippedPatch, strippedLines);
  const status = record.header["status"];
  if (typeof status !== "string" || !status) throw new Error(`Bill ${module}#${id} is missing status, so editable fields cannot be decided`);
  const editable = new Set(editableFields(schema, status));
  // Carry "the status read when editable was computed" all the way into the UPDATE WHERE,
  // otherwise a bill someone else transitioned in between would be rewritten under draft rules (see BillRepo.save)
  // 🔴 The extra transaction is so "the business write and the change fact live and die together". `bills.save` already opens a transaction,
  // and nesting here becomes a SAVEPOINT (the advisory lock still belongs to the outer one; see billRepo's inTx note).
  // The cost is one extra BEGIN. **Do not branch on whether changeEvents is installed.** Two paths means one of them nobody runs.
  const saved = await deps.repos.transaction(async (repos) => {
    const saved = await repos.bills.save(
      identity, module, id, strippedPatch, strippedLines, editable, status, record.revision,
    );
    const at = deps.now();
    await recordOperation(repos, identity, {
      module,
      billId: id,
      billCode: operationLogBillCode(schema, saved.header),
      kind: "update",
      action: null,
      at,
    });
    await recordChange(repos, identity, {
      module,
      billId: id,
      kind: "update",
      transitionCode: null,
      fromStatus: null,
      toStatus: statusOf(saved),
      changedFields: diffFields(record.header, saved.header),
      at,
    });
    return saved;
  });
  if (deps.afterBillWrite) {
    await deps.afterBillWrite({ repos: deps.repos, identity, module, action: "save", before: record, after: saved });
  }
  return saved;
}

/**
 * Delete a record the declaration allows to be deleted, and that has no history or downstream dependency that must be kept.
 *
 * 🔴 The declaration-layer test is `deletableIn`, **not `status.editable === "full"`**. The latter asks
 * "can this record's fields still be changed". An occupancy archive that is enabled cannot be deleted (disable it or mark the person as left first). A bill
 * is still "still in the initial status and creatable by hand". The precise reference and trace check is in `BillRepo.remove`
 * (`assertRemovable`). This layer does not repeat that work.
 */
export async function deleteBill(
  deps: RuntimeDeps,
  identity: Identity,
  module: string,
  id: string,
  expectedRevision: number | null,
): Promise<{ readonly id: string; readonly status: string }> {
  requireIdentity(identity);
  const schema = requireRuntimeModule(deps.catalog, module).schema;
  deps.authorizer.assertModule(identity, module, "read");
  if (deps.authorizer.catalog.byKey.has(modulePermissionKey(module, "delete"))) {
    deps.authorizer.assertModule(identity, module, "delete");
  }
  const record = await readAtRevision(module, id, expectedRevision, () => deps.repos.bills.get(identity, module, id));
  const status = record.header["status"];
  if (typeof status !== "string" || !status) {
    return schemaFail(`Bill ${module}#${id} is missing status, so whether delete is allowed cannot be decided`);
  }
  const state = schema.lifecycle.statuses.find((candidate) => candidate.key === status);
  if (!state) {
    return schemaFail(`Status "${status}" of bill ${module}#${id} is not in the module declaration, refusing to delete`);
  }
  if (!deletableIn(schema, status)) {
    const occupancy = occupancyOf(schema, status);
    // Occupied: do not say "already in a business flow". Disabling is not entering a flow.
    if (occupancy === "in-use") {
      const leave = occupancyLeaveFrom(schema, status);
      return schemaFail(
        `This "${schema.label}" is currently "${state.label}" and cannot be deleted —` +
          (leave === null
            ? "An enabled archive cannot be deleted directly"
            : `Do "${leave.action}" first. After that, it can be deleted only if no reference or trace must be kept`),
      );
    }
    // The bill has left the initial status: a fact that has entered a business flow cannot be deleted. Occupancy retired takes the branch below (it cannot be rebuilt by hand).
    if (occupancy === "none" && !state.initial) {
      const initialLabel = schema.lifecycle.statuses.find((candidate) => candidate.initial)?.label ?? null;
      return schemaFail(
        `This "${schema.label}" has already ${initialLabel === null ? "" : `left "${initialLabel}" and `}moved to "${state.label}" and cannot be deleted —` +
          "A fact that has entered a business flow cannot be deleted",
      );
    }
    // `creatable.manual === false`: the only way to produce it is upstream, and that edge cannot be pressed a second time once it has run.
    // Which button to use instead is derived from the declaration (`retirementExitsOf`). It does not hardcode any action code
    const exits = retirementExitsOf(schema, status);
    return schemaFail(
      `This "${schema.label}" can only be produced by a push from an upstream bill and cannot be deleted — deleting it means a second one can never be created,` +
        (exits.length === 0
          ? "Contact an administrator"
          : `To drop this batch, use this bill's "${exits.join('" or "')}" instead. It leaves a record and closes the related todos`),
    );
  }
  const billCode = operationLogBillCode(schema, record.header);
  await deps.repos.transaction(async (repos) => {
    await repos.bills.remove(identity, module, id, status, record.revision);
    const at = deps.now();
    await recordOperation(repos, identity, {
      module,
      billId: id,
      billCode,
      kind: "delete",
      action: null,
      at,
    });
    await recordChange(repos, identity, {
      module,
      billId: id,
      kind: "delete",
      transitionCode: null,
      fromStatus: status,
      toStatus: null,
      changedFields: null,
      // The row is about to disappear, and the notification renders outside the transaction. Without this copy, a delete can never send content
      deletedHeader: record.header,
      at,
    });
  });
  if (deps.afterBillWrite) {
    await deps.afterBillWrite({ repos: deps.repos, identity, module, action: "delete", before: record, after: null });
  }
  return { id, status };
}

// -- Staged actions: the agent's write entry ------------------------------------------

export interface ProposeArgs extends EvaluateArgs {
  readonly reason: string;
  readonly idempotencyKey: string;
}

/**
 * "Who proposed it" is **a projection of identity, not an input**.
 *
 * 🔴 Taking this from the request body opens impersonation. Any programmatic caller can sign the draft as "risk assistant" or
 * someone's employee number. The approver then decides "risk proposed this, it should be fine" and confirms. Afterwards
 * `oe_staged_action` has only that self-claimed value, and the real proposer cannot be recovered.
 * Same ownership discipline as the view repository (`SavedViewInput` has no `ownerId`).
 *
 * An agent proposal records agentId. A person's proposal records userId. `agentId` null is a **known fact**
 * (this call was not sent by an agent), not a failure to resolve. The two propose paths (HTTP and the agent tool)
 * therefore sign a value on the same axis.
 */
export function proposerOf(identity: Identity): string {
  return identity.agentId ?? identity.userId;
}

/**
 * Whether it may enter the todo list.
 *
 * 🔴 **The human and agent propose paths share this one function** (runtime `proposeTransition` and
 * `bill_propose` in `agent/execute.ts`). Separate copies were measured: the agent copy blocked only
 * `block` and missed `route`, so when stock was short an agent proposing to confirm a stock-out produced a todo
 * that could **never be confirmed and was never auto-rejected**. The same action was looser through the agent entry than through the human entry,
 * while the route file's header says there is no agent-only back door.
 *
 * Only this gate is shared, not the whole propose. The actor axis is supposed to fork by caller.
 */
export function assertProposable(module: string, decision: TransitionDecision): void {
  const v = decision.verdict;
  if (v.pass) return;
  // Both block and route mean this edge will not execute. Asking a person to confirm an action that is doomed not to run
  // only spends their trust. When route refuses, carry exit out unchanged. The model re-proposes that edge from it.
  // That is why route exists. Saying only "it cannot run" collapses route into block
  if (v.level === "block") throw new TransitionRefusedError(module, "block", v.message, decision, null);
  if (v.level === "route") throw new TransitionRefusedError(module, "route", v.message, decision, v.exit);
}

/**
 * The ordinary staged entry writes only the transition decision. A Planner edge must go through packages/runtime-core/src/command/planner.ts,
 * which writes ExecutionPlan and fingerprint as a pair. Otherwise it still degrades into a half-execution that only changes the source bill.
 */
export function assertStagingSupportsTransition(catalog: RuntimeCatalog, module: string, transition: string): void {
  if (requireRuntimeModule(catalog, module).planners.has(transition)) {
    schemaFail(
      `Edge ${transition} on module ${module} carries an ExecutionPlan and cannot use the ordinary staged entry — ` +
        `use Planner propose instead. Refusing to stage only the source transition`,
    );
  }
}

/**
 * An agent proposes a staged action. **It does not touch business data.**
 *
 * `block` and `route` refuse immediately and do not enter the todo list. Both mean this edge will not execute.
 * Asking a person to confirm an action that is doomed not to run only spends their trust. The refusal gives the reason to the model unchanged,
 * and it re-proposes the `exit` edge from that. That is why route exists.
 */
export async function proposeTransition(deps: RuntimeDeps, args: ProposeArgs): Promise<StagedActionRecord> {
  assertStagingSupportsTransition(deps.catalog, args.module, args.transition);
  const { decision, record } = await evaluate(deps, args);
  assertProposable(args.module, decision);

  return await deps.repos.staged.propose(args.identity, {
    module: args.module,
    billId: args.billId,
    transitionCode: args.transition,
    params: decision.params,
    decision,
    proposedRevision: record.revision,
    executionPlan: null,
    planFingerprint: null,
    proposedBy: proposerOf(args.identity),
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
  });
}

function effectKey(effect: ResolvedEffect): string {
  return [
    effect.target,
    effect.op,
    effect.amount,
    effect.subjectType,
    effect.subjectId,
    effect.scopeType ?? "-",
    effect.scopeId ?? "-",
    effect.lineIndex ?? "-",
  ].join("|");
}

/**
 * Whether the judgment at propose time and the judgment recomputed now have changed.
 *
 * 🔴 Skipping the compare produces "the approver saw A and what was stored is B". Confirmation often happens minutes or hours later,
 * and in between someone may have edited the bill, shipped goods, or disabled a customer. That kind of incident cannot be reproduced afterwards.
 * The staged action holds the old judgment, the ledger holds the new result, and both look "normal".
 */
/** The rejection reason and the API error share this sentence. Separate copies would make the inbox and the API say different things */
function driftReason(diffs: readonly string[]): string {
  return `The bill changed after it was proposed: ${diffs.join("; ")}`;
}

export function compareDecisions(before: TransitionDecision, after: TransitionDecision): readonly string[] {
  const diffs: string[] = [];
  if (before.from !== after.from || before.to !== after.to) {
    diffs.push(`Status move changed from "${before.from}→${before.to}" to "${after.from}→${after.to}"`);
  }
  const level = (d: TransitionDecision): string => (d.verdict.pass ? "pass" : d.verdict.level);
  if (level(before) !== level(after)) {
    diffs.push(`Verdict changed from "${level(before)}" to "${level(after)}"`);
  }
  const byId = new Map(before.checks.map((c) => [c.id, c]));
  for (const now of after.checks) {
    const then = byId.get(now.id);
    if (!then) {
      diffs.push(`Added check "${now.id}": ${now.detail}`);
      continue;
    }
    if (then.ok !== now.ok) diffs.push(`Check "${now.id}" changed from ${then.ok ? "passed" : "failed"} to ${now.ok ? "passed" : "failed"}: ${now.detail}`);
    else if (then.detail !== now.detail) diffs.push(`Check "${now.id}" changed in fact: ${then.detail} → ${now.detail}`);
  }
  for (const then of before.checks) {
    if (!after.checks.some((c) => c.id === then.id)) diffs.push(`Check "${then.id}" no longer applies`);
  }

  const beforeForward = before.plan.forward.map(effectKey);
  const afterForward = after.plan.forward.map(effectKey);
  if (beforeForward.join(",") !== afterForward.join(",")) {
    diffs.push(`Posting plan changed: ${beforeForward.join("; ") || "none"} → ${afterForward.join("; ") || "none"}`);
  }
  const beforeRev = before.plan.reversals.map((r) => `${r.fromTransition}:${effectKey(r.effect)}`);
  const afterRev = after.plan.reversals.map((r) => `${r.fromTransition}:${effectKey(r.effect)}`);
  if (beforeRev.join(",") !== afterRev.join(",")) {
    diffs.push(`Reversal candidates changed: ${beforeRev.join("; ") || "none"} → ${afterRev.join("; ") || "none"}`);
  }
  return diffs;
}

export interface ConfirmArgs {
  readonly identity: Identity;
  readonly stagedId: string;
  /** See ExecuteArgs.confirmedWarning: what is confirmed is that sentence, not a true */
  readonly confirmedWarning: string | null;
}

/**
 * Confirm is an idempotent command, not a one-time ticket.
 *
 * | Status | Behavior |
 * | pending | Execute, then mark confirmed |
 * | confirmed | Do not throw. The same `staged:<id>` key goes through the executor and returns a replayed receipt |
 * | rejected / expired | 409, the card is no longer valid |
 *
 * The order is still **execute first, then record the confirmation**. If it crashes in between, the staged action stays pending, a retry hits the idempotency key,
 * receives replayed, and then marks it confirmed. It does not post twice.
 * The reverse (mark confirmed, then execute) crashes in the middle into a record that is "confirmed but not executed",
 * and it can never recover on its own: the status is confirmed, so nobody will execute it again.
 *
 * 🔴 The drift compare is not done here. The judgment from propose time is handed to the executor to compare **inside the transaction**
 * (`ExecuteArgs.expectedDecision`). Evaluating once here and comparing means the compared value and the stored value are two evaluations,
 * and the window between them is exactly the window `StagedDecisionDriftError` claims to close.
 */
export function assertStagedConfirmable(staged: StagedActionRecord): void {
  if (staged.status === "pending" || staged.status === "confirmed") return;
  // User-facing: the status uses a display label (do not leak raw keys such as pending/rejected). The id is internal and does not enter user copy.
  throw new StagedActionError(
    `This staged action is currently "${STAGED_STATUS_LABELS[staged.status]}" and cannot be confirmed again`,
    409,
  );
}

export async function confirmStaged(deps: RuntimeDeps, args: ConfirmArgs): Promise<ExecuteResult> {
  const staged = await deps.repos.staged.get(args.identity, args.stagedId);
  // The staged table itself has only the tenant axis. Reading the source bill also enforces module read and the self/all row scope.
  deps.authorizer.assertTransition(args.identity, staged.module, staged.transitionCode);
  await deps.repos.bills.get(args.identity, staged.module, staged.billId);
  assertStagedConfirmable(staged);
  const replaying = staged.status === "confirmed";
  if (!replaying) {
    if (staged.proposedRevision === null) {
      throw new StagedActionError(
        `Staged action ${staged.id} was created before the revision optimistic lock shipped and has no propose-time version;` +
          `refusing to guess version 1. Reject it and propose again from the latest bill`,
        409,
      );
    }
    assertStagingSupportsTransition(deps.catalog, staged.module, staged.transitionCode);
  }

  let result: ExecuteResult;
  try {
    result = await executeTransition(deps, {
      identity: args.identity,
      module: staged.module,
      billId: staged.billId,
      transition: staged.transitionCode,
      params: staged.params,
      confirmedWarning: args.confirmedWarning,
      expectedDecision: replaying ? null : staged.decision,
      expectedRevision: replaying ? null : staged.proposedRevision,
      // The staged action's own id is a natural idempotency key: one staged action should be executed only once
      idempotencyKey: `staged:${staged.id}`,
    });
  } catch (err: unknown) {
    // On drift, reject it outright and do not leave it hanging. Confirming a staged action that carries a stale judgment hits
    // the same drift again, and every hit makes a person re-evaluate something that no longer holds.
    // Other failures (block / warn / database errors) are not rejected. Those may pass on retry, and rejecting them would decide for the person
    if (!replaying && err instanceof StagedDecisionDriftError) {
      await deps.repos.staged.decide(args.identity, staged.id, "rejected", driftReason(err.differences));
    }
    throw err;
  }
  await deps.repos.staged.decide(args.identity, staged.id, "confirmed", null);
  return result;
}

export async function rejectStaged(
  deps: RuntimeDeps,
  identity: Identity,
  stagedId: string,
  reason: string,
): Promise<StagedActionRecord> {
  const staged = await deps.repos.staged.get(identity, stagedId);
  deps.authorizer.assertTransition(identity, staged.module, staged.transitionCode);
  await deps.repos.bills.get(identity, staged.module, staged.billId);
  return await deps.repos.staged.decide(identity, stagedId, "rejected", reason);
}
