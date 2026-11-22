// ---------------------------------------------------------------------------
// Table and column comments — PG COMMENT text derived from module declarations
//
// The source of truth is label / help in domains/, not a second mapping table. After a field label changes,
// rerun `yarn db:comment` to sync the database. Comments affect metadata only; they do not change column types or constraints.
//
// Framework tables (ledger / handoff / audit / …) have no module declaration. Their comments live in FRAMEWORK_TABLE_COMMENTS,
// one-to-one with the responsibilities in packages/storage-pg/src/db/framework.ts.
// ---------------------------------------------------------------------------

import type { Catalog, LoadedModule } from "@open-erp/loader";
import {
  hasColumn,
  PLATFORM_QUERY_FIELDS,
  type Field,
  type ModuleSchema,
} from "@open-erp/metamodel";
import { snake } from "./codegen.js";

export interface ColumnComment {
  readonly name: string;
  readonly comment: string;
}

export interface TableComment {
  /** Physical table name, including the oe_ prefix */
  readonly table: string;
  readonly comment: string;
  readonly columns: readonly ColumnComment[];
}

/** Header platform columns (same shape as codegen HEADER_PLATFORM). */
function headerPlatformComments(): Readonly<Record<string, string>> {
  const base: Record<string, string> = {
    id: "Primary key",
    tenant_id: "Tenant ID (isolation axis)",
    org_id: "Organization ID (isolation axis)",
    status: "Status",
    revision: "Concurrency revision",
    created_at: "Created at",
    created_by: "Created by",
    updated_at: "Updated at",
    updated_by: "Updated by",
  };
  // Same wording as PLATFORM_QUERY_FIELDS on the query panel, so the two copies do not drift.
  for (const p of PLATFORM_QUERY_FIELDS) {
    base[snake(p.key)] = p.label;
  }
  return base;
}

/** Line-table platform columns (same shape as the codegen line table). */
const LINE_PLATFORM_COMMENTS: Readonly<Record<string, string>> = Object.freeze({
  id: "Line primary key",
  tenant_id: "Tenant ID (isolation axis)",
  bill_id: "Header bill ID",
  line_no: "Line number (unique within this bill)",
});

/**
 * Framework-table comments. Key = physical table name.
 * Wording matches the responsibility notes at the top of framework.ts. Change them together when a table's job changes.
 */
