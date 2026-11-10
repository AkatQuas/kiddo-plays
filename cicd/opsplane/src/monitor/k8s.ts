import fs from 'node:fs';
import type { AppConfig } from '../config.js';
import type { CatalogService, ServiceCatalog } from '../services.js';
import { HttpError } from '../errors.js';

export type PodView = {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  reason: string | null;
};

export type ServiceMonitorView = {
  service: string;
  title: string;
  namespace: string;
  hosting: string;
  presence: 'present' | 'absent' | 'unknown';
  pods: PodView[];
  warning_events: Array<{ reason: string; message: string; count: number }>;
  log_tail: string[];
  log_coverage: 'indexed' | 'partial' | 'empty' | 'unavailable';
  error_count: number | null;
  sampled_at: string;
};

export type OverviewItem = {
  service: string;
  title: string;
  presence: 'present' | 'absent' | 'unknown';
  ready_pods: number;
  total_pods: number;
  restarts: number;
  crashloop: boolean;
  error_count: number | null;
  log_coverage: string;
};

export type GateCheckResult = {
  kind: string;
  firing: boolean;
  reason: string;
  state: Record<string, unknown>;
};

export type Monitor = {
  overview(input: { env?: string; window?: string }): Promise<{ at: string; namespace: string; services: OverviewItem[] }>;
  service(id: string, input: { env?: string; window?: string; limit?: number }): Promise<ServiceMonitorView>;
  gateCheck(input: {
    kind: 'k8s-health' | 'error-rate';
    service?: string;
    namespace?: string;
    threshold?: number;
    state?: Record<string, unknown>;
  }): Promise<GateCheckResult>;
};

type KubeList<T> = { items: T[] };

