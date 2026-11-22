// ---------------------------------------------------------------------------
// Server realization of a module Planner: read-only plan, then interpret and execute after recomputing inside the transaction.
//
// A Planner never receives a repository write interface. It can only return the metamodel's closed ExecutionPlan. This file
// does not write module tables directly. It reuses createBill / executeTransitionWithinPlan / references, one command at a time.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import {
  EXECUTION_PLAN_VERSION,
  isGeneratedHeaderField,
  isNumericFieldType,
  normalizeAggregates,
  normalizeExecutionPlan,
  normalizeQuery,
  normalizeTransitionParams,
  SchemaError,
  SUMMARY_FNS,
  schemaFail,
  transitionAction,
  transitionAt,
  transitionEdges,
  type CreatedIdValue,
  type CreatedFieldValue,
  type ExecutionPlan,
  type ModulePlanner,
  type PlanLines,
  type PlanRecord,
  type PlannerLedgerReadCoordinate,
  type PlanValue,
  type PlannerConsistency,
  type PlannerBillSnapshot,
  type PlannerReadContext,
  type Query,
  type TransitionDecision,
  unacceptableWriteKeys,
} from "@open-erp/metamodel";
import { requireRuntimeModule, type RuntimeCatalog } from "../contracts/catalog.js";
import { StagedActionError } from "../contracts/errors.js";
import type { Identity } from "../contracts/identity.js";
import type { RuntimeAuthorizer } from "../contracts/authorization.js";
import type { BillRecord, BillWriteLockRequest, Repos, StagedActionRecord } from "../contracts/repositories.js";
import {
  assertExecutable,
  assertProposable,
  assertStagedConfirmable,
  confirmStaged,
  createPlannedBill,
  evaluate,
  executeTransitionAsPlanEffect,
  executeTransitionWithinPlan,
  proposerOf,
  type ConfirmArgs,
  type ExecuteResult,
  type ExecutionRepos,
  type PlannedCreatedBill,
  type ProposeArgs,
  type RuntimeDeps,
} from "../execute/execute.js";

export interface PlannedTransitionArgs {
  readonly identity: Identity;
  readonly module: string;
  readonly billId: string;
  /** Business action code. The edge is resolved from the source bill's current status */
  readonly transition: string;
  readonly params: Readonly<Record<string, unknown>>;
  /**
   * Source-bill revision the caller has seen. Same meaning as `EvaluateArgs.expectedRevision`: both dry-run and execute compare it
   * at the moment the source bill is read, before status, edge, gates, and the Planner. `null` is only for the agent and internal paths.
   */
  readonly expectedRevision: number | null;
}

/**
 * Dry-run result. **No revision**: a revision comes only from a read (detail / list / workbench prepare).
 * The dry-run only checks the one the caller brought. Taking a revision from the dry-run cannot guard the stretch from "saw it" to "pressed confirm".
 */
export interface PlannedTransitionPreview {
  readonly decision: TransitionDecision;
  readonly executionPlan: ExecutionPlan;
  /** Explicit Planner execution semantics. Routes and the web must not guess from whether fingerprint is present. */
  readonly consistency: PlannerConsistency;
  /**
   * `null` = **this dry-run has no plan** (blocked).
   *
   * 🔴 Not an empty string. An empty string is judged "the protocol is broken" by the adapter on the wire and thrown
   * (`fingerprint is not a non-empty string`). Measured: when append-release is blocked by a gate, the text beside the grey button
   * is not the business reason. It is "cannot tell whether this action is available: ...fingerprint is not a non-empty string (empty)",
   * a system-voiced sentence covering the gate that would otherwise have been clear.
   * `null` is the existing legal value when an ordinary edge has no plan. The two mean the same thing and take the same existing path.
   */
  readonly fingerprint: string | null;
}

/** Source bill and decision the propose caller already computed with its own evaluation seam. */
export interface PlannedTransitionEvaluation {
  readonly record: PlannerBillSnapshot;
  readonly decision: TransitionDecision;
}

export interface ExecutePlannedTransitionArgs extends PlannedTransitionArgs {
  readonly confirmedWarning: string | null;
  /**
   * A Planner edge is a programmatic batch execution and must have an idempotency key. There is no degraded form where a person clicking twice counts as twice.
   *
   * 🔴 `null` = **this request did not carry one**, not "it may be omitted". After the gate passes it is still always required
   * (`requireIdempotencyKey`). Nullability only means "it is not time to judge it yet".
   * Why the moment is pushed later: see the "envelope is judged after the gate" section in `executePlannedTransition`.
   */
  readonly idempotencyKey: string | null;
  /**
   * Comes from preview. exact compares it character for character after the in-transaction recompute. latest may still be sent for old clients,
   * but it is not a content rejection condition. Both levels write the fingerprint of the final post-lock plan into the audit.
   *
   * 🔴 `null` means **the same thing, word for word**, as the field above: not carried is not the same as optional.
   */
  readonly expectedFingerprint: string | null;
}

/**
 * One planned new bill in an execution result: the persisted row (`PlannedCreatedBill`) plus the revision after this transaction's write.
 * The revision is not stored. The first execution tracks it command by command. An idempotent replay reads the current revision back inside the transaction.
 */
export interface ExecutedCreatedBill extends PlannedCreatedBill {
  readonly revision: number;
}

export interface ExecutePlannedTransitionResult {
  readonly outcome: "executed" | "replayed";
  readonly consistency: PlannerConsistency;
  readonly transition: ExecuteResult;
  /** Append-only result facts. The first execution and an idempotent replay return the same commandId -> billId set. */
  readonly createdBills: readonly ExecutedCreatedBill[];
  /**
   * Count of new bills removed by the outbound permission projection. The runtime's raw result is always 0. The human and agent projections increment it by module read.
   * Callers use it to tell "there really is only one new bill" from "only one is visible". The latter must never auto-navigate and imply
   * this action had only one product. Only the count is given. The trimmed module name and bill id are not exposed.
   */
  readonly hiddenCreatedBillCount: number;
  /** On replay, the original plan from the audit. On the first execution, the plan recomputed inside the transaction. */
  readonly executionPlan: ExecutionPlan;
  readonly fingerprint: string;
}

/**
 * The plan changed between preview and execute. The caller must show it again, not accept the new plan on the user's behalf.
 *
 * 🔴 **This error describes one thing: the two plans are not the same plan.** The response is "preview again and retry",
 * so it may be thrown only when **retrying can actually produce a different result**.
 * "This edge is blocked by a precondition right now" is not that class. Retrying gives the exact same result. That is a dead end.
 * That level uses `TransitionRefusedError` (400 + that gate + the full checks), the same shape as an ordinary edge.
 */
export class ExecutionPlanStaleError extends Error {
  override readonly name = "ExecutionPlanStaleError";

  constructor(
    /** The copy the caller holds. **It came from the client and can be anything.** Not matching is exactly what this error is here to say */
    readonly expectedFingerprint: string,
    /** The copy the server computed now. 🔴 Always SHA-256 hex. See the assertion in the constructor */
    readonly currentFingerprint: string,
    readonly currentPlan: ExecutionPlan,
  ) {
    super("The execution plan changed before confirmation, so the system did not execute. Reopen the action, check the latest people, quantities, and source data, then confirm again.");
    // 🔴 `currentFingerprint` is a **server product**. Whatever the field name promises, the value must be that.
    //
    // This used to be stuffed with a sentence of prose ("(this edge is blocked by a precondition and has no executable plan)"):
    // the field name says it is a fingerprint, but the value was a sentence. A consumer comparing it gets a "fingerprint" that never matches,
    // and a business conclusion that was clear (it cannot pass the gate) is disguised as a concurrency conflict (409 + preview again).
    // "Preview again" then returns the same gate. The user walks into a dead end and never sees that gate.
    //
    // Assert, rather than widening the type to `string | null`. Widening only keeps the lie in the contract in a different shape.
    // The assertion makes any change that tries to put a non-fingerprint back **explode on the constructor line**, instead of shipping to the client.
    if (!/^[0-9a-f]{64}$/.test(currentFingerprint)) {
      throw new Error(
        `ExecutionPlanStaleError currentFingerprint must be SHA-256 hex, received "${currentFingerprint}" —` +
          `this field carries only a fingerprint. "Why there is no plan" is a different conclusion and must not leave through this field's shell`,
      );
    }
  }
}

