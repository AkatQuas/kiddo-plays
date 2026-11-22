// Drizzle Kit — reference schema bundle only.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const envFile = path.join(repoRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env["DATABASE_URL"]?.trim();
if (!url) {
  throw new Error(
    "DATABASE_URL is required for drizzle-kit. Set it in the shell or repo root .env (see .env.example).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: [
    path.join(repoRoot, "packages/storage-pg/src/db/framework.ts"),
    path.join(repoRoot, "tables/src/*.ts"),
  ],
  out: path.join(here, "migrations"),
  dbCredentials: { url },
  tablesFilter: ["oe_*"],
  verbose: true,
  strict: true,
});