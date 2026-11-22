import { createHumanActionRepo } from "./humanActionRepo.js";
export * from "./botTaskRepo.js";
// ---------------------------------------------------------------------------
// Repository assembly — bind the whole set of repositories to **the same connection**
//
// 🔴 The repositories `transaction()` hands out must be bound **as a whole** to the transaction connection.
// Using the outer db makes "one transaction" a lie: status changed, the ledger posted, and the handoff was written outside the transaction —
// after rollback the todo is still there, and the screen looks completely normal.
// So there is no "default to the outer db" path — repositories inside a transaction are reassembled as a whole from tx.
// ---------------------------------------------------------------------------

import type { RuntimeCatalog } from "@open-erp/runtime-core";
import { createAuditRepo } from "./auditRepo.js";
import { BillLockLedger, createBillRepo } from "./billRepo.js";
import { applyWriteTimeouts, guardConcurrency } from "./pgError.js";
import { createHandoffRepo } from "./handoffRepo.js";
import { createLedgerRepo } from "./ledgerRepo.js";
import { createPeriodRepo } from "./periodRepo.js";
import { createPlanResultRepo } from "./planResultRepo.js";
import type { GeneratedTables } from "./generatedTables.js";
import { createRegistry, type ModuleRegistry } from "./queryCompiler.js";
import { createReferenceRepo } from "./referenceRepo.js";
import { createSavedViewRepo } from "./savedViewRepo.js";
import { createUserViewRepo } from "./userViewRepo.js";
import { createModuleSettingRepo } from "./moduleSettingRepo.js";
import { createChangeEventRepo } from "./changeEventRepo.js";
import { createOperationLogRepo } from "./operationLogRepo.js";
import { createStagedRepo } from "./stagedRepo.js";
import type { ExecutionRepos } from "@open-erp/runtime-core";
import type { TransactionOptions } from "@open-erp/runtime-core";
import { schemasOf, type Executor } from "./support.js";

/**
 * Something that can run SQL: a connection pool, or a transaction.
 *
 * Take the shared base class `PgDatabase` rather than the concrete `PostgresJsDatabase`, so a repository
 * is unaware of "am I on a transaction or on the pool" — if it were aware, someone would misuse the outer connection inside a transaction.
 *
 * 🔴 The second type parameter must be written explicitly as `Record<string, unknown>`. The default on `PgDatabase` is
 * `Record<string, never>`, and `drizzle()` returns the former — omit it and the assembly point does not type-check,
 * which used to be covered by an `as unknown as`. Repositories do not use the relational query API,
 * so this type parameter means nothing to this layer. Its only job is to stop lying.
 */
export type { Executor } from "./support.js";

