export type CatalogVerb = {
  id: string;
  when: string;
  method: 'GET' | 'POST';
  path: string;
  required: string[];
  optional?: string[];
  confirm: string[];
  related: string[];
};

export const CATALOG: CatalogVerb[] = [
  {
    id: 'catalog.get',
    when: 'List agent-visible verbs (authoritative API surface)',
    method: 'GET',
    path: '/catalog',
    required: [],
    optional: ['q'],
    confirm: [],
    related: ['provider.list'],
  },
  {
    id: 'provider.list',
    when: 'List registered build mechanisms (mock, jenkins, docker, custom)',
    method: 'GET',
    path: '/providers',
    required: [],
    confirm: [],
    related: ['task.create'],
  },
  {
    id: 'service.list',
    when: 'List catalog services and their K8s monitor mapping',
    method: 'GET',
    path: '/services',
    required: [],
    confirm: [],
    related: ['env.list', 'monitor.overview'],
  },
  {
    id: 'env.list',
    when: 'List environments',
    method: 'GET',
    path: '/envs',
    required: [],
    confirm: [],
    related: ['service.list'],
  },
  {
    id: 'task.create',
    when: 'Create a task (build / gate / custom). Idempotent with idempotency_key.',
    method: 'POST',
    path: '/tasks',
    required: ['type', 'env', 'target', 'steps'],
    optional: ['idempotency_key'],
    confirm: [],
    related: ['task.get', 'task.resume', 'task.retry'],
  },
  {
    id: 'task.list',
    when: 'List recent tasks',
    method: 'GET',
    path: '/tasks',
    required: [],
    optional: ['limit'],
    confirm: [],
    related: ['task.get'],
  },
  {
    id: 'task.get',
    when: 'Get one task with derived summary',
    method: 'GET',
    path: '/tasks/:id',
    required: ['id'],
    confirm: [],
    related: ['task.events', 'task.resume', 'task.retry'],
  },
  {
    id: 'task.events',
    when: 'Append-only event stream for a task',
    method: 'GET',
    path: '/tasks/:id/events',
    required: ['id'],
    confirm: [],
    related: ['task.get'],
  },
  {
    id: 'task.resume',
    when: 'Resume monitoring / continue pending steps without clearing upstream refs',
    method: 'POST',
    path: '/tasks/:id/resume',
    required: ['id'],
    confirm: [],
    related: ['task.retry', 'task.get'],
  },
  {
    id: 'task.retry',
    when: 'After verifying upstream terminal failure, clear failed steps and re-run. Requires confirm=true. Forbidden while unconfirmed.',
    method: 'POST',
    path: '/tasks/:id/retry',
    required: ['id', 'confirm'],
    confirm: ['confirm'],
    related: ['task.resume', 'task.get'],
  },
  {
    id: 'monitor.overview',
    when: 'Summarize K8s health for catalog services',
    method: 'GET',
    path: '/monitor/overview',
    required: [],
    optional: ['env', 'window'],
    confirm: [],
    related: ['monitor.service', 'monitor.gate_check'],
  },
  {
    id: 'monitor.service',
    when: 'Pod list, events, log tail, and forensic anchors for one service',
    method: 'GET',
    path: '/monitor/services/:id',
    required: ['id'],
    optional: ['env', 'window', 'limit'],
    confirm: [],
    related: ['monitor.overview', 'monitor.gate_check'],
  },
  {
    id: 'monitor.gate_check',
    when: 'Edge detector for k8s-health or error-rate; incomplete samples return 503',
    method: 'POST',
    path: '/monitor/gate-check',
    required: ['kind'],
    optional: ['service', 'namespace', 'threshold'],
    confirm: [],
    related: ['monitor.service'],
  },
  {
    id: 'health.get',
    when: 'Liveness / readiness',
    method: 'GET',
    path: '/health',
    required: [],
    confirm: [],
    related: [],
  },
];

export function filterCatalog(q?: string): CatalogVerb[] {
  if (!q) return CATALOG;
  const needle = q.toLowerCase();
  return CATALOG.filter(
    (v) =>
      v.id.includes(needle) ||
      v.path.includes(needle) ||
      v.when.toLowerCase().includes(needle),
  );
}
