// ---------------------------------------------------------------------------
// Business-flow repository — "the declaration is the seed, the tenant database is the source of truth"
//
// ## 🔴 No tenant row means this flow is still the product baseline, unchanged
//
// Word for word the same shape as `domains/*/authorization.ts`: the declarations under `flows/<domain>/` are
// the product baseline. A flow the factory has never touched **has no row in the database** — it is not "write an identical copy at seed time".
//
// Why not pre-seed: the pre-seeded copy becomes a second source of truth when the product baseline is upgraded. The product changes
// a step in the baseline, the copy in the database does not move, and nothing turns red — the factory still sees the old version
// and believes it is running the new one. **"Never touched" must mean "no row"**, and a read falls back to the declaration.
//
// ## 🔴 The state machine lives here, not on the route
//
// Six actions, four statuses, and who must give a reason are **one** declaration (`FLOW_ACTIONS`). HTTP uses it
// to decide which buttons to show, and the repository uses it to decide whether to allow the action — two copies end with a button that clicks and a backend that refuses.
//
// ## 🔴 A published flow cannot be edited directly
//
// To change it, `revise` first, back to authoring, and walk execution and review again. Otherwise the words "published" guarantee
// nothing: it might be the version reviewed three months ago, or a change someone made in passing yesterday.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  FLOW_ACTIONS,
  requireIdentity,
  type FlowAction,
  type FlowWorkStatus,
  type Identity,
} from "@open-erp/runtime-core";
import { flowRevision, flowState } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { applyWriteTimeouts, guardConcurrency } from "./pgError.js";
import type { Executor } from "./support.js";

export class FlowNotFoundError extends Error {
  override readonly name = "FlowNotFoundError";
}

export class FlowInputError extends Error {
  override readonly name = "FlowInputError";
}

export class FlowStateError extends Error {
  override readonly name = "FlowStateError";
}

export class FlowRevisionConflictError extends Error {
  override readonly name = "FlowRevisionConflictError";
  constructor(readonly code: string, readonly expectedRevision: number, readonly currentRevision: number) {
    super(
      `flow "${code}" was changed by someone else (expected revision ${String(expectedRevision)}, ` +
        `current revision ${String(currentRevision)}); refresh before saving`,
    );
  }
}

// 🔴 The state machine is not here. Four statuses, six actions, and who must give a reason are that **one** copy in
// `@open-erp/runtime-core` `contracts/flowLifecycle.ts`; this file only decides how to store them.
// Copying it again in the repository ends with HTTP showing buttons from one set and the repository allowing another,
// and the symptom is a button that clicks, a request that is refused, and a user who has no idea what they did wrong.

/** The copy this tenant changed. `revision` starts at 1; when this record is absent the caller falls back to the declaration. */
export interface StoredFlow {
  readonly code: string;
  readonly status: FlowWorkStatus;
  /** The editable part (label / purpose / owner / triggerWords / entry / steps). */
  readonly payload: Record<string, unknown>;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

export interface FlowRevisionEntry {
  readonly revision: number;
  readonly status: FlowWorkStatus;
  readonly action: string;
  readonly reason: string | null;
  readonly actorId: string;
  readonly at: Date;
}

export interface FlowRepo {
  /** Every flow this tenant changed. Untouched ones are not here — the caller merges by code with the declaration. */
  list(identity: Identity): Promise<readonly StoredFlow[]>;
  get(identity: Identity, code: string): Promise<StoredFlow | null>;
  revisions(identity: Identity, code: string): Promise<readonly FlowRevisionEntry[]>;
  /**
   * Save content. **Allowed only while authoring**.
   *
   * `expectedRevision` 0 means the caller believes there is no row yet (the first edit of the product baseline).
   * `seedStatus` then decides the new row's starting status — the caller derives it from the declaration and passes it in,
   * and the repository does not know the declaration.
   */
  save(
    identity: Identity,
    code: string,
    expectedRevision: number,
    payload: Record<string, unknown>,
    at: Date,
  ): Promise<StoredFlow>;
  /** Take one action. Content does not change; only the status changes, and a trace is kept. */
  act(
    identity: Identity,
    code: string,
    action: FlowAction,
    reason: string | null,
    at: Date,
    /** When there is no row yet, use this as the first version's content (from the product baseline). */
    seedPayload: Record<string, unknown>,
    /** When there is no row yet, its current status (derived from the declaration). */
    seedStatus: FlowWorkStatus,
  ): Promise<StoredFlow>;
  /**
   * Delete the one this factory added itself.
   *
   * 🔴 **Delete only self-built ones, and only unpublished ones**, and both are judged by the caller (the repository does not know the declaration).
   * A flow in the product baseline cannot be deleted: deleting the tenant row only returns it to the baseline as-is,
   * while the person believes they deleted a flow — the next time they open it, it is there again.
   */
  remove(identity: Identity, code: string): Promise<void>;
}

function toStored(row: {
  code: string;
  status: string;
  payload: unknown;
  revision: number;
  updatedAt: Date;
  updatedBy: string;
}): StoredFlow {
  return {
    code: row.code,
    status: row.status as FlowWorkStatus,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    revision: row.revision,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

function assertPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FlowInputError("flow content must be an object");
  }
  return payload as Record<string, unknown>;
}

export function createFlowRepo(exec: Executor): FlowRepo {
  return {
    async list(identity) {
      const who = requireIdentity(identity);
      const rows = await exec.select().from(flowState).where(scopedWhere(flowState, who));
      return rows.map(toStored);
    },

    async get(identity, code) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(flowState)
        .where(scopedWhere(flowState, who, eq(flowState.code, code)))
        .limit(1);
      const row = rows[0];
      return row ? toStored(row) : null;
    },

    async revisions(identity, code) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(flowRevision)
        .where(scopedWhere(flowRevision, who, eq(flowRevision.code, code)))
        .orderBy(asc(flowRevision.revision));
      return rows.map((row) => ({
        revision: row.revision,
        status: row.status as FlowWorkStatus,
        action: row.action,
        reason: row.reason,
        actorId: row.actorId,
        at: row.at,
      }));
    },

