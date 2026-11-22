import path from "node:path";
import {
  bindPivotModules,
  isDefinedSurfaces,
  peekLedgerCatalog,
  unionSurfaceReads,
  type ModuleSchema,
  type ResolvedPivot,
  type SurfaceDefinition,
} from "@open-erp/metamodel";
import type { LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importExports, type ImportedExports } from "./filesystem.js";

export interface LoadedSurface extends SurfaceDefinition {
  readonly code: string;
  readonly domain: string;
  readonly file: string;
  readonly pivotResolved: ResolvedPivot | null;
}

function toLoaded(
  surfaces: Readonly<Record<string, SurfaceDefinition>>,
  domain: string,
  file: string,
): LoadedSurface[] {
  return Object.entries(surfaces).map(([code, definition]) => ({
    ...definition,
    code,
    domain,
    file,
    pivotResolved: null,
  }));
}

/**
 * Domain-level `surfaces.ts`: same shape as authorization.ts. If the file exists, it is registered.
 * The named export must be `export const surfaces = defineSurfaces({...})`.
 */
export async function loadDomainSurfaces(
  domainDirectory: string,
  domain: string,
  domainsRoot: string,
): Promise<readonly LoadedSurface[]> {
  const source = ["surfaces.ts", "surfaces.js"]
    .map((name) => path.join(domainDirectory, name))
    .find((file) => exists(file));
  if (!source) return [];
  const loaded = await importExports(source);
  const relative = path.relative(domainsRoot, source);
  const raw = loaded["surfaces"];
  if (raw === undefined) {
    fail(`${relative} has no named export surfaces — it must be \`export const surfaces = defineSurfaces({...})\``);
  }
  if (!isDefinedSurfaces(raw)) {
    fail(`${relative} named surfaces must be the return value of defineSurfaces({...})`);
  }
  const unknown = Object.keys(loaded).filter((key) => key !== "surfaces" && key !== "default");
  if (unknown.length) {
    fail(`${relative} has unknown named exports "${unknown.join(", ")}" — only surfaces is allowed`);
  }
  return toLoaded(raw, domain, relative);
}

export function loadModuleSurfaces(
  loaded: ImportedExports,
  directoryModule: boolean,
  domain: string,
  file: string,
): readonly LoadedSurface[] {
  const raw = loaded["surfaces"];
  if (raw === undefined) return [];
  if (!directoryModule) {
    fail(`${file} exports surfaces, but module-level surfaces are allowed only in a directory module at modules/<code>/index.ts`);
  }
  if (!isDefinedSurfaces(raw)) {
    fail(`${file} named surfaces must be the return value of defineSurfaces({...})`);
  }
  return toLoaded(raw, domain, file);
}

export function mergeSurfaces(items: readonly LoadedSurface[]): Map<string, LoadedSurface> {
  const out = new Map<string, LoadedSurface>();
  for (const surface of items) {
    const previous = out.get(surface.code);
    if (previous) {
      fail(
        `Surface "${surface.code}" is declared twice: ${previous.file} and ${surface.file} — ` +
          `a surface code is globally unique across the whole product`,
      );
    }
    out.set(surface.code, surface);
  }
  return out;
}

/**
 * Derived reads must point at real modules and the closed ledger set. The module table is complete only after the scan, so this runs at the end of assembly.
 */
export function assertSurfaceReads(
  surfaces: Map<string, LoadedSurface>,
  modules: ReadonlyMap<string, LoadedModule>,
  choiceSets: readonly { readonly code: string }[],
): void {
  const installed = peekLedgerCatalog();
  const ledgerSet = new Set<string>(installed ? Object.keys(installed.ledgers) : []);
  const knownChoiceSets = new Set(choiceSets.map((item) => item.code));
  const catalog: Record<string, ModuleSchema> = Object.fromEntries(
    [...modules].map(([code, loaded]) => [code, loaded.schema]),
  );
  for (const surface of [...surfaces.values()]) {
    let next = surface;
    if (surface.pivot !== null) {
      const pivotResolved = bindPivotModules(
        surface.pivot,
        catalog,
        `${surface.file} surfaces.${surface.code}.pivot`,
      );
      next = {
        ...surface,
        pivotResolved,
        reads: unionSurfaceReads(surface.reads, pivotResolved.reads),
      };
      surfaces.set(surface.code, next);
    }
    for (const module of next.reads.modules) {
      if (!modules.has(module)) {
        fail(`${surface.file} surfaces.${surface.code}.reads.modules points at an unknown module "${module}"`);
      }
    }
    for (const column of surface.columns) {
      if (column.type !== "choice") continue;
      if (column.choiceSet === null) {
        fail(`${surface.file} surfaces.${surface.code}.columns.${column.key}: type=choice must declare a choiceSet`);
      }
      if (!knownChoiceSets.has(column.choiceSet)) {
        fail(
          `${surface.file} surfaces.${surface.code}.columns.${column.key}.choiceSet points at an unknown dictionary "${column.choiceSet}"`,
        );
      }
    }
    for (const ledger of next.reads.ledgers) {
      if (!ledgerSet.has(ledger)) {
        fail(`${surface.file} surfaces.${surface.code}.reads.ledgers points at an unknown ledger "${ledger}"`);
      }
    }
  }
}
