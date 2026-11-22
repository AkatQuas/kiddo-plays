// ---------------------------------------------------------------------------
// Operation surface — every executable operation derived from the schema, read and write
//
// This is not a seventh concept: module declarations have no `operations` key. Like
// `Query` and `CheckReport`, it is a runtime value type. It projects the six concepts
// into "what can be done to this module".
//
// -- Why it has to live here ------------------------------------------------
//
// One operation surface has three consumers:
//   · renderer  → buttons and pages
//   · agent     → the tool catalog the model can call
//   · HTTP      → the public routes
//
// The last generation already showed what happens when each writes its own copy:
// 33 hand-written business-verb tools in `server/tools.js`
// (create_production_order / dispatch_task / requisition_material …), plus two
// hand-written maps, `ACTION_TYPES` and `TOOL_ACTION_MAP`, stitching them back to
// the executor. Tool count grows with entities times actions. 42 entities produced
// 33 tools and still did not cover the surface — not because the list was unfinished,
// but because it cannot be finished. And the tool descriptions were prose written by
// people, while the gates live in the schema: what the model reads and what the
// system runs were not the same thing.
//
// That side had already gone halfway. `compileToolManifest()` in `server/edge-tools.js`
// turns each transition into a tool, and the `transition_status` description still says
// "for a declared module, prefer the per-edge tool". It stopped at two systems side by
// side, and only writes were derived. Reads were not derived at all.
//
// -- Shape of this file -----------------------------------------------------
//
// The operators are a fixed set. They do not grow with modules:
//   list / get / balance / explain / create / update / preview / execute / propose
// What is derived is the binding of those operators on a concrete module
// (`salesOrder.approve`), not a new implementation. That distinction is the cure for
// the last generation: those 33 hand-written tools each bypassed `transition_status`
// and wrote the database directly, so a map was required to stitch them back.
//
// That yields a strong property:
//   There is one copy of business capability. Channel policy does not live inside it.
//   People and agents can only call the operations projected here. Whether a channel
//   executes directly, proposes first, or forbids the call is decided by channel
//   policy. It cannot rewrite the operation contract. Otherwise every permission
//   change would recompile business capability, and the same transition would grow
//   into two different things at different entrances.
//
// Zero IO: this file only compiles declarations into descriptions. It executes nothing.
// ---------------------------------------------------------------------------

import { describeEffect } from "../schema/effects.js";
import { handoffsForTransition, type Handoff } from "../schema/handoff.js";
import type { EnumOption, Field } from "../schema/fields.js";
import { availableTransitions, deletableIn, editableFields, transitionEdges, visibleTransitions } from "./engine.js";
import { transitionActions, type Transition, type TransitionAction } from "../schema/lifecycle.js";
import type { ModuleSchema } from "../schema/module.js";
import { fieldLabelsOf } from "./labels.js";
import { resolvePreconditions, type Precondition } from "../schema/preconditions.js";
import { describeCheck, type FieldLabels } from "./primitives.js";
import {
  LINE_PATH_COMPARATORS,
  comparatorsFor,
  isQueryableType,
  linePathOf,
  platformQueryFields,
  type QueryComparator,
} from "../normalize/query.js";

/**
 * Fixed operators. The count does not depend on the number of modules — a hundred
 * more modules are still this same set.
 *
 * create / update / delete change recorded facts, execute walks the state machine,
 * and propose is an optional governance mode of the same execute. The three cannot
 * hide in the HTTP or agent catalog, or operation search and real capability split
 * into two sources of truth.
 */
export const OPERATORS = [
  "list",
  "get",
  "ledger",
  "explain",
  "create",
  "update",
  "delete",
  "preview",
  "execute",
  "propose",
] as const;
export type Operator = (typeof OPERATORS)[number];

/** Reads never have side effects; writes change business facts. That split decides how audit is attached. */
export const OPERATOR_KIND: Readonly<Record<Operator, "read" | "write">> = Object.freeze({
  list: "read",
  get: "read",
  ledger: "read",
  explain: "read",
  create: "write",
  update: "write",
  delete: "write",
  preview: "read",
  execute: "write",
  propose: "write",
});

