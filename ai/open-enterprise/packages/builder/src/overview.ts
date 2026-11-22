// ---------------------------------------------------------------------------
// System overview — the fact layer of the repo-level `yarn catalog` listing
//
// Answers what a coding agent must know on entering the repo: where facts live, how a bill is created, who it depends on, and which ledger it affects.
// The result stays an index on purpose. Fields, gates, and the full lifecycle are drilled into per module by `catalog --module`.
//
// This layer only decides how to derive. Output trimming (drop empty values, drop keys that can be read verbatim from source) lives entirely in
// `catalog.ts`. Once those two jobs are mixed, "can this fact be derived" and "should this fact be emitted" can no longer be told apart.
// ---------------------------------------------------------------------------

import { requireModule, type Catalog } from "@open-erp/loader";
import {
  isModuleRoleGrant,
  listLedgerCodes,
  relationsOf,
  sourceBindingsOf,
  transitionAction,
  transitionEdges,
  type EffectTarget,
  type SourceBinding,
} from "@open-erp/metamodel";

export const SYSTEM_OVERVIEW_WIRE_VERSION = 1 as const;

export interface OverviewModule {
  readonly module: string;
  readonly label: string;
  readonly domain: string;
  readonly file: string;
  readonly kind: "master" | "document";
  readonly escapeHatch: boolean;
  readonly statuses: readonly string[];
  readonly creation: {
    readonly manual: boolean;
    readonly generatedBy: readonly {
      readonly module: string;
      readonly transition: string;
      readonly action: string;
    }[];
  };
  readonly effects: readonly EffectTarget[];
  /** Deduped direct business-reference targets. Field-level edges are expanded only with --around. */
  readonly dependencies: readonly string[];
  readonly capabilities: readonly ("planner" | "batch" | "unitSet")[];
}

export interface OverviewDomain {
  readonly domain: string;
  readonly label: string;
  readonly kind: "business" | "support";
  readonly modules: readonly OverviewModule[];
}

export interface OverviewFlow {
  readonly id: string;
  readonly kind: "create-from" | "push" | "planner";
  readonly source: {
    readonly module: string;
    readonly level: "record" | "line";
    readonly table: string | null;
  };
  readonly target: { readonly kind: "module"; readonly module: string; readonly path: string | null } | {
    readonly kind: "dynamic";
  };
  readonly transition: string | null;
  readonly label: string;
  readonly sourceStatuses: readonly string[] | null;
  readonly remaining: boolean;
}

export interface OverviewBinding {
  readonly id: string;
  readonly kind: "select" | "lookup" | "snapshot" | "default" | "unit-choice";
  readonly source: { readonly module: string; readonly path: string | null };
  readonly target: { readonly module: string; readonly path: string };
  readonly selectable: boolean | null;
  readonly explain: string;
}

export interface SystemOverview {
  readonly kind: "system-overview";
  readonly wireVersion: typeof SYSTEM_OVERVIEW_WIRE_VERSION;
  readonly scope: { readonly domain: string | null; readonly around: string | null };
  readonly domains: readonly OverviewDomain[];
  /** A definite create-bill flow is expressed separately from a Planner whose target can be known only at runtime. */
  readonly flows: readonly OverviewFlow[];
  /** Empty by default. Field-level cross-record dependencies expand only with --around, so the repo-wide reference graph does not drown the business flow. */
  readonly bindings: readonly OverviewBinding[];
  readonly responsibility: {
    readonly roles: readonly {
      readonly code: string;
      readonly name: string;
      readonly description: string;
      readonly domains: readonly string[];
      readonly modules: readonly string[];
      readonly scopePolicies: readonly string[];
    }[];
    readonly agents: readonly {
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly domain: string;
      readonly file: string;
      readonly roles: readonly string[];
      readonly skills: readonly string[];
    }[];
    readonly skills: readonly {
      readonly name: string;
      readonly description: string;
      readonly domain: string;
      readonly file: string;
      readonly version: string;
      readonly triggerWords: readonly string[];
    }[];
    readonly scopes: readonly {
      readonly orgTreeModule: string;
      readonly targetModules: readonly string[];
    }[];
  };
}

