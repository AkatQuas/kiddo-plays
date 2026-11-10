export type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'unconfirmed';

export type TaskSummary = 'running' | 'ready' | 'blocked' | 'unconfirmed';

export type Step = {
  step_id: string;
  task_id: string;
  name: string;
  provider: string;
  status: StepStatus;
  upstream_ref: string | null;
  error_excerpt: string | null;
  detail: Record<string, unknown>;
  updated_at: string;
};

export type TaskEvent = {
  event_id: string;
  task_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Task = {
  task_id: string;
  type: string;
  env: string;
  target: string;
  idempotency_key: string | null;
  status_note: string | null;
  created_at: string;
  steps: Step[];
  summary: TaskSummary;
};

export type CreateTaskInput = {
  type: string;
  env: string;
  target: string;
  steps: Array<{ name: string; provider: string; detail?: Record<string, unknown> }>;
  idempotency_key?: string;
  task_id?: string;
};

export type StepResult = {
  status: 'succeeded' | 'failed' | 'unconfirmed' | 'running';
  upstream_ref?: string | null;
  error_excerpt?: string | null;
  detail?: Record<string, unknown>;
};

export type UpstreamState = {
  terminal: boolean;
  success: boolean;
  building: boolean;
  raw?: Record<string, unknown>;
};
