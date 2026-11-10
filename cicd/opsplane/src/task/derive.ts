import type { Step, TaskSummary } from './types.js';

export function deriveSummary(steps: Step[]): TaskSummary {
  if (steps.some((s) => s.status === 'unconfirmed')) return 'unconfirmed';
  if (steps.some((s) => s.status === 'failed')) return 'blocked';
  if (steps.length > 0 && steps.every((s) => s.status === 'succeeded')) return 'ready';
  return 'running';
}
