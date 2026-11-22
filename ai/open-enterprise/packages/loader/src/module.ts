import { readdirSync } from "node:fs";
import path from "node:path";
import {
  defineModule,
  isDefinedActionPreparers,
  isDefinedBatchActions,
  isDefinedPlanners,
  isModuleDraft,
  normalizeExecutionPlan,
  plannerConsistencyOf,
  plannerCreateTargetsOf,
  SchemaError,
  sealModule,
  transitionAction,
  transitionAt,
  withPlannerExpansion,
  withPushOrigins,
  type DomainSchema,
  type ModuleIdentity,
  type ActionPreparer,
  type BatchActions,
  type ExecutionPlan,
  type ModulePlanner,
  type ModuleSchema,
} from "@open-erp/metamodel";
import type { Catalog, LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { loadModuleSurfaces, type LoadedSurface } from "./surface.js";
import {
  exists,
  importExports,
  isDirectory,
  requireDefault,
  type ImportedExports,
} from "./filesystem.js";

/**
 * Module file name = module code. There is no mapping table — a mapping table is a second source of truth, and it drifts on rename.
 * Directory name = domain name, for the same reason.
 */
function moduleCodeOf(file: string): string {
  return path.basename(file, ".ts").replace(/\.js$/, "");
}

export function listModuleFiles(modulesDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(modulesDir).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(modulesDir, entry);
    if (isDirectory(full)) {
      // A module is a file by default. When custom logic is needed it is promoted to a directory, and the entry is always index.
      const index = ["index.ts", "index.js"].map((n) => path.join(full, n)).find((p) => !isDirectory(p) && exists(p));
      if (!index) {
        fail(
          `module directory ${full} has no index.ts — a module is written as a single file by default (${entry}.ts); ` +
            `promote it to a directory only when the schema cannot express the custom logic, and then index.ts is required as the entry`,
        );
      }
      out.push(index);
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".js")) {
      if (entry.endsWith(".d.ts")) continue;
      out.push(full);
    }
  }
  return out;
}

/** Module code derived from the file path. The directory form (the escape hatch) uses the directory name; a plain file uses the file name. */
function moduleFileCode(file: string): string {
  return path.basename(path.dirname(file)) !== "modules" ? path.basename(path.dirname(file)) : moduleCodeOf(file);
}

/**
 * Seal this declaration: inject the identity derived from the path (file name = code, directory name = domain), then run the semantic gate.
 *
 * The rule "the export must be the return value of defineModule()" is enforced by a credential, not by guessing the shape.
 *
 * A credential means the shape gate (seventh-concept allow-list / closed keys) already ran at import time, so seal directly.
 * No credential means treat it as a raw object, run the shape gate in place, then seal.
 *
 * This used to check only `"code" in v && "lifecycle" in v` — a duck check of two keys.
 * A well-shaped bare object could therefore come in with `postsToLedger: false`
 * and silently turn off "posting requires confirmation"; downstream only checked whether the key was present, not whether it was right.
 */
function sealDeclaredModule(value: unknown, file: string, identity: ModuleIdentity): ModuleSchema {
  if (isModuleDraft(value)) return sealModule(value, identity);
  if (!value || typeof value !== "object") {
    fail(`${file} export default is not a module declaration — it must be the return value of \`defineModule({...})\``);
  }
  // It did not go through defineModule: it may be compiled output, or someone pasted production JSON back.
  // Run the shape gate so "bypassing the gate" is not possible at load time.
  return sealModule(defineModule(value), identity);
}

