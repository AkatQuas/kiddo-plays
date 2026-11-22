import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createReferenceApp } from "./app.js";
import { migrateDatabase } from "./migrate.js";
import { openReferenceRuntime } from "./runtime.js";

export async function startReferenceServer(options?: {
  port?: number;
  databaseUrl?: string;
  migrate?: boolean;
}): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const databaseUrl = options?.databaseUrl?.trim() || process.env["DATABASE_URL"]?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the reference server");

  const migrate = options?.migrate ?? process.env["OE_REFERENCE_MIGRATE"] !== "0";
  if (migrate) await migrateDatabase(databaseUrl);

  const runtime = await openReferenceRuntime(databaseUrl);
  const app = createReferenceApp(runtime);
  const requested = options?.port ?? Number(process.env["PORT"] ?? process.env["REFERENCE_PORT"] ?? 8094);

  let bound = requested;
  const server = serve({ fetch: app.fetch, port: requested, hostname: "0.0.0.0" }, (info) => {
    bound = info.port;
    console.log(`reference api listening on ${info.port}`);
  });

  return {
    get port() {
      return bound;
    },
    close: async () => {
      server.close();
      await runtime.close();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await startReferenceServer();
}