// ---------------------------------------------------------------------------
// Staged-action repository — where "the agent only produces a draft, and a person confirms before it is stored" lands
//
// The write path therefore splits in two:
//   agent → propose (writes this table, **does not touch business data**)
//   person → decide('confirmed') → the executor runs evaluate → execute (actually stored)
//
// 🔴 Idempotency is on the propose side, not on the caller. Model retries are normal (timeout, context truncation, self-doubt),
// and if every caller dedups on its own, one of them will forget, and the person sees three identical todos.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { normalizeExecutionPlan, type ExecutionPlan, type TransitionDecision } from "@open-erp/metamodel";
import { pickColumns, stagedAction, STAGED_ACTION_IDEM_KEYS } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { requireIdentity, StagedActionError, STAGED_STATUS_LABELS, type Identity } from "@open-erp/runtime-core";
import type { StagedActionRecord, StagedActionRepo } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export { StagedActionError };

function fail(message: string, httpStatus: 400 | 409 = 400): never {
  throw new StagedActionError(message, httpStatus);
}

const STATUSES: readonly StagedActionRecord["status"][] = ["pending", "confirmed", "rejected", "expired"];

function recordOf(raw: Record<string, unknown>): StagedActionRecord {
  const status = raw["status"];
  if (typeof status !== "string" || !STATUSES.includes(status as StagedActionRecord["status"])) {
    fail(`staged action ${String(raw["id"])} status "${String(status)}" is not in the closed set — the stored data is corrupt, and this does not guess`);
  }
  const planRaw = raw["executionPlan"];
  const fingerprintRaw = raw["planFingerprint"];
  const proposedRevisionRaw = raw["proposedRevision"];
  if (planRaw === undefined || fingerprintRaw === undefined || proposedRevisionRaw === undefined) {
    fail(
      `staged action ${String(raw["id"])} is missing the executionPlan / planFingerprint / proposedRevision columns — ` +
        `the database migration has not caught up with the runtime`,
    );
  }
  if (
    proposedRevisionRaw !== null &&
    (typeof proposedRevisionRaw !== "number" || !Number.isInteger(proposedRevisionRaw) || proposedRevisionRaw < 1)
  ) {
    fail(
      `staged action ${String(raw["id"])} proposedRevision must be a positive integer or null, ` +
        `received ${JSON.stringify(proposedRevisionRaw)} — the stored data is corrupt, and this does not guess`,
    );
  }
  let executionPlan: ExecutionPlan | null;
  let planFingerprint: string | null;
  if (planRaw === null && fingerprintRaw === null) {
    executionPlan = null;
    planFingerprint = null;
  } else {
    if (planRaw === null || typeof fingerprintRaw !== "string" || !/^[0-9a-f]{64}$/.test(fingerprintRaw)) {
      fail(
        `staged action ${String(raw["id"])} executionPlan / planFingerprint are not a pair, ` +
          `or the fingerprint is not 64 lowercase hex digits — the stored data is corrupt, and this does not guess`,
      );
    }
    executionPlan = normalizeExecutionPlan(planRaw, `staged action ${String(raw["id"])}.executionPlan`);
    planFingerprint = fingerprintRaw;
  }
  return {
    id: String(raw["id"]),
    module: String(raw["module"]),
    billId: String(raw["billId"]),
    transitionCode: String(raw["transitionCode"]),
    params: raw["params"] as Readonly<Record<string, unknown>>,
    // decision is the judgment computed at propose time, stored as-is and loaded as-is.
    // The executor re-evaluates and compares before execute — without that comparison, "the approver saw A, and what was stored is B".
    decision: raw["decision"] as TransitionDecision,
    proposedRevision: proposedRevisionRaw,
    executionPlan,
    planFingerprint,
    proposedBy: String(raw["proposedBy"]),
    reason: String(raw["reason"]),
    status: status as StagedActionRecord["status"],
  };
}

