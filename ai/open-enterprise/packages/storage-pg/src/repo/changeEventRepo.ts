import { stageBotDispatches } from "./botTaskRepo.js";
// ---------------------------------------------------------------------------
// Data-change outbox repository
//
// Two halves, with a clear boundary:
//   · `append` — write. runtime-core calls it inside the business transaction (see the changeEvent.ts header).
//   · `claimPending` / `markProcessed` — read. The notification worker calls them outside a transaction.
//
// 🔴 `claimPending` uses `FOR UPDATE SKIP LOCKED`: when several replicas scan the queue at once,
// each takes a disjoint batch, so nothing is delivered twice and nothing blocks the others. Without it, two pods would fight over the same rows,
// and the symptom is "one change sent two reminders" — which a single-replica test never shows.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, inArray, isNull, sql } from "drizzle-orm";
import type { ChangeEventKind, ChangeEventRepo, Identity, NewChangeEvent } from "@open-erp/runtime-core";
import { requireIdentity } from "@open-erp/runtime-core";
import { changeEvent } from "../db/framework.js";
import { scopedValues } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

/** One row in the queue. The worker consumes it to match rules. */
export interface ChangeEventRow {
  readonly id: string;
  readonly tenantId: string;
  readonly orgId: string;
  readonly module: string;
  readonly billId: string;
  readonly kind: ChangeEventKind;
  readonly transitionCode: string | null;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly changedFields: readonly string[] | null;
  /** Header of the deleted row. Set only when kind === 'delete'. */
  readonly deletedHeader: Readonly<Record<string, unknown>> | null;
  readonly actorId: string;
  readonly at: Date;
}

/**
 * Queue view on the worker side.
 *
 * 🔴 **Does not close across tenants**: the queue is the framework's own mechanism. The worker scans every tenant as the system,
 * then handles each row by the `tenantId` on it. The write side still binds the tenant axis through `scopedValues`.
 */
export interface ChangeEventQueue extends ChangeEventRepo {
  /** Take a pending batch and mark it processed in the same transaction. The caller delivers the rows it receives. */
  claimPending(limit: number, at: Date): Promise<readonly ChangeEventRow[]>;
  /** Purge processed history. The caller supplies the retention window so troubleshooting can still see the last few days. */
  purgeProcessed(before: Date): Promise<number>;
}

function rowOf(raw: typeof changeEvent.$inferSelect): ChangeEventRow {
  const fields = raw.changedFields;
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    orgId: raw.orgId,
    module: raw.module,
    billId: raw.billId,
    kind: raw.kind as ChangeEventKind,
    transitionCode: raw.transitionCode,
    fromStatus: raw.fromStatus,
    toStatus: raw.toStatus,
    changedFields: Array.isArray(fields) ? (fields as string[]) : null,
    deletedHeader: (raw.deletedHeader ?? null) as Readonly<Record<string, unknown>> | null,
    actorId: raw.actorId,
    at: raw.at,
  };
}

export function createChangeEventRepo(exec: Executor): ChangeEventQueue {
  return {
    async append(identity: Identity, event: NewChangeEvent): Promise<void> {
      const who = requireIdentity(identity);
      await guardWrite("record a data change", async () => {
        await exec.insert(changeEvent).values(
          scopedValues(who, {
            id: randomUUID(),
            module: event.module,
            billId: event.billId,
            kind: event.kind,
            transitionCode: event.transitionCode,
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            changedFields: event.changedFields === null ? null : [...event.changedFields],
            deletedHeader: (event.deletedHeader ?? null) as never,
            actorId: who.userId,
            at: event.at,
          }),
        );
      });
    },

    async claimPending(limit: number, at: Date): Promise<readonly ChangeEventRow[]> {
      if (!Number.isInteger(limit) || limit <= 0) return [];
      return await exec.transaction(async (tx) => {
        // The partial index `oe_change_event_pending_idx` covers only the pending rows,
        // so the cost of this scan does not depend on how much history has piled up.
        const rows = await tx
          .select()
          .from(changeEvent)
          .where(isNull(changeEvent.processedAt))
          .orderBy(asc(changeEvent.at))
          .limit(limit)
          .for("update", { skipLocked: true });
        if (rows.length === 0) return [];
        await stageBotDispatches(tx, rows.map(rowOf), at);
        await tx
          .update(changeEvent)
          .set({ processedAt: at })
          .where(inArray(changeEvent.id, rows.map((row) => row.id)));
        return rows.map(rowOf);
      });
    },

    async purgeProcessed(before: Date): Promise<number> {
      const rows = await exec
        .delete(changeEvent)
        .where(sql`${changeEvent.processedAt} is not null and ${changeEvent.processedAt} < ${before}`)
        .returning({ id: changeEvent.id });
      return rows.length;
    },
  };
}
