// ---------------------------------------------------------------------------
// Assistant "recipes" — the read-only commands that succeeded inside one long question-and-answer round
//
// The table's boundary and isolation rules are written on `agentRecipe` in `db/framework.ts`. Read that first.
//
// It does not enter assemble() / ExecutionRepos: it shares no transaction boundary with a document write,
// and it should not — emptying this table changes no business behavior.
// ---------------------------------------------------------------------------

import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requireSubject, type SubjectIdentity } from "@open-erp/runtime-core";
import { AGENT_RECIPE_TTL_MS, agentRecipe } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import type { Executor } from "./support.js";

export interface AgentRecipeRow {
  readonly id: string;
  readonly requestId: string;
  readonly ask: string;
  readonly askKey: string;
  readonly steps: readonly unknown[];
  readonly callCount: number;
  readonly errorCount: number;
  readonly lastOk: boolean;
  readonly startedAt: Date;
  readonly lastAt: Date;
  readonly hits: number;
}

export interface AgentRecipeRepo {
  /** Opening of a round (when the user's words arrive). Opening the same round again does not overwrite those words. */
  open(
    identity: SubjectIdentity,
    input: { readonly agentId: string; readonly requestId: string; readonly ask: string; readonly askKey: string; readonly at: Date },
  ): Promise<void>;
  /** One command inside the same round. If this round never opened (the original words are unavailable), record nothing. */
  append(
    identity: SubjectIdentity,
    input: { readonly requestId: string; readonly step: unknown; readonly ok: boolean; readonly maxSteps: number; readonly at: Date },
  ): Promise<void>;
  /** This person's recent rounds on this assistant, excluding the current round. */
  recent(
    identity: SubjectIdentity,
    input: { readonly agentId: string; readonly excludeRequestId: string; readonly limit: number; readonly at: Date },
  ): Promise<readonly AgentRecipeRow[]>;
  /** Handed to the model once: count it and extend the expiry. */
  touch(identity: SubjectIdentity, id: string, at: Date): Promise<void>;
}

const expiry = (at: Date): Date => new Date(at.getTime() + AGENT_RECIPE_TTL_MS);

export function createAgentRecipeRepo(exec: Executor): AgentRecipeRepo {
  return {
    async open(identity, input) {
      const who = requireSubject(identity);
      await exec.delete(agentRecipe).where(lt(agentRecipe.expiresAt, input.at));
      await exec
        .insert(agentRecipe)
        .values(scopedValues(who, {
          id: `rcp_${randomUUID().replace(/-/g, "")}`,
          actorId: who.userId,
          agentId: input.agentId,
          requestId: input.requestId,
          ask: input.ask,
          askKey: input.askKey,
          steps: [],
          startedAt: input.at,
          lastAt: input.at,
          expiresAt: expiry(input.at),
        }))
        .onConflictDoNothing({ target: [agentRecipe.tenantId, agentRecipe.requestId] });
    },

    async append(identity, input) {
      const who = requireSubject(identity);
      // One statement: commands that arrive concurrently (Promise.all inside a cell) each append atomically and do not overwrite each other.
      await exec
        .update(agentRecipe)
        .set({
          steps: sql`CASE WHEN jsonb_array_length(${agentRecipe.steps}) < ${input.maxSteps}
            THEN ${agentRecipe.steps} || ${JSON.stringify([input.step])}::jsonb ELSE ${agentRecipe.steps} END`,
          callCount: sql`${agentRecipe.callCount} + 1`,
          errorCount: sql`${agentRecipe.errorCount} + ${input.ok ? 0 : 1}`,
          lastOk: input.ok,
          lastAt: input.at,
          expiresAt: expiry(input.at),
        })
        .where(scopedWhere(
          agentRecipe,
          who,
          eq(agentRecipe.requestId, input.requestId),
          // The same round still checks the actor: the request id comes from the other side, and is not proof of ownership.
          eq(agentRecipe.actorId, who.userId),
        ));
    },

    async recent(identity, input) {
      const who = requireSubject(identity);
      const rows = await exec
        .select()
        .from(agentRecipe)
        .where(scopedWhere(
          agentRecipe,
          who,
          eq(agentRecipe.actorId, who.userId),
          eq(agentRecipe.agentId, input.agentId),
          ne(agentRecipe.requestId, input.excludeRequestId),
          gt(agentRecipe.expiresAt, input.at),
        ))
        .orderBy(desc(agentRecipe.lastAt))
        .limit(input.limit);
      return rows.map((row) => ({
        id: row.id,
        requestId: row.requestId,
        ask: row.ask,
        askKey: row.askKey,
        steps: Array.isArray(row.steps) ? (row.steps as unknown[]) : [],
        callCount: row.callCount,
        errorCount: row.errorCount,
        lastOk: row.lastOk,
        startedAt: row.startedAt,
        lastAt: row.lastAt,
        hits: row.hits,
      }));
    },

    async touch(identity, id, at) {
      const who = requireSubject(identity);
      await exec
        .update(agentRecipe)
        .set({ hits: sql`${agentRecipe.hits} + 1`, expiresAt: expiry(at) })
        .where(and(scopedWhere(agentRecipe, who, eq(agentRecipe.id, id), eq(agentRecipe.actorId, who.userId))));
    },
  };
}
