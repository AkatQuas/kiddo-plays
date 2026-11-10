import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors.js';
import { deriveSummary } from './derive.js';
import type { CreateTaskInput, Step, StepStatus, Task, TaskEvent } from './types.js';

export type TaskStore = {
  createTask(input: CreateTaskInput): Promise<{ task: Task; created: boolean }>;
  getTask(taskId: string): Promise<Task | null>;
  listTasks(limit?: number): Promise<Task[]>;
  listInFlightTaskIds(): Promise<string[]>;
  updateStep(
    taskId: string,
    stepName: string,
    patch: {
      status?: StepStatus;
      upstream_ref?: string | null;
      error_excerpt?: string | null;
      detail?: Record<string, unknown>;
    },
  ): Promise<Step>;
  appendEvent(taskId: string, eventType: string, payload?: Record<string, unknown>): Promise<TaskEvent>;
  listEvents(taskId: string): Promise<TaskEvent[]>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function present(task: Omit<Task, 'summary'> & { summary?: TaskSummaryLike }): Task {
  return { ...task, summary: deriveSummary(task.steps) };
}

type TaskSummaryLike = Task['summary'];

export function createMemoryStore(): TaskStore {
  const tasks = new Map<string, Task>();
  const events = new Map<string, TaskEvent[]>();
  const byIdem = new Map<string, string>();

  function requireTask(taskId: string): Task {
    const task = tasks.get(taskId);
    if (!task) throw new HttpError(404, 'task not found');
    return task;
  }

  return {
    async createTask(input) {
      if (input.idempotency_key) {
        const existingId = byIdem.get(input.idempotency_key);
        if (existingId) {
          const existing = tasks.get(existingId);
          if (existing) return { task: present(existing), created: false };
        }
      }
      const taskId = input.task_id ?? randomUUID();
      const createdAt = nowIso();
      const steps: Step[] = input.steps.map((s) => ({
        step_id: randomUUID(),
        task_id: taskId,
        name: s.name,
        provider: s.provider,
        status: 'pending',
        upstream_ref: null,
        error_excerpt: null,
        detail: s.detail ?? {},
        updated_at: createdAt,
      }));
      const task: Task = present({
        task_id: taskId,
        type: input.type,
        env: input.env,
        target: input.target,
        idempotency_key: input.idempotency_key ?? null,
        status_note: null,
        created_at: createdAt,
        steps,
      });
      tasks.set(taskId, task);
      if (input.idempotency_key) byIdem.set(input.idempotency_key, taskId);
      const ev: TaskEvent = {
        event_id: randomUUID(),
        task_id: taskId,
        event_type: 'created',
        payload: { type: input.type, env: input.env, target: input.target },
        created_at: createdAt,
      };
      events.set(taskId, [ev]);
      return { task, created: true };
    },

    async getTask(taskId) {
      const task = tasks.get(taskId);
      return task ? present(task) : null;
    },

    async listTasks(limit = 50) {
      return [...tasks.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(present);
    },

    async listInFlightTaskIds() {
      return [...tasks.values()]
        .filter((t) => t.steps.some((s) => s.status === 'pending' || s.status === 'running'))
        .map((t) => t.task_id);
    },

    async updateStep(taskId, stepName, patch) {
      const task = requireTask(taskId);
      const step = task.steps.find((s) => s.name === stepName);
      if (!step) throw new HttpError(404, `step not found: ${stepName}`);
      if (patch.status !== undefined) step.status = patch.status;
      if (patch.upstream_ref !== undefined) step.upstream_ref = patch.upstream_ref;
      if (patch.error_excerpt !== undefined) step.error_excerpt = patch.error_excerpt;
      if (patch.detail !== undefined) step.detail = { ...step.detail, ...patch.detail };
      step.updated_at = nowIso();
      tasks.set(taskId, present(task));
      return { ...step };
    },

    async appendEvent(taskId, eventType, payload = {}) {
      requireTask(taskId);
      const ev: TaskEvent = {
        event_id: randomUUID(),
        task_id: taskId,
        event_type: eventType,
        payload,
        created_at: nowIso(),
      };
      const list = events.get(taskId) ?? [];
      list.push(ev);
      events.set(taskId, list);
      return ev;
    },

    async listEvents(taskId) {
      requireTask(taskId);
      return [...(events.get(taskId) ?? [])];
    },
  };
}