async function readToken(): Promise<string | null> {
  const p = '/var/run/secrets/kubernetes.io/serviceaccount/token';
  try {
    return await fs.promises.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function kubeFetch(
  config: AppConfig,
  apiPath: string,
): Promise<Response | null> {
  const token = await readToken();
  const host = process.env.KUBERNETES_SERVICE_HOST;
  const port = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? '443';
  if (!token || !host) return null;
  const url = `https://${host}:${port}${apiPath}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  }).catch(() => null);
}

function nsFor(service: CatalogService, fallback: string): string {
  return service.monitor.namespace ?? fallback;
}

function emptyServiceView(service: CatalogService, namespace: string, reason: string): ServiceMonitorView {
  return {
    service: service.id,
    title: service.title,
    namespace,
    hosting: service.monitor.hosting ?? 'deployment',
    presence: 'unknown',
    pods: [],
    warning_events: [],
    log_tail: [],
    log_coverage: 'unavailable',
    error_count: null,
    sampled_at: new Date().toISOString(),
  };
}

function countErrorLines(lines: string[], noise: string[]): number {
  const noiseRe = noise.map((n) => new RegExp(n, 'i'));
  let n = 0;
  for (const line of lines) {
    if (noiseRe.some((r) => r.test(line))) continue;
    if (/\bERROR\b/i.test(line) || /^\[error\]/i.test(line)) n += 1;
  }
  return n;
}

/** In-memory / offline stub used when the process is not in a cluster. */
export function createMonitor(config: AppConfig, catalog: ServiceCatalog, opts?: {
  /** Inject cluster snapshot for tests */
  snapshot?: {
    podsByService?: Record<string, PodView[]>;
    logTailByService?: Record<string, string[]>;
    sampleComplete?: boolean;
  };
}): Monitor {
  const snapshot = opts?.snapshot;

  async function loadService(service: CatalogService, limit = 20): Promise<ServiceMonitorView> {
    const namespace = nsFor(service, config.k8s.namespace);
    if (service.monitor.hosting === 'static') {
      return {
        ...emptyServiceView(service, namespace, 'static'),
        presence: 'unknown',
        log_coverage: 'empty',
        error_count: null,
      };
    }

    if (snapshot?.podsByService) {
      const pods = snapshot.podsByService[service.id] ?? [];
      const log_tail = (snapshot.logTailByService?.[service.id] ?? []).slice(0, limit);
      const complete = snapshot.sampleComplete !== false;
      return {
        service: service.id,
        title: service.title,
        namespace,
        hosting: 'deployment',
        presence: pods.length ? 'present' : 'absent',
        pods,
        warning_events: pods
          .filter((p) => p.reason)
          .map((p) => ({ reason: p.reason!, message: p.reason!, count: 1 })),
        log_tail,
        log_coverage: complete ? (log_tail.length ? 'partial' : 'empty') : 'partial',
        error_count: complete ? countErrorLines(log_tail, service.monitor.noise_patterns ?? []) : null,
        sampled_at: new Date().toISOString(),
      };
    }

    const dep = service.monitor.deployment ?? service.id;
    const listPath = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods?labelSelector=app%3D${encodeURIComponent(dep)}`;
    const res = await kubeFetch(config, listPath);
    if (!res) return emptyServiceView(service, namespace, 'k8s unconfigured');
    if (!res.ok) return emptyServiceView(service, namespace, `k8s HTTP ${res.status}`);

    const body = (await res.json()) as KubeList<{
      metadata?: { name?: string };
      status?: {
        phase?: string;
        containerStatuses?: Array<{ ready?: boolean; restartCount?: number; state?: { waiting?: { reason?: string }; terminated?: { reason?: string } } }>;
      };
    }>;

    const pods: PodView[] = (body.items ?? []).map((item) => {
      const cs = item.status?.containerStatuses?.[0];
      const reason = cs?.state?.waiting?.reason ?? cs?.state?.terminated?.reason ?? null;
      return {
        name: item.metadata?.name ?? 'unknown',
        phase: item.status?.phase ?? 'Unknown',
        ready: Boolean(cs?.ready),
        restarts: cs?.restartCount ?? 0,
        reason,
      };
    });

    return {
      service: service.id,
      title: service.title,
      namespace,
      hosting: 'deployment',
      presence: pods.length ? 'present' : 'absent',
      pods,
      warning_events: [],
      log_tail: [],
      log_coverage: 'partial',
      error_count: null,
      sampled_at: new Date().toISOString(),
    };
  }

  return {
    async overview() {
      const enabled = catalog.services.filter((s) => s.enabled);
      const services: OverviewItem[] = [];
      for (const s of enabled) {
        const view = await loadService(s);
        services.push({
          service: s.id,
          title: s.title,
          presence: view.presence,
          ready_pods: view.pods.filter((p) => p.ready).length,
          total_pods: view.pods.length,
          restarts: view.pods.reduce((a, p) => a + p.restarts, 0),
          crashloop: view.pods.some((p) => p.reason === 'CrashLoopBackOff'),
          error_count: view.error_count,
          log_coverage: view.log_coverage,
        });
      }
      return { at: new Date().toISOString(), namespace: config.k8s.namespace, services };
    },

    async service(id, input) {
      const service = catalog.services.find((s) => s.id === id);
      if (!service) throw new HttpError(404, `service not found: ${id}`);
      return loadService(service, input.limit ?? 20);
    },

    async gateCheck(input) {
      const prev = input.state ?? {};
      if (input.kind === 'k8s-health') {
        const service = catalog.services.find((s) => s.id === (input.service ?? catalog.defaultService));
        if (!service) throw new HttpError(400, 'service required for k8s-health');
        const view = await loadService(service);
        if (view.presence === 'unknown' && view.pods.length === 0 && !snapshot) {
          throw new HttpError(503, 'kubernetes status unavailable', 'monitor_k8s_status_unavailable');
        }
        const restarts = view.pods.reduce((a, p) => a + p.restarts, 0);
        const crashloop = view.pods.some((p) => p.reason === 'CrashLoopBackOff');
        const prevRestarts = Number(prev.restarts ?? 0);
        const firing = crashloop || restarts > prevRestarts;
        return {
          kind: input.kind,
          firing,
          reason: firing ? (crashloop ? 'CrashLoopBackOff' : 'restart_increased') : 'stable',
          state: { restarts, crashloop, service: service.id },
        };
      }

      // error-rate
      const service = catalog.services.find((s) => s.id === (input.service ?? catalog.defaultService));
      if (!service) throw new HttpError(400, 'service required for error-rate');
      const view = await loadService(service);
      if (view.error_count == null || view.log_coverage === 'partial' || view.log_coverage === 'unavailable') {
        throw new HttpError(503, 'k8s log sample incomplete', 'monitor_k8s_sample_incomplete');
      }
      const threshold = input.threshold ?? 1;
      const firing = view.error_count >= threshold;
      return {
        kind: input.kind,
        firing,
        reason: firing ? 'error_threshold' : 'below_threshold',
        state: { error_count: view.error_count, threshold, service: service.id },
      };
    },
  };
}
