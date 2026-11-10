import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { filterCatalog } from './catalog.js';
import { HttpError } from './errors.js';
import type { Monitor } from './monitor/k8s.js';
import type { ProviderRegistry } from './providers/registry.js';
import type { ServiceCatalog } from './services.js';
import type { TaskEngine } from './task/engine.js';
import type { TaskStore } from './task/store.js';

const createTaskBody = z.object({
  type: z.string().min(1),
  env: z.string().min(1),
  target: z.string().min(1),
  steps: z
    .array(
      z.object({
        name: z.string().min(1),
        provider: z.string().min(1),
        detail: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
  idempotency_key: z.string().min(1).optional(),
});

const retryBody = z.object({
  confirm: z.boolean(),
});

const gateBody = z.object({
  kind: z.enum(['k8s-health', 'error-rate']),
  service: z.string().optional(),
  namespace: z.string().optional(),
  threshold: z.number().optional(),
  state: z.record(z.string(), z.unknown()).optional(),
});

export type AppDeps = {
  store: TaskStore;
  engine: TaskEngine;
  providers: ProviderRegistry;
  catalog: ServiceCatalog;
  monitor: Monitor;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      const status = err.status as 400 | 404 | 409 | 503;
      return c.json({ error: err.message, code: err.code ?? null }, status);
    }
    console.error(err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  });

  app.get('/health', (c) => c.json({ ok: true, alive: true, service: 'opsplane' }));

  app.get('/catalog', (c) => {
    const q = c.req.query('q') ?? undefined;
    return c.json({ verbs: filterCatalog(q) });
  });

  app.get('/providers', (c) => c.json({ providers: deps.providers.list() }));

  app.get('/services', (c) =>
    c.json({
      default: deps.catalog.defaultService,
      services: deps.catalog.services.filter((s) => s.enabled),
    }),
  );

  app.get('/envs', (c) =>
    c.json({
      default: deps.catalog.defaultEnv,
      envs: deps.catalog.envs.filter((e) => e.enabled),
    }),
  );

  app.get('/tasks', async (c) => {
    const limit = Number(c.req.query('limit') ?? '50');
    return c.json({ tasks: await deps.store.listTasks(Number.isFinite(limit) ? limit : 50) });
  });

  app.post('/tasks', zValidator('json', createTaskBody), async (c) => {
    const body = c.req.valid('json');
    for (const step of body.steps) deps.providers.get(step.provider);
    const { task, created } = await deps.store.createTask(body);
    if (created) deps.engine.kick(task.task_id);
    return c.json({ task, created }, created ? 201 : 200);
  });

  app.get('/tasks/:id', async (c) => {
    const task = await deps.store.getTask(c.req.param('id'));
    if (!task) throw new HttpError(404, 'task not found');
    return c.json({ task });
  });

  app.get('/tasks/:id/events', async (c) => {
    const events = await deps.store.listEvents(c.req.param('id'));
    return c.json({ events });
  });

  app.post('/tasks/:id/resume', async (c) => {
    const task = await deps.engine.resume(c.req.param('id'));
    return c.json({ task });
  });

  app.post('/tasks/:id/retry', zValidator('json', retryBody), async (c) => {
    const task = await deps.engine.retry(c.req.param('id'), c.req.valid('json').confirm);
    return c.json({ task });
  });

  app.get('/monitor/overview', async (c) => {
    const overview = await deps.monitor.overview({
      env: c.req.query('env') ?? undefined,
      window: c.req.query('window') ?? undefined,
    });
    return c.json(overview);
  });

  app.get('/monitor/services/:id', async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const view = await deps.monitor.service(c.req.param('id'), {
      env: c.req.query('env') ?? undefined,
      window: c.req.query('window') ?? undefined,
      limit,
    });
    return c.json(view);
  });

  app.post('/monitor/gate-check', zValidator('json', gateBody), async (c) => {
    const result = await deps.monitor.gateCheck(c.req.valid('json'));
    return c.json(result);
  });

  return app;
}