function canonicalJson(value: unknown, label: string): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number and cannot produce a stable fingerprint`);
    return JSON.stringify(value);
  }
  // `normalizeTransitionParams` normalizes datetime parameters to Date. Planner dry-run and execute
  // both need that same normalized parameter set inside the fingerprint. Date is a standard JSON-serializable value (toJSON = ISO string).
  // A legal batch release must not be misreported as 500 just because the prototype is not Object.
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) throw new Error(`${label} contains an invalid date and cannot produce a stable fingerprint`);
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, `${label}[${index}]`)).join(",")}]`;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} contains a non-JSON value and cannot produce a stable fingerprint`);
  }
  const object = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key], `${label}.${key}`)}`)
    .join(",")}}`;
}

/** What the user confirms is the combination of the source transition's full evaluation and the batch commands, not commands alone. */
export function plannedTransitionFingerprint(decision: TransitionDecision, plan: ExecutionPlan): string {
  const canonical = canonicalJson(
    { decision, executionPlan: normalizeExecutionPlan(plan) },
    "PlannedTransition",
  );
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function plannerOf(catalog: RuntimeCatalog, module: string, transition: string): ModulePlanner | null {
  const planner = requireRuntimeModule(catalog, module).planners.get(transition);
  return planner === undefined ? null : planner;
}

/** Absent tightens to exact: an old fixture or old catalog must not be silently loosened by an upgrade. */
export function plannerConsistency(
  catalog: RuntimeCatalog,
  module: string,
  transition: string,
): PlannerConsistency {
  return requireRuntimeModule(catalog, module).plannerConsistency?.get(transition) ?? "exact";
}

/**
 * "This edge is blocked by a gate right now" means no plan and no fingerprint.
 *
 * 🔴 There is only this one test, shared by preview's two seams: HTTP goes through `previewWithRepos`,
 * the agent goes through `billPreview` in `agent/execute.ts` (it has its own evaluation seam and does not go through the former).
 * Separate copies were measured: the same blocked bill, the UI says "no plan", and the agent side still runs the Planner
 * and throws a sentence that is the opposite of what happened ("the gate passed, and the write bypass corrupted the data").
 */
export function plannerBlocked(decision: TransitionDecision): boolean {
  return !decision.verdict.pass && decision.verdict.level === "block";
}

/**
 * The envelope (idempotency key + fingerprint) says "which plan, and how many times to execute".
 *
 * 🔴 **It is meaningful only after this edge can actually run right now**, so these two checks come after the gate, not on the first line of the entry.
 * The reverse order was measured (`productionOrder.release` blocked by a precondition):
 * a bare run returns "idempotencyKey must be a non-empty string", adding one then returns "fingerprint must be a non-empty string",
 * and adding a fake fingerprint returns "the execution plan changed, preview again". **The gate that actually blocked it is never shown to the user**,
 * and "preview again" returns the same gate. The user did nothing wrong. The bill's status does not allow it.
 *
 * ⚠️ The other half is equally true and must stay: after the gate passes, the envelope **may not omit a single piece**.
 * It is the two defenses of idempotency and "what executes is the plan the user saw", not decoration on an error message.
 */
function requireIdempotencyKey(value: string | null): string {
  if (value === null || !value.trim()) {
    schemaFail(
      "A Planner edge must carry an idempotency key (HTTP `idempotencyKey` / agent `idempotency_key`) —" +
        "it creates N downstream bills at once, and a programmatic retry must collapse into the same real business action",
    );
  }
  return value.trim();
}

function requireExpectedFingerprint(value: string | null): string {
  if (value === null || !value.trim()) {
    schemaFail(
      "An exact Planner edge must carry the fingerprint preview returned (HTTP `fingerprint` / agent `expected_fingerprint`) —" +
        "what executes must be the plan the user saw",
    );
  }
  return value.trim();
}

interface PlannerRuntimeDeps {
  readonly catalog: RuntimeCatalog;
  readonly repos: Pick<ExecutionRepos, "bills" | "ledger" | "moduleSettings" | "references">;
  readonly authorizer: RuntimeAuthorizer;
}

interface PlanningReadDeps {
  readonly catalog: RuntimeCatalog;
  readonly repos: Pick<ExecutionRepos, "bills" | "ledger" | "moduleSettings" | "references">;
  readonly authorizer: RuntimeAuthorizer;
  readonly recordLedgerBalanceRead?: (coordinate: PlannerLedgerReadCoordinate) => void;
}

/** Stop a Planner from building an unbounded SQL query or fingerprint out of a huge reference graph. Truncation is explicit in the return value. */
export const PLANNER_REFERENCED_BILLS_MAX_LIMIT = 100;

function normalizeReferencedBillLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > PLANNER_REFERENCED_BILLS_MAX_LIMIT) {
    schemaFail(`Planner reference walk limit must be an integer from 1 to ${PLANNER_REFERENCED_BILLS_MAX_LIMIT}`);
  }
  return value;
}

/** Scoped read-only capability shared by Planner and the action preparer. Query normalization and the authorization test exist in only one copy. */
export function planningReadContext(
  deps: PlanningReadDeps,
  args: Pick<PlannedTransitionArgs, "identity" | "module" | "transition">,
): PlannerReadContext {
  return {
    async getBill(module, id): Promise<PlannerBillSnapshot> {
      requireRuntimeModule(deps.catalog, module);
      deps.authorizer.assertModule(args.identity, module, "read");
      return await deps.repos.bills.get(args.identity, module, id);
    },
    async listBills(module, query: Query) {
      const target = requireRuntimeModule(deps.catalog, module).schema;
      deps.authorizer.assertModule(args.identity, module, "read");
      const normalized = normalizeQuery(target, query, `${args.module}.${args.transition} query ${module}`);
      deps.authorizer.assertQuery(args.identity, target, normalized);
      const page = await deps.repos.bills.list(args.identity, module, normalized);
      return { rows: page.rows, total: page.total };
    },
    async moduleSetting(code) {
      const setting = await deps.repos.moduleSettings.get(args.identity, code);
      return setting.value;
    },
    async ledgerBalance(target, subjectId, scopeId) {
      // This is read-only. The execute side recomputes with the same Planner after `lockPlan`. Bills the plan creates
      // already write subject/scope as refs, so they belong to the pre-locked write set. Do not take the ledger write lock
      // during a pure preview, or a read that opens a confirm dialog would wait on a real posting, and the posting would wait on it.
      deps.recordLedgerBalanceRead?.({ target, subjectId, scopeId });
      return await deps.repos.ledger.balance(args.identity, target, subjectId, scopeId, false);
    },
    async listReferencedBills(sourceModule, sourceId, targetModule, limit) {
      requireRuntimeModule(deps.catalog, sourceModule);
      requireRuntimeModule(deps.catalog, targetModule);
      deps.authorizer.assertModule(args.identity, sourceModule, "read");
      deps.authorizer.assertModule(args.identity, targetModule, "read");
      const normalizedLimit = normalizeReferencedBillLimit(limit);
      if (!sourceId.trim()) schemaFail("Planner reference walk sourceId must be a non-empty string");

      // First use an ordinary bill read to enforce the source module's tenant and data scope. Querying only the reference table would let any id
      // become a probe: the caller could tell from the returned count whether a source bill they cannot see exists.
      await deps.repos.bills.get(args.identity, sourceModule, sourceId);
      const page = await deps.repos.references.listTargets(
        args.identity,
        sourceModule,
        sourceId,
        targetModule,
        normalizedLimit,
      );
      // The PG repository already guarantees a total order. Normalize once more here so tests and other adapters cannot carry an unstable order into the fingerprint.
      if (page.rows.length > normalizedLimit) {
        schemaFail(`Planner reference walk repository returned ${String(page.rows.length)} rows, over limit ${String(normalizedLimit)}`);
      }
      const seen = new Set<string>();
      const rows = page.rows.map((row, index) => {
        if (typeof row.id !== "string" || !row.id.trim() || typeof row.status !== "string" || !row.status.trim()) {
          schemaFail(`Planner reference walk row ${String(index + 1)} is missing a valid id/status`);
        }
        if (seen.has(row.id)) schemaFail(`Planner reference walk returned duplicate target bill "${row.id}"`);
        seen.add(row.id);
        return { id: row.id, status: row.status };
      }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
      return { rows, truncated: page.truncated };
    },
    async invariantBillSummary(module, query, summary) {
      const target = requireRuntimeModule(deps.catalog, module).schema;
      deps.authorizer.assertModule(args.identity, module, "read");
      const normalizedQuery = normalizeQuery(target, query, `${args.module}.${args.transition} invariant aggregate ${module}`);
      const normalizedSummary = normalizeAggregates(
        target,
        [summary],
        `${args.module}.${args.transition} invariant aggregate ${module}.summary`,
      )[0];
      if (!normalizedSummary) schemaFail(`Invariant aggregate ${module} is missing summary`);
      return await deps.repos.bills.invariantBillSummary(
        args.identity,
        module,
        normalizedQuery,
        normalizedSummary,
      );
    },
    async invariantLineSummary(module, through, filters, summary) {
      const target = requireRuntimeModule(deps.catalog, module).schema;
      deps.authorizer.assertModule(args.identity, module, "read");
      const table = target.fields.find((field) => field.key === through && field.type === "subtable");
      if (!table?.fields) schemaFail(`Invariant aggregate: module "${module}" has no detail table "${through}"`);
      const measure = table.fields.find((field) => field.key === summary.field);
      if (!measure || !isNumericFieldType(measure.type)) {
        schemaFail(`Invariant aggregate: field "${module}.${through}.${summary.field}" does not exist or is not numeric`);
      }
      if (!(SUMMARY_FNS as readonly string[]).includes(summary.fn)) {
        schemaFail(`Invariant aggregate: aggregate "${String(summary.fn)}" is unknown. Only ${SUMMARY_FNS.join(" / ")} is allowed`);
      }
      return await deps.repos.bills.invariantLineSummary(args.identity, module, through, filters, summary);
    },
  };
}

interface PlannerProposalDeps {
  readonly catalog: RuntimeCatalog;
  readonly repos: Pick<ExecutionRepos, "bills" | "ledger" | "staged" | "moduleSettings" | "references">;
  readonly authorizer: RuntimeAuthorizer;
}

/**
 * Run a Planner. Exported for agent preview to reuse. This only needs read repositories, not execution repositories.
 *
 * Query already has a metamodel type, but it is normalized again against the target module at the IO boundary. A domain can be
 * JavaScript, and it can bypass the type with `as`. A type is not a permission credential.
 */
export async function computeExecutionPlan(
  deps: PlannerRuntimeDeps,
  args: PlannedTransitionArgs,
  bill: PlannerBillSnapshot,
  planner: ModulePlanner,
): Promise<ExecutionPlan> {
  const source = requireRuntimeModule(deps.catalog, args.module).schema;
  // The parameter value gate knows the edge on this source bill right now: resolve it from the current status in the snapshot
  const edge = transitionAt(source, bill.header["status"], args.transition);
  const normalized = normalizeTransitionParams(edge, args.params);
  if (normalized.issues.length > 0) {
    schemaFail(
      `Planner ${args.module}.${args.transition} received data that failed the action-parameter value gate: ` +
        normalized.issues.map((issue) => issue.message).join("; "),
    );
  }
  const ledgerReads = new Map<string, PlannerLedgerReadCoordinate>();
  const read = planningReadContext({
    ...deps,
    recordLedgerBalanceRead(coordinate) {
      ledgerReads.set(
        JSON.stringify([coordinate.target, coordinate.subjectId, coordinate.scopeId]),
        coordinate,
      );
    },
  }, args);

  const raw = await planner({
    module: args.module,
    transition: args.transition,
    bill,
    params: normalized.params,
    read,
  });
  if (raw && typeof raw === "object" && Object.hasOwn(raw, "readSet")) {
    schemaFail(`Planner ${args.module}.${args.transition} must not fill readSet by hand — runtime generates it from the balance reads that actually happened`);
  }
  // The loader-wrapped planner already passed the same gate. Running it again here is defense in depth at the runtime boundary,
  // and the test is still the single `normalizeExecutionPlan`.
  const logical = normalizeExecutionPlan(raw, `Planner ${args.module}.${args.transition} ExecutionPlan`);
  const plan = ledgerReads.size === 0
    ? logical
    : normalizeExecutionPlan({
        ...logical,
        readSet: { ledgerBalances: [...ledgerReads.values()] },
      }, `Planner ${args.module}.${args.transition} system read set`);
  assertPlanTargets(deps.catalog, plan, `Planner ${args.module}.${args.transition}`, args.module);
  assertPlanWritePermissions(deps.authorizer, args.identity, args.module, plan);
  await assertExistingAppendTargets(deps.repos, args.identity, plan);
  return plan;
}

/**
 * Appending in a plan uses the current operator's permission on the **module actually being written**, not a bypass through the source transition.
 * `appendSourceLines` keeps the existing contract. `appendTargetLines` also requires target read, so the plan cannot treat
 * a bill the current identity cannot see as a write probe.
 */
function assertPlanWritePermissions(
  authorizer: RuntimeAuthorizer,
  identity: Identity,
  sourceModule: string,
  plan: ExecutionPlan,
): void {
  const createdModules = new Map<string, string>();
  for (const command of plan.commands) {
    if (command.type === "createBill") {
      createdModules.set(command.commandId, command.module);
      continue;
    }
    if (command.type === "appendSourceLines") {
      authorizer.assertModule(identity, sourceModule, "update");
      authorizer.assertWritePayload(identity, sourceModule, {}, { [command.table]: command.rows });
      continue;
    }
    if (command.type === "setGeneratedHeader") {
      const module = command.target.kind === "existing" ? command.target.module : createdModules.get(command.target.commandId);
      if (module === undefined) schemaFail(`setGeneratedHeader "${command.commandId}" points at an unknown target`);
      authorizer.assertModule(identity, module, "read");
      authorizer.assertModule(identity, module, "update");
      authorizer.assertWritePayload(identity, module, command.patch, null);
      continue;
    }
    if (command.type !== "appendTargetLines") continue;
    const module = command.target.kind === "existing"
      ? command.target.module
      : createdModules.get(command.target.commandId);
    if (module === undefined) {
      schemaFail(
        `appendTargetLines "${command.commandId}" points at an unknown or not-yet-executed createBill "${
          command.target.kind === "createdId" ? command.target.commandId : command.target.module
        }"`,
      );
    }
    authorizer.assertModule(identity, module, "read");
    authorizer.assertModule(identity, module, "update");
    authorizer.assertWritePayload(identity, module, {}, { [command.table]: command.rows });
  }
}

