// ---------------------------------------------------------------------------
// Custom notification repository — rules / execution log / inbox
//
// 🔴 **Deliberately not inside `assemble()`**, for the same reason as `createAgentSkillRepo`, word for word:
// configuring a reminder rule and writing a document are not the same thing, and they should not share a transaction boundary.
// The only one that enters `ExecutionRepos` is `changeEvents` — it must live and die with the business write.
//
// ## Three read/write rules
//
//   · Rules and logs: framework tables. Reads use `scopedWhere` (**tenant axis only**).
//     They are not module tables and have no data scope — an admin sees every rule in this tenant.
//   · Inbox: **also closed by `identity.userId`** beyond the tenant axis, and the interface
//     has no "whose" argument at all. "Can see only my own" is a structural guarantee,
//     not a check a parameter can bypass.
//   · A cross-tenant read on the worker side is its own method and is written out plainly, not mixed into the two above.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import {
  notificationMessage,
  notificationRule,
  notificationRun,
  NOTIFICATION_MESSAGE_DEDUPE_KEYS,
  notificationMessageDedupePredicate,
  pickColumns,
} from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { guardConcurrency, guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

// ── errors ────────────────────────────────────────────────────────────────────

export class NotificationNotFoundError extends Error {
  override readonly name = "NotificationNotFoundError";
}

export class NotificationInputError extends Error {
  override readonly name = "NotificationInputError";
}

export class NotificationRevisionConflictError extends Error {
  override readonly name = "NotificationRevisionConflictError";
  constructor(readonly ruleId: string, readonly expectedRevision: number, readonly currentRevision: number) {
    super(
      `this notification was just changed by someone else (you saw revision ${String(expectedRevision)}, ` +
        `and it is now revision ${String(currentRevision)}); reload before saving`,
    );
  }
}

// ── record shapes ────────────────────────────────────────────────────────────────

export interface NotificationRuleRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly orgId: string;
  readonly ruleNo: string;
  readonly name: string;
  readonly scope: unknown;
  readonly scopeLabel: string;
  readonly trigger: unknown;
  readonly triggerLabel: string;
  readonly condition: unknown;
  readonly conditionLabel: string | null;
  readonly content: unknown;
  readonly recipients: unknown;
  readonly recipientLabel: string;
  readonly channels: readonly string[];
  readonly throttle: unknown;
  /** null = this rule was configured before this cell existed; on read, fall back by trigger mode (see defaultAggregate in metamodel). */
  readonly aggregate: boolean | null;
  readonly status: string;
  readonly source: string;
  readonly presetCode: string | null;
  readonly revision: number;
  readonly lastFiredAt: Date | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedBy: string;
  readonly updatedAt: Date;
}

/** The copy given when writing a rule. `ruleNo` / `revision` are issued by the repository; the caller cannot supply them. */
export interface NotificationRuleInput {
  readonly name: string;
  readonly scope: unknown;
  readonly scopeLabel: string;
  readonly trigger: unknown;
  readonly triggerLabel: string;
  readonly condition: unknown;
  readonly conditionLabel: string | null;
  readonly content: unknown;
  readonly recipients: unknown;
  readonly recipientLabel: string;
  readonly channels: readonly string[];
  readonly throttle: unknown;
  readonly aggregate: boolean;
  readonly status: string;
  readonly source: string;
  readonly presetCode: string | null;
}

