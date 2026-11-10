import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type AppConfig = {
  host: string;
  port: number;
  databaseUrl: string | null;
  catalogDir: string;
  buildPollTimeoutMs: number;
  jenkins: { base: string; username: string; apiToken: string } | null;
  docker: { host?: string; registry?: string; username?: string; password?: string } | null;
  k8s: { namespace: string; kubeconfig: string | null };
  monitor: { promBase: string | null; logsBase: string | null };
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function loadConfig(): AppConfig {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const defaultCatalog = path.resolve(here, '../catalog/examples');
  const catalogDir = path.resolve(env('CATALOG_DIR') ?? defaultCatalog);

  const jenkinsBase = env('JENKINS_BASE');
  const jenkinsUser = env('JENKINS_USERNAME');
  const jenkinsToken = env('JENKINS_API_TOKEN');
  const jenkins =
    jenkinsBase && jenkinsUser && jenkinsToken
      ? { base: jenkinsBase, username: jenkinsUser, apiToken: jenkinsToken }
      : null;

  const dockerHost = env('DOCKER_HOST');
  const dockerRegistry = env('DOCKER_REGISTRY');
  const dockerUser = env('DOCKER_USERNAME');
  const dockerPass = env('DOCKER_PASSWORD');
  const docker =
    dockerHost || dockerRegistry || dockerUser || dockerPass
      ? {
          ...(dockerHost ? { host: dockerHost } : {}),
          ...(dockerRegistry ? { registry: dockerRegistry } : {}),
          ...(dockerUser ? { username: dockerUser } : {}),
          ...(dockerPass ? { password: dockerPass } : {}),
        }
      : null;

  if (!fs.existsSync(catalogDir)) {
    throw new Error(`CATALOG_DIR not found: ${catalogDir}`);
  }

  return {
    host: env('HOST') ?? '127.0.0.1',
    port: Number(env('PORT') ?? '43200'),
    databaseUrl: env('DATABASE_URL') ?? null,
    catalogDir,
    buildPollTimeoutMs: Number(env('BUILD_POLL_TIMEOUT_MS') ?? '1800000'),
    jenkins,
    docker,
    k8s: {
      namespace: env('K8S_NAMESPACE') ?? 'default',
      kubeconfig: env('KUBECONFIG') ?? null,
    },
    monitor: {
      promBase: env('MONITOR_PROM_BASE') ?? null,
      logsBase: env('MONITOR_LOGS_BASE') ?? null,
    },
  };
}
