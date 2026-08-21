#!/usr/bin/env node
/**
 * 一次性 migrator：只负责 DDL，跑完 exit。
 * Compose/K8s init 等价物；业务 api 容器不应 import 本脚本。
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const LOCK_KEY = "migrate_then_serve_migrate";
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR?.trim() || path.join(process.cwd(), "migrations");

if (!DATABASE_URL) {
  console.error("[migrate] 缺少 DATABASE_URL");
  process.exit(1);
}

async function ensureLedger(client) {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function listMigrationFiles(dir) {
  const names = await readdir(dir);
  return names
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));
}

async function appliedVersions(client) {
  const { rows } = await client.query("select version from schema_migrations order by version");
  return new Set(rows.map((row) => row.version));
}

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log(`[migrate] connected migrations_dir=${MIGRATIONS_DIR}`);

  try {
    await client.query("select pg_advisory_lock(hashtext($1))", [LOCK_KEY]);
    await ensureLedger(client);

    const files = await listMigrationFiles(MIGRATIONS_DIR);
    const done = await appliedVersions(client);

    if (files.length === 0) {
      console.log("[migrate] no migration files");
      return;
    }

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (done.has(version)) {
        console.log(`[migrate] skip ${version}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] apply ${version}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [version]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    const { rows } = await client.query("select version from schema_migrations order by version");
    console.log(`[migrate] ok versions=${rows.map((r) => r.version).join(",")}`);
  } finally {
    await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

run().catch((error) => {
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
