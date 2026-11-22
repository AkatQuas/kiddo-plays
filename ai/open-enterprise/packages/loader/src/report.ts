import path from "node:path";
import { isDefinedReport, type ReportDeclaration } from "@open-erp/metamodel";
import type { Catalog, LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importExports } from "./filesystem.js";

export async function loadReport(
  domainsRoot: string,
  modules: ReadonlyMap<string, LoadedModule>,
  ledgers?: ReadonlyMap<string, unknown>,
): Promise<ReportDeclaration | null> {
  const source = ["report.ts", "report.js"]
    .map((name) => path.join(domainsRoot, "report", name))
    .find((file) => exists(file));
  if (source === undefined) return null;

  const loaded = await importExports(source);
  const relative = path.relative(domainsRoot, source);
  const raw = loaded["report"];
  if (raw === undefined) {
    fail(`${relative} has no named export report — it must be \`export const report = defineReport({...})\``);
  }
  if (!isDefinedReport(raw)) {
    fail(`${relative} named report must be the return value of defineReport({...})`);
  }
  const unknown = Object.keys(loaded).filter((key) => key !== "report" && key !== "default");
  if (unknown.length) {
    fail(`${relative} has unknown named exports "${unknown.join(", ")}" — only report is allowed`);
  }
  if (!modules.has(raw.snapshotModule)) {
    fail(`${relative}: snapshotModule "${raw.snapshotModule}" is not in the module table`);
  }
  for (const code of raw.sourceModules) {
    if (!modules.has(code)) fail(`${relative}: sourceModules "${code}" is not in the module table`);
  }
  if (ledgers) {
    for (const domain of raw.narrativeDomains) {
      if (ledgers.has(domain.key)) {
        fail(`${relative}: narrativeDomains.key "${domain.key}" collides with a ledger code`);
      }
    }
  }
  return raw;
}

export function requireDailyReportSnapshotModule(catalog: Catalog): string {
  const report = catalog.report;
  if (report === null || report === undefined) {
    throw new Error("Daily-report snapshot module is not registered: domains/report must export const report = defineReport({ snapshotModule })");
  }
  if (!catalog.modules.has(report.snapshotModule)) {
    throw new Error(`Daily-report snapshot module "${report.snapshotModule}" is not in the module table`);
  }
  return report.snapshotModule;
}

export function requireDailyReportSourceModules(catalog: Catalog): readonly string[] {
  const report = catalog.report;
  if (report === null || report === undefined || report.sourceModules.length === 0) {
    throw new Error("Daily-report source modules are not registered: domains/report needs defineReport({ sourceModules })");
  }
  return report.sourceModules;
}

export function dailyReportAssembleCopy(catalog: Catalog): NonNullable<Catalog["report"]>["assembleCopy"] {
  const report = catalog.report;
  if (report === null || report === undefined) {
    throw new Error("Daily-report copy is not registered: domains/report needs defineReport({ assembleCopy })");
  }
  return report.assembleCopy;
}

export function dailyReportNarrativeDomainKeys(catalog: Catalog): readonly string[] {
  const report = catalog.report;
  if (report === null || report === undefined || report.narrativeDomains.length === 0) {
    throw new Error("Daily-report narrative domains are not registered: domains/report needs defineReport({ narrativeDomains })");
  }
  return report.narrativeDomains.map((domain) => domain.key);
}

export function assertDashboardSnapshotSources(
  dashboards: Catalog["dashboards"],
  report: ReportDeclaration | null,
): void {
  for (const dashboard of dashboards.values()) {
    for (const card of dashboard.cards) {
      if (card.measure.type !== "snapshot") continue;
      const source = card.measure.source;
      if (report === null) {
        fail(`Dashboard "${dashboard.code}" card "${card.key}" uses snapshot.source "${source}", but defineReport is not registered`);
      }
      if (source !== report.snapshotModule && source !== report.snapshotRole) {
        fail(
          `Dashboard "${dashboard.code}" card "${card.key}" snapshot.source "${source}" ` +
            `must be the registered snapshot module "${report.snapshotModule}" or role "${report.snapshotRole}"`,
        );
      }
    }
  }
}
