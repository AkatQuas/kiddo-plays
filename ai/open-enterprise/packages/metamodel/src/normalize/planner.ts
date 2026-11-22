// ---------------------------------------------------------------------------
// Module Planner -> ExecutionPlan
//
// A Planner is the read-only business function of a catalog-shaped module; an ExecutionPlan is the runtime value it computes.
// Neither is a seventh concept of a module declaration: ModuleSchema / MODULE_KEYS are unaware of them.
//
// This file is still zero IO. Read capability is injected by the server as PlannerReadContext, and persisting the plan
// is interpreted by the server inside the same transaction as the transition. The Planner itself cannot reach a write repository.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireObject,
  requireText,
  schemaFail,
} from "../schema/common.js";
import type { Query, SummarySpec } from "./query.js";
import { type EffectTarget } from "../schema/effects.js";
import { listLedgerCodes } from "./ledger.js";

/**
 * The Planner explicitly refuses this action from the current business facts.
 *
 * This is not a program error and not a retryable database exception; HTTP/Agent
 * should return the original text as an understandable business 400. Use it only
 * for an expected branch the operator can retry after changing business state.
 * Corrupt data and declaration invariants still throw a plain Error and stay 500.
 */
export class PlannerBusinessError extends Error {
  override readonly name = "PlannerBusinessError";
}

/** Database id of an earlier createBill command in this plan. */
export interface CreatedIdValue {
  readonly kind: "createdId";
  readonly commandId: string;
}

/** A header field of the bill created by an earlier createBill in this plan. */
export interface CreatedFieldValue {
  readonly kind: "createdField";
  readonly commandId: string;
  readonly field: string;
}

/**
 * The instant the runtime reads once, in the outer transaction, when the plan actually starts executing.
 *
 * During a Planner preview it is only a stable token, so it can enter the fingerprint; it becomes an ISO time only when commands are interpreted.
 * This is separate from a business time in an action param: business time is frozen by a person or a source bill, and executionTime is only for
 * audit facts such as "when this system execution happened".
 */
export interface ExecutionTimeValue {
  readonly kind: "executionTime";
}

export const EXECUTION_TIME: ExecutionTimeValue = Object.freeze({ kind: "executionTime" });

/** An ExecutionPlan must serialize stably so it can be previewed, audited, and judged stale before execution. */
export type PlanValue =
  | string
  | number
  | boolean
  | null
  | CreatedIdValue
  | CreatedFieldValue
  | ExecutionTimeValue
  | readonly PlanValue[]
  | { readonly [key: string]: PlanValue };

export type PlanRecord = Readonly<Record<string, PlanValue>>;
export type PlanLines = Readonly<Record<string, readonly PlanRecord[]>>;

/** A bill snapshot the Planner sees. Same shape as the server's BillRecord, without a reverse dependency on the server. */
export interface PlannerBillSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly header: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}

/** List reads do not offer aggregation; when the Planner really needs lines, it calls getBill by id. */
export interface PlannerBillPage {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly total: number;
}

/**
 * A system-invariant aggregate returns only a single value and the hit count. It never hands the Planner rows, ids, or field values from the tenant.
 * `value=null` means the same thing as a SQL aggregate: an empty row set / all-null values have no computable result; an empty sum stays null too.
 */
export interface PlannerInvariantSummary {
  readonly total: number;
  readonly value: number | null;
}

/**
 * A target bill reached from a source bill through `oe_reference`.
 *
 * The return surface is deliberately only the target id and status: when the Planner needs a target business field, it must call `getBill` again,
 * read through the same module read + data scope rule, and must not turn the reference table into a query API that bypasses field projection.
 */
export interface PlannerReferencedBill {
  readonly id: string;
  readonly status: string;
}

/** Reference traversal is cut by a hard limit; the caller must handle truncated explicitly and must not treat the first N rows as the full set. */
export interface PlannerReferencedBillPage {
  readonly rows: readonly PlannerReferencedBill[];
  readonly truncated: boolean;
}

/**
 * All of the Planner's IO. Identity is captured by the executor's closure; module reads still go through the scoped repository.
 *
 * A `Query` must pass the target module's normalizeQuery again once it reaches the server; the type is not a security credential.
 */