// -- Read: the list of queryable fields -------------------------------------

/**
 * One queryable field: name, type, which comparators it accepts, and enum candidates.
 *
 * This is the derivation of read operations. The previous generation gave the model
 * `query_data({ entity, status, keyword })` — filter by status and a full-text
 * keyword only. It could not answer "orders in East China last month over 50,000
 * that have not shipped yet", so the model had to keep trying.
 *
 * Once fields and comparators are listed, read tools collapse from "one tool per
 * each of 42 entities" into one `list` operator plus each module's own queryable-field list.
 */
export interface QueryableField {
  readonly field: string;
  readonly label: string;
  readonly type: string;
  readonly comparators: readonly QueryComparator[];
  /** Candidates for an enum; same shape as Field.options. Null otherwise. */
  readonly options: readonly EnumOption[] | null;
  /** Product dictionary code for tenant-level dynamic candidates. Null for a static enum or a non-enum. */
  readonly choiceSet: string | null;
  /** Entity a ref points at, used when loading candidates. Null otherwise. */
  readonly ref: string | null;
  /** Platform fields (status / createdBy …) are not declared in fields, but they are queryable. */
  readonly platform: boolean;
}

function queryableOf(field: Field): QueryableField | null {
  if (!isQueryableType(field.type)) return null;
  return {
    field: field.key,
    label: field.label,
    type: field.type,
    comparators: comparatorsFor(field.type, field.key),
    options: field.options,
    choiceSet: field.choiceSet,
    ref: field.ref,
    platform: false,
  };
}

/**
 * Every queryable field of a module.
 *
 * Derived fields (rollup / lookup) are in the list: they are legal query dimensions
 * ("orders whose shipped quantity is 0" is a real question). The executor compiles
 * them into a join or a subquery instead of an ordinary column.
 */
export function queryableFields(module: ModuleSchema): readonly QueryableField[] {
  const declared = module.fields.map(queryableOf).filter((f): f is QueryableField => f !== null);
  // Platform fields come from `platformQueryFields()`, the same list the panel gets.
  // This list used to be written three times, in the kernel, server, and web.
  // `updatedAt` existed on the agent side and not on the panel — the model could ask
  // a condition the user could not, and neither side reported an error.
  // Comparators are not hard-coded here either; they follow COMPARATORS_BY_TYPE by type.
  const platform = platformQueryFields(module.lifecycle.statuses).map(
    (f): QueryableField => ({
      field: f.key,
      label: f.label,
      type: f.type,
      comparators: comparatorsFor(f.type, f.key),
      options: f.options,
      choiceSet: null,
      ref: f.ref,
      platform: true,
    }),
  );
  return [...declared, ...lineQueryables(module), ...platform];
}

/**
 * The projection of line columns as query conditions.
 *
 * Leaving them out means the capability does not exist. `normalizeQuery` has always
 * accepted `lines.<column>` and compiled it into an `exists` subquery meaning
 * "some line matches" — while the tool catalog told the model "a field not on the
 * queryable list is rejected". That sentence was false on the line path, and neither
 * direction reported an error: the model would not send it, and if it did, it passed.
 * The criteria ERP cares about most naturally live on the line (planned arrival date,
 * quantity still to issue, rejected quantity), so a whole class of line-level threshold
 * queries vanished from the model's point of view.
 *
 * Comparators are the intersection of two gates, the same rule as the filter panel:
 * first by column type (`COMPARATORS_BY_TYPE`), then by the band the line path allows
 * (`LINE_PATH_COMPARATORS`; negation has no single reading at this layer).
 *
 * Skipping a column when the intersection is empty is forward insurance, not a branch
 * that fires today: every queryable type currently includes `eq`, and `eq` is on the
 * line allow-list, so the skip never runs. It stays because either table getting
 * narrower will make it live, and the correct behavior then is to omit the column.
 * Listing a candidate whose every comparator is unusable is more misleading than
 * omitting it. A test pins "this never fires today". Do not treat it as dead code
 * that can be deleted in passing.
 */
