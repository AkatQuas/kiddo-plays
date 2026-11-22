import type { ModuleSchema } from "@open-erp/metamodel";
import type { RuntimeCatalog } from "@open-erp/runtime-core";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/** A connection pool or transaction that can run SQL. Repositories treat the two the same. */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, Record<string, unknown>>;

/** The storage layer's only projection from Catalog to schema. */
export function schemasOf(catalog: RuntimeCatalog): ReadonlyMap<string, ModuleSchema> {
  return new Map([...catalog.modules].map(([code, loaded]) => [code, loaded.schema]));
}
