import { readdirSync } from "node:fs";
import path from "node:path";
import {
  isDefinedInsights,
  isInsightSqlCell,
  type InsightDefinition,
} from "@open-erp/metamodel";
import type { LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importExports, isDirectory } from "./filesystem.js";

export interface LoadedInsight extends InsightDefinition {
  readonly code: string;
  readonly file: string;
}

export const CROSS_CUTTING_DOMAIN_DIRS: ReadonlySet<string> = new Set(["insights", "ledgers"]);

const INSIGHT_SOURCE_NAMES = new Set(["insights.ts", "insights.js"]);
const DOMAIN_INSIGHT_FILES = ["dailyReportCells.ts", "dailyReportCells.js"] as const;

function toLoaded(
  insights: Readonly<Record<string, InsightDefinition>>,
  file: string,
): LoadedInsight[] {
  return Object.entries(insights).map(([code, definition]) => ({ ...definition, code, file }));
}

function mergeLoaded(
  out: Map<string, LoadedInsight>,
  insights: Readonly<Record<string, InsightDefinition>>,
  file: string,
): void {
  for (const insight of toLoaded(insights, file)) {
    const previous = out.get(insight.code);
    if (previous) {
      fail(`Insight "${insight.code}" is declared twice: ${previous.file} and ${insight.file}`);
    }
    out.set(insight.code, insight);
  }
}

async function readDefinedInsights(source: string, domainsRoot: string): Promise<Readonly<Record<string, InsightDefinition>>> {
  const loaded = await importExports(source);
  const relative = path.relative(domainsRoot, source);
  const raw = loaded["insights"];
  if (raw === undefined) {
    fail(`${relative} has no named export insights — it must be \`export const insights = defineInsights({...})\``);
  }
  if (!isDefinedInsights(raw)) {
    fail(`${relative} named insights must be the return value of defineInsights({...})`);
  }
  const unknown = Object.keys(loaded).filter((key) => key !== "insights" && key !== "default");
  if (unknown.length) {
    fail(`${relative} has unknown named exports "${unknown.join(", ")}" — only insights is allowed`);
  }
  return raw;
}

async function loadCrossCuttingInsights(domainsRoot: string, out: Map<string, LoadedInsight>): Promise<void> {
  const directory = path.join(domainsRoot, "insights");
  if (!isDirectory(directory)) return;

  const names = readdirSync(directory).filter((name) => !name.startsWith("."));
  for (const name of names) {
    if (name === "dist" || name === "node_modules") continue;
    if ((name.endsWith(".ts") || name.endsWith(".js")) && !INSIGHT_SOURCE_NAMES.has(name)) {
      fail(
        `insights/ "${name}" is not on the load whitelist — a cross-domain directory allows only insights.ts (or the build output insights.js)`,
      );
    }
  }

  const source = ["insights.ts", "insights.js"].map((name) => path.join(directory, name)).find((file) => exists(file));
  if (!source) {
    fail("insights/ exists but has no insights.ts — a cross-domain directory is not an empty shell; do not create the directory without a declaration");
  }
  mergeLoaded(out, await readDefinedInsights(source, domainsRoot), path.relative(domainsRoot, source));
}

async function loadDomainInsightFiles(domainsRoot: string, out: Map<string, LoadedInsight>): Promise<void> {
  for (const name of readdirSync(domainsRoot).filter((entry) => !entry.startsWith("."))) {
    if (CROSS_CUTTING_DOMAIN_DIRS.has(name)) continue;
    const directory = path.join(domainsRoot, name);
    if (!isDirectory(directory)) continue;
    const dist = path.join(directory, "dist/dailyReportCells.js");
    const source = exists(dist)
      ? dist
      : DOMAIN_INSIGHT_FILES.map((file) => path.join(directory, file)).find((file) => exists(file));
    if (source === undefined) continue;
    mergeLoaded(out, await readDefinedInsights(source, domainsRoot), path.relative(domainsRoot, source));
  }
}

export async function loadInsights(
  domainsRoot: string,
  modules: ReadonlyMap<string, LoadedModule>,
  ledgers?: ReadonlyMap<string, unknown>,
): Promise<ReadonlyMap<string, LoadedInsight>> {
  const out = new Map<string, LoadedInsight>();
  await loadCrossCuttingInsights(domainsRoot, out);
  await loadDomainInsightFiles(domainsRoot, out);
  assertInsightReads(out, modules, ledgers);
  return out;
}

export function assertInsightReads(
  insights: ReadonlyMap<string, LoadedInsight>,
  modules: ReadonlyMap<string, LoadedModule>,
  ledgers?: ReadonlyMap<string, unknown>,
): void {
  const references = new Set<string>();
  for (const insight of insights.values()) {
    if (insight.semantics) for (const ref of [insight.semantics.packageRef, ...insight.semantics.terms.map(t => t.ref), ...insight.semantics.templates.map(t => t.ref)]) {
      if (references.has(ref)) fail(`semantic reference "${ref}" is duplicated; more than one definition cannot be chosen`);
      references.add(ref);
    }
    for (const template of insight.semantics?.templates || []) {
      const source = modules.get(template.module)?.schema;
      const entity = modules.get(template.entityModule)?.schema;
      if (!source || !entity) fail(`${insight.file} semantic template "${template.ref}" source module is not loaded`);
      const date = source.fields.find(f => f.key === template.dateField);
      const amount = source.fields.find(f => f.key === template.valueField);
      const link = source.fields.find(f => f.key === template.entityField);
      const name = entity.fields.find(f => f.key === template.entityNameField);
      if (date?.type !== "date" || !amount || !["number", "money", "percent"].includes(amount.type) || link?.type !== "ref" || link.ref !== template.entityModule || !name || !["string", "text"].includes(name.type)) fail(`${insight.file} semantic template "${template.ref}" fields, object relation, or grain do not hold`);
    }
    for (const [key, cell] of Object.entries(insight.cells)) {
      const at = `${insight.file} insights.${insight.code}.cells.${key}`;
      if (!isInsightSqlCell(cell)) {
        fail(`${at} must be a kind:"sql" cell`);
      }
      for (const module of cell.reads.modules) {
        if (!modules.has(module)) fail(`${at}.reads.modules points at an unknown module "${module}"`);
      }
      if (cell.link !== undefined && !modules.has(cell.link)) {
        fail(`${at}.link points at an unknown module "${cell.link}"`);
      }
      for (const [module, statuses] of Object.entries(cell.reads.statuses ?? {})) {
        const loaded = modules.get(module);
        if (!loaded) fail(`${at}.reads.statuses points at an unknown module "${module}"`);
        const declared = new Set(loaded.schema.lifecycle.statuses.map((status) => status.key));
        for (const status of statuses) {
          if (!declared.has(status)) {
            fail(`${at}.reads.statuses.${module} "${status}" is not among the module statuses (${[...declared].join(" / ")})`);
          }
        }
      }
      for (const ledger of cell.reads.ledgers ?? []) {
        if (ledgers !== undefined && !ledgers.has(ledger)) fail(`${at}.reads.ledgers points at an unknown ledger "${ledger}"`);
      }
    }
  }
}