/** Existing targets are read through the scoped repository at preview time, and the status the plan claims is pinned on that same snapshot. */
async function assertExistingAppendTargets(
  repos: Pick<Repos, "bills">,
  identity: Identity,
  plan: ExecutionPlan,
): Promise<void> {
  for (const command of plan.commands) {
    if (command.type !== "appendTargetLines" || command.target.kind !== "existing") continue;
    const bill = await repos.bills.get(identity, command.target.module, command.target.id);
    const actual = bill.header["status"];
    if (actual !== command.expectedStatus) {
      throw new Error(
        `The execution plan wants to append facts to "${command.target.module}" #${bill.id} in status "${command.expectedStatus}"` +
          `but it is currently "${String(actual)}" — preview again`,
      );
    }
  }
}

/**
 * Whether the keys `createBill` writes actually exist in the target module's **declaration**.
 *
 * 🔴 The test is the kernel's `unacceptableWriteKeys` — the **same function** `headerWrite` / `lineWrite` use at persist time,
 * not a handwritten second copy. That is the entire reason this function exists:
 * the key gate used to be judged only at persist time, and a Planner's persist happens **after the user has pressed confirm**.
 *
 * Measured (old production-release Planner, 2026-08-05): the Planner stuffed a field the target detail did not declare into
 * `materialRequirement.lines`.
 * Preview was green all the way: `verdict.pass = true`, all 9 gates passed, the fingerprint came back normally.
 * The user pressed confirm, and **33 seconds later** the whole group rolled back, leaving one sentence: "detail does not accept field ...".
 * During those 33 seconds the browser XHR had already timed out at 30 seconds, so what they saw was a **button that spun forever**.
 * Server stdout had not one word (400 is a client error and does not enter the error log),
 * and `oe_production_task` still had the same rows. All three directions pointed at "the transaction is stuck",
 * and the truth was a field name the modeler wrote wrong.
 *
 * 🔴 Judged here rather than on the execute side, for the **same reason** as the setStatus checks below (see that comment):
 * this whole class is the modeler writing something wrong, and retrying gives the exact same result. Once the plan passes preview and has a fingerprint,
 * the user has already pressed confirm. Refusing then makes them think it is concurrency or a data problem.
 *
 * ⚠️ **Judge keys only, not values.** The value gate (missing required / type / enum out of range / dangling reference) reads the database,
 * and this is a pure function with zero IO. Values stay judged at persist time. The two judge different classes of thing.
 * Merging them would mix "the user did not fill it" and "the modeler wrote it wrong" into one sentence.
 */
function assertCreateKeys(
  catalog: RuntimeCatalog,
  module: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, unknown>>,
  at: string,
): void {
  const schema = requireRuntimeModule(catalog, module).schema;
  const headerKeys = unacceptableWriteKeys(schema.fields, header, "header", "planner");
  if (headerKeys.length) {
    schemaFail(
      `${at} wrote fields "${module}" header does not accept "${headerKeys.join(", ")}" —` +
        `undeclared, a detail table, or computed by the system. This plan would roll the whole group back halfway through, refusing to issue a fingerprint`,
    );
  }
  for (const [key, rows] of Object.entries(lines)) {
    const field = schema.fields.find((candidate) => candidate.key === key && candidate.type === "subtable");
    if (field === undefined) {
      schemaFail(`${at} wrote detail table "${key}" which does not exist on "${module}"`);
    }
    if (!Array.isArray(rows)) continue;
    for (const [index, row] of (rows as readonly unknown[]).entries()) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
      const bad = unacceptableWriteKeys(field.fields ?? [], row as Readonly<Record<string, unknown>>, "line", "planner");
      if (bad.length) {
        schemaFail(
          `${at} wrote fields detail "${key}" of "${module}" does not accept on row ${String(index + 1)}` +
            `"${bad.join(", ")}" — undeclared or computed by the system. This plan would roll the whole group back halfway through, refusing to issue a fingerprint`,
        );
      }
    }
  }
}

