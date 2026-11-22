// ---------------------------------------------------------------------------
// Database connection — the only place in the repo that opens one
// ---------------------------------------------------------------------------

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Db = ReturnType<typeof createDb>;

/**
 * Open a connection.
 *
 * The connection uses the database owner account and does not go through RLS. There is no second line of defense on the database side.
 * Tenant isolation depends entirely on every application query carrying a scope (see identity.ts).
 * Any bare query that bypasses the scope wrapper is a security hole, not a style issue.
 */
export function createDb(databaseUrl: string): { readonly db: ReturnType<typeof drizzle>; readonly close: () => Promise<void> } {
  const url = databaseUrl.trim();
  if (url === "") throw new Error("createDb: databaseUrl must not be empty.");
  const sql = postgres(url, {
    // Document operations are short transactions, so the pool does not need to be large; opening it too wide only piles up connections on the PG side.
    max: 10,
    // No tolerance beyond type conversion. If it cannot connect, throw. Do not retry forever —
    // a service that "keeps retrying" is much harder to diagnose than one that fails clearly.
    onnotice: () => {},
  });
  return {
    // Do not pass `schema`: repositories always query with an explicit table object (`.from(agentCall)`), and nowhere uses
    // drizzle's relational query API. Passing it has one consequence — the return type carries the schema generic,
    // which is no longer the same type as the repository layer's `Executor`, and then gets covered by an `as unknown as`.
    // Once that cast exists, a real type mismatch is covered along with it.
    db: drizzle(sql),
    close: async () => {
      await sql.end();
    },
  };
}