export const FRAMEWORK_TABLE_COMMENTS: readonly TableComment[] = Object.freeze([
  {
    table: "oe_code_seq",
    comment: "Code sequence counter. Increments by (tenant, prefix, period segment). Format is owned by metamodel",
    columns: [
      { name: "tenant_id", comment: "Tenant ID" },
      { name: "prefix", comment: "Code prefix (module numbering.prefix)" },
      { name: "period", comment: "Sequence segment: business day yyyyMMdd, or empty string (continuous within the tenant)" },
      { name: "seq", comment: "Highest sequence number already allocated" },
    ],
  },
  {
    table: "oe_period",
    comment: "Accounting period. Defines the ledger posting period (finance / inventory books)",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "book", comment: "Book: finance / inventory" },
      { name: "code", comment: "Period code (free text, not a date format)" },
      { name: "seq", comment: "Period sequence (prior period end = this period start)" },
      { name: "start_at", comment: "Period start (inclusive), timestamptz half-open interval" },
      { name: "end_at", comment: "Period end (exclusive), timestamptz half-open interval" },
      { name: "status", comment: "Period status: open / closed" },
      { name: "closed_at", comment: "Closed at" },
      { name: "closed_by", comment: "Closed by" },
      { name: "created_at", comment: "Created at" },
    ],
  },
  {
    table: "oe_effect_ledger",
    comment: "Posting ledger. The only source of truth for balances (append-only; a reversal is an opposite row)",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "target", comment: "Ledger target: stock / ar / ap / gl" },
      { name: "op", comment: "Operation: reserve / release / in / out" },
      { name: "amount", comment: "Quantity or amount (unit depends on target)" },
      { name: "subject_type", comment: "Subject type (product / customer / supplier / account / …)" },
      { name: "subject_id", comment: "Subject ID" },
      { name: "scope_type", comment: "Scope type (for example warehouse); null for a one-dimensional target" },
      { name: "scope_id", comment: "Scope ID (required on stock)" },
      { name: "source_module", comment: "Source module code" },
      { name: "source_id", comment: "Source bill ID" },
      { name: "source_line_id", comment: "Source line ID (null for a header-level posting)" },
      { name: "transition_code", comment: "State-machine edge that triggered the posting" },
      { name: "reversal_of", comment: "ID of the original ledger row being reversed; null on a forward row" },
      { name: "posting_period", comment: "Posting-period code (may legally differ from occurred_at)" },
      { name: "occurred_at", comment: "Business occurrence time" },
      { name: "created_at", comment: "Posted at" },
      { name: "created_by", comment: "Posted by" },
    ],
  },
  {
    table: "oe_reference",
    comment: "Bill reference (push lineage). One target line can come from only one source line",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "src_module", comment: "Source module code" },
      { name: "src_id", comment: "Source bill ID" },
      { name: "src_line_id", comment: "Source line ID (null for a whole-bill reference)" },
      { name: "tgt_module", comment: "Target module code" },
      { name: "tgt_id", comment: "Target bill ID" },
      { name: "tgt_line_id", comment: "Target line ID" },
      { name: "created_at", comment: "Created at" },
      { name: "created_by", comment: "Created by" },
    ],
  },
  {
    table: "oe_handoff_task",
    comment: "Handoff todo / notify / remind. Runtime instance of a handoff declaration",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "handoff_id", comment: "Declared handoff.id" },
      { name: "kind", comment: "Kind: todo / notify / remind" },
      { name: "module", comment: "Bill module code" },
      { name: "bill_id", comment: "Bill ID" },
      { name: "to_role", comment: "Recipient role (not a person)" },
      { name: "title", comment: "Todo title" },
      { name: "due_at", comment: "Due time (remind only)" },
      { name: "status", comment: "Status: open / done / cancelled" },
      { name: "created_at", comment: "Created at" },
      { name: "done_at", comment: "Completed at" },
      { name: "done_by", comment: "Completed by" },
    ],
  },
  {
    table: "oe_staged_action",
    comment: "Agent action awaiting confirmation. Under human governance it is written to the business store only after a person confirms",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "module", comment: "Target module code" },
      { name: "bill_id", comment: "Target bill ID" },
      { name: "transition_code", comment: "State-machine edge proposed for execution" },
      { name: "params", comment: "Edge parameters (JSON)" },
      { name: "decision", comment: "Full TransitionDecision at propose time" },
      { name: "proposed_revision", comment: "Source bill concurrency revision at propose time; null on an old pending row" },
      { name: "execution_plan", comment: "Full Planner plan; null for an ordinary transition" },
      { name: "plan_fingerprint", comment: "SHA-256 of decision+plan" },
      { name: "proposed_by", comment: "Proposer (agent id)" },
      { name: "proposed_at", comment: "Proposed at" },
      { name: "reason", comment: "Natural-language reason from the model" },
      { name: "status", comment: "pending / confirmed / rejected / expired" },
      { name: "decided_at", comment: "Time a person confirmed or rejected" },
      { name: "decided_by", comment: "Person who confirmed or rejected" },
      { name: "reject_reason", comment: "Rejection reason" },
      { name: "idempotency_key", comment: "Idempotency key (unique on tenant × module × bill × edge × key)" },
    ],
  },
  {
    table: "oe_audit_log",
    comment: "State-machine execution audit. The subject is the bill (separate from the agent call log)",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "module", comment: "Module code" },
      { name: "bill_id", comment: "Bill ID" },
      { name: "transition_code", comment: "Edge that was executed" },
      { name: "from_status", comment: "Status before the change" },
      { name: "to_status", comment: "Status after the change" },
      { name: "verdict", comment: "pass / hint / warn / route / block" },
      { name: "params", comment: "Action parameters" },
      { name: "checks", comment: "Full CheckReport[]" },
      { name: "actor_id", comment: "Actor" },
      { name: "policy_version", comment: "Authorization policy version" },
      { name: "decision_id", comment: "Authorization decision ID" },
      { name: "at", comment: "Executed at" },
      { name: "idempotency_key", comment: "Idempotency key (nullable; a person clicking a button does not send one)" },
      { name: "execution_plan", comment: "Planner plan snapshot" },
      { name: "plan_fingerprint", comment: "Plan fingerprint SHA-256" },
    ],
  },
  {
    table: "oe_execution_created_bill",
    comment: "Planner create-bill result. commandId → actual bill id (for idempotent replay)",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "audit_id", comment: "Matching audit row ID" },
      { name: "command_id", comment: "Stable commandId inside the ExecutionPlan" },
      { name: "module", comment: "Module code of the created bill" },
      { name: "bill_id", comment: "ID of the created bill" },
      { name: "ordinal", comment: "Ordinal within this plan" },
    ],
  },
  {
    table: "oe_saved_view",
    comment: "List view saved by a user. Query conditions plus column-layout overrides",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "module", comment: "Module code" },
      { name: "name", comment: "View name" },
      { name: "owner_id", comment: "Owner; null = shared view" },
      { name: "query", comment: "Query structure (SQL is not stored)" },
      { name: "columns", comment: "ColumnOverride[] column-layout differences" },
      { name: "sort_order", comment: "Sort weight" },
      { name: "is_default", comment: "Whether this is the default view" },
      { name: "created_at", comment: "Created at" },
      { name: "updated_at", comment: "Updated at" },
    ],
  },
  {
    table: "oe_agent_call",
    comment: "Agent tool-call log. The subject is the caller (separate from bill audit; append-only)",
    columns: [
      { name: "id", comment: "Primary key" },
      { name: "tenant_id", comment: "Tenant ID (isolation axis)" },
      { name: "org_id", comment: "Organization ID (isolation axis)" },
      { name: "tool", comment: "Tool name (interface layer)" },
      { name: "operation", comment: "Operation name (operation-surface coordinate)" },
      { name: "agent_id", comment: "Agent id" },
      { name: "actor_id", comment: "Person identity in use at the time" },
      { name: "policy_version", comment: "Authorization policy version" },
      { name: "decision_id", comment: "Authorization decision ID" },
      { name: "args", comment: "Call arguments as received" },
      { name: "outcome", comment: "ok / error" },
      { name: "detail", comment: "Success summary or original error text (the full result set is not stored)" },
      { name: "at", comment: "Called at" },
    ],
  },
]);

