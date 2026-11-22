// ---------------------------------------------------------------------------
// Allocate a number — an atomic sequence by (tenant, prefix, sequence segment)
//
// The source of truth for format and "how the sequence segment is computed" is @open-erp/metamodel (`formatCode` / `codePeriod`).
// This only does "the next sequence number".
//
// Sequence segment: a document uses the business day (`"20260729"`), and master data uses the empty string (no segment). The empty string is a legal value of the period dimension,
// not a placeholder disguised as a date — so both tiers share one counter table, and a second table is not needed.
//
// Concurrency: upsert + returning, serialized by the same-tenant row lock; historical codes in the business table take part in watermark calibration.
// ---------------------------------------------------------------------------

import { businessTableName, codePeriod, formatCode, type ModuleSchema, type Numbering } from "@open-erp/metamodel";
import { sql } from "drizzle-orm";
import type { Executor } from "./support.js";
import { RepoError } from "@open-erp/runtime-core";

function fail(message: string): never {
  throw new RepoError(message);
}

/**
 * Take the next code.
 *
 * @param numbering From `module.numbering`. The whole object is passed, not only the prefix:
 *   `seqScope` may be read only inside `codePeriod`, and the caller does not branch.
 * @param timezone Timezone of the business day, from `env.timezone()` (OE_TIMEZONE). Required, with no default —
 *   falling back to the process TZ would invent a second "today". See the note on `calendarYmd`.
 * @param module Used to read codes that already exist in the business table, so historical / hand-written codes do not collide with the sequence.
 */
export async function nextCode(
  exec: Executor,
  tenantId: string,
  numbering: Numbering,
  timezone: string,
  now: Date = new Date(),
  module?: string,
): Promise<string> {
  const period = codePeriod(numbering, now, timezone);
  const table = module === undefined ? null : businessTableName(module);
  const pattern = numbering.seqScope === "day"
    ? `^${numbering.prefix}-${period}-([0-9]+)$`
    : `^${numbering.prefix}-([0-9]+)$`;
  // The business table may hold old data or hand-written codes, so the watermark in oe_code_seq cannot be trusted alone.
  // Take the max existing sequence inside the same upsert, so a query-then-allocate does not open a concurrency window.
  const result = await exec.execute(sql`
    INSERT INTO "oe_code_seq" ("tenant_id", "prefix", "period", "seq")
    VALUES (
      ${tenantId},
      ${numbering.prefix},
      ${period},
      ${table === null
        ? 1
        : sql`coalesce((select max(substring("code" from ${pattern})::integer) from ${sql.raw(table)} where "tenant_id" = ${tenantId} and "code" ~ ${pattern}), 0) + 1`}
    )
    ON CONFLICT ("tenant_id", "prefix", "period")
    DO UPDATE SET "seq" = greatest(
      "oe_code_seq"."seq",
      excluded."seq" - 1
    ) + 1
    RETURNING "seq"
  `);

  const rows = result as unknown as readonly { seq?: unknown; Seq?: unknown }[];
  const raw = Array.isArray(rows) ? rows[0] : undefined;
  const seq = Number(raw && "seq" in raw ? raw.seq : raw && "Seq" in raw ? raw.Seq : undefined);
  if (!Number.isInteger(seq) || seq <= 0) {
    fail(`Allocating a number failed for ${numbering.prefix}/${period || "(no segment)"}: returned an illegal sequence ${JSON.stringify(raw)}`);
  }
  return formatCode(numbering.prefix, period, seq);
}

/**
 * Fill codes for every auto field on the header. The caller should run headerWrite first (it rejects an auto value sent by the client).
 */
export async function assignAutoNumbers(
  exec: Executor,
  schema: ModuleSchema,
  tenantId: string,
  header: Record<string, unknown>,
  timezone: string,
  now: Date = new Date(),
): Promise<Record<string, unknown>> {
  const autoFields = schema.fields.filter((f) => f.auto);
  if (autoFields.length === 0) return header;
  if (schema.numbering === null) {
    fail(`module "${schema.code}" has an auto field but no numbering — the static gate should have stopped this, and seeing it at runtime means the load-time check was bypassed`);
  }
  const out = { ...header };
  for (const field of autoFields) {
    out[field.key] = await nextCode(exec, tenantId, schema.numbering, timezone, now, schema.code);
  }
  return out;
}
