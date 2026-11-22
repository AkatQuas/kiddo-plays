// ---------------------------------------------------------------------------
// Tenant skill repository — agent catalog and full-text reads of enabled tenant procedures
//
// 🔴 **Deliberately not inside `assemble()`**, same criterion as `agentAuditRepo`: repos there get
// rebound onto tx by `transaction()`, and a tenant skill is not part of any single document write.
// The wiring point is `main.ts` (`buildApp`); routes take it from deps.
//
// 🔴 Isolation is one layer of `scopedWhere` (tenant), **not** `moduleScopedWhere`:
// this is not a module table and has no data scope. The read side is not cut by post (a skill is knowledge, not a permission; see `agent/skills.ts`).
// The connection uses service_role and bypasses RLS, so the application layer is the only line of defense. There is no query here
// that omits `scopedWhere`.
//
// The read path splits in two, with different column sets:
//   · `listEnabled` looks only at `enabled = true` and does not select the body column.
//   · `findEnabled` fetches one row by name, including the body. Disabled or missing returns `null`.
// ---------------------------------------------------------------------------

import { asc, eq } from "drizzle-orm";
import { agentSkill } from "../db/framework.js";
import { scopedWhere } from "../db/scope.js";
import { requireIdentity, type Identity, type TenantSkillRecord } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";

export class AgentSkillError extends Error {
  override readonly name = "AgentSkillError";
}

function fail(message: string): never {
  throw new AgentSkillError(message);
}

/**
 * `trigger_words` is jsonb and stores `string[]`.
 *
 * 🔴 A bad shape throws on the spot and does not degrade to an empty array: a silent empty array would drop retrieval weighting
 * while the procedure is still in the catalog.
 */
function triggerWordsOf(raw: unknown, name: string): readonly string[] {
  if (!Array.isArray(raw)) {
    fail(`tenant skill "${name}" triggerWords is not an array (actual ${JSON.stringify(raw)}) — the stored data is corrupt`);
  }
  return raw.map((word, index) => {
    if (typeof word !== "string") {
      fail(`tenant skill "${name}" triggerWords[${String(index)}] is not a string (actual ${JSON.stringify(word)})`);
    }
    return word;
  });
}

export interface AgentSkillRepo {
  /** Agent catalog: this tenant's **enabled** skills, without the body. */
  listEnabled(identity: Identity): Promise<readonly TenantSkillRecord[]>;
  /** Agent full text: fetch one row by name, including the body. Disabled or missing returns `null`. */
  findEnabled(identity: Identity, name: string): Promise<TenantSkillRecord | null>;
}

export function createAgentSkillRepo(exec: Executor): AgentSkillRepo {
  const requireName = (name: string, what: string): string => {
    if (!name.trim()) fail(`${what}: missing name`);
    return name;
  };

  return {
    async listEnabled(identity: Identity): Promise<readonly TenantSkillRecord[]> {
      const who = requireIdentity(identity);
      const rows = await exec
        .select({
          name: agentSkill.name,
          description: agentSkill.description,
          wireVersion: agentSkill.wireVersion,
          triggerWords: agentSkill.triggerWords,
        })
        .from(agentSkill)
        // 🔴 Enabled/disabled is decided in the where, not judged again in the projection: two judgments are two sources of truth.
        .where(scopedWhere(agentSkill, who, eq(agentSkill.enabled, true)))
        // Stable order, otherwise the same catalog comes back in a different byte order each pull and a log reader cannot tell whether it changed.
        .orderBy(asc(agentSkill.name));
      return rows.map((row) => ({
        name: row.name,
        description: row.description,
        wireVersion: row.wireVersion,
        triggerWords: triggerWordsOf(row.triggerWords, row.name),
        // 🔴 The catalog path did not select the body column, so this is honestly null. An empty string would make "not selected this time" and "the body really is empty"
        // look the same, and the latter must throw inside `skillDocument`.
        content: null,
      }));
    },

    async findEnabled(identity: Identity, name: string): Promise<TenantSkillRecord | null> {
      const who = requireIdentity(identity);
      requireName(name, "read tenant skill full text");
      const rows = await exec
        .select({
          name: agentSkill.name,
          description: agentSkill.description,
          wireVersion: agentSkill.wireVersion,
          triggerWords: agentSkill.triggerWords,
          content: agentSkill.content,
        })
        .from(agentSkill)
        .where(scopedWhere(agentSkill, who, eq(agentSkill.name, name), eq(agentSkill.enabled, true)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        name: row.name,
        description: row.description,
        wireVersion: row.wireVersion,
        triggerWords: triggerWordsOf(row.triggerWords, row.name),
        content: row.content,
      };
    },
  };
}