function lineQueryables(module: ModuleSchema): readonly QueryableField[] {
  const out: QueryableField[] = [];
  for (const table of module.fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    for (const column of table.fields) {
      if (!isQueryableType(column.type)) continue;
      const comparators = comparatorsFor(column.type, column.key).filter((op) =>
        LINE_PATH_COMPARATORS.includes(op),
      );
      if (!comparators.length) continue;
      out.push({
        field: linePathOf(table.key, column.key),
        // The label carries "line" and the child-table name: a module may have two
        // line tables, and both may have `qty`.
        label: `Line · ${table.label} · ${column.label}`,
        type: column.type,
        comparators,
        options: column.options,
        choiceSet: column.choiceSet,
        ref: column.ref,
        platform: false,
      });
    }
  }
  return out;
}

// -- Operation description --------------------------------------------------

export interface OperationParam {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  /** Entity a ref parameter points at, used when loading candidates. */
  readonly ref: string | null;
  /** Fixed values an enum parameter may take; same shape as Field.options. Always null for other types. */
  readonly options?: readonly EnumOption[] | null;
  /** Exact line shape of a billLines parameter. Always null for other types. */
  readonly lineField?: Field | null;
}

/**
 * How one gate looks on the operation contract.
 *
 * Only `gateOf` constructs it. There used to be two places (`edgeOperation` and a
 * fallback in the permission projection), and that fallback hard-coded `rule` to
 * "this involves data the current identity may not read". "The wiring did not line up"
 * and "you are not allowed to see this" became the same sentence, and the next action
 * for those two facts is opposite: the first is our omission, the second sends the
 * user to an administrator. The measured consequence: every gate in the HTTP
 * operations list, for every person (including a grantsAll admin), displayed that
 * permission sentence.
 */
export interface OperationGate {
  readonly id: string;
  readonly level: string;
  readonly rule: string;
  readonly why: string;
}

/** Which status this action starts from, and where it lands. The same action has one edge per status. */
export interface OperationMove {
  readonly from: string;
  readonly to: string;
}

/** Responsibility handoff produced after an operation runs. The triggering edge is already fixed by the operation, so it is not repeated. */
export type OperationHandoff = Pick<Handoff, "kind" | "to" | "title" | "due">;

/**
 * Whether an operation can be called as a set, and the transaction promise of that call.
 *
 * Batch is not a new business operator: it only changes how many items one call
 * contains. HTTP, Agent, and UI all project this contract. A channel may choose not
 * to present it, but it must not guess on its own whether the operation can be batched.
 */
export interface BatchOperationContract {
  /** The first stage accepts explicit items only. It does not accept a Query that rewrites the whole result set. */
  readonly selector: "explicit-items";
  /** Writes all succeed or all fail. A read-only preview finishes inside one repeatable-read snapshot. */
  readonly transaction: "atomic" | "snapshot";
  readonly maxItems: number;
}

/** Shared cap for interactive batch. Work larger than this should go to import / an async job. */
export const OPERATION_BATCH_MAX_ITEMS = 50;

/**
 * One resolved precondition, projected onto one cell of the operation contract.
 * The only construction site in the repo.
 *
 * `why` carries the inheritance source. When a rule this edge did not write blocks
 * the user, and the message does not say where it came from, the next step is to
 * edit a declaration that does not exist.
 */
export function gateOf(rule: Precondition, inheritedFrom: string | null, labels: FieldLabels): OperationGate {
  const what = rule.check ? describeCheck(rule.check, labels) : "(derived from an invariant)";
  return {
    id: rule.id,
    level: rule.level,
    // The condition band must be said in the contract. A gate that says "the parent
    // must be a factory" does not block a factory itself. If the contract does not
    // say it applies only when this is not a factory, a person thinks the gate is
    // broken, and the model explains "why it did not block" with a meaning that does
    // not hold. Same discipline as `related_agg.describe`, which must say whether the
    // current document is included.
    rule: rule.when === null ? what : `Only when ${describeCheck(rule.when, labels)}: ${what}`,
    why: inheritedFrom === null ? rule.why : `${rule.why} (inherited from "${inheritedFrom}")`,
  };
}

