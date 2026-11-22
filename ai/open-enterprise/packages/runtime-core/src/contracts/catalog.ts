import type { ActionPreparer, ChoiceSetItemColor, ModulePlanner, ModuleSchema, ModuleSettingSchema, PlannerConsistency } from "@open-erp/metamodel";

/** Module shape the runtime actually consumes; the loader's LoadedModule satisfies it structurally. */
export interface RuntimeModule {
  readonly schema: ModuleSchema;
  readonly planners: ReadonlyMap<string, ModulePlanner>;
  /** Carried through from definePlanners as-is; when an old or hand-written fixture omits it, the runtime tightens to exact. */
  readonly plannerConsistency?: ReadonlyMap<string, PlannerConsistency>;
  readonly actionPreparers: ReadonlyMap<string, ActionPreparer>;
}

/** Data dictionary declared in product source. The tenant database stores only the delta against these defaults. */
export interface RuntimeChoiceSet {
  readonly code: string;
  readonly label: string;
  readonly items: readonly {
    readonly code: string;
    readonly label: string;
    readonly color?: ChoiceSetItemColor;
    /** Product tombstone: keep historical resolution, and never again offer it as a candidate for new writes. */
    readonly retired: boolean;
  }[];
}

/** File locations and domain/skill/agent scan results do not enter the runtime kernel. */
export interface RuntimeCatalog {
  readonly modules: ReadonlyMap<string, RuntimeModule>;
  readonly choiceSets: readonly RuntimeChoiceSet[];
  readonly moduleSettings: readonly ModuleSettingSchema[];
}

export function requireRuntimeModule(catalog: RuntimeCatalog, code: string): RuntimeModule {
  const loaded = catalog.modules.get(code);
  if (loaded === undefined) throw new Error(`Unknown module "${code}"`);
  return loaded;
}
