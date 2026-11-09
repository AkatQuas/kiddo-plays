import { Hono } from 'hono';
import { config } from '../config.js';
import { normalizeUserId, parseUserIdFromCookie } from '../lib/cookie-uid.js';
import { USER_ID_CLAIM, signSupabaseAccessToken } from '../lib/jwt.js';

/**
 * Enterprise login state → Supabase RLS bridge.
 *
 * Upstream gateway already authenticated the user (cookie carries issued uid).
 * This service only mints a Supabase-compatible JWT so the client can
 * talk to PostgREST / Realtime under RLS — never returns service_role.
 */
export const authRoutes = new Hono();

authRoutes.get('/health', (c) => c.json({ ok: true, service: 'supabase-assist' }));

/**
 * GET /get-user-config
 * Cookie.uid → { supabaseKey, supabaseAccessToken, uuid, userId, expiresIn, expiresAt }
 */
authRoutes.get('/get-user-config', async (c) => {
  const cookie = c.req.header('cookie');
  const userId = parseUserIdFromCookie(cookie);
  if (!userId) {
    return c.json({ message: 'missing cookie uid; cannot mint access token' }, 400);
  }

  const expiresRaw = c.req.query('expiresInSeconds');
  const expiresInSeconds = expiresRaw ? Number.parseInt(expiresRaw, 10) : undefined;

  try {
    const { accessToken, expiresIn, expiresAt, uuid } = await signSupabaseAccessToken({
      userId,
      expiresInSeconds:
        Number.isFinite(expiresInSeconds) && (expiresInSeconds as number) > 0
          ? expiresInSeconds
          : undefined,
    });
    const anon = config.supabaseAnonKey();
    return c.json({
      supabaseKey: anon ? Buffer.from(anon, 'utf-8').toString('base64') : '',
      supabaseAccessToken: accessToken,
      uuid,
      userId,
      claim: USER_ID_CLAIM,
      expiresIn,
      expiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ message: msg }, 500);
  }
});

/**
 * POST /convert-uid
 * Body: { id: string|number, role?: string, expiresInSeconds?: number }
 * Explicit mint when caller already has the issued user id (e.g. server-to-server).
 */
authRoutes.post('/convert-uid', async (c) => {
  let body: { id?: string | number; role?: string; expiresInSeconds?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: 'body must be JSON' }, 400);
  }

  try {
    const userId = normalizeUserId(body.id);
    const { accessToken, expiresIn, expiresAt, uuid } = await signSupabaseAccessToken({
      userId,
      role: body.role,
      expiresInSeconds: body.expiresInSeconds,
    });
    return c.json({
      uuid,
      userId,
      accessToken,
      claim: USER_ID_CLAIM,
      expiresIn,
      expiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ message: msg }, 400);
  }
});
