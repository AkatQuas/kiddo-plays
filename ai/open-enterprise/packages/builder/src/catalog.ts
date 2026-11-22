// ---------------------------------------------------------------------------
// `yarn catalog` — the static contract for a coding agent
//
// Paired with the runtime contract (`module_describe`). That one projects by identity, splits by meaning, and, with a database
// and a session, answers "what can I do to this record right now". This one is at modeling time, offline, and does not trim permissions.
// It answers "what do the modules in this repo look like, and how are they connected".
//
// The audience is a coding agent, not a person. So:
//   · Always JSON. No `--json`, no color, alignment, section titles, or arrow decoration.
//   · Emit only what cannot be read from source, or what reading the source gets systematically wrong, plus the coordinates that send the agent to the source.
//     The agent already has the repo. `cat domains/sales/modules/salesOrder/index.ts` is free,
//     and the source still carries the "why" in comments. Copying `type` / `options` / `help` / `views`
//     turns one fact into two, and the copy is worse (no context, and it drifts).
//   · Omit empty keys. Measured on `explain warehouse --json`: the smallest module has 7 fields, and 9 of 13 keys on each field object
//     were `null` placeholders. That is noise, not information.
//
// Keep the Chinese `label` (module name and field name). Describing a requirement in Chinese and having the agent find the module is a real case.
// Those strings are data from domains/, not characters written in this file.
// ---------------------------------------------------------------------------

import { loadCatalog, requireModule, type Catalog } from "@open-erp/loader";
import {
  describeSupply,
  editableFields,
  effectDeclarations,
  fieldLabelsOf,
  gateOf,
  isRefFilterRef,
  isReverseQueryable,
  isSystemSupplied,
  relationsOf,
  resolvePreconditions,
  reverseQueryFieldOf,
  supplyOf,
  transitionEdges,
  transitionsReaching,
  type Effect,
  type Field,
  type FieldSupply,
  type ModuleSchema,
  type RefFilter,
  type Relation,
} from "@open-erp/metamodel";
import { uniqueIndexedFieldsOf, type UniqueBy } from "./codegen.js";
import { findMaterials, materialCards } from "./materials.js";
import { systemOverview, type OverviewModule, type SystemOverview } from "./overview.js";

// ---------------------------------------------------------------------------
// selector — mutually exclusive, and there must be no priority
// ---------------------------------------------------------------------------

/**
 * One call accepts one selector.
 *
 * No priority and no silent ignore. When two selectors appear together, whichever order they are interpreted in,
 * the caller receives an answer it did not ask for, and it has no way to notice.
 */
export type CatalogSelector =
  | { readonly kind: "repo" }
  | { readonly kind: "module"; readonly module: string }
  | { readonly kind: "domain"; readonly domain: string }
  | { readonly kind: "around"; readonly around: string }
  | { readonly kind: "need"; readonly need: readonly string[] };

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

/** One creation path: who creates this module, and through which edge. */
export interface CatalogOrigin {
  readonly module: string;
  readonly label: string;
  readonly transition: string;
  readonly action: string;
}

/** Listing-level module card: locating coordinates plus the few facts that can be computed only with a whole-repo view. */
export interface CatalogModuleCard {
  readonly module: string;
  readonly label: string;
  /** Source path relative to `domains/`. This is the entry that sends the agent to the source. It cannot be omitted. */
  readonly file: string;
  readonly kind: "master" | "document";
  /**
   * Whether a person can create it. Always present, unlike the other booleans. It has no default tier.
   * A missing key would be read as "not said", and a greyed-out New button has to be sayable.
   */
  readonly manual: boolean;
  /** Who pushes to it. Structurally invisible from one module. Computable only across the whole repo. */
  readonly pushedFrom?: readonly CatalogOrigin[];
  /** Which ledger it posts to. Derived from each edge's effects. */
  readonly postsToLedger?: readonly string[];
  /** Direct business-reference targets, deduped. Field-level expansion is only on `--around`. */
  readonly dependencies?: readonly string[];
  readonly capabilities?: readonly ("planner" | "batch" | "unitSet")[];
  readonly escapeHatch?: true;
  /** Present only in the `partial` result of `--need`. */
  readonly matched?: readonly string[];
  readonly missing?: readonly string[];
}

export interface CatalogDomain {
  readonly domain: string;
  readonly label: string;
  readonly kind: "business" | "support";
  readonly modules: readonly CatalogModuleCard[];
}