/**
 * The full description of one executable operation.
 *
 * Every field is generated from the declaration. None of the words are prose written
 * by a person. The previous generation's tool `desc` was hand-written, so the
 * description the model read and the rules the system actually ran evolved apart,
 * and nothing reported the drift.
 */
export interface OperationDescriptor {
  /** Globally unique: `salesOrder.approve` / `salesOrder.list` */
  readonly name: string;
  readonly module: string;
  readonly operator: Operator;
  readonly kind: "read" | "write";
  /** Action name shown to people, from `transition.action` or from the operator itself. */
  readonly label: string;
  readonly summary: string;
  readonly params: readonly OperationParam[];
  /** `null` means this operation is already a set operation, or it has no safe general batch meaning. */
  readonly batch: BatchOperationContract | null;

  // -- Set only on write operations (bound to an action) --
  /** Action code. The caller submits only this. The server resolves the edge from the document's current status. */
  readonly transition: string | null;
  /**
   * Which statuses this action can start from, and where each one lands. One action
   * is one operation; each start status of that action takes one item here. If the
   * current status is not among them, it cannot be done now (`operationsFor` trims on this).
   */
  readonly moves: readonly OperationMove[] | null;
  /** Plain-language preconditions. The model and the user see the same text (CheckList uses it too). */
  readonly gates: readonly OperationGate[];
  /** Which ledger entries this posts, in plain language. */
  readonly effects: readonly string[];
  /** Which downstream document this edge pushes when it finishes. */
  readonly push: string | null;
  /** Todos, notices, and reminders produced by the initial create status or by finishing this edge. */
  readonly handoffs: readonly OperationHandoff[];
}

function operationHandoffs(handoffs: readonly Handoff[]): readonly OperationHandoff[] {
  return handoffs.map(({ kind, to, title, due }) => ({ kind, to, title, due }));
}

const READ_SUMMARY: Readonly<Record<string, string>> = Object.freeze({
  list: "Query a list by conditions. Conditions use a structured condition tree. Queryable fields and comparators are in module_describe(query)",
  get: "Fetch one document by id, including line rows",
  explain: "Translate this module into plain language: fields, statuses, buttons, rules, postings, and handoffs",
  create: "Create one document from the module field contract and enter the initial status",
  update: "Save the header and line fields the current status allows to be edited",
  delete: "Delete a document that still allows full editing and has no historical facts or downstream references",
  preview: "Evaluate only, do not execute: whether this edge can be taken now, why, and what it would post",
});

const MODULE_OPERATION_LABEL: Readonly<Partial<Record<Operator, string>>> = Object.freeze({
  list: "Query",
  get: "View",
  explain: "Explain",
  create: "Create",
  update: "Update",
  delete: "Delete",
  preview: "Preview",
});

function paramsOf(edge: Pick<Transition, "params">): readonly OperationParam[] {
  return edge.params.map((p) => ({
    key: p.key,
    label: p.label,
    type: p.type,
    required: p.required,
    ref: p.ref,
    options: p.options,
    lineField: p.lineField,
  }));
}

/**
 * Compile one business action into one write operation. One code, one operation, not one edge.
 *
 * The name is `<module>.<action code>` — the same name, from the same source, as the
 * button in the UI. The same action has one edge per status. The caller never picks
 * an edge by status: it submits the code, and the server resolves it from the
 * document's current status. A catalog listed per edge would make the agent guess
 * which of several same-named operations matches the current status, which is
 * something the server already knows. When it runs, it goes through `preview → propose`,
 * not a second implementation.
 */
