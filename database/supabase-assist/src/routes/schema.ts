import { Hono } from 'hono';
import { dynCodeMiddleware } from '../middleware/dyn-code.js';
import { runReadOnly, runSchemaMutation } from '../lib/pg.js';
import { validateSql, type SqlMode } from '../lib/sql-validator.js';

/**
 * Controlled SQL ops surface (DynCode-gated).
 *
 * - GET  /schema/relations  list non-system relations
 * - POST /schema/probe      validate + execute (read | schema)
 *
 * DynCode is a second confirmation, not identity. DATABASE_URL holds real power.
 */
export const schemaRoutes = new Hono();

schemaRoutes.use('*', dynCodeMiddleware);

schemaRoutes.get('/relations', async (c) => {
  const sql = `
    select table_schema as schema, table_name as name, table_type as type
    from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name
  `;
  try {
    const r = await runReadOnly(sql, { rowLimit: 5000, timeoutMs: 5000 });
    return c.json({
      relations: r.rows.map((row) => {
        const rec = row as { schema: string; name: string; type: string };
        return { schema: String(rec.schema), name: String(rec.name), type: String(rec.type) };
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ message: msg }, 400);
  }
});

schemaRoutes.post('/probe', async (c) => {
  let body: { sql?: string; mode?: SqlMode; rowLimit?: number; timeoutMs?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: 'body must be JSON' }, 400);
  }

  if (typeof body.sql !== 'string' || !body.sql.trim()) {
    return c.json({ message: 'sql is required' }, 400);
  }
  const mode: SqlMode = body.mode ?? 'read';
  if (mode !== 'read' && mode !== 'schema') {
    return c.json({ message: "mode must be 'read' | 'schema'" }, 400);
  }

  const v = validateSql(body.sql, mode);
  if (!v.ok) {
    return c.json({ message: v.error }, 400);
  }

  try {
    if (mode === 'read') {
      const r = await runReadOnly(v.sql, {
        rowLimit: typeof body.rowLimit === 'number' ? body.rowLimit : undefined,
        timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
      });
      return c.json({ mode: 'read' as const, ...r });
    }
    const r = await runSchemaMutation(v.sql, {
      timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined,
    });
    return c.json({ mode: 'schema' as const, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ message: msg }, 400);
  }
});
