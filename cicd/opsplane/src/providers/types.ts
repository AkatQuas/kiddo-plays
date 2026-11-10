import type { Step, StepResult, UpstreamState } from '../task/types.js';

export type TaskContext = {
  taskId: string;
  env: string;
  target: string;
  log?: { info?: (...a: unknown[]) => void; error?: (...a: unknown[]) => void };
};

export type BuildProvider = {
  id: string;
  title: string;
  description: string;
  execute(step: Step, ctx: TaskContext): Promise<StepResult>;
  inspect?(ref: string, ctx: TaskContext): Promise<UpstreamState>;
};

export type ProviderInfo = Pick<BuildProvider, 'id' | 'title' | 'description'>;
