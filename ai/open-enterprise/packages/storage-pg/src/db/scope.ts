// ---------------------------------------------------------------------------
// Tenant-scope wrapper — the application layer is the only isolation line
//
// The connection uses the database owner account and does not go through RLS. There is no second line of defense on the database side.
// So "every query carries tenantId" cannot depend on discipline. There must be only one way to write it.
//
// The whole point of this file is to make "forgot the tenant condition" impossible to write:
// the repository layer receives a condition builder that is already bound to the tenant, not a bare db.
// ---------------------------------------------------------------------------

import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { requireSubject, type SubjectIdentity } from "@open-erp/runtime-core";

/** A table with isolation columns. Generated module tables and handwritten framework tables both have this shape — without it, they should not enter this layer. */
export interface ScopedTable extends PgTable {
  readonly tenantId: PgColumn;
}

/**
 * Bind a set of conditions to the current tenant.
 *
 * The return value always contains the tenantId condition, and the caller cannot skip it: no overload can obtain a where without the tenant.
 * This is deliberate — a `where(eq(t.code, code))` that forgot the tenant does not error in the ORM.
 * It only returns another tenant's documents to a person, and the returned data looks completely normal.
 */
export function scopedWhere(
  table: ScopedTable,
  identity: SubjectIdentity | null | undefined,
  ...extra: (SQL | undefined)[]
): SQL {
  const id = requireSubject(identity);
  const clauses = [eq(table.tenantId, id.tenantId), ...extra.filter((c): c is SQL => c !== undefined)];
  const combined = and(...clauses);
  // and() returns the condition itself when there is only one, so in theory it is not undefined; if it really is undefined,
  // the construction above went wrong, and an empty where must not be returned — that would query the whole database.
  if (!combined) throw new Error("scopedWhere built an empty condition — refusing to run a query with no scope.");
  return combined;
}

/**
 * Fill isolation columns on write.
 *
 * Same idea as scopedWhere: omitting tenantId on insert does not fail immediately (the column is notNull, so the database rejects it),
 * but omitting orgId writes into the wrong organization, and that write succeeds.
 */
export function scopedValues<T extends Record<string, unknown>>(
  identity: SubjectIdentity | null | undefined,
  values: T,
): T & { tenantId: string; orgId: string } {
  const id = requireSubject(identity);
  // The identity axes overwrite last: a tenantId passed in by the caller never counts.
  // Letting the caller name the tenant means allowing a write outside their authority, and that call looks completely innocent.
  return { ...values, tenantId: id.tenantId, orgId: id.orgId };
}