/**
 * Whether a `setStatus` command matches the target module's **declaration**.
 *
 * 🔴 Judged inside `computeExecutionPlan` rather than on the execute side so it goes red at **preview**:
 * this whole class is the modeler writing something wrong (a mistyped edge name, `expectedStatus` not equal to that edge's `from`),
 * and once the plan passes preview and has a fingerprint the user has already pressed confirm. Refusing then rolls the whole group back,
 * and they think it is concurrency or a data problem. `normalizeExecutionPlan` cannot judge these. It has zero catalog
 * and can see only the plan's own shape.
 *
 * 🔴 `expectedStatus` **must equal the target edge's declared `from`, character for character**. It is not "writing it twice":
 * at persist time `setStatus`'s `WHERE status = from` uses exactly this value. If the two do not match,
 * "drive it away from A" in the plan and the start status actually pinned are two different things, and the fingerprint protects the former.
 * Refusing on mismatch happens earlier than runtime and says it more clearly than runtime (runtime only says
 * "edge x starts at A, and the bill is currently at B", without saying which bill, and without saying where the plan is wrong).
 */
export function assertPlanTargets(
  catalog: RuntimeCatalog,
  plan: ExecutionPlan,
  what: string,
  sourceModule?: string,
): void {
  const createdModules = new Map<string, string>();
  for (const command of plan.commands) {
    if (command.type === "createBill") {
      createdModules.set(command.commandId, command.module);
      assertCreateKeys(catalog, command.module, command.header, command.lines, `${what} createBill "${command.commandId}"`);
      continue;
    }
    if (command.type === "appendSourceLines") {
      if (sourceModule === undefined) {
        schemaFail(`${what} contains appendSourceLines, but the caller did not provide a Planner source module`);
      }
      assertCreateKeys(
        catalog,
        sourceModule,
        {},
        { [command.table]: command.rows },
        `${what} appendSourceLines "${command.commandId}"`,
      );
      continue;
    }
    if (command.type === "appendTargetLines") {
      const at = `${what} appendTargetLines "${command.commandId}"`;
      const module = command.target.kind === "existing"
        ? command.target.module
        : createdModules.get(command.target.commandId);
      if (module === undefined) {
        schemaFail(
          `${at} points at an unknown or not-yet-executed createBill "${
            command.target.kind === "createdId" ? command.target.commandId : command.target.module
          }"`,
        );
      }
      assertCreateKeys(catalog, module, {}, { [command.table]: command.rows }, at);
      const target = requireRuntimeModule(catalog, module);
      if (!target.schema.lifecycle.statuses.some((status) => status.key === command.expectedStatus)) {
        schemaFail(
          `${at} declares expectedStatus = "${command.expectedStatus}", but module "${module}" has no such status`,
        );
      }
      continue;
    }
    if (command.type === "setGeneratedHeader") {
      const at = `${what} setGeneratedHeader "${command.commandId}"`;
      const module = command.target.kind === "existing" ? command.target.module : createdModules.get(command.target.commandId);
      if (module === undefined) schemaFail(`${at} points at an unknown target`);
      const target = requireRuntimeModule(catalog, module).schema;
      if (!target.lifecycle.statuses.some((status) => status.key === command.expectedStatus)) schemaFail(`${at} status does not exist`);
      // Same test as the repository `setGeneratedHeader`: `isGeneratedHeaderField`.
      // Do not go through `unacceptableWriteKeys(..., "planner")`. That channel recognizes plannerSupplied,
      // which is mutually exclusive with systemGenerated, and would misjudge a legal start or finish stamp as a "field that is not allowed".
      const bad = Object.keys(command.patch).filter((key) => {
        const field = target.fields.find((candidate) => candidate.key === key);
        return field === undefined || !isGeneratedHeaderField(field);
      });
      if (bad.length) schemaFail(`${at} wrote fields that are not allowed "${bad.join(", ")}"`);
      continue;
    }
    if (command.type !== "setStatus") continue;
    const at = `${what} setStatus "${command.commandId}"`;
    const module = command.target.kind === "existing"
      ? command.target.module
      : createdModules.get(command.target.commandId);
    if (module === undefined) {
      // An `existing` target's module is written on the command and is always available, so reaching here must be the `created` case.
      // The discriminant still has to be **asked again inside the expression**, or `PlanTarget` is not narrowed here,
      // and `.commandId` is not on `ExistingBillPointer` (the type gate goes red)
      schemaFail(
        `${at} points at an unknown or not-yet-executed createBill "${
          command.target.kind === "existing" ? command.target.module : command.target.commandId
        }"`,
      );
    }
    const target = requireRuntimeModule(catalog, module);
    if (transitionAction(target.schema.lifecycle, command.transition) === null) {
      schemaFail(`${at} points at edge "${command.transition}" which does not exist on module "${module}"`);
    }
    // `setStatus` names the edge for (action, start status). `expectedStatus` is its from, and it is resolved by that
    try {
      transitionAt(target.schema, command.expectedStatus, command.transition);
    } catch (error: unknown) {
      if (!(error instanceof SchemaError)) throw error;
      const froms = transitionEdges(target.schema, command.transition).map((edge) => `"${edge.from}"`).join(", ");
      schemaFail(
        `${at} declares expectedStatus = "${command.expectedStatus}", while edge "${command.transition}" starts at` +
          `${froms} — this command can never run. expectedStatus is this edge's from, not another value that can be filled in`,
      );
    }
    // 🔴 The target edge must not itself be bound to a Planner (the test is written on `executeTransitionAsPlanEffect`).
    // That spot is the function's own precondition. This spot makes it red at **preview**. A nested plan is the modeler writing something wrong,
    // not something that becomes true only at execute time. Rolling the whole group back after the user has confirmed makes them think it is a data problem
    if (target.planners.has(command.transition)) {
      schemaFail(
        `${at} wants to drive ${module}.${command.transition}, but that edge is itself bound to a Planner — ` +
          `a nested plan has no fingerprint, so the plan the outer user confirmed cannot see it. Flatten both levels of commands into the same plan`,
      );
    }
  }
}

async function previewWithRepos(
  deps: RuntimeDeps,
  args: PlannedTransitionArgs,
  repos: ExecutionRepos,
  forUpdate = false,
): Promise<PlannedTransitionPreview> {
  const planner = plannerOf(deps.catalog, args.module, args.transition);
  if (planner === null) {
    throw new Error(`Edge ${args.transition} on module ${args.module} has no Planner and cannot use the plan execute entry`);
  }
  const consistency = plannerConsistency(deps.catalog, args.module, args.transition);

  // evaluate compares the source-bill revision first (when one was sent), then sends transition parameters through the closed gate,
  // and uses the same scope-protected snapshot as the plan input.
  const evaluated = await evaluate({ ...deps, repos }, { ...args, forUpdate }, repos);

  // 🔴 **block means do not run the Planner.**
  //
  // Every `throw` inside a Planner is written on the premise "the gate has passed" (that file header says so:
  // the throws that remain are shapes that "cannot hold once the gate has passed"). This used to run **unconditionally**,
  // so that premise never held for **preview**. The gate had not passed, and the Planner still read data the gate was supposed to block.
  //
  // Measured (production chain, twice in a row): preview `release` on a production order whose detail was deleted empty.
  // `release_lines_required` judged block, and the Planner still ran and threw
  // "the production order has no item lines and cannot be released (the gate passed, and the write bypass corrupted the data)".
  // That sentence is the **opposite** of what happened, and anyone investigating would go look at the database because of it.
  //
  // Corollary (this matters more than that 500): every assert in `productionOrder/index.ts` judged "unreachable"
  // holds only on the **execute** path. `release_bom_active` can block execution of an order whose BOM is already disabled,
  // but it cannot stop someone from **previewing** that edge. The Planner still reads the empty detail and throws.
  // Fixing this spot makes that contract true again, so those asserts are reachable only on a framework bug.
  //
  // 🔴 **Not try/catch.** Turning a Planner exception into a check would silently turn a real framework bug
  // (a missing platform column, a generator that built the wrong column) into a business sentence. Same shape as "treat a database rejection as a user input error",
  // which `AGENTS.md` explicitly refuses.
  //
  // ⚠️ This does **not** conflict with `AGENTS.md` "a missing required parameter is block, but the plan is still computed". The two plans are not the same thing:
  //   · `decision.plan` (EffectPlan, how much this bill posts) is a kernel pure function, zero IO, no assert.
  //     `evaluate` still computes it. **Nothing here changed that.** The confirm dialog needs it.
  //   · `executionPlan` (which downstream bills the Planner will create) reads the database and carries the preconditional asserts above.
  // The former is always computed. The latter is computed only after the gate passes.
  //
  // ⚠️ Only `block` short-circuits. `warn` / `hint` / `route` are still computed. The first two will execute after confirmation,
  // and although `route` means the main edge will not execute, the UI must show "which edge to take instead". Behavior across the four levels stays
  // the same as an ordinary transition (that side also computes the plan for all four levels).
  if (plannerBlocked(evaluated.decision)) {
    return {
      decision: evaluated.decision,
      executionPlan: { version: EXECUTION_PLAN_VERSION, commands: [] },
      consistency,
      // 🔴 Fingerprint is null: a blocked plan **must not have a fingerprint that can be taken and executed**.
      // The first line of `executePlannedTransition` requires `expectedFingerprint` to be non-empty
      // (`Planner execution must carry the fingerprint preview returned`), so a blocked preview
      // is **structurally unsubmittable**. It uses the gate that already exists. No new check is added.
      // The path that executes with an old fingerprint is still safe: the execute side previews again,
      // what it computes now is null, which is not equal to the old fingerprint, so `ExecutionPlanStaleError` (the plan expired).
      // That is exactly what it should say.
      //
      // ⚠️ **Not an empty string.** An empty string is judged a protocol error by the adapter on the wire, so an edge that was blocked normally
      // becomes a system-failure sentence on screen (see the `fingerprint` note on this interface).
      fingerprint: null,
    };
  }

  const executionPlan = await computeExecutionPlan(
    { catalog: deps.catalog, repos, authorizer: deps.authorizer },
    { ...args, params: evaluated.decision.params },
    evaluated.record,
    planner,
  );
  return {
    decision: evaluated.decision,
    executionPlan,
    consistency,
    fingerprint: plannedTransitionFingerprint(evaluated.decision, executionPlan),
  };
}