export interface OverviewOptions {
  readonly domain?: string | null;
  readonly around?: string | null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function endpoints(binding: SourceBinding): readonly [string, string] {
  switch (binding.kind) {
    case "field-select":
      return [binding.source.module, binding.target.module];
    case "field-value":
      return [binding.source.coordinate.module, binding.target.module];
    case "unit-choice":
      return [binding.source.module, binding.target.module];
    case "creation":
      return [binding.source.module, binding.target.module];
    case "planner-execution":
      return [binding.source.module, binding.source.module];
  }
}

function overviewBinding(binding: SourceBinding): OverviewBinding | null {
  switch (binding.kind) {
    case "field-select":
      return {
        id: binding.id,
        kind: "select",
        source: { module: binding.source.module, path: binding.source.table },
        target: { module: binding.target.module, path: binding.target.path },
        selectable: binding.selectable,
        explain: binding.explain,
      };
    case "field-value":
      return {
        id: binding.id,
        kind: binding.mechanism === "refDefault" ? "default" : binding.mechanism,
        source: { module: binding.source.coordinate.module, path: binding.source.coordinate.path },
        target: { module: binding.target.module, path: binding.target.path },
        selectable: null,
        explain: binding.explain,
      };
    case "unit-choice":
      return {
        id: binding.id,
        kind: "unit-choice",
        source: { module: binding.source.module, path: null },
        target: { module: binding.target.module, path: binding.target.path },
        selectable: null,
        explain: binding.explain,
      };
    case "creation":
    case "planner-execution":
      return null;
  }
}

/** Pure projection: consume only the Catalog the loader has already assembled. Do not scan files or read a database. */
export function systemOverview(catalog: Catalog, options: OverviewOptions = {}): SystemOverview {
  const domain = options.domain ?? null;
  const around = options.around ?? null;
  if (domain !== null && around !== null) throw new Error("overview: --domain and --around cannot be used together");

  const domainSchema = domain === null ? null : catalog.domains.find((candidate) => candidate.code === domain);
  if (domain !== null && domainSchema === undefined) {
    throw new Error(`overview: unknown domain "${domain}"; available domains: ${catalog.domains.map((item) => item.code).join(", ")}`);
  }
  if (around !== null && !catalog.modules.has(around)) {
    throw new Error(`overview: unknown module "${around}"; run yarn --silent overview --json to see the module index`);
  }

  const schemas = [...catalog.modules.values()].map((loaded) => loaded.schema);
  const bindings = sourceBindingsOf(schemas);
  const selected = new Set<string>();
  if (around !== null) {
    selected.add(around);
    for (const binding of bindings) {
      const [source, target] = endpoints(binding);
      if (source === around) selected.add(target);
      if (target === around) selected.add(source);
    }
  } else {
    for (const loaded of catalog.modules.values()) {
      if (domain === null || loaded.domain === domain) selected.add(loaded.code);
    }
  }

  const moduleDomain = new Map([...catalog.modules.values()].map((loaded) => [loaded.code, loaded.domain]));
  const cards = new Map<string, OverviewModule>();
  for (const loaded of catalog.modules.values()) {
    if (!selected.has(loaded.code)) continue;
    const schema = loaded.schema;
    if (schema.creatable.pushedFrom === null) {
      throw new Error(`overview: creation paths for module "${schema.code}" have not been assembled by the full catalog`);
    }
    const effects = new Set<EffectTarget>();
    for (const transition of schema.lifecycle.transitions) {
      for (const effect of transition.effects) effects.add(effect.target);
    }
    const dependencies = unique(relationsOf(schemas, schema.code).outbound.map((relation) => relation.to));
    const capabilities: ("planner" | "batch" | "unitSet")[] = [];
    if (loaded.planners.size > 0) capabilities.push("planner");
    if (Object.keys(loaded.batchActions).length > 0) capabilities.push("batch");
    if (schema.unitSet !== null) capabilities.push("unitSet");
    cards.set(schema.code, {
      module: schema.code,
      label: schema.label,
      domain: loaded.domain,
      file: loaded.file,
      kind: schema.lifecycle.statuses.length === 1 ? "master" : "document",
      escapeHatch: loaded.escapeHatch,
      statuses: schema.lifecycle.statuses.map((status) => status.key),
      creation: {
        manual: schema.creatable.manual,
        generatedBy: schema.creatable.pushedFrom.map((origin) => ({
          module: origin.module,
          transition: origin.transition,
          action: origin.action,
        })),
      },
      effects: listLedgerCodes().filter((target) => effects.has(target)),
      dependencies,
      capabilities,
    });
  }

  const domains = catalog.domains.flatMap((item): readonly OverviewDomain[] => {
    if (domain !== null && item.code !== domain) return [];
    const modules = [...catalog.modules.values()].flatMap((loaded) => {
      const card = cards.get(loaded.code);
      return loaded.domain === item.code && card !== undefined ? [card] : [];
    });
    if (around !== null && modules.length === 0) return [];
    return [{ domain: item.code, label: item.label, kind: item.modules ? "business" : "support", modules }];
  });

  const flows = bindings.flatMap((binding): readonly OverviewFlow[] => {
    const [source, target] = endpoints(binding);
    // --around is a one-hop focus, not "take the neighbors, then also expand each neighbor's own flow".
    // The latter mixes in a second hop such as product -> supplierQuote that has nothing to do with the focus, and an agent will treat it as part of the current loop.
    if (around !== null ? source !== around && target !== around : !selected.has(source) && !selected.has(target)) {
      return [];
    }
    if (binding.kind === "creation") {
      return [{
        id: binding.id,
        kind: binding.mechanism,
        source: binding.source,
        target: { kind: "module", module: binding.target.module, path: binding.target.path },
        transition: binding.transition?.code ?? null,
        label: binding.label,
        sourceStatuses: binding.sourceStatuses,
        remaining: binding.sourceRemaining !== null,
      }];
    }
    if (binding.kind === "planner-execution") {
      const schema = requireModule(catalog, binding.transition.module).schema;
      const action = transitionAction(schema.lifecycle, binding.transition.code);
      if (action === null) {
        throw new Error(`overview: Planner source ${binding.transition.module}.${binding.transition.code} is not an action on the module`);
      }
      return [{
        id: binding.id,
        kind: "planner",
        source: binding.source,
        target: { kind: "dynamic" },
        transition: action.code,
        label: action.action,
        // A Planner is bound to an action: every status that can fire the action is a source status, the from-side of all of its edges.
        sourceStatuses: transitionEdges(schema, action.code).map((edge) => edge.from),
        remaining: false,
      }];
    }
    return [];
  });

  const focusedBindings = around === null
    ? []
    : bindings.flatMap((binding): readonly OverviewBinding[] => {
        const [source, target] = endpoints(binding);
        if (source !== around && target !== around) return [];
        const projected = overviewBinding(binding);
        return projected === null ? [] : [projected];
      });

  const roleCards = catalog.authorization.roles.map((role) => {
    const allModules = unique(role.grants.flatMap((grant) => "module" in grant ? [grant.module] : []));
    // A focused result lists only the authorization coordinates for this slice. Full role grants still live in authorization.ts.
    // Stuffing one role's product-wide module list into a six-module neighborhood both spends context and overstates the boundary.
    const modules = domain === null && around === null ? allModules : allModules.filter((module) => selected.has(module));
    return {
      code: role.code,
      name: role.name,
      description: role.description,
      domains: unique(modules.flatMap((module) => {
        const owner = moduleDomain.get(module);
        return owner === undefined ? [] : [owner];
      })),
      modules,
      scopePolicies: unique(role.grants.flatMap((grant) =>
        isModuleRoleGrant(grant) && grant.scope !== null ? grant.scope.flat().map((condition) => condition.op) : [])),
    };
  }).filter((role) => domain === null && around === null || role.modules.length > 0);
  const selectedRoleCodes = new Set(roleCards.map((role) => role.code));

  const agents = catalog.agents.filter((agent) => {
    if (domain === null && around === null) return true;
    if (domain !== null) return agent.domain === domain;
    return agent.roles.includes("*") || agent.roles.some((role) => selectedRoleCodes.has(role));
  }).map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    domain: agent.domain,
    file: agent.file,
    roles: agent.roles,
    skills: agent.skillNames,
  }));
  const selectedSkillNames = new Set(agents.flatMap((agent) => agent.skills));
  const skills = catalog.skills.filter((skill) => {
    if (domain === null && around === null) return true;
    if (domain !== null) return skill.domain === domain;
    return selectedSkillNames.has(skill.name);
  }).map((skill) => ({
    name: skill.name,
    description: skill.description,
    domain: skill.domain,
    file: skill.file,
    version: skill.wireVersion,
    triggerWords: skill.triggerWords,
  }));

  const tree = catalog.authorization.orgTree;
  const scopes = tree === null ? [] : [{
    orgTreeModule: tree.module,
    targetModules: unique(catalog.authorization.scopeTargets.map((target) => target.module)),
  }].filter((scope) => {
    if (domain === null && around === null) return true;
    return selected.has(scope.orgTreeModule) ||
      scope.targetModules.some((module) => selected.has(module));
  });

  return {
    kind: "system-overview",
    wireVersion: SYSTEM_OVERVIEW_WIRE_VERSION,
    scope: { domain, around },
    domains,
    flows,
    bindings: focusedBindings,
    responsibility: { roles: roleCards, agents, skills, scopes },
  };
}
