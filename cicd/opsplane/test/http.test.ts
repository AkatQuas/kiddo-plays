import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createRuntime } from '../src/runtime.js';

const catalogDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../catalog/examples');

describe('http api', () => {
  it('exposes catalog, providers, and creates a mock task', async () => {
    process.env.CATALOG_DIR = catalogDir;
    process.env.HOST = '127.0.0.1';
    delete process.env.JENKINS_BASE;
    const config = loadConfig();
    const { app, store } = createRuntime(config);

    const catalog = await app.request('/catalog');
    expect(catalog.status).toBe(200);
    const catalogBody = (await catalog.json()) as { verbs: Array<{ id: string }> };
    expect(catalogBody.verbs.some((v) => v.id === 'task.create')).toBe(true);

    const providers = await app.request('/providers');
    const providerBody = (await providers.json()) as { providers: Array<{ id: string }> };
    const ids = providerBody.providers.map((p) => p.id);
    expect(ids).toContain('mock');
    expect(ids).toContain('docker');

    const created = await app.request('/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'build',
        env: 'dev',
        target: 'example-api',
        steps: [{ name: 'image', provider: 'mock' }],
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { task: { task_id: string } };
    expect(body.task.task_id).toBeTruthy();

    for (let i = 0; i < 40; i++) {
      const t = await store.getTask(body.task.task_id);
      if (t?.summary === 'ready') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const got = await app.request(`/tasks/${body.task.task_id}`);
    const gotBody = (await got.json()) as { task: { summary: string } };
    expect(gotBody.task.summary).toBe('ready');
  });

  it('lists example services for monitor', async () => {
    process.env.CATALOG_DIR = catalogDir;
    const { app } = createRuntime(loadConfig());
    const res = await app.request('/services');
    const body = (await res.json()) as { services: Array<{ id: string }> };
    expect(body.services.map((s) => s.id)).toContain('example-api');
  });
});