export { createRegistry, compileInvariantSummaryQuery, compileQuery, moduleScopedWhere, QueryCompileError } from "./queryCompiler.js";
export type { ModuleRegistry, ModuleTables, CompiledQuery, CompileOptions } from "./queryCompiler.js";
export { loadGeneratedTables } from "./generatedTables.js";
export type { GeneratedTables } from "./generatedTables.js";
export {
  applyRefDefault,
  assertAttachmentsOwned,
  assertResolvedWrite,
  billNotFoundError,
  billNotRemovableError,
  inUseRemedy,
  matchRebound,
  mergeUniqueWithPeers,
  pickSinglePreselect,
  removalRemedy,
  retirementExitsOf,
  refFilterMismatchMessage,
  statusRemedyOf,
  uniqueDuplicateMessage,
  uniqueProbe,
  updateValues,
} from "./billRepo.js";
export { balanceLockKey, createLedgerRepo, LedgerError, orderedBalanceLockKeys } from "./ledgerRepo.js";
export { PeriodError, createPeriodRepo } from "./periodRepo.js";
export { StagedActionError } from "./stagedRepo.js";
export { SavedViewError } from "./savedViewRepo.js";
export {
  createUserViewRepo,
  ViewConfigError,
  UserViewNotFoundError,
  UserViewDuplicateNameError,
  UserViewLimitError,
  UserViewPermissionDeniedError,
} from "./userViewRepo.js";
export type { UserViewRepo } from "@open-erp/runtime-core";
export { createSurfacePreferenceRepo } from "./surfacePreferenceRepo.js";
export type { SurfacePreferenceConfig, SurfacePreferenceRepo } from "./surfacePreferenceRepo.js";
export { AuditError } from "./auditRepo.js";
export {
  applyWriteTimeouts,
  ConcurrencyConflictError,
  guardConcurrency,
  guardWrite,
  LOCK_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  UniqueViolationError,
  WriteTimeoutError,
} from "./pgError.js";
export { BillLockLedger, billActionLockKey, compareLockKeys, orderedLockKeys } from "./billRepo.js";
export type { BillCoordinate } from "./billRepo.js";
export { PlanResultError } from "./planResultRepo.js";
export { createAuditRepo } from "./auditRepo.js";
export { createHandoffRepo } from "./handoffRepo.js";
export { createPlanResultRepo } from "./planResultRepo.js";
export { createReferenceRepo } from "./referenceRepo.js";
export { createSavedViewRepo } from "./savedViewRepo.js";
export { createChangeEventRepo } from "./changeEventRepo.js";
export type { ChangeEventQueue, ChangeEventRow } from "./changeEventRepo.js";
export { createOperationLogRepo, operationLogInstantRange, operationLogLikePattern, operationLogListQuery } from "./operationLogRepo.js";
/**
 * Notification repository. **Deliberately not inside `assemble()`**, for the same reason as `createAgentSkillRepo`, word for word:
 * configuring a reminder rule and writing a document are not the same thing, and they should not share a transaction boundary.
 */
export {
  createNotificationRepo,
  NotificationNotFoundError,
  NotificationInputError,
  NotificationRevisionConflictError,
} from "./notificationRepo.js";
export type {
  InboxFilter,
  NotificationMessageInput,
  NotificationMessageRecord,
  NotificationRepo,
  NotificationRuleFilter,
  NotificationRuleInput,
  NotificationRuleRecord,
  NotificationRunFilter,
  NotificationRunInput,
  NotificationRunRecord,
  Paged,
} from "./notificationRepo.js";
export {
  createModuleSettingRepo,
  ModuleSettingInputError,
  ModuleSettingNotFoundError,
  ModuleSettingRevisionConflictError,
} from "./moduleSettingRepo.js";
// 🔴 Export only the repository. The four statuses and six actions are a contract of `@open-erp/runtime-core`,
// and callers take them from there — forwarding them again from this package is the kind of forwarding layer the single-implementation rule names:
// the day the two sides differ, a reader cannot tell which one is in charge.
export {
  createFlowRepo,
  FlowInputError,
  FlowNotFoundError,
  FlowRevisionConflictError,
  FlowStateError,
} from "./flowRepo.js";
export type { FlowRepo, FlowRevisionEntry, StoredFlow } from "./flowRepo.js";
export {
  ChainInputError,
  ChainNotFoundError,
  ChainRevisionConflictError,
  createChainRepo,
} from "./chainRepo.js";
export type { ChainRepo, StoredChain } from "./chainRepo.js";
export { createFlowRunRepo, FlowRunInputError } from "./flowRunRepo.js";
export type { FlowRunRepo, StoredFlowRun, FlowRunStep, FlowRunStepState } from "./flowRunRepo.js";
export { createStagedRepo } from "./stagedRepo.js";
export {
  compileAggregates,
  failedRefFilterConditions,
  lineScope,
  refFilterMatches,
  resolveOperandum,
} from "./queryCompiler.js";
export { materializeStoredCalculations } from "./materialize.js";
export type { StoredCalculationIssue, StoredCalculationResult } from "./materialize.js";
export { createLocalRbacRepo, LocalRbacConflictError, LocalRbacRepoError, type DirectoryPersonTable } from "./localRbacRepo.js";
export { subjectDirectoryTable } from "./directoryTable.js";
export { applyLocalRbacCatalog } from "./localRbacCatalogRepo.js";