function actionOperation(module: ModuleSchema, action: TransitionAction): OperationDescriptor {
  const edges = transitionEdges(module, action.code);
  // Go through resolvePreconditions instead of filtering here. An exit edge inherits
  // the gates of the start edge. Missing that inheritance here means the contract the
  // agent sees is looser than the button a person sees. The person and the agent share
  // an operation contract only because both sides come from the same source.
  // Same name table as `evaluateTransition`: the rule text on the contract and the
  // error at execution must use the same word.
  const labels = fieldLabelsOf(module, action);
  const gates = resolvePreconditions(module, action.code).map(({ rule, inheritedFrom }) =>
    gateOf(rule, inheritedFrom, labels),
  );

  // Effects and push declarations are identical, word for word, on every edge of the
  // same action (`normalizeLifecycle` guarantees it). Any edge will do.
  const [head] = edges;
  if (head === undefined) throw new Error(`Action "${action.code}" on "${module.label}" has no edge`);
  const moves = edges.map((edge) => ({ from: edge.from, to: edge.to }));
  const effects = head.effects.map(describeEffect);
  const parts = [`Move ${module.label} ${moves.map((move) => `from "${move.from}" to "${move.to}"`).join(", ")}`];
  if (effects.length) parts.push(`Posts: ${effects.join("; ")}`);
  if (head.push) parts.push(`Pushes ${head.push}`);

  const handoffs = new Map<string, Handoff>();
  for (const edge of edges) {
    for (const handoff of handoffsForTransition(module.handoff, edge)) handoffs.set(handoff.id, handoff);
  }

  return {
    name: `${module.code}.${action.code}`,
    module: module.code,
    operator: "execute",
    kind: "write",
    label: action.action,
    summary: parts.join(". "),
    params: paramsOf(action),
    // One Planner execution is already an atomic plan across records. It cannot be
    // wrapped again as N plans inside an ordinary batch shell. Its set entrance is
    // the explicit batchActions workbench. Planner binds by action, and the edges agree.
    batch: edges.some((edge) => edge.expandsBills)
      ? null
      : { selector: "explicit-items", transaction: "atomic", maxItems: OPERATION_BATCH_MAX_ITEMS },
    transition: action.code,
    moves,
    gates,
    effects,
    push: head.push,
    handoffs: operationHandoffs([...handoffs.values()]),
  };
}

function moduleOperation(module: ModuleSchema, operator: Operator, params: readonly OperationParam[]): OperationDescriptor {
  const summary = READ_SUMMARY[operator];
  if (!summary) throw new Error(`Module operator "${operator}" has no summary — a new operator must be added to READ_SUMMARY`);
  const verb = MODULE_OPERATION_LABEL[operator];
  if (!verb) throw new Error(`Module operator "${operator}" has no action name`);
  return {
    name: `${module.code}.${operator}`,
    module: module.code,
    operator,
    kind: OPERATOR_KIND[operator],
    label: `${verb} ${module.label}`,
    summary: `${module.label}: ${summary}`,
    params,
    batch:
      operator === "get" || operator === "preview"
        ? { selector: "explicit-items", transaction: "snapshot", maxItems: OPERATION_BATCH_MAX_ITEMS }
        : operator === "create" || operator === "update" || operator === "delete"
          ? { selector: "explicit-items", transaction: "atomic", maxItems: OPERATION_BATCH_MAX_ITEMS }
          : null,
    transition: null,
    moves: null,
    gates: [],
    effects: [],
    push: null,
    handoffs: operator === "create"
      ? operationHandoffs(module.handoff.filter((handoff) =>
          handoff.onStatus === module.lifecycle.statuses.find((status) => status.initial)?.key
        ))
      : [],
  };
}

/**
 * Compile one module into all of its operations.
 *
 * This is the entrance of this file, and the place the sentence "the schema is the
 * source of the document" is kept: buttons in the UI, tools for the agent, and HTTP
 * routes all project from this one return value.
 */
