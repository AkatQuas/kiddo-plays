import type {
  ActionPreparer,
  BatchActions,
  DomainSchema,
  ChoiceSetSchema,
  ModulePlanner,
  ModuleSchema,
  NavigationGroup,
  PlannerConsistency,
  ModuleSettingSchema,
  DashboardSchema,
  QuickAskEntry,
  ReportDeclaration,
} from "@open-erp/metamodel";
import type { LoadedAgent } from "./agent.js";
import type { LoadedComposite, LoadedFlow } from "./flow.js";
import type { LoadedSkill } from "./skill.js";
import type { ProductAuthorization } from "./authorization.js";
import type { LoadedInsight } from "./insight.js";
import type { LoadedLedger } from "./ledger.js";
import type { LoadedSurface } from "./surface.js";

/** Where a module sits on disk, and its declaration. */
export interface LoadedModule {
  readonly code: string;
  readonly domain: string;
  /** Path relative to domains/, so an error can point back at it. */
  readonly file: string;
  readonly schema: ModuleSchema;
  /**
   * Directory form means the escape hatch was used (`modules/<code>/index.ts`).
   *
   * Record it as an explicit field instead of making the caller guess from a path suffix: this number is a pressure gauge,
   * and `yarn test` must report it. When the number grows, the vocabulary has a gap and should move up.
   */
  readonly escapeHatch: boolean;
  /** transition code -> read-only Planner of a directory module. A plain file module is always an empty Map. */
  readonly planners: ReadonlyMap<string, ModulePlanner>;
  /** Planner consistency semantics; loaded from the same place as planners. HTTP / Web must not guess from a fingerprint. */
  readonly plannerConsistency: ReadonlyMap<string, PlannerConsistency>;
  /** transition code -> read-only initial-value preparer, run before the action-parameter dialog opens. */
  readonly actionPreparers: ReadonlyMap<string, ActionPreparer>;
  /** Named workbench for the list multi-select state. It only assembles Planner parameters and does not persist an intermediate document. */
  readonly batchActions: BatchActions;
}

/** A dictionary declaration in product source, plus the owning domain, which only the loader knows. */
export interface LoadedChoiceSet extends ChoiceSetSchema {
  readonly domain: string;
}

import type { LoadedNotificationPreset } from "./notification.js";

/** A module setting declared in product code, plus the owning domain, which only the loader knows. */
export interface LoadedModuleSetting extends ModuleSettingSchema {
  readonly domain: string;
}

