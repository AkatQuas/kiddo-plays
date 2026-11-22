// ---------------------------------------------------------------------------
// Framework tables — **handwritten**, not generated from the schema.
//
// The criterion: is this table the **shape of a business module**, or a **mechanism of the framework itself**?
// The former (what a sales order looks like) is compiled from the domains/ declaration; see tables/ at the root (@open-erp/tables).
// The latter (how a ledger is recorded, how a handoff is dispatched) is part of the framework, travels with the code, and is handwritten here.
//
// Generated tables come and go with the module declaration; these framework tables always travel with the packages. Mixing them makes "regenerate" a dangerous operation.
// (`yarn gen:db` deletes only files that carry the generated banner, precisely so a wrong --out does not delete this file.)
// ---------------------------------------------------------------------------

import type { ModulePermissionAction, ScopeCondition } from "@open-erp/metamodel";
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** The isolation axis every table carries. 🔴 The connection does not use RLS; these two columns plus the query wrapper are the only tenant boundary. */
const isolation = {
  tenantId: text("tenant_id").notNull(),
  orgId: text("org_id").notNull(),
};

/**
 * Take a group of columns by a **name list**, a non-empty tuple. A unique index and `ON CONFLICT` share this one list.
 *
 * 🔴 Why they must share it: copying the column group twice was measured — `stagedRepo.propose`'s
 * `onConflictDoNothing` wrote only (tenant × key), while the index is the whole coordinate, so PostgreSQL rejected the whole statement
 * (`there is no unique or exclusion constraint matching the ON CONFLICT specification`),
 * and **every agent proposal returned 500**. It looked like "staged actions are broken", not like "the two lists drifted".
 * Stub tests were all green: only a real database checks the ON CONFLICT columns, so the criterion must exist as one copy inside the type system.
 *
 * What is shared is the **name**, not the column object: the index declaration receives an `ExtraConfigColumn`,
 * the repository receives a real column, and the two types differ — the greatest thing they can share is this name list.
 */
export function pickColumns<T extends object, K extends readonly [keyof T, ...(keyof T)[]]>(
  t: T,
  keys: K,
): [T[K[number]], ...T[K[number]][]] {
  const [first, ...rest] = keys;
  return [t[first], ...rest.map((k) => t[k])];
}

/**
 * Column names of `oe_staged_action_idem_uq`. The index (below) and `ON CONFLICT` (stagedRepo) share this copy.
 * It is the direct stop for that "every agent proposal returned 500" — the reason is in `pickColumns`.
 */
export const STAGED_ACTION_IDEM_KEYS = ["tenantId", "module", "billId", "transitionCode", "idempotencyKey"] as const;

/** Column names of `oe_handoff_task_open_uq`. The index and `ON CONFLICT` (handoffRepo) share them. */
export const HANDOFF_TASK_OPEN_KEYS = ["tenantId", "module", "billId", "handoffId"] as const;

/**
 * The **partial-index predicate** of `oe_handoff_task_open_uq`, shared by the index and `ON CONFLICT`.
 *
 * 🔴 `ON CONFLICT` on a partial index must write the predicate with it, or PostgreSQL cannot tell which index to use.
 * A predicate drifts more easily than a column group: writing it wrong **does not error**, it only makes dedup fail silently — when a document is returned and submitted again
 * the recipient starts seeing seven identical todos, with zero errors on either side.
 *
 * 🔴 It takes a **column** rather than a hardcoded `sql`status = 'open'`: a bare column name makes drizzle generate
 * `WHERE status = 'open'` while the index in the database is `WHERE "oe_handoff_task"."status" = 'open'`,
 * so a column-name diff in the kit produces a fake change of "drop the index and create it back the same"
 * (confirmed by measurement). The function form also avoids an init-time cycle where a constant and the table definition reference each other.
 */
export function handoffTaskOpenPredicate(t: { readonly status: SQLWrapper }): SQL {
  return sql`${t.status} = 'open'`;
}

// ── code sequence ──────────────────────────────────────────────────────────────

/**
 * Code sequence number — increments by (tenant, prefix, sequence segment).
 *
 * The code shape is owned solely by the metamodel's `formatCode`, and the sequence segment solely by `codePeriod`.
 * This table stores only the counter, not the format, and not a "rule" — a rule center is a second source of truth, and it was explicitly not built.
 *
 * 🔴 `period` is the **sequence segment**, not the business day: a document (`seqScope: "day"`) fills an 8-digit business day,
 * and master data (`seqScope: "tenant"`) fills an empty string to mean "do not cut finer". The empty string is a legal value of this dimension,
 * so both grades share one table — if this column were called `ymd`, the master-data row would be "a placeholder pretending to be a date",
 * and that is what would need a second table. The column name says what it really means, and one table is enough.
 */
export const codeSeq = pgTable(
  "oe_code_seq",
  {
    tenantId: text("tenant_id").notNull(),
    prefix: text("prefix").notNull(),
    period: text("period").notNull(),
    seq: integer("seq").notNull(),
  },
  (t) => [uniqueIndex("oe_code_seq_uq").on(t.tenantId, t.prefix, t.period)],
);

// ── local RBAC ──────────────────────────────────────────────────────────────

/** A tenant role: function permission plus data scope; assigned directly to a person. */
export const rbacRole = pgTable(
  "oe_rbac_role",
  {
    id: text("id").primaryKey(),
    ...isolation,
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    unique("oe_rbac_role_tenant_id_uq").on(t.tenantId, t.id),
    uniqueIndex("oe_rbac_role_code_uq").on(t.tenantId, t.code),
    check("oe_rbac_role_kind_ck", sql`${t.kind} in ('preset', 'custom')`),
    check("oe_rbac_role_status_ck", sql`${t.status} in ('active', 'disabled')`),
  ],
);

/**
 * One RoleGrant per row. Exactly one of module and system_key is non-null.
 *
 * The unique index does not write NULLS NOT DISTINCT: a system row has an empty module, and a module row has an empty system_key,
 * PostgreSQL treats NULLs as not equal to each other by default, and only then do the two indexes not block several system grants or module grants of the same role.
 * SQL null in the scope column means "the whole module", not an empty condition group.
 */
export const rbacRoleGrant = pgTable(
  "oe_rbac_role_grant",
  {
    id: text("id").primaryKey(),
    ...isolation,
    roleId: text("role_id").notNull(),
    module: text("module"),
    systemKey: text("system_key"),
    actions: jsonb("actions").$type<readonly ModulePermissionAction[] | null>(),
    buttons: jsonb("buttons").$type<"all" | readonly string[] | null>(),
    fields: jsonb("fields").$type<"all" | { readonly except: readonly string[] } | null>(),
    scope: jsonb("scope").$type<readonly (readonly ScopeCondition[])[] | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_rbac_role_grant_module_uq").on(t.tenantId, t.roleId, t.module),
    uniqueIndex("oe_rbac_role_grant_system_uq").on(t.tenantId, t.roleId, t.systemKey),
    index("oe_rbac_role_grant_role_idx").on(t.tenantId, t.roleId),
    foreignKey({
      columns: [t.tenantId, t.roleId],
      foreignColumns: [rbacRole.tenantId, rbacRole.id],
      name: "oe_rbac_role_grant_tenant_role_fk",
    }).onDelete("restrict"),
    check(
      "oe_rbac_role_grant_axis_ck",
      sql`(
        (${t.module} is not null and ${t.systemKey} is null)
        or (${t.module} is null and ${t.systemKey} is not null)
      )`,
    ),
    check(
      "oe_rbac_role_grant_module_payload_ck",
      sql`${t.module} is null or (
        case
          when jsonb_typeof(${t.actions}) = 'array' then jsonb_array_length(${t.actions}) > 0
          else false
        end
        and ${t.buttons} is not null
        and ${t.fields} is not null
      )`,
    ),
    check(
      "oe_rbac_role_grant_system_payload_ck",
      sql`${t.systemKey} is null or (
        ${t.actions} is null
        and ${t.buttons} is null
        and ${t.fields} is null
        and ${t.scope} is null
      )`,
    ),
  ],
);

