// ---------------------------------------------------------------------------
// Operation-log repository
//
// append is called inside the business transaction (the executor holds this set rebound to tx).
// list can use the pool set: a query is not bound to one write in the same transaction.
//
// Filters live in one place, `operationLogListQuery`: the keyword touches only account and name,
// and the document number touches only the bill_code copied at write time. Time is half-open, modules are multi-select, and paging uses the caller's pageSize.
// Order is time descending, then id descending. It is not cut by org or by document data scope.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { count, desc, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import {
  assertNewOperationLog,
  operationLogActor,
  OperationLogQueryError,
  type Identity,
  type NewOperationLog,
  type OperationLogKind,
  type OperationLogPage,
  type OperationLogQuery,
  type OperationLogRow,
  type OperationLogStore,
} from "@open-erp/runtime-core";
import { requireIdentity } from "@open-erp/runtime-core";
import { operationLog } from "../db/framework.js";
import { zonedDayStart } from "../db/periodOpen.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

function nextCalendarYmd(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (match === null) throw new OperationLogQueryError(`operation time "${ymd}" is not YYYY-MM-DD`);
  const rolled = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const year = rolled.getUTCFullYear();
  const month = String(rolled.getUTCMonth() + 1).padStart(2, "0");
  const day = String(rolled.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStart(ymd: string, timeZone: string): Date {
  try {
    return zonedDayStart(ymd, timeZone);
  } catch (error) {
    const message = error instanceof Error ? error.message : `operation time "${ymd}" is not YYYY-MM-DD`;
    throw new OperationLogQueryError(message);
  }
}

/**
 * Fold a calendar day into a half-open instant in the deployment time zone. The `to` day is included; the upper bound is the next midnight.
 * The same day is valid. A start later than the end is refused.
 */
export function operationLogInstantRange(
  fromYmd: string | null,
  toYmd: string | null,
  timeZone: string,
): { readonly from: Date | null; readonly to: Date | null } {
  if (fromYmd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fromYmd)) {
    throw new OperationLogQueryError(`operation time "${fromYmd}" is not YYYY-MM-DD`);
  }
  if (toYmd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    throw new OperationLogQueryError(`operation time "${toYmd}" is not YYYY-MM-DD`);
  }
  if (fromYmd !== null && toYmd !== null && fromYmd > toYmd) {
    throw new OperationLogQueryError("the start date cannot be later than the end date");
  }
  return {
    from: fromYmd === null ? null : dayStart(fromYmd, timeZone),
    to: toYmd === null ? null : dayStart(nextCalendarYmd(toYmd), timeZone),
  };
}

/** ILIKE literal. `%`, `_`, and `\` match literally, matching the substring semantics of the in-memory filter. */
export function operationLogLikePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function rowOf(raw: typeof operationLog.$inferSelect): OperationLogRow {
  const at = raw.at instanceof Date ? raw.at : new Date(raw.at);
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    orgId: raw.orgId,
    actorUserId: raw.actorUserId,
    actorAccount: raw.actorAccount,
    actorName: raw.actorName,
    at,
    module: raw.module,
    billId: raw.billId,
    billCode: raw.billCode,
    kind: raw.kind as OperationLogKind,
    action: raw.action,
    agentId: raw.agentId,
  };
}

/** List predicate. The keyword does not touch user id or document number; the document number hits only bill_code. Time is half-open, and limit uses the query pageSize. */
export function operationLogListQuery(
  identity: Identity,
  query: OperationLogQuery,
): { readonly where: SQL; readonly limit: number; readonly offset: number } {
  const who = requireIdentity(identity);
  const filters: SQL[] = [];
  const keyword = query.keyword?.trim() ?? "";
  if (keyword !== "") {
    const pattern = operationLogLikePattern(keyword);
    const hit = or(ilike(operationLog.actorAccount, pattern), ilike(operationLog.actorName, pattern));
    if (hit) filters.push(hit);
  }
  const billCode = query.billCode?.trim() ?? "";
  if (billCode !== "") filters.push(ilike(operationLog.billCode, operationLogLikePattern(billCode)));
  if (query.from !== null) filters.push(gte(operationLog.at, query.from));
  if (query.to !== null) filters.push(lt(operationLog.at, query.to));
  if (query.modules.length > 0) filters.push(inArray(operationLog.module, [...query.modules]));
  return {
    where: scopedWhere(operationLog, who, ...filters),
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  };
}

export function createOperationLogRepo(exec: Executor): OperationLogStore {
  return {
    async append(identity: Identity, entry: NewOperationLog): Promise<void> {
      const who = requireIdentity(identity);
      assertNewOperationLog(entry);
      const actor = operationLogActor(identity);
      // This person is not in the directory: leave both columns empty. A failed lookup is not swallowed; the transaction fails with it.
      // The account directory is a generated table, so this does not statically import @open-erp/tables; userViewRepo in this package also queries oe_subject directly.
      const [person] = (await exec.execute(sql`
        select user_name as "userName", display_name as "displayName"
        from oe_subject
        where tenant_id = ${who.tenantId} and id = ${who.userId}
        limit 1
      `)) as unknown as readonly { userName: string; displayName: string }[];
      const account = person?.userName.trim() ?? "";
      const name = person?.displayName.trim() ?? "";
      await guardWrite("record an operation log", async () => {
        await exec.insert(operationLog).values(
          scopedValues(who, {
            id: randomUUID(),
            actorUserId: actor.userId,
            actorAccount: account === "" ? null : account,
            actorName: name === "" ? null : name,
            at: entry.at,
            module: entry.module,
            billId: entry.billId,
            billCode: entry.billCode,
            kind: entry.kind,
            action: entry.kind === "transition" ? entry.action : null,
            agentId: actor.agentId,
          }),
        );
      });
    },

    async list(identity: Identity, query: OperationLogQuery): Promise<OperationLogPage> {
      const page = operationLogListQuery(identity, query);
      const [rows, totals] = await Promise.all([
        exec
          .select()
          .from(operationLog)
          .where(page.where)
          .orderBy(desc(operationLog.at), desc(operationLog.id))
          .limit(page.limit)
          .offset(page.offset),
        exec.select({ n: count() }).from(operationLog).where(page.where),
      ]);
      return { rows: rows.map(rowOf), total: Number(totals[0]?.n ?? 0) };
    },
  };
}
