import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireSubject, type SubjectIdentity } from "@open-erp/runtime-core";
import { rbacAudit, rbacRole, rbacRoleGrant } from "../db/framework.js";
import { applyWriteTimeouts } from "./pgError.js";
import type { Executor } from "./support.js";

export interface StoredCatalogRoleGrant {
  readonly id: string;
  readonly roleId: string;
  readonly roleCode: string;
  readonly module: string | null;
  readonly systemKey: string | null;
}

/** Delete only modules or system keys the catalog no longer knows, and rows that are not exactly one of the two non-null. Do not split actions, buttons, or fields inside a row. */
export function planUnknownCatalogRoleGrantRemoval(input: {
  readonly catalogModules: ReadonlySet<string>;
  readonly catalogSystemKeys: ReadonlySet<string>;
  readonly stored: readonly StoredCatalogRoleGrant[];
}): { readonly removeIds: readonly string[] } {
  const removeIds = input.stored
    .filter((row) => {
      const hasModule = row.module !== null;
      const hasSystem = row.systemKey !== null;
      if (hasModule === hasSystem) return true;
      if (hasModule) return !input.catalogModules.has(row.module as string);
      return !input.catalogSystemKeys.has(row.systemKey as string);
    })
    .map((row) => row.id)
    .sort();
  return { removeIds };
}

async function snapshotOf(exec: Executor, tenantId: string): Promise<readonly StoredCatalogRoleGrant[]> {
  return await exec
    .select({
      id: rbacRoleGrant.id,
      roleId: rbacRoleGrant.roleId,
      roleCode: rbacRole.code,
      module: rbacRoleGrant.module,
      systemKey: rbacRoleGrant.systemKey,
    })
    .from(rbacRoleGrant)
    .innerJoin(rbacRole, and(eq(rbacRole.tenantId, rbacRoleGrant.tenantId), eq(rbacRole.id, rbacRoleGrant.roleId)))
    .where(eq(rbacRoleGrant.tenantId, tenantId));
}

export async function applyLocalRbacCatalog(
  exec: Executor,
  actor: SubjectIdentity,
  at: Date,
  catalog: { readonly modules: ReadonlySet<string>; readonly systemKeys: ReadonlySet<string> },
): Promise<{ readonly plan: { readonly removeIds: readonly string[] }; readonly changed: boolean }> {
  const who = requireSubject(actor);
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new Error("Catalog reconcile time is not a valid Date.");
  return await exec.transaction(async (tx) => {
    await applyWriteTimeouts(tx);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`open-local-rbac:${who.tenantId}`}))`);
    const snapshot = await snapshotOf(tx, who.tenantId);
    const plan = planUnknownCatalogRoleGrantRemoval({
      catalogModules: catalog.modules,
      catalogSystemKeys: catalog.systemKeys,
      stored: snapshot,
    });
    if (plan.removeIds.length === 0) return { plan, changed: false };

    const removeIds = new Set(plan.removeIds);
    const removed = snapshot
      .filter((row) => removeIds.has(row.id))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => ({
        module: row.module,
        systemKey: row.systemKey,
        roleCode: row.roleCode,
      }));
    await tx.delete(rbacRoleGrant).where(and(
      eq(rbacRoleGrant.tenantId, who.tenantId),
      inArray(rbacRoleGrant.id, [...plan.removeIds]),
    ));
    await tx.insert(rbacAudit).values({
      id: randomUUID(),
      tenantId: who.tenantId,
      orgId: who.orgId,
      action: "authorization.catalog.reconcile",
      targetType: "tenant",
      targetId: who.tenantId,
      before: removed,
      after: null,
      actorId: who.userId,
      at,
    });
    return { plan, changed: true };
  });
}
