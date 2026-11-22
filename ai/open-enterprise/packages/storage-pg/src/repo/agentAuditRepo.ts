// ---------------------------------------------------------------------------
// Agent call-log repository
//
// 🔴 Append-only. This file has no update and no delete, for the same reason as the ledger:
// once a trace has been changed, it is no longer a trace.
//
// This and `auditRepo` are **two layers**, not two grains of the same thing —
// there the subject is a document (every row points back at one), here the subject is the caller (three tools have no document at all).
// The criterion and the cost are written in the `agentCall` comment in `db/framework.ts`.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { agentCall } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import {
  requireIdentity,
  type AgentAuditEntry,
  type AgentAuditSink,
  type Identity,
} from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class AgentAuditError extends Error {
  override readonly name = "AgentAuditError";
}

function fail(message: string): never {
  throw new AgentAuditError(message);
}

function authorizationCoordinate(value: unknown, label: string, id: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    fail(`call record ${String(id)} ${label} is not a non-empty string — the stored data is corrupt`);
  }
  return value;
}

/**
 * One persisted call record. It is read back for investigation ("what did this agent do today"),
 * and it does not participate in any decision.
 */
export interface AgentCallRow {
  readonly id: string;
  readonly tool: string;
  readonly operation: string;
  readonly agentId: string;
  readonly actorId: string;
  readonly policyVersion: string;
  readonly decisionId: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly outcome: "ok" | "error";
  readonly detail: string;
  readonly at: Date;
}

/** Read one row back. Corrupt stored data throws; do not guess — a half-read trace is worse than an unreadable one. */
function rowOf(raw: Record<string, unknown>): AgentCallRow {
  const at = raw["at"];
  if (!(at instanceof Date)) fail(`call record ${String(raw["id"])} timestamp is not a Date — the stored data is corrupt, and this does not guess`);
  const outcome = String(raw["outcome"]);
  if (outcome !== "ok" && outcome !== "error") {
    fail(`call record ${String(raw["id"])} outcome is "${outcome}" — only ok / error are valid`);
  }
  return {
    id: String(raw["id"]),
    tool: String(raw["tool"]),
    operation: String(raw["operation"]),
    agentId: String(raw["agentId"]),
    actorId: String(raw["actorId"]),
    policyVersion: authorizationCoordinate(raw["policyVersion"], "policyVersion", raw["id"]),
    decisionId: authorizationCoordinate(raw["decisionId"], "decisionId", raw["id"]),
    args: raw["args"] as Readonly<Record<string, unknown>>,
    outcome,
    detail: String(raw["detail"]),
    at,
  };
}

/**
 * Call-log repository.
 *
 * It implements `AgentAuditSink` (the agent layer only knows that narrow interface — it should not see `list`),
 * and adds a `list` for investigation.
 */
export interface AgentAuditRepo extends AgentAuditSink {
  /** Read back in reverse time order. `agentId` null means every agent. */
  list(identity: Identity, agentId: string | null, limit: number): Promise<readonly AgentCallRow[]>;
}

/** Cap on one read. The trace table grows fast; an unbounded list will eventually fill memory. */
export const AGENT_CALL_MAX_ROWS = 500;

export function createAgentAuditRepo(exec: Executor): AgentAuditRepo {
  return {
    async record(entry: AgentAuditEntry): Promise<void> {
      // 🔴 Identity comes from the entry, and it must be complete.
      // "If it cannot be recorded, skip it" is the most dangerous wording here: a missing audit has no outward symptom.
      const who = requireIdentity(entry.identity);
      if (!entry.agentId.trim()) {
        fail("call record is missing agentId — who called what, under which identity, does not hold if one axis is missing");
      }

      await exec.insert(agentCall).values(
        scopedValues(who, {
          id: randomUUID(),
          tool: entry.tool,
          operation: entry.operation,
          agentId: entry.agentId,
          actorId: who.userId,
          policyVersion: who.authorization.policyVersion,
          decisionId: who.authorization.decisionId,
          args: entry.args,
          outcome: entry.outcome,
          detail: entry.detail,
          at: entry.at,
        }),
      );
    },

    async list(identity: Identity, agentId: string | null, limit: number): Promise<readonly AgentCallRow[]> {
      const who = requireIdentity(identity);
      if (!Number.isInteger(limit) || limit < 1) fail(`limit must be a positive integer, received "${String(limit)}"`);
      if (limit > AGENT_CALL_MAX_ROWS) {
        // Truncating would answer "how many times did it call" with a number that is too small, and that number has no anomaly marker.
        fail(`limit ${limit} exceeds the cap ${AGENT_CALL_MAX_ROWS} — page for more; do not truncate silently`);
      }

      // An empty string is not "no filter": those are two different things, and mixing them turns a bad filter
      // into a full read whose data looks completely normal.
      if (agentId !== null && !agentId.trim()) {
        fail("agentId cannot be empty when filtering by agent — pass null explicitly to mean every agent");
      }

      const rows = await exec
        .select()
        .from(agentCall)
        .where(
          agentId === null
            ? scopedWhere(agentCall, who)
            : scopedWhere(agentCall, who, eq(agentCall.agentId, agentId)),
        )
        .orderBy(desc(agentCall.at))
        .limit(limit);

      return rows.map((r) => rowOf(r as unknown as Record<string, unknown>));
    },
  };
}
