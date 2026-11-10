import { HttpError } from '../errors.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { LockManager } from './locks.js';
import type { TaskStore } from './store.js';
import type { Task } from './types.js';

export type TaskEngine = {
  kick(taskId: string): void;
  run(taskId: string): Promise<void>;
  isBusy(taskId: string): boolean;
  resumeInFlight(): Promise<string[]>;
  resume(taskId: string): Promise<Task>;
  retry(taskId: string, confirm?: boolean): Promise<Task>;
};

export function createTaskEngine(opts: {
  store: TaskStore;
  locks: LockManager;
  providers: ProviderRegistry;
  log?: { info?: (...a: unknown[]) => void; error?: (...a: unknown[]) => void };
}): TaskEngine {
  const { store, locks, providers, log = {} } = opts;
  const inflight = new Map<string, Promise<void>>();

  async function runExclusive(taskId: string, work: () => Promise<void>): Promise<void> {
    const existing = inflight.get(taskId);
    if (existing) return existing;
    const p = work().finally(() => {
      inflight.delete(taskId);
    });
    inflight.set(taskId, p);
    return p;
  }

  async function processTask(taskId: string): Promise<void> {
    const task = await store.getTask(taskId);
    if (!task) return;

    for (const step of task.steps) {
      if (step.status !== 'pending' && step.status !== 'running') continue;
      await store.updateStep(taskId, step.name, { status: 'running' });
      await store.appendEvent(taskId, 'step_started', { step: step.name, provider: step.provider });

      const provider = providers.get(step.provider);
      const result = await provider.execute(step, {
        taskId,
        env: task.env,
        target: task.target,
        log,
      });

      await store.updateStep(taskId, step.name, {
        status: result.status === 'running' ? 'running' : result.status,
        upstream_ref: result.upstream_ref ?? step.upstream_ref,
        error_excerpt: result.error_excerpt ?? null,
        detail: result.detail,
      });
      await store.appendEvent(taskId, `step_${result.status}`, {
        step: step.name,
        upstream_ref: result.upstream_ref ?? null,
        error_excerpt: result.error_excerpt ?? null,
      });

      if (result.status === 'failed' || result.status === 'unconfirmed') return;
    }
  }

  function run(taskId: string): Promise<void> {
    return runExclusive(taskId, () => locks.withTaskLock(taskId, () => processTask(taskId)));
  }

  function kick(taskId: string): void {
    run(taskId).catch((err: unknown) => {
      log.error?.(`[engine] task ${taskId}:`, err instanceof Error ? err.message : err);
    });
  }

  return {
    kick,
    run,
    isBusy(taskId) {
      return inflight.has(taskId);
    },
    async resumeInFlight() {
      const ids = await store.listInFlightTaskIds();
      for (const id of ids) kick(id);
      return ids;
    },
    async resume(taskId) {
      const task = await store.getTask(taskId);
      if (!task) throw new HttpError(404, 'task not found');
      // resume only re-attaches monitoring / continues pending work — never clears upstream refs
      await store.appendEvent(taskId, 'resume', {});
      kick(taskId);
      return (await store.getTask(taskId))!;
    },
    async retry(taskId, confirm = false) {
      if (!confirm) throw new HttpError(400, 'retry requires confirm=true', 'confirm_required');
      const task = await store.getTask(taskId);
      if (!task) throw new HttpError(404, 'task not found');
      if (task.steps.some((s) => s.status === 'unconfirmed')) {
        throw new HttpError(409, 'unconfirmed steps must be resumed/inspected before retry', 'unconfirmed');
      }
      const failed = task.steps.filter((s) => s.status === 'failed');
      if (!failed.length) throw new HttpError(409, 'no failed steps to retry', 'nothing_to_retry');

      for (const step of failed) {
        if (step.upstream_ref) {
          const provider = providers.get(step.provider);
          if (provider.inspect) {
            const state = await provider.inspect(step.upstream_ref, {
              taskId,
              env: task.env,
              target: task.target,
              log,
            });
            if (state.building || !state.terminal) {
              throw new HttpError(409, `upstream still active for step ${step.name}`, 'upstream_active');
            }
            if (state.success) {
              throw new HttpError(409, `upstream succeeded for step ${step.name}; resume instead of retry`, 'upstream_succeeded');
            }
          }
        }
        await store.updateStep(taskId, step.name, {
          status: 'pending',
          upstream_ref: null,
          error_excerpt: null,
        });
      }
      await store.appendEvent(taskId, 'retry', { steps: failed.map((s) => s.name) });
      kick(taskId);
      return (await store.getTask(taskId))!;
    },
  };
}
