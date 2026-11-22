// ---------------------------------------------------------------------------
// Module loader — turn domains/ into in-memory module, skill, and agent catalogs
//
// The package root only owns assembly order. Discovery, normalization, and
// validation of each kind of disk input live in their own files.
// ---------------------------------------------------------------------------

import path from "node:path";
import type { DomainSchema } from "@open-erp/metamodel";
import {
  assertAgentSkillsKnown,
  listAgentFiles,
  loadAgent,
  type LoadedAgent,
} from "./agent.js";
import type { Catalog, LoadedChoiceSet, LoadedModule, LoadedModuleSetting, LoadOptions } from "./catalog.js";
import { listDomainDirectories, loadDomain } from "./domain.js";
import { loadAuthorizationFragment, normalizeProductAuthorization } from "./authorization.js";
import { fail } from "./errors.js";
import { exists, isDirectory } from "./filesystem.js";
import {
  resolveModuleOrigins,
  scanDomainModules,
  type PlannerOrigin,
} from "./module.js";
import {
  listSkillFiles,
  loadSkill,
  type LoadedSkill,
} from "./skill.js";
import { loadQuickAskGeneric, loadQuickAsks } from "./quickAsk.js";
import { loadInsights } from "./insight.js";
import { assertDashboardSnapshotSources, loadReport } from "./report.js";
import { activateLedgerCatalog, assertLedgerCatalogAgainstModules, loadLedgers } from "./ledger.js";
import {
  assertSurfaceReads,
  loadDomainSurfaces,
  mergeSurfaces,
  type LoadedSurface,
} from "./surface.js";
import { loadDomainNotifications, mergeNotificationPresets } from "./notification.js";
import {
  listFlowDomains, listFlowFiles, loadComposites, loadFlow, validateLoadedFlows,
  type LoadedFlow,
} from "./flow.js";
import { loadNavigation, requireNavigationFile } from "./navigation.js";

export { LoadError } from "./errors.js";
export type { Catalog, LoadedChoiceSet, LoadedModule, LoadedModuleSetting, LoadOptions } from "./catalog.js";
export type { ProductAuthorization } from "./authorization.js";
export type {
  LoadedSkill,
  ParsedSkill,
  ParseSkillOptions,
  SkillReference,
} from "./skill.js";
export { parseSkillDocument } from "./skill.js";
export type { LoadedAgent } from "./agent.js";
export type { LoadedFlow } from "./flow.js";
export { listFlowDomains } from "./flow.js";
export type { LoadedComposite } from "./flow.js";
export { requireModule } from "./module.js";
export type { LoadedSurface } from "./surface.js";
export type { LoadedNotificationPreset } from "./notification.js";
export type { LoadedInsight } from "./insight.js";
export { CROSS_CUTTING_DOMAIN_DIRS } from "./insight.js";
export {
  requireDailyReportSnapshotModule,
  requireDailyReportSourceModules,
  dailyReportAssembleCopy,
} from "./report.js";
export type { LoadedLedger, LoadedLedgerCatalog } from "./ledger.js";
export { domainsRoot } from "./domainsRoot.js";
export type { QuickAskLoadInput } from "./quickAsk.js";
export type { CreatePathError, CrossRefError } from "./cross-validation.js";
export { checkCreatePaths, checkCrossReferences } from "./cross-validation.js";

/**
 * Load from a product root (`domains/` plus the sibling `quick-asks/`).
 * Fixture roots and the domain-switch gate use this entry, and leave the existing `loadCatalog` defaults alone.
 */
export async function loadCatalogFromRoot(
  catalogRoot: string,
  extra?: Pick<LoadOptions, "insightScenarios">,
): Promise<Catalog> {
  const navigationFile = path.join(catalogRoot, "navigation.ts");
  requireNavigationFile(navigationFile);
  return loadCatalog({
    domainsRoot: path.join(catalogRoot, "domains"),
    quickAsksRoot: path.join(catalogRoot, "quick-asks"),
    flowsRoot: path.join(catalogRoot, "flows"),
    navigationFile,
    ...(extra?.insightScenarios ? { insightScenarios: extra.insightScenarios } : {}),
  });
}

/**
 * Assemble the full catalog in a fixed order:
 * ledger catalog → domain → module → skill → agent; global references and create-path resolution run only after every domain has been scanned.
 */
