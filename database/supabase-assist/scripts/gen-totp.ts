/**
 * Print current X-Dyn-Code for ops scripts.
 *
 *   pnpm gen-totp
 *   DYN_CODE_SECRET=... pnpm gen-totp
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateTotp } from '../src/lib/totp.js';

function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

const secret = process.env.DYN_CODE_SECRET;
if (!secret) {
  console.error('DYN_CODE_SECRET is required (.env or env)');
  process.exit(1);
}

console.log(generateTotp(secret));