export interface PlannerReadContext {
  getBill(module: string, id: string): Promise<PlannerBillSnapshot>;
  listBills(module: string, query: Query): Promise<PlannerBillPage>;
  /** Read the effective option the current tenant set for a code-declared module setting; the Planner may freeze it into a new business fact. */
  moduleSetting?(code: string): Promise<string>;
  /**
   * Read the current balance of one ledger at one exact coordinate.
   *
   * This is a read-only input of a business Planner, not a public general ledger query: identity is captured by the runtime,
   * and a two-dimensional ledger missing scope still fail-fasts in LedgerRepo. If the Planner builds a write plan from it, the plan must
   * also cite this subject/scope, so the executor puts the mutable coordinate into the group pre-lock and recomputes after the lock.
   *
   * `?` exists only so old test fixtures can call a Planner directly; the real runtime always provides it. A business Planner
   * must not guess the balance as 0 when it is absent.
   */
  ledgerBalance?(target: EffectTarget, subjectId: string, scopeId: string | null): Promise<number>;
  /**
   * From a source bill the current identity can read, follow framework reference facts to the target bills of one kind that it generated.
   *
   * The runtime checks module:read on both the source and the target; the source goes through BillRepo, the target joins the module table,
   * and both ends honor tenant/data scope.
   * Results are ordered by target id ascending and carry an explicit truncation mark, so they can enter an ExecutionPlan fingerprint stably.
   *
   * `?` exists only so old test fixtures can call a Planner directly; the real runtime always injects it. A business Planner
   * must not degrade to "there are no references" when it is absent.
   */
  listReferencedBills?(
    sourceModule: string,
    sourceId: string,
    targetModule: string,
    limit: number,
  ): Promise<PlannerReferencedBillPage>;
  /**
   * A header aggregate over the tenant, only for programmatic invariants such as settlement and capacity. It still requires the target module:read,
   * but it is not cut down by the current operator's self/all row scope; the return surface deliberately has no rows.
   */
  invariantBillSummary(module: string, query: Query, summary: SummarySpec): Promise<PlannerInvariantSummary>;
  /** Same as above, aggregating one line table; filters may include line columns and header status together. */
  invariantLineSummary(
    module: string,
    through: string,
    filters: Readonly<Record<string, unknown>>,
    summary: SummarySpec,
  ): Promise<PlannerInvariantSummary>;
}

export interface PlannerContext {
  readonly module: string;
  readonly transition: string;
  readonly bill: PlannerBillSnapshot;
  /** Already checked by the transition's closed parameter gate; the Planner must still read the specific keys the business needs. */
  readonly params: Readonly<Record<string, unknown>>;
  readonly read: PlannerReadContext;
}

/** An existing bill; the executor must re-confirm, under the current identity, that it is visible and exists. */
export interface ExistingBillPointer {
  readonly kind: "existing";
  readonly module: string;
  readonly id: string;
}

/** A Planner command may point at an existing bill, or at a bill already created in this plan. */
export type PlanTarget = ExistingBillPointer | CreatedIdValue;

export interface CreateBillCommand {
  readonly type: "createBill";
  /** The unique stable name inside the plan; createReference cites the new bill through it and does not forge a database id in advance. */
  readonly commandId: string;
  readonly module: string;
  readonly header: PlanRecord;
  readonly lines: PlanLines;
}

export interface CreateReferenceCommand {
  readonly type: "createReference";
  readonly commandId: string;
  readonly source: PlanTarget;
  /** For now a reference may land only on a bill this plan creates; an existing bill must not be given a forged source. */
  readonly target: CreatedIdValue;
}

/**
 * Append fact rows to one line table of the Planner's current source bill.
 *
 * The source bill is implicit: there is no module / id / target. The Planner is already bound to one authorized source edge,
 * and opening an arbitrary existing-bill pointer would collapse this narrow capability into `patchBill`, bypassing the target bill's own state machine.
 *
 * Append only: no update, delete, or whole-table replace. An assignment line is later pointed at by a report `refLine`; replacing it rebuilds row ids
 * and turns an already-formed settlement lineage into a dangling reference. One command touches one line table, and command order is append order.
 */