export interface NotificationRuleFilter {
  readonly name?: string | null;
  readonly scope?: string | null;
  readonly status?: string | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NotificationRunInput {
  readonly batchId: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly firedAt: Date;
  readonly source: string;
  readonly result: string;
  readonly matchedCount: number;
  readonly channel: string;
  readonly contentTitle: string;
  readonly contentBody: string | null;
  readonly recipientLabel: string;
  readonly error: string | null;
  readonly messageIds: readonly string[];
}

export interface NotificationRunRecord extends NotificationRunInput {
  readonly id: string;
  readonly createdAt: Date;
}

export interface NotificationRunFilter {
  readonly name?: string | null;
  readonly result?: string | null;
  readonly source?: string | null;
  readonly from?: Date | null;
  readonly to?: Date | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NotificationMessageInput {
  readonly recipientUserId: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly type: string;
  readonly source: string;
  readonly ruleId: string | null;
  readonly runId: string | null;
  readonly sourceModule: string | null;
  readonly sourceBillId: string | null;
  /** The table inside a summary message. The shape is documented on the `payload` column in framework.ts. */
  readonly payload: unknown;
  readonly dedupeKey: string | null;
  readonly createdAt: Date;
}

export interface NotificationMessageRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly type: string;
  readonly source: string;
  readonly ruleId: string | null;
  readonly sourceModule: string | null;
  readonly sourceBillId: string | null;
  readonly payload: unknown;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export type InboxFilter = "all" | "unread" | "read";

export interface Paged<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

// ── helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

function window(page: number | undefined, pageSize: number | undefined): { offset: number; limit: number } {
  const size = Math.min(Math.max(Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
  const index = Math.max(Math.trunc(page ?? 1), 1);
  return { offset: (index - 1) * size, limit: size };
}

function ruleOf(raw: typeof notificationRule.$inferSelect): NotificationRuleRecord {
  const channels = raw.channels;
  return {
    ...raw,
    channels: Array.isArray(channels) ? (channels as string[]) : [],
  };
}

function runOf(raw: typeof notificationRun.$inferSelect): NotificationRunRecord {
  const ids = raw.messageIds;
  return { ...raw, messageIds: Array.isArray(ids) ? (ids as string[]) : [] };
}

const RULE_NO_PREFIX = "TZ-";

/**
 * The next display number.
 *
 * Take the current maximum plus 1, and let `oe_notification_rule_no_uq` cover concurrency. No sequence table:
 * the number is only for people to refer to ("turn off TZ-0007"), skipped numbers do not matter, and another table would be the burden.
 */
async function nextRuleNo(tx: Executor, who: ReturnType<typeof requireIdentity>): Promise<string> {
  const rows = await tx
    .select({ ruleNo: notificationRule.ruleNo })
    .from(notificationRule)
    .where(scopedWhere(notificationRule, who))
    .orderBy(desc(notificationRule.ruleNo))
    .limit(1);
  const current = rows[0]?.ruleNo ?? null;
  const seq = current === null ? 0 : Number.parseInt(current.slice(RULE_NO_PREFIX.length), 10);
  const next = Number.isFinite(seq) ? seq + 1 : 1;
  return `${RULE_NO_PREFIX}${String(next).padStart(4, "0")}`;
}

// ── repository ────────────────────────────────────────────────────────────────────

export interface NotificationRepo {
  // rules
  listRules(identity: Identity, filter: NotificationRuleFilter): Promise<Paged<NotificationRuleRecord>>;
  getRule(identity: Identity, id: string): Promise<NotificationRuleRecord>;
  /** Scope copy that has appeared on this tenant's rules (deduped), unaffected by list filters and paging. */
  ruleScopeLabels(identity: Identity): Promise<readonly string[]>;
  createRule(identity: Identity, input: NotificationRuleInput, at: Date): Promise<NotificationRuleRecord>;
  updateRule(
    identity: Identity,
    id: string,
    input: NotificationRuleInput,
    expectedRevision: number,
    at: Date,
  ): Promise<NotificationRuleRecord>;
  setRuleStatus(identity: Identity, id: string, status: string, at: Date): Promise<NotificationRuleRecord>;
  deleteRule(identity: Identity, id: string): Promise<void>;
  /** Preset seeding: **write only when the code is missing, and do not overwrite a configuration the tenant already changed** (same rule as authorization / flow). */
  seedPreset(identity: Identity, presetCode: string, input: NotificationRuleInput, at: Date): Promise<boolean>;

  // execution log
  appendRuns(identity: Identity, runs: readonly NotificationRunInput[], at: Date): Promise<readonly string[]>;
  listRuns(identity: Identity, filter: NotificationRunFilter): Promise<Paged<NotificationRunRecord>>;
  purgeRuns(before: Date): Promise<number>;

  // inbox
  deliver(identity: Identity, messages: readonly NotificationMessageInput[]): Promise<readonly string[]>;
  unreadTop(identity: Identity, limit: number): Promise<{ rows: readonly NotificationMessageRecord[]; unread: number }>;
  listMessages(identity: Identity, filter: InboxFilter, page: number, pageSize: number): Promise<Paged<NotificationMessageRecord>>;
  getMessage(identity: Identity, id: string): Promise<NotificationMessageRecord>;
  markRead(identity: Identity, ids: readonly string[], at: Date): Promise<number>;
  /** Mark all of my unread at once. Marking a few hundred one id at a time is not realistic. */
  markAllRead(identity: Identity, at: Date): Promise<number>;
  removeMessages(identity: Identity, ids: readonly string[], at: Date): Promise<number>;

  // worker side
  /** Cross-tenant fetch of enabled rules. **Worker only** — it scans the whole database as the system, then handles each row by the tenant axis on it. */
  enabledRulesAcrossTenants(): Promise<readonly NotificationRuleRecord[]>;
  markFired(ruleId: string, at: Date): Promise<void>;
  /**
   * Claim for the minute of a schedule or a time field: returns true only if nobody has run this rule since `since` (and records `at`).
   * One UPDATE, and only one of several instances gets it.
   */
  claimTimedRun(ruleId: string, since: Date, at: Date): Promise<boolean>;
  /** Throttle criterion: whether this rule has already been sent for this document inside the window. */
  recentlyNotified(tenantId: string, ruleId: string, billId: string, since: Date): Promise<boolean>;
}

export function createNotificationRepo(exec: Executor): NotificationRepo {
  const mustRule = async (tx: Executor, who: ReturnType<typeof requireIdentity>, id: string) => {
    const rows = await tx
      .select()
      .from(notificationRule)
      .where(scopedWhere(notificationRule, who, eq(notificationRule.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotificationNotFoundError(`this notification was not found (${id}); it may already have been deleted`);
    return row;
  };

  return {
    async listRules(identity, filter) {
      const who = requireIdentity(identity);
      const extra = [
        filter.name ? sql`${notificationRule.name} ilike ${`%${filter.name}%`}` : undefined,
        // 🔴 Match on `scope_label`, not inside the `scope` jsonb: that stores codes
        // (`{"kind":"module","codes":["purchaseOrder"]}`), while the dropdown on the screen gives
        // display copy ("purchase order") — comparing display copy to a code never matches,
        // and the symptom is "a scope that has data was selected, and the query returns nothing".
        // A multi-scope label is one string joined by enumeration commas, and `ilike` still hits any one of them.
        filter.scope ? sql`${notificationRule.scopeLabel} ilike ${`%${filter.scope}%`}` : undefined,
        filter.status ? eq(notificationRule.status, filter.status) : undefined,
      ];
      const where = scopedWhere(notificationRule, who, ...extra);
      const { offset, limit } = window(filter.page, filter.pageSize);
      const [rows, totals] = await Promise.all([
        exec.select().from(notificationRule).where(where).orderBy(desc(notificationRule.createdAt)).offset(offset).limit(limit),
        exec.select({ n: count() }).from(notificationRule).where(where),
      ]);
      return { rows: rows.map(ruleOf), total: Number(totals[0]?.n ?? 0) };
    },

    async getRule(identity, id) {
      return ruleOf(await mustRule(exec, requireIdentity(identity), id));
    },

    async ruleScopeLabels(identity) {
      const rows = await exec
        .selectDistinct({ label: notificationRule.scopeLabel })
        .from(notificationRule)
        .where(scopedWhere(notificationRule, requireIdentity(identity)))
        .orderBy(asc(notificationRule.scopeLabel));
      return rows.map((row) => row.label);
    },

    async createRule(identity, input, at) {
      const who = requireIdentity(identity);
      return await guardConcurrency("save notification rule", async () =>
        await exec.transaction(async (tx) => {
          const ruleNo = await nextRuleNo(tx as unknown as Executor, who);
          const rows = await guardWrite("save notification rule", async () =>
            await tx
              .insert(notificationRule)
              .values(
                scopedValues(who, {
                  id: randomUUID(),
                  ruleNo,
                  ...input,
                  channels: [...input.channels],
                  revision: 1,
                  lastFiredAt: null,
                  createdBy: who.userId,
                  createdAt: at,
                  updatedBy: who.userId,
                  updatedAt: at,
                }),
              )
              .returning(),
          );
          const row = rows[0];
          if (!row) throw new NotificationInputError("the notification rule was not written");
          return ruleOf(row);
        }),
      );
    },

    async updateRule(identity, id, input, expectedRevision, at) {
      const who = requireIdentity(identity);
      return await guardConcurrency("save notification rule", async () =>
        await exec.transaction(async (tx) => {
          const current = await mustRule(tx as unknown as Executor, who, id);
          if (current.revision !== expectedRevision) {
            throw new NotificationRevisionConflictError(id, expectedRevision, current.revision);
          }
          const rows = await guardWrite("save notification rule", async () =>
            await tx
              .update(notificationRule)
              .set({
                ...input,
                channels: [...input.channels],
                // Preset identity cannot be changed: changing it would turn a preset into an ordinary rule, and the next startup would seed another one.
                presetCode: current.presetCode,
                source: current.source,
                revision: current.revision + 1,
                updatedBy: who.userId,
                updatedAt: at,
              })
              .where(
                scopedWhere(
                  notificationRule,
                  who,
                  eq(notificationRule.id, id),
                  eq(notificationRule.revision, expectedRevision),
                ),
              )
              .returning(),
          );
          const row = rows[0];
          if (!row) throw new NotificationRevisionConflictError(id, expectedRevision, current.revision);
          return ruleOf(row);
        }),
      );
    },

    async setRuleStatus(identity, id, status, at) {
      const who = requireIdentity(identity);
      const rows = await guardWrite("switch notification status", async () =>
        await exec
          .update(notificationRule)
          .set({ status, updatedBy: who.userId, updatedAt: at })
          .where(scopedWhere(notificationRule, who, eq(notificationRule.id, id)))
          .returning(),
      );
      const row = rows[0];
      if (!row) throw new NotificationNotFoundError(`this notification was not found (${id}); it may already have been deleted`);
      return ruleOf(row);
    },

    async deleteRule(identity, id) {
      const who = requireIdentity(identity);
      const current = await mustRule(exec, who, id);
      if (current.presetCode !== null) {
        throw new NotificationInputError(
          `"${current.name}" is a system preset notification and cannot be deleted — disabling it stops it from sending`,
        );
      }
      await guardWrite("delete notification", async () =>
        await exec.delete(notificationRule).where(scopedWhere(notificationRule, who, eq(notificationRule.id, id))),
      );
    },

    async seedPreset(identity, presetCode, input, at) {
      const who = requireIdentity(identity);
      return await exec.transaction(async (tx) => {
        const existing = await tx
          .select({ id: notificationRule.id })
          .from(notificationRule)
          .where(scopedWhere(notificationRule, who, eq(notificationRule.presetCode, presetCode)))
          .limit(1);
        // 🔴 If it exists, leave it. An upgrade that resets recipients after the tenant changed them is one of the hardest accidents to investigate.
        if (existing.length > 0) return false;
        const ruleNo = await nextRuleNo(tx as unknown as Executor, who);
        await tx.insert(notificationRule).values(
          scopedValues(who, {
            id: randomUUID(),
            ruleNo,
            ...input,
            channels: [...input.channels],
            presetCode,
            revision: 1,
            lastFiredAt: null,
            createdBy: who.userId,
            createdAt: at,
            updatedBy: who.userId,
            updatedAt: at,
          }),
        );
        return true;
      });
    },

    async appendRuns(identity, runs, at) {
      if (runs.length === 0) return [];
      const who = requireIdentity(identity);
      const values = runs.map((run) =>
        scopedValues(who, { id: randomUUID(), ...run, messageIds: [...run.messageIds], createdAt: at }),
      );
      const rows = await guardWrite("record an execution log", async () =>
        await exec.insert(notificationRun).values(values).returning({ id: notificationRun.id }),
      );
      return rows.map((row) => row.id);
    },

    async listRuns(identity, filter) {
      const who = requireIdentity(identity);
      const extra = [
        filter.name ? sql`${notificationRun.ruleName} ilike ${`%${filter.name}%`}` : undefined,
        filter.result ? eq(notificationRun.result, filter.result) : undefined,
        // By default look only at automatic triggers: a manual debug must not pollute the troubleshooting view.
        // 🔴 But there must be a path that can see debug records (source=debug / all) —
        // writing them with no entry point that can see them is the same as not writing them.
        filter.source === "all" ? undefined : eq(notificationRun.source, filter.source ?? "auto"),
        filter.from ? gte(notificationRun.firedAt, filter.from) : undefined,
        filter.to ? lte(notificationRun.firedAt, filter.to) : undefined,
      ];
      const where = scopedWhere(notificationRun, who, ...extra);
      const { offset, limit } = window(filter.page, filter.pageSize);
      const [rows, totals] = await Promise.all([
        exec.select().from(notificationRun).where(where).orderBy(desc(notificationRun.firedAt)).offset(offset).limit(limit),
        exec.select({ n: count() }).from(notificationRun).where(where),
      ]);
      return { rows: rows.map(runOf), total: Number(totals[0]?.n ?? 0) };
    },

    async purgeRuns(before) {
      const rows = await exec
        .delete(notificationRun)
        .where(sql`${notificationRun.createdAt} < ${before}`)
        .returning({ id: notificationRun.id });
      return rows.length;
    },

    async deliver(identity, messages) {
      if (messages.length === 0) return [];
      const who = requireIdentity(identity);
      const values = messages.map((message) => scopedValues(who, { id: randomUUID(), ...message }));
      // 🔴 `ON CONFLICT` must include the **partial index predicate**, or PG will not know which index to use
      // and the whole statement is rejected (see notificationMessageDedupePredicate in framework.ts).
      // A hit means this was already sent: an idempotent success, not an error.
      const rows = await guardWrite("send an inbox message", async () =>
        await exec
          .insert(notificationMessage)
          .values(values)
          .onConflictDoNothing({
            // Columns and predicate share one declaration with the index (see db/framework.ts).
            target: pickColumns(notificationMessage, NOTIFICATION_MESSAGE_DEDUPE_KEYS),
            where: notificationMessageDedupePredicate(notificationMessage),
          })
          .returning({ id: notificationMessage.id }),
      );
      return rows.map((row) => row.id);
    },

    async unreadTop(identity, limit) {
      const who = requireIdentity(identity);
      const mine = and(
        eq(notificationMessage.recipientUserId, who.userId),
        isNull(notificationMessage.deletedAt),
      );
      const unreadWhere = scopedWhere(notificationMessage, who, mine, isNull(notificationMessage.readAt));
      const [rows, totals] = await Promise.all([
        exec.select().from(notificationMessage).where(unreadWhere).orderBy(desc(notificationMessage.createdAt)).limit(limit),
        exec.select({ n: count() }).from(notificationMessage).where(unreadWhere),
      ]);
      return { rows, unread: Number(totals[0]?.n ?? 0) };
    },

    async listMessages(identity, filter, page, pageSize) {
      const who = requireIdentity(identity);
      const mine = and(
        eq(notificationMessage.recipientUserId, who.userId),
        isNull(notificationMessage.deletedAt),
      );
      const byStatus =
        filter === "unread"
          ? isNull(notificationMessage.readAt)
          : filter === "read"
            ? isNotNull(notificationMessage.readAt)
            : undefined;
      const where = scopedWhere(notificationMessage, who, mine, byStatus);
      const { offset, limit } = window(page, pageSize);
      const [rows, totals] = await Promise.all([
        exec.select().from(notificationMessage).where(where).orderBy(desc(notificationMessage.createdAt)).offset(offset).limit(limit),
        exec.select({ n: count() }).from(notificationMessage).where(where),
      ]);
      return { rows, total: Number(totals[0]?.n ?? 0) };
    },

    async getMessage(identity, id) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(notificationMessage)
        .where(
          scopedWhere(
            notificationMessage,
            who,
            eq(notificationMessage.id, id),
            eq(notificationMessage.recipientUserId, who.userId),
            isNull(notificationMessage.deletedAt),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) throw new NotificationNotFoundError("this message was not found; it may already have been deleted");
      return row;
    },

    /**
     * Mark all of **my** unread at once.
     *
     * 🔴 Do not reuse `markRead(ids)`: at 700+ unread the client would first page through 70 pages to collect every id
     * before it could call, and any one of those 70 round trips failing would leave half read and half unread.
     * "Mark all read" is one action, so it should be one statement.
     *
     * The scope stays pinned to `recipientUserId = me` — it reads its own inbox,
     * and it is not an admin action that can clear someone else's messages.
     */
    async markAllRead(identity, at) {
      const who = requireIdentity(identity);
      const rows = await guardWrite("mark all as read", async () =>
        await exec
          .update(notificationMessage)
          .set({ readAt: at })
          .where(
            scopedWhere(
              notificationMessage,
              who,
              eq(notificationMessage.recipientUserId, who.userId),
              isNull(notificationMessage.readAt),
              isNull(notificationMessage.deletedAt),
            ),
          )
          .returning({ id: notificationMessage.id }));
      return rows.length;
    },

    async markRead(identity, ids, at) {
      if (ids.length === 0) return 0;
      const who = requireIdentity(identity);
      const rows = await guardWrite("mark as read", async () =>
        await exec
          .update(notificationMessage)
          .set({ readAt: at })
          .where(
            scopedWhere(
              notificationMessage,
              who,
              inArray(notificationMessage.id, [...ids]),
              eq(notificationMessage.recipientUserId, who.userId),
              isNull(notificationMessage.readAt),
              isNull(notificationMessage.deletedAt),
            ),
          )
          .returning({ id: notificationMessage.id }),
      );
      return rows.length;
    },

    async removeMessages(identity, ids, at) {
      if (ids.length === 0) return 0;
      const who = requireIdentity(identity);
      const rows = await guardWrite("delete message", async () =>
        await exec
          .update(notificationMessage)
          .set({ deletedAt: at })
          .where(
            scopedWhere(
              notificationMessage,
              who,
              inArray(notificationMessage.id, [...ids]),
              eq(notificationMessage.recipientUserId, who.userId),
              isNull(notificationMessage.deletedAt),
            ),
          )
          .returning({ id: notificationMessage.id }),
      );
      return rows.length;
    },

    async enabledRulesAcrossTenants() {
      const rows = await exec
        .select()
        .from(notificationRule)
        .where(eq(notificationRule.status, "enabled"))
        .orderBy(asc(notificationRule.tenantId));
      return rows.map(ruleOf);
    },

    async markFired(ruleId, at) {
      await exec.update(notificationRule).set({ lastFiredAt: at }).where(eq(notificationRule.id, ruleId));
    },

    async claimTimedRun(ruleId, since, at) {
      const rows = await exec
        .update(notificationRule)
        .set({ lastFiredAt: at })
        .where(
          and(
            eq(notificationRule.id, ruleId),
            or(isNull(notificationRule.lastFiredAt), lt(notificationRule.lastFiredAt, since)),
          ),
        )
        .returning({ id: notificationRule.id });
      return rows.length > 0;
    },

    async recentlyNotified(tenantId, ruleId, billId, since) {
      const rows = await exec
        .select({ id: notificationMessage.id })
        .from(notificationMessage)
        .where(
          and(
            eq(notificationMessage.tenantId, tenantId),
            eq(notificationMessage.ruleId, ruleId),
            eq(notificationMessage.sourceBillId, billId),
            gte(notificationMessage.createdAt, since),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
  };
}
