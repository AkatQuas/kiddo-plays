import type { AppConfig } from './config.js';
import { createApp } from './http.js';
import { createMonitor } from './monitor/k8s.js';
import { createDockerProvider } from './providers/docker.js';
import { createJenkinsProvider } from './providers/jenkins.js';
import { createMockProvider } from './providers/mock.js';
import { createProviderRegistry } from './providers/registry.js';
import { loadServiceCatalog } from './services.js';
import { createTaskEngine } from './task/engine.js';
import { createMemoryLockManager } from './task/locks.js';
import { createMemoryStore } from './task/store.js';

export function createRuntime(config: AppConfig, log: { info?: (...a: unknown[]) => void; error?: (...a: unknown[]) => void } = {}) {
  const catalog = loadServiceCatalog(config.catalogDir);
  const store = createMemoryStore();
  const locks = createMemoryLockManager();
  const providers = createProviderRegistry([createMockProvider()]);

  if (config.jenkins) {
    providers.register(createJenkinsProvider(config.jenkins));
    log.info?.('provider registered: jenkins');
  }
  // Docker provider is always registered as a mechanism; execution needs a local docker CLI.
  providers.register(createDockerProvider(config.docker ?? {}));
  log.info?.('provider registered: docker');

  const engine = createTaskEngine({ store, locks, providers, log });
  const monitor = createMonitor(config, catalog);
  const app = createApp({ store, engine, providers, catalog, monitor });

  return { app, store, engine, providers, catalog, monitor, locks };
}
