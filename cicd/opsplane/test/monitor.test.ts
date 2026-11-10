import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createMonitor } from '../src/monitor/k8s.js';
import { loadServiceCatalog } from '../src/services.js';
import { HttpError } from '../src/errors.js';

const catalogDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../catalog/examples');

describe('k8s monitor', () => {
  it('overview uses injected snapshot', async () => {
    process.env.CATALOG_DIR = catalogDir;
    const config = loadConfig();
    const catalog = loadServiceCatalog(catalogDir);
    const monitor = createMonitor(config, catalog, {
      snapshot: {
        podsByService: {
          'example-api': [
            { name: 'example-api-0', phase: 'Running', ready: true, restarts: 0, reason: null },
          ],
          'example-worker': [],
        },
        logTailByService: {
          'example-api': ['INFO ok', 'ERROR boom'],
        },
        sampleComplete: true,
      },
    });

    const overview = await monitor.overview({});
    const api = overview.services.find((s) => s.service === 'example-api');
    expect(api?.presence).toBe('present');
    expect(api?.error_count).toBe(1);

    const gate = await monitor.gateCheck({ kind: 'k8s-health', service: 'example-api', state: { restarts: 0 } });
    expect(gate.firing).toBe(false);

    const crash = createMonitor(config, catalog, {
      snapshot: {
        podsByService: {
          'example-api': [
            { name: 'example-api-0', phase: 'Running', ready: false, restarts: 3, reason: 'CrashLoopBackOff' },
          ],
        },
        sampleComplete: true,
      },
    });
    const firing = await crash.gateCheck({ kind: 'k8s-health', service: 'example-api', state: { restarts: 0 } });
    expect(firing.firing).toBe(true);
  });

  it('error-rate gate returns 503 when sample incomplete', async () => {
    process.env.CATALOG_DIR = catalogDir;
    const config = loadConfig();
    const catalog = loadServiceCatalog(catalogDir);
    const monitor = createMonitor(config, catalog, {
      snapshot: {
        podsByService: { 'example-api': [{ name: 'p', phase: 'Running', ready: true, restarts: 0, reason: null }] },
        logTailByService: { 'example-api': ['ERROR x'] },
        sampleComplete: false,
      },
    });
    await expect(monitor.gateCheck({ kind: 'error-rate', service: 'example-api' })).rejects.toMatchObject({
      code: 'monitor_k8s_sample_incomplete',
    });
    expect(HttpError).toBeTruthy();
  });
});