export interface AppendSourceLinesCommand {
  readonly type: "appendSourceLines";
  readonly commandId: string;
  readonly table: string;
  readonly rows: readonly PlanRecord[];
}

/**
 * Append immutable fact rows to a named line table of a plan target bill.
 *
 * This is a narrow extension of `appendSourceLines`, not a general patch: it can only append non-empty rows. It cannot change the header,
 * update old rows, or delete or replace the whole table. The target may be an existing bill or an earlier `createBill` in this plan;
 * the executor must re-judge read / update / field write against the target module and put `expectedStatus` into
 * the append repository's optimistic-lock WHERE. A row may use a createdId placeholder from an earlier `createBill`.
 */
export interface AppendTargetLinesCommand {
  readonly type: "appendTargetLines";
  readonly commandId: string;
  readonly target: PlanTarget;
  readonly table: string;
  readonly rows: readonly PlanRecord[];
  readonly expectedStatus: string;
}

/**
 * Advance the state of an **existing bill**.
 *
 * **It names which edge of the target module to take, not which status to write.** Writing status directly would also
 * bypass that edge's preconditions, handoff, and effects — a second write path, while
 * `AGENTS.md` admits only `evaluate → execute`. The key is therefore called `transition`:
 * "which status to become" has nothing in the declaration to look up, and an edge does.
 *
 * **`target` may only be an existing bill (`ExistingBillPointer`), not a `CreatedIdValue`.**
 * To land a newly created bill in another status, set the right initial status **inside `createBill`**;
 * creating it and then pushing it once invents an audit row, a handoff instantiation, and a possible ledger entry,
 * and those events never happened in the business. `normalizeExecutionPlan` rejects that.
 *
 * `expectedStatus` is the **optimistic-lock from**: the server requires it to equal the target edge's declared `from` character for character.
 * It is written into the plan instead of read at execution time so it **enters the fingerprint** — the plan says "push this bill off A",
 * and if it is no longer on A at execution time the whole group must stop and preview again,
 * rather than finding another edge from the new status and continuing.
 *
 * **No `params`.** Edge parameters reach only rules and audit, and they are a closed set declared per edge;
 * letting the Planner fill another edge's parameters for the user turns words a person writes on the spot, such as a rejection reason,
 * into something the program composed. An edge that needs parameters must not be pushed by a plan.
 */
export interface SetStatusCommand {
  readonly type: "setStatus";
  readonly commandId: string;
  readonly target: PlanTarget;
  readonly transition: string;
  readonly expectedStatus: string;
}

/** Header facts the Planner writes, declared systemGenerated, without changing status. */
export interface SetGeneratedHeaderCommand {
  readonly type: "setGeneratedHeader";
  readonly commandId: string;
  readonly target: PlanTarget;
  readonly patch: Readonly<Record<string, PlanValue>>;
  readonly expectedStatus: string;
  readonly expectedRevision: number;
}

/**
 * The command set is closed, and **none of them can write status, write a ledger, or send SQL directly**.
 *
 * `setStatus` looks like an exception and is not: it says "take that edge of the target module", and the server hands it back to
 * `evaluate → execute` — the target edge's preconditions, handoff, and effects are all still there.
 * A Planner therefore still expresses only **business intent**, not the write itself.
 */
export type ExecutionCommand =
  | CreateBillCommand
  | CreateReferenceCommand
  | SetStatusCommand
  | SetGeneratedHeaderCommand
  | AppendSourceLinesCommand
  | AppendTargetLinesCommand;

/**
 * **Adding a command does not bump the version, because of the compatibility direction.**
 *
 * The version pins "can this JSON still be read", and the places that read it are
 * **old plans already stored** in `oe_audit_log.execution_plan` and `oe_staged_action.execution_plan`:
 * idempotent replay of a Planner edge and staged confirm both run them through
 * `normalizeExecutionPlan` again. Adding a command type is a pure addition for old plans (none of them become invalid),
 * while a bump would make every historical Planner audit throw "version must be 2" on replay —
 * an append-only fact table would suddenly be unreadable, with no migration path.
 * The day to bump is the day an existing command shape is **narrowed or rewritten**; then an old plan really no longer holds.
 */