function assertPlanModulesKnown(
  plan: ExecutionPlan,
  modules: ReadonlyMap<string, LoadedModule>,
  file: string,
  transition: string,
): void {
  const createdModules = new Map<string, string>();
  const known = (module: string, at: string): void => {
    if (!modules.has(module)) {
      fail(`${file} planners.${transition} returned an unknown module "${module}" (${at})`);
    }
  };
  for (const command of plan.commands) {
    if (command.type === "createBill") {
      known(command.module, `createBill ${command.commandId}`);
      createdModules.set(command.commandId, command.module);
      continue;
    }
    if (command.type === "appendTargetLines") {
      if (command.target.kind === "existing") {
        known(command.target.module, `appendTargetLines ${command.commandId}.target`);
      } else {
        const module = createdModules.get(command.target.commandId);
        if (module === undefined) {
          fail(`${file} planners.${transition} returned appendTargetLines ${command.commandId}.target pointing at an unknown or not-yet-executed createBill "${command.target.commandId}"`);
        }
        known(module, `appendTargetLines ${command.commandId}.target`);
      }
      continue;
    }
    if (command.type === "setStatus") {
      // Only "does the module exist" is checked here. The deeper criteria (whether that edge exists, whether `expectedStatus`
      // is the `from` it declared, whether the target edge has its own Planner) live in the server's
      // `assertPlanTargets` — one copy, not two. Copying them here again would let
      // a Planner injected by a unit test (not wrapped by this package) take a looser path
      if (command.target.kind === "existing") {
        known(command.target.module, `setStatus ${command.commandId}.target`);
      } else {
        const module = createdModules.get(command.target.commandId);
        if (module === undefined) {
          fail(`${file} planners.${transition} returned setStatus ${command.commandId}.target pointing at an unknown or not-yet-executed createBill "${command.target.commandId}"`);
        }
        known(module, `setStatus ${command.commandId}.target`);
      }
      continue;
    }
    if (command.type === "setGeneratedHeader") {
      if (command.target.kind === "existing") {
        known(command.target.module, `setGeneratedHeader ${command.commandId}.target`);
      } else {
        const module = createdModules.get(command.target.commandId);
        if (module === undefined) fail(`${file} planners.${transition} returned setGeneratedHeader ${command.commandId} pointing at an unknown createBill`);
        known(module, `setGeneratedHeader ${command.commandId}.target`);
      }
      continue;
    }
    // The target of appendSourceLines is the current Planner host. There is no other module coordinate to check here.
    if (command.type === "appendSourceLines") continue;
    if (command.source.kind === "existing") {
      known(command.source.module, `createReference ${command.commandId}.source`);
    }
  }
}

/**
 * The only named extension of a directory module: `export const planners = definePlanners({...})`.
 *
 * A Planner's result depends on runtime reads and cannot be pre-executed at load time. This wraps it so that, the moment it returns,
 * it passes the ExecutionPlan closed-command gate and the catalog's cross-module gate before it is handed to the server. A bad plan never touches the write repository.
 */
function loadPlanners(
  loaded: ImportedExports,
  directoryModule: boolean,
  schema: ModuleSchema,
  file: string,
  modules: ReadonlyMap<string, LoadedModule>,
): ReadonlyMap<string, ModulePlanner> {
  const unknownNamed = Object.keys(loaded).filter(
    (key) =>
      key !== "default" &&
      key !== "planners" &&
      key !== "actionPreparers" &&
      key !== "batchActions" &&
      key !== "surfaces",
  );
  if (unknownNamed.length) {
    fail(
      `${file} has unknown named exports "${unknownNamed.join(", ")}" — a module entry allows only the default schema` +
        ` and, for a directory module, the named planners / actionPreparers / batchActions / surfaces`,
    );
  }

  const raw = loaded["planners"];
  if (raw === undefined) return new Map();
  if (!directoryModule) {
    fail(`${file} exports planners, but a Planner is allowed only in a directory module at modules/<code>/index.ts`);
  }
  if (!isDefinedPlanners(raw)) {
    fail(`${file} named planners must be the return value of definePlanners({...})`);
  }

  const out = new Map<string, ModulePlanner>();
  // A Planner is bound by action: every origin of the same action uses it, and the Planner branches on the status of `ctx.bill`.
  for (const [transition, planner] of Object.entries(raw)) {
    if (transitionAction(schema.lifecycle, transition) === null) {
      fail(`${file} planners.${transition} points at an unknown transition "${transition}"`);
    }
    // definePlanners already checked the function shape; the explicit assertion stays so a credential object cannot be mutated afterwards.
    if (typeof planner !== "function") {
      fail(`${file} planners.${transition} must be a function`);
    }
    const checked: ModulePlanner = async (context) => {
      if (context.module !== schema.code || context.transition !== transition) {
        fail(
          `${file} planners.${transition} was wrongly bound to ${context.module}.${context.transition}` +
            ` — a Planner may execute only the module + transition it registered`,
        );
      }
      const rawPlan = await planner(context);
      let plan: ExecutionPlan;
      try {
        plan = normalizeExecutionPlan(rawPlan, `return value of ${file}.planners.${transition}`);
      } catch (error: unknown) {
        if (!(error instanceof SchemaError)) throw error;
        fail(error.message);
      }
      assertPlanModulesKnown(plan, modules, file, transition);
      return plan;
    };
    out.set(transition, checked);
  }
  return out;
}

