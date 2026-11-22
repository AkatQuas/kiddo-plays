// ---------------------------------------------------------------------------
// Agent round trace — "already matched / already table_commit", visible across replicas
//
// It does not enter assemble() / ExecutionRepos: a tool call and a document write are not the same thing,
// and they should not share a transaction boundary. A create that was rolled back must still leave this round's "already matched" mark.
// ---------------------------------------------------------------------------

import { eq, lt } from "drizzle-orm";
import { requireSubject, type SubjectIdentity } from "@open-erp/runtime-core";
import {
  ROUND_INTAKE_TTL_MS,
  agentRoundCommit,
  agentRoundMatch,
} from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import type { Executor } from "./support.js";

export interface RoundIntakeRepo {
  noteMatched(identity: SubjectIdentity, requestId: string): Promise<void>;
  hasMatched(identity: SubjectIdentity, requestId: string): Promise<boolean>;
  noteCommit(identity: SubjectIdentity, requestId: string, signature: string): Promise<void>;
  hasCommit(identity: SubjectIdentity, requestId: string, signature: string): Promise<boolean>;
}

function expiry(now: Date): Date {
  return new Date(now.getTime() + ROUND_INTAKE_TTL_MS);
}

export function createRoundIntakeRepo(exec: Executor): RoundIntakeRepo {
  return {
    async noteMatched(identity, requestId) {
      const who = requireSubject(identity);
      const now = new Date();
      await exec.delete(agentRoundMatch).where(lt(agentRoundMatch.expiresAt, now));
      await exec
        .insert(agentRoundMatch)
        .values(scopedValues(who, { requestId, expiresAt: expiry(now) }))
        .onConflictDoUpdate({
          target: [agentRoundMatch.tenantId, agentRoundMatch.requestId],
          set: { expiresAt: expiry(now) },
        });
    },

    async hasMatched(identity, requestId) {
      const who = requireSubject(identity);
      const now = new Date();
      const rows = await exec
        .select({ expiresAt: agentRoundMatch.expiresAt })
        .from(agentRoundMatch)
        .where(scopedWhere(
          agentRoundMatch,
          who,
          eq(agentRoundMatch.requestId, requestId),
        ))
        .limit(1);
      const expiresAt = rows[0]?.expiresAt;
      return expiresAt !== undefined && expiresAt.getTime() > now.getTime();
    },

    async noteCommit(identity, requestId, signature) {
      const who = requireSubject(identity);
      const now = new Date();
      await exec.delete(agentRoundCommit).where(lt(agentRoundCommit.expiresAt, now));
      await exec
        .insert(agentRoundCommit)
        .values(scopedValues(who, { requestId, signature, expiresAt: expiry(now) }))
        .onConflictDoUpdate({
          target: [agentRoundCommit.tenantId, agentRoundCommit.requestId, agentRoundCommit.signature],
          set: { expiresAt: expiry(now) },
        });
    },

    async hasCommit(identity, requestId, signature) {
      const who = requireSubject(identity);
      const now = new Date();
      const rows = await exec
        .select({ expiresAt: agentRoundCommit.expiresAt })
        .from(agentRoundCommit)
        .where(scopedWhere(
          agentRoundCommit,
          who,
          eq(agentRoundCommit.requestId, requestId),
          eq(agentRoundCommit.signature, signature),
        ))
        .limit(1);
      const expiresAt = rows[0]?.expiresAt;
      return expiresAt !== undefined && expiresAt.getTime() > now.getTime();
    },
  };
}