export function compileOperations(module: ModuleSchema): readonly OperationDescriptor[] {
  // The label must say this is not the document number. Each list row returns both
  // `id` and `code`, and only id can locate the row. People and questions always say
  // the document number ("approve XS-20260705-0001"). Measured: the number was sent
  // as the id 12 times, and once the same number was tried across five modules.
  const idParam: OperationParam = {
    key: "id",
    label: "Internal document id (not the document number). If you have the number, use list and filter by code to get the id",
    type: "string",
    required: true,
    ref: null,
  };

  const moduleOperations: OperationDescriptor[] = [
    moduleOperation(module, "list", [
      { key: "query", label: "Query conditions (Query structure)", type: "object", required: false, ref: null },
    ]),
    moduleOperation(module, "get", [idParam]),
    moduleOperation(module, "explain", []),
    moduleOperation(module, "create", [
      { key: "header", label: "Header fields", type: "object", required: true, ref: null },
      { key: "lines", label: "Lines grouped by subtable field key", type: "object", required: false, ref: null },
    ]),
    moduleOperation(module, "update", [
      idParam,
      { key: "patch", label: "Header fields to change", type: "object", required: true, ref: null },
      { key: "lines", label: "Lines to replace as a whole. Omit to leave lines unchanged", type: "object", required: false, ref: null },
    ]),
    moduleOperation(module, "delete", [idParam]),
    moduleOperation(module, "preview", [
      idParam,
      { key: "transition", label: "Edge code", type: "string", required: true, ref: null },
      { key: "params", label: "Parameters this edge declares", type: "object", required: false, ref: null },
    ]),
  ];

  // One execute operation per action. propose is the governance mode of that operation; it does not copy the business action.
  const writes = transitionActions(module.lifecycle).map((action) => actionOperation(module, action));

  return [...moduleOperations, ...writes];
}

/**
 * Operations actually available in the current status.
 *
 * This is why the tool catalog does not have to be stuffed into context in full.
 * A sales order in "pendingReview" shows the agent three write operations —
 * approve, withdraw, and exception release — the same buttons a person sees,
 * because both compute the same `availableTransitions()`.
 *
 * Read operations are always available: a query changes nothing.
 */
export function operationsFor(
  module: ModuleSchema,
  status: string,
  bill?: {
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines?: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  },
): readonly OperationDescriptor[] {
  const all = compileOperations(module);
  const usable = new Set(
    (bill === undefined ? availableTransitions(module, status) : visibleTransitions(module, status, bill)).map(
      (t) => t.code,
    ),
  );
  const canUpdate = editableFields(module, status).length > 0;
  const canDelete = deletableIn(module, status);
  return all.filter((op) => {
    if (op.transition !== null) return usable.has(op.transition);
    if (op.operator === "create") return false;
    if (op.operator === "update") return canUpdate;
    if (op.operator === "delete") return canDelete;
    return true;
  });
}

// -- Search: keep the tool catalog out of context ---------------------------
//
// Trimming by status only solves the current screen (a pending-review order, and
// the agent sees three buttons). It does not solve module growth: 100 modules times
// 10 edges each is 1000 operations. The names alone fill the context, and at any
// moment the agent needs only a few of them.
//
// The fix is to make "find a tool" itself a tool. Only four search meta-tools stay
// resident in context. Concrete operations are looked up when they are used. That
// also decouples catalog size from context cost — at a thousand modules, the
// resident part is still those four.

/** One search hit. Deliberately only enough to judge "is this the one I want". Details go through describe. */
export interface OperationIndexEntry {
  readonly name: string;
  readonly module: string;
  readonly moduleLabel: string;
  readonly kind: "read" | "write";
  readonly label: string;
  readonly summary: string;
}

/** Build the index. Zero IO — the caller passes the module table in. */
export function buildOperationIndex(modules: readonly ModuleSchema[]): readonly OperationIndexEntry[] {
  return modules.flatMap((m) =>
    compileOperations(m).map((op) => ({
      name: op.name,
      module: m.code,
      moduleLabel: m.label,
      kind: op.kind,
      label: op.label,
      summary: op.summary,
    })),
  );
}

