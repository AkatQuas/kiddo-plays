// ---------------------------------------------------------------------------
// Repository contracts — the seam between the data-access layer and the runtime
//
// 🔴 Every method takes `Identity`. Not for convenience. The connection uses the database owner account and does not go through RLS:
// the application layer is the only isolation boundary. A method whose signature has no identity **has no correct implementation**.
//
// The runtime (evaluate to execute) knows only this interface, not Drizzle. Execution logic can therefore be unit-tested
// with an in-memory implementation and does not need a database. Same zero-IO discipline as the kernel, one layer up.
// ---------------------------------------------------------------------------

import type {
  ColumnOverride,
  EffectTarget,
  EffectOp,
  LedgerDimension,
  LedgerMeasureFn,
  PlannerLedgerReadCoordinate,
  ExecutionPlan,
  Query,
  RefFilterCondition,
  ResolvedEffect,
  SavedView,
  SummarySpec,
  TransitionDecision,
  Period,
  PeriodBook,
  UserView,
  UserViewInput,
} from "@open-erp/metamodel";
import type { Identity } from "./identity.js";

/** Open a new period. status is not open to the caller. What gets opened is always open. */
export interface NewPeriod {
  readonly book: PeriodBook;
  readonly code: string;
  readonly seq: number;
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface PeriodRepo {
  list(identity: Identity, book: PeriodBook): Promise<readonly Period[]>;
  open(identity: Identity, input: NewPeriod): Promise<Period>;
}

/** One bill: header plus detail lines (grouped by subtable field key) */
export interface BillRecord {
  readonly id: string;
  /**
   * Monotonic version of the header. It is a concurrency-control token, not a business field. Read interfaces put it on the top of the record.
   * Save, delete, and transition must bring back, unchanged, the version the decision was based on.
   */
  readonly revision: number;
  readonly header: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}

/**
 * One item in a `lockWriteSet`: a write point this transaction is about to touch.
 *
 * `action` = run one edge on an existing bill (coordinates = that bill plus every target it references).
 * `create` = create a new bill (coordinates = every reference target that has a value in the payload).
 */
export type BillWriteLockRequest =
  | { readonly kind: "action"; readonly module: string; readonly id: string }
  | {
      /** A save locks both the aggregate's old coordinates and the reference coordinates introduced by the patch or new detail lines. */
      readonly kind: "save";
      readonly module: string;
      readonly id: string;
      readonly patch: Readonly<Record<string, unknown>>;
      readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null;
    }
  | {
      /** Appending detail facts on the current source bill. Besides the source bill's old coordinates, pre-lock the reference targets in these new rows. */
      readonly kind: "append";
      readonly module: string;
      readonly id: string;
      readonly table: string;
      readonly rows: readonly Readonly<Record<string, unknown>>[];
    }
  | {
      readonly kind: "create";
      readonly module: string;
      readonly header: Readonly<Record<string, unknown>>;
      readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
    };

export interface PageResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  /** The **total** that matches the condition, not the row count of this page */
  readonly total: number;
  /**
   * Aggregates the request asked for. The key is `field:aggregate` as assembled by `summaryKey()`.
   *
   * 🔴 `null` = this batch cannot be computed (no rows, or all empty), not 0. When no aggregate was asked for, this is an empty object,
   * not undefined. "Not asked" and "asked but could not be computed" are two different sentences on screen.
   */
  readonly aggregates: Readonly<Record<string, number | null>>;
}

/** Narrowest return shape for a tenant-scoped system invariant aggregate. It returns no records and no business coordinates. */
export interface InvariantSummaryResult {
  readonly total: number;
  readonly value: number | null;
}

/**
 * One page of reference candidates.
 *
 * 🔴 `truncated` is not optional decoration. Truncating candidates without saying so on screen turns "there are other records"
 * into "these are the only ones". The same discipline covers escape-hatch counts and line-level reverse reference lookups. **A gap must be visible and countable.**
 * A gap must not show up as a blank.
 */
export interface RefOptionsPage {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** More was not returned. The frontend prompts "Type a keyword to keep searching" from this. Do not swallow it silently */
  readonly truncated: boolean;
}

/**
 * Detail lines on one upstream bill that a `refLine` field can reference.
 *
 * 🔴 The shape deliberately has only "rows", not a second declaration projection. `entity` / `through` say which module and which detail table
 * these rows come from. The client uses those two keys to read the schema it **already has** (`getSchema`).
 * Column names, types, and labels all come from there. Stuffing column declarations into this return value opens a second projection of the schema,
 * and when the two drift the picker's columns do not match the detail page's columns, and neither side reports an error.
 *
 * `rows` are the `lineSelection` projection (platform `id` / `lineNo` plus declared fields that have columns plus
 * **derived fields on the row**), then passed through the field-readability projection. A line-level rollup ("shipped on this line") is exactly
 * a derived field, so "the quantity already referenced away" does not need to be computed again at this layer. It is already on the row.
 */