function fieldComment(field: Field): string {
  const help = field.help?.trim();
  if (help) return `${field.label} — ${help}`;
  return field.label;
}

function headerTable(module: LoadedModule, domainLabel: string): TableComment {
  const schema = module.schema;
  const table = `oe_${snake(schema.code)}`;
  const columns: ColumnComment[] = [
    ...Object.entries(headerPlatformComments()).map(([name, comment]) => ({ name, comment })),
    ...schema.fields.filter(hasColumn).map((f) => ({
      name: snake(f.key),
      comment: fieldComment(f),
    })),
  ];
  return {
    table,
    comment: `${schema.label} · ${domainLabel} (module ${schema.code})`,
    columns,
  };
}

function lineTable(schema: ModuleSchema, domainLabel: string, sub: Field): TableComment {
  if (!sub.fields) {
    throw new Error(`${schema.code}.${sub.key}: subtable has no column declarations`);
  }
  const table = `oe_${snake(schema.code)}_${snake(sub.key)}`;
  const columns: ColumnComment[] = [
    ...Object.entries(LINE_PLATFORM_COMMENTS).map(([name, comment]) => ({ name, comment })),
    ...sub.fields.filter(hasColumn).map((f) => ({
      name: snake(f.key),
      comment: fieldComment(f),
    })),
  ];
  return {
    table,
    comment: `${schema.label} · ${sub.label} (line table · module ${schema.code} · ${domainLabel})`,
    columns,
  };
}

/**
 * Derive business-table comments (header + line tables) from the catalog.
 * Framework tables are FRAMEWORK_TABLE_COMMENTS.
 */
export function businessTableComments(catalog: Catalog): readonly TableComment[] {
  const domainLabel = new Map(catalog.domains.map((d) => [d.code, d.label]));
  const out: TableComment[] = [];
  for (const module of [...catalog.modules.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const dl = domainLabel.get(module.domain) ?? module.domain;
    out.push(headerTable(module, dl));
    for (const field of module.schema.fields.filter((f) => f.type === "subtable")) {
      out.push(lineTable(module.schema, dl, field));
    }
  }
  return out;
}

/** Business tables plus framework tables. */
export function allTableComments(catalog: Catalog): readonly TableComment[] {
  return [...businessTableComments(catalog), ...FRAMEWORK_TABLE_COMMENTS].sort((a, b) =>
    a.table.localeCompare(b.table),
  );
}

/**
 * Render executable COMMENT ON statements (idempotent: running again overwrites with the same text).
 */
export function renderCommentSql(tables: readonly TableComment[]): string {
  const lines: string[] = [
    "-- Generated by yarn db:comment from domains/ module declarations plus framework-table responsibilities",
    "-- Safe to run again: COMMENT ON overwrites",
    "",
  ];
  for (const t of tables) {
    lines.push(`COMMENT ON TABLE "${t.table}" IS ${sqlLiteral(t.comment)};`);
    for (const c of t.columns) {
      lines.push(`COMMENT ON COLUMN "${t.table}"."${c.name}" IS ${sqlLiteral(c.comment)};`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
