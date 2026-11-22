// ---------------------------------------------------------------------------
// Identity-gateway login state for the system job account — a cookie shared across replicas
//
// It does not enter assemble() / ExecutionRepos: this is not a document write, and it should not be tied to any business transaction.
// The login HTTP lives outside the repository; this table stores only the result and a lease of a few seconds.
// ---------------------------------------------------------------------------

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { runtimeLoginSession } from "../db/framework.js";
import type { Executor } from "./support.js";

export const RUNTIME_LOGIN_LEASE_MS = 15_000;

export interface RuntimeLoginRecord {
  readonly userId: string;
  readonly cookie: string;
}

export interface RuntimeLoginRepo {
  load(tenantId: string, username: string): Promise<RuntimeLoginRecord | null>;
  /**
   * Take the login lease. `expectedCookie` omitted = first time (take it only when there is no cookie yet);
   * when passed, take it only while the stored cookie is still this dead cookie (CAS refresh).
   */
  tryTakeLease(tenantId: string, username: string, expectedCookie?: string): Promise<boolean>;
  publish(tenantId: string, username: string, record: RuntimeLoginRecord): Promise<void>;
  abandonLease(tenantId: string, username: string): Promise<void>;
}

export function createRuntimeLoginRepo(exec: Executor): RuntimeLoginRepo {
  return {
    async load(tenantId, username) {
      const rows = await exec
        .select({
          userId: runtimeLoginSession.userId,
          cookie: runtimeLoginSession.cookie,
        })
        .from(runtimeLoginSession)
        .where(and(
          eq(runtimeLoginSession.tenantId, tenantId),
          eq(runtimeLoginSession.username, username),
        ))
        .limit(1);
      const row = rows[0];
      if (row === undefined || row.cookie === null || row.cookie === "" || row.userId === null || row.userId === "") {
        return null;
      }
      return { userId: row.userId, cookie: row.cookie };
    },

    async tryTakeLease(tenantId, username, expectedCookie) {
      const leaseUntil = new Date(Date.now() + RUNTIME_LOGIN_LEASE_MS);
      const expected = expectedCookie ?? null;
      const setWhere = and(
        or(
          and(sql`${expected}::text is null`, isNull(runtimeLoginSession.cookie)),
          sql`${runtimeLoginSession.cookie} is not distinct from ${expected}`,
        ),
        or(isNull(runtimeLoginSession.leaseUntil), sql`${runtimeLoginSession.leaseUntil} < now()`),
      );
      if (setWhere === undefined) throw new Error("Failed to build the login-lease condition.");
      const rows = await exec
        .insert(runtimeLoginSession)
        .values({ tenantId, username, leaseUntil })
        .onConflictDoUpdate({
          target: [runtimeLoginSession.tenantId, runtimeLoginSession.username],
          set: { leaseUntil },
          setWhere,
        })
        .returning({ tenantId: runtimeLoginSession.tenantId });
      return rows.length > 0;
    },

    async publish(tenantId, username, record) {
      await exec
        .update(runtimeLoginSession)
        .set({
          userId: record.userId,
          cookie: record.cookie,
          leaseUntil: null,
          loggedInAt: new Date(),
        })
        .where(and(
          eq(runtimeLoginSession.tenantId, tenantId),
          eq(runtimeLoginSession.username, username),
        ));
    },

    async abandonLease(tenantId, username) {
      await exec
        .update(runtimeLoginSession)
        .set({ leaseUntil: null })
        .where(and(
          eq(runtimeLoginSession.tenantId, tenantId),
          eq(runtimeLoginSession.username, username),
        ));
    },
  };
}