/**
 * Agent call log.
 *
 * 🔴 **Deliberately not inside `assemble()`**, which means not inside `Repos` / `ExecutionRepos`.
 * Repositories there get rebound onto tx by `transaction()`, so a rolled-back call would **take its own trace
 * with it** — and "it tried, and was refused" is exactly the row an investigation most wants to see.
 * The call log and a business write are two layers, and they should not share a transaction boundary.
 */
export { createAgentAuditRepo, AgentAuditError, AGENT_CALL_MAX_ROWS } from "./agentAuditRepo.js";
export type { AgentAuditRepo, AgentCallRow } from "./agentAuditRepo.js";
export {
  createAgentEvidenceRepo,
  AgentEvidenceError,
  EVIDENCE_TTL_MS,
  EVIDENCE_MAX_CHARS,
} from "./agentEvidenceRepo.js";
export type { AgentEvidenceRepo, EvidencePayload, EvidenceRecord } from "./agentEvidenceRepo.js";
export { createRoundIntakeRepo } from "./roundIntakeRepo.js";
export type { RoundIntakeRepo } from "./roundIntakeRepo.js";
export { createAgentRecipeRepo } from "./agentRecipeRepo.js";
export type { AgentRecipeRepo, AgentRecipeRow } from "./agentRecipeRepo.js";
export { createRuntimeLoginRepo, RUNTIME_LOGIN_LEASE_MS } from "./runtimeLoginRepo.js";
export type { RuntimeLoginRecord, RuntimeLoginRepo } from "./runtimeLoginRepo.js";

/**
 * Tenant skill repository. **Deliberately not inside `assemble()`**:
 * reading an enabled tenant procedure and any single document write are not the same thing, and they should not share a transaction boundary.
 */
export { createAgentSkillRepo, AgentSkillError } from "./agentSkillRepo.js";
export type { AgentSkillRepo } from "./agentSkillRepo.js";
export { createAnalysisRepo } from "./analysisRepo.js";
export {createAnalysisSnapshotExporter,type SnapshotSource,type SnapshotConsumer,type SnapshotExport,type SnapshotIntent} from "./analysisSnapshotRepo.js";
export type { AnalysisRepo, GroupAnalysisResult } from "./analysisRepo.js";
export { nextCode } from "./numbering.js";
export { createAnalysisSqlRepo } from "./analysisSqlRepo.js";
export type { AnalysisSqlRepo } from "./analysisSqlRepo.js";

export {
  ChoiceSetConfigurationError,
  ChoiceSetInputError,
  ChoiceSetNotFoundError,
  ChoiceSetRevisionConflictError,
  assertChoiceSetWrite,
  choiceSetLockKey,
  createChoiceSetUsageCounter,
  createChoiceSetRepo,
  lockChoiceSets,
  resolveChoiceSetOptions,
} from "./choiceSetRepo.js";
export * from "./customFieldRepo.js";
export * from "./customFieldBackfill.js";
export type {
  ChoiceSetAuditEntry,
  ChoiceSetItemPatch,
  ChoiceSetRepo,
  ChoiceSetUsageCounter,
  EffectiveChoiceSet,
  EffectiveChoiceSetItem,
  NewChoiceSetItem,
} from "./choiceSetRepo.js";

/**
 * Assemble the repositories.
 *
 * 🔴 **Only one assembly point.** A split of "`Repos` one set, `ExecutionRepos` another" means adding a seventh
 * repository changes only one of them, so the write path is missing a table — and the missing one is invisible on the screen.
 * The narrow interface (`Repos`) is a **view** of the same object, not a second implementation.
 */
