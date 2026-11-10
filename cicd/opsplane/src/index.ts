import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { createRuntime } from './runtime.js';

const log = {
  info: (...a: unknown[]) => console.log(new Date().toISOString(), ...a),
  error: (...a: unknown[]) => console.error(new Date().toISOString(), ...a),
};

const config = loadConfig();
const { app, engine } = createRuntime(config, log);

log.info(`opsplane listening on http://${config.host}:${config.port}`);
log.info(`catalog dir: ${config.catalogDir}`);
log.info(`store: ${config.databaseUrl ? 'postgres (configured; memory used in this build)' : 'memory'}`);
log.info('auth: none (bind to a trusted network)');

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, () => {
  engine
    .resumeInFlight()
    .then((ids) => {
      if (ids.length) log.info(`resumed ${ids.length} in-flight task(s)`);
    })
    .catch((err: unknown) => {
      log.error('resume failed:', err instanceof Error ? err.message : err);
    });
});
