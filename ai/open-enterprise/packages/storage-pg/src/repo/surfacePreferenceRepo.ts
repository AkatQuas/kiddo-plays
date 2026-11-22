// ---------------------------------------------------------------------------
// Query-surface row/column layout repository — one JSON per user per surface
//
// Bound to db, and it does not enter assemble: a layout preference is not part of a document write and should not follow a business transaction.
// Reads use only scopedWhere (tenant), not moduleScopedWhere: this is a framework table.
// ---------------------------------------------------------------------------

import { schemaFail } from "@open-erp/metamodel";
import { eq } from "drizzle-orm";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { surfacePreference } from "../db/framework.js";
import { scopedWhere } from "../db/scope.js";
import { guardWrite } from "./pgError.js";
import type { Executor } from "./support.js";

export interface SurfacePreferenceConfig {
  readonly rowDims: readonly string[];
  readonly colDim: string | null;
}

export interface SurfacePreferenceRepo {
  get(identity: Identity, surfaceCode: string): Promise<SurfacePreferenceConfig | null>;
  put(identity: Identity, surfaceCode: string, config: SurfacePreferenceConfig): Promise<SurfacePreferenceConfig>;
}

function configOf(raw: unknown, at: string): SurfacePreferenceConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    schemaFail(`${at} is damaged. Save the row and column layout again.`);
  }
  const obj = raw as Record<string, unknown>;
  const rowDimsRaw = obj["rowDims"];
  if (!Array.isArray(rowDimsRaw) || rowDimsRaw.some((item) => typeof item !== "string")) {
    schemaFail(`${at} row dimensions are damaged. Save again.`);
  }
  const colDimRaw = obj["colDim"];
  if (colDimRaw !== null && typeof colDimRaw !== "string") {
    schemaFail(`${at} column dimension is damaged. Save again.`);
  }
  return { rowDims: rowDimsRaw as readonly string[], colDim: colDimRaw };
}

export function createSurfacePreferenceRepo(exec: Executor): SurfacePreferenceRepo {
  return {
    async get(identity, surfaceCode) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select({ config: surfacePreference.config })
        .from(surfacePreference)
        .where(
          scopedWhere(
            surfacePreference,
            who,
            eq(surfacePreference.userId, who.userId),
            eq(surfacePreference.surfaceCode, surfaceCode),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (row === undefined) return null;
      return configOf(row.config, "saved row and column layout");
    },

    async put(identity, surfaceCode, config) {
      const who = requireIdentity(identity);
      const now = new Date();
      const rows = await guardWrite("save row and column layout", async () =>
        await exec
          .insert(surfacePreference)
          .values({
            tenantId: who.tenantId,
            userId: who.userId,
            surfaceCode,
            config,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [surfacePreference.tenantId, surfacePreference.userId, surfacePreference.surfaceCode],
            set: { config, updatedAt: now },
          })
          .returning({ config: surfacePreference.config }),
      );
      const row = rows[0];
      if (row === undefined) schemaFail("Saving the row and column layout failed. Try again.");
      return configOf(row.config, "row and column layout just saved");
    },
  };
}