/**
 * Search operations.
 *
 * The match surface deliberately includes the human label: the model and people say
 * "approve the sales order", not `salesOrder.approve`. Search that matches only the
 * code is no search in a business conversation.
 *
 * No hits returns an empty array — there is no fuzzy fallback. Returning a pile of
 * unrelated operations is worse than returning empty: the model will pick one that
 * looks close and call it, and that may be a write on another module.
 */
/**
 * Search operations.
 *
 * `module` is not an optional filter. It is the only narrowing axis.
 *
 * The caller holds two conditions at once — a business concept ("void") and a
 * module (production task) — and there used to be only one string slot to express
 * them. So it concatenated both and sent "void the production task". Substring
 * match on a concatenated phrase is a shape that must miss: no operation name
 * contains that whole phrase.
 *
 * That chain was reproduced in full: "void" (6 hits, scattered across modules) →
 * "void the production task" (0) → "reverse the production task" (0) →
 * "undo the production task" (0) → and finally a search by module code.
 * 15 of 184 questions spun like that, 56 calls in all. The search did not fail to
 * find them. It found too many and had no way to narrow.
 *
 * A synonym table does not fix this: those words already hit (void 6 / reverse 17 /
 * return 15 / dispatch 14 / cancel 20). What was missing is the dimension "on which
 * module". And `module` is exactly the narrowing axis this tool surface already
 * shares — every tool has it — so the caller does not learn something new.
 */
export function searchOperations(
  index: readonly OperationIndexEntry[],
  keyword: string,
  limit = 20,
  module: string | null = null,
): readonly OperationIndexEntry[] {
  const normalize = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      // Fold create / update / review / query synonyms on both the keyword and the
      // indexed text, so a Chinese or English variant meets the same verb.
      .replace(/\u65b0\u589e|\u65b0\u5efa|\u5f55\u5165|\u521b\u5efa/g, "create")
      .replace(/\u7f16\u8f91|\u4fdd\u5b58|\u7ef4\u62a4|\u53d8\u66f4|\u4fee\u6539/g, "update")
      .replace(/\u5ba1\u6279|\u5ba1\u6838/g, "review")
      .replace(/\u67e5\u4e00\u4e0b|\u67e5\u627e|\u68c0\u7d22|\u67e5\u8be2/g, "query")
      .replace(/[\s\uff0c\u3002\uff1b\uff1a\u3001/]+/g, "");
  // Filter by module first. It is an exact match, not a fuzzy one. If the narrowing
  // axis were fuzzy too, two fuzzy layers stacked together would leave nobody able
  // to say why a row did not come out.
  const scoped = module === null ? index : index.filter((e) => e.module === module);
  const kw = normalize(keyword);
  if (!kw) return scoped.slice(0, limit);
  const hit = (e: OperationIndexEntry): boolean => {
    const text = normalize([e.name, e.module, e.moduleLabel, e.label, e.summary].join(" "));
    return text.includes(kw);
  };
  return scoped.filter(hit).slice(0, limit);
}

/** Full contract for one operation. Throws if it is missing, and lists alternatives — does not return null for each caller to paper over. */
export function describeOperation(
  modules: readonly ModuleSchema[],
  name: string,
): OperationDescriptor {
  for (const m of modules) {
    const hit = compileOperations(m).find((op) => op.name === name);
    if (hit) return hit;
  }
  throw new Error(`Unknown operation "${name}" — search with ops.search first; do not guess the name`);
}

// -- Operators that cross modules -------------------------------------------

/**
 * Operators that are not bound to a concrete module.
 *
 * `balance` stands alone here because a balance belongs to no module — it is an
 * aggregate of the ledger, and the ledger crosses documents. Hanging it on some
 * module immediately produces odd questions such as "the inventory balance of a sales order".
 */