function loadActionPreparers(
  loaded: ImportedExports,
  directoryModule: boolean,
  schema: ModuleSchema,
  file: string,
): ReadonlyMap<string, ActionPreparer> {
  const raw = loaded["actionPreparers"];
  if (raw === undefined) return new Map();
  if (!directoryModule) {
    fail(`${file} exports actionPreparers, but an action-parameter preparer is allowed only in a directory module at modules/<code>/index.ts`);
  }
  if (!isDefinedActionPreparers(raw)) {
    fail(`${file} named actionPreparers must be the return value of defineActionPreparers({...})`);
  }

  const out = new Map<string, ActionPreparer>();
  for (const [transition, preparer] of Object.entries(raw)) {
    // Parameters are an action-level fact: every edge of the same action declares parameters identically.
    const edge = transitionAction(schema.lifecycle, transition);
    if (edge === null) fail(`${file} actionPreparers.${transition} points at an unknown transition "${transition}"`);
    if (edge.params.length === 0) {
      fail(`${file} actionPreparers.${transition} is bound to an edge with no parameters — with no parameter dialog there is no initial value to prepare`);
    }
    if (typeof preparer !== "function") fail(`${file} actionPreparers.${transition} must be a function`);
    out.set(transition, async (context) => {
      if (context.module !== schema.code || context.transition !== transition) {
        fail(
          `${file} actionPreparers.${transition} was wrongly bound to ${context.module}.${context.transition}` +
            ` — a parameter preparer may serve only the module + transition it registered`,
        );
      }
      return await preparer(context);
    });
  }
  return out;
}

function loadBatchActions(
  loaded: ImportedExports,
  directoryModule: boolean,
  schema: ModuleSchema,
  file: string,
  planners: ReadonlyMap<string, ModulePlanner>,
): BatchActions {
  const raw = loaded["batchActions"];
  if (raw === undefined) return Object.freeze({});
  if (!directoryModule) {
    fail(`${file} exports batchActions, but a batch workbench is allowed only in a directory module at modules/<code>/index.ts`);
  }
  if (!isDefinedBatchActions(raw)) {
    fail(`${file} named batchActions must be the return value of defineBatchActions({...})`);
  }
  const statusKeys = new Set(schema.lifecycle.statuses.map((status) => status.key));
  const fields = new Map(schema.fields.map((field) => [field.key, field] as const));
  for (const [code, action] of Object.entries(raw)) {
    const sourceTable = fields.get(action.sourceTable);
    if (sourceTable?.type !== "subtable" || sourceTable.fields === null) {
      fail(`${file} batchActions.${code}.sourceTable "${action.sourceTable}" is not a line table of this module`);
    }
    const remaining = sourceTable.fields.find((field) => field.key === action.sourceRemaining);
    if (remaining === undefined || (remaining.type !== "number" && remaining.type !== "money" && remaining.type !== "percent")) {
      fail(`${file} batchActions.${code}.sourceRemaining "${action.sourceRemaining}" is not a numeric column of the source lines`);
    }
    const executed = transitionAction(schema.lifecycle, action.transition);
    if (executed === null) fail(`${file} batchActions.${code}.transition points at an action that does not exist, "${action.transition}"`);
    if (executed.internal === true) fail(`${file} batchActions.${code}.transition "${action.transition}" is a system edge and cannot be a workbench action`);
    if (!planners.has(executed.code)) {
      fail(`${file} batchActions.${code} executes action "${executed.code}", which has no Planner in the same directory`);
    }
    const declaredParams = new Set(executed.params.map((param) => param.key));
    if (!declaredParams.has(action.modeParam) || !declaredParams.has(action.linesParam)) {
      fail(`${file} batchActions.${code} requires action "${executed.code}" to declare parameters "${action.modeParam}" and "${action.linesParam}"`);
    }
    for (const status of action.sourceStatuses) {
      if (!statusKeys.has(status)) fail(`${file} batchActions.${code} points at an unknown source status "${status}"`);
      try {
        transitionAt(schema, status, action.transition);
      } catch (error: unknown) {
        if (!(error instanceof SchemaError)) throw error;
        fail(`${file} batchActions.${code} has no edge for action "${action.transition}" at source status "${status}": ${error.message}`);
      }
    }
    for (const transitionCode of action.internalTransitions) {
      if (transitionAction(schema.lifecycle, transitionCode) === null) {
        fail(`${file} batchActions.${code}.internalTransitions points at an edge that does not exist, "${transitionCode}"`);
      }
    }
  }
  return raw;
}

export interface PlannerOrigin {
  readonly source: string;
  readonly target: string;
  readonly transition: string;
}

