import { Hono } from 'hono';
import { authRoutes } from './routes/auth.js';
import { schemaRoutes } from './routes/schema.js';

/**
 * supabase-assist — thin Hono sidecar for Supabase.
 *
 * 1) Auth bridge: already-issued user id → Supabase RLS JWT
 * 2) Schema ops: DynCode(TOTP)-gated controlled SQL
 */
export const app = new Hono();

app.route('/', authRoutes);
app.route('/schema', schemaRoutes);

app.notFound((c) => c.json({ message: 'not found' }, 404));
app.onError((err, c) => {
  console.error('[app]', err);
  return c.json({ message: err.message || 'internal error' }, 500);
});