export const EXECUTION_PLAN_VERSION = 1 as const;

/** One ledger balance read while the Planner computed; captured by the runtime, not filled in by the business Planner. */
export interface PlannerLedgerReadCoordinate {
  readonly target: EffectTarget;
  readonly subjectId: string;
  readonly scopeId: string | null;
}

export interface ExecutionPlanReadSet {
  readonly ledgerBalances: readonly PlannerLedgerReadCoordinate[];
}

export interface ExecutionPlan {
  readonly version: typeof EXECUTION_PLAN_VERSION;
  readonly commands: readonly ExecutionCommand[];
  /**
   * Mutable coordinates the plan computation actually read. The runtime locks them before execution and recomputes after the lock; they join the fingerprint and the audit,
   * but the permission projection does not send them out (the user confirms the business consequence, not the internal lock coordinates).
   */
  readonly readSet?: ExecutionPlanReadSet;
  /** Only for the external DTO after permission projection; the internal plan and the fingerprint never set it. */
  readonly hiddenCommandCount?: number;
}

/** How many bills a target module creates in the plan, and how many rows each line table has. No field values. */
export interface ExecutionPlanCreateSummary {
  readonly module: string;
  /** The module's display label. The model restates this plan to a person; giving the code would make it throw the code at the user. */
  readonly label: string;
  readonly bills: number;
  /** Line-table name → how many rows these bills add up to. An empty object means these bills have no lines. */
  readonly lines: Readonly<Record<string, number>>;
}

/**
 * The **outbound summary** of an `ExecutionPlan`: what will be created, how many bills, how many rows. No per-field values.
 *
 * Same precedent as `hiddenCommandCount`: the type lives in the kernel (next to the thing it summarizes),
 * and the only construction site is after the server's permission projection (`summarizeExecutionPlan`) — it needs the catalog to produce a label.
 *
 * **It is for a caller whose context has a budget, not for the human confirmation dialog.** The two surfaces were observed to want different things:
 *   · a person clicks "release production" on the detail page, and the dialog needs per-field values (how much this bill records, and on whose head) — a browser does not spend a return budget;
 *   · the model takes the plan only to answer "what will be generated after release", then executes with the fingerprint.
 *     `bill_execute` **does not read a single byte of commands** (the rule is `billExecute` in `agent/execute.ts`:
 *     the Planner branch consumes only `expected_fingerprint`).
 *
 * The full payload **grows linearly with line count**, so this is not an optimization that "saves a little context"; it is a correctness boundary:
 * `productionOrder.release` is already 4445 characters on 2 line rows and fills the whole 6000 return budget, so that edge is
 * **structurally unavailable** on the agent surface. The observed production consequence was not a clean error — after hitting it the model **invented a reason**
 * (it told the user "my authorization has expired", while that user's permissions were fine and `bill_execute` was never called).
 *
 * The summary **does not join the fingerprint**: the fingerprint is always computed from the full plan (`plannedTransitionFingerprint`).
 * One missing byte makes the in-transaction recompute on the execution side judge the plan stale. The summary is only the last step of the outbound projection.
 */
export interface ExecutionPlanSummary {
  readonly version: typeof EXECUTION_PLAN_VERSION;
  readonly creates: readonly ExecutionPlanCreateSummary[];
  /**
   * How many commands permission removed. The same meaning, character for character, as `ExecutionPlan.hiddenCommandCount` (including lineage commands).
   * Absent means 0 — it is not written as `0`, the same discipline as the projection side: do not mention hiding in the response when nothing is hidden.
   */
  readonly hiddenCommandCount?: number;
}

export type ModulePlanner = (context: PlannerContext) => ExecutionPlan | Promise<ExecutionPlan>;
export type ModulePlanners = Readonly<Record<string, ModulePlanner>>;

/**
 * exact: what executes must be the plan the user previewed and confirmed; any semantic change returns stale.
 * latest: the user confirmed the action itself, and the plan is only its system-derived consequence; after the lock, recompute from the latest facts and execute.
 */
export type PlannerConsistency = "exact" | "latest";