/** Creation flow: who can create whom. The reverse side of `create-from` is not written anywhere in the source module. */
export interface CatalogFlow {
  readonly kind: "create-from" | "push" | "planner";
  readonly from: string;
  /** When the source is a line, the key of that line table. */
  readonly fromTable?: string;
  /** Absent for `planner`: the target set is known only at runtime. */
  readonly to?: string;
  /** The cell on the target that receives the source coordinate. */
  readonly toPath?: string;
  readonly transition?: string;
  /** Entry button text. For the `planner` tier it is the action name of that edge. */
  readonly label: string;
  readonly sourceStatuses?: readonly string[];
  readonly remaining?: true;
}

/** Field-level one-hop dependency. Expanded only on `--around`. */
export interface CatalogBinding {
  readonly kind: "select" | "lookup" | "snapshot" | "default" | "unit-choice";
  readonly from: string;
  readonly fromPath?: string;
  readonly to: string;
  readonly toPath: string;
  /** `select` tier: whether the source record can be selected. Emitted only when false. */
  readonly selectable?: false;
}

export interface CatalogListing {
  readonly scope?: {
    readonly domain?: string;
    readonly around?: string;
    readonly need?: readonly string[];
  };
  readonly domains: readonly CatalogDomain[];
  readonly flows?: readonly CatalogFlow[];
  readonly bindings?: readonly CatalogBinding[];
  /** `--need`: modules that cover some of the capabilities. Never presented as a full match. */
  readonly partial?: readonly CatalogModuleCard[];
  /** `--need`: which modules cover each capability, for combining several materials. */
  readonly coverage?: Readonly<Record<string, readonly string[]>>;
  /** `--need`: capabilities that are legal in the vocabulary but unused anywhere in the repo. */
  readonly uncovered?: readonly string[];
}

/** Where to go to satisfy a status requirement inside a candidate condition. Structured. No sentence for a person. */
export interface CatalogRemedy {
  readonly module: string;
  readonly label: string;
  readonly status: string;
  readonly via: readonly { readonly transition: string; readonly action: string; readonly from: string }[];
}

export interface CatalogField {
  readonly key: string;
  readonly label: string;
  /** A person must not fill this. Criterion is `isSystemSupplied`, wider than `supply` (it also includes systemGenerated / plannerSupplied). */
  readonly systemSupplied?: true;
  readonly supply?: FieldSupply;
  /** How this number is produced. The same `describeSupply` the UI uses. */
  readonly formula?: string;
  /** The user's obligation, not the column's NOT NULL. Always absent on a system-supplied field. */
  readonly required?: true;
  readonly primary?: true;
  /**
   * Unique within the tenant. The most derived cell in the whole contract: the `primary` tier writes no `unique`
   * anywhere in the module source, and the database really has `uniqueIndex(tenant_id, column)`.
   */
  readonly unique?: UniqueBy;
  readonly choiceSet?: string;
  /** Which candidates this cell can choose. Dynamic operands are kept in `$bill.x` form. */
  readonly refFilter?: readonly string[];
  /** How a status condition gets satisfied. See `CatalogRemedy`. */
  readonly refFilterRemedy?: readonly CatalogRemedy[];
  /** The condition of the row that is selected automatically when left blank (when the candidates contain exactly one). */
  readonly refPreselect?: readonly string[];
  readonly unitChoice?: {
    readonly match: string;
    readonly sourceModule: string;
    readonly main: string;
    readonly auxiliary: string;
    readonly conversionRate: string;
    readonly factorInto: string;
    readonly priority: "user > refDefault > main";
    readonly convention: "1 auxiliary = N main";
  };
  /** Columns of the line table. This field's `key` is the line-table key. */
  readonly columns?: readonly CatalogField[];
}

export interface CatalogStatus {
  readonly key: string;
  /** Emitted only when it differs from the key. */
  readonly label?: string;
  readonly initial?: true;
  readonly terminal?: true;
  /** Which already-stored fields can be changed in this status. Derived, not a declared bit. */
  readonly editable?: readonly string[];
}

export interface CatalogGuard {
  readonly id: string;
  readonly level: string;
  /** Generated from the declaration, not handwritten prose. */
  readonly rule: string;
  /** Present means this gate is inherited from that edge (this edge is its route exit). */
  readonly inheritedFrom?: string;
}

