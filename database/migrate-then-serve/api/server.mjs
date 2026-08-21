#!/usr/bin/env node
/**
 * 业务 API：不执行 DDL。启动前假定 migrate 已完成。
 */

import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.PORT ?? 8080);
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const APP_VERSION = process.env.APP_VERSION?.trim() || "dev";
const SKIP_STARTUP_MIGRATE = process.env.SKIP_STARTUP_MIGRATE === "1";

if (!DATABASE_URL) {
  console.error("[api] 缺少 DATABASE_URL");
  process.exit(1);
}

if (!SKIP_STARTUP_MIGRATE) {
  console.error("[api] 拒绝启动：未设置 SKIP_STARTUP_MIGRATE=1");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

async function loadSchemaSnapshot() {
  const client = await pool.connect();
  try {
    const base = await client.query(`
      select
        exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'schema_migrations') as ledger,
        exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'items') as items
    `);
    const row = base.rows[0];
    if (!row?.ledger || !row?.items) {
      return { ok: false, reason: "missing base tables" };
    }

    const { rows: migrationRows } = await client.query(
      "select version, applied_at from schema_migrations order by version",
    );
    const { rows: columnRows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'items'
      order by ordinal_position
    `);
    const { rows: items } = await client.query("select * from items order by id");

    return {
      ok: true,
      migrations: migrationRows.map((r) => r.version),
      migrationDetails: migrationRows,
      itemsColumns: columnRows.map((r) => r.column_name),
      itemNames: items.map((r) => r.name),
      items,
      appVersion: APP_VERSION,
    };
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, appVersion: APP_VERSION }));
      return;
    }

    const schema = await loadSchemaSnapshot();

    if (url.pathname === "/readyz") {
      if (!schema.ok) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: schema.reason }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, migrations: schema.migrations, appVersion: APP_VERSION }));
      return;
    }

    if (url.pathname === "/api/schema" && req.method === "GET") {
      if (!schema.ok) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: schema.reason }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(schema));
      return;
    }

    if (url.pathname === "/api/items" && req.method === "GET") {
      if (!schema.ok) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: schema.reason }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ items: schema.items, appVersion: APP_VERSION }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
});

server.listen(PORT, () => {
  console.log(`[api] listening :${PORT} version=${APP_VERSION}`);
});

process.on("SIGTERM", () => {
  void pool.end().finally(() => process.exit(0));
});
