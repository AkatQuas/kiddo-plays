#!/usr/bin/env node
/**
 * reset — 一键恢复到基线：
 *   · docker compose down -v
 *   · 删除 do-migration 生成的 migrations（保留 001/002）
 *   · 清空 .migration-gen/
 */

import { rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runComposeDown } from "./lib/compose.mjs";
import { GEN_DIR, MIGRATIONS_DIR, ROOT } from "./lib/paths.mjs";

export const BASELINE_MIGRATIONS = Object.freeze([
  "001_init.sql",
  "002_add_status.sql",
]);

export async function resetGeneratedMigrations() {
  const baseline = new Set(BASELINE_MIGRATIONS);
  const names = await readdir(MIGRATIONS_DIR);
  const removed = [];
  for (const name of names) {
    if (name.endsWith(".sql") && !baseline.has(name)) {
      await rm(path.join(MIGRATIONS_DIR, name));
      removed.push(name);
    }
  }
  return removed;
}

export async function resetMigrationGen() {
  await rm(GEN_DIR, { recursive: true, force: true });
}

export async function resetAll({ volumes = true } = {}) {
  console.log("[reset] docker compose down" + (volumes ? " -v" : ""));
  runComposeDown(volumes);

  const removed = await resetGeneratedMigrations();
  await resetMigrationGen();

  console.log("[reset] ok");
  console.log(JSON.stringify({
    root: ROOT,
    kept: [...BASELINE_MIGRATIONS],
    removedMigrations: removed,
    cleared: ".migration-gen/",
  }, null, 2));
  return { removed, kept: BASELINE_MIGRATIONS };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetAll().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