export interface CatalogTransition {
  /** Business action. An edge's identity is (code, from). The caller submits only the code, and the server resolves this edge from the bill's current status. */
  readonly code: string;
  readonly action: string;
  readonly from: string;
  readonly to: string;
  /**
   * Other origins of the same action (same code). When present, these edges are one action, one button, one permission coordinate,
   * and one Planner. Do not treat them as several things while modeling, and do not pick an edge by status when calling.
   */
  readonly alsoFrom?: readonly string[];
  /** Not shown on the operation surface. `availableTransitions` filters it out. */
  readonly internal?: true;
  /** Posting: whose account it lands on, and whether it expands per line. */
  readonly postsToLedger?: readonly string[];
  /** Ledger entries hung on other edges that this edge rolls back. */
  readonly reverses?: readonly string[];
  readonly push?: {
    readonly module: string;
    readonly line?: { readonly source: string; readonly target: string };
  };
  /** Taking this edge expands a batch of downstream bills per line. The criterion is the named `planners` export, not the lifecycle. */
  readonly expandsBills?: true;
  /** Which gates this edge actually passes, including ones inherited by a route exit. */
  readonly guards?: readonly CatalogGuard[];
}

export interface CatalogRelation {
  readonly module: string;
  readonly label: string;
  readonly field: string;
  readonly fieldLabel: string;
  /** Which line table on this side the relation hangs on. Absent for a header reference. */
  readonly through?: string;
  /** Points at a line on the other side (refLine), not at a bill. */
  readonly toLine?: true;
  /** Which field path the condition hangs on for a reverse lookup. Absent means reverse lookup is impossible (the other side stores a line id). */
  readonly reverseQueryField?: string;
  /** When reverse lookup is impossible, the key of the line table on the other side. */
  readonly toThrough?: string;
}

export interface CatalogModule {
  readonly module: string;
  readonly label: string;
  readonly domain: string;
  readonly file: string;
  readonly creatable: {
    readonly manual: boolean;
    /** The cells that block it when `manual === false`. */
    readonly blockers?: readonly { readonly path: string; readonly label: string; readonly why: string }[];
    readonly pushedFrom?: readonly CatalogOrigin[];
    /** The module table was not assembled with `withPushOrigins`. `[]` (looked, and nobody pushes) means the opposite. */
    readonly pushedFromUnresolved?: true;
  };
  readonly fields: readonly CatalogField[];
  readonly statuses: readonly CatalogStatus[];
  readonly transitions?: readonly CatalogTransition[];
  /** Who this module points at. */
  readonly references?: readonly CatalogRelation[];
  /** Who points at this module. Structurally invisible from one module. */
  readonly referencedBy?: readonly CatalogRelation[];
}

export type CatalogResult = CatalogListing | CatalogModule;

// ---------------------------------------------------------------------------
// Omitting empty values
// ---------------------------------------------------------------------------

/** Keep it only when non-empty. `JSON.stringify` drops `undefined` on its own. This only decides "empty". */
function some<T>(values: readonly T[]): readonly T[] | undefined {
  return values.length === 0 ? undefined : values;
}

function on(flag: boolean): true | undefined {
  return flag ? true : undefined;
}

function text(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : value;
}

/**
 * Drop keys whose value is `undefined`.
 *
 * `on` / `text` / `some` express "absent" as `undefined`, and `exactOptionalPropertyTypes`
 * does not accept assigning `undefined` to an optional property — that is exactly the "key present, value undefined" it exists to prevent.
 * The contract wants the key not to appear at all, so it is stripped once at the exit, instead of writing
 * `...(x ? { x } : {})` on every field. That would grow a ternary on a dozen literals, and a reader could no longer see
 * which keys this contract actually has.
 */
