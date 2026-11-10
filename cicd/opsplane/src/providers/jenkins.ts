import type { BuildProvider } from './types.js';

export type JenkinsConfig = {
  base: string;
  username: string;
  apiToken: string;
  fetch?: typeof fetch;
};

/**
 * Generic Jenkins job provider skeleton.
 * Expects step.detail.job (job name) and optional step.detail.params.
 * Does not hard-code any organization-specific jobs or URLs.
 */
export function createJenkinsProvider(config: JenkinsConfig): BuildProvider {
  const base = config.base.replace(/\/$/, '');
  const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');
  const doFetch = config.fetch ?? fetch;

  async function jenkins(path: string, init?: RequestInit): Promise<Response> {
    return doFetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  return {
    id: 'jenkins',
    title: 'Jenkins job',
    description: 'Trigger and poll a Jenkins job via HTTP. Configure JENKINS_* env vars.',
    async execute(step) {
      const job = String(step.detail.job ?? '');
      if (!job) {
        return { status: 'failed', error_excerpt: 'jenkins: step.detail.job is required' };
      }
      try {
        const encoded = job.split('/').map(encodeURIComponent).join('/job/');
        const trigger = await jenkins(`/job/${encoded}/build`, { method: 'POST' });
        if (!trigger.ok && trigger.status !== 201) {
          return {
            status: 'unconfirmed',
            error_excerpt: `jenkins: trigger HTTP ${trigger.status}; do not retry until inspected`,
          };
        }
        const location = trigger.headers.get('location');
        return {
          status: 'running',
          upstream_ref: location ?? `${base}/job/${encoded}`,
          detail: { job },
        };
      } catch (err) {
        return {
          status: 'unconfirmed',
          error_excerpt: `jenkins: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
    async inspect(ref) {
      try {
        const url = ref.includes('/api/json') ? ref : `${ref.replace(/\/$/, '')}/api/json`;
        const res = await jenkins(url.replace(base, '') || url);
        if (!res.ok) return { terminal: false, success: false, building: false, raw: { status: res.status } };
        const body = (await res.json()) as { building?: boolean; result?: string | null };
        const building = Boolean(body.building);
        const result = body.result ?? null;
        return {
          building,
          terminal: !building && result != null,
          success: result === 'SUCCESS',
          raw: body as Record<string, unknown>,
        };
      } catch {
        return { terminal: false, success: false, building: false };
      }
    },
  };
}
