import { Pool, type PoolClient } from 'pg';
import { config } from '../config.js';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: config.databaseUrl(),
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => {
    console.error('[pg] pool error', err);
  });
  return pool;
}

export async function runReadOnly(
  sql: string,
  opts?: { timeoutMs?: number; rowLimit?: number },
): Promise<{
  rows: unknown[];
  rowCount: number;
  truncated: boolean;
  fields: { name: string; dataTypeID: number }[];
}> {
  const timeoutMs = Math.max(100, Math.min(opts?.timeoutMs ?? 5_000, 30_000));
  const rowLimit = Math.max(1, Math.min(opts?.rowLimit ?? 1000, 5000));
  const client = await getPool().connect();
  try {
    await client.query('begin read only');
    await client.query(`set local statement_timeout = ${timeoutMs}`);
    const r = await client.query(sql);
    const rows = Array.isArray(r.rows) ? r.rows : [];
    const truncated = rows.length > rowLimit;
    return {
      rows: truncated ? rows.slice(0, rowLimit) : rows,
      rowCount: rows.length,
      truncated,
      fields: (r.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    };
  } finally {
    await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

export async function runSchemaMutation(
  sql: string,
  opts?: { timeoutMs?: number },
): Promise<{ command: string | undefined; rowCount: number | null; notices: string[] }> {
  const timeoutMs = Math.max(100, Math.min(opts?.timeoutMs ?? 30_000, 5 * 60_000));
  const client = await getPool().connect();
  const notices: string[] = [];
  const onNotice = (n: { message?: string }) => {
    if (n?.message) notices.push(String(n.message));
  };
  client.on('notice', onNotice);
  try {
    await client.query('begin');
    await client.query(`set local statement_timeout = ${timeoutMs}`);
    const r = await client.query(sql);
    await client.query('commit');
    return {
      command: r.command,
      rowCount: typeof r.rowCount === 'number' ? r.rowCount : null,
      notices,
    };
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.off('notice', onNotice);
    client.release();
  }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = null;
  }
}