export interface RefLineOptionsPage {
  /** Which module these rows come from */
  readonly entity: string;
  /** Which detail table of that module (the `through` declared by the target `refLine`) */
  readonly through: string;
  /**
   * Column key, on the row, of "the quantity the target module has already referenced away".
   *
   * Derived from the declaration: the upstream detail column whose `derive.rollup` has `from` = the target module, `through` = the target
   * detail table, and `match` = that `refLine` column (`salesOrder.lines.shippedQty` is that column).
   * 🔴 `null` = the upstream did not declare this rollup, so it **cannot be derived**. Do not borrow another column to invent a number that looks reasonable.
   * A wrong "already referenced" makes a person reference the same row twice, and both bills look legal.
   */
  readonly consumedField: string | null;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  /** More was not returned. Same discipline as `RefOptionsPage.truncated`: truncation must be visible */
  readonly truncated: boolean;
}

/**
 * Detail-table scope for agent `bill_get`. A line's identity is the detail-table `id`, not `lineNo`.
 * An empty array = every detail table on this bill (the caller caps it at ANALYSIS_SQL_MAX_ROWS).
 * Non-empty = these named rows. If any id cannot be found, refuse. Do not silently return fewer rows.
 */
export interface BillGetNamedLines {
  readonly lineIds: readonly string[];
}

/** Opening a bill from the operation log: reachable, present in the tenant but outside data scope, or already gone from the tenant. */
export type OperationLogBillVisibility = "open" | "hidden" | "deleted";

export interface BillRepo {
  /**
   * List by Query.
   *
   * 🔴 `query` must already have passed `normalizeQuery(schema, raw)`. That step is the security boundary
   * (conditions come from the browser and the model). When SQL is assembled here, field names go through the allowlist mapping only.
   * No string interpolation.
   */
  list(
    identity: Identity,
    module: string,
    query: Query,
    /** Aggregates computed along the way. **The same WHERE and the same round trip** as the table body. Computing them in a second trip would not match the rows in the table */
    aggregates?: readonly SummarySpec[],
    /**
     * Reference filter when a picker fetches candidates (the copy the server derived from the declaration by coordinate, identical to the dropdown).
     * Intersected with the user's conditions. Filtering and search inside the picker can only make the result smaller.
     */
    refFilter?: readonly RefFilterCondition[],
  ): Promise<PageResult>;

  /**
   * Header aggregate over the tenant. Only for an authorized Planner's programmatic matching or capacity invariants.
   * Module read is judged on the runtime side. This layer crosses data scope only, never the tenant, and does not return rows or ids.
   */
  invariantBillSummary(
    identity: Identity,
    module: string,
    query: Query,
    summary: SummarySpec,
  ): Promise<InvariantSummaryResult>;

  /** Same contract as above, aggregating a named detail table. Filters may land on detail columns or header columns. */
  invariantLineSummary(
    identity: Identity,
    module: string,
    through: string,
    filters: Readonly<Record<string, unknown>>,
    summary: SummarySpec,
  ): Promise<InvariantSummaryResult>;

  /**
   * Fetch one bill. Throw if it does not exist. Do not return null and let each caller invent a fallback.
   *
   * Omitting the fourth argument = header plus every detail table (HTTP / `compileOperations` get / write path), with no row cap.
   * Passing `{ lineIds: [] }` = header plus every detail table on this bill, at most ANALYSIS_SQL_MAX_ROWS rows, and refuse if there are more.
   * Passing a non-empty `{ lineIds }` = header plus those rows. The repository pushes lineIds into SQL. It does not `readLines` the whole table and then filter.
   */
  get(
    identity: Identity,
    module: string,
    id: string,
    named?: BillGetNamedLines,
  ): Promise<BillRecord>;

  /**
   * The three states before an operation-log click opens the detail. Does not return the bill.
   *
   * Optional. An in-memory fixture does not have to implement it. The production repository always has it. Module view permission is judged by the route first.
   * This only answers whether data scope can read the header. When it cannot, look again at whether the bill still exists in the tenant.
   * `open` uses the same scope as the detail GET.
   */
  operationLogVisibility?(
    identity: Identity,
    module: string,
    id: string,
  ): Promise<OperationLogBillVisibility>;