/** A validity binding from a platform subject to a role. The data scope lives on the role, not on the assignment row. */
export const rbacAssignment = pgTable(
  "oe_rbac_assignment",
  {
    id: text("id").primaryKey(),
    ...isolation,
    subjectId: text("subject_id").notNull(),
    roleId: text("role_id").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    /** Revocation is an indelible end of the relationship; a later assignment only marks the revocation, and never physically deletes the row. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    index("oe_rbac_assignment_subject_role_idx").on(t.tenantId, t.subjectId, t.roleId),
    index("oe_rbac_assignment_subject_idx").on(t.tenantId, t.subjectId, t.validFrom),
    check("oe_rbac_assignment_window_ck", sql`${t.validUntil} is null or ${t.validUntil} > ${t.validFrom}`),
    foreignKey({
      columns: [t.tenantId, t.roleId],
      foreignColumns: [rbacRole.tenantId, rbacRole.id],
      name: "oe_rbac_assignment_tenant_role_fk",
    }).onDelete("restrict"),
  ],
);

/**
 * Platform subject × organization. Personnel authorization and the organization-page members write the same table.
 * When a worker is attached to a team, the hook only upserts that pair, and does not mark a separate source.
 */
export const orgAffiliation = pgTable(
  "oe_org_affiliation",
  {
    id: text("id").primaryKey(),
    ...isolation,
    subjectUserId: text("subject_user_id").notNull(),
    resourceId: text("resource_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_org_affiliation_uq").on(t.tenantId, t.subjectUserId, t.resourceId),
    index("oe_org_affiliation_user_idx").on(t.tenantId, t.subjectUserId),
    index("oe_org_affiliation_org_idx").on(t.tenantId, t.resourceId),
  ],
);

/**
 * Independent client applications a platform subject may enter. It is orthogonal to role permission: the role decides business capability,
 * and this table only decides which independent application can be entered after login. One tenant subject has at most one active entry;
 * revocation keeps the history row, and assigning again after unbinding inserts a new fact.
 */
export const applicationAssignment = pgTable(
  "oe_application_assignment",
  {
    id: text("id").primaryKey(),
    ...isolation,
    subjectId: text("subject_id").notNull(),
    applicationCode: text("application_code").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    assignedBy: text("assigned_by").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
  },
  (t) => [
    uniqueIndex("oe_application_assignment_active_uq")
      .on(t.tenantId, t.subjectId)
      .where(sql`${t.revokedAt} is null`),
    index("oe_application_assignment_subject_idx").on(t.tenantId, t.subjectId, t.applicationCode),
    index("oe_application_assignment_app_idx").on(t.tenantId, t.applicationCode, t.assignedAt),
    check("oe_application_assignment_revoke_ck", sql`(
      (${t.revokedAt} is null and ${t.revokedBy} is null)
      or (${t.revokedAt} is not null and ${t.revokedBy} is not null)
    )`),
  ],
);

/**
 * The authorization-commit fact that corresponds to one session confirmation.
 *
 * `idempotency_key` guarantees a network retry does not execute twice; `approval_call_id` guarantees one approval proof can be consumed only once.
 * The proof itself is not stored, only an irreversible fingerprint, so the credential never enters the audit or operations query surface.
 */
export const rbacChangeSet = pgTable(
  "oe_rbac_change_set",
  {
    id: text("id").primaryKey(),
    ...isolation,
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    approvalCallId: text("approval_call_id").notNull(),
    approvalProofHash: text("approval_proof_hash").notNull(),
    baseVersion: text("base_version").notNull(),
    result: jsonb("result").notNull(),
    actorId: text("actor_id").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_rbac_change_set_idem_uq").on(t.tenantId, t.idempotencyKey),
    uniqueIndex("oe_rbac_change_set_approval_uq").on(t.tenantId, t.approvalCallId),
    index("oe_rbac_change_set_actor_idx").on(t.tenantId, t.actorId, t.appliedAt),
  ],
);

/** Append-only trace of an RBAC configuration change. Authorization history cannot be inferred backward from the current configuration. */
export const rbacAudit = pgTable(
  "oe_rbac_audit",
  {
    id: text("id").primaryKey(),
    ...isolation,
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oe_rbac_audit_target_idx").on(t.tenantId, t.targetType, t.targetId, t.at),
    index("oe_rbac_audit_actor_idx").on(t.tenantId, t.actorId, t.at),
  ],
);

// ── tenant choice sets ──────────────────────────────────────────────────────────

/**
 * The optimistic-lock revision of one product-declared choice set under a tenant.
 *
 * Product code / label / default items are not stored; when the tenant has not changed anything, even this row does not exist, and revision=0 is projected by the repository.
 * The first change inserts revision=1, and each later change adds 1 atomically. Product metadata therefore always has the code as its one source of truth.
 */
export const choiceSetState = pgTable(
  "oe_choice_set_state",
  {
    ...isolation,
    choiceSetCode: text("choice_set_code").notNull(),
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_choice_set_state_uq").on(t.tenantId, t.choiceSetCode),
    check("oe_choice_set_state_revision_ck", sql`${t.revision} >= 1`),
  ],
);

/**
 * A tenant's override of a product default item, and an item the tenant added itself.
 *
 * A nullable column on a preset row expresses only a dimension that is really overridden; null means keep following the next product default.
 * A custom row must have a complete label/sort/status. Once a code is written there is no update or delete path for it.
 */
export const choiceSetItem = pgTable(
  "oe_choice_set_item",
  {
    id: text("id").primaryKey(),
    ...isolation,
    choiceSetCode: text("choice_set_code").notNull(),
    itemCode: text("item_code").notNull(),
    source: text("source").notNull(),
    label: text("label"),
    sortOrder: integer("sort_order"),
    status: text("status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_choice_set_item_uq").on(t.tenantId, t.choiceSetCode, t.itemCode),
    index("oe_choice_set_item_lookup_idx").on(t.tenantId, t.choiceSetCode, t.sortOrder),
    check("oe_choice_set_item_source_ck", sql`${t.source} in ('preset', 'custom')`),
    check("oe_choice_set_item_status_ck", sql`${t.status} is null or ${t.status} in ('active', 'disabled')`),
    check("oe_choice_set_item_sort_ck", sql`${t.sortOrder} is null or ${t.sortOrder} >= 0`),
    check(
      "oe_choice_set_item_custom_complete_ck",
      sql`${t.source} <> 'custom' or (${t.label} is not null and ${t.sortOrder} is not null and ${t.status} is not null)`,
    ),
  ],
);

/** Append-only trace of choice-set maintenance; before/after stores the complete effective-item projection at that time. */
export const choiceSetAudit = pgTable(
  "oe_choice_set_audit",
  {
    id: text("id").primaryKey(),
    ...isolation,
    choiceSetCode: text("choice_set_code").notNull(),
    itemCode: text("item_code").notNull(),
    action: text("action").notNull(),
    revision: integer("revision").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oe_choice_set_audit_set_idx").on(t.tenantId, t.choiceSetCode, t.at),
    index("oe_choice_set_audit_actor_idx").on(t.tenantId, t.actorId, t.at),
    check("oe_choice_set_audit_action_ck", sql`${t.action} in ('item.add', 'item.update')`),
    check("oe_choice_set_audit_revision_ck", sql`${t.revision} >= 1`),
  ],
);

// ── periods ──────────────────────────────────────────────────────────────────
/**
 * Accounting period — the definition of which period a ledger row belongs to. Meaning and resolution rules are in `metamodel/period.ts`.
 *
 * The current stage delivers only **belonging**: at install each sub-book gets one `open` period that is not closed, so a user who does not close books
 * notices nothing, and not one ledger row is missed. Close-period actions / period-end checks / snapshots / period reports are **not built yet**.
 *
 * Why this table exists now: the ledger's `posting_period` is a **decision**, not a computation, and it cannot be filled in later
 * (the only guess is `occurred_at`, and back-dated rows and cross-period reversals are exactly the rows that need this column).
 *
 * 🔴 `code` is **free text**, not a date format: a fiscal year does not have to start in January, retail uses a 4-4-5 week calendar
 * (one "month" is 28 or 35 days), and some enterprises have 13 periods a year. The shape is expressed by start_at/end_at,
 * and fixing a format for code would be a second source of truth. It is unrelated to `oe_code_seq.period` (the sequence segment); the two words are not shared.
 *
 * 🔴 The interval is stored as a half-open timestamptz [start_at, end_at), not as a date: when the period is created, OE_TIMEZONE
 * turns "1 March 00:00 Shanghai" into an instant, and every later comparison happens on the time axis — otherwise cutting periods by the container TZ (usually UTC)
 * silently posts a Shanghai early-shift document of 1 April into March. A closed interval would make the last instant of the period belong to two periods.
 *
 * 🔴 `seq` is the period order, not a serial number: "prior period end = this period opening" is a chain, and ordered closing depends on it.
 * Sorting by code does not hold for a shape such as '2026-W05'. Closing is not built yet, but this column has to be right now.
 */
export const period = pgTable(
  "oe_period",
  {
    id: text("id").primaryKey(),
    ...isolation,

    /** PERIOD_BOOKS: finance / inventory. Inventory closes after the count, finance closes after the books agree, and the two boundaries do not line up. */
    book: text("book").notNull(),
    code: text("code").notNull(),
    seq: integer("seq").notNull(),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    /** PERIOD_STATUSES：open / closed */
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("oe_period_code_uq").on(t.tenantId, t.book, t.code),
    // Period order is unique within a sub-book. Without it two periods can share one order, and "the previous period" has no answer.
    uniqueIndex("oe_period_seq_uq").on(t.tenantId, t.book, t.seq),
    // Belonging resolution: take every period by (tenant, sub-book), and periodOf computes it in the kernel.
    index("oe_period_lookup_idx").on(t.tenantId, t.book, t.startAt),
  ],
);

// ── ledger ──────────────────────────────────────────────────────────────────

/**
 * Posting ledger — **the only source of truth for a balance**.
 *
 * 🔴 Append-only: insert, never update, never delete. A reversal does not change or delete the original row; it **records another row in the opposite direction**,
 * and `reversalOf` points back at the row being reversed.
 * Allowing a row to be changed allows history to be rewritten: when the books do not agree there is no way to tell whether the business was wrong or someone edited it.
 *
 * Balance = a sum of this table. There is no balance table and no stored balance column — storing a copy means one day it will disagree with the journal,
 * and nobody will know which to trust.
 *
 * ── subject × scope ──────────────────────────────────────────────────────
 * Whose account this hangs on. Most targets are one-dimensional:
 *   ar / ap → subject = customer / supplier
 *   gl      → subject = account
 * Only inventory is two-dimensional:
 *   stock   → subject = product, scope = warehouse
 *
 * Why not compose one `subjectKey` text (`product:P1|warehouse:W1`):
 * "how much stock does the Shanghai warehouse have in total" must aggregate by warehouse, and after composing the string the warehouse is not a prefix, so an index cannot use it.
 * Why not call it `subjectId2`: the second dimension of the two is a **scope**, not a second subject, and the name has to say what it is.
 */
export const effectLedger = pgTable(
  "oe_effect_ledger",
  {
    id: text("id").primaryKey(),
    ...isolation,

    /** Posting destination: a ledger-catalog code, not a kernel enum. */
    target: text("target").notNull(),
    /** EFFECT_OPS：reserve / release / in / out */
    op: text("op").notNull(),
    /** Amount or quantity. Inventory records a quantity, the rest record money — the unit is decided by the target, and they are not converted inside one column. */
    amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),

    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    /** Null on a one-dimensional target. On stock it **must** have a value, or "which warehouse" has no answer. */
    scopeType: text("scope_type"),
    scopeId: text("scope_id"),

    /** Which document and which edge posted this ledger row. */
    sourceModule: text("source_module").notNull(),
    sourceId: text("source_id").notNull(),
    /** A ledger posted by line (inventory) points at the concrete line; a header-level posting is null. */
    sourceLineId: text("source_line_id"),
    transitionCode: text("transition_code").notNull(),

    /** Which row this reverses. null = a forward posting. */
    reversalOf: text("reversal_of"),

    /**
     * Belonging period (`oe_period.code`) — which period this ledger row is recorded in.
     *
     * 🔴 **It and `occurred_at` are two independent time axes, and they may legally disagree.**
     * Back-entering a 30 March document in April, or reversing a ledger row of an already closed period: the fact happened in March (`occurred_at`
     * is written as it was, and must not be falsified), and the ledger is recorded in April (this period's correction of a prior-period error). Forcing
     * `period = f(occurred_at)` means the only way to record the ledger in March is to lie about the date —
     * falsifying the fact to satisfy a belonging rule is much worse than one extra column.
     *
     * 🔴 **NOT NULL, with no exception.** Nullable would create a batch of rows that "belong to no period", and every period query after that
     * would have to carry `or posting_period is null`, and **omitting it does not error** — the same reason `oe_audit_log.module`
     * cannot relax NOT NULL. The column means "which period this ledger row is registered in", and that holds for every row;
     * which sub-books the close gate blocks is the business of `EFFECT_PERIOD_BOOK`, and is not expressed by a null in this column.
     *
     * Store `code` rather than `period.id`: the ledger is append-only, and a person reading it asks "which period".
     * Storing the id would make every period query join, and code is already unique within tenant × sub-book.
     *
     * The current stage has **no reader**: closing, period reports, and snapshots are not built yet. That is not an omission —
     * this column is stored first because it cannot be filled in later, and the rest costs the same to add later.
     */
    postingPeriod: text("posting_period").notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (t) => [
    // A balance uses this one: aggregate by tenant + target + subject + scope.
    index("oe_effect_ledger_balance_idx").on(t.tenantId, t.target, t.subjectId, t.scopeId),
    // "This period's movement" — period reports and (later) the period-end snapshot use this.
    index("oe_effect_ledger_period_idx").on(t.tenantId, t.postingPeriod, t.target, t.subjectId, t.scopeId),
    // "Which ledger rows did this document post" — the document detail page and reversal both need it.
    index("oe_effect_ledger_source_idx").on(t.tenantId, t.sourceModule, t.sourceId),
    // 🔴 A row can be reversed only once. Without this, clicking reverse again reverses the ledger twice,
    // and afterward the balance looks like "a correct negative", which is very hard to notice.
    uniqueIndex("oe_effect_ledger_reversal_uq").on(t.reversalOf),
    // 🔴 The (target, op) CHECK is written in the 0000 baseline (the predicate is generated by effectLedgerOpSignedCheckPredicate).
    // The catalog does not exist yet at import time, so the table definition cannot call the generator — the same-source gate compares the migration / snapshot after the catalog is loaded.
  ],
);

// ── document references ──────────────────────────────────────────────────────────────

/**
 * A reference between documents (produced by push-down).
 *
 * Why not just put a `sourceId` column on the downstream document: one issue document can reference many lines of many orders,
 * and one column cannot hold that; and "who referenced this order" must be looked up in reverse, which a column has no index direction for.
 *
 * 🔴 `tgtLineId` is unique: one target line can come from only one source line. Without this constraint,
 * the same order line referenced by two issue lines would count the shipped quantity twice — and both lines would look legal.
 */
export const reference = pgTable(
  "oe_reference",
  {
    id: text("id").primaryKey(),
    ...isolation,

    srcModule: text("src_module").notNull(),
    srcId: text("src_id").notNull(),
    /** A line-level reference (stage 5). Null when the whole document is referenced. */
    srcLineId: text("src_line_id"),

    tgtModule: text("tgt_module").notNull(),
    tgtId: text("tgt_id").notNull(),
    tgtLineId: text("tgt_line_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (t) => [
    index("oe_reference_src_idx").on(t.tenantId, t.srcModule, t.srcId),
    index("oe_reference_tgt_idx").on(t.tenantId, t.tgtModule, t.tgtId),
    uniqueIndex("oe_reference_tgt_line_uq").on(t.tgtLineId),
  ],
);

// ── handoff ──────────────────────────────────────────────────────────────────

/**
 * ④ A runtime instance of a Handoff: todo / notify / remind.
 *
 * One handoff declaration is at once "who should do the work", "who should know", and "when to chase" — the three compile into this one table,
 * and three tables are not built. `kind` distinguishes the nature, and `dueAt` has a value only on remind.
 *
 * `toRole` stores a **position role**, not a person: people leave and transfer, and a todo should not disappear with them.
 * The recipient is resolved by role at read time — when it cannot be resolved, fail-closed (nobody receives it, and it errors),
 * with no fallback of "send it to the creator by default": a fallback would hide a misconfigured role forever.
 */
export const handoffTask = pgTable(
  "oe_handoff_task",
  {
    id: text("id").primaryKey(),
    ...isolation,

    /** The declaration-side handoff.id, pointing back at which declaration produced it. */
    handoffId: text("handoff_id").notNull(),
    /** HANDOFF_KINDS：todo / notify / remind */
    kind: text("kind").notNull(),

    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    toRole: text("to_role").notNull(),
    title: text("title").notNull(),

    /** Present only on remind. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** open / done / cancelled */
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: text("done_by"),
  },
  (t) => [
    // "My todos" — the highest-frequency query.
    index("oe_handoff_task_inbox_idx").on(t.tenantId, t.toRole, t.status),
    index("oe_handoff_task_bill_idx").on(t.tenantId, t.module, t.billId),
    // 🔴 One document plus one declaration hangs only one **unfinished** task:
    // flipping a document's status back and forth would generate the same todo over and over, and the recipient would see seven identical ones.
    // It must be a **partial** unique index — finished history todos may be many (done, returned, done again is legal),
    // and without the where the second generation of the same todo would be rejected by the database, which is normal business.
    uniqueIndex("oe_handoff_task_open_uq")
      .on(...pickColumns(t, HANDOFF_TASK_OPEN_KEYS))
      .where(handoffTaskOpenPredicate(t)),
  ],
);

// ── staged actions ────────────────────────────────────────────────────────────

/**
 * An action an agent proposed, waiting for a person to confirm.
 *
 * 🔴 This table is where the hard rule in `AGENTS.md` lands:
 * when `bill_propose` chooses the human-governance mode it only produces a staged draft, and a person confirming it on the screen is what writes it.
 * Direct mode takes the same runtime's create / update / execute, and does not pass through this table.
 *
 * The write path is therefore two segments:
 *   agent → propose (writes this table, and does not touch business data)
 *   person → confirm (goes evaluate → execute, and really writes)
 *
 * Why store the whole `decision`: confirmation often happens minutes or even hours later, and the document may already have changed.
 * What the person sees on confirm must be **the judgment computed at propose time**, and it must be re-evaluated and compared once before execution —
 * without the comparison, "the approver saw A, and what was written is B" happens, and that kind of incident cannot be reproduced afterward.
 *
 * `idempotencyKey` is unique: model retries are normal (timeout, context truncation, self-doubt),
 * and without this constraint one "review" becomes three staged actions, and a person still has to tell which one is real.
 *
 * 🔴 But the uniqueness coordinate is the **whole group** (tenant × module × document × edge × key), not the key alone.
 * Unique on the key alone, two documents each proposing with a key such as `"retry-1"`, and the second **silently hits the first** —
 * the model receives an id and believes its action is already in the inbox, while the person sees a different document.
 * Same shape as `oe_audit_log_idem_uq`: that side was decided this way early, and the two drifting would produce no error.
 */
export const stagedAction = pgTable(
  "oe_staged_action",
  {
    id: text("id").primaryKey(),
    ...isolation,

    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    transitionCode: text("transition_code").notNull(),
    /** Parameters declared on this edge. */
    params: jsonb("params").notNull(),

    /** The full TransitionDecision at propose time (verdict + checks + plan). */
    decision: jsonb("decision").notNull(),
    /** The source document's optimistic-lock revision at propose time. An old todo is null, and must not be forged as revision=1. */
    proposedRevision: integer("proposed_revision"),
    /** The full plan a person is about to confirm when the Planner proposed it; null for an ordinary transition. */
    executionPlan: jsonb("execution_plan"),
    /** SHA-256 of decision + executionPlan. It appears as a pair with executionPlan. */
    planFingerprint: text("plan_fingerprint"),

    /** Who proposed it. An agent proposal records the agent identity; a person operating directly on the screen does not enter this table. */
    proposedBy: text("proposed_by").notNull(),
    proposedAt: timestamp("proposed_at", { withTimezone: true }).notNull().defaultNow(),
    /** The reason the model gave in natural language. This is what a person reads before confirming. */
    reason: text("reason").notNull(),

    /** pending / confirmed / rejected / expired */
    status: text("status").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),
    /** Rejection reason; null when confirmed. */
    rejectReason: text("reject_reason"),

    /** 🔴 Model retries are normal; without it one review becomes three staged actions. */
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (t) => [
    index("oe_staged_action_inbox_idx").on(t.tenantId, t.status, t.proposedAt),
    index("oe_staged_action_bill_idx").on(t.tenantId, t.module, t.billId),
    uniqueIndex("oe_staged_action_idem_uq").on(...pickColumns(t, STAGED_ACTION_IDEM_KEYS)),
    check(
      "oe_staged_action_plan_pair_ck",
      sql`((${t.executionPlan} is null and ${t.planFingerprint} is null) or (${t.executionPlan} is not null and ${t.planFingerprint} is not null and ${t.planFingerprint} ~ '^[0-9a-f]{64}$'))`,
    ),
  ],
);

// ── audit ──────────────────────────────────────────────────────────────────

/**
 * The trace of each state-machine execution.
 *
 * Store the full `checks`, not only the conclusion: what accountability asks afterward is never "did it pass", it is
 * "what number did that inventory check see at the time". Storing only the conclusion leaves that question forever unanswerable.
 *
 * Division of labor with the ledger: the ledger is the **account** (the balance is summed from it), and the audit is **why the account is so**.
 * The account must be summable on its own, so they are not combined into one table.
 *
 * 🔴 The subject is a **document**: every row points back at one document (`module` / `billId` are both NOT NULL).
 * An agent calling a tool once is an event of another layer, recorded in `agentCall`, and is not stuffed into this table —
 * the reason is in that table's comment.
 */
export const auditLog = pgTable(
  "oe_audit_log",
  {
    id: text("id").primaryKey(),
    ...isolation,

    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    transitionCode: text("transition_code").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    /** pass / hint / warn / route / block */
    verdict: text("verdict").notNull(),

    /** Parameters of this action (the TransitionParam values). */
    params: jsonb("params").notNull(),
    /** The full CheckReport[]. */
    checks: jsonb("checks").notNull(),

    actorId: text("actor_id").notNull(),
    /** Central policy version; the migration writes an explicit legacy marker for history rows, and it is forced non-null after that. */
    policyVersion: text("policy_version").notNull(),
    /** Central decision id; the migration writes an explicit legacy marker for history rows, and it is forced non-null after that. */
    decisionId: text("decision_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),

    /**
     * Idempotency key. **Nullable** — a person clicking a button on the screen does not carry it; only a programmatic call (agent, retry, push-down) does.
     *
     * 🔴 It lives on the audit table rather than a separate dedup table because the fact "did this edge already run"
     * already lives in the audit. Building another table is a second recording point for the same fact,
     * and the two will one day disagree — at which point "did it actually execute" cannot be answered.
     */
    idempotencyKey: text("idempotency_key"),
    /** The full plan the user saw when a Planner transition executed; null for an ordinary transition. */
    executionPlan: jsonb("execution_plan"),
    /** SHA-256 of the source transition decision + the canonical ExecutionPlan. It appears as a pair with executionPlan. */
    planFingerprint: text("plan_fingerprint"),
  },
  (t) => [
    index("oe_audit_log_bill_idx").on(t.tenantId, t.module, t.billId, t.at),
    // A repeated request that carries a key is rejected by the database directly. NULLs are not equal to each other in a unique index,
    // so a person clicking twice by hand is not covered by this constraint — those are two real operation intents, not a replay.
    uniqueIndex("oe_audit_log_idem_uq").on(t.tenantId, t.module, t.billId, t.transitionCode, t.idempotencyKey),
    check(
      "oe_audit_log_plan_pair_ck",
      sql`((${t.executionPlan} is null and ${t.planFingerprint} is null) or (${t.executionPlan} is not null and ${t.planFingerprint} is not null and ${t.planFingerprint} ~ '^[0-9a-f]{64}$'))`,
    ),
  ],
);

// ── Planner execution results ───────────────────────────────────────────────────────

/**
 * The stable commandId of a createBill in an ExecutionPlan -> the actual database document id.
 *
 * auditLog stores the logical plan the user saw; this table stores the result known only after execution. Both land with the business document creation in
 * the same outer transaction, and this table is append-only: when the audit idempotency key hits, it can return exactly the document actually created last time,
 * without inferring it from current business data, and without opening a second write entrance of "the caller specifies the document id" for the sake of audit.
 */
export const executionCreatedBill = pgTable(
  "oe_execution_created_bill",
  {
    id: text("id").primaryKey(),
    ...isolation,
    auditId: text("audit_id").notNull(),
    commandId: text("command_id").notNull(),
    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [
    uniqueIndex("oe_execution_created_bill_command_uq").on(t.tenantId, t.auditId, t.commandId),
    uniqueIndex("oe_execution_created_bill_ordinal_uq").on(t.tenantId, t.auditId, t.ordinal),
    index("oe_execution_created_bill_bill_idx").on(t.tenantId, t.module, t.billId),
    check("oe_execution_created_bill_ordinal_ck", sql`${t.ordinal} >= 0`),
  ],
);

// ── saved views ──────────────────────────────────────────────────────────────

/**
 * A list view a user saved: query + column layout. Corresponds to the metamodel's `SavedView`.
 *
 * 🔴 `columns` stores the **diff**, not the whole column list (see the comment in packages/metamodel/src/normalize/query.ts).
 * Storing the whole list means that after a field is added to the module, every old user who saved a view never sees it,
 * and there is no error — the promise "changing the schema changes the screen" fails silently.
 *
 * `ownerId` null = a shared view.
 */
export const savedView = pgTable(
  "oe_saved_view",
  {
    id: text("id").primaryKey(),
    ...isolation,

    module: text("module").notNull(),
    name: text("name").notNull(),
    /** null = a shared view */
    ownerId: text("owner_id"),

    /** The metamodel Query structure, serialized as-is. **SQL is not stored.** */
    query: jsonb("query").notNull(),
    /** ColumnOverride[] */
    columns: jsonb("columns").notNull(),

    sortOrder: integer("sort_order").notNull(),
    isDefault: boolean("is_default").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oe_saved_view_owner_idx").on(t.tenantId, t.module, t.ownerId),
    // One person cannot have two same-named views under one module — there is no way to tell them apart when switching views.
    uniqueIndex("oe_saved_view_name_uq").on(t.tenantId, t.module, t.ownerId, t.name),
    // 🔴 One person has at most one **default** view under one module: when two are both marked default,
    // "which one do you see when the list opens" has no definite answer, and each record looks legal on its own.
    //
    // It must be a **partial** unique index: without the where, one person could have only one view.
    // Clearing on write (savedViewRepo.save) solves correctness inside one request; this index solves concurrency —
    // when two people set the default at once, "clear first, then write" holds inside each transaction, and only the database can stop it.
    //
    // `coalesce(owner_id, '')` rather than the column directly: NULLs are not equal to each other in a unique index,
    // and a null ownerId is exactly a shared view — without folding, "the department-wide default view" can exist in any number.
    uniqueIndex("oe_saved_view_default_uq")
      .on(t.tenantId, t.module, sql`coalesce(${t.ownerId}, '')`)
      .where(sql`${t.isDefault}`),
  ],
);

// ── view configuration ──────────────────────────────────────────────────────────────

/**
 * User-defined view configuration — a new implementation independent of oe_saved_view.
 *
 * Storage for the front-end view-configuration feature (PRD 2026-09-14). It exists in parallel with the old oe_saved_view,
 * and they share no data. The old view uses a query + columns structure; the new view uses filters + displayFields + sortRules.
 *
 * Field notes:
 * - filters: an array of filter conditions, each containing field/operator/value/valueType
 * - displayFields: an array of display-field keys
 * - sortRules: an array of sort rules, each containing field/order/priority
 * - icon: a view icon identifier (such as "star", "trend")
 * - sortOrder: the view's display order in the tab bar
 */
export const userView = pgTable(
  "oe_user_view",
  {
    id: text("id").primaryKey(),
    ...isolation,

    status: text("status").notNull(),
    revision: integer("revision").notNull().default(1),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    code: text("code").notNull(),

    module: text("module").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    userId: text("user_id").notNull(),
    scope: text("scope").notNull().default("custom"),
    scopeUserIds: jsonb("scope_user_ids").notNull().$type<string[]>().default([]),
    scopeDeptIds: jsonb("scope_dept_ids").notNull().$type<string[]>().default([]),

    /** FilterCondition[] - filter conditions */
    filters: jsonb("filters").notNull().$type<unknown[]>(),
    /** string[] - the list of display-field keys */
    displayFields: jsonb("display_fields").notNull().$type<string[]>(),
    /** SortRule[] - sort rules */
    sortRules: jsonb("sort_rules").notNull().$type<unknown[]>(),

    /** The view's display order in the tab bar. */
    sortOrder: numeric("sort_order", { precision: 18, scale: 6 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oe_user_view_user_module_idx").on(t.tenantId, t.module, t.userId),
    uniqueIndex("oe_user_view_code_uq").on(t.tenantId, t.code),
    // The same user cannot have a same-named view under the same module.
    uniqueIndex("oe_user_view_name_uq").on(t.tenantId, t.module, t.userId, t.name),
  ],
);

/**
 * A user's personal tab-bar view order under one module.
 *
 * Separate from oe_user_view.sort_order (the creator-side default order): a user who received a share can adjust their own tab order,
 * without rewriting the global sort_order on the shared view row. Never having saved means there is no row (legal; list falls back to sort_order).
 */
export const userViewTabOrder = pgTable(
  "oe_user_view_tab_order",
  {
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    module: text("module").notNull(),
    /** string[] - the complete display order of visible view ids */
    orderedIds: jsonb("ordered_ids").notNull().$type<string[]>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "oe_user_view_tab_order_pk", columns: [t.tenantId, t.userId, t.module] }),
  ],
);

// ── query-surface row and column layout ────────────────────────────────────────────────────────

/**
 * The row/column dimensions a user saved on one cross-query surface. Never having saved means there is no row (legal, not a missing default).
 *
 * There is no org_id: the layout follows the person, not the organization. Isolation is only tenant_id (`scopedWhere`).
 */
export const surfacePreference = pgTable(
  "oe_surface_preference",
  {
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    surfaceCode: text("surface_code").notNull(),
    config: jsonb("config").notNull().$type<{ readonly rowDims: readonly string[]; readonly colDim: string | null }>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "oe_surface_preference_pk", columns: [t.tenantId, t.userId, t.surfaceCode] }),
  ],
);

// ── tenant skills ────────────────────────────────────────────────────────────

/**
 * A business procedure (SKILL.md) a tenant administrator uploaded at **runtime**.
 *
 * 🔴 **It is not a move of `domains/<domain>/skills/*.md`; it is another axis.** Both are called skill, but the criterion
 * "does it go into code or into the DB" puts them on two sides. The criterion's original wording is in `AGENTS.md`:
 * *Was this row produced by business activity, or written by a developer?*
 *
 * | | In-repo playbook `domains/<domain>/skills/` | This table |
 * |---|---|---|
 * | Who writes it | Developer / FDE | The tenant's administrator (business side) |
 * | When it changes | Ships with a branch | Changes when the business rule changes (a new supplier policy, a new approval floor) |
 * | Tenant axis | **None** (`LoadedSkill` has not one tenant field; process-level) | Present, and required |
 * | Takes effect | Frozen at process start (`loadCatalog` runs once) | The next query |
 *
 * Three **structural** facts pin that it cannot take the code route (this is not taste): (1) the code route has no tenant axis,
 * and one deployment serves several tenants by the identity gateway `orgCode` ⇒ writing it into `domains/` is visible to every tenant, which is an isolation incident;
 * (2) `loadCatalog` runs only once in `main.ts`, so "takes effect immediately after upload" is structurally impossible on the file route,
 * and that write inside the container disappears when the pod is recreated, with zero errors; (3) this capability wants "the user uploads it, it takes effect immediately,
 * and deleting it makes it disappear", and making it a code source stuffs the release process into one user operation.
 *
 * 🔴 **It does not manufacture a second schema source of truth** (that is exactly why `oe_meta_*` was retired):
 * it declares no fields / lifecycle / handoff / preconditions / views, it does not enter `MODULE_KEYS`,
 * it generates no table or column, it joins no gate, and it **does not affect `catalogDigest`** (the digest is computed only from the permission catalog).
 * Its authority is zero — **a skill is knowledge, not permission**. Writing one wrong can mislead the model, and cannot make the model do something its identity
 * could not already do (execution still passes the Authorizer on every call). The same-shaped precedent is `oe_saved_view`:
 * also something a user stored at runtime, also isolated by tenant, also not the metamodel.
 *
 * 🔴 `content` stores the **full SKILL.md** (frontmatter kept with it), the same rule as `LoadedSkill.content`:
 * metadata of the catalog path and the full-text path must come from one parse of one text.
 * The metadata columns (`description` / `version` / `wire_version` / `trigger_words`) are that parse's
 * **projection**, not a second source of truth — they exist only so a catalog query does not select the body column (the catalog is on the critical path of every
 * query, and the body is kilobytes). The write entrance is the only write path, so the two are necessarily the same source.
 *
 * 🔴 `wire_version` is stored as a column rather than computed each time: it is half of the key of the other side's `bodyCache`,
 * and it must be `<declared version>+<full-text fingerprint>` — the reason is word-for-word the same as `LoadedSkill.wireVersion`.
 */
export const agentSkill = pgTable(
  "oe_agent_skill",
  {
    id: text("id").primaryKey(),
    ...isolation,

    /** `^[a-z0-9][a-z0-9-]{0,63}$`, and also the path segment of `GET /api/agent/skills/:name`. */
    name: text("name").notNull(),
    /** 🔴 The one sentence that enters the model's **resident context**. The catalog budget is its sum; see `agent/skills.ts`. */
    description: text("description").notNull(),
    /** The `x.y.z` in the frontmatter. The dimension a person reads. */
    version: text("version").notNull(),
    /** `<version>+<first 8 of the full-text sha256>`. The other side caches the full text by it, and that cache has no TTL. */
    wireVersion: text("wire_version").notNull(),
    /** `string[]`. Absent means an empty array — the same rule as `LoadedSkill.triggerWords`. */
    triggerWords: jsonb("trigger_words").notNull(),
    /** The full SKILL.md. */
    content: text("content").notNull(),

    /**
     * Enabled or not.
     *
     * 🔴 When `false`, **the catalog and the full text are both withdrawn**, not merely dropped from the catalog: the difference of the two paths
     * (present in the catalog, full text unavailable) is the protocol's signal of "a host deployment incident", and here it would be the normal case.
     */
    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    // 🔴 name is unique **within a tenant**. Not globally unique: two tenants each having a `supplier-policy`
    // is completely legal, and the other side's bodyCache key carries tenantId, so buckets do not cross.
    // Colliding with an in-repo playbook is a different matter, judged at the write entrance (409) and the projection layer (in-repo wins + shown in red).
    uniqueIndex("oe_agent_skill_name_uq").on(t.tenantId, t.name),
    // Catalog query: take by (tenant, enabled), and **do not select the body column**.
    index("oe_agent_skill_enabled_idx").on(t.tenantId, t.enabled),
  ],
);

// ── agent call log ────────────────────────────────────────────────────────

/**
 * An agent called a tool once.
 *
 * 🔴 **This and `auditLog` are two layers, not two grains of the same thing.**
 *
 * | | `auditLog` | This table |
 * |---|---|---|
 * | Records | An edge was executed | An agent called a tool once |
 * | Subject | A document | The caller |
 * | Is there a document | Always | A batch of the fixed meta-tools have none (such as `ops_search` / `modules_search` / `analysis_sql`) |
 * | Answers | "Why did this document become this status" | "What did this agent see, and what did it mean to do" |
 * | Cardinality | One row per edge | Dozens of rows per session, reads the majority |
 * | Retention | A business archive, the same life as the document | Operations/security data, rolled and cleaned |
 *
 * So `auditLog`'s `module` / `bill_id` were not relaxed to nullable to share one table: the cost of that
 * is not "a bit dirty", it is that the query "this document's audit history" must carry `where module is not null` everywhere from then on,
 * and **omitting it does not error**, it only returns fewer rows; cleaning the call log would also have to use a nullable column as a type marker.
 *
 * **Append-only, and reads are recorded too**: recording only writes defaults to "a query is harmless", and an agent's read is
 * where a cross-tenant leak shows up first — when the question afterward is "what did it actually see", not recorded means it is not there.
 *
 * It joins no gate. It is a trace, not a criterion; the day history is cleaned, no business behavior changes with it.
 */
/**
 * An **immutable snapshot** of an agent tool result (the evidence channel).
 *
 * ## What it solves
 *
 * The model's return body has a 6000-character budget (`AGENT_RESULT_MAX_CHARS`), and past that it is cut to
 * the first N rows of `truncated`. So what the model holds **is already incomplete**, and it still has to tell the user the conclusion.
 * Having it restate the detail into card props is wrong twice: once because it has only half, and once because restating makes mistakes
 * (saying 48 for 480, while both numbers look reasonable).
 *
 * So it splits into two channels: **the conclusion goes through the model** (verdict / one sentence / one traceId),
 * and **the facts go through this table** (the front end fetches them directly by traceId from the same source, and the model never touches them). The two regions sit side by side,
 * and a user can check at a glance whether the model said it wrong.
 *
 * ## 🔴 Relation to the rule on `oe_agent_call.detail` (read this first)
 *
 * That column says "on success, deliberately **do not store the whole result set**……that copies business data into a table whose retention
 * is completely different". **That concern holds for this table too**; this table is not a counterexample, it was designed with it:
 *
 * | | `oe_agent_call` | This table |
 * |---|---|---|
 * | What it is | An audit **log**: what the agent did | The **temporary evidence** of one answer: what the user saw when judging |
 * | Retention | Follows the log (long) | `expires_at`, **hours**, deleted when due |
 * | Who can read it | Operations / analysis | **Only the same tenant + the same operator**, and only a point read by id |
 * | Will it be analyzed | Yes | No, and it should not be — it has no enumerable search surface |
 *
 * In other words: that rule opposes "sinking business data into a long-lived, analyzable, operations-facing table".
 * This table is short-lived, point-read, and bound to the operator, precisely so it does not become that thing.
 * 🔴 **Before changing this table, answer: is it growing into a log?** Adding a search index, widening the reader,
 * or lengthening the TTL — any one of the three is a step in that direction.
 */
export const agentEvidence = pgTable(
  "oe_agent_evidence",
  {
    /** `t_<hex>`. Short, pasteable, and passable as-is inside a conversation — the model only has to copy this cell. */
    id: text("id").primaryKey(),
    ...isolation,

    /**
     * Only this person can read it.
     *
     * 🔴 Not "readable by the same tenant": the evidence of one conversation belongs to the person who asked. Widening it to the tenant
     * means anyone who obtains a traceId (it appears in conversation records, logs, and screenshots) can read another person's
     * business data inside that query's range — and that data's row-level visibility was computed **at fetch time** from the asker's identity.
     */
    actorId: text("actor_id").notNull(),

    /** Which tool produced it. Rendering shows the person "where this data came from". */
    tool: text("tool").notNull(),
    /** A one-sentence summary, shown in the card header. */
    summary: text("summary").notNull(),

    /** The snapshot body: `{columns?, rows, title?, …}`. **Complete**, not cut by the return budget. */
    evidence: jsonb("evidence").notNull(),

    /** The instant the data was fetched. What audit wants is "what was seen when the judgment was made", so it must be shown. */
    dataAt: timestamp("data_at", { withTimezone: true }).notNull().defaultNow(),
    /** Unreadable once due. Cleanup is a batch delete by `reapEvidence`, and each read path judges it once too. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // Only this one index, and it serves cleanup only.
    // 🔴 **Do not** add a search index by tool / actor: that turns a point-read table into an enumerable data set,
    // which is becoming the column in the table above that it "must not become".
    index("oe_agent_evidence_reap_idx").on(t.expiresAt),
  ],
);

/**
 * The cross-replica trace of one agent round (`X-Host-Request-Id`).
 *
 * Each tool call of the agent host is an independent short HTTP, and kube-proxy scatters them across Pods.
 * "This round already matched the file" and "this round's table_commit already succeeded", if they live only in a process Map,
 * the next hop misses blocking a same-argument replay of table_commit. This is not a log, and a search surface is forbidden.
 *
 * TTL 30 minutes, the same order of magnitude as one conversation round staying alive. The loop-gate counter stays in-process — that gate is already closed on the call side.
 */
export const ROUND_INTAKE_TTL_MS = 30 * 60 * 1000;

export const agentRoundMatch = pgTable(
  "oe_agent_round_match",
  {
    ...isolation,
    requestId: text("request_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_agent_round_match_uq").on(t.tenantId, t.requestId),
    index("oe_agent_round_match_reap_idx").on(t.expiresAt),
  ],
);

export const agentRoundCommit = pgTable(
  "oe_agent_round_commit",
  {
    ...isolation,
    requestId: text("request_id").notNull(),
    signature: text("signature").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_agent_round_commit_uq").on(t.tenantId, t.requestId, t.signature),
    index("oe_agent_round_commit_reap_idx").on(t.expiresAt),
  ],
);

/**
 * The conversation assistant's "recipe": the read-only commands (command + arguments) it successfully got through in one **long-running** question and answer.
 *
 * ## What it solves
 *
 * Under programmatic tool calls (cell) plus dynamic orchestration, when the same person asks the same thing again days later, the model has to walk the discovery again:
 * find the module, read the declaration, try a filter, hit an error, change the parameters. Measured, one long task is a dozen round trips and a minute or two, and what is actually useful
 * is only the last three or four successful calls. This table records **those few**, and the next time the same person asks something very similar,
 * they are handed back at the opening — the model writes them into one cell, and one round trip finishes it.
 *
 * ## 🔴 Boundary with the neighboring tables (read this before changing it)
 *
 * | | `oe_agent_call` | `oe_agent_evidence` | This table |
 * |---|---|---|---|
 * | What it is | An audit log | Temporary evidence of one answer | This person's own "last time I queried it this way" |
 * | Does it store a business result | No | Yes (hours, point read) | **No**: only the command, arguments, success or failure, and row count |
 * | Who can read it | Operations | The same operator, point-read by id | **The same tenant + the same operator**, only through the opening search |
 * | Retention | Follows the log | Hours | A sliding 90 days, extended once each time it is used |
 *
 * - **Bound to the operator, not shared by the tenant.** Arguments can contain the customer name and document number from this person's question, and ids found inside their data range.
 *   Widening it to the tenant leaks one person's query range to another person through the "recipe".
 * - **Not permission, and not a criterion.** It only affects how the model writes the first step; every command still passes authorization and data scope on each call,
 *   and an expired recipe can at most make the model try once in vain, and cannot let it query something it could not query.
 * - **It joins no gate.** Emptying the whole table changes not one word of business behavior; it only returns to "feel the way again every time".
 * - Written and searched only by the `erp` command surface. Other assistants (fast mode) neither write nor read — that path is not allowed persistent memory.
 *
 * One row per round, keyed by `(tenant, request_id)`: every command of the same round appends into `steps` (`||`, atomic in one statement),
 * and it does not need a "the round ended" signal — the other side has no such signal to give. Whether it qualifies to be searched is judged at read time by
 * `duration_ms` / `call_count` / `last_ok`.
 */
export const AGENT_RECIPE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const agentRecipe = pgTable(
  "oe_agent_recipe",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Only this person can search it. */
    actorId: text("actor_id").notNull(),
    /** Which assistant. Different assistants have different command surfaces, and recipes do not cross. */
    agentId: text("agent_id").notNull(),
    /** This round (`X-Host-Request-Id`). */
    requestId: text("request_id").notNull(),

    /** The user's original words, verbatim. */
    ask: text("ask").notNull(),
    /** The normalized form of the original words (punctuation and whitespace removed, digit runs folded to 0). Similarity is computed in the application by it; here it is only for dedup and diagnosis. */
    askKey: text("ask_key").notNull(),

    /** `[{cmd, args, ok, ms, rows?, error?}]`, in arrival order. A step whose arguments are too long keeps only the command name. */
    steps: jsonb("steps").notNull(),
    callCount: integer("call_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    /** Whether the last step succeeded. A round whose last step is the error mostly did not get done. */
    lastOk: boolean("last_ok").notNull().default(true),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),

    /** How many times it was searched and handed to the model. */
    hits: integer("hits").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_agent_recipe_round_uq").on(t.tenantId, t.requestId),
    // Opening search: this person's recent rounds on this assistant.
    index("oe_agent_recipe_actor_idx").on(t.tenantId, t.actorId, t.agentId, t.lastAt),
    index("oe_agent_recipe_reap_idx").on(t.expiresAt),
  ],
);

/**
 * Login state for the system job account at the identity gateway — one cookie shared across replicas.
 *
 * The gateway allows one active session per account. Each Pod doing its own `POST /user/login` kicks the others.
 * The cookie may live a long time, and it does not go into Redis; login mutual exclusion relies only on this row's `lease_until` (seconds),
 * and the connection is not held during the HTTP login.
 *
 * There is no org_id: the gateway login axis is tenant + username, not the organization.
 */
export const runtimeLoginSession = pgTable(
  "oe_runtime_login_session",
  {
    tenantId: text("tenant_id").notNull(),
    username: text("username").notNull(),
    userId: text("user_id"),
    cookie: text("cookie"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    loggedInAt: timestamp("logged_in_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("oe_runtime_login_session_uq").on(t.tenantId, t.username)],
);

export const agentCall = pgTable(
  "oe_agent_call",
  {
    id: text("id").primaryKey(),
    ...isolation,

    /** Tool name, the one the model actually called (`bill_propose`). */
    tool: text("tool").notNull(),
    /**
     * Operation name (`bill.propose`).
     *
     * Recorded together with `tool`, and not redundant: the tool name is **this version's interface**, and the operation name is **the coordinate on the operation surface**.
     * After a tool is renamed or merged, history rows must still be aggregable by operation.
     */
    operation: text("operation").notNull(),

    /** Which agent. Not a person — an agent calls as some person, and both axes must be kept. */
    agentId: text("agent_id").notNull(),
    /** Whose identity it was using at the time. An over-privilege investigation starts from this column. */
    actorId: text("actor_id").notNull(),
    /** Central policy version; the migration writes an explicit legacy marker for history rows, and it is forced non-null after that. */
    policyVersion: text("policy_version").notNull(),
    /** Central decision id; the migration writes an explicit legacy marker for history rows, and it is forced non-null after that. */
    decisionId: text("decision_id").notNull(),

    /** Call arguments as-is. The arguments are the only evidence of "what it meant to do", and they are not summarized. */
    args: jsonb("args").notNull(),

    /** ok / error */
    outcome: text("outcome").notNull(),
    /**
     * On success, a result summary (draft id, hit row count…); on failure, the error message verbatim.
     *
     * 🔴 On success, deliberately **do not store the whole result set**: one `bill_list` can return two hundred rows of business data,
     * and storing it copies business data into a table whose retention is completely different — it would be cleaned together with the log,
     * and it would be taken for analysis together with the log.
     */
    detail: text("detail").notNull(),

    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "What did this agent do today" — the first question when diagnosing.
    index("oe_agent_call_agent_idx").on(t.tenantId, t.agentId, t.at),
    // "Whose identity was used" — over-privilege and crossed-identity diagnosis.
    index("oe_agent_call_actor_idx").on(t.tenantId, t.actorId, t.at),
  ],
);

// ── module settings ──────────────────────────────────────────────────────────────

/**
 * A tenant's current choice for a code-declared module setting.
 * The definition, options, and default are not stored; there is no label / options / module metadata column here, to avoid a second source of truth.
 */
export const moduleSettingState = pgTable(
  "oe_module_setting_state",
  {
    id: text("id").primaryKey(),
    ...isolation,
    settingCode: text("setting_code").notNull(),
    value: text("value").notNull(),
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_module_setting_state_code_uq").on(t.tenantId, t.settingCode),
    check("oe_module_setting_state_revision_ck", sql`${t.revision} > 0`),
  ],
);

/** Append-only change history of a module setting; before/after both store the stable option code. */
export const moduleSettingAudit = pgTable(
  "oe_module_setting_audit",
  {
    id: text("id").primaryKey(),
    ...isolation,
    settingCode: text("setting_code").notNull(),
    revision: integer("revision").notNull(),
    before: text("before_value").notNull(),
    after: text("after_value").notNull(),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_module_setting_audit_revision_uq").on(t.tenantId, t.settingCode, t.revision),
    index("oe_module_setting_audit_lookup_idx").on(t.tenantId, t.settingCode, t.revision),
    check("oe_module_setting_audit_revision_ck", sql`${t.revision} > 0`),
  ],
);

// ── business flows ─────────────────────────────────────────────────────
//
// 🔴 **The declaration is the seed; these two tables are the tenant's source of truth.**
//
// The same shape as `domains/*/authorization.ts`: the declaration in `flows/<domain>/` is
// the **product baseline**, seeded by code on first deploy; the version the factory later changes on the canvas is stored here,
// and **seeding only fills in, and never overwrites**. That is how "the factory composes its own" and "the baseline upgrades with the version" can both hold.
//
// 🔴 Why steps are stored as jsonb rather than split into a step table:
// A flow's steps are **always read and written as a whole** (the canvas saves the full set once, the detail page renders all of it once),
// and there has never been a need to "query step 3 alone". The cost of splitting the table is a diff plus insert/update/delete on every save,
// and the benefit (an index by step) has no consumer. The shape gate is `normalizeFlow`,
// and the database column type is not the fallback.

/** A flow the tenant has changed. No such row = this flow is still the product baseline as-is. */
export const flowState = pgTable(
  "oe_flow",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Flow code, the same name as the declaration. Globally unique (within the tenant). */
    code: text("code").notNull(),
    /**
     * The flow's own lifecycle: draft composing / review submitted / dev waiting to be filled in / published released.
     * The meaning and the state machine are in `@open-erp/runtime-core`'s `contracts/flowLifecycle.ts` (the only definition).
     *
     * 🔴 This is not the same as "the two grades derived from the declaration": those two say "does this declaration pass",
     * and this column says "which delivery step this flow has reached". Both exist, and the screen shows them merged.
     */
    status: text("status").notNull(),
    /** The current content of the whole flow (label / purpose / owner / triggerWords / entry / steps). */
    payload: jsonb("payload").notNull(),
    /** Revision, starting at 1. Plus 1 on every save, aligned with the revision table. */
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_flow_code_uq").on(t.tenantId, t.code),
    check("oe_flow_revision_ck", sql`${t.revision} > 0`),
    // 🔴 The four grades are fixed in the database, not a second copy of the constant in code: what it guards is a **write that bypasses the repository**
    // (a migration script, a hand edit by operations, a second write entrance that may appear later). Without it, a misspelled
    // status is stored quietly, and from then on that flow is in no column on the screen and has no button —
    // the symptom is "this flow is gone", and the investigation does not point at the status value at all.
    check(
      "oe_flow_status_ck",
      sql`${t.status} in ('draft', 'review', 'dev', 'published')`,
    ),
  ],
);

/**
 * Append-only revision history of a flow.
 *
 * 🔴 It is the premise of "there is no archived state": the product explicitly requires publishing directly, with no archive grade,
 * and history lives here version by version — adding another terminal state only adds a "restore" entrance to explain.
 *
 * `action` records **how this version came to be**: save / submit / approve / reject /
 * needDev / devDone / revise. Everything except save and submit requires a reason (a server gate).
 */
/**
 * A chain — several flows strung into one whole.
 *
 * 🔴 The same rule as `flowState`: **the declaration is the seed, and the tenant database is the source of truth**. The ones in `flows/_composites/`
 * are the product baseline, and the version the factory changed on the screen is stored here; by code it only fills in and never overwrites.
 *
 * 🔴 **It has no lifecycle of its own** (unlike a flow's composing / submitted / published). A chain is not
 * something you do business with; it is one sentence of "these flows are strung in this order" — reviewing it has no meaning,
 * and what must actually be reviewed is each flow inside it. The cost of one more state machine is another status meaning to maintain,
 * and it answers nobody's question.
 */
export const flowChain = pgTable(
  "oe_flow_chain",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Chain code, the same name as the declaration. Unique within the tenant. */
    code: text("code").notNull(),
    /** The content of the whole chain (label / purpose / roles / links). */
    payload: jsonb("payload").notNull(),
    /** Revision, starting at 1. Plus 1 on every save. */
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_flow_chain_code_uq").on(t.tenantId, t.code),
    check("oe_flow_chain_revision_ck", sql`${t.revision} > 0`),
  ],
);

/**
 * The result of a flow's **last execution**.
 *
 * 🔴 **Keep only the last one, overwritten by code**. This table answers what color that row of dots on the list should be painted —
 * "the last time this flow ran, which step it broke on". Keeping history would require answering "which run", and one dot on the list
 * can express only one answer; if you really need to trace it, every button click is in the audit log.
 *
 * 🔴 What is stored is **the executor's own conclusion**, not something inferred backward from document status. The inferred version is always late:
 * someone else pushes that document one step forward by hand, the list turns green, and this flow in fact never ran through once.
 */
export const flowRun = pgTable(
  "oe_flow_run",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Flow code. Unique within the tenant — only the last run is kept. */
    code: text("code").notNull(),
    /** Which revision of the flow was run. Once the revision changes, the previous conclusion should no longer be painted. */
    flowRevision: integer("flow_revision").notNull(),
    /** The conclusion of each step: `[{ key, state }]`, state ∈ done / failed / skipped. */
    steps: jsonb("steps").notNull(),
    /** The conclusion of the whole run: passed (every step went through) / blocked (broke on some step). */
    outcome: text("outcome").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
    ranBy: text("ran_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_flow_run_code_uq").on(t.tenantId, t.code),
  ],
);

export const flowRevision = pgTable(
  "oe_flow_revision",
  {
    id: text("id").primaryKey(),
    ...isolation,
    code: text("code").notNull(),
    revision: integer("revision").notNull(),
    /** What status the flow is in after this revision. */
    status: text("status").notNull(),
    action: text("action").notNull(),
    /** Required except for save / submit. A rejection or a "call development" with no reason says nothing. */
    reason: text("reason"),
    /** The complete content snapshot of this revision. */
    payload: jsonb("payload").notNull(),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // 🔴 Keep only the unique index: its column group is the query column group (tenant × flow × revision),
    // and another ordinary index on the same columns is pure redundancy — both must be maintained, and the query plan uses only one.
    uniqueIndex("oe_flow_revision_uq").on(t.tenantId, t.code, t.revision),
    check("oe_flow_revision_revision_ck", sql`${t.revision} > 0`),
    check(
      "oe_flow_revision_status_ck",
      sql`${t.status} in ('draft', 'review', 'dev', 'published')`,
    ),
  ],
);

// ── custom notifications ──────────────────────────────────────────────────────────────
//
// Four tables, one chain:
//
//   rules (configured by the tenant) + change events (written by runtime-core inside the transaction)
//        ↓ notification engine (stateless, L0)
//   in-app messages (sent to a person) + execution log (for diagnosis)
//
// 🔴 A rule is **configuration**, not a business document: no state machine, it does not enter the ledger, and it wants no data scope.
// So it lands here rather than being generated by domains/ — the same kind as moduleSetting / choiceSet / flow.

/** Column names of `oe_notification_message_dedupe_uq`. The index and `ON CONFLICT` share them. */
export const NOTIFICATION_MESSAGE_DEDUPE_KEYS = ["tenantId", "dedupeKey"] as const;

/**
 * The predicate of the dedupe partial index, shared by the index and `ON CONFLICT`.
 *
 * 🔴 A drifted predicate **does not error**; it only makes dedup fail silently — one retry and the recipient sees two identical messages.
 * It takes a column rather than a hardcoded `sql`dedupe_key is not null``: a bare column name makes every generate produce one extra
 * migration of "drop the index and create it back the same" (see the same note on handoffTaskOpenPredicate).
 */
export function notificationMessageDedupePredicate(t: { dedupeKey: SQLWrapper }): SQL {
  return sql`${t.dedupeKey} is not null`;
}

/**
 * A notification rule.
 *
 * The `*_label` columns are **redundant human wording**: the list page renders them directly, and the front end does not parse jsonb.
 * The cost of writing each once is "the same rule is called 'every day 9:00' on the list and 'schedule 09:00' on the detail".
 */
export const notificationRule = pgTable(
  "oe_notification_rule",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Display number TZ-0001, unique within the tenant. A user refers to one rule by it in conversation. */
    ruleNo: text("rule_no").notNull(),
    name: text("name").notNull(),
    /** `{ kind: 'module' | 'surface', codes: string[] }` — multi-select. */
    scope: jsonb("scope").notNull(),
    scopeLabel: text("scope_label").notNull(),
    /** One of three shapes; see the metamodel's NotificationTrigger. */
    trigger: jsonb("trigger").notNull(),
    triggerLabel: text("trigger_label").notNull(),
    /** QueryNode. **The same predicates** as list filters / saved views; the engine does not write a second comparator. */
    condition: jsonb("condition"),
    conditionLabel: text("condition_label"),
    /** `{ title, body, link, type }`; body supports ${placeholders}. */
    content: jsonb("content").notNull(),
    /** `[{ kind, value, role, label }]` */
    recipients: jsonb("recipients").notNull(),
    recipientLabel: text("recipient_label").notNull(),
    /** An array: sending in-app and DingTalk at once does not need a table-structure change. */
    channels: jsonb("channels").notNull(),
    /** `{ perBillHours }`. A state that **keeps holding**, such as safety stock, would flood the screen every day without it. */
    throttle: jsonb("throttle"),
    /**
     * When several rows hit, send **one digest** or **one message each**.
     *
     * 🔴 Nullable, and **given no default**: null means "this rule was configured before this cell existed",
     * and the read falls back by trigger kind (see the metamodel's `defaultAggregate`).
     * Writing `default false` here would pin every old scheduled rule to one message each,
     * which is exactly the fault being fixed.
     */
    aggregate: boolean("aggregate"),
    status: text("status").notNull(),
    source: text("source").notNull(),
    /** Non-null means a preset: it can be disabled and changed, and **cannot be deleted** (deleting it seeds it back on the next start, and the user thinks it cannot be deleted). */
    presetCode: text("preset_code"),
    revision: integer("revision").notNull(),
    /** The anchor for compensating a missed run. A process restart or a short outage heals itself; a week of downtime does not back-send seven messages at the moment it recovers. */
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("oe_notification_rule_no_uq").on(t.tenantId, t.ruleNo),
    uniqueIndex("oe_notification_rule_preset_uq")
      .on(t.tenantId, t.presetCode)
      .where(sql`${t.presetCode} is not null`),
    // The ticker cares each minute only about the enabled ones; the partial index makes the scan cost independent of how many rules are disabled.
    index("oe_notification_rule_active_idx").on(t.tenantId, t.status).where(sql`${t.status} = 'enabled'`),
    index("oe_notification_rule_feed_idx").on(t.tenantId, t.createdAt),
    check("oe_notification_rule_status_ck", sql`${t.status} in ('enabled', 'disabled')`),
    check("oe_notification_rule_source_ck", sql`${t.source} in ('manual', 'agent', 'preset')`),
    check("oe_notification_rule_revision_ck", sql`${t.revision} > 0`),
  ],
);

/**
 * Execution log. **One row = one notification**, not one trigger.
 *
 * The evidence is in the prototype: one inventory warning showed two rows of different goods. Making it one row per trigger,
 * the "notification content" and "notification people" columns cannot hold it — one trigger may hit dozens of data rows and dozens of recipients.
 *
 * 🔴 `rule_id` **has no foreign key**: after the rule is deleted, the log must still be readable. `rule_name` is the snapshot at the time.
 */
export const notificationRun = pgTable(
  "oe_notification_run",
  {
    id: text("id").primaryKey(),
    ...isolation,
    /** Shared by one trigger, used to string a batch of log rows together. */
    batchId: text("batch_id").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull(),
    /** auto / debug / manual. The execution log looks at auto by default, so a person's debugging does not pollute the diagnosis view. */
    source: text("source").notNull(),
    result: text("result").notNull(),
    /** How many data rows this trigger hit. "No matching data" must also leave a row, or the user thinks the rule did not run. */
    matchedCount: integer("matched_count").notNull(),
    channel: text("channel").notNull(),
    contentTitle: text("content_title").notNull(),
    contentBody: text("content_body"),
    recipientLabel: text("recipient_label").notNull(),
    /** Failure reason. On the list it hangs on the ⓘ, and is not stuffed into the result column. */
    error: text("error"),
    /** Ids of the in-app messages produced, for reconciliation. */
    messageIds: jsonb("message_ids"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("oe_notification_run_feed_idx").on(t.tenantId, t.firedAt),
    index("oe_notification_run_rule_idx").on(t.tenantId, t.ruleId, t.firedAt),
    index("oe_notification_run_batch_idx").on(t.tenantId, t.batchId),
    // The 30-day cleanup scans by this.
    index("oe_notification_run_gc_idx").on(t.createdAt),
    check("oe_notification_run_source_ck", sql`${t.source} in ('auto', 'debug', 'manual')`),
    check(
      "oe_notification_run_result_ck",
      sql`${t.result} in ('success', 'partial', 'no_match', 'throttled', 'failed')`,
    ),
  ],
);

/**
 * An in-app message. **One row per recipient** — read and delete are per-person states, and one shared row cannot do that.
 *
 * 🔴 Do not reuse `oe_handoff_task`: a handoff is "document responsibility", and `closeOpen` closes it automatically
 * when an edge executes. Reusing it for in-app messages would have the framework mysteriously clear a user's message history when some edge executes.
 *
 * 🔴 `type` **has no check constraint**: message type is an L2 vocabulary, and adding a type should not come back to change the table.
 * Validation stays in the application layer, checked against the vocabulary.
 */
export const notificationMessage = pgTable(
  "oe_notification_message",
  {
    id: text("id").primaryKey(),
    ...isolation,
    recipientUserId: text("recipient_user_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    type: text("type").notNull(),
    /** auto / debug. A message sent by debugging must be marked on the detail page, so the recipient does not think inventory really alarmed. */
    source: text("source").notNull(),
    ruleId: text("rule_id"),
    runId: text("run_id"),
    sourceModule: text("source_module"),
    sourceBillId: text("source_bill_id"),
    /**
     * A structured attachment besides the body. For now only one shape: the table inside a digest message
     * `{ kind: "digest", module, columns: [{key,label}], rows: [...], total, shown }`.
     *
     * 🔴 **Not the table pasted into the `body` text**. The inbox detail page must be able to render it as a real table,
     * and each row must be able to open the corresponding document; pasted as a monospace text it wraps into a tangle on a phone,
     * and that is exactly where a business person reads this message.
     */
    payload: jsonb("payload"),
    /** The last line of idempotency. An advisory lock only lowers the probability; the guarantee is on this index. */
    dedupeKey: text("dedupe_key"),
    /** null = unread */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Soft delete. A message a user deleted is not physically deleted, so diagnosis can still look it up. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // The only way the inbox is read: one person's, not deleted, newest first. Deleted rows do not enter the index.
    index("oe_notification_message_inbox_idx")
      .on(t.tenantId, t.recipientUserId, t.readAt, t.createdAt)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("oe_notification_message_dedupe_uq")
      .on(...pickColumns(t, NOTIFICATION_MESSAGE_DEDUPE_KEYS))
      .where(notificationMessageDedupePredicate(t)),
    index("oe_notification_message_run_idx").on(t.tenantId, t.runId),
    check("oe_notification_message_source_ck", sql`${t.source} in ('auto', 'debug')`),
  ],
);

/**
 * Data-change outbox.
 *
 * 🔴 Appended by runtime-core's **five write entrances inside the same transaction** (createBill / createPlannedBill /
 * saveDraft / deleteBill / executeTransitionCore). Writing it inside the transaction guarantees "if the business committed, the
 * event is there"; the real delivery happens asynchronously outside the transaction, and a delivery failure only writes one execution-log row and **does not roll back the business** —
 * nobody can accept a purchase order that cannot be created because a reminder could not be sent.
 *
 * 🔴 The audit table cannot replace it: `oe_audit_log` records only state-machine execution,
 * and `createBill` / `saveDraft` / `deleteBill` never enter that table.
 */
export const changeEvent = pgTable(
  "oe_change_event",
  {
    id: text("id").primaryKey(),
    ...isolation,
    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    kind: text("kind").notNull(),
    transitionCode: text("transition_code"),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    /** Keys of the cells that changed. `watchFields` uses them to decide whether to trigger. */
    changedFields: jsonb("changed_fields"),
    /**
     * Header snapshot of the deleted row. **Written only when `kind='delete'`.**
     *
     * 🔴 Without it, "notify on delete too" cannot be done at all: the event is consumed outside the transaction,
     * and by then the row is no longer in the table, so the engine fetching by id fetches nothing, and not one message goes out
     * (measured: create and edit both work, and only delete is not received).
     * Store only the header, not the lines: the notification body uses those header cells.
     */
    deletedHeader: jsonb("deleted_header"),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    /** null = pending */
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    // 🔴 Most rows of a queue table are already processed. The partial index makes the worker's scan cost independent of how much history has piled up.
    index("oe_change_event_pending_idx").on(t.at).where(sql`${t.processedAt} is null`),
    index("oe_change_event_bill_idx").on(t.tenantId, t.module, t.billId),
    // Processed rows are kept 7 days for diagnosis, and the cleanup task scans by this.
    index("oe_change_event_gc_idx").on(t.processedAt),
    check(
      "oe_change_event_kind_ck",
      sql`${t.kind} in ('create', 'update', 'delete', 'transition')`,
    ),
  ],
);

/**
 * Operation log. Create, update, delete, and transition of a business document, append-only.
 *
 * It is not the same table as `oe_change_event` above: that one is the reminder outbox, and this one is the record a person reads.
 * Content is assembled at query time, and is not stored as a column. `id` is uuid. `bill_id` is the document primary key, text, and an existing document need not be a uuid.
 * `at` is timestamptz. `kind` is text, and the check constraint allows only four actions; no enum type is created.
 * The other columns are text: they are not uuids, and they have no enforceable length limit.
 */
export const operationLog = pgTable(
  "oe_operation_log",
  {
    id: uuid("id").primaryKey(),
    ...isolation,
    actorUserId: text("actor_user_id").notNull(),
    actorAccount: text("actor_account"),
    actorName: text("actor_name"),
    at: timestamp("at", { withTimezone: true }).notNull(),
    module: text("module").notNull(),
    billId: text("bill_id").notNull(),
    billCode: text("bill_code"),
    kind: text("kind").notNull(),
    action: text("action"),
    agentId: text("agent_id"),
  },
  (t) => [
    index("oe_operation_log_tenant_at_idx").on(t.tenantId, t.at),
    index("oe_operation_log_tenant_module_at_idx").on(t.tenantId, t.module, t.at),
    check(
      "oe_operation_log_kind_ck",
      sql`${t.kind} in ('create', 'update', 'delete', 'transition')`,
    ),
    check(
      "oe_operation_log_action_ck",
      sql`((${t.kind} = 'transition' and ${t.action} is not null and char_length(${t.action}) > 0) or (${t.kind} <> 'transition' and ${t.action} is null))`,
    ),
  ],
);

// ── tenant custom fields ─────────────────────────────────────────────────────────
//
// The three tables store only **metadata**: which fields exist, which module they bind to, and the mount-point detail.
// Tens to hundreds of rows per tenant, cached per tenant at request level, and they **join no business SQL**.
//
// 🔴 The value is not here. The value lands in the **`custom` jsonb column on the module's own table** (issued by the table builder),
// and travels with the business row. Putting the value in a separate table (EAV) is a practice this design explicitly rejected:
// measured on 500,000 rows, the same list-page query went 0.34ms → 8.6ms, 25 times slower, because every hit row had to be fetched back once.

/** Field definition: "what field this is", independent of the module. */
export const customField = pgTable(
  "oe_custom_field",
  {
    id: text("id").primaryKey(),
    ...isolation,
    key: text("key").notNull(),
    label: text("label").notNull(),
    valueKind: text("value_kind").notNull(),
    choiceSetCode: text("choice_set_code"),
    help: text("help"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    // key is unique within the tenant: the same field bound to several modules uses **the same key**,
    // which is the premise of a push-down edge getting pass-through for free from "same key and same type carries the value".
    uniqueIndex("oe_custom_field_key_uq").on(t.tenantId, t.key),
    uniqueIndex("oe_custom_field_label_uq").on(t.tenantId, t.label),
    index("oe_custom_field_feed_idx").on(t.tenantId, t.status),
    check(
      "oe_custom_field_kind_ck",
      sql`${t.valueKind} in ('choiceSet', 'multiSelect', 'bool', 'number', 'text', 'textarea', 'date', 'time', 'address')`,
    ),
    check("oe_custom_field_status_ck", sql`${t.status} in ('draft', 'active', 'disabled')`),
    // A value that comes from a choice set must name which one; other types may not hang a choice set.
    check(
      "oe_custom_field_choice_ck",
      sql`(${t.valueKind} in ('choiceSet', 'multiSelect')) = (${t.choiceSetCode} is not null)`,
    ),
    // The same criterion as the metamodel's CUSTOM_FIELD_KEY. The database blocks it once too:
    // the prefix is the only guarantee of namespace isolation, and a direct write that bypasses the server cannot break it either.
    check("oe_custom_field_key_ck", sql`${t.key} ~ '^x[A-Z][A-Za-z0-9]{0,40}$'`),
  ],
);

/** Binding: "what role it has on this module". One field × one module = one row. */
export const customFieldBinding = pgTable(
  "oe_custom_field_binding",
  {
    id: text("id").primaryKey(),
    ...isolation,
    fieldId: text("field_id").notNull(),
    module: text("module").notNull(),
    /**
     * Which layer it lands on: null = the header; non-null = the key of this line table on the module.
     *
     * 🔴 Nullable rather than a `''` default: the header is "there is no line table", not "the line table is named the empty string".
     * The unique index therefore uses `coalesce(line_table,'')` (below); otherwise PostgreSQL's NULLS DISTINCT
     * would let the same field be bound twice on the same module's header.
     */
    lineTable: text("line_table"),
    origin: text("origin").notNull(),
    /** `{ module, viaRef }` when origin='inherit'. */
    inherit: jsonb("inherit"),
    /** form / required / editStatuses / list / filter / filterMultiple */
    surfaces: jsonb("surfaces").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    /**
     * A field can have only one binding on one **layer** of one module — two would be two copies of the detail,
     * and the screen could not tell which one takes effect.
     *
     * 🔴 `coalesce(line_table,'')`: a PostgreSQL unique index is NULLS DISTINCT by default, and bringing
     * the `line_table` column in directly would let the header grade (null) be configured as many times as wanted, and the entire reason
     * this constraint exists is to stop that.
     */
    uniqueIndex("oe_custom_field_binding_uq").on(
      t.tenantId,
      t.fieldId,
      t.module,
      sql`coalesce(${t.lineTable}, '')`,
    ),
    // The merge point's fetch path: take every enabled binding by (tenant, module), then order by sortOrder.
    index("oe_custom_field_binding_module_idx").on(t.tenantId, t.module, t.sortOrder),
    check("oe_custom_field_binding_origin_ck", sql`${t.origin} in ('own', 'inherit')`),
    check("oe_custom_field_binding_status_ck", sql`${t.status} in ('draft', 'active', 'disabled')`),
    check("oe_custom_field_binding_sort_ck", sql`${t.sortOrder} >= 0`),
    // Pass-through must say where it comes from; one the module fills itself may not carry a source. Both directions are blocked.
    check(
      "oe_custom_field_binding_inherit_ck",
      sql`(${t.origin} = 'inherit') = (${t.inherit} is not null)`,
    ),
  ],
);

/** One revision per (tenant × module). The merge point's cache-invalidation signal, and also the credential of optimistic concurrency. */
export const customFieldState = pgTable(
  "oe_custom_field_state",
  {
    ...isolation,
    module: text("module").notNull(),
    revision: integer("revision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("oe_custom_field_state_uq").on(t.tenantId, t.module),
    check("oe_custom_field_state_revision_ck", sql`${t.revision} >= 1`),
  ],
);

/** Append-only trace. Changing one binding changes the document shape the whole tenant sees, and it must be able to answer "who changed it, and when". */
export const customFieldAudit = pgTable(
  "oe_custom_field_audit",
  {
    id: text("id").primaryKey(),
    ...isolation,
    module: text("module").notNull(),
    fieldKey: text("field_key").notNull(),
    action: text("action").notNull(),
    revision: integer("revision").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    actorId: text("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oe_custom_field_audit_feed_idx").on(t.tenantId, t.module, t.at)],
);

/** Business bot subscription, recoverable dispatch, and result; it changes no business-module declaration. */
export const botSubscription = pgTable("oe_bot_subscription", {
 id:text("id").primaryKey(), ...isolation, ownerId:text("owner_id").notNull(),
 identify:text("identify").notNull(), authorizationFingerprint:text("authorization_fingerprint").notNull(),
 botId:text("bot_id").notNull(), taskId:text("task_id").notNull(), agentId:text("agent_id").notNull(),
 bindingRevision:integer("binding_revision").notNull(), revision:integer("revision").notNull(),
 status:text("status").notNull(), module:text("module").notNull(), trigger:text("trigger").notNull(),
 events:jsonb("events").notNull(), eventSecret:text("event_secret"), fingerprint:text("fingerprint").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull(),
},t=>[index("oe_bot_subscription_owner_idx").on(t.tenantId,t.ownerId),check("oe_bot_subscription_status_ck",sql`${t.status} in ('active','paused')`)]);
export const botDispatch = pgTable("oe_bot_dispatch",{
 id:text("id").primaryKey(),subscriptionId:text("subscription_id").notNull(), ...isolation,
 event:jsonb("event").notNull(),status:text("status").notNull(),attempts:integer("attempts").notNull(),
 availableAt:timestamp("available_at",{withTimezone:true}).notNull(),
 leaseToken:text("lease_token"),leaseUntil:timestamp("lease_until",{withTimezone:true}),
 sessionId:text("session_id"),lastError:text("last_error"),
},t=>[index("oe_bot_dispatch_due_idx").on(t.status,t.availableAt,t.leaseUntil)]);
export const botResult = pgTable("oe_bot_result",{
 id:text("id").primaryKey(), ...isolation,ownerId:text("owner_id").notNull(),
 subscriptionId:text("subscription_id").notNull(),runId:text("run_id").notNull(),
 payload:jsonb("payload").notNull(),fingerprint:text("fingerprint").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull(),
},t=>[index("oe_bot_result_owner_idx").on(t.tenantId,t.ownerId,t.createdAt)]);

/** Bot interaction preparation and the confirmation receipt, not a second copy of business data. */
export const humanAction = pgTable("oe_human_action", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), orgId: text("org_id").notNull(),
  ownerId: text("owner_id").notNull(), identify: text("identify").notNull(),
  operationRef: text("operation_ref").notNull(), revision: integer("revision").notNull(),
  contentHash: text("content_hash").notNull(),
  content: jsonb("content").$type<import("@open-erp/runtime-core").HumanActionContent>().notNull(),
  reviewToken: text("review_token").notNull(), status: text("status").$type<import("@open-erp/runtime-core").HumanAction["status"]>().notNull(),
  receipt: jsonb("receipt").$type<import("@open-erp/runtime-core").HumanActionReceipt>(),
  expiresAt: timestamp("expires_at", {withTimezone:true}).notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull(), updatedAt: timestamp("updated_at", {withTimezone:true}).notNull(),
}, t => [uniqueIndex("oe_human_action_operation_uq").on(t.tenantId,t.orgId,t.ownerId,t.identify,t.operationRef)]);
