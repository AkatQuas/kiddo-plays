import type { CompiledSqlCell } from "@open-erp/metamodel";
import { createRegistry } from "./queryCompiler.js";
// ---------------------------------------------------------------------------
// Analysis repository — the read-only execution entry for analysis_sql
//
// The agent contract is `analysis_sql`; this repository no longer offers the removed `group` / `analysis_group`.
// ---------------------------------------------------------------------------

import { analysisCatalogOf } from "@open-erp/metamodel";
import type { Identity, RuntimeCatalog } from "@open-erp/runtime-core";
import type { GeneratedTables } from "./generatedTables.js";
import { schemasOf, type Executor } from "./support.js";
import { createAnalysisSqlExecutor } from "./analysisSqlRepo.js";
import {createAnalysisSnapshotExporter,createAnalysisSnapshotIntentValidator,analysisSnapshotScope,type SnapshotSource,type SnapshotConsumer,type SnapshotExport,type SnapshotIntent} from "./analysisSnapshotRepo.js";

export interface GroupAnalysisResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  /** When true there are more groups; the caller should narrow the condition or raise a legal limit, and must not present the current page as the whole set. */
  readonly truncated: boolean;
}

export interface AnalysisRepo {
  exportSnapshot?(identity:Identity,sources:readonly SnapshotSource[],consume:SnapshotConsumer,intent?:SnapshotIntent):Promise<SnapshotExport>;
  snapshotScope?(identity:Identity,sources:readonly SnapshotSource[]):string;
  validateSnapshotIntent?(identity:Identity,sources:readonly SnapshotSource[],intent:SnapshotIntent):Promise<void>;
  /**
   * Read-only analysis SQL. The agent contract is `analysis_sql`; this method is the only execution entry.
   * The removed `analysis_group` tool must not call the removed `group` again.
   */
  querySql(
    identity: Identity,
    sqlText: string,
    params: readonly unknown[],
  ): Promise<GroupAnalysisResult & { readonly relations: readonly string[] }>;
  queryCompiled?(
    identity: Identity,
    compiled: CompiledSqlCell,
  ): Promise<GroupAnalysisResult>;
}

export function createAnalysisRepo(
  exec: Executor,
  catalog: RuntimeCatalog,
  timezone: string,
  _tables: GeneratedTables,
): AnalysisRepo {
  if (!timezone.trim()) throw new Error("Creating the analysis repository requires OE_TIMEZONE. Relative time must not fall back to the server timezone.");
  const sqlRepo = createAnalysisSqlExecutor(exec, analysisCatalogOf([...schemasOf(catalog).values()]), timezone, createRegistry(schemasOf(catalog), _tables));

  return {
    exportSnapshot:createAnalysisSnapshotExporter(exec,catalog,timezone,_tables),
    validateSnapshotIntent:createAnalysisSnapshotIntentValidator(exec,catalog,timezone,_tables),
    snapshotScope:(identity,sources)=>analysisSnapshotScope(catalog,timezone,_tables,identity,sources),
    async querySql(identity, sqlText, params) {
      return await sqlRepo.querySql(identity, sqlText, params);
    },
    async queryCompiled(identity, compiled) {
      return await sqlRepo.queryCompiled(identity, compiled);
    },
  };
}