    async save(identity, code, expectedRevision, payload, at) {
      const who = requireIdentity(identity);
      const body = assertPayload(payload);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw new FlowInputError("expectedRevision must be a non-negative integer");
      }

      return await guardConcurrency(`save flow "${code}"`, async () => await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        const rows = await tx
          .select()
          .from(flowState)
          .where(scopedWhere(flowState, who, eq(flowState.code, code)))
          .for("update")
          .limit(1);
        const current = rows[0];
        const currentRevision = current?.revision ?? 0;
        if (currentRevision !== expectedRevision) {
          throw new FlowRevisionConflictError(code, expectedRevision, currentRevision);
        }
        // 🔴 Content may be changed only while "draft". A published flow must revise back first —
        // otherwise "published" guarantees nothing. When there is no row yet it is the product baseline,
        // and it likewise cannot be edited directly: the caller must revise first to create the first version.
        if (current === undefined) {
          throw new FlowStateError(
            `flow "${code}" is still the product baseline and cannot be edited directly — use "revise this flow" first to bring it back to authoring`,
          );
        }
        if (current.status !== "draft") {
          throw new FlowStateError(
            `flow "${code}" is currently "${current.status}", and its content cannot be changed. ` +
              `A published flow must use "revise this flow" first; one pending review must be rejected first`,
          );
        }

        const revision = currentRevision + 1;
        await tx
          .update(flowState)
          .set({ payload: body, revision, updatedAt: at, updatedBy: who.userId })
          .where(scopedWhere(flowState, who, eq(flowState.code, code)));
        await tx.insert(flowRevision).values(scopedValues(who, {
          id: randomUUID(),
          code,
          revision,
          status: "draft",
          action: "save",
          reason: null,
          payload: body,
          actorId: who.userId,
          at,
        }));
        return {
          code,
          status: "draft" as const,
          payload: body,
          revision,
          updatedAt: at,
          updatedBy: who.userId,
        };
      }));
    },

    async remove(identity, code) {
      const who = requireIdentity(identity);
      await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        await tx.delete(flowRevision).where(scopedWhere(flowRevision, who, eq(flowRevision.code, code)));
        await tx.delete(flowState).where(scopedWhere(flowState, who, eq(flowState.code, code)));
      });
    },

    async act(identity, code, action, reason, at, seedPayload, seedStatus) {
      const who = requireIdentity(identity);
      const spec = FLOW_ACTIONS[action];
      const trimmed = reason?.trim() ?? "";
      if (spec.needReason && trimmed === "") {
        throw new FlowInputError(`"${spec.label}" requires a reason — without one, the next person can only go ask, and they may not be able to reach anyone`);
      }
      const seed = assertPayload(seedPayload);

      return await guardConcurrency(`flow "${code}" ${spec.label}`, async () => await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        const rows = await tx
          .select()
          .from(flowState)
          .where(scopedWhere(flowState, who, eq(flowState.code, code)))
          .for("update")
          .limit(1);
        const current = rows[0];
        const status = (current?.status ?? seedStatus) as FlowWorkStatus;
        if (!(spec.from as readonly string[]).includes(status)) {
          throw new FlowStateError(
            `flow "${code}" is currently "${status}", and "${spec.label}" cannot be taken — ` +
              `this action can start only from ${spec.from.join(" / ")}`,
          );
        }

        const revision = (current?.revision ?? 0) + 1;
        // Content does not change: an action only changes status. When there is no row yet, the product baseline is the first version's content —
        // so the first version created by "revise this flow" matches the baseline word for word, and the diff is clean.
        const payload = current ? ((current.payload ?? {}) as Record<string, unknown>) : seed;

        if (current) {
          await tx
            .update(flowState)
            .set({ status: spec.to, revision, updatedAt: at, updatedBy: who.userId })
            .where(scopedWhere(flowState, who, eq(flowState.code, code)));
        } else {
          await tx.insert(flowState).values(scopedValues(who, {
            id: randomUUID(),
            code,
            status: spec.to,
            payload,
            revision,
            updatedAt: at,
            updatedBy: who.userId,
          }));
        }
        await tx.insert(flowRevision).values(scopedValues(who, {
          id: randomUUID(),
          code,
          revision,
          status: spec.to,
          action,
          reason: trimmed === "" ? null : trimmed,
          payload,
          actorId: who.userId,
          at,
        }));
        return { code, status: spec.to, payload, revision, updatedAt: at, updatedBy: who.userId };
      }));
    },
  };
}
