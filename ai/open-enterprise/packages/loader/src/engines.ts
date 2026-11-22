// Several domain engines in one process.
//
// Each engine holds the catalog and ledgers it loaded itself. A request enters
// one of them through registry.run(id, ...). Ledger symbol lookup sees only
// that engine, and does not mix with an engine loaded later in the same process.

import { AsyncLocalStorage } from "node:async_hooks";
import {
  bindLedgerCatalogOverlay,
  type LedgerCatalog,
  type LedgerDefinition,
} from "@open-erp/metamodel";
import type { Catalog, LoadOptions } from "./catalog.js";

const ledgerScope = new AsyncLocalStorage<LedgerCatalog>();
bindLedgerCatalogOverlay(() => ledgerScope.getStore());

type LoadCatalog = (options: LoadOptions) => Promise<Catalog>;
let loadCatalogImpl: LoadCatalog | null = null;

/** Bound after loadCatalog is defined, so this file and index do not import each other. */
export function bindCatalogLoader(load: LoadCatalog): void {
  loadCatalogImpl = load;
}

export interface DomainEngine {
  readonly id: string;
  readonly domainsRoot: string;
  readonly catalog: Catalog;
  readonly ledgerCatalog: LedgerCatalog;
}

export interface EngineRegistration {
  readonly id: string;
  readonly domains: readonly { readonly code: string; readonly label: string }[];
  readonly modules: readonly { readonly code: string; readonly domain: string; readonly label: string }[];
}

export function describeEngine(engine: DomainEngine): EngineRegistration {
  return {
    id: engine.id,
    domains: engine.catalog.domains.map((domain) => ({ code: domain.code, label: domain.label })),
    modules: [...engine.catalog.modules.values()].map((mod) => ({
      code: mod.code,
      domain: mod.domain,
      label: mod.schema.label,
    })),
  };
}

function ledgerCatalogFrom(catalog: Catalog): LedgerCatalog {
  const ledgers: Record<string, LedgerDefinition> = {};
  for (const loaded of catalog.ledgers.values()) {
    ledgers[loaded.code] = {
      code: loaded.code,
      label: loaded.label,
      subject: loaded.subject,
      scope: loaded.scope,
      ops: loaded.ops,
      measure: loaded.measure,
      book: loaded.book,
      nonNegative: loaded.nonNegative,
    };
  }
  return { books: [...catalog.ledgerBooks], ledgers };
}

export function createEngineRegistry() {
  const engines = new Map<string, DomainEngine>();

  return {
    async register(id: string, domainsRoot: string): Promise<DomainEngine> {
      const name = id.trim();
      if (name === "") throw new Error("Engine id must not be empty.");
      if (engines.has(name)) throw new Error(`Engine "${name}" is already registered.`);
      if (loadCatalogImpl === null) throw new Error("The catalog loader is not bound yet.");
      const catalog = await loadCatalogImpl({ domainsRoot });
      const engine: DomainEngine = {
        id: name,
        domainsRoot,
        catalog,
        ledgerCatalog: ledgerCatalogFrom(catalog),
      };
      engines.set(name, engine);
      return engine;
    },

    list(): EngineRegistration[] {
      return [...engines.values()].map(describeEngine);
    },

    get(id: string): DomainEngine | null {
      return engines.get(id) ?? null;
    },

    run<T>(id: string, fn: (engine: DomainEngine) => T): T {
      const engine = engines.get(id);
      if (!engine) throw new Error(`Engine "${id}" is not registered.`);
      return ledgerScope.run(engine.ledgerCatalog, () => fn(engine));
    },
  };
}

export type EngineRegistry = ReturnType<typeof createEngineRegistry>;
