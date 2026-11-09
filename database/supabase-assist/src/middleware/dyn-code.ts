/**
 * X-Dyn-Code middleware — second confirmation for sensitive ops.
 *
 * Contract:
 *   Header: X-Dyn-Code: <6-digit TOTP>
 *   Success → continue
 *   Miss / wrong → 401 { message: "unauthorized" }  (opaque copy)
 *   Locked  → 429 { message: "unauthorized" }  (opaque copy; status only for legit ops)
 *
 * Anti-bruteforce (cookie-bucketed, not IP — k8s often hides client IP):
 *   - Hash cookie → bucket key (no raw cookie in memory)
 *   - 3 failures within 30s → lock 30 minutes
 *   - Success clears the bucket
 *   - Cap map size + lazy GC against cookie flooding
 *
 * DynCode is NOT identity auth. Real boundary remains gateway + who holds the secret.
 */
import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { config } from '../config.js';
import { STEP_SECONDS, generateTotp, totpAtCounter, verifyTotp, decodeBase32Loose } from '../lib/totp.js';

export const DYN_CODE_HEADER = 'x-dyn-code';

const FAIL_WINDOW_MS = 30 * 1000;
const MAX_FAILS_BEFORE_LOCK = 3;
const LOCK_DURATION_MS = 30 * 60 * 1000;
const ATTEMPTS_MAX_KEYS = 10_000;

interface AttemptRecord {
  failures: number;
  firstFailAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

function bucketKey(cookie: string | undefined | null): string {
  const c = (cookie ?? '').trim();
  if (!c) return '__no_cookie__';
  return createHash('sha256').update(c).digest('hex').slice(0, 32);
}

function gcAttempts(now: number): void {
  if (attempts.size <= ATTEMPTS_MAX_KEYS) return;
  for (const [k, v] of attempts) {
    if (v.lockedUntil > now) continue;
    if (now - v.firstFailAt > FAIL_WINDOW_MS) {
      attempts.delete(k);
      if (attempts.size <= ATTEMPTS_MAX_KEYS / 2) break;
    }
  }
}

/** Test / ops helper — not exposed as a route. */
export function resetDynCodeAttempts(cookie?: string): void {
  if (cookie === undefined) {
    attempts.clear();
    return;
  }
  attempts.delete(bucketKey(cookie));
}

function deny(c: Context, status: 401 | 429) {
  return c.json({ message: 'unauthorized' }, status);
}

export const dynCodeMiddleware: MiddlewareHandler = async (c, next) => {
  const cookie = c.req.header('cookie');
  const key = bucketKey(cookie);
  const now = Date.now();
  const secret = config.dynCodeSecret();

  const existing = attempts.get(key);
  if (existing && existing.lockedUntil > now) {
    console.warn(`[dyn-code] bucket=${key.slice(0, 8)} LOCKED`);
    return deny(c, 429);
  }

  const code = c.req.header(DYN_CODE_HEADER);
  if (verifyTotp(code, secret)) {
    attempts.delete(key);
    await next();
    return;
  }

  if (config.debugDynCode()) {
    const t = Math.floor(now / 1000);
    const baseCounter = Math.floor(t / STEP_SECONDS);
    const keyBuf = decodeBase32Loose(secret);
    const expected = [-1, 0, 1].map((i) => totpAtCounter(keyBuf, baseCounter + i)).join(' / ');
    console.warn(
      `[dyn-code] bucket=${key.slice(0, 8)} received=${String(code ?? '(none)')} expected(±1)=[${expected}]`,
    );
  } else {
    console.warn(
      `[dyn-code] bucket=${key.slice(0, 8)} MISS receivedLen=${typeof code === 'string' ? code.length : 0}`,
    );
  }

  gcAttempts(now);
  if (!existing || existing.lockedUntil > 0 || now - existing.firstFailAt > FAIL_WINDOW_MS) {
    attempts.set(key, { failures: 1, firstFailAt: now, lockedUntil: 0 });
  } else {
    existing.failures += 1;
    if (existing.failures >= MAX_FAILS_BEFORE_LOCK) {
      existing.lockedUntil = now + LOCK_DURATION_MS;
    }
  }

  return deny(c, 401);
};

/** Convenience for scripts that need the current code. */
export function currentDynCode(): string {
  return generateTotp(config.dynCodeSecret());
}
