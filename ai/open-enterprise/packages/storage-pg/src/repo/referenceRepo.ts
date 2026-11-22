// ---------------------------------------------------------------------------
// Reference repository — relationships between documents produced by a push
//
// `tgtLineId` has a unique index: one target line can come from only one source line.
// Without it, the same order line referenced by two shipment lines would count shipped quantity twice —
// and each reference line looks legal on its own, so afterwards there is no way to tell which one is extra.
// So this does not use onConflictDoNothing: a collision is a real duplicate reference in the business, and the caller must be told.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { reference } from "../db/framework.js";
import { scopedValues } from "../db/scope.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { guardWrite } from "./pgError.js";
import type { NewReference, ReferenceRepo } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";
import { moduleScopedWhere, type ModuleRegistry } from "./queryCompiler.js";

export function createReferenceRepo(exec: Executor, registry: ModuleRegistry, timezone: string): ReferenceRepo {
  if (!timezone.trim()) {
    throw new Error("The reference repository is missing a timezone — relative time has no definite interval without one.");
  }
  return {
    async append(identity: Identity, rows: readonly NewReference[]): Promise<void> {
      const who = requireIdentity(identity);
      // A whole-document push (no line pairing) is an empty array, not an exception.
      if (!rows.length) return;

      const values = rows.map((row) =>
        scopedValues(who, {
          id: randomUUID(),
          srcModule: row.srcModule,
          srcId: row.srcId,
          srcLineId: row.srcLineId,
          tgtModule: row.tgtModule,
          tgtId: row.tgtId,
          tgtLineId: row.tgtLineId,
          createdBy: who.userId,
        }),
      );
      await guardWrite("write document references", async () => await exec.insert(reference).values(values));
    },

    async listTargets(identity, sourceModule, sourceId, targetModule, limit) {
      const who = requireIdentity(identity);
      if (!sourceModule.trim() || !sourceId.trim() || !targetModule.trim()) {
        throw new Error("A reference reverse lookup requires a non-empty source module, source document, and target module.");
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("A reference reverse-lookup limit must be an integer from 1 to 100.");
      }
      const target = registry.get(targetModule);
      const status = target.columns["status"];
      if (!status) throw new Error(`Module "${targetModule}" has no status column, so a reference reverse lookup cannot run.`);

      // One target document can become several oe_reference rows because of several lines, so group by target id/status to dedupe.
      // Joining the target header also enforces the target tenant and data scope; using only scopedWhere(reference) would leak
      // target ids the current role cannot see to the Planner.
      const rows = await exec
        .select({ id: target.header.id, status })
        .from(reference)
        .innerJoin(
          target.header,
          and(
            eq(target.header.tenantId, reference.tenantId),
            eq(target.header.id, reference.tgtId),
          ),
        )
        .where(
          and(
            moduleScopedWhere(target, who, timezone),
            eq(reference.tenantId, who.tenantId),
            eq(reference.srcModule, sourceModule),
            eq(reference.srcId, sourceId),
            eq(reference.tgtModule, targetModule),
          ),
        )
        .groupBy(target.header.id, status)
        .orderBy(asc(target.header.id))
        .limit(limit + 1);

      const visible = rows.slice(0, limit).map((row) => {
        if (typeof row.id !== "string" || typeof row.status !== "string") {
          throw new Error(`The reference reverse lookup for module "${targetModule}" returned an invalid id/status.`);
        }
        return { id: row.id, status: row.status };
      });
      return { rows: visible, truncated: rows.length > limit };
    },
  };
}