  /**
   * Lock the current bill and all of its source coordinates for one write action, and return the latest snapshot after the lock.
   *
   * May be called only inside `repos.transaction(...)`. The lock lives until the whole action transaction ends.
   * This lock also closes the concurrent double-release of a cumulative gate, and the cross window of a source bill being cancelled while a downstream bill posts.
   */
  lockForAction(identity: Identity, module: string, id: string): Promise<BillRecord>;

  /**
   * Compute, all at once, the coordinates **every write in one outer transaction** will use, and lock them once in global order.
   *
   * 🔴 This exists because of the sufficient condition for avoiding deadlock: **the order a transaction takes locks must be strictly ascending**.
   * Each `createOne` sorting on its own only guarantees order **inside the batch**. A Planner doing 4
   * `createOne` calls in one transaction has nothing responsible for order between batches, so "take the later warehouse first,
   * then go back for the earlier item" forms AB-BA with an ordinary single-batch writer on the other side (measured `40P01`).
   *
   * The call site must be **before any write**. Give the source transition's coordinates together with every `createBill`.
   * Leaving a batch out means that batch is left to be taken in reverse order later (there is still `BillLockLedger`'s
   * no-wait fallback then, but that is a fallback, not the design).
   *
   * ⚠️ Reference values in a `create` request take coordinates **as they are** (no key gate, value gate, or `preselectRefs`):
   * this step only locks a bit more. The tests all stay on the later `create`. Values that point at a bill just created
   * in this transaction (a Planner `createdId` placeholder) have no id yet, so they naturally cannot be locked.
   * They do not need to be. Those ids were just generated by this transaction, and no other transaction can hold them.
   */
  lockWriteSet(identity: Identity, requests: readonly BillWriteLockRequest[]): Promise<void>;