export async function loadCatalog(options: LoadOptions): Promise<Catalog> {
  const { domainsRoot } = options;
  if (!isDirectory(domainsRoot)) fail(`domains root does not exist: ${domainsRoot}`);

  const loadedLedgers = await loadLedgers(domainsRoot);
  activateLedgerCatalog(loadedLedgers);

  const modules = new Map<string, LoadedModule>();
  const plannerOrigins: PlannerOrigin[] = [];
  const domains: DomainSchema[] = [];
  const choiceSets: LoadedChoiceSet[] = [];
  const choiceSetOwners = new Map<string, string>();
  const moduleSettings: LoadedModuleSetting[] = [];
  const moduleSettingOwners = new Map<string, string>();
  const skills = new Map<string, LoadedSkill>();
  const agents = new Map<string, LoadedAgent>();
  const flows = new Map<string, LoadedFlow>();
  const authorizationFragments: Awaited<ReturnType<typeof loadAuthorizationFragment>>[] = [];
  const dashboards = new Map<string, import("@open-erp/metamodel").DashboardSchema>();
  const dashboardOwners = new Map<string, string>();
  const collectedSurfaces: LoadedSurface[] = [];
  const collectedNotifications: (readonly import("./notification.js").LoadedNotificationPreset[])[] = [];

  for (const domain of listDomainDirectories(domainsRoot)) {
    const loadedDomain = await loadDomain(domainsRoot, domain);
    if (loadedDomain === null) continue;

    domains.push(loadedDomain.schema);
    for (const surface of loadedDomain.schema.dashboards) {
      const previous = dashboardOwners.get(surface.code);
      if (previous) {
        fail(
          `Dashboard "${surface.code}" is declared twice: domain "${previous}" and domain "${loadedDomain.code}" — ` +
            `a surface code is globally unique across the whole product`,
        );
      }
      dashboardOwners.set(surface.code, loadedDomain.code);
      dashboards.set(surface.code, surface);
    }
    for (const choiceSet of loadedDomain.schema.choiceSets) {
      const previous = choiceSetOwners.get(choiceSet.code);
      if (previous) {
        fail(
          `${loadedDomain.code}/domain.ts: choiceSet "${choiceSet.code}" is already declared by domain "${previous}" — ` +
            `a dictionary code is globally unique across the whole product; a shared field must reference that one declaration, not copy it`,
        );
      }
      choiceSetOwners.set(choiceSet.code, loadedDomain.code);
      choiceSets.push({ ...choiceSet, domain: loadedDomain.code });
    }
    for (const setting of loadedDomain.schema.moduleSettings) {
      const previous = moduleSettingOwners.get(setting.code);
      if (previous) {
        fail(
          `${loadedDomain.code}/domain.ts: moduleSetting "${setting.code}" is already declared by domain "${previous}" — ` +
            `a setting code is globally unique across the whole product and must not be copied`,
        );
      }
      moduleSettingOwners.set(setting.code, loadedDomain.code);
      moduleSettings.push({ ...setting, domain: loadedDomain.code });
    }
    authorizationFragments.push(await loadAuthorizationFragment(loadedDomain.directory, loadedDomain.code));
    await scanDomainModules(
      loadedDomain.code,
      loadedDomain.directory,
      domainsRoot,
      loadedDomain.schema,
      modules,
      plannerOrigins,
      collectedSurfaces,
    );
    collectedSurfaces.push(
      ...(await loadDomainSurfaces(loadedDomain.directory, loadedDomain.code, domainsRoot)),
    );
    collectedNotifications.push(
      await loadDomainNotifications(loadedDomain.directory, loadedDomain.code, domainsRoot),
    );

    for (const file of listSkillFiles(path.join(loadedDomain.directory, "skills"), domain)) {
      loadSkill(file, domain, domainsRoot, skills);
    }
    for (const file of listAgentFiles(path.join(loadedDomain.directory, "agents"), domain)) {
      loadAgent(file, domain, domainsRoot, agents);
    }
  }

  if (!modules.size) fail(`no modules found under ${domainsRoot}`);

  // Flows are scanned only after every domain is loaded: directory names are
  // checked against domains that have already been declared, and that list is
  // complete only when this pass finishes.
  // Load without validating — one flow often spans several domains (a sales
  // order becoming a production order looks at both salesOrder and
  // productionOrder). Validating while scanning would treat the production
  // domain as missing when the sales domain is reached.
  const flowsRoot = options.flowsRoot ?? path.join(path.dirname(domainsRoot), "flows");
  const declaredDomains = new Set(domains.map((one) => one.code));
  for (const domain of listFlowDomains(flowsRoot, declaredDomains)) {
    for (const file of listFlowFiles(path.join(flowsRoot, domain), domain)) {
      await loadFlow(file, domain, flowsRoot, flows);
    }
  }
  // Composites reference flows, so they load after every flow is in.
  const composites = await loadComposites(flowsRoot, flows);

  assertAgentSkillsKnown(agents, skills);
  const resolvedModules = resolveModuleOrigins(modules, plannerOrigins);
  const surfaces = mergeSurfaces(collectedSurfaces);
  const notificationPresets = mergeNotificationPresets(collectedNotifications);
  assertSurfaceReads(surfaces, resolvedModules, choiceSets);
  for (const setting of moduleSettings) {
    if (!resolvedModules.has(setting.module)) {
      fail(
        `${setting.domain}/domain.ts: moduleSetting "${setting.code}" points at a module that does not exist, "${setting.module}" — ` +
          `a module setting must belong to a real business module and cannot create an empty configuration container`,
      );
    }
    if (setting.changeGuard !== null && !resolvedModules.has(setting.changeGuard.module)) {
      fail(
        `${setting.domain}/domain.ts: moduleSetting "${setting.code}" changeGuard points at a module that does not exist, ` +
          `"${setting.changeGuard.module}"`,
      );
    }
  }
  const authorization = normalizeProductAuthorization(
    authorizationFragments.filter((fragment): fragment is NonNullable<typeof fragment> => fragment !== null),
    resolvedModules,
  );

  // Cross-module flow checks live here: they need the complete module table
  // (one flow often spans several domains) plus the role catalog (the responsible
  // role is a code, and a typo must name the values that are allowed).
  // `fatal` throws at this step; `gap` is written back onto each flow, which the UI shows as "to be filled in".
  validateLoadedFlows(flows, {
    modules: resolvedModules,
    roles: new Set(authorization.roles.map((role) => role.code)),
  });

  // Quick asks are assembled in the same pass as domains, but their root is the
  // repo-root `quick-asks/` (maintained by product, deliberately kept out of
  // domains — that tree is the developers' ground; see quick-asks/AGENTS.md).
  const quickAsksRoot = options.quickAsksRoot ?? path.join(path.dirname(domainsRoot), "quick-asks");
  const quickAsks = loadQuickAsks({
    root: quickAsksRoot,
    modules: resolvedModules,
    skillNames: new Set(skills.keys()),
    // The scenario enum lives in the server layer (`agent/insight.ts`), and the
    // loader cannot depend on it — the dependency direction is server → loader,
    // and the reverse would be a cycle. When the set is provided, validate it.
    // When it is not, skip this check instead of pretending it ran.
    insightScenarios: options.insightScenarios ?? new Set(),
  });
  const quickAskGeneric = loadQuickAskGeneric(quickAsksRoot);
  const insights = await loadInsights(domainsRoot, resolvedModules, loadedLedgers?.ledgers);
  const report = await loadReport(domainsRoot, resolvedModules, loadedLedgers?.ledgers);
  assertDashboardSnapshotSources(dashboards, report);
  if (loadedLedgers) {
    assertLedgerCatalogAgainstModules(loadedLedgers, resolvedModules);
  }

  const siblingNav = path.join(path.dirname(domainsRoot), "navigation.ts");
  const nestedNav = path.join(domainsRoot, "navigation.ts");
  const navigationFile = options.navigationFile ?? (exists(siblingNav) ? siblingNav : nestedNav);
  requireNavigationFile(navigationFile);
  const navigation = await loadNavigation(navigationFile, resolvedModules, surfaces);
  if (navigation === null) {
    fail(`navigation declaration not found at ${navigationFile} — business-facing groups exist only in this one file`);
  }

  return {
    modules: resolvedModules,
    choiceSets,
    moduleSettings,
    domains,
    skills: [...skills.values()],
    agents: [...agents.values()],
    authorization,
    dashboards,
    surfaces,
    notificationPresets,
    insights,
    report,
    ledgers: loadedLedgers?.ledgers ?? new Map(),
    ledgerBooks: loadedLedgers?.books ?? [],
    quickAsks,
    quickAskGeneric,
    flows: [...flows.values()],
    composites,
    navigation,
  };
}

import { bindCatalogLoader } from "./engines.js";

bindCatalogLoader(loadCatalog);

export {
  createEngineRegistry,
  describeEngine,
  type DomainEngine,
  type EngineRegistration,
  type EngineRegistry,
} from "./engines.js";