export async function previewPlannedTransition(
  deps: RuntimeDeps,
  args: PlannedTransitionArgs,
): Promise<PlannedTransitionPreview> {
  return await previewWithRepos(deps, args, deps.repos);
}

/**
 * Write the Planner's decision plus ExecutionPlan into the staged action as one whole.
 *
 * HTTP and the agent each have their own evaluation seam, but from "check that it can be proposed, run the Planner, compute the fingerprint, write staged"
 * onward there is only this one path. The agent can no longer degrade into a half-plan that only stages the source transition.
 */
export async function proposePlannedTransition(
  deps: PlannerProposalDeps,
  args: ProposeArgs,
  evaluated: PlannedTransitionEvaluation,
): Promise<StagedActionRecord> {
  if (evaluated.record.id !== args.billId) {
    throw new Error(
      `Planner propose evaluation got bill ${evaluated.record.id}, but the request is ${args.billId} — ` +
        `refusing to write another bill's plan into this staged action`,
    );
  }
  if (evaluated.decision.transition.code !== args.transition) {
    throw new Error(
      `Planner propose evaluation got edge ${evaluated.decision.transition.code}, but the request is ${args.transition} — ` +
        `refusing to write another edge's judgment into this staged action`,
    );
  }
  assertProposable(args.module, evaluated.decision);

  const planner = plannerOf(deps.catalog, args.module, args.transition);
  if (planner === null) {
    throw new Error(`Edge ${args.transition} on module ${args.module} has no Planner and cannot write a plan staged action`);
  }
  const executionPlan = await computeExecutionPlan(
    deps,
    { ...args, params: evaluated.decision.params },
    evaluated.record,
    planner,
  );
  const planFingerprint = plannedTransitionFingerprint(evaluated.decision, executionPlan);
  const staged = await deps.repos.staged.propose(args.identity, {
    module: args.module,
    billId: args.billId,
    transitionCode: args.transition,
    params: evaluated.decision.params,
    decision: evaluated.decision,
    executionPlan,
    planFingerprint,
    proposedRevision: evaluated.record.revision,
    proposedBy: proposerOf(args.identity),
    reason: args.reason,
    idempotencyKey: args.idempotencyKey,
  });
  if (staged.executionPlan === null || staged.planFingerprint === null) {
    throw new Error(
      `Planner propose idempotency coordinate hit staged action ${staged.id}, which has no ExecutionPlan — ` +
        `the staged-action type does not match the current edge`,
    );
  }
  return staged;
}

function isCreatedId(value: PlanValue): value is CreatedIdValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Readonly<Record<string, PlanValue>>)["kind"] === "createdId";
}

function isCreatedField(value: PlanValue): value is CreatedFieldValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Readonly<Record<string, PlanValue>>)["kind"] === "createdField";
}

function isExecutionTime(value: PlanValue): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (value as Readonly<Record<string, PlanValue>>)["kind"] === "executionTime";
}

function createdBill(
  created: ReadonlyMap<string, { readonly module: string; readonly bill: BillRecord }>,
  commandId: string,
  what: string,
): { readonly module: string; readonly bill: BillRecord } {
  const hit = created.get(commandId);
  // normalizeExecutionPlan already guarantees it can point only at a preceding createBill. Fail fast here anyway: if the runtime map
  // is missing an entry, the interpreter's execution order was broken, and undefined must not be written into a business reference.
  if (!hit) throw new Error(`${what} points at preceding createBill "${commandId}", but the execution result does not contain it`);
  return hit;
}

