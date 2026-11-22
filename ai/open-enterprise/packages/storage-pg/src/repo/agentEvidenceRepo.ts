// ---------------------------------------------------------------------------
// Evidence-snapshot repository (immutable physical evidence of agent tool results)
//
// Only three actions, put / get / reap, and **no list, no search** — that is deliberate.
// The reason for the table design, and the boundary with `oe_agent_call`, is written in the
// `agentEvidence` comment in `db/framework.ts`; only the most important sentence is repeated here:
//
// 🔴 **A point-read table, not a dataset.** Add a "list my evidence" method
// and it becomes an enumerable copy of business data, which is exactly what the `agentCall.detail` rule is against.
//
// There is no update either: physical evidence that has been changed is no longer physical evidence.
// ---------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { agentEvidence } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class AgentEvidenceError extends Error {
  override readonly name = "AgentEvidenceError";
}

function fail(message: string): never {
  throw new AgentEvidenceError(message);
}

/**
 * The snapshot body.
 *
 * `rows` are **business rows keyed in the user's language** (`{component, spec, demand, stock, gap}`), not internal field names —
 * the card renders them in the literal order of `columns` or the first row's keys, and it does not know any concrete field.
 * A wording change in the business then does not blank the card.
 */
export interface EvidencePayload {
  readonly title?: string;
  /** Explicit column order. When omitted, use the literal order of the first row's keys. */
  readonly columns?: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly [k: string]: unknown;
}

export interface EvidenceRecord {
  readonly traceId: string;
  readonly tool: string;
  readonly summary: string;
  readonly dataAt: Date;
  readonly evidence: EvidencePayload;
}

/**
 * How long it lives.
 *
 * 🔴 **Hours, not days.** It has one use: the user looks at this round's answer and checks whether the model was right.
 * That happens within a few minutes. Every step the TTL is lengthened, this table looks a bit more like a copy of business data
 * (see the comparison table in framework.ts). Two hours is left for "asked at noon, looked at once more in the afternoon".
 */
export const EVIDENCE_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Size cap of one snapshot, in characters.
 *
 * 🔴 This number is **far above** the model's 6000-character return budget, and that is why this table exists: the model only has room for a summary,
 * and the user wants the full set. It still needs a cap — if one `analysis_sql` scans a hundred thousand rows,
 * storing them would turn this short-lived table into a write source of unpredictable size, and the card cannot render that many either.
 * Over the cap, **truncate and say so inside the payload**. Do not drop it silently ("only 500 rows" and "500 rows in total" must stay distinguishable).
 */
export const EVIDENCE_MAX_CHARS = 512 * 1024;

/** `t_` plus 12 hex digits. Short enough to pass as-is in a conversation, wide enough not to collide. */
function newTraceId(): string {
  return `t_${randomBytes(6).toString("hex")}`;
}

export interface AgentEvidenceRepo {
  /** Store one snapshot and return its traceId. Failure **does not throw** — see the note in the implementation. */
  put(identity: Identity, input: {
    readonly tool: string;
    readonly summary: string;
    readonly evidence: EvidencePayload;
  }): Promise<string | null>;

  /** Point-read by id. Not mine, expired, or missing are all null (the three are not distinguished; see below). */
  get(identity: Identity, traceId: string): Promise<EvidenceRecord | null>;

  /** Purge expired snapshots. Returns how many rows were deleted. */
  reap(now: Date): Promise<number>;
}

export function createAgentEvidenceRepo(exec: Executor): AgentEvidenceRepo {
  return {
    async put(identity, input) {
      const who = requireIdentity(identity);
      const traceId = newTraceId();

      let payload: EvidencePayload = input.evidence;
      const size = JSON.stringify(payload)?.length ?? 0;
      if (size > EVIDENCE_MAX_CHARS) {
        // Cut rows until it fits, and write that fact into the payload — the card will show it.
        const rows = payload.rows;
        let kept = rows.length;
        while (kept > 0 && (JSON.stringify({ ...payload, rows: rows.slice(0, kept) })?.length ?? 0) > EVIDENCE_MAX_CHARS) {
          kept = Math.floor(kept * 0.8);
        }
        payload = { ...payload, rows: rows.slice(0, kept), truncated: true, totalRows: rows.length };
      }

      try {
        await exec.insert(agentEvidence).values(
          scopedValues(who, {
            id: traceId,
            actorId: who.userId,
            tool: input.tool,
            summary: input.summary,
            evidence: payload,
            expiresAt: new Date(Date.now() + EVIDENCE_TTL_MS),
          }),
        );
        return traceId;
      } catch (cause: unknown) {
        // 🔴 **If it cannot be stored, let it go, but say so loudly.**
        //
        // Evidence is a **gain**, not the output of this tool call: when it cannot be stored, the correct behavior is to return the result to
        // the model as usual (it can still answer), not to fail a whole business query because of an auxiliary table.
        //
        // But it must not be silent: silence looks like "the card always says the evidence cannot be fetched", while the tool is fine —
        // that gets read as a broken card, and nobody thinks this table is refusing the write.
        console.error(
          `[open-erp] evidence snapshot failed to store (tool "${input.tool}"); this answer will have no detail that can be checked:`,
          cause,
        );
        return null;
      }
    },

    async get(identity, traceId) {
      const who = requireIdentity(identity);
      if (!traceId.trim()) fail("traceId cannot be empty");

      const rows = await exec
        .select()
        .from(agentEvidence)
        .where(
          scopedWhere(
            agentEvidence,
            who,
            eq(agentEvidence.id, traceId),
            // 🔴 **actorId must be checked at the same time.** The physical evidence of a conversation belongs to the person who asked.
            // If only the tenant is checked, anyone who obtains a traceId (it appears in the conversation, logs, and screenshots)
            // can read another person's business data inside their query scope — and that data's row-level visibility was
            // computed **at fetch time** from the asker's identity, and cannot be recomputed when it is read.
            eq(agentEvidence.actorId, who.userId),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      // Treat expired as missing. **Do not** reply "expired" — that confirms "this id is real,
      // you are just late", and gives away an existence probe. The three cases are the same thing to the caller.
      if (row.expiresAt.getTime() <= Date.now()) return null;

      return {
        traceId: row.id,
        tool: row.tool,
        summary: row.summary,
        dataAt: row.dataAt,
        evidence: row.evidence as EvidencePayload,
      };
    },

    async reap(now: Date) {
      const deleted = await exec.delete(agentEvidence).where(lt(agentEvidence.expiresAt, now)).returning({ id: agentEvidence.id });
      return deleted.length;
    },
  };
}