export const GLOBAL_OPERATIONS: readonly OperationDescriptor[] = Object.freeze([
  {
    name: "ops.search",
    module: "",
    operator: "list" as const,
    kind: "read" as const,
    label: "Search operations",
    summary:
      "Find operations by keyword (action names and module names are searchable, including Chinese). **Search before you call** — " +
      "the operation catalog is not in context, and guessing a name hits an operation that does not exist. " +
      "If you already know the module, pass module to narrow. **Do not paste the module name into keyword** — " +
      "that is a substring match, and a concatenated phrase always misses",
    params: [
      { key: "keyword", label: "Keyword, such as approve, issue, or void. Write only the concept; narrow the module with module", type: "string", required: true, ref: null },
      { key: "module", label: "Search only on this module. The module id comes from the module field returned by modules_search", type: "string", required: false, ref: null },
      { key: "limit", label: "Maximum number of hits to return", type: "number", required: false, ref: null },
    ],
    batch: null,
    transition: null,
    moves: null,
    gates: [],
    effects: [],
    push: null,
    handoffs: [],
  },
  {
    name: "ops.describe",
    module: "",
    operator: "explain" as const,
    kind: "read" as const,
    label: "Read the operation contract",
    summary:
      "Fetch the full contract of one operation: parameters, preconditions, statuses, postings, push, and responsibility handoffs. " +
      "A write **must be read before it is called** — parameters and gates come from here, not from a guess",
    params: [{ key: "name", label: "Operation name, such as salesOrder.approve", type: "string", required: true, ref: null }],
    batch: null,
    transition: null,
    moves: null,
    gates: [],
    effects: [],
    push: null,
    handoffs: [],
  },
  {
    name: "modules.search",
    module: "",
    operator: "list" as const,
    kind: "read" as const,
    label: "Search modules",
    summary:
      "Search modules the current identity can read or create by hand, using the user's original business wording, and return at most 5 location candidates. " +
      "This narrows candidates. It is not the only judgment. No sufficient match returns an empty array. " +
      "After you have candidates, call module_describe as needed. Do not treat search results as a status or a query condition.",
    params: [
      {
        key: "query",
        label: "The user's original business wording, such as purchase work the supplier has not been paid for",
        type: "string",
        required: true,
        ref: null,
      },
    ],
    batch: null,
    transition: null,
    moves: null,
    gates: [],
    effects: [],
    push: null,
    handoffs: [],
  },
  {
    name: "ledger.query",
    module: "",
    operator: "ledger" as const,
    kind: "read" as const,
    label: "Query the ledger",
    summary:
      "Read the ledger. **The books have no second source** — there is no balance table and no balance column. A balance is the sum of the ledger, " +
      "so the return value of this operator is the books themselves. " +
      "`mode=aggregate` groups by dimension and evaluates (`fn=net` is the balance meaning: reserve/in are positive, release/out are negative); " +
      "`mode=rows` lists the journal lines. " +
      "A question one grouping can answer should not be looked up subject by subject — that splits one aggregate into N round trips",
    params: [
      { key: "target", label: "Ledger (stock/ar/ap/gl)", type: "string", required: true, ref: null },
      { key: "mode", label: "aggregate = group and evaluate, rows = list journal lines. Required, no default", type: "string", required: true, ref: null },
      { key: "where", label: "Filter: subjectId / scopeId / op / sourceModule / transitionCode / occurredFrom / occurredTo / postingPeriod", type: "string", required: false, ref: null },
      { key: "groupBy", label: "aggregate only: group dimensions, taken from the ledger's own columns", type: "string", required: false, ref: null },
      { key: "measures", label: "aggregate only: measures. fn is net / sum / count / last_occurred_at", type: "string", required: false, ref: null },
      { key: "limit", label: "Rows per page", type: "number", required: false, ref: null },
      { key: "offset", label: "Page start", type: "number", required: false, ref: null },
    ],
    batch: null,
    transition: null,
    moves: null,
    gates: [],
    effects: [],
    push: null,
    handoffs: [],
  },
]);
