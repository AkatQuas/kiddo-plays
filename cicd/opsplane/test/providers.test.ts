import { describe, expect, it } from 'vitest';
import { createDockerProvider } from '../src/providers/docker.js';
import { createJenkinsProvider } from '../src/providers/jenkins.js';

describe('providers', () => {
  it('jenkins requires job detail', async () => {
    const p = createJenkinsProvider({
      base: 'https://jenkins.example.com',
      username: 'u',
      apiToken: 't',
      fetch: async () => new Response(null, { status: 201, headers: { location: 'https://jenkins.example.com/queue/1' } }),
    });
    const missing = await p.execute(
      {
        step_id: '1',
        task_id: 't',
        name: 'pack',
        provider: 'jenkins',
        status: 'running',
        upstream_ref: null,
        error_excerpt: null,
        detail: {},
        updated_at: new Date().toISOString(),
      },
      { taskId: 't', env: 'dev', target: 'x' },
    );
    expect(missing.status).toBe('failed');

    const ok = await p.execute(
      {
        step_id: '1',
        task_id: 't',
        name: 'pack',
        provider: 'jenkins',
        status: 'running',
        upstream_ref: null,
        error_excerpt: null,
        detail: { job: 'example-api' },
        updated_at: new Date().toISOString(),
      },
      { taskId: 't', env: 'dev', target: 'x' },
    );
    expect(ok.status).toBe('running');
    expect(ok.upstream_ref).toContain('queue');
  });

  it('docker build uses injected runner', async () => {
    const calls: string[][] = [];
    const p = createDockerProvider({
      run: async (argv) => {
        calls.push(argv);
        return { code: 0, stdout: 'ok', stderr: '' };
      },
    });
    const result = await p.execute(
      {
        step_id: '1',
        task_id: 't',
        name: 'image',
        provider: 'docker',
        status: 'running',
        upstream_ref: null,
        error_excerpt: null,
        detail: { tag: 'example-api:dev', context: '.', push: true },
        updated_at: new Date().toISOString(),
      },
      { taskId: 't', env: 'dev', target: 'x' },
    );
    expect(result.status).toBe('succeeded');
    expect(calls[0]?.slice(0, 3)).toEqual(['docker', 'build', '-t']);
    expect(calls.some((c) => c[0] === 'docker' && c[1] === 'push')).toBe(true);
  });
});
