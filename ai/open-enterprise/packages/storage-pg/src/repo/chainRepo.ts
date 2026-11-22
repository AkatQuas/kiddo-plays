// ---------------------------------------------------------------------------
// Chain repository — the same rule as `flowRepo`: the declaration is the seed, and the tenant database is the source of truth
//
// No tenant row means this chain is still the product baseline as-is, not "write an identical copy at seed time".
// A pre-seeded copy becomes a second source of truth on product upgrade: product changes a segment of the baseline, the copy in the database
// does not move, and nothing turns red anywhere.
//
// The only difference from a flow: a chain has no lifecycle of its own. It is not what people use to get work done.
// It is one sentence, "these flows are strung together in this order" — reviewing it is meaningless. What must be reviewed is
// each flow inside it. So there is no status, no action, and no version-history table here.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { flowChain } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { applyWriteTimeouts, guardConcurrency } from "./pgError.js";
import type { Executor } from "./support.js";

export class ChainNotFoundError extends Error {
  override readonly name = "ChainNotFoundError";
}

export class ChainInputError extends Error {
  override readonly name = "ChainInputError";
}

export class ChainRevisionConflictError extends Error {
  override readonly name = "ChainRevisionConflictError";
  constructor(readonly code: string, readonly expectedRevision: number, readonly currentRevision: number) {
    super(
      `Chain "${code}" was changed by someone else (expected revision ${String(expectedRevision)}, ` +
        `current revision ${String(currentRevision)}). Refresh and save again.`,
    );
  }
}

export interface StoredChain {
  readonly code: string;
  readonly payload: Record<string, unknown>;
  readonly revision: number;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}

export interface ChainRepo {
  list(identity: Identity): Promise<readonly StoredChain[]>;
  get(identity: Identity, code: string): Promise<StoredChain | null>;
  /**
   * Store one version. `expectedRevision` is the optimistic lock: 0 means "this row is not in the database yet".
   *
   * Without the optimistic lock, two people editing one chain at once means the later save swallows the earlier person's change
   * whole, and both sides show save succeeded.
   */
  save(
    identity: Identity,
    code: string,
    expectedRevision: number,
    payload: Record<string, unknown>,
    at: Date,
  ): Promise<StoredChain>;
  /** Delete the one this factory added itself. Whether it is self-built is the caller's judgment — the repository does not know the declaration. */
  remove(identity: Identity, code: string): Promise<void>;
}

function toStored(row: {
  code: string;
  payload: unknown;
  revision: number;
  updatedAt: Date;
  updatedBy: string;
}): StoredChain {
  return {
    code: row.code,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    revision: row.revision,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export function createChainRepo(exec: Executor): ChainRepo {
  return {
    async list(identity) {
      const who = requireIdentity(identity);
      const rows = await exec.select().from(flowChain).where(scopedWhere(flowChain, who));
      return rows.map(toStored);
    },

    async get(identity, code) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(flowChain)
        .where(scopedWhere(flowChain, who, eq(flowChain.code, code)))
        .limit(1);
      const row = rows[0];
      return row ? toStored(row) : null;
    },

    async save(identity, code, expectedRevision, payload, at) {
      const who = requireIdentity(identity);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new ChainInputError("Chain content must be an object.");
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw new ChainInputError("expectedRevision must be a non-negative integer.");
      }
      return await guardConcurrency(`save chain "${code}"`, async () => await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        const rows = await tx
          .select()
          .from(flowChain)
          .where(scopedWhere(flowChain, who, eq(flowChain.code, code)))
          .for("update")
          .limit(1);
        const current = rows[0];
        const now = current?.revision ?? 0;
        if (now !== expectedRevision) {
          throw new ChainRevisionConflictError(code, expectedRevision, now);
        }
        const revision = now + 1;
        if (current === undefined) {
          await tx.insert(flowChain).values(scopedValues(who, {
            id: randomUUID(), code, payload, revision, updatedAt: at, updatedBy: who.userId,
          }));
        } else {
          await tx
            .update(flowChain)
            .set({ payload, revision, updatedAt: at, updatedBy: who.userId })
            .where(scopedWhere(flowChain, who, eq(flowChain.code, code)));
        }
        return { code, payload, revision, updatedAt: at, updatedBy: who.userId };
      }));
    },

    async remove(identity, code) {
      const who = requireIdentity(identity);
      await exec.transaction(async (tx) => {
        await applyWriteTimeouts(tx);
        await tx.delete(flowChain).where(scopedWhere(flowChain, who, eq(flowChain.code, code)));
      });
    },
  };
}