/** Non-enumerable credential of definePlanners. The loader does not guess from function shape whether a registry passed the entry. */
export const DEFINED_PLANNERS_BY_KERNEL = Symbol.for("open-erp.definedModulePlanners");
export const PLANNER_CREATE_TARGETS = Symbol.for("open-erp.plannerCreateTargets");
export const PLANNER_CONSISTENCY = Symbol.for("open-erp.plannerConsistency");

export function definePlanners<const T extends ModulePlanners>(
  planners: T,
  // The default lives in the function body rather than here: `T` is generic, and `keyof T & string` is not resolved yet,
  // so TS refuses to assign `{}` as a parameter default of a mapped type (TS2322). An optional parameter plus a body fallback
  // has the same meaning, and does not need an `as` assertion — an assertion would also swallow a real type error later.
  createTargets?: Readonly<Partial<Record<keyof T & string, readonly string[]>>>,
  consistency?: Readonly<Partial<Record<keyof T & string, PlannerConsistency>>>,
): T {
  const obj = requireObject(planners, "planners");
  const entries = Object.entries(obj);
  if (!entries.length) schemaFail("planners must not be empty — do not export this named value when there is no Planner");
  for (const [transition, planner] of entries) {
    requireText(transition, "planners transition code");
    if (typeof planner !== "function") {
      schemaFail(`planners.${transition} must be a function`);
    }
  }
  Object.defineProperty(planners, DEFINED_PLANNERS_BY_KERNEL, {
    value: true,
    enumerable: false,
    writable: false,
  });
  const normalizedTargets: Record<string, readonly string[]> = {};
  for (const [transition, targets] of Object.entries(createTargets ?? {})) {
    if (!(transition in planners)) schemaFail(`createTargets.${transition} points at an unregistered Planner`);
    normalizedTargets[transition] = requireArray(targets, `createTargets.${transition}`).map((target, index) =>
      requireText(target, `createTargets.${transition}[${index}]`));
  }
  Object.defineProperty(planners, PLANNER_CREATE_TARGETS, {
    value: Object.freeze(normalizedTargets),
    enumerable: false,
    writable: false,
  });
  const normalizedConsistency: Record<string, PlannerConsistency> = {};
  for (const [transition, mode] of Object.entries(consistency ?? {})) {
    if (!(transition in planners)) schemaFail(`consistency.${transition} points at an unregistered Planner`);
    if (mode !== "exact" && mode !== "latest") {
      schemaFail(`consistency.${transition} allows only exact / latest; received "${String(mode)}"`);
    }
    normalizedConsistency[transition] = mode;
  }
  Object.defineProperty(planners, PLANNER_CONSISTENCY, {
    value: Object.freeze(normalizedConsistency),
    enumerable: false,
    writable: false,
  });
  return planners;
}

export function plannerCreateTargetsOf(value: ModulePlanners): Readonly<Record<string, readonly string[]>> {
  return (value as unknown as Record<symbol, Readonly<Record<string, readonly string[]>>>)[PLANNER_CREATE_TARGETS] ?? {};
}

export function plannerConsistencyOf(value: ModulePlanners, transition: string): PlannerConsistency {
  const configured = (value as unknown as Record<symbol, Readonly<Record<string, PlannerConsistency>>>)[
    PLANNER_CONSISTENCY
  ];
  return configured?.[transition] ?? "exact";
}

export function isDefinedPlanners(value: unknown): value is ModulePlanners {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_PLANNERS_BY_KERNEL] === true
  );
}

function isPlanArray(value: PlanValue): value is readonly PlanValue[] {
  return Array.isArray(value);
}

