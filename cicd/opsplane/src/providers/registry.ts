import { HttpError } from '../errors.js';
import type { BuildProvider, ProviderInfo } from './types.js';

export type ProviderRegistry = {
  register(provider: BuildProvider): void;
  get(id: string): BuildProvider;
  list(): ProviderInfo[];
};

export function createProviderRegistry(initial: BuildProvider[] = []): ProviderRegistry {
  const map = new Map<string, BuildProvider>();
  for (const p of initial) map.set(p.id, p);

  return {
    register(provider) {
      map.set(provider.id, provider);
    },
    get(id) {
      const p = map.get(id);
      if (!p) throw new HttpError(400, `unknown provider: ${id}`, 'unknown_provider');
      return p;
    },
    list() {
      return [...map.values()].map(({ id, title, description }) => ({ id, title, description }));
    },
  };
}
