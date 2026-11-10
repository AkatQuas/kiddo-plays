import { describe, expect, it } from 'vitest';
import { createMockProvider } from '../src/providers/mock.js';
import { createProviderRegistry } from '../src/providers/registry.js';
import { createTaskEngine } from '../src/task/engine.js';
import { createMemoryLockManager } from '../src/task/locks.js';
import { createMemoryStore } from '../src/task/store.js';
import { HttpError } from '../src/errors.js';

async function waitReady(store: ReturnType<typeof createMemoryStore>, id: string, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const t = await store.getTask(id);
    if (t && t.summary !== 'running') return t;
    await new Promise((r) => setTimeout(r, 10));
  }
  return store.getTask(id);
}

describe('task engine', () => {
  it('creates, kicks, and reaches ready via mock provider', async () => {
    const store = createMemoryStore();
    const providers = createProviderRegistry([createMockProvider()]);
    const engine = createTaskEngine({ store, locks: createMemoryLockManager(), providers });
    const { task, created } = await store.createTask({
      type: 'build',
      env: 'dev',
      target: 'example-api',
      steps: [{ name: 'image', provider: 'mock' }],
    });
    expect(created).toBe(true);
    engine.kick(task.task_id);
    const done = await waitReady(store, task.task_id);
    expect(done?.summary).toBe('ready');
    expect(done?.steps[0]?.status).toBe('succeeded');
  });

  it('idempotency_key returns the same task without re-create', async () => {
    const store = createMemoryStore();
    const a = await store.createTask({
      type: 'build',
      env: 'dev',
      target: 'example-api',
      idempotency_key: 'k1',
      steps: [{ name: 'a', provider: 'mock' }],
    });
    const b = await store.createTask({
      type: 'build',
      env: 'dev',
      target: 'example-api',
      idempotency_key: 'k1',
      steps: [{ name: 'a', provider: 'mock' }],
    });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.task.task_id).toBe(a.task.task_id);
  });

  it('marks unconfirmed and refuses retry', async () => {
    const store = createMemoryStore();
    const providers = createProviderRegistry([createMockProvider({ unconfirmNames: ['x'] })]);
    const engine = createTaskEngine({ store, locks: createMemoryLockManager(), providers });
    const { task } = await store.createTask({
      type: 'build',
      env: 'dev',
      target: 't',
      steps: [{ name: 'x', provider: 'mock' }],
    });
    await engine.run(task.task_id);
    const after = await store.getTask(task.task_id);
    expect(after?.summary).toBe('unconfirmed');
    await expect(engine.retry(task.task_id, true)).rejects.toMatchObject({ code: 'unconfirmed' });
  });

  it('retry requires confirm and clears failed steps', async () => {
    const store = createMemoryStore();
    const providers = createProviderRegistry([createMockProvider({ failNames: ['x'] })]);
    const engine = createTaskEngine({ store, locks: createMemoryLockManager(), providers });
    const { task } = await store.createTask({
      type: 'build',
      env: 'dev',
      target: 't',
      steps: [{ name: 'x', provider: 'mock' }],
    });
    await engine.run(task.task_id);
    expect((await store.getTask(task.task_id))?.summary).toBe('blocked');
    await expect(engine.retry(task.task_id, false)).rejects.toBeInstanceOf(HttpError);

    // swap provider to succeed on retry
    providers.register(createMockProvider());
    await engine.retry(task.task_id, true);
    const done = await waitReady(store, task.task_id);
    expect(done?.summary).toBe('ready');
  });

  it('task lock rejects concurrent work', async () => {
    const locks = createMemoryLockManager();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = locks.withTaskLock('t1', async () => {
      await gate;
      return 1;
    });
    await expect(locks.withTaskLock('t1', async () => 2)).rejects.toMatchObject({ code: 'task_busy' });
    release();
    await expect(first).resolves.toBe(1);
  });
});