export function createStagedRepo(exec: Executor): StagedActionRepo {
  const findOne = async (identity: Identity, id: string): Promise<StagedActionRecord | null> => {
    const rows = await exec
      .select()
      .from(stagedAction)
      .where(scopedWhere(stagedAction, identity, eq(stagedAction.id, id)))
      .limit(1);
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? recordOf(row) : null;
  };

  return {
    async propose(
      identity: Identity,
      input: Omit<StagedActionRecord, "id" | "status"> & { readonly idempotencyKey: string },
    ): Promise<StagedActionRecord> {
      const who = requireIdentity(identity);
      if (!input.idempotencyKey.trim()) {
        fail("propose: idempotencyKey cannot be empty — without it, one retry becomes a second todo");
      }

      const values = scopedValues(who, {
        id: randomUUID(),
        module: input.module,
        billId: input.billId,
        transitionCode: input.transitionCode,
        params: input.params,
        decision: input.decision,
        proposedRevision: input.proposedRevision,
        executionPlan: input.executionPlan,
        planFingerprint: input.planFingerprint,
        proposedBy: input.proposedBy,
        reason: input.reason,
        status: "pending" satisfies StagedActionRecord["status"],
        idempotencyKey: input.idempotencyKey,
      });

      // 🔴 Dedup uses the database unique index, not "select then insert": the latter cannot stop concurrency,
      // and a model retry is exactly when concurrency happens.
      //
      // 🔴 `target` and `oe_staged_action_idem_uq` share **the same** column declaration
      // (`stagedActionIdemColumns`, the whole coordinate: tenant × module × document × edge × key).
      // Copying it by hand was measured: writing only (tenant × key) makes PG reject the whole statement
      // (`there is no unique or exclusion constraint matching the ON CONFLICT
      // specification`), so **every agent proposal 500s** — and it looks like "staged actions are broken",
      // not like "two column lists drifted". Stub tests stay green: only a real database checks the ON CONFLICT columns.
      const inserted = await exec
        .insert(stagedAction)
        .values(values)
        .onConflictDoNothing({ target: pickColumns(stagedAction, STAGED_ACTION_IDEM_KEYS) })
        .returning();
      const row = inserted[0] as Record<string, unknown> | undefined;
      if (row) return recordOf(row);

      // 🔴 The lookup condition uses the same coordinate as `target` above. Looking up by key alone
      // can hit **another document** (the key is model-generated, and "approve-1" gets reused on a second document),
      // and the coordinate check below would then have to do the database's dedup job — the criterion written in two places will drift.
      const existing = await exec
        .select()
        .from(stagedAction)
        .where(
          scopedWhere(
            stagedAction,
            who,
            and(
              eq(stagedAction.module, input.module),
              eq(stagedAction.billId, input.billId),
              eq(stagedAction.transitionCode, input.transitionCode),
              eq(stagedAction.idempotencyKey, input.idempotencyKey),
            ),
          ),
        )
        .limit(1);
      const found = existing[0] as Record<string, unknown> | undefined;
      if (!found) {
        fail(`propose: idempotencyKey "${input.idempotencyKey}" was rejected by a conflict, but the existing row cannot be found — the database state is inconsistent`);
      }
      const hit = recordOf(found);

      // 🔴 After a hit, **still** check the coordinate, even though the index and the lookup condition already guarantee it.
      //
      // Keeping it is not redundancy: it guards the **business rule** that "the same key can be used on only one action".
      // The key is **model-generated**, and reuse is expected ("approve-1" gets used on a second document).
      // After the index became the whole coordinate, a reused key on a different document inserts its own row —
      // that is correct (two real proposals), and this check is the last line of defense if someone narrows the lookup:
      // once the lookup falls back to "key only", a proposal for order B silently returns order A's draft,
      // the model replies "submitted for review on order B", the inbox shows A,
      // confirming executes A, and B never entered the todo list — zero errors on either side.
      if (hit.module !== input.module || hit.billId !== input.billId || hit.transitionCode !== input.transitionCode) {
        fail(
          `propose: idempotencyKey "${input.idempotencyKey}" is already taken by ${hit.module}#${hit.billId} ` +
            `"${hit.transitionCode}", and this proposal is ${input.module}#${input.billId} ` +
            `"${input.transitionCode}" — the same key can be used on only one action, so resubmit with a different key`,
        );
      }
      return hit;
    },

    async listPending(identity: Identity, module: string | null): Promise<readonly StagedActionRecord[]> {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(stagedAction)
        .where(
          scopedWhere(
            stagedAction,
            who,
            eq(stagedAction.status, "pending"),
            module === null ? undefined : eq(stagedAction.module, module),
          ),
        )
        // Earlier proposals are seen first; when proposedAt ties, id makes a total order.
        .orderBy(asc(stagedAction.proposedAt), asc(stagedAction.id));
      return (rows as Record<string, unknown>[]).map(recordOf);
    },

    async get(identity: Identity, id: string): Promise<StagedActionRecord> {
      const who = requireIdentity(identity);
      const found = await findOne(who, id);
      if (!found) fail(`there is no staged action with id "${id}" (or it is not in the current tenant)`);
      return found;
    },

    async decide(
      identity: Identity,
      id: string,
      decision: "confirmed" | "rejected",
      rejectReason: string | null,
    ): Promise<StagedActionRecord> {
      const who = requireIdentity(identity);
      if (decision === "confirmed" && rejectReason !== null) {
        fail("decide: confirm does not accept a rejection reason — a record that is both confirmed and has a rejection reason has no reading");
      }

      // The condition includes status='pending': the decision is stored only once. The same decision already stored is returned as-is
      // (confirm is an idempotent command: two concurrent clicks / a retry must not paint the second one as a failure).
      const updated = await exec
        .update(stagedAction)
        .set({
          status: decision,
          decidedAt: new Date(),
          decidedBy: who.userId,
          rejectReason,
        })
        .where(scopedWhere(stagedAction, who, eq(stagedAction.id, id), eq(stagedAction.status, "pending")))
        .returning();

      const row = updated[0] as Record<string, unknown> | undefined;
      if (!row) {
        const existing = await findOne(who, id);
        if (!existing) fail(`there is no staged action with id "${id}" (or it is not in the current tenant)`);
        if (existing.status === decision) return existing;
        // User-facing: status uses the display name (do not leak pending/rejected enum keys); id is internal and stays out of the user copy.
        fail(
          `this staged action is currently "${STAGED_STATUS_LABELS[existing.status]}", ` +
          `and cannot be changed to "${STAGED_STATUS_LABELS[decision]}"`,
          409,
        );
      }
      return recordOf(row);
    },
  };
}
