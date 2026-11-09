import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from './app.js';
import { config } from './config.js';
import { closePool } from './lib/pg.js';

/** Minimal .env loader (no dotenv dependency). */
function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf-8');
  for (const line of text.split('\n')) {
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

const port = config.port;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[supabase-assist] listening on http://localhost:${info.port}`);
});

async function shutdown() {
  await closePool();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