function normalizePlanValue(value: unknown, label: string, created: ReadonlySet<string>): PlanValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) schemaFail(`${label} must be a finite number; received ${String(value)}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, i) => normalizePlanValue(item, `${label}[${i}]`, created));
  if (typeof value !== "object") {
    schemaFail(`${label} must be a JSON value; received ${typeof value}`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    schemaFail(`${label} must be a plain JSON object`);
  }
  const obj = value as Record<string, unknown>;
  if (obj["kind"] === "createdId") {
    assertClosedKeys(obj, ["kind", "commandId"], label);
    const commandId = requireText(obj["commandId"], `${label}.commandId`);
    if (!created.has(commandId)) {
      schemaFail(`${label}.commandId points at an unknown or not-yet-executed createBill "${commandId}"`);
    }
    return { kind: "createdId", commandId };
  }
  if (obj["kind"] === "createdField") {
    assertClosedKeys(obj, ["kind", "commandId", "field"], label);
    const commandId = requireText(obj["commandId"], `${label}.commandId`);
    if (!created.has(commandId)) {
      schemaFail(`${label}.commandId points at an unknown or not-yet-executed createBill "${commandId}"`);
    }
    return { kind: "createdField", commandId, field: requireText(obj["field"], `${label}.field`) };
  }
  if (obj["kind"] === "executionTime") {
    assertClosedKeys(obj, ["kind"], label);
    return EXECUTION_TIME;
  }
  const out: Record<string, PlanValue> = {};
  for (const [key, item] of Object.entries(obj)) {
    out[key] = normalizePlanValue(item, `${label}.${key}`, created);
  }
  return out;
}

function normalizePlanRecord(value: unknown, label: string, created: ReadonlySet<string>): PlanRecord {
  const obj = requireObject(value, label);
  if (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== null) {
    schemaFail(`${label} must be a plain JSON object`);
  }
  const out: Record<string, PlanValue> = {};
  for (const [key, item] of Object.entries(obj)) {
    out[key] = normalizePlanValue(item, `${label}.${key}`, created);
  }
  return out;
}

function normalizeLines(value: unknown, label: string, created: ReadonlySet<string>): PlanLines {
  const obj = requireObject(value, label);
  if (Object.getPrototypeOf(obj) !== Object.prototype && Object.getPrototypeOf(obj) !== null) {
    schemaFail(`${label} must be a plain JSON object`);
  }
  const out: Record<string, readonly PlanRecord[]> = {};
  for (const [key, rows] of Object.entries(obj)) {
    out[key] = requireArray(rows, `${label}.${key}`).map((row, i) =>
      normalizePlanRecord(row, `${label}.${key}[${i}]`, created),
    );
  }
  return out;
}

function normalizeCreatedPointer(
  value: unknown,
  label: string,
  created: ReadonlySet<string>,
): CreatedIdValue {
  const normalized = normalizePlanValue(value, label, created);
  const candidate = normalized as { readonly kind?: PlanValue };
  if (
    typeof normalized !== "object" ||
    normalized === null ||
    isPlanArray(normalized) ||
    candidate.kind !== "createdId"
  ) {
    schemaFail(`${label} must be { kind: "createdId", commandId }`);
  }
  return normalized as CreatedIdValue;
}

/**
 * Accept only an existing-bill pointer.
 *
 * `createdId` gets its own sentence and is not folded into "unknown kind": the next step is completely different —
 * the first asks the modeler to change the initial status of `createBill`, the second is a typo. One combined sentence
 * would make someone who wrote a new bill into `setStatus.target` think they mistyped `"existing"`.
 */
function normalizeExistingPointer(value: unknown, label: string): ExistingBillPointer {
  const obj = requireObject(value, label);
  if (obj["kind"] === "createdId") {
    schemaFail(
      `${label} accepts only an existing bill (kind: "existing") and cannot point at the bill this plan creates "${String(obj["commandId"])}" — ` +
        `which status a new bill lands in is decided by the initial status of createBill; creating one and then pushing it invents an audit row, ` +
        `a handoff instantiation, and a possible ledger entry, and those events never happened in the business`,
    );
  }
  if (obj["kind"] !== "existing") {
    schemaFail(`${label}.kind "${String(obj["kind"])}" is unknown; only existing is allowed`);
  }
  assertClosedKeys(obj, ["kind", "module", "id"], label);
  return {
    kind: "existing",
    module: requireText(obj["module"], `${label}.module`),
    id: requireText(obj["id"], `${label}.id`),
  };
}

function normalizeSourcePointer(
  value: unknown,
  label: string,
  created: ReadonlySet<string>,
): PlanTarget {
  const obj = requireObject(value, label);
  if (obj["kind"] === "createdId") return normalizeCreatedPointer(obj, label, created);
  if (obj["kind"] !== "existing") {
    schemaFail(`${label}.kind "${String(obj["kind"])}" is unknown; only existing / createdId are allowed`);
  }
  return normalizeExistingPointer(obj, label);
}

/**
 * The only runtime gate on a Planner return value. Every Planner evaluation must pass through it; TypeScript is not enough:
 * a domain is a runtime dynamic import, and JS / an as-cast can both bypass the compile-time type.
 */
export function normalizeExecutionPlan(raw: unknown, label = "ExecutionPlan"): ExecutionPlan {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, ["version", "commands", "readSet"], label);
  if (obj["version"] !== EXECUTION_PLAN_VERSION) {
    schemaFail(`${label}.version must be ${EXECUTION_PLAN_VERSION}; received ${String(obj["version"])}`);
  }

  const commandsRaw = requireArray(obj["commands"], `${label}.commands`);
  // A conditional Planner may have no downstream action: the source transition still executes as usual. A typical case is
  // confirming a completion receipt — it only rechecks the shortfall that can be received, and the plan itself is empty.

  const commandIds = new Set<string>();
  const created = new Set<string>();
  const commands: ExecutionCommand[] = [];

  commandsRaw.forEach((commandRaw, i) => {
    const at = `${label}.commands[${i}]`;
    const command = requireObject(commandRaw, at);
    const type = command["type"];
    const commandId = requireText(command["commandId"], `${at}.commandId`);
    if (commandIds.has(commandId)) schemaFail(`${label}.commands reuses commandId "${commandId}"`);
    commandIds.add(commandId);

    if (type === "createBill") {
      assertClosedKeys(command, ["type", "commandId", "module", "header", "lines"], at);
      const normalized: CreateBillCommand = {
        type,
        commandId,
        module: requireText(command["module"], `${at}.module`),
        header: normalizePlanRecord(command["header"], `${at}.header`, created),
        lines: normalizeLines(command["lines"], `${at}.lines`, created),
      };
      commands.push(normalized);
      created.add(commandId);
      return;
    }

    if (type === "createReference") {
      assertClosedKeys(command, ["type", "commandId", "source", "target"], at);
      commands.push({
        type,
        commandId,
        source: normalizeSourcePointer(command["source"], `${at}.source`, created),
        target: normalizeCreatedPointer(command["target"], `${at}.target`, created),
      });
      return;
    }

    if (type === "setStatus") {
      assertClosedKeys(command, ["type", "commandId", "target", "transition", "expectedStatus"], at);
      commands.push({
        type,
        commandId,
        // It may point only at an existing bill, or at a createBill that already appeared in this plan. The latter still walks the target edge's
        // evaluate → execute one by one; it only lets a new draft be submitted and approved inside the same atomic plan.
        target: normalizeSourcePointer(command["target"], `${at}.target`, created),
        transition: requireText(command["transition"], `${at}.transition`),
        expectedStatus: requireText(command["expectedStatus"], `${at}.expectedStatus`),
      });
      // **Do not add it to `created`**: it created no bill, so a `createdId` that points here must still report
      // "unknown or not-yet-executed createBill". If it were added, a placeholder pointing at setStatus would
      // pass the closed gate and then resolve to undefined on the execution side and be written into a business reference.
      return;
    }

    if (type === "setGeneratedHeader") {
      assertClosedKeys(command, ["type", "commandId", "target", "patch", "expectedStatus", "expectedRevision"], at);
      const expectedRevision = command["expectedRevision"];
      if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
        schemaFail(`${at}.expectedRevision must be a non-negative integer`);
      }
      commands.push({
        type,
        commandId,
        target: normalizeSourcePointer(command["target"], `${at}.target`, created),
        patch: normalizePlanRecord(command["patch"], `${at}.patch`, created),
        expectedStatus: requireText(command["expectedStatus"], `${at}.expectedStatus`),
        expectedRevision,
      });
      return;
    }

    if (type === "appendSourceLines") {
      assertClosedKeys(command, ["type", "commandId", "table", "rows"], at);
      const rowsRaw = requireArray(command["rows"], `${at}.rows`);
      if (!rowsRaw.length) {
        schemaFail(`${at}.rows must not be empty — do not send an appendSourceLines command when there are no fact rows`);
      }
      // This capability only appends existing business facts the user chose. It must not write a bill id created in this plan back onto the source bill.
      // That limit keeps the command from needing arbitrary target / created-result resolution, so it stays "append to the source bill" rather than a general patch.
      const noCreatedIds = new Set<string>();
      commands.push({
        type,
        commandId,
        table: requireText(command["table"], `${at}.table`),
        rows: rowsRaw.map((row, index) =>
          normalizePlanRecord(row, `${at}.rows[${index}]`, noCreatedIds)),
      });
      return;
    }

    if (type === "appendTargetLines") {
      assertClosedKeys(command, ["type", "commandId", "target", "table", "rows", "expectedStatus"], at);
      const rowsRaw = requireArray(command["rows"], `${at}.rows`);
      if (!rowsRaw.length) {
        schemaFail(`${at}.rows must not be empty — do not send an appendTargetLines command when there are no fact rows`);
      }
      commands.push({
        type,
        commandId,
        target: normalizeSourcePointer(command["target"], `${at}.target`, created),
        table: requireText(command["table"], `${at}.table`),
        rows: rowsRaw.map((row, index) =>
          normalizePlanRecord(row, `${at}.rows[${index}]`, created)),
        expectedStatus: requireText(command["expectedStatus"], `${at}.expectedStatus`),
      });
      return;
    }

    schemaFail(
      `${at}.type "${String(type)}" is unknown; only createBill / createReference / setStatus / setGeneratedHeader / ` +
        `appendSourceLines / appendTargetLines are allowed`,
    );
  });

  let readSet: ExecutionPlanReadSet | undefined;
  if (obj["readSet"] !== undefined) {
    const set = requireObject(obj["readSet"], `${label}.readSet`);
    assertClosedKeys(set, ["ledgerBalances"], `${label}.readSet`);
    const seen = new Set<string>();
    const ledgerBalances = requireArray(set["ledgerBalances"], `${label}.readSet.ledgerBalances`).map((raw, index) => {
      const at = `${label}.readSet.ledgerBalances[${index}]`;
      const coordinate = requireObject(raw, at);
      assertClosedKeys(coordinate, ["target", "subjectId", "scopeId"], at);
      const target = coordinate["target"];
      if (!(listLedgerCodes() as readonly unknown[]).includes(target)) {
        schemaFail(`${at}.target "${String(target)}" is unknown`);
      }
      const scope = coordinate["scopeId"];
      if (scope !== null && (typeof scope !== "string" || scope.trim() === "")) {
        schemaFail(`${at}.scopeId must be null or a non-empty string`);
      }
      const normalized: PlannerLedgerReadCoordinate = {
        target: target as EffectTarget,
        subjectId: requireText(coordinate["subjectId"], `${at}.subjectId`),
        scopeId: scope === null ? null : scope.trim(),
      };
      const key = JSON.stringify([normalized.target, normalized.subjectId, normalized.scopeId]);
      if (seen.has(key)) schemaFail(`${label}.readSet.ledgerBalances repeats coordinate ${key}`);
      seen.add(key);
      return normalized;
    }).sort((left, right) => {
      const a = JSON.stringify([left.target, left.subjectId, left.scopeId]);
      const b = JSON.stringify([right.target, right.subjectId, right.scopeId]);
      return a < b ? -1 : a > b ? 1 : 0;
    });
    readSet = { ledgerBalances };
  }

  return {
    version: EXECUTION_PLAN_VERSION,
    commands,
    ...(readSet === undefined ? {} : { readSet }),
  };
}

/**
 * Stable JSON is the only input of the fingerprint. metamodel does not depend on node:crypto; the server
 * SHA-256s this string. Object keys are sorted, and array order is kept (command order is itself the execution semantics).
 */
export function canonicalExecutionPlan(plan: ExecutionPlan): string {
  const normalized = normalizeExecutionPlan(plan);
  return canonicalValue(normalized as unknown as PlanValue);
}

function canonicalValue(value: PlanValue): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (isPlanArray(value)) return `[${value.map((item) => canonicalValue(item)).join(",")}]`;
  const objectValue = value as Readonly<Record<string, PlanValue>>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalValue(objectValue[key] as PlanValue)}`)
    .join(",")}}`;
}