function resolveValue(
  value: PlanValue,
  created: ReadonlyMap<string, { readonly module: string; readonly bill: BillRecord }>,
  executionTime: string,
  what: string,
): unknown {
  if (isCreatedId(value)) return createdBill(created, value.commandId, what).bill.id;
  if (isCreatedField(value)) {
    const bill = createdBill(created, value.commandId, what).bill;
    const fieldValue = bill.header[value.field];
    if (fieldValue === undefined || fieldValue === null) {
      throw new Error(`${what} references created-bill field "${value.field}", which is empty`);
    }
    return fieldValue;
  }
  if (isExecutionTime(value)) return executionTime;
  if (Array.isArray(value)) {
    return value.map((item, index) => resolveValue(item, created, executionTime, `${what}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveValue(item, created, executionTime, `${what}.${key}`)]),
    );
  }
  return value;
}

function resolveRecord(
  record: PlanRecord,
  created: ReadonlyMap<string, { readonly module: string; readonly bill: BillRecord }>,
  executionTime: string,
  what: string,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, resolveValue(value, created, executionTime, `${what}.${key}`)]),
  );
}

function resolveLines(
  lines: PlanLines,
  created: ReadonlyMap<string, { readonly module: string; readonly bill: BillRecord }>,
  executionTime: string,
  what: string,
): Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> {
  return Object.fromEntries(
    Object.entries(lines).map(([key, rows]) => [
      key,
      rows.map((row, index) => resolveRecord(row, created, executionTime, `${what}.${key}[${index}]`)),
    ]),
  );
}

async function executeCommands(
  deps: RuntimeDeps,
  repos: ExecutionRepos,
  identity: Identity,
  plan: ExecutionPlan,
  sourceBill: {
    readonly module: string;
    readonly id: string;
    readonly expectedStatus: string;
    readonly expectedRevision: number;
  },
  executionTime: string,
): Promise<readonly ExecutedCreatedBill[]> {
  const created = new Map<string, { readonly module: string; readonly bill: BillRecord }>();
  const results: PlannedCreatedBill[] = [];
  /** commandId to the new bill's revision now. Later commands that change it follow along, and it is handed out with the result (no extra read just for a version) */
  const revisions = new Map<string, number>();
  let sourceRevision = sourceBill.expectedRevision;

  for (const [ordinal, command] of plan.commands.entries()) {
    if (command.type === "createBill") {
      const bill = await createPlannedBill(
        { ...deps, repos },
        identity,
        command.module,
        resolveRecord(command.header, created, executionTime, `${command.commandId}.header`),
        resolveLines(command.lines, created, executionTime, `${command.commandId}.lines`),
      );
      created.set(command.commandId, { module: command.module, bill });
      revisions.set(command.commandId, bill.revision);
      results.push({ commandId: command.commandId, module: command.module, billId: bill.id, ordinal });
      continue;
    }

    if (command.type === "appendSourceLines") {
      const appended = await repos.bills.appendLines(
        identity,
        sourceBill.module,
        sourceBill.id,
        command.table,
        command.rows,
        sourceBill.expectedStatus,
        sourceRevision,
      );
      sourceRevision = appended.revision;
      continue;
    }

    if (command.type === "appendTargetLines") {
      const target = command.target.kind === "createdId"
        ? (() => {
            const pointer = createdBill(created, command.target.commandId, `${command.commandId}.target`);
            return { module: pointer.module, bill: pointer.bill };
          })()
        : {
            module: command.target.module,
            // Same scoped repository as preview. Module read permission does not replace this record's data scope.
            bill: await repos.bills.get(identity, command.target.module, command.target.id),
          };
      const current = command.target.kind === "createdId"
        ? await repos.bills.get(identity, target.module, target.bill.id)
        : target.bill;
      const actual = current.header["status"];
      if (actual !== command.expectedStatus) {
        throw new Error(
          `The execution plan wants to append facts to "${target.module}" #${current.id} in status "${command.expectedStatus}"` +
            `but it is currently "${String(actual)}" — refusing the whole group, preview again`,
        );
      }
      const rows = command.rows.map((row, index) =>
        resolveRecord(row, created, executionTime, `${command.commandId}.rows[${index}]`));
      const appended = await repos.bills.appendLines(
        identity,
        target.module,
        current.id,
        command.table,
        rows,
        command.expectedStatus,
        current.revision,
      );
      if (command.target.kind === "createdId") {
        created.set(command.target.commandId, { module: target.module, bill: appended });
        revisions.set(command.target.commandId, appended.revision);
      }
      continue;
    }

    if (command.type === "setGeneratedHeader") {
      const target = command.target.kind === "createdId"
        ? (() => { const pointer = createdBill(created, command.target.commandId, `${command.commandId}.target`); return { module: pointer.module, bill: pointer.bill }; })()
        : { module: command.target.module, bill: await repos.bills.get(identity, command.target.module, command.target.id) };
      const current = command.target.kind === "createdId" ? await repos.bills.get(identity, target.module, target.bill.id) : target.bill;
      if (current.header["status"] !== command.expectedStatus) {
        throw new Error(`The execution plan's write of system fields on "${target.module}" #${current.id} found the revision or status already changed. Preview again`);
      }
      // The source transition already walked status using the revision the plan read (a self-loop also adds 1). The command's
      // expectedRevision is that version, not the version after status was stored. When stamping the source bill, write the
      // sourceRevision the executor tracked, and require the declared revision to be exactly the one before the status write.
      const targetsSource = target.module === sourceBill.module && current.id === sourceBill.id;
      const revision = targetsSource ? sourceRevision : current.revision;
      if (targetsSource) {
        if (current.revision !== sourceRevision || command.expectedRevision !== sourceRevision - 1) {
          throw new Error(`The execution plan's write of system fields on "${target.module}" #${current.id} found the revision or status already changed. Preview again`);
        }
      } else if (current.revision !== command.expectedRevision) {
        throw new Error(`The execution plan's write of system fields on "${target.module}" #${current.id} found the revision or status already changed. Preview again`);
      }
      const written = await repos.bills.setGeneratedHeader(identity, target.module, current.id, resolveRecord(command.patch, created, executionTime, `${command.commandId}.patch`), revision);
      if (targetsSource) sourceRevision = written.revision;
      if (command.target.kind === "createdId") revisions.set(command.target.commandId, written.revision);
      continue;
    }

    if (command.type === "setStatus") {
      // 🔴 **Read the target bill through scope first** (`moduleScopedWhere`: tenant times data scope).
      // Two things are enforced together. Missing either one has no symptom:
      //   1. If it cannot be read, it cannot be read. A plan cannot move a bill the current identity cannot see, even if the Planner
      //      somehow obtained its id (`bills.get` throws when it is missing, the same sentence as a person opening the detail page).
      //   2. Whether `expectedStatus` matches has to be said clearly **here**.
      //
      // 🔴 Do not drop this sentence and rely on `evaluateTransition` to refuse on its own. When it refuses it can only say
      // "edge approve starts at pendingReview, and the bill is currently at awaitingShipment". A plan may move N bills,
      // that sentence has no bill number, and after reading it the user still does not know which one, or whether to preview again or edit the bill.
      //
      // ⚠️ This read is **so the sentence can be clear**, not a concurrency defense. What actually pins the start status is the later
      // `setStatus` `WHERE status = from` (`assertPlanTargets` already guarantees
      // `from === expectedStatus`). It is in the same transaction and under the same coordinate lock as this read.
      const target = command.target.kind === "createdId"
        ? (() => {
            const pointer = createdBill(created, command.target.commandId, `${command.commandId}.target`);
            return { module: pointer.module, bill: pointer.bill };
          })()
        : {
            module: command.target.module,
            bill: await repos.bills.get(identity, command.target.module, command.target.id),
          };
      // The same new bill can walk submit then audit. Each edge must read the status the previous edge just wrote,
      // and must not reuse the initial-status snapshot createBill returned at the time.
      const current = command.target.kind === "createdId"
        ? await repos.bills.get(identity, target.module, target.bill.id)
        : target.bill;
      const actual = current.header["status"];
      if (actual !== command.expectedStatus) {
        throw new Error(
          `The execution plan wants to drive "${target.module}" #${current.id} from "${command.expectedStatus}"` +
            `through "${command.transition}", but it is currently "${String(actual)}" —` +
            `refusing the whole group, preview again`,
        );
      }
      const transition = await executeTransitionAsPlanEffect(
        { ...deps, repos },
        {
          identity,
          module: target.module,
          billId: current.id,
          transition: command.transition,
        },
      );
      if (command.target.kind === "createdId") {
        created.set(command.target.commandId, { module: target.module, bill: transition.bill });
        revisions.set(command.target.commandId, transition.bill.revision);
      }
      continue;
    }
    const target = createdBill(created, command.target.commandId, `${command.commandId}.target`);
    const source =
      command.source.kind === "createdId"
        ? createdBill(created, command.source.commandId, `${command.commandId}.source`)
        : {
            module: command.source.module,
            // get enforces existence, tenant, and dataScope together. oe_reference itself has no cross-module foreign key.
            bill: await repos.bills.get(identity, command.source.module, command.source.id),
          };
    await repos.references.append(identity, [
      {
        srcModule: source.module,
        srcId: source.bill.id,
        srcLineId: null,
        tgtModule: target.module,
        tgtId: target.bill.id,
        tgtLineId: null,
      },
    ]);
  }

  return results.map((row) => {
    const revision = revisions.get(row.commandId);
    if (revision === undefined) throw new Error(`Planned new bill "${row.commandId}" has no tracked revision — the command interpreter skipped a step`);
    return { ...row, revision };
  });
}

/**
 * Revision of a new bill handed back on idempotent replay. The persisted result is only commandId to billId. The revision is read back inside the transaction.
 * Same shape as the first execution. The caller uses it for the next write.
 */
async function withCurrentRevisions(
  repos: Pick<ExecutionRepos, "bills">,
  identity: Identity,
  rows: readonly PlannedCreatedBill[],
): Promise<readonly ExecutedCreatedBill[]> {
  const out: ExecutedCreatedBill[] = [];
  for (const row of rows) {
    const bill = await repos.bills.get(identity, row.module, row.billId);
    out.push({ ...row, revision: bill.revision });
  }
  return out;
}

/**
 * Hand every write coordinate of a plan to the repository at once.
 *
 * A create target has no database id yet, so an append lock must not be forged. Merge the rows that will be appended later into the same
 * create lock request. Existing business coordinates those rows reference are still pre-locked before any write, and a createdId
 * placeholder is not mistaken for an existing id. The real persist still appends in the original command order and does not change audit or line-order semantics.
 */
function planWriteLockRequests(
  plan: ExecutionPlan,
  source: { readonly module: string; readonly id: string },
): readonly BillWriteLockRequest[] {
  const appendedToCreated = new Map<string, Record<string, PlanRecord[]>>();
  for (const command of plan.commands) {
    if (command.type !== "appendTargetLines" || command.target.kind !== "createdId") continue;
    let lines = appendedToCreated.get(command.target.commandId);
    if (lines === undefined) {
      lines = {};
      appendedToCreated.set(command.target.commandId, lines);
    }
    lines[command.table] = [...(lines[command.table] ?? []), ...command.rows];
  }

  return plan.commands.flatMap((command): readonly BillWriteLockRequest[] => {
    if (command.type === "createBill") {
      const additions = appendedToCreated.get(command.commandId) ?? {};
      const lines = Object.fromEntries(
        [...new Set([...Object.keys(command.lines), ...Object.keys(additions)])].map((table) => [
          table,
          [...(command.lines[table] ?? []), ...(additions[table] ?? [])],
        ]),
      );
      return [{ kind: "create", module: command.module, header: command.header, lines }];
    }
    if (command.type === "setStatus") {
      return command.target.kind === "existing"
        ? [{ kind: "action", module: command.target.module, id: command.target.id }]
        : [];
    }
    if (command.type === "setGeneratedHeader") {
      return command.target.kind === "existing"
        ? [{ kind: "action", module: command.target.module, id: command.target.id }]
        : [];
    }
    if (command.type === "appendSourceLines") {
      return [{
        kind: "append",
        module: source.module,
        id: source.id,
        table: command.table,
        rows: command.rows,
      }];
    }
    if (command.type === "appendTargetLines") {
      return command.target.kind === "existing"
        ? [{
            kind: "append",
            module: command.target.module,
            id: command.target.id,
            table: command.table,
            rows: command.rows,
          }]
        : [];
    }
    return [];
  });
}