function assemble(
  exec: Executor,
  registry: ModuleRegistry,
  choiceSets: RuntimeCatalog["choiceSets"],
  moduleSettings: RuntimeCatalog["moduleSettings"],
  timezone: string,
  /**
   * Transaction-scoped coordinate-lock ledger. **Only the repository set inside a transaction has one** (`transaction()` builds one per transaction).
   *
   * The pool set passes `null`: each `create` / `save` / `remove` then opens its own transaction with `inTx`,
   * and the lock's lifetime ends with that transaction. Sharing one ledger would record a lock the previous request already released as "still held",
   * and this repository instance is shared across concurrent requests (one per process), so a shared mutable ledger would also contaminate them one after another.
   */
  lockLedger: BillLockLedger | null = null,
): ExecutionRepos {
  return {
    execute: { execute: exec.execute.bind(exec) },
    humanActions: createHumanActionRepo(exec),
    bills: createBillRepo(exec, registry, timezone, lockLedger, choiceSets),
    ledger: createLedgerRepo(exec, lockLedger !== null),
    periods: createPeriodRepo(exec),
    staged: createStagedRepo(exec),
    savedViews: createSavedViewRepo(exec),
    userViews: createUserViewRepo(exec),
    moduleSettings: createModuleSettingRepo(exec, moduleSettings),
    audit: createAuditRepo(exec),
    // 🔴 Must be inside assemble: `transaction()` rebinds the whole repository set onto tx, so a change fact
    // lives and dies with the business write. Mounted outside, "the business rolled back but the event is still there".
    changeEvents: createChangeEventRepo(exec),
    // The operation log follows the same rule: the callback receives the set on tx, and a business rollback means the log is gone too.
    operationLogs: createOperationLogRepo(exec),
    handoff: createHandoffRepo(exec, registry, timezone),
    references: createReferenceRepo(exec, registry, timezone),
    planResults: createPlanResultRepo(exec),
    async transaction<T>(fn: (repos: ExecutionRepos) => Promise<T>, options?: TransactionOptions): Promise<T> {
      // 🔴 Repositories in the callback are bound to tx. Executing one edge (change status + write audit + write ledger + write handoff + write reference)
      // must succeed or fail as a whole — committing them separately produces an unrecoverable middle state such as "status changed but the ledger did not post".
      //
      // 🔴 `guardConcurrency` wraps **this layer**: PostgreSQL 40P01 / 40001 roll back **the whole transaction**,
      // not one statement, so only the transaction boundary can translate them. Wrapping further in (for example on one insert)
      // misses numbering and lock waits, which throw Class 40 too — the measured 40001 came from
      // the `oe_code_seq` upsert, outside every `guardWrite`.
      return await guardConcurrency("execute this write", async () =>
        await exec.transaction(async (tx) => {
          // 🔴 **Both lock waits and statements need a ceiling**, and it must be installed **here**: every write transaction passes through it,
          // while timeouts scattered across call sites will miss the next new write path, with zero symptoms when they do —
          // the shape this fix removes: the request hangs until the browser times out on its own, and the server prints nothing.
          // The criterion and the values are in `applyWriteTimeouts`.
          await applyWriteTimeouts(tx);
          return await fn(assemble(tx, registry, choiceSets, moduleSettings, timezone, new BillLockLedger()));
        }, options),
      );
    },
  };
}

/**
 * Build the one repository set the executor needs. `catalog` is the only source of truth for module tables, and the registry is created only here;
 * when a consumer needs the narrow interface it takes a view by structure, and does not assemble a second object.
 */
export function createExecutionRepos(
  db: Executor,
  catalog: RuntimeCatalog,
  timezone: string,
  tables: GeneratedTables,
): ExecutionRepos {
  return assemble(db, createRegistry(schemasOf(catalog), tables), catalog.choiceSets, catalog.moduleSettings, timezone);
}
