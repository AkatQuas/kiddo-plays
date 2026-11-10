import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'smol-toml';

export type ServiceMonitor = {
  deployment?: string;
  container?: string;
  namespace?: string;
  hosting?: 'deployment' | 'static';
  noise_patterns?: string[];
};

export type CatalogService = {
  id: string;
  title: string;
  enabled: boolean;
  monitor: ServiceMonitor;
};

export type CatalogEnv = {
  id: string;
  title: string;
  enabled: boolean;
};

export type ServiceCatalog = {
  services: CatalogService[];
  envs: CatalogEnv[];
  defaultService: string | null;
  defaultEnv: string | null;
};

type ServicesToml = {
  default?: string;
  services?: Array<{
    id: string;
    title?: string;
    enabled?: boolean;
    monitor?: ServiceMonitor;
  }>;
};

type EnvsToml = {
  default?: string;
  envs?: Array<{
    id: string;
    title?: string;
    enabled?: boolean;
  }>;
};

export function loadServiceCatalog(catalogDir: string): ServiceCatalog {
  const servicesPath = path.join(catalogDir, 'services.toml');
  const envsPath = path.join(catalogDir, 'envs.toml');
  const servicesRaw = parse(fs.readFileSync(servicesPath, 'utf8')) as ServicesToml;
  const envsRaw = fs.existsSync(envsPath)
    ? (parse(fs.readFileSync(envsPath, 'utf8')) as EnvsToml)
    : { envs: [] };

  const services: CatalogService[] = (servicesRaw.services ?? []).map((s) => ({
    id: s.id,
    title: s.title ?? s.id,
    enabled: s.enabled !== false,
    monitor: {
      hosting: s.monitor?.hosting ?? 'deployment',
      deployment: s.monitor?.deployment ?? s.id,
      container: s.monitor?.container ?? s.id,
      namespace: s.monitor?.namespace,
      noise_patterns: s.monitor?.noise_patterns ?? [],
    },
  }));

  const envs: CatalogEnv[] = (envsRaw.envs ?? []).map((e) => ({
    id: e.id,
    title: e.title ?? e.id,
    enabled: e.enabled !== false,
  }));

  return {
    services,
    envs,
    defaultService: servicesRaw.default ?? services[0]?.id ?? null,
    defaultEnv: envsRaw.default ?? envs[0]?.id ?? null,
  };
}