/**
 * The source transition and every command are **the same outer transaction**.
 *
 * Fixed order: idempotency audit, gate, envelope, pre-state recompute and hash, source transition, commands.
 * A hit on the audit replays directly. That audit commits in the same transaction as the commands, so its existence proves the whole group finished.
 *
 * 🔴 **Putting the gate before the envelope is the critical order for this edge.** See the note on `requireIdempotencyKey`:
 * being blocked by a gate is a **business conclusion**. It must not be hidden from the user behind two missing protocol fields.
 * After the gate passes, the envelope may not omit a single piece. Each thing stays in its place. One is not traded for the other.
 */
export async function executePlannedTransition(
  deps: RuntimeDeps,
  args: ExecutePlannedTransitionArgs,
): Promise<ExecutePlannedTransitionResult> {
  // 🔴 The envelope is **not judged here**. It is judged below, at the single "after the gate passes" spot. That is the only spot in the file.
  // Same discipline as an ordinary transition: replay is idempotency semantics, not a permission cache.
  deps.authorizer.assertModule(args.identity, args.module, "read");
  deps.authorizer.assertTransition(args.identity, args.module, args.transition);
  const consistency = plannerConsistency(deps.catalog, args.module, args.transition);

  return await deps.repos.transaction(async (repos) => {
    // 0. Idempotent replay. 🔴 With no key there is no "last time", so go straight to evaluation. Do not invent a default key.
    //    This section must stay before the gate. After a successful release the source edge usually can no longer run (`awaitingRelease` to `releasing`).
    //    Evaluating first would judge a **legal replay** as "this edge cannot pass the gate now" and dismantle the idempotency defense.
    const replay =
      args.idempotencyKey === null
        ? null
        : await repos.audit.find(
            args.identity,
            args.module,
            args.billId,
            args.transition,
            args.idempotencyKey,
          );
    if (replay) {
      if (replay.executionPlan === null || replay.planFingerprint === null) {
        throw new Error(
          `Idempotency key ${args.idempotencyKey} hit an ordinary transition audit but was treated as a Planner execution replay — audit type mismatch`,
        );
      }
      // The replay-hit path has no "gate" question to discuss. That thing already happened.
      // exact still confirms the replay is the original plan. latest confirms the action itself.
      // An old client may still send a fingerprint, but it cannot turn a completed idempotent replay into a content rejection.
      if (consistency === "exact") {
        const expectedFingerprint = requireExpectedFingerprint(args.expectedFingerprint);
        if (expectedFingerprint !== replay.planFingerprint) {
          throw new ExecutionPlanStaleError(
            expectedFingerprint,
            replay.planFingerprint,
            replay.executionPlan,
          );
        }
      }
      // Replay does not write a second time, and it is not a field-authorization cache either. After permission is revoked, an old idempotency key
      // must not read back a source-bill append plan the current identity is no longer allowed to execute.
      assertPlanWritePermissions(deps.authorizer, args.identity, args.module, replay.executionPlan);
      const transition = await executeTransitionWithinPlan(
        { ...deps, repos },
        args,
        replay.executionPlan,
        replay.planFingerprint,
        repos,
      );
      const createdBills = await repos.planResults.list(args.identity, replay.id);
      assertCreatedBillResults(replay.executionPlan, createdBills, replay.id);
      return {
        outcome: "replayed" as const,
        consistency,
        transition,
        createdBills: await withCurrentRevisions(repos, args.identity, createdBills),
        hiddenCreatedBillCount: 0,
        executionPlan: replay.executionPlan,
        fingerprint: replay.planFingerprint,
      };
    }

    // The execution transaction reads the system clock once. The source transition, new-bill platform fields, and
    // EXECUTION_TIME inside the plan all consume it. One command group does not split into two instants on a millisecond boundary.
    const executionInstant = deps.now();
    if (!Number.isFinite(executionInstant.valueOf())) throw new Error("Planner execution clock returned an invalid date");
    const executionTime = executionInstant.toISOString();
    const executionDeps: RuntimeDeps = { ...deps, repos, now: () => executionInstant };
    // The source-bill revision was compared at the moment evaluate read the source bill (before the gate and the Planner). Every post-lock recompute goes through the same compare
    const current = await previewWithRepos(executionDeps, args, repos);

    // 1. 🔴 **The gate.** `fingerprint === null` has only one source: this edge is blocked right now
    //    (that section in `previewWithRepos`; the test `plannerBlocked` is the shared one).
    //
    //    This goes through `assertExecutable` — the **same function** as an ordinary edge, not a planner edition of the four-level judgment.
    //    `AGENTS.md`: **a Planner is an extension of transition, not a second state machine.** Then "blocked by a gate"
    //    must not have two behaviors on the two paths. An ordinary edge returns 400 plus that gate's verbatim reason plus the full
    //    `checks` (`TransitionRefusedError` to `refusedResponse`). A Planner edge copies that.
    //
    //    🔴 **Not 409.** 409 (`ExecutionPlanStaleError`) means "what you are holding has expired,
    //    try again", and trying again here gives the exact same result: preview comes back with the same block and still no fingerprint.
    //    The measured shape is a dead end, and the user never sees the gate that actually blocked it.
    if (current.fingerprint === null) {
      assertExecutable(args.module, current.decision, args.confirmedWarning);
      // Reaching this line means the tests in `plannerBlocked` and `assertExecutable` drifted: one says blocked,
      // the other says it may execute. Fail fast. Do not let an execution with no explainable reason through.
      throw new Error(
        `Planner ${args.module}.${args.transition} has no executable plan, but the four-level verdict is allow —` +
          `preview's block test and assertExecutable disagree`,
      );
    }

    // 2. Envelope. Only after the gate passes does "which plan, and how many times to execute" mean anything. The reason for the order is on
    //    `requireIdempotencyKey`. Neither check may be omitted, regardless of how the error text looks.
    const idempotencyKey = requireIdempotencyKey(args.idempotencyKey);
    const expectedFingerprint = consistency === "exact"
      ? requireExpectedFingerprint(args.expectedFingerprint)
      : null;
    if (expectedFingerprint !== null && current.fingerprint !== expectedFingerprint) {
      throw new ExecutionPlanStaleError(expectedFingerprint, current.fingerprint, current.executionPlan);
    }

    // 🔴 **Lock the whole coordinate set at once, before any write.**
    //
    // This edge then, inside the **same outer transaction**, does one `lockForAction` for the source transition,
    // then N `createOne` calls (each with its own batch of `resolveRefs`). Each batch sorting only guarantees
    // order **inside the batch**. Nothing is responsible for order across batches, so this transaction can take a later key first
    // (for example `bill/warehouse/wh-sh`) and then go back for an earlier key (`bill/product/p-bolt-m8`),
    // while an ordinary single-batch writer on the other side (a stockIn: detail items plus header warehouse, which sorts to
    // product then warehouse) takes the opposite order. The two form AB-BA, and PG reports `40P01 deadlock detected`.
    // Measured: of two concurrent releases, one must fail. The log line `on pg_advisory_xact_lock ... blocked by`
    // is that failure, and the client only sees "internal server error".
    //
    // 🔴 **Not heavier retries.** Retry only makes the probability smaller, and it turns a race that can be eliminated
    // into a ghost of "occasionally a bit slow". What happens here is elimination: compute every coordinate this transaction will take, all at once,
    // take them once in the same global order, and afterwards every key a batch of `resolveRefs` wants is already held, so
    // no new acquisition happens, so a reverse order cannot be taken structurally.
    //
    // ⚠️ The position must be **before** `executeTransitionWithinPlan`. The first thing inside it is
    // `lockForAction`. One line later and this becomes "take one batch, then fill in the rest", which is the same shape as before.
    const lockPlan = async (plan: ExecutionPlan): Promise<void> => {
      await repos.bills.lockWriteSet(args.identity, [
        { kind: "action", module: args.module, id: args.billId },
        ...planWriteLockRequests(plan, { module: args.module, id: args.billId }),
      ]);
      const ledgerReads = plan.readSet?.ledgerBalances ?? [];
      if (ledgerReads.length > 0) await repos.ledger.lockBalances(args.identity, ledgerReads);
    };
    const requireRunnable = (preview: PlannedTransitionPreview): string => {
      // The source bill can also be modified by another transaction while waiting for the lock. latest only loosens derived consequences,
      // not the source bill the user confirmed the action against. Every post-lock recompute rechecks the revision through evaluate.
      if (preview.fingerprint !== null) return preview.fingerprint;
      assertExecutable(args.module, preview.decision, args.confirmedWarning);
      throw new Error(
        `Planner ${args.module}.${args.transition} recomputed after the lock with no executable plan, but the four-level verdict is allow`,
      );
    };

    let locked = current;
    if (consistency === "exact") {
      if (expectedFingerprint === null) {
        throw new Error("exact Planner passed the fingerprint envelope gate but has no expectedFingerprint");
      }
      await lockPlan(current.executionPlan);
      locked = await previewWithRepos(executionDeps, args, repos, true);
      const lockedFingerprint = requireRunnable(locked);
      if (lockedFingerprint !== expectedFingerprint) {
        throw new ExecutionPlanStaleError(expectedFingerprint, lockedFingerprint, locked.executionPlan);
      }
    } else {
      // latest confirms the action, not the derived plan from preview. "Use the latest facts" does not mean
      // "recompute without a lock and then write blindly". Each round locks the current write set first, then recomputes. If the plan changed, the new write set is pulled in.
      // Work starts only when two adjacent fingerprints are stable. Continuous change means the Planner's test is outside the write set it claims,
      // which is a platform or modeling bug and must not be chased forever inside one transaction.
      let stable = false;
      for (let pass = 0; pass < 4; pass += 1) {
        const beforeFingerprint = requireRunnable(locked);
        await lockPlan(locked.executionPlan);
        const next = await previewWithRepos(executionDeps, args, repos, true);
        const nextFingerprint = requireRunnable(next);
        locked = next;
        if (nextFingerprint === beforeFingerprint) {
          stable = true;
          break;
        }
      }
      if (!stable) {
        throw new Error(
          `Planner ${args.module}.${args.transition} was still unstable after expanding the write set and recomputing 4 times —` +
            `the plan depends on a mutable fact its write set does not lock, refusing to execute`,
        );
      }
    }
    const finalFingerprint = requireRunnable(locked);

    const transition = await executeTransitionWithinPlan(
      executionDeps,
      // 🔴 Pass the idempotency key that was **judged**, not the raw value in `args`. The key on the audit and the key
      // this layer judged and trimmed of whitespace must be the same string, or the next replay computed with the new key becomes a second execution.
      // The Planner's exact fingerprint already pins the post-lock decision and the plan the user confirmed, and the source-bill action lock
      // guarantees no posting that would change this bill's ledger candidates can slip in. Do not hand this decision to the inner general executor as a staged
      // `expectedDecision`. It would reconcile again inside the nested transaction. Ledger-row visibility
      // need not match the outer post-lock evaluation character for character, so a promise just released is misreported as drift and rolls back the whole Planner.
      { ...args, idempotencyKey, expectedDecision: null },
      locked.executionPlan,
      finalFingerprint,
      repos,
    );
    if (transition.outcome !== "executed") {
      // The outer layer already looked up the same idempotency coordinate. A hit inside the transaction means a concurrent request committed or became visible first.
      // Commands must not run again at that point. The audit's same-transaction nature proves the other side already finished the whole group.
      if (transition.audit.executionPlan === null || transition.audit.planFingerprint === null) {
        throw new Error("Planner transition replay hit an audit with no ExecutionPlan — audit type mismatch");
      }
      const createdBills = await repos.planResults.list(args.identity, transition.audit.id);
      assertCreatedBillResults(transition.audit.executionPlan, createdBills, transition.audit.id);
      return {
        outcome: "replayed" as const,
        consistency,
        transition,
        createdBills: await withCurrentRevisions(repos, args.identity, createdBills),
        hiddenCreatedBillCount: 0,
        executionPlan: transition.audit.executionPlan,
        fingerprint: transition.audit.planFingerprint,
      };
    }

    const createdBills = await executeCommands(
      executionDeps,
      repos,
      args.identity,
      locked.executionPlan,
      {
        module: args.module,
        id: args.billId,
        expectedStatus: transition.to,
        expectedRevision: transition.bill.revision,
      },
      executionTime,
    );
    // Persistence records only commandId to billId. The revision is handed out with this result and is not stored
    await repos.planResults.append(
      args.identity,
      transition.audit.id,
      createdBills.map(({ revision: _revision, ...row }) => row),
    );
    // executeTransitionWithinPlan returns a snapshot before commands. A source append, or explicitly appending the source bill as a target,
    // may keep changing it. The first execution and an idempotent replay must hand the caller the version after the commands finish.
    const finalTransition = {
      ...transition,
      bill: await repos.bills.get(args.identity, args.module, args.billId),
    };
    return {
      outcome: "executed" as const,
      consistency,
      transition: finalTransition,
      createdBills,
      hiddenCreatedBillCount: 0,
      executionPlan: locked.executionPlan,
      fingerprint: finalFingerprint,
    };
  // A post-lock recompute must see occupancy committed while it was waiting. Repeatable read would pin the pre-lock snapshot,
  // so a second concurrent release, even after it waited for the same source lock, would still read the old matched quantity. Locking the full write set keeps the post-lock plan stable.
  }, { isolationLevel: "read committed" });
}

