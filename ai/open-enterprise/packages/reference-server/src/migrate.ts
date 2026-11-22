/**
 * Bring Postgres in line with the declarative schema (`framework.ts` + `@open-erp/tables`).
 * No checked-in incremental SQL: the open repo does not ship product backfills or non-English DDL.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.join(HERE, "..");
const REPO_ROOT = path.resolve(PKG_ROOT, "../..");
const CONFIG = path.join(PKG_ROOT, "drizzle.config.ts");
const MIGRATIONS_DIR = path.join(PKG_ROOT, "migrations");

/** Reserved for optional maintainer SQL; empty in the default open tree. */
export const MIGRATIONS_FOLDER = MIGRATIONS_DIR;

export async function migrateDatabase(databaseUrl: string): Promise<void> {
  const url = databaseUrl.trim();
  if (url === "") throw new Error("migrateDatabase: databaseUrl must not be empty");
  if (process.env["OE_REFERENCE_SCHEMA"] === "off") return;
  applyDrizzlePush(url);
}

function applyDrizzlePush(databaseUrl: string): void {
  const result = spawnSync("npx", ["drizzle-kit", "push", "--config", CONFIG], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (exit ${String(result.status)}):\n${result.stderr || result.stdout || "(no output)"}`,
    );
  }
}

function databaseUrlFromEnv(): string {
  const url = process.env["DATABASE_URL"]?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void migrateDatabase(databaseUrlFromEnv()).then(() => console.log("reference schema applied (drizzle-kit push)"));
}