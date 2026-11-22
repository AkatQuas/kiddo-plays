import type { Identity } from "./identity.js";

/** Application-layer port for agent tool-call audit trails; a persistence adapter must not define a second contract of the same shape. */
export interface AgentAuditEntry {
  readonly tool: string;
  readonly operation: string;
  readonly agentId: string;
  readonly identity: Identity;
  readonly args: Readonly<Record<string, unknown>>;
  readonly at: Date;
  readonly outcome: "ok" | "error";
  readonly detail: string;
}

export interface AgentAuditSink {
  record(entry: AgentAuditEntry): Promise<void>;
}

/** The only read shape for a tenant skill between the application layer and persistence. */
export interface TenantSkillRecord {
  readonly name: string;
  readonly description: string;
  readonly wireVersion: string;
  readonly triggerWords: readonly string[];
  readonly content: string | null;
}
