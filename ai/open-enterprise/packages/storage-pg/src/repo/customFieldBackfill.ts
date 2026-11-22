// ---------------------------------------------------------------------------
// Backfill of existing rows for pass-through fields
//
// A pass-through freezes only **at the moment of save**, so a binding that was just configured is empty on documents that already exist.
// Leaving them empty is the most misleading failure: the user filters the list by this field, nothing matches, and the screen
// nowhere says why — the first reaction is that the feature is broken, not that "historical rows do not have this cell".
//
// 🔴 **One UPDATE ... FROM, not a row-by-row loop.** The value source is "the same key on that upstream row",
// which in SQL is one join, still one statement at a few million rows. N reads plus N writes
// takes minutes to configure one field, and a failure in the middle leaves a half-filled bucket.
//
// 🔴 **Fill only blanks, do not overwrite** (`not (custom ? key)`). A value already frozen is a fact from when that document was created,
// and must not be rewritten by today's upstream value — that is the whole reason the product chose a snapshot instead of a reference.
// So this statement can be run again; the second run is a no-op.
// ---------------------------------------------------------------------------

import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Identity } from "@open-erp/runtime-core";
import { requireIdentity } from "@open-erp/runtime-core";
import { isCustomFieldKey } from "@open-erp/metamodel";
import type { Executor } from "./support.js";

export interface BackfillInput {
  /** Table the value lands on: the header table, or a line table. */
  readonly target: PgTable;
  /** Table the value comes from: the upstream module's header table. */
  readonly source: PgTable;
  /** Column on `target` that points at `source.id` (field key, not column name). */
  readonly viaRef: string;
  /** Custom field key. */
  readonly key: string;
}

function columnOf(table: PgTable, key: string, what: string): PgColumn {
  const column = (getTableColumns(table) as Record<string, PgColumn | undefined>)[key];
  if (column === undefined) throw new Error(`backfill pass-through field: ${what} has no column "${key}"`);
  return column;
}

/**
 * Copy `source.custom->key` into `target.custom->key`, only on rows that do not already have that cell.
 *
 * @returns how many rows were filled
 */
export async function backfillInheritedCustom(
  exec: Executor,
  identity: Identity,
  input: BackfillInput,
): Promise<number> {
  const who = requireIdentity(identity);
  // Key shape is guarded when the field is created; check again here because it is spliced into a SQL literal.
  if (!isCustomFieldKey(input.key)) throw new Error(`backfill pass-through field: "${input.key}" is not a legal custom field code`);

  const targetCustom = columnOf(input.target, "custom", "target table");
  const sourceCustom = columnOf(input.source, "custom", "source table");
  const via = columnOf(input.target, input.viaRef, "target table");
  const sourceId = columnOf(input.source, "id", "source table");
  const targetTenant = columnOf(input.target, "tenantId", "target table");
  const sourceTenant = columnOf(input.source, "tenantId", "source table");

  const merged: SQL = sql`coalesce(${targetCustom}, '{}'::jsonb) || jsonb_build_object(cast(${input.key} as text), ${sourceCustom} -> ${input.key})`;
  const result = await exec.execute(sql`
    update ${input.target}
    set ${sql.identifier("custom")} = ${merged}
    from ${input.source}
    where ${sourceId} = ${via}
      and ${targetTenant} = ${who.tenantId}
      and ${sourceTenant} = ${who.tenantId}
      and ${sourceCustom} ? ${input.key}
      and not (coalesce(${targetCustom}, '{}'::jsonb) ? ${input.key})
  `);
  // Drivers disagree on where rowCount lands (node-postgres puts it on result.rowCount,
  // some wrap a rows layer). If it cannot be read, return 0; do not invent a number.
  const receipt = result as { readonly rowCount?: number; readonly count?: number } | null;
  const count = receipt?.rowCount ?? receipt?.count;
  return typeof count === "number" ? count : 0;
}
