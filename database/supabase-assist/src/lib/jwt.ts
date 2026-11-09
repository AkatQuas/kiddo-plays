import { SignJWT } from 'jose';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { config } from '../config.js';

/** Fixed custom claim carrying the upstream-issued user id for RLS. */
export const USER_ID_CLAIM = 'user_id';

/**
 * Sign a Supabase-compatible access token for RLS.
 *
 * Claims:
 *   - sub       = deterministic UUID from user id (auth.uid()-style policies)
 *   - user_id   = upstream-issued user id string for
 *                 auth.jwt() ->> 'user_id' exact match on row.user_id
 *   - role/aud  = authenticated (Supabase defaults)
 */
export async function signSupabaseAccessToken(opts: {
  userId: string;
  role?: string;
  expiresInSeconds?: number;
}): Promise<{ accessToken: string; expiresIn: number; expiresAt: number; uuid: string }> {
  const expiresIn =
    opts.expiresInSeconds && opts.expiresInSeconds > 0
      ? opts.expiresInSeconds
      : config.accessTokenExpiresIn();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresIn;
  const uuid = deterministicUuid(opts.userId);
  const secret = new TextEncoder().encode(config.supabaseJwtSecret());

  const accessToken = await new SignJWT({
    [USER_ID_CLAIM]: opts.userId,
    email: '',
    phone: '',
    role: opts.role ?? 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
    session_id: uuidv4(),
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(uuid)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { accessToken, expiresIn, expiresAt, uuid };
}

function deterministicUuid(userId: string): string {
  return uuidv5(userId, config.uuidv5Namespace());
}
