// ---------------------------------------------------------------------------
// Acceptance facts and obligations — mechanically generate "what must be verified" from the full catalog
//
// This does not drive a browser, connect to a database, or store a run result. It only projects the fully
// assembled state into one deterministic manifest: the runner must supply evidence for every item in that set,
// and must not hand-write a list that can silently drop a module.
//
// SourceBinding owns only cross-record sources. Lifecycle, gates, effects, relations, and UI surfaces still
// project from their own single criterion. A Planner's target set is dynamic, so this emits only an execution
// obligation. The concrete target count must be witnessed by an Acceptance Scenario; a run result must not be written back into the schema.
// ---------------------------------------------------------------------------

import type { Catalog } from "@open-erp/loader";
import {
  creatableFields,
  editableFields,
  isReverseQueryable,
  relationsOf,
  resolvePreconditions,
  reverseQueryFieldOf,
  sourceBindingsOf,
  type Effect,
  type PushOrigin,
  type Relation,
  type SourceBinding,
  type TransitionParam,
} from "@open-erp/metamodel";

export const ACCEPTANCE_MANIFEST_VERSION = 1 as const;

export interface AcceptanceTransitionFact {
  readonly module: string;
  readonly code: string;
  readonly from: string;
  readonly to: string;
  readonly action: string;
  readonly confirm: boolean;
  readonly postsToLedger: boolean;
  readonly expandsBills: boolean;
  readonly params: readonly TransitionParam[];
  readonly effects: readonly Effect[];
  readonly guards: readonly {
    readonly id: string;
    readonly inheritedFrom: string | null;
  }[];
}

export interface AcceptanceModuleFact {
  readonly code: string;
  readonly label: string;
  readonly domain: string;
  readonly file: string;
  readonly creatable: {
    readonly manual: boolean;
    readonly blockers: readonly { readonly path: string; readonly type: string; readonly why: string }[];
    readonly fields: readonly string[];
    readonly pushedFrom: readonly PushOrigin[];
  };
  readonly surfaces: {
    readonly listColumns: readonly string[];
    readonly formFields: readonly string[];
    readonly statuses: readonly {
      readonly key: string;
      readonly editable: "full" | "whitelist" | "none";
      /** Real top-level writable fields after the system-supplied filter. */
      readonly editableFields: readonly string[];
    }[];
  };
  readonly transitions: readonly AcceptanceTransitionFact[];
}

export interface AcceptanceFacts {
  readonly version: typeof ACCEPTANCE_MANIFEST_VERSION;
  readonly modules: readonly AcceptanceModuleFact[];
  readonly sources: readonly SourceBinding[];
  /** Each declared relation appears once. Direction is fixed as from -> to. */
  readonly relations: readonly Relation[];
}

export type AcceptanceLayer = "browser" | "database";
export type AcceptanceCategory =
  | "surface-list"
  | "surface-detail"
  | "surface-create"
  | "surface-create-blocked"
  | "surface-edit"
  | "permission"
  | "source-select"
  | "source-value"
  | "source-create"
  | "planner-execution"
  | "transition"
  | "guard"
  | "effect"
  | "relation-link"
  | "relation-reverse";

/**
 * `factId` points back at the canonical fact in AcceptanceFacts. Module-level obligations such as surface/permission are null.
 * `scenarioRequired` only means the mechanical facts are not enough to supply the business input and expectation. The runner must not use skip in place of a witness.
 */
export interface AcceptanceObligation {
  readonly id: string;
  readonly layer: AcceptanceLayer;
  readonly category: AcceptanceCategory;
  readonly module: string;
  readonly factId: string | null;
  readonly scenarioRequired: boolean;
}