  /**
   * Query **detail lines** (across bills). Used by line-level cumulative gates. A merged stock-out pushes "which order" down onto the line,
   * and "cumulative shipment must not exceed the order line quantity" holds only at the line layer.
   *
   * Keys in `filters` are **resolved in two layers**: a key that exists on a detail column is a line condition, and the rest (`status`) are header conditions.
   * If the key exists in neither layer, **throw**. Do not degrade into adding no condition. That would count draft rows and already-reversed rows into
   * the cumulative quantity and produce a number that is too large and looks completely normal, and that number is exactly the left-hand side of the over-shipment gate.
   *
   * 🔴 Scope follows the header (join back to the header, then apply `moduleScopedWhere`). A detail table has no dataScope of its own.
   * Querying the detail table by tenant alone would let a person who cannot see that bill affect the gate's conclusion.
   *
   * If `maxRows` is exceeded, **throw**. Do not truncate (same as the `RULE_QUERY_MAX_ROWS` rule).
   */
  lineRows(
    identity: Identity,
    module: string,
    through: string,
    filters: Readonly<Record<string, unknown>>,
    maxRows: number,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;

  /** Create. Status is the initial status. Platform fields are filled in at this layer. Whatever the caller passed does not count */
  create(identity: Identity, module: string, header: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>): Promise<BillRecord>;

  /**
   * Generate a downstream draft from the declarative push of an authorized transition.
   *
   * This is not a second user write entry. The caller cannot supply target fields. Only the executor may hand in the draft after the schema mapping.
   * The repository still runs the full key gate and value gate, and limits references to the current tenant. The only difference is that it does not borrow the target module's
   * human create, field, or data-scope grants. The transition grant already explicitly includes this declarative side effect.
   */
  createGenerated(
    identity: Identity,
    module: string,
    header: Readonly<Record<string, unknown>>,
    lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  ): Promise<BillRecord>;

  /**
   * Save draft fields.
   *
   * 🔴 `editable` is **the set of fields the current status allows to be changed** (from `editableFields()`).
   * An out-of-range key always throws. It is not silently dropped. Silent drop would make the caller think the write succeeded.
   *
   * 🔴 `expectedStatus + expectedRevision` is **the snapshot read when this `editable` set was computed**.
   * Both go into the UPDATE WHERE. Pinning only status does not stop "someone else saved but the status did not change". Pinning only revision
   * cannot say which status the state-machine test depended on.
   */
  save(identity: Identity, module: string, id: string, patch: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null, editable: ReadonlySet<string>, expectedStatus: string, expectedRevision: number): Promise<BillRecord>;

  /**
   * Write systemGenerated header scalars to the given values. The key gate and value gate are `checkGeneratedHeader`.
   * A user write envelope still cannot write these cells. A Planner stamp and a system-internal save (`saveInternalHeader`) come through here.
   */
  setGeneratedHeader(
    identity: Identity,
    module: string,
    id: string,
    patch: Readonly<Record<string, unknown>>,
    expectedRevision: number,
  ): Promise<BillRecord>;

  /**
   * An authorized Planner appends fact rows to a named detail table of a bill.
   *
   * Append only. No header patch, no update of old rows, no delete. Values still go through the same key gate, value gate,
   * reference resolution, attachment ownership, and total computation as create and save. `expectedStatus + expectedRevision` pins the target snapshot the plan read.
   * The caller must already have judged module:update and per-field write permission.
   */
  appendLines(
    identity: Identity,
    module: string,
    id: string,
    table: string,
    rows: readonly Readonly<Record<string, unknown>>[],
    expectedStatus: string,
    expectedRevision: number,
  ): Promise<BillRecord>;

  /**
   * Delete a record that has not yet formed a historical fact.
   *
   * `expectedStatus + expectedRevision` is the same optimistic-lock discipline as save and setStatus. The caller judged "delete is allowed" against that snapshot,
   * and the repository must write it into the DELETE WHERE. The repository also checks references across the full module graph and refuses to delete any
   * record that already has ledger rows, an audit, push lineage, or a staged action.
   */
  remove(identity: Identity, module: string, id: string, expectedStatus: string, expectedRevision: number): Promise<void>;

  /** Change status. Only the executor calls this. On success, revision is incremented by 1 atomically in the same UPDATE. */
  setStatus(identity: Identity, module: string, id: string, from: string, to: string, expectedRevision: number): Promise<void>;

  /**
   * Candidates for a `ref` field. Truncation is visible. See `RefOptionsPage`.
   *
   * 🔴 **Two ways to ask, and both are candidates, not a host-row echo.**
   *   · `ids === null`: search (keyword plus limit plus `truncated`). These are candidates for data entry.
   *   · `ids !== null`: take candidate names by id for ids the user entered (`GET /api/refs/:entity/options?ids=`,
   *     notification conditions, rejection and gate copy, import, `refPreselect`).
   *
   * Scope is the target `moduleScopedWhere`. The label goes through `labelFieldsOf` and is then filtered by target-field read.
   * Host-row echo goes through `refLabels` / `refLineLabels`. It does not enter this method.
   *
   * 🔴 An id that was named and cannot be fetched **does not appear in the result**, and no placeholder is returned. That record may be outside
   * the current post's candidate range. The caller keeps the original value.
   */
  refOptions(
    identity: Identity,
    entity: string,
    keyword: string,
    limit: number,
    ids?: readonly string[] | null,
    /**
     * Candidate filter conditions, **passed in after the kernel's `resolveRefFilter` has computed them**.
     *
     * 🔴 The caller must not assemble the test itself. The test lives in the field declaration. The server reads it by coordinate and evaluates it
     * (the candidate endpoint in `http/routes/bills.ts`). The client only provides "which coordinate I am choosing for"
     * and "what the sibling cells are right now". Letting the client pass conditions makes the filter a suggestion.
     * Omit it and the result falls back to the full set, which is exactly the phenomenon this capability exists to remove.
     */
    filter?: readonly RefFilterCondition[],
  ): Promise<RefOptionsPage>;

  /**
   * Candidate rows for a `refLine` field: the detail lines **of one upstream bill** that can be referenced.
   *
   * `path` is the coordinate of that line-level reference on the target module, `<detail table>.<column>` (for example `lines.orderLineId`).
   * 🔴 Who the upstream is, and which detail table, **is resolved from the declaration**, not supplied by the caller. Letting the caller pass entity/through
   * opens a second source of truth for "what to query", and when it drifts from `refSitesOf` the symptom is
   * "the picker can pick it, and save says this line does not exist".
   *
   * 🔴 Scope is **the same, word for word**, as the line-level branch of `refOptions` / `resolveRefs`: join back to the upstream header
   * and then apply `moduleScopedWhere` (a detail table has no dataScope of its own). Too wide means "a record the dropdown cannot select
   * can be referenced by handwriting an id". Too strict means "the dropdown can select it, and save says it does not exist".
   */
  refLineOptions(
    identity: Identity,
    module: string,
    path: string,
    billId: string,
    limit: number,
    /** The exact rows a persisted reference needs for echo. They must be returned even when the balance is zero. A candidate query passes an empty array. */
    includeLineIds: readonly string[],
  ): Promise<RefLineOptionsPage>;

  /**
   * Host-row echo: what these reference ids are called on a host row the server has already read within scope.
   *
   * Bound to the tenant only. Does not look at target read, lookup, data scope, or field read.
   * The id must come from a host row the server just read within scope (or a prefilled value in the same response).
   * Empty ids return an empty Map. If any id cannot be fetched in this tenant, throw. The same id in another tenant also counts as not fetched.
   * Must not be used to read a list, candidates, or a detail.
   */
  refLabels(
    identity: Identity,
    entity: string,
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;

  /**
   * Host-row echo: what a line id on a refLine coordinate is called. The label is `line N`.
   *
   * `module` is the host module. `path` is the host refLine coordinate `<detail table>.<column>`.
   * When a refLine on an action's detail is not in the module table, `module` is the upstream module instead,
   * and `path` is written `<upstream detail table>.__line__`.
   * Fetching the row is bound to the tenant only. Empty ids return an empty Map. Throw if the row does not exist or lineNo is not an integer.
   * Must not be used to read a list, candidates, or a detail.
   */
  refLineLabels(
    identity: Identity,
    module: string,
    path: string,
    billId: string,
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;

  /**
   * "Who is the default row among this cell's candidates". Return it only when there is **exactly one**. 0 or more than 1 returns `null`.
   *
   * The conditions are also passed in after the kernel has computed them (`resolveRefPreselect`, candidate set union default conditions),
   * the same discipline as `refOptions` `filter`: the test lives in the field declaration, and the caller only gives the coordinate.
   *
   * 🔴 This and the write-side default fill use the **same implementation** (`lookupRefPreselect`).
   * Separate copies for the row the form fills automatically and the row the server fills on save show up as
   * "the screen selected A, and after save it became B". Each one on its own is a legal reference, and nothing reports an error.
   */
  refPreselect(
    identity: Identity,
    entity: string,
    conditions: readonly RefFilterCondition[],
  ): Promise<string | null>;
}

/** An execution that must keep the same business snapshot across several reads may explicitly raise the transaction isolation level. */
export interface TransactionOptions {
  readonly isolationLevel?: "read committed" | "repeatable read";
}

/** One ledger entry that has already been stored */
export interface LedgerRow {
  readonly id: string;
  readonly target: EffectTarget;
  readonly op: EffectOp;
  readonly amount: number;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly sourceModule: string;
  readonly sourceId: string;
  readonly sourceLineId: string | null;
  readonly transitionCode: string;
  readonly reversalOf: string | null;
  /** Posting period. An independent time axis from `occurredAt`. They may legally disagree */
  readonly postingPeriod: string;
  /**
   * When the fact happened (ISO string).
   *
   * 🔴 It does **not** substitute for `postingPeriod`. Both must go out. The flow is sorted by it (`flows`
   * `order by occurred_at desc`), and "which period this entry is booked in" is a different decision.
   * Without it, a page of flow already sorted newest-first cannot say when each row happened.
   * The sort key is invisible, so the user can only read the posting period as the time it happened, and those two numbers often legally differ.
   */
  readonly occurredAt: string;
}

/**
 * Ledger filter. **All equality or ranges, no structural tree.** Ledger columns are fixed,
 * and it does not need the `bill_list` where syntax that expands from the module declaration.
 */
export interface LedgerFilter {
  readonly subjectId?: string;
  readonly scopeId?: string;
  readonly op?: EffectOp;
  readonly sourceModule?: string;
  readonly transitionCode?: string;
  /** Closed interval of when it happened, ISO strings */
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly postingPeriod?: string;
}

export interface LedgerMeasure {
  /** Stable key in the result, for the caller to refer to */
  readonly key: string;
  readonly fn: LedgerMeasureFn;
}

/**
 * Which column a grouped result is sorted by.
 *
 * 🔴 **It must be sorted on the server.** The caller must not sort one page. Grouped results are paginated,
 * and sorting the page in hand produces the illusion that "only this page is ordered", which looks correct.
 * Questions such as "the goods whose latest ledger movement is the oldest" (stale stock) ask for the first rows of the **whole set**.
 *
 * `key` is a measure key or a group-dimension name (`aggregate` checks each one and rejects an unknown key).
 */
export interface LedgerSort {
  readonly key: string;
  readonly desc: boolean;
}

export interface LedgerQuery {
  readonly target: EffectTarget;
  readonly where: LedgerFilter;
  readonly groupBy: readonly LedgerDimension[];
  readonly measures: readonly LedgerMeasure[];
  /**
   * Sort. Default = ascending by group dimension (stable and pageable; see `aggregate`).
   *
   * Even when one is given, the dimension is still carried as a **tie-break key**. Sorting by the measure alone has no total order between two rows with the same value,
   * so page two may overlap page one or skip rows, while each page looks normal on its own.
   */
  readonly sort?: LedgerSort;
  /**
   * 🔴 **Explicitly admit "what is wanted this time is a cross-scope total".** When omitted (`undefined` / `false`),
   * a ledger that has a scope (currently only `stock`) is still hard-rejected. That is the most expensive basis discipline in this warehouse:
   * A cross-warehouse total has a value, a unit, and can be sorted, and it answers "does the Shanghai warehouse have enough to ship" wrong.
   *
   * It is opened because **another class of question has no answer under that discipline**: "which items still have stock" and "which goods have not
   * moved in 90 days" ask for a **whole-company** basis. Grouping by warehouse splits the same item into N rows,
   * and adding those N rows is the caller doing the cross-warehouse total again on the client. The same mistake, with the label missing.
   *
   * The way the two costs offset (both required, both inside `aggregate`):
   *   First, **it must be passed explicitly**. Omitting it = the old behavior = reject. Otherwise every existing query that forgot scopeId
   *      would silently become a cross-warehouse total, which is exactly what this discipline was built to prevent.
   *   Second, **every produced row carries a `scopeSpan` label** (not only the outer envelope). Rows get copied into tables,
   *      CSV, and a model's answer, and the outer mark falls off along that path. A number that carries "total of all warehouses"
   *      can still say what it is wherever it goes.
   *
   * 🔴 The write path is **not touched at all**. `LedgerRepo.balance()` (the path `available_sufficient` and the locked read before posting
   * take) still throws when scopeId is missing. The question there is "is this warehouse enough",
   * and a cross-warehouse number on that path is what directly drives stock negative.
   */
  readonly acrossScopes?: boolean;
  readonly limit: number;
  readonly offset: number;
}

/**
 * The label key stamped on **every row** of a cross-scope total.
 *
 * 🔴 Reserved key. A measure's key must not be named this (`aggregate` rejects it), or one key has two meanings and
 * the later write silently covers the earlier one. Same discipline as "a measure key must not share a name with a group dimension".
 */
export const LEDGER_SCOPE_SPAN_KEY = "scopeSpan";

/** One grouped-result row: the group dimension's value plus each measure. Measure keys are given by the caller */
export type LedgerGroupRow = Readonly<Record<string, string | number | null>>;

export interface LedgerPage<T> {
  readonly rows: readonly T[];
  /** There is more. This is **not** "an error". The caller uses it to decide whether to turn the page */
  readonly truncated: boolean;
  readonly nextOffset: number | null;
}

export interface LedgerRepo {
  /**
   * Lock a set of balance coordinates once, in a unique total order. May be called only inside a write transaction. Planner read-set and
   * ledger append share this lock, so no new ledger row is inserted on the same coordinate during "recompute after the lock".
   */
  lockBalances(identity: Identity, coordinates: readonly PlannerLedgerReadCoordinate[]): Promise<void>;
  /**
   * Balance = the sum of the ledger.
   *
   * 🔴 **There is no second source.** There is no balance table and no balance column. This method's return value is the ledger itself.
   * `stock` must be given both subjectId and scopeId, or "which warehouse" cannot be resolved.
   */
  balance(
    identity: Identity,
    target: EffectTarget,
    subjectId: string,
    scopeId: string | null,
    /**
     * 🔴 The write path must pass `true`: lock this coordinate before reading it.
     *
     * Without the lock, two concurrent postings each read "still enough" and each post, and stock goes negative, while both checks
     * really did pass and both ledger rows look legal on their own, with no anomaly to see. Read interfaces pass false,
     * or a pure display would contend with posting for the lock.
     */
    forUpdate?: boolean,
  ): Promise<number>;

  /** Which entries this bill has posted. Reversal reconciliation and the bill detail page both need it */
  rowsOf(identity: Identity, module: string, billId: string): Promise<readonly LedgerRow[]>;

  /**
   * Evaluate grouped by dimension. **`balance()` is the special case where groupBy is empty and the only measure is net.**
   *
   * 🔴 This exists because `balance()` answers only one coordinate at a time. "Which items still have stock" and "which customers owe the most"
   * can, with only point lookups, only round-trip one subject at a time. Measured: one question made 40 calls.
   * That is not the caller being clumsy. This layer had not offered the shape they needed.
   */
  aggregate(identity: Identity, query: LedgerQuery): Promise<LedgerPage<LedgerGroupRow>>;

  /**
   * List flow detail.
   *
   * 🔴 A balance cannot answer "was there a stock-out recently". A balance only says how much there is now. It cannot say when the previous entry was, or which bill posted it.
   * This read used to be only `rowsOf` (by bill), so "has this item moved recently" required already knowing which bill,
   * and that is exactly what was being asked.
   */
  flows(identity: Identity, query: Omit<LedgerQuery, "groupBy" | "measures">): Promise<LedgerPage<LedgerRow>>;

  /** Append ledger rows. **Append only, never update or delete.** A reversal is another row in the opposite direction, with reversalOf pointing back */
  append(identity: Identity, rows: readonly NewLedgerRow[]): Promise<void>;
}

export interface NewLedgerRow {
  readonly effect: ResolvedEffect;
  readonly sourceModule: string;
  readonly sourceId: string;
  readonly sourceLineId: string | null;
  readonly transitionCode: string;
  /** Which row is being reversed. null for a forward row */
  readonly reversalOf: string | null;
  readonly occurredAt: Date;
  /**
   * Posting period (`oe_period.code`).
   *
   * 🔴 **Required. Not computed inside the repository.** A posting period is a **decision** (it may shift to another period, or it may refuse),
   * not a function of `occurredAt`, and the decision must have only one place (`resolvePostingPeriod`).
   * Letting the repository compute it would open a second entry, and that entry would not carry the "if it shifted, tell the user" half.
   */
  readonly postingPeriod: string;
}

/** A staged action an agent proposed */
export interface StagedActionRecord {
  readonly id: string;
  readonly module: string;
  readonly billId: string;
  readonly transitionCode: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly decision: TransitionDecision;
  /** Source-bill revision at propose time. A staged action from before the old migration is null, and confirm must refuse and ask for a new proposal. */
  readonly proposedRevision: number | null;
  /** The full plan the user is about to confirm when a Planner proposes. null for an ordinary transition. */
  readonly executionPlan: ExecutionPlan | null;
  /** SHA-256 of decision plus executionPlan. Must be null exactly when executionPlan is null. */
  readonly planFingerprint: string | null;
  readonly proposedBy: string;
  readonly reason: string;
  readonly status: "pending" | "confirmed" | "rejected" | "expired";
}

/** Display names for staged-action status. User-facing copy must not leak the raw status keys. */
export const STAGED_STATUS_LABELS: Record<StagedActionRecord["status"], string> = {
  pending: "pendingConfirm",
  confirmed: "Confirmed",
  rejected: "rejected",
  expired: "Expired",
};

export interface StagedActionRepo {
  /**
   * Propose a staged action.
   *
   * 🔴 Proposing again with the same `idempotencyKey` **returns the existing row**. It does not create a new one.
   * Model retries are normal (timeout, context truncation, self-doubt). Without idempotency,
   * one "approve" becomes three todos, and a person has to tell which one is real.
   */
  propose(identity: Identity, input: Omit<StagedActionRecord, "id" | "status"> & { readonly idempotencyKey: string }): Promise<StagedActionRecord>;

  listPending(identity: Identity, module: string | null): Promise<readonly StagedActionRecord[]>;
  get(identity: Identity, id: string): Promise<StagedActionRecord>;

  /** A person decides. After confirmed, the executor does the real persist */
  decide(identity: Identity, id: string, decision: "confirmed" | "rejected", rejectReason: string | null): Promise<StagedActionRecord>;
}

/**
 * Store one view.
 *
 * 🔴 **No `ownerId`.** Ownership is set by the server from `requireIdentity()`, not given by the caller.
 * Ownership sent by the client opens impersonation. The frontend also cannot say "who the current user is" (`DataAdapter` has no such method).
 *
 * `id` null = create. When changing an existing view, `module` must still be sent. It is one coordinate of this record.
 * A mismatch means the frontend is writing with a view id from another module. That is a bug, not "casually change the module".
 */
export interface SavedViewInput {
  readonly id: string | null;
  readonly module: string;
  readonly name: string;
  readonly query: Query;
  /** 🔴 A **diff**, not the whole column list. The repository stores and returns it as-is. Composition happens in `resolveColumns()` */
  readonly columns: readonly ColumnOverride[];
  readonly isDefault: boolean;
}

export interface SavedViewRepo {
  /**
   * Views I can see under this module: **my own plus shared** (`ownerId` null).
   *
   * Do not return someone else's private views. A view stores query conditions, which is how someone else looks at data.
   */
  list(identity: Identity, module: string): Promise<readonly SavedView[]>;

  /**
   * Create a view, or change one in place.
   *
   * 🔴 `columns` stores a **diff** (`ColumnOverride[]`). The repository only stores and returns it as-is.
   * It does not compose against the schema's default columns at this layer. Composing once freezes the column list of that moment,
   * and after a field is added to the module, a person who saved a view never sees it, with no error.
   *
   * 🔴 At most one `isDefault`. Before writing, clear the old default under the same (tenant, module, me),
   * in the same transaction as this write. The database also has a partial unique index as a backstop (two people setting the default at once,
   * and each "clear then write" holds on its own; only the index can stop it).
   */
  save(identity: Identity, input: SavedViewInput): Promise<SavedView>;

  /** Delete my own view. If it cannot be deleted (missing, shared, or someone else's), always throw. Do not treat it as "already deleted" */
  remove(identity: Identity, id: string): Promise<void>;
}

/**
 * User-view repository — user-defined views (new implementation)
 *
 * Lives alongside SavedViewRepo and stores the frontend view-configuration feature (PRD 2026-09-14).
 *
 * 🔴 Difference:
 * - SavedView: query plus columns, for complex queries and column configuration
 * - UserView: filters plus displayFields plus sortRules, simpler and more direct
 *
 * 🔴 Ownership:
 * - Each view belongs only to the user who created it (userId)
 * - Views can be shared by user or department
 */
export interface UserViewRepo {
  /** List views visible to the current user under the given module (owned plus shared), in personal tab order or default sortOrder ascending */
  list(identity: Identity, module: string): Promise<readonly UserView[]>;

  /** Fetch a view by id. Only a view the current user can see */
  getById(identity: Identity, id: string): Promise<UserView | null>;

  /** Create a view. userId comes from identity on the server */
  create(identity: Identity, input: UserViewInput): Promise<UserView>;

  /** Update a view. Only a view the current user created */
  update(identity: Identity, id: string, input: UserViewInput): Promise<UserView>;

  /** Delete a view. Only a view the current user created */
  remove(identity: Identity, id: string): Promise<void>;

  /** Batch-update the current user's personal tab order for this module (any visible view). Also syncs the default sort_order of views they own */
  updateSort(identity: Identity, module: string, orders: readonly { id: string; sortOrder: number }[]): Promise<void>;
  share(identity: Identity, id: string, input: Pick<UserViewInput, "scope" | "scopeUserIds" | "scopeDeptIds">): Promise<UserView>;
  unshareUser(identity: Identity, id: string, userId: string): Promise<UserView>;
}

export interface EffectiveModuleSetting {
  readonly code: string;
  readonly module: string;
  readonly label: string;
  readonly description: string;
  readonly effectiveWhen: string;
  readonly value: string;
  readonly defaultValue: string;
  readonly revision: number;
  readonly options: readonly {
    readonly code: string;
    readonly label: string;
    readonly description: string | null;
  }[];
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
}

export interface ModuleSettingAuditEntry {
  readonly id: string;
  readonly settingCode: string;
  readonly revision: number;
  readonly before: string;
  readonly after: string;
  readonly actorId: string;
  readonly at: Date;
}

/** A setting declared in code. The tenant repository stores only the chosen value, revision, and audit. */
export interface ModuleSettingRepo {
  list(identity: Identity): Promise<readonly EffectiveModuleSetting[]>;
  get(identity: Identity, code: string): Promise<EffectiveModuleSetting>;
  audit(identity: Identity, code: string): Promise<readonly ModuleSettingAuditEntry[]>;
  set(
    identity: Identity,
    code: string,
    expectedRevision: number,
    value: string,
    at: Date,
  ): Promise<EffectiveModuleSetting>;
}

export interface Repos {
  readonly bills: BillRepo;
  readonly execute: { execute(statement: unknown): Promise<unknown> };
  readonly ledger: LedgerRepo;
  readonly staged: StagedActionRepo;
  readonly savedViews: SavedViewRepo;
  readonly userViews: UserViewRepo;
  readonly moduleSettings: ModuleSettingRepo;
  /** Periods: the data source for a ledger row's posting period. Currently read and open only. Period close is not built yet */
  readonly periods: PeriodRepo;
  /**
   * Run inside one transaction.
   *
   * 🔴 Executing one edge must be **a single transaction**: change status, write the audit, write the ledger, write handoffs, write references.
   * Any failure rolls the whole thing back. Separate commits leave an unrecoverable middle state: status changed but the books did not post,
   * and it looks completely normal on screen.
   */
  transaction<T>(fn: (repos: Repos) => Promise<T>): Promise<T>;
}
