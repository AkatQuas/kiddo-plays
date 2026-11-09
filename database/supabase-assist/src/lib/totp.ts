/**
 * TOTP (RFC 6238) used by X-Dyn-Code.
 *
 * Design notes:
 * - 6-digit codes, 30s step, ±1 window for clock skew
 * - Verify accepts both base32-decoded secret (authenticator apps)
 *   and raw UTF-8 secret bytes (simple ops scripts)
 * - Second confirmation for sensitive ops — not end-to-end auth
 */
import { createHmac } from 'node:crypto';

export const STEP_SECONDS = 30;
export const DIGITS = 6;
export const WINDOW_TOLERANCE = 1;

function counterBuffer(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  return buf;
}

/** Loose Base32 decode (RFC 4648): ignore whitespace / padding / case / junk. */
export function decodeBase32Loose(s: string): Buffer {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (!cleaned) return Buffer.alloc(0);
  let bits = '';
  for (const ch of cleaned) {
    bits += alpha.indexOf(ch).toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpAtCounter(secret: string | Buffer, counter: number): string {
  const hmac = createHmac('sha1', secret).update(counterBuffer(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

export function generateTotp(
  secret: string,
  atUnixSec?: number,
  mode: 'base32' | 'raw' = 'base32',
): string {
  const t = atUnixSec ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(t / STEP_SECONDS);
  const key = mode === 'base32' ? decodeBase32Loose(secret) : Buffer.from(secret, 'utf-8');
  return totpAtCounter(key, counter);
}

export function verifyTotp(code: string | undefined | null, secret: string, atUnixSec?: number): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  const t = atUnixSec ?? Math.floor(Date.now() / 1000);
  const baseCounter = Math.floor(t / STEP_SECONDS);
  const keys: Buffer[] = [decodeBase32Loose(secret), Buffer.from(secret, 'utf-8')];

  for (const key of keys) {
    if (key.length === 0) continue;
    for (let i = -WINDOW_TOLERANCE; i <= WINDOW_TOLERANCE; i++) {
      if (totpAtCounter(key, baseCounter + i) === trimmed) return true;
    }
  }
  return false;
}
