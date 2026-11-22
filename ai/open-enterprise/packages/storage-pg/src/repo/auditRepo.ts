// ---------------------------------------------------------------------------
// Audit repository — the record that "this execution happened", and the idempotency criterion
//
// Store the full `checks` text, not only the verdict: an after-the-fact question is never "did it pass", it is
// "what number did that stock check see at the time". If only the verdict is stored, that question can never be answered.
//
// 🔴 Idempotency lives on this table, not on a separate dedup table: the fact "did this edge already run" already lives in the audit,
// and another table would be a second recording point for the same fact. When the two disagree, "did it actually run" cannot be answered.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { normalizeExecutionPlan, type CheckReport, type ExecutionPlan } from "@open-erp/metamodel";
import { auditLog } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { guardWrite } from "./pgError.js";
import type { AuditEntry, AuditRepo, NewAuditEntry } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class AuditError extends Error {
  override readonly name = "AuditError";
}

function fail(message: string): never {
  throw new AuditError(message);
}

function authorizationCoordinate(value: unknown, label: string, id: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    fail(`audit row ${String(id)} ${label} is not a non-empty string — the stored data is corrupt`);
  }
  return value;
}

function entryOf(raw: Record<string, unknown>): AuditEntry {
  const at = raw["at"];
  if (!(at instanceof Date)) fail(`audit row ${String(raw["id"])} timestamp is not a Date — the stored data is corrupt, and this does not guess`);
  const idempotencyRaw = raw["idempotencyKey"];
  if (idempotencyRaw !== null && typeof idempotencyRaw !== "string") {
    fail(`audit row ${String(raw["id"])} idempotencyKey is neither a string nor null — the stored data is corrupt`);
  }
  const planRaw = raw["executionPlan"];
  const fingerprintRaw = raw["planFingerprint"];
  if (planRaw === undefined || fingerprintRaw === undefined) {
    fail(`audit row ${String(raw["id"])} is missing the executionPlan / planFingerprint columns — the database migration has not caught up with the runtime`);
  }
  let executionPlan: ExecutionPlan | null;
  let planFingerprint: string | null;
  if (planRaw === null && fingerprintRaw === null) {
    executionPlan = null;
    planFingerprint = null;
  } else {
    if (planRaw === null || typeof fingerprintRaw !== "string" || !/^[0-9a-f]{64}$/.test(fingerprintRaw)) {
      fail(`audit row ${String(raw["id"])} ExecutionPlan and fingerprint are not a pair, or the fingerprint is not SHA-256`);
    }
    executionPlan = normalizeExecutionPlan(planRaw, `audit row ${String(raw["id"])}.executionPlan`);
    planFingerprint = fingerprintRaw;
  }

  return {
    id: String(raw["id"]),
    module: String(raw["module"]),
    billId: String(raw["billId"]),
    transitionCode: String(raw["transitionCode"]),
    fromStatus: String(raw["fromStatus"]),
    toStatus: String(raw["toStatus"]),
    verdict: String(raw["verdict"]),
    params: raw["params"] as Readonly<Record<string, unknown>>,
    checks: raw["checks"] as readonly CheckReport[],
    actorId: String(raw["actorId"]),
    policyVersion: authorizationCoordinate(raw["policyVersion"], "policyVersion", raw["id"]),
    decisionId: authorizationCoordinate(raw["decisionId"], "decisionId", raw["id"]),
    at,
    idempotencyKey: idempotencyRaw,
    executionPlan,
    planFingerprint,
  };
}

export function createAuditRepo(exec: Executor): AuditRepo {
  return {
    async find(
      identity: Identity,
      module: string,
      billId: string,
      transitionCode: string,
      idempotencyKey: string,
    ): Promise<AuditEntry | null> {
      const who = requireIdentity(identity);
      // 🔴 An empty key means there is no prior case to compare, so this is a miss.
      // NULLs are not equal to each other in that unique index. Two manual clicks are **two real operation intents**,
      // not a replay — matching an empty key against a historical audit whose key is NULL would swallow the second click.
      if (!idempotencyKey.trim()) return null;

      const rows = await exec
        .select()
        .from(auditLog)
        .where(
          scopedWhere(
            auditLog,
            who,
            eq(auditLog.module, module),
            eq(auditLog.billId, billId),
            eq(auditLog.transitionCode, transitionCode),
            eq(auditLog.idempotencyKey, idempotencyKey),
          ),
        )
        // The unique index guarantees at most one row; the sort only makes behavior definite if there ever were two.
        .orderBy(desc(auditLog.at))
        .limit(1);

      const row = rows[0] as Record<string, unknown> | undefined;
      return row ? entryOf(row) : null;
    },

    async list(identity: Identity, module: string, billId: string, limit: number): Promise<readonly AuditEntry[]> {
      const who = requireIdentity(identity);
      if (!Number.isInteger(limit) || limit < 1) {
        fail(`reading audit history: limit must be a positive integer, received "${String(limit)}"`);
      }
      const rows = await exec
        .select()
        .from(auditLog)
        .where(scopedWhere(auditLog, who, eq(auditLog.module, module), eq(auditLog.billId, billId)))
        // Newest first: a detail page asks "what was the last action, and why",
        // and "last time" is the first row in reverse time order. The caller should not have to page to find it.
        .orderBy(desc(auditLog.at))
        .limit(limit);
      return (rows as Record<string, unknown>[]).map(entryOf);
    },

    async append(identity: Identity, entry: NewAuditEntry): Promise<AuditEntry> {
      const who = requireIdentity(identity);
      const values = scopedValues(who, {
        id: randomUUID(),
        module: entry.module,
        billId: entry.billId,
        transitionCode: entry.transitionCode,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        verdict: entry.verdict,
        params: entry.params,
        checks: entry.checks,
        // 🔴 The actor is filled from identity at this layer, not taken from the argument: letting the caller set actorId
        // would allow a forged trace, and the forged row would look identical to a real one.
        actorId: who.userId,
        policyVersion: who.authorization.policyVersion,
        decisionId: who.authorization.decisionId,
        // Time comes from the clock the executor injects, not defaultNow(): the five tables written by one execution must line up to the same instant.
        at: entry.at,
        idempotencyKey: entry.idempotencyKey,
        executionPlan: entry.executionPlan,
        planFingerprint: entry.planFingerprint,
      });

      // A repeated request that carries a key hits the unique index and throws. That is the last line of defense:
      // the executor's find-then-append window cannot stop concurrency, and the database can.
      // There is **no** onConflictDoNothing here — silently skipping would make the caller think the write succeeded.
      const inserted = await guardWrite(
        `write audit (${entry.module} ${entry.transitionCode})`,
        async () => await exec.insert(auditLog).values(values).returning(),
      );
      const row = inserted[0] as Record<string, unknown> | undefined;
      if (!row) fail("writing the audit returned no inserted row — refusing to continue without a trace");
      return entryOf(row);
    },
  };
}
