import { spawn } from 'node:child_process';
import type { BuildProvider } from './types.js';

export type DockerConfig = {
  host?: string;
  registry?: string;
  username?: string;
  password?: string;
  run?: (argv: string[], env: NodeJS.ProcessEnv) => Promise<{ code: number; stdout: string; stderr: string }>;
};

function defaultRun(argv: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/**
 * Generic Docker image build/push provider skeleton.
 * Expects step.detail.context, step.detail.tag, optional step.detail.dockerfile / push.
 */
export function createDockerProvider(config: DockerConfig = {}): BuildProvider {
  const run = config.run ?? defaultRun;

  return {
    id: 'docker',
    title: 'Docker build',
    description: 'Build (and optionally push) a container image. Configure DOCKER_* env vars.',
    async execute(step, ctx) {
      const context = String(step.detail.context ?? '.');
      const tag = String(step.detail.tag ?? '');
      if (!tag) return { status: 'failed', error_excerpt: 'docker: step.detail.tag is required' };
      const dockerfile = step.detail.dockerfile ? String(step.detail.dockerfile) : null;
      const push = Boolean(step.detail.push);

      const env: NodeJS.ProcessEnv = { ...process.env };
      if (config.host) env.DOCKER_HOST = config.host;

      const buildArgv = ['docker', 'build', '-t', tag];
      if (dockerfile) buildArgv.push('-f', dockerfile);
      buildArgv.push(context);

      try {
        const built = await run(buildArgv, env);
        if (built.code !== 0) {
          return {
            status: 'failed',
            error_excerpt: (built.stderr || built.stdout || 'docker build failed').slice(0, 2000),
            upstream_ref: `docker://${tag}`,
          };
        }
        if (push) {
          if (config.username && config.password && config.registry) {
            await run(['docker', 'login', '-u', config.username, '--password-stdin', config.registry], env);
          }
          const pushed = await run(['docker', 'push', tag], env);
          if (pushed.code !== 0) {
            return {
              status: 'failed',
              error_excerpt: (pushed.stderr || 'docker push failed').slice(0, 2000),
              upstream_ref: `docker://${tag}`,
            };
          }
        }
        ctx.log?.info?.(`docker: built ${tag}`);
        return { status: 'succeeded', upstream_ref: `docker://${tag}`, detail: { tag, pushed: push } };
      } catch (err) {
        return {
          status: 'unconfirmed',
          error_excerpt: `docker: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
    async inspect(ref) {
      return { terminal: true, success: !ref.includes('fail'), building: false, raw: { ref } };
    },
  };
}
