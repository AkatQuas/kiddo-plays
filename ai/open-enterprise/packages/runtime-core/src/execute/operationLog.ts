// ---------------------------------------------------------------------------
// Operation log — what was written on a business bill, assembled into a sentence at query time
//
// Only four kinds are recorded: create, update, delete, transition. The sentence is not stored.
// The source is not stored as the words "user" / "agent"; only agentId is stored. Empty means a user.
//
// The repository is optional. If it is not passed, nothing is written, and existing in-memory executor tests
// do not all need a copy. Production assembly always installs it, and `transaction()` rebinds it to the same transaction.
// ---------------------------------------------------------------------------

import { hasColumn, transitionAction, type ModuleSchema } from "@open-erp/metamodel";
import { requireIdentity, type Identity } from "../contracts/identity.js";

export const OPERATION_LOG_KINDS = ["create", "update", "delete", "transition"] as const;
export type OperationLogKind = (typeof OPERATION_LOG_KINDS)[number];

/** Aligned with erp-web `LIST_PAGE_SIZE` / `LIST_PAGE_SIZE_OPTIONS`. */
export const OPERATION_LOG_PAGE_SIZE = 10;
export const OPERATION_LOG_PAGE_SIZE_MAX = 100;

export class OperationLogQueryError extends Error {
  override readonly name = "OperationLogQueryError";

  constructor(message: string) {
    super(message);
  }
}

/** Facts the executor hands to the repository. The actor comes from identity, not from this input. */
export interface NewOperationLog {
  readonly module: string;
  readonly billId: string;
  readonly billCode: string | null;
  readonly kind: OperationLogKind;
  readonly action: string | null;
  readonly at: Date;
}

export interface OperationLogRow {
  readonly id: string;
  readonly tenantId: string;
  readonly orgId: string;
  readonly actorUserId: string;
  readonly actorAccount: string | null;
  readonly actorName: string | null;
  readonly at: Date;
  readonly module: string;
  readonly billId: string;
  readonly billCode: string | null;
  readonly kind: OperationLogKind;
  readonly action: string | null;
  readonly agentId: string | null;
}

export interface OperationLogQuery {
  /** Already trimmed. Empty means do not filter by account or name. Does not match bill code or user id. */
  readonly keyword: string | null;
  /** Already trimmed. Empty means do not filter by bill code. Matches only the bill_code copied at write time. */
  readonly billCode: string | null;
  /** Inclusive. The caller folds the calendar day into an instant in the deployment timezone. */
  readonly from: Date | null;
  /** Exclusive. */
  readonly to: Date | null;
  /** Empty means do not filter by module. */
  readonly modules: readonly string[];
  readonly page: number;
  readonly pageSize: number;
}

export interface OperationLogPage {
  readonly rows: readonly OperationLogRow[];
  readonly total: number;
}

export interface OperationLogRepo {
  append(identity: Identity, entry: NewOperationLog): Promise<void>;
}

export interface OperationLogStore extends OperationLogRepo {
  list(identity: Identity, query: OperationLogQuery): Promise<OperationLogPage>;
}

export function assertNewOperationLog(entry: NewOperationLog): void {
  if (!(OPERATION_LOG_KINDS as readonly string[]).includes(entry.kind)) {
    throw new Error(`Unknown operation-log action: ${entry.kind}`);
  }
  // The bill primary key is text. A seed bill can be so-0004, not a uuid. An empty string is still refused.
  if (entry.billId.trim() === "") {
    throw new Error("Operation log bill id must not be empty");
  }
  const action = entry.action?.trim() ?? "";
  if (entry.kind === "transition") {
    if (action === "") throw new Error("A transition operation log must have button text");
    return;
  }
  if (entry.action !== null) throw new Error("A non-transition operation log must not carry button text");
}

/**
 * String value of the primary field that has a column on the header.
 * Blank, missing column, or a non-string value are all null.
 * Delete must copy the code while the row still exists.
 */
export function operationLogBillCode(
  schema: ModuleSchema,
  header: Readonly<Record<string, unknown>>,
): string | null {
  const field = schema.fields.find((candidate) => candidate.primary && hasColumn(candidate));
  if (field === undefined) return null;
  const value = header[field.key];
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code === "" ? null : code;
}

/** Button text. If there is no text, use the action code. A transition row must not be empty. */
export function operationLogTransitionAction(schema: ModuleSchema, code: string): string {
  const action = transitionAction(schema.lifecycle, code)?.action?.trim() ?? "";
  return action === "" ? code : action;
}

/** The sentence assembled at query time. If the bill code is blank, keep only "verb + bill name". */
export function operationLogContent(
  kind: OperationLogKind,
  label: string,
  billCode: string | null,
  action: string | null,
): string {
  const verb = kind === "create" ? "Created"
    : kind === "update" ? "Updated"
      : kind === "delete" ? "Deleted"
        : (action ?? "").trim();
  const head = `${verb} ${label}`.trim();
  const code = billCode?.trim() ?? "";
  return code === "" ? head : `${head} ${code}`;
}

/** An empty agentId (including whitespace) is a user. */
export function operationLogSource(agentId: string | null): "User" | "Agent" {
  return agentId === null || agentId.trim() === "" ? "User" : "Agent";
}

/** The actor comes only from identity. A blank agentId is stored as null. */
export function operationLogActor(identity: Identity): { readonly userId: string; readonly agentId: string | null } {
  const who = requireIdentity(identity);
  const raw = who.agentId;
  const agentId = raw === null || raw.trim() === "" ? null : raw.trim();
  return { userId: who.userId, agentId };
}