export async function scanDomainModules(
  domain: string,
  domainDir: string,
  domainsRoot: string,
  declared: DomainSchema,
  modules: Map<string, LoadedModule>,
  plannerOrigins: PlannerOrigin[],
  collectedSurfaces: LoadedSurface[],
): Promise<void> {
  const modulesDir = path.join(domainDir, "modules");
    for (const file of declared.modules ? listModuleFiles(modulesDir) : []) {
      const relative = path.relative(domainsRoot, file);
      // The parent directory is not named modules ⇒ the module was promoted to directory form ⇒ the escape hatch was used.
      const escapeHatch = path.basename(path.dirname(file)) !== "modules";
      const code = moduleFileCode(file);

      const loaded = await importExports(file);
      const declared = sealDeclaredModule(requireDefault(loaded, relative), relative, { code, domain });
      const planners = loadPlanners(loaded, escapeHatch, declared, relative, modules);
      const rawPlanners = loaded["planners"];
      const plannerConsistency = rawPlanners !== undefined && isDefinedPlanners(rawPlanners)
        ? new Map([...planners.keys()].map((transition) => [
            transition,
            plannerConsistencyOf(rawPlanners, transition),
          ] as const))
        : new Map();
      const actionPreparers = loadActionPreparers(loaded, escapeHatch, declared, relative);
      const batchActions = loadBatchActions(loaded, escapeHatch, declared, relative, planners);
      collectedSurfaces.push(...loadModuleSurfaces(loaded, escapeHatch, domain, relative));
      if (rawPlanners !== undefined && isDefinedPlanners(rawPlanners)) {
        for (const [transition, targets] of Object.entries(plannerCreateTargetsOf(rawPlanners))) {
          for (const target of targets) plannerOrigins.push({ source: declared.code, target, transition });
        }
      }
      // `expandsBills` is filled back in here. Same rule as `creatable.pushedFrom`, but a different view:
      // that one needs the whole module table ("who pushes to me" is written on someone else's edge), so it runs after the scan;
      // this one needs only this module's named planners, which are in hand when the module is scanned — and `normalizeLifecycle`
      // structurally cannot see planners (it receives only the lifecycle object), so the earliest it can happen is here.
      // The criterion itself stays in the kernel (`withPlannerExpansion`) and is not unfolded in this file:
      // "what counts as creating bills in bulk" must share a source with the gate that consumes it.
      const schema = withPlannerExpansion(declared, new Set(planners.keys()));

      const clash = modules.get(schema.code);
      if (clash) {
        fail(`module code "${schema.code}" is duplicated: ${clash.file} and ${relative} — a code can have only one real body`);
      }

      // A numbering prefix must be unique inside a tenant. The counter primary key is (tenant, prefix, sequence segment) — two modules sharing a prefix
      // share one counter: neither collides on a number (it is the same counter), but both sequences skip,
      // a product jumps from SP-0007 to SP-0011, and those four numbers in between sit on the customer table. There is no error, and nobody can find the cause.
      if (schema.numbering !== null) {
        const samePrefix = [...modules.values()].find((m) => m.schema.numbering?.prefix === schema.numbering?.prefix);
        if (samePrefix) {
          fail(
            `numbering prefix "${schema.numbering.prefix}" is duplicated: ${samePrefix.file} and ${relative}` +
              ` — the prefix is one dimension of the counter. Sharing it shares the sequence, and both sides skip numbers with no explanation`,
          );
        }
      }

      modules.set(schema.code, {
        code: schema.code,
        domain,
        file: relative,
        schema,
        escapeHatch,
        planners,
        plannerConsistency,
        actionPreparers,
        batchActions,
      });
    }
}

export function resolveModuleOrigins(
  modules: ReadonlyMap<string, LoadedModule>,
  plannerOrigins: readonly PlannerOrigin[],
): ReadonlyMap<string, LoadedModule> {
  const generatedOrigins = plannerOrigins.map((origin) => {
    const source = modules.get(origin.source);
    if (!source) fail(`Planner create path points at an unknown source module "${origin.source}"`);
    if (!modules.has(origin.target)) {
      fail(`Planner create path ${origin.source}.${origin.transition} points at an unknown target module "${origin.target}"`);
    }
    const edge = transitionAction(source.schema.lifecycle, origin.transition);
    if (edge === null) fail(`Planner create path points at an unknown edge ${origin.source}.${origin.transition}`);
    if (!source.planners.has(origin.transition)) {
      fail(`Planner create path ${origin.source}.${origin.transition} has no matching Planner`);
    }
    return {
      target: origin.target,
      module: source.code,
      moduleLabel: source.schema.label,
      transition: origin.transition,
      action: edge.action,
    };
  });
  const resolved = withPushOrigins(
    [...modules.values()].map((module) => module.schema),
    generatedOrigins,
  );
  const withOrigins = new Map<string, LoadedModule>();
  for (const schema of resolved) {
    const loaded = modules.get(schema.code);
    if (!loaded) fail(`while assembling creatable the module table has no "${schema.code}" — the module table was replaced after the scan`);
    withOrigins.set(schema.code, { ...loaded, schema });
  }
  return withOrigins;
}

export function requireModule(catalog: Catalog, code: string): LoadedModule {
  const hit = catalog.modules.get(code);
  if (!hit) {
    fail(`unknown module "${code}". Loaded: ${[...catalog.modules.keys()].join(", ")}`);
  }
  return hit;
}
