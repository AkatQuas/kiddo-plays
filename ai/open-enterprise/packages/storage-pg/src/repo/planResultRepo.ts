// ---------------------------------------------------------------------------
// Planner createBill result map — append-only audit facts.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { executionCreatedBill } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import type { PlanResultRepo, PlannedCreatedBill } from "@open-erp/runtime-core";
import type { Executor } from "./support.js";
import { guardWrite } from "./pgError.js";

export class PlanResultError extends Error {
  override readonly name = "PlanResultError";
}

function fail(message: string): never {
  throw new PlanResultError(message);
}

function requireText(value: string, label: string): string {
  if (!value.trim()) fail(`${label} must not be empty.`);
  return value;
}

export function createPlanResultRepo(exec: Executor): PlanResultRepo {
  return {
    async append(identity: Identity, auditId: string, rows: readonly PlannedCreatedBill[]): Promise<void> {
      const who = requireIdentity(identity);
      const linkedAudit = requireText(auditId, "Planner result auditId");
      if (!rows.length) return;

      const commandIds = new Set<string>();
      const ordinals = new Set<number>();
      const values = rows.map((row) => {
        const commandId = requireText(row.commandId, "Planner result commandId");
        if (commandIds.has(commandId)) fail(`Planner result reuses commandId "${commandId}".`);
        commandIds.add(commandId);
        if (!Number.isInteger(row.ordinal) || row.ordinal < 0) fail(`Planner result ${commandId} ordinal must be a non-negative integer.`);
        if (ordinals.has(row.ordinal)) fail(`Planner result reuses ordinal ${row.ordinal}.`);
        ordinals.add(row.ordinal);
        return scopedValues(who, {
          id: randomUUID(),
          auditId: linkedAudit,
          commandId,
          module: requireText(row.module, `Planner result ${commandId} module`),
          billId: requireText(row.billId, `Planner result ${commandId} billId`),
          ordinal: row.ordinal,
        });
      });

      // Do not use onConflictDoNothing: writing the same audit + command twice means the executor is fulfilling the plan twice.
      await guardWrite("write Planner createBill results", async () => await exec.insert(executionCreatedBill).values(values));
    },

    async list(identity: Identity, auditId: string): Promise<readonly PlannedCreatedBill[]> {
      const who = requireIdentity(identity);
      const linkedAudit = requireText(auditId, "Planner result auditId");
      const rows = await exec
        .select({
          commandId: executionCreatedBill.commandId,
          module: executionCreatedBill.module,
          billId: executionCreatedBill.billId,
          ordinal: executionCreatedBill.ordinal,
        })
        .from(executionCreatedBill)
        .where(scopedWhere(executionCreatedBill, who, eq(executionCreatedBill.auditId, linkedAudit)))
        .orderBy(asc(executionCreatedBill.ordinal));
      return rows;
    },
  };
}