function compact<T extends object>(o: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

// ---------------------------------------------------------------------------
// Field projection
// ---------------------------------------------------------------------------

/** `{ orgType: "factory" }` → `["orgType = factory"]`. An array becomes `in`. A dynamic mapping prints the map as well. */
function conditionsOf(filter: RefFilter | null | undefined): readonly string[] | undefined {
  if (filter == null) return undefined;
  return some(Object.entries(filter).map(([key, operand]) => {
    if (isRefFilterRef(operand)) {
      if (operand.through !== undefined && operand.field !== undefined) {
        return `${key} ∈ ${operand.from}.${operand.through}.${operand.field} (skipped when the upstream is not selected)`;
      }
      if (operand.map === undefined) return `${key} = ${operand.from}`;
      const mapping = Object.entries(operand.map)
        .map(([source, target]) => `${source}→${Array.isArray(target) ? target.map(String).join("/") : String(target)}`)
        .join("，");
      return `${key} = map(${operand.from}: ${mapping})`;
    }
    if (Array.isArray(operand)) return `${key} ∈ ${operand.map((v) => String(v)).join(" / ")}`;
    return `${key} = ${String(operand)}`;
  }));
}

/**
 * "The candidate requires this status" becomes "where to go to put it in that status".
 *
 * `refFilter` can say the condition and cannot say where to satisfy it. Through the UI that is an empty dropdown. A direct create is
 * `REF_FILTER_MISMATCH`, and the user has no second choice. The criterion is the kernel's `transitionsReaching`.
 */
function remedyOf(
  filter: RefFilter | null | undefined,
  target: ModuleSchema | null,
): readonly CatalogRemedy[] | undefined {
  if (filter == null || target === null) return undefined;
  const wanted = filter["status"];
  if (wanted === undefined || isRefFilterRef(wanted)) return undefined;
  const values = (Array.isArray(wanted) ? wanted : [wanted]).map((v) => String(v));
  return some(transitionsReaching(target, values).flatMap((approach) => {
    if (approach.transitions.length === 0) return [];
    return [{
      module: target.code,
      label: target.label,
      status: approach.status,
      via: approach.transitions.map((t) => ({ transition: t.code, action: t.action, from: t.from })),
    }];
  }));
}

function fieldOf(
  f: Field,
  siblings: readonly Field[],
  uniqueBy: UniqueBy | null,
  targetOf: (code: string) => ModuleSchema | null,
): CatalogField {
  const match = f.unitChoice === null ? null : siblings.find((c) => c.key === f.unitChoice?.match) ?? null;
  const source = match?.ref ? targetOf(match.ref) : null;
  const unitChoice = f.unitChoice === null || match?.ref === null || match?.ref === undefined || source?.unitSet == null
    ? undefined
    : {
        match: f.unitChoice.match,
        sourceModule: match.ref,
        main: source.unitSet.main,
        auxiliary: source.unitSet.auxiliary,
        conversionRate: source.unitSet.conversionRate,
        factorInto: f.unitChoice.factorInto,
        priority: "user > refDefault > main" as const,
        convention: "1 auxiliary = N main" as const,
      };
  return compact<CatalogField>({
    key: f.key,
    label: f.label,
    systemSupplied: on(isSystemSupplied(f, siblings)),
    supply: supplyOf(f, siblings) ?? undefined,
    formula: text(describeSupply(f, siblings)),
    required: on(f.required),
    primary: on(f.primary),
    unique: uniqueBy ?? undefined,
    choiceSet: text(f.choiceSet),
    refFilter: conditionsOf(f.refFilter),
    refFilterRemedy: remedyOf(f.refFilter, f.ref ? targetOf(f.ref) : null),
    refPreselect: conditionsOf(f.refPreselect),
    unitChoice,
    // Line columns always pass null. `FIELD_UNIQUE_ON_LINE` rejects unique on a line column,
    // and the table generator emits no business unique index for a line table. A line table has only the `(bill_id, line_no)` index.
    columns: f.fields ? some(f.fields.map((c) => fieldOf(c, f.fields ?? [], null, targetOf))) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Single-module contract
// ---------------------------------------------------------------------------

function relationOf(r: Relation, module: string, label: string): CatalogRelation {
  const queryable = isReverseQueryable(r);
  return compact<CatalogRelation>({
    module,
    label,
    field: r.field,
    fieldLabel: r.fieldLabel,
    through: text(r.through),
    toLine: on(r.toLevel === "line"),
    reverseQueryField: queryable ? reverseQueryFieldOf(r) : undefined,
    toThrough: queryable ? undefined : text(r.toThrough),
  });
}

function moduleContract(catalog: Catalog, code: string): CatalogModule {
  const { schema, file, domain } = requireModule(catalog, code);
  const schemas = [...catalog.modules.values()].map((m) => m.schema);
  const relations = relationsOf(schemas, schema.code);

  // A posting has to be readable as "whose account it lands on" and "whether it expands per line".
  const effectText = (e: Effect): string => {
    const amount = e.amount.kind === "literal" ? String(e.amount.value) : `{$${e.amount.from}.${e.amount.field}}`;
    const subject = `posted to $${e.subject.from}.${e.subject.field}`;
    const scope = e.scope ? ` × $${e.scope.from}.${e.scope.field}` : "";
    const per = e.perLine ? " (per line)" : "";
    return `${e.target} ${e.op} ${amount}${per} ${subject}${scope}`;
  };

  // Look up the uniqueness source once and index it by key. Computing it per field tempts an inline `f.primary && ...`.
  // That would be a second criterion. The table generator's copy is the one that actually emits the index.
  const uniqueBy = new Map(uniqueIndexedFieldsOf(schema.fields).map((u) => [u.field.key, u.by]));
  // A missing reference target returns null and does not throw. Whether a reference points at something real is checked at build time by `checkCrossReferences`.
  const targetOf = (target: string): ModuleSchema | null => catalog.modules.get(target)?.schema ?? null;
  const labelOf = (target: string): string => {
    const found = catalog.modules.get(target);
    if (!found) throw new Error(`catalog: module table has no "${target}"`);
    return found.schema.label;
  };

  return compact<CatalogModule>({
    module: schema.code,
    label: schema.label,
    domain,
    file,
    creatable: compact<CatalogModule["creatable"]>({
      manual: schema.creatable.manual,
      blockers: some(schema.creatable.blockers.map((b) => ({ path: b.path, label: b.label, why: b.why }))),
      pushedFrom: schema.creatable.pushedFrom === null
        ? undefined
        : some(schema.creatable.pushedFrom.map((o) => ({
            module: o.module,
            label: o.moduleLabel,
            transition: o.transition,
            action: o.action,
          }))),
      pushedFromUnresolved: on(schema.creatable.pushedFrom === null),
    }),
    fields: schema.fields.map((f) => fieldOf(f, schema.fields, uniqueBy.get(f.key) ?? null, targetOf)),
    statuses: schema.lifecycle.statuses.map((s) => compact<CatalogStatus>({
      key: s.key,
      label: s.label === s.key ? undefined : s.label,
      initial: on(s.initial),
      terminal: on(s.terminal),
      editable: some(editableFields(schema, s.key)),
    })),
    // "Which buttons this status can press" is not a separate list. It is the edges in this table whose from equals that status and that are not internal.
    // A separate list would put the same fact in the same document twice, and the two copies would eventually evolve apart.
    transitions: some(schema.lifecycle.transitions.map((t): CatalogTransition => compact<CatalogTransition>({
      code: t.code,
      action: t.action,
      from: t.from,
      to: t.to,
      alsoFrom: some(transitionEdges(schema, t.code).filter((other) => other.from !== t.from).map((other) => other.from)),
      internal: on(t.internal === true),
      postsToLedger: some(t.effects.map(effectText)),
      // The ledger posts and reverses by action code. Count each action once. Do not repeat it per origin.
      reverses: some(effectDeclarations(schema).flatMap((other) =>
        other.effects
          .filter((e) => e.reverseOn.includes(t.code))
          .map((e) => `${other.code}'s ${e.target} ${e.op}`),
      )),
      push: t.push === null ? undefined : compact<NonNullable<CatalogTransition["push"]>>({
        module: t.push,
        line: t.pushLine ?? undefined,
      }),
      expandsBills: on(t.expandsBills),
      // Go through `resolvePreconditions`. What must be said is which gates this edge actually passes, and an exit edge inherits
      // the origin edge's gates. Filtering locally would drop the inherited ones, and modeling from that would treat the exception edge as bare.
      // Go through `gateOf` (the same construction point as `compileOperations` and the permission projection). Gate text has one copy.
      //
      // Do not emit `why`. It is written character for character on that precondition in the module declaration, and `inheritedFrom`
      // already says which edge it lives on. Reading the source is free. A copy would only drift.
      guards: some(resolvePreconditions(schema, t.code).map(({ rule: p, inheritedFrom }) => {
        const gate = gateOf(p, null, fieldLabelsOf(schema, t));
        return compact<CatalogGuard>({ id: gate.id, level: gate.level, rule: gate.rule, inheritedFrom: text(inheritedFrom) });
      })),
    }))),
    references: some(relations.outbound.map((r) => relationOf(r, r.to, labelOf(r.to)))),
    referencedBy: some(relations.inbound.map((r) => relationOf(r, r.from, r.fromLabel))),
  });
}

// ---------------------------------------------------------------------------
// Repo-level listing
// ---------------------------------------------------------------------------

function cardOf(module: OverviewModule, labelOf: (code: string) => string): CatalogModuleCard {
  return compact<CatalogModuleCard>({
    module: module.module,
    label: module.label,
    file: module.file,
    kind: module.kind,
    manual: module.creation.manual,
    pushedFrom: some(module.creation.generatedBy.map((origin) => ({
      module: origin.module,
      label: labelOf(origin.module),
      transition: origin.transition,
      action: origin.action,
    }))),
    postsToLedger: some(module.effects),
    dependencies: some(module.dependencies),
    capabilities: some(module.capabilities),
    escapeHatch: on(module.escapeHatch),
  });
}

function flowsOf(overview: SystemOverview): readonly CatalogFlow[] | undefined {
  return some(overview.flows.map((flow): CatalogFlow => compact<CatalogFlow>({
    kind: flow.kind,
    from: flow.source.module,
    fromTable: text(flow.source.table),
    to: flow.target.kind === "module" ? flow.target.module : undefined,
    toPath: flow.target.kind === "module" ? text(flow.target.path) : undefined,
    transition: text(flow.transition),
    label: flow.label,
    sourceStatuses: flow.sourceStatuses === null ? undefined : some(flow.sourceStatuses),
    remaining: on(flow.remaining),
  })));
}

function bindingsOf(overview: SystemOverview): readonly CatalogBinding[] | undefined {
  return some(overview.bindings.map((binding): CatalogBinding => compact<CatalogBinding>({
    kind: binding.kind,
    from: binding.source.module,
    fromPath: text(binding.source.path),
    to: binding.target.module,
    toPath: binding.target.path,
    selectable: binding.selectable === false ? false : undefined,
  })));
}

function domainsOf(
  overview: SystemOverview,
  labelOf: (code: string) => string,
  keep?: ReadonlySet<string>,
): readonly CatalogDomain[] {
  return overview.domains.flatMap((domain): readonly CatalogDomain[] => {
    const modules = domain.modules
      .filter((m) => keep === undefined || keep.has(m.module))
      .map((m) => cardOf(m, labelOf));
    if (keep !== undefined && modules.length === 0) return [];
    return [{ domain: domain.domain, label: domain.label, kind: domain.kind, modules }];
  });
}

function listing(loaded: Catalog, selector: Exclude<CatalogSelector, { kind: "module" }>): CatalogListing {
  // A push source's module name has to be sayable in the domain's own label. Under a `--domain` slice that source module may not be in the slice at all,
  // so the label is looked up on the whole catalog, not inside the current slice.
  const labelOf = (code: string): string => {
    const found = loaded.modules.get(code);
    if (!found) throw new Error(`catalog: module table has no "${code}"`);
    return found.schema.label;
  };

  if (selector.kind === "need") {
    // The capability vocabulary is closed. An unknown feature fails immediately (the same criterion as in `findMaterials`).
    // A full match and a partial match stay separate. A near match presented as a sample produces a module that is missing capabilities.
    const result = findMaterials(materialCards(loaded), selector.need);
    const overview = systemOverview(loaded);
    const byCode = new Map(overview.domains.flatMap((d) => d.modules).map((m) => [m.module, m]));
    const cardFor = (code: string): OverviewModule => {
      const found = byCode.get(code);
      if (!found) throw new Error(`catalog: module table has no "${code}"`);
      return found;
    };
    return compact<CatalogListing>({
      scope: { need: result.required },
      domains: domainsOf(overview, labelOf, new Set(result.exact.map((c) => c.code))),
      partial: some(result.partial.map((candidate) => ({
        ...cardOf(cardFor(candidate.code), labelOf),
        matched: candidate.matched,
        missing: candidate.missing,
      }))),
      coverage: result.coverage.length === 0
        ? undefined
        : Object.fromEntries(result.coverage.map((entry) => [entry.feature, entry.candidates])),
      uncovered: some(result.uncovered),
    });
  }

  const overview = systemOverview(loaded, {
    domain: selector.kind === "domain" ? selector.domain : null,
    around: selector.kind === "around" ? selector.around : null,
  });
  return compact<CatalogListing>({
    scope: selector.kind === "repo"
      ? undefined
      : selector.kind === "domain"
        ? { domain: selector.domain }
        : { around: selector.around },
    domains: domainsOf(overview, labelOf),
    flows: flowsOf(overview),
    bindings: bindingsOf(overview),
  });
}

/**
 * The only entry. It always returns a structured result. Rendering is only `JSON.stringify`.
 *
 * Two shapes, split by `--module`. A result with a `module` key is a single-module contract. A result with a `domains` key is the listing.
 */
export async function catalog(domainsRoot: string, selector: CatalogSelector): Promise<CatalogResult> {
  const loaded = await loadCatalog({ domainsRoot });
  return selector.kind === "module" ? moduleContract(loaded, selector.module) : listing(loaded, selector);
}
