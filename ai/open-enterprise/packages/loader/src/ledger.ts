import { readdirSync } from "node:fs";
import path from "node:path";
import {
  installLedgerCatalog,
  isDefinedLedgers,
  type LedgerCatalog,
  type LedgerDefinition,
} from "@open-erp/metamodel";
import type { LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importExports, isDirectory } from "./filesystem.js";

export interface LoadedLedger extends LedgerDefinition {
  /** Path relative to domains/. */
  readonly file: string;
}

export interface LoadedLedgerCatalog {
  readonly file: string;
  readonly books: readonly string[];
  readonly ledgers: ReadonlyMap<string, LoadedLedger>;
  readonly catalog: LedgerCatalog;
}

const LEDGER_SOURCE_NAMES = new Set(["ledgers.ts", "ledgers.js"]);

/**
 * `domains/ledgers/`: a cross-domain directory, registered when the file exists. Same precedent as insights; it is not on the business-domain list.
 * The named export must be `export const ledgers = defineLedgers({...})`.
 * The source whitelist is only `ledgers.ts` / `ledgers.js` — one extra .ts/.js is rejected.
 */
export async function loadLedgers(domainsRoot: string): Promise<LoadedLedgerCatalog | null> {
  const directory = path.join(domainsRoot, "ledgers");
  if (!isDirectory(directory)) return null;

  const names = readdirSync(directory).filter((name) => !name.startsWith("."));
  for (const name of names) {
    if (name === "dist" || name === "node_modules") continue;
    if ((name.endsWith(".ts") || name.endsWith(".js")) && !LEDGER_SOURCE_NAMES.has(name)) {
      fail(
        `ledgers/ "${name}" is not on the load whitelist — a cross-domain directory allows only ledgers.ts (or the build output ledgers.js)`,
      );
    }
  }

  const source = ["ledgers.ts", "ledgers.js"].map((name) => path.join(directory, name)).find((file) => exists(file));
  if (!source) {
    fail("ledgers/ exists but has no ledgers.ts — a cross-domain directory is not an empty shell; do not create the directory without a declaration");
  }

  const loaded = await importExports(source);
  const relative = path.relative(domainsRoot, source);
  const raw = loaded["ledgers"];
  if (raw === undefined) {
    fail(`${relative} has no named export ledgers — it must be \`export const ledgers = defineLedgers({...})\``);
  }
  if (!isDefinedLedgers(raw)) {
    fail(`${relative} named ledgers must be the return value of defineLedgers({...})`);
  }
  const unknown = Object.keys(loaded).filter((key) => key !== "ledgers" && key !== "default");
  if (unknown.length) {
    fail(`${relative} has unknown named exports "${unknown.join(", ")}" — only ledgers is allowed`);
  }

  const out = new Map<string, LoadedLedger>();
  for (const [code, definition] of Object.entries(raw.ledgers)) {
    out.set(code, { ...definition, file: relative });
  }
  return { file: relative, books: raw.books, ledgers: out, catalog: raw };
}

/**
 * An entity the catalog references must be a loaded module; a module effect's target / op must land in the catalog.
 * A real subject ref and the scope arity are judged by normalizeEffect / validate against this same catalog.
 */
export function assertLedgerCatalogAgainstModules(
  loaded: LoadedLedgerCatalog,
  modules: ReadonlyMap<string, LoadedModule>,
): void {
  for (const ledger of loaded.ledgers.values()) {
    const at = `${loaded.file} ledgers.ledgers.${ledger.code}`;
    if (!modules.has(ledger.subject)) {
      fail(`${at}.subject points at an unknown module "${ledger.subject}"`);
    }
    if (ledger.scope !== null && !modules.has(ledger.scope)) {
      fail(`${at}.scope points at an unknown module "${ledger.scope}"`);
    }
  }
  for (const mod of modules.values()) {
    for (const transition of mod.schema.lifecycle.transitions) {
      transition.effects.forEach((effect, index) => {
        const at = `${mod.file} lifecycle.transitions.${transition.code}.effects[${String(index)}]`;
        const ledger = loaded.ledgers.get(effect.target);
        if (ledger === undefined) {
          fail(
            `${at}.target "${effect.target}" is not in the ledger catalog — allowed: ${[...loaded.ledgers.keys()].join(" / ")}`,
          );
        }
        if (ledger.ops[effect.op] === undefined) {
          fail(
            `${at}: the ${effect.target} ledger does not accept op "${effect.op}". Allowed: ${Object.keys(ledger.ops).join(" / ")}`,
          );
        }
        const expectedScope = ledger.scope !== null;
        const declaredScope = effect.scope !== null;
        if (expectedScope !== declaredScope) {
          fail(
            `${at}.scope arity does not match ledger catalog "${ledger.code}"` +
              ` (catalog scope=${ledger.scope === null ? "none" : ledger.scope})`,
          );
        }
      });
    }
  }
}

/** Install the catalog on the kernel query port. With no catalog, install an empty table (not null) — fixtures unload the product ledgers, but listLedgerCodes can still be asked. */
export function activateLedgerCatalog(loaded: LoadedLedgerCatalog | null): void {
  installLedgerCatalog(loaded?.catalog ?? { books: [], ledgers: {} });
}
