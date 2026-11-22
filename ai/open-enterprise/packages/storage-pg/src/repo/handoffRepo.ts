// ---------------------------------------------------------------------------
// Handoff repository — runtime instances of todos, notices, and reminders
//
// `toRole` stores a **post role**, not a person: people leave and change posts, and a todo should not disappear with them.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, exists, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import {
  HANDOFF_TASK_OPEN_KEYS,
  handoffTask,
  handoffTaskOpenPredicate,
  pickColumns,
} from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { requireIdentity, roleCodesOf, type Identity } from "@open-erp/runtime-core";
import { moduleScopedWhere, type ModuleRegistry } from "./queryCompiler.js";
import type {
  HandoffPage,
  HandoffRepo,
  HandoffTaskRecord,
  NewHandoffTask,
} from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

/** Not finished. The partial unique index on the table uses this same predicate. */
const OPEN = "open";

export function createHandoffRepo(exec: Executor, registry: ModuleRegistry, timezone: string): HandoffRepo {
  if (!timezone.trim()) {
    throw new Error("handoff repository is missing a time zone — a relative time has no definite interval without one");
  }
  return {
    async list(identity, query): Promise<HandoffPage> {
      const who = requireIdentity(identity);
      // An empty role set or an empty authorized-module set is a **definite empty intersection**, not "not queried yet" — the total is 0 as well.
      if (who.roles.length === 0 || query.modules.length === 0) return { rows: [], total: 0 };
      const moduleCodes = [...new Set(query.modules)];
      const visibleBill: SQL[] = moduleCodes.map((code) => {
        const tables = registry.get(code);
        if (!who.dataScopes[code]) return sql`false`;
        return and(
          eq(handoffTask.module, code),
          exists(
            exec
              .select({ one: sql`1` })
              .from(tables.header)
              .where(moduleScopedWhere(tables, who, timezone, eq(tables.header.id, handoffTask.billId))),
          ),
        ) as SQL;
      });

      // Write the condition once: if count and the page each assemble their own, they will drift,
      // and the symptom is "it says 200 rows, and page 3 is empty", while each side looks correct alone.
      const where = scopedWhere(
        handoffTask,
        who,
        inArray(handoffTask.toRole, [...roleCodesOf(who)]),
        eq(handoffTask.status, OPEN),
        inArray(handoffTask.module, moduleCodes),
        visibleBill.length === 1 ? visibleBill[0] : or(...visibleBill),
        query.kind === null ? undefined : eq(handoffTask.kind, query.kind),
        query.dueBefore === null ? undefined : lte(handoffTask.dueAt, query.dueBefore),
      );
      const [counted] = await exec.select({ n: count() }).from(handoffTask).where(where);
      // A count query always returns one row. Getting none is something unexpected at the driver layer, and it must not be swallowed as 0 —
      // that would display "the query is broken" as "you have no todos".
      if (!counted) {
        // A bare Error, not RepoError: the latter maps to 400 "the caller's fault" in onError,
        // while a count that returns no row is a server fault and should be a 500 that lands in the log.
        throw new Error("handoff task count returned no row — a count query always has one row, so empty here means a driver-layer failure");
      }
      const total = counted.n;
      const rows = await exec
        .select()
        .from(handoffTask)
        .where(where)
        .orderBy(asc(handoffTask.dueAt), asc(handoffTask.createdAt), asc(handoffTask.id))
        .limit(query.limit)
        .offset(query.offset);
      const records = rows.map((row) => ({
        id: row.id,
        handoffId: row.handoffId,
        kind: row.kind as HandoffTaskRecord["kind"],
        module: row.module,
        billId: row.billId,
        toRole: row.toRole,
        title: row.title,
        dueAt: row.dueAt,
        status: row.status as HandoffTaskRecord["status"],
        createdAt: row.createdAt,
        doneAt: row.doneAt,
        doneBy: row.doneBy,
      }));
      return { rows: records, total };
    },

    async open(identity: Identity, tasks: readonly NewHandoffTask[]): Promise<void> {
      const who = requireIdentity(identity);
      // An edge that produces no handoff is normal, not an error.
      if (!tasks.length) return;

      const values = tasks.map((task) =>
        scopedValues(who, {
          id: randomUUID(),
          handoffId: task.handoffId,
          kind: task.kind,
          module: task.module,
          billId: task.billId,
          toRole: task.toRole,
          title: task.title,
          dueAt: task.dueAt,
          status: OPEN,
        }),
      );

      // 🔴 Dedup is left to the database **partial** unique index (oe_handoff_task_open_uq,
      // where status = 'open'), not to "select once then insert" here:
      // send-back then resubmit recomputes the same todo, and an application-level select-then-insert cannot stop concurrency,
      // so the recipient would see seven identical rows.
      //
      // Use do nothing rather than letting it throw: generating the same todo a second time is **normal business**,
      // not an error. Finished historical todos are not in this index, so a new one can be opened after the old one is done.
      await exec
        .insert(handoffTask)
        .values(values)
        .onConflictDoNothing({
          // Columns and predicate share one declaration with the index (see db/framework.ts):
          // a partial index must include the predicate in the conflict target, or PG will not know which index to use,
          // and a wrong predicate **does not error** — dedup just silently stops working.
          target: pickColumns(handoffTask, HANDOFF_TASK_OPEN_KEYS),
          where: handoffTaskOpenPredicate(handoffTask),
        });
    },

    async closeOpen(
      identity: Identity,
      module: string,
      billId: string,
      handoffIds: readonly string[],
    ): Promise<void> {
      const who = requireIdentity(identity);
      if (!handoffIds.length) return;

      // Cancel rather than mark done: these todos were not completed by a person, they **lost their meaning**
      // (the document has left that status). Once mixed into done, "did anyone actually do this" can never be told apart.
      await exec
        .update(handoffTask)
        .set({ status: "cancelled", doneAt: new Date(), doneBy: who.userId })
        .where(
          scopedWhere(
            handoffTask,
            who,
            eq(handoffTask.module, module),
            eq(handoffTask.billId, billId),
            inArray(handoffTask.handoffId, [...handoffIds]),
            // Touch only unfinished ones: a historical todo that is already done must not be rewritten later.
            eq(handoffTask.status, OPEN),
          ),
        );
    },
  };
}
