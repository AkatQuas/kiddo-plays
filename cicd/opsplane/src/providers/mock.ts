import type { BuildProvider } from './types.js';

/** Deterministic provider for local demos and contract tests. */
export function createMockProvider(opts: { failNames?: string[]; unconfirmNames?: string[] } = {}): BuildProvider {
  const fail = new Set(opts.failNames ?? []);
  const unconfirm = new Set(opts.unconfirmNames ?? []);

  return {
    id: 'mock',
    title: 'Mock build',
    description: 'In-process fake builder for demos and tests. No external network.',
    async execute(step) {
      if (unconfirm.has(step.name)) {
        return { status: 'unconfirmed', error_excerpt: 'mock: upstream state unknown' };
      }
      if (fail.has(step.name)) {
        return { status: 'failed', error_excerpt: `mock: step ${step.name} failed`, upstream_ref: `mock://fail/${step.name}` };
      }
      return {
        status: 'succeeded',
        upstream_ref: `mock://${step.name}/${Date.now()}`,
        detail: { mock: true },
      };
    },
    async inspect(ref) {
      if (ref.includes('building')) return { terminal: false, success: false, building: true };
      if (ref.includes('fail')) return { terminal: true, success: false, building: false };
      return { terminal: true, success: true, building: false };
    },
  };
}
