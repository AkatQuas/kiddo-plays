/**
 * Placeholder: extract an already-issued user id from the request cookie.
 *
 * Assumes upstream SSO/gateway already authenticated the user and set `uid=<id>`.
 * Keep this tiny — product-specific cookie shapes belong in a thin adapter later.
 *
 * Always return string — never Number() (ids may exceed MAX_SAFE_INTEGER).
 */

const UID_COOKIE = 'uid';

/** Read `uid` from Cookie header. Returns null if missing / empty. */
export function parseUserIdFromCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)uid=([^;]+)/i);
  if (!match?.[1]) return null;
  const raw = decodeURIComponent(match[1].trim());
  return raw.length > 0 ? raw : null;
}

/** Normalize body/query id into a non-empty string user id. */
export function normalizeUserId(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || raw === '') {
    throw new Error('user id missing');
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('user id missing');
    return trimmed;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) throw new Error(`user id not finite: ${raw}`);
    if (raw > Number.MAX_SAFE_INTEGER) {
      console.warn(`[auth] uid=${raw} exceeds Number.MAX_SAFE_INTEGER (prefer string)`);
    }
    return String(raw);
  }
  throw new Error(`user id type unsupported: ${typeof raw}`);
}

// Keep the cookie name visible for adapters that want to reuse the placeholder.
export { UID_COOKIE };