export interface AcceptanceManifest extends AcceptanceFacts {
  readonly obligations: readonly AcceptanceObligation[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableId(...parts: readonly (string | number | boolean | null)[]): string {
  return JSON.stringify(parts);
}

function relationId(relation: Relation): string {
  return stableId(
    "relation",
    relation.from,
    relation.through,
    relation.field,
    relation.to,
    relation.toThrough,
  );
}

/** Pure projection: accept only a Catalog the loader has finished assembling. No IO, and do not repair incomplete input. */
export function acceptanceFactsOf(catalog: Catalog): AcceptanceFacts {
  const loaded = [...catalog.modules.values()];
  const schemas = loaded.map((module) => module.schema);
  const modules = loaded
    .map((module): AcceptanceModuleFact => {
      const pushedFrom = module.schema.creatable.pushedFrom;
      if (pushedFrom === null) {
        throw new Error(`acceptance facts: creatable.pushedFrom for module "${module.code}" has not been assembled`);
      }
      return {
        code: module.code,
        label: module.schema.label,
        domain: module.domain,
        file: module.file,
        creatable: {
          manual: module.schema.creatable.manual,
          blockers: module.schema.creatable.blockers.map((blocker) => ({
            path: blocker.path,
            type: blocker.type,
            why: blocker.why,
          })),
          fields: creatableFields(module.schema),
          pushedFrom: pushedFrom.map((origin) => ({ ...origin })),
        },
        surfaces: {
          listColumns: [...module.schema.views.list.columns],
          formFields: module.schema.views.form.flatMap((section) => section.fields),
          statuses: module.schema.lifecycle.statuses.map((status) => ({
            key: status.key,
            editable: status.editable,
            editableFields: editableFields(module.schema, status.key),
          })),
        },
        transitions: module.schema.lifecycle.transitions.map((transition) => ({
          module: module.code,
          code: transition.code,
          from: transition.from,
          to: transition.to,
          action: transition.action,
          confirm: transition.confirm,
          postsToLedger: transition.postsToLedger,
          expandsBills: transition.expandsBills,
          params: transition.params,
          effects: transition.effects,
          guards: resolvePreconditions(module.schema, transition.code).map(({ rule, inheritedFrom }) => ({
            id: rule.id,
            inheritedFrom,
          })),
        })),
      };
    })
    .sort((left, right) => compareText(left.code, right.code));

  const relationMap = new Map<string, Relation>();
  for (const schema of schemas) {
    for (const relation of relationsOf(schemas, schema.code).outbound) {
      const id = relationId(relation);
      if (relationMap.has(id)) {
        throw new Error(`acceptance facts: relation fact id "${id}" is duplicated`);
      }
      relationMap.set(id, relation);
    }
  }

  return {
    version: ACCEPTANCE_MANIFEST_VERSION,
    modules,
    sources: sourceBindingsOf(schemas),
    relations: [...relationMap.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([, relation]) => relation),
  };
}

function obligation(
  layer: AcceptanceLayer,
  category: AcceptanceCategory,
  module: string,
  factId: string | null,
  scenarioRequired = false,
): AcceptanceObligation {
  return {
    id: stableId("acceptance", layer, category, module, factId),
    layer,
    category,
    module,
    factId,
    scenarioRequired,
  };
}

/**
 * Generate a closed set of acceptance obligations from the facts. Consumers must treat expected ids and evidence ids as equal sets.
 * "Ran a few representative modules" or skip must not stand in for coverage.
 */
export function acceptanceObligationsOf(facts: AcceptanceFacts): readonly AcceptanceObligation[] {
  const out: AcceptanceObligation[] = [];
  const moduleByCode = new Map(facts.modules.map((module) => [module.code, module]));
  const browserCoordinateWritable = (target: {
    readonly module: string;
    readonly table: string | null;
    readonly field: string;
  }): boolean => {
    const targetModule = moduleByCode.get(target.module);
    if (targetModule === undefined) {
      throw new Error(`acceptance obligations: a browser source obligation points at unknown target module "${target.module}"`);
    }
    const formRoot = target.table ?? target.field;
    const createReachable =
      targetModule.creatable.manual && targetModule.creatable.fields.includes(formRoot);
    // A Planner `createBill` target gets a path=creatable blocker appended at assembly time. It does not offer
    // a standalone create entry on the target. Whether an editable record appears depends on running the source action first.
    // A generic runner does not have that business witness and must not treat "the seed might happen to contain an initial-status record" as schema reachability.
    // `pushedFrom` receives both an ordinary transition.push and a Planner target. Looking only at length mixes the two into one kind.
    // A generic source-select runner then has to luck into an initial-status seed. When every seed is terminal,
    // the schema never promised that entry, but acceptance would still emit a browser obligation that can never be reached.
    const generatedOnly = targetModule.creatable.blockers.some((blocker) => blocker.path === "creatable");
    const recordCanReachEditableSurface =
      targetModule.creatable.manual || (targetModule.creatable.pushedFrom.length > 0 && !generatedOnly);
    const editReachable =
      recordCanReachEditableSurface &&
      targetModule.surfaces.statuses.some((status) => status.editableFields.includes(formRoot));
    return targetModule.surfaces.formFields.includes(formRoot) && (createReachable || editReachable);
  };

  for (const module of facts.modules) {
    out.push(obligation("browser", "surface-list", module.code, null));
    out.push(obligation("browser", "surface-detail", module.code, null));
    out.push(
      obligation(
        "browser",
        module.creatable.manual ? "surface-create" : "surface-create-blocked",
        module.code,
        null,
      ),
    );
    for (const status of module.surfaces.statuses) {
      if (status.editable !== "none") {
        out.push(obligation("browser", "surface-edit", module.code, stableId(module.code, status.key)));
      }
    }
    for (const action of ["read", "create", "update", "delete"] as const) {
      out.push(obligation("browser", "permission", module.code, stableId(module.code, action)));
    }

    // An edge's identity is (code, from): each edge needs its own evidence that it was walked (the same action from different starts can take different Planner branches).
    // Gates and postings hang off the action, and the edges of one action are identical, so each action needs only one of those.
    const actionSeen = new Set<string>();
    for (const transition of module.transitions) {
      out.push(obligation("browser", "transition", module.code, stableId(transition.module, transition.code, transition.from)));
      if (actionSeen.has(transition.code)) continue;
      actionSeen.add(transition.code);
      for (const guard of transition.guards) {
        out.push(
          obligation(
            "database",
            "guard",
            module.code,
            stableId(transition.module, transition.code, guard.id, guard.inheritedFrom),
            true,
          ),
        );
      }
      transition.effects.forEach((_effect, index) => {
        out.push(
          obligation(
            "database",
            "effect",
            module.code,
            stableId(transition.module, transition.code, index),
            true,
          ),
        );
      });
    }
  }

  for (const source of facts.sources) {
    if (source.kind === "field-select") {
      out.push(obligation("database", "source-select", source.target.module, source.id, true));
      // `selectable` only says the field mechanism allows a person to choose. It does not promise the browser put it on a form,
      // and it does not promise this surface has any writable moment in the product lifecycle.
      // A browser obligation must intersect the real surface and the real writable root: the header looks at the field itself,
      // a line looks at the subtable root that carries it. Manual create uses creatableFields; a stored record uses
      // editableFields for each status after the system-supplied filter.
      // Otherwise a field such as materialIssue.productionOrderId — the API may override refDefault, the UI hides it on purpose,
      // and another cell fills it — would generate a ghost obligation that never has a page coordinate.
      if (source.selectable && browserCoordinateWritable(source.target)) {
        out.push(obligation("browser", "source-select", source.target.module, source.id, true));
      }
      continue;
    }
    if (source.kind === "field-value") {
      out.push(obligation("database", "source-value", source.target.module, source.id, true));
      continue;
    }
    if (source.kind === "unit-choice") {
      out.push(obligation("database", "source-value", source.target.module, source.id, true));
      if (browserCoordinateWritable(source.target)) {
        out.push(obligation("browser", "source-select", source.target.module, source.id, true));
      }
      continue;
    }
    if (source.kind === "creation") {
      out.push(obligation("database", "source-create", source.target.module, source.id, true));
      out.push(obligation("browser", "source-create", source.target.module, source.id, true));
      continue;
    }
    out.push(obligation("database", "planner-execution", source.transition.module, source.id, true));
    out.push(obligation("browser", "planner-execution", source.transition.module, source.id, true));
  }

  for (const relation of facts.relations) {
    const id = relationId(relation);
    out.push(obligation("browser", "relation-link", relation.from, id, true));
    if (isReverseQueryable(relation)) {
      // Call the single criterion once: generating the manifest also proves this relation has an executable reverse-query coordinate.
      reverseQueryFieldOf(relation);
      out.push(obligation("browser", "relation-reverse", relation.to, id, true));
    }
  }

  const byId = new Map<string, AcceptanceObligation>();
  for (const item of out) {
    if (byId.has(item.id)) throw new Error(`acceptance obligations: obligation id "${item.id}" is duplicated`);
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => compareText(left.id, right.id));
}

export function acceptanceManifestOf(catalog: Catalog): AcceptanceManifest {
  const facts = acceptanceFactsOf(catalog);
  return { ...facts, obligations: acceptanceObligationsOf(facts) };
}

/** Closing gate for the runner: missing evidence, extra evidence, and duplicate evidence all fail. */
export function assertAcceptanceEvidence(
  obligations: readonly AcceptanceObligation[],
  evidenceIds: readonly string[],
): void {
  const expected = obligations.map((item) => item.id);
  const duplicateEvidence = evidenceIds.filter((id, index) => evidenceIds.indexOf(id) !== index);
  if (duplicateEvidence.length > 0) {
    throw new Error(`acceptance evidence: duplicate evidence ids: ${[...new Set(duplicateEvidence)].sort(compareText).join(", ")}`);
  }
  const expectedSet = new Set(expected);
  const evidenceSet = new Set(evidenceIds);
  const missing = expected.filter((id) => !evidenceSet.has(id));
  const unexpected = evidenceIds.filter((id) => !expectedSet.has(id)).sort(compareText);
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `acceptance evidence: sets are not equal; missing ${String(missing.length)}` +
        `${missing.length > 0 ? ` (${missing.join(", ")})` : ""}; ` +
        `extra ${String(unexpected.length)}${unexpected.length > 0 ? ` (${unexpected.join(", ")})` : ""}`,
    );
  }
}