export interface Catalog {
  readonly modules: ReadonlyMap<string, LoadedModule>;
  /** Whole-product dictionary catalog; code is globally unique, and a field may be shared across domains. */
  readonly choiceSets: readonly LoadedChoiceSet[];
  /** Whole-product module-setting catalog; code is globally unique, and module must point at a real module. */
  readonly moduleSettings: readonly LoadedModuleSetting[];
  /**
   * Domains and their display names.
   *
   * The declaration itself is given, not an array of codes: the display name has only the domain declaration as its source of truth.
   */
  readonly domains: readonly DomainSchema[];
  /**
   * Notification presets. The declaration is the seed, and the row in the tenant database is the source of truth — the seed semantics
   * "write only when the code is missing, and do not overwrite a configuration the tenant already changed" are fulfilled on the server side.
   *
   * Optional (same rule as `surfaces`): a pile of test fixtures hand-write Catalog literals.
   * Making this required would force every fixture to add an empty array that has nothing to do with those cases.
   */
  readonly notificationPresets?: readonly LoadedNotificationPreset[];
  /** Business playbooks. Produced by the same scan as the module table, ordered by domain declaration order × file name. */
  readonly skills: readonly LoadedSkill[];
  /** Agent definitions. Produced by the same scan as modules and skills. */
  readonly agents: readonly LoadedAgent[];
  /**
   * Business flows (declarations under `flows/<domain>/`). Process declarations organized by verb; each step points at a declared edge.
   *
   * Cross-module checks have already run: `fatal` threw at load time, and each entry here is either sound
   * or carries `problems` (gaps) — the latter is what the UI shows as "to be filled in".
   */
  readonly flows: readonly LoadedFlow[];
  /**
   * Business-facing navigation tree (repo-root `navigation.ts`). Exhaustiveness has been checked, and label / path / permissionKey are filled in.
   * The permission-management / system groups are not here; the server appends them. A fixture may be an empty array.
   */
  readonly navigation: readonly NavigationGroup[];
  /**
   * Composite flows (`flows/_composites/`): several flows strung into a complete chain.
   * Used only for demos and automated tests. This is not "one longer flow" — on the floor, three groups of people each own a segment.
   */
  readonly composites: readonly LoadedComposite[];
  /**
   * Quick-ask declarations (`quick-asks/asks/*.json`). Maintained by product / sales. Load time has already checked
   * modules, status values, and condition fields — so each entry here can be sent as a query directly.
   * An empty array means this product has no quick asks.
   */
  readonly quickAsks: readonly QuickAskEntry[];
  /**
   * Quick-ask downrank tokens. Product maintains them in `quick-asks/generic-tokens.json`.
   * The mechanism only downranks; a fixture may omit this (treated as an empty table).
   */
  readonly quickAskGeneric?: readonly string[];
  /** Product authorization assembly contributed by each business domain, then checked and merged by the loader. */
  readonly authorization: ProductAuthorization;
  /**
   * Dashboard display-area catalog (code → declaration).
   * Merged from each domain's `dashboards` / `dashboard`; code is globally unique.
   */
  readonly dashboards: ReadonlyMap<string, DashboardSchema>;
  /**
   * Read-only query surfaces. Domain-level `surfaces.ts` is merged with named `surfaces` of directory modules;
   * code is globally unique. This is not a module — no table, no state machine.
   */
  readonly surfaces: ReadonlyMap<string, LoadedSurface>;
  /**
   * Declared cross-domain aggregates. The dedicated directory `domains/insights/` is not a business domain and not a surface.
   * Operating questions for insight_brief / collect read this; only those with a brief enter operating questions.
   */
  readonly insights: ReadonlyMap<string, LoadedInsight>;
  /**
   * Daily-report snapshot module plus narrative-domain axes. defineReport in `domains/report/report.ts`.
   * Null when not registered; the pipeline reads only this when it asks "which module is the daily report".
   */
  readonly report: ReportDeclaration | null;
  /**
   * Cross-domain ledger catalog. The dedicated directory `domains/ledgers/` is not a business domain.
   * An empty Map when that directory is absent; a product repo must have it. Read paths recognize only this catalog. The kernel no longer keeps five ledger snapshots.
   */
  readonly ledgers: ReadonlyMap<string, LoadedLedger>;
  /** Period sub-ledger list (finance / inventory). Empty when there is no ledger catalog. */
  readonly ledgerBooks: readonly string[];
}

export interface LoadOptions {
  /** Absolute path of domains/. */
  readonly domainsRoot: string;
  /**
   * Absolute path of `quick-asks/`. When omitted, the sibling of `domainsRoot` by convention.
   * A missing directory means this product has no quick asks (empty array), and that is not an error.
   */
  readonly quickAsksRoot?: string;
  /**
   * Absolute path of `flows/`. When omitted, the sibling of `domainsRoot` by convention.
   * A missing directory means this product has no flow declarations yet (empty array), and that is not an error.
   */
  readonly flowsRoot?: string;
  /**
   * Repo-root `navigation.ts`. When omitted, the sibling file of `domainsRoot` by convention.
   * A missing file means a synthetic fixture root (empty array); a product root is required to have the file by `loadCatalogFromRoot`.
   */
  readonly navigationFile?: string;
  /**
   * Declared operating scenarios (the scenario enum of `insight_brief`). Used to check presets with `kind:"insight"`.
   * When omitted, skip this check — the enum lives in the server layer and the loader cannot depend on it; pretending it was checked is worse.
   */
  readonly insightScenarios?: ReadonlySet<string>;
}