export type ConfirmStagedTransitionResult = ExecuteResult | ExecutePlannedTransitionResult;

/**
 * Unified entry for staged confirm. An ordinary staged action uses the original executor. A Planner staged action recomputes inside the transaction against the stored fingerprint.
 * The agent tool surface does not have, and will not have, a matching entry. The caller must still verify a human identity at the HTTP boundary.
 */
export async function confirmStagedTransition(
  deps: RuntimeDeps,
  args: ConfirmArgs,
): Promise<ConfirmStagedTransitionResult> {
  const staged = await deps.repos.staged.get(args.identity, args.stagedId);
  deps.authorizer.assertTransition(args.identity, staged.module, staged.transitionCode);
  await deps.repos.bills.get(args.identity, staged.module, staged.billId);
  if (staged.executionPlan === null && staged.planFingerprint === null) {
    return await confirmStaged(deps, args);
  }
  if (staged.executionPlan === null || staged.planFingerprint === null) {
    throw new StagedActionError(
      `Staged action ${staged.id} has an ExecutionPlan and a fingerprint that did not appear as a pair — refusing to guess the staged-action type`,
      400,
    );
  }
  assertStagedConfirmable(staged);
  const replaying = staged.status === "confirmed";
  if (!replaying) {
    if (staged.proposedRevision === null) {
      throw new StagedActionError(
        `Staged action ${staged.id} did not save the source-bill revision from propose time —` +
          `this is an old staged action, and it cannot be proved that what is confirmed is still the same source bill. Propose again`,
        409,
      );
    }
    if (plannerOf(deps.catalog, staged.module, staged.transitionCode) === null) {
      throw new StagedActionError(
        `Staged action ${staged.id} saved an ExecutionPlan, but edge ` +
          `${staged.transitionCode} on the current module ${staged.module} no longer has a Planner — the deployed version and the staged action disagree, refusing to execute only the source transition`,
        409,
      );
    }
    const storedFingerprint = plannedTransitionFingerprint(staged.decision, staged.executionPlan);
    if (storedFingerprint !== staged.planFingerprint) {
      throw new StagedActionError(
        `Staged action ${staged.id} saved a decision plus ExecutionPlan whose fingerprint should be ${storedFingerprint},` +
          `but it is ${staged.planFingerprint} — the staged content in the database is not self-consistent, refusing to execute`,
        400,
      );
    }
  }

  let result: ExecutePlannedTransitionResult;
  try {
    result = await executePlannedTransition(deps, {
      identity: args.identity,
      module: staged.module,
      billId: staged.billId,
      transition: staged.transitionCode,
      params: staged.params,
      expectedRevision: replaying ? null : staged.proposedRevision,
      confirmedWarning: args.confirmedWarning,
      idempotencyKey: `staged:${staged.id}`,
      expectedFingerprint: staged.planFingerprint,
    });
  } catch (err: unknown) {
    if (!replaying && err instanceof ExecutionPlanStaleError) {
      await deps.repos.staged.decide(
        args.identity,
        staged.id,
        "rejected",
        `The execution plan changed after it was proposed: ${err.expectedFingerprint} → ${err.currentFingerprint}. Propose again`,
      );
    }
    throw err;
  }
  await deps.repos.staged.decide(args.identity, staged.id, "confirmed", null);
  return result;
}

function assertCreatedBillResults(
  plan: ExecutionPlan,
  results: readonly PlannedCreatedBill[],
  auditId: string,
): void {
  const expected = plan.commands.filter((command) => command.type === "createBill");
  if (results.length !== expected.length) {
    throw new Error(
      `Planner audit ${auditId} logical plan has ${expected.length} createBill commands,` +
        `but the append-only result has only ${results.length} — refusing to return an incomplete replay`,
    );
  }
  for (const command of expected) {
    const ordinal = plan.commands.indexOf(command);
    const hit = results.find((row) => row.commandId === command.commandId);
    if (
      !hit ||
      hit.module !== command.module ||
      hit.ordinal !== ordinal ||
      !hit.billId.trim()
    ) {
      throw new Error(
        `Planner audit ${auditId} createBill "${command.commandId}" has no complete matching actual bill result,` +
          `or module / ordinal does not match the logical plan`,
      );
    }
  }
}
