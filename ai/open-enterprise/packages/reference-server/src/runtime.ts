import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, type Catalog } from "@open-erp/loader";
import type { ExecutionRepos, RuntimeCatalog, RuntimeDeps } from "@open-erp/runtime-core";
import { createDb, createExecutionRepos, loadGeneratedTables } from "@open-erp/storage-pg";
import { referenceAuthorizer } from "./authorizer.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export interface ReferenceRuntime {
  readonly catalog: Catalog;
  readonly runtimeCatalog: RuntimeCatalog;
  readonly repos: ExecutionRepos;
  readonly deps: RuntimeDeps;
  readonly timezone: string;
  readonly close: () => Promise<void>;
}

export async function openReferenceRuntime(databaseUrl: string): Promise<ReferenceRuntime> {
  const domainsRoot = process.env["OE_DOMAINS"]?.trim() || path.join(ROOT, "domains");
  const timezone = process.env["OE_TIMEZONE"]?.trim() || "UTC";
  const catalog = await loadCatalog({
    domainsRoot,
    flowsRoot: path.join(ROOT, "flows"),
    navigationFile: path.join(ROOT, "navigation.ts"),
  });
  const tables = await loadGeneratedTables(process.env["OE_TABLES_MODULE"]?.trim());
  const { db, close } = createDb(databaseUrl);
  const runtimeCatalog = catalog as unknown as RuntimeCatalog;
  const repos = createExecutionRepos(db, runtimeCatalog, timezone, tables);
  const now = (): Date => new Date();
  const deps: RuntimeDeps = {
    authorizer: referenceAuthorizer,
    catalog: runtimeCatalog,
    repos,
    now,
  };
  return { catalog, runtimeCatalog, repos, deps, timezone, close };
}