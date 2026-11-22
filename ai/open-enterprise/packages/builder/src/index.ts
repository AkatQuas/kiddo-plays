// ---------------------------------------------------------------------------
// Builder implementation, separate from the CLI shell so tests and agents can call it directly
//
// Every entry returns a structured result. The shell serializes it.
// The boundary exists for a coding agent: `yarn catalog` output has to be consumed by a program,
// not parsed with a regex out of a report laid out for a person.
//
// `validate` / `genDbDrift` are functions here, with no matching CLI command.
// They are gates. The only entry to a gate is `yarn test` (`test/gate.test.ts`).
// A command that a person has to remember to run is a path on which the gate can be skipped.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  checkCreatePaths,
  checkCrossReferences,
  loadCatalog,
  requireModule,
  type CreatePathError,
  type CrossRefError,
} from "@open-erp/loader";
import { genDb } from "./codegen.js";
import { hatchesOf } from "./hatchesGen.js";
import {
  isRefFilterRef,
  supplyOf,
  validateModule,
  type Field,
  type ModuleSchema,
  type ValidationError,
} from "@open-erp/metamodel";

export interface ValidateResult {
  readonly ok: boolean;
  readonly moduleCount: number;
  readonly domains: readonly string[];
  readonly perModule: readonly { readonly code: string; readonly errors: readonly ValidationError[] }[];
  readonly crossRefs: readonly CrossRefError[];
  /**
   * Modules with no creation path (a person cannot create one, and nothing pushes one).
   *
   * This is an error, not a pressure table. Deliberately unlike the escape-hatch list: an escape hatch is legal usage of a mechanism,
   * while a module that cannot produce data shows up in the UI as a required field that cannot be filled.
   */
  readonly createPaths: readonly CreatePathError[];
  /**
   * Modules that use an escape hatch (directory form).
   *
   * Not an error. A pressure table, reported so it stays countable. Zero tolerance pushes the pressure somewhere worse
   * (odd keys stuffed into the schema, per-module branches in the renderer). A countable scale is what makes growth visible.
   * The same kind of escape hatch appearing at least twice should move up into a shared part or a schema capability.
   */
  readonly escapeHatches: readonly { readonly code: string; readonly file: string }[];
  /**
   * Read-only query surfaces. Not an error. A pressure table — each new one needs an explicit decision.
   * Daily reports and the product archive are still handwritten gaps. Do not pretend they have been absorbed.
   */
  readonly surfaces: readonly { readonly code: string; readonly file: string; readonly domain: string }[];
  /**
   * Cross-domain declared aggregates. Not an error. A pressure table — one more needs an explicit decision.
   * Count only entries under `insights/`. Cells must not be merged first.
   */
  readonly insights: readonly { readonly code: string; readonly file: string }[];
  /**
   * Cells whose entry order sits ahead of a candidate dependency (see `formCandidateOrderDrift`).
   *
   * This is an error, not a pressure table. When a candidate cannot read the upstream value it fail-closes by design (empty set plus `pending`),
   * so a reversed order produces zero errors. The user reads a grammatically perfect "fill in X first".
   */
  readonly formOrder: readonly FormOrderError[];
}

/** One place where entry order is before candidate-dependency order. `path` is a header field name or `<line table>.<column>`. */
export interface FormOrderError {
  readonly module: string;
  readonly path: string;
  /** The dynamic operand inside the candidate filter, kept as `$bill.x` / `$line.x` */
  readonly depends: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Gate: form entry order is at or after candidate-dependency order
//
// This invariant has zero runtime symptoms today. When a dynamic operand of `refFilter` has no value, it fail-closes by design
// (empty set plus `pending`; AGENTS.md: return an empty set and say what is missing, never fall back to unfiltered) —
// that half is right. What is wrong is why the value is missing: the modeler put the consuming cell
// ahead of the cell that supplies the value, so a person filling top to bottom hits a permanently empty candidate list and reads
// a grammatically perfect "fill in X first". Nothing goes red.
//
// The same class was hit twice in practice (materialRequirement put the source BOM ahead of the production product,
// materialIssue put the production task ahead of the material requirement). AGENTS.md says a class that appears at least twice
// should move up into a platform capability, so it lives here and is judged once for the whole repo. It used to be one assertion in a domain test,
// which a new domain would not inherit.
// ---------------------------------------------------------------------------

/**
 * Which cell a person must touch first so this cell can have a value.
 *
 * Three tiers. The criterion is the one the kernel already has (`supplyOf`). Do not rewrite "what counts as system-supplied" here:
 *   · `refDefault` / `snapshot` — the value is brought along by a reference coordinate, and that cell is the entry point.
 *     `materialIssue.productionOrderId` is this tier: it is deliberately not on the form (a person only links
 *     the material requirement and the production task), and `refDefault` brings the value from the material requirement. That shape is legal.
 *     What must be judged is that the material requirement sits ahead of the production task.
 *   · Other system-supplied values (`auto` / `derive` / `lineAgg` / `refOwner`) — not decided by entry order. Return null.
 *   · Filled by the user — the cell itself.
 *
 * Recurse along `match` (with visited; cycles in the declaration are another gate's job), because the cell that brings the value may itself be brought along.
 */
function entrySourceOf(key: string, siblings: readonly Field[], seen: readonly string[] = []): string | null {
  if (seen.includes(key)) return null;
  const field = siblings.find((f) => f.key === key);
  // Platform fields (status / orgId …) have no entry cell and should not. A modeler cannot reorder them.
  if (!field) return null;
  if (field.refDefault) return entrySourceOf(field.refDefault.match, siblings, [...seen, key]);
  if (field.snapshot) return entrySourceOf(field.snapshot.match, siblings, [...seen, key]);
  return supplyOf(field, siblings) === null ? key : null;
}

/**
 * Judge the whole repo once: every cell's candidate dependency sits ahead of it.
 *
 * Each of the two coordinates has its own order. The header uses the flattened order of `views.form`. Line columns use that line table's column order
 * (the declaration order of `subtable.fields`, which is the order the renderer paints the header). When a line column references `$bill.x`,
 * compare that cell with the line table itself on `views.form` — a line table is one unit on the form.
 *
 * Skip a consuming cell that is not on the form. It has no entry order (filled by push, seed, or API).
 * This gate says nothing about it and must not be turned red in passing.
 */
export function formCandidateOrderDrift(schemas: readonly ModuleSchema[]): readonly FormOrderError[] {
  const out: FormOrderError[] = [];
  for (const schema of schemas) {
    const formOrder = schema.views.form.flatMap((section) => section.fields);
    const headerAt = (key: string): number => formOrder.indexOf(key);

    const judge = (
      path: string,
      depends: string,
      /** Position of the consumer on its own level */
      position: number,
      /** The level the dependency is looked up on */
      siblings: readonly Field[],
      at: (key: string) => number,
      /** Name of that level, used in the error message */
      where: string,
      /**
       * Where the dependency comes from. The two tiers have different symptoms and must not share wording:
       * a `filter` cell has a dropdown, and a reversed order means candidates stay empty; a `value` cell has no dropdown
       * (it is brought along and a person must not edit it), and a reversed order means it keeps showing "pending calculation".
       * Calling that "candidates stay empty" sends someone looking for a dropdown that does not exist.
       */
      kind: "filter" | "value",
    ): void => {
      const dep = depends.slice(depends.indexOf(".") + 1);
      const source = entrySourceOf(dep, siblings);
      if (source === null) return; // system-supplied / platform field: entry order does not govern it
      const sourceAt = at(source);
      const via = source === dep ? `"${dep}"` : `"${dep}" (brought along by "${source}")`;
      const what = kind === "filter" ? "candidates" : "value";
      const symptom =
        kind === "filter"
          ? "candidates stay empty (fail-closed, no error)"
          : 'this cell keeps showing "pending calculation", which reads as "this field was never built"';
      if (sourceAt < 0) {
        out.push({
          module: schema.code,
          path,
          depends,
          message:
            `${schema.code}.${path}: ${what} depend on ${via}, and ${where} does not contain it — ` +
            (kind === "filter"
              ? "candidates stay empty, and the UI asks the user to fill a field that is not on the screen"
              : "this cell can never be filled, and the screen has no entry that can fill it"),
        });
        return;
      }
      if (sourceAt > position) {
        out.push({
          module: schema.code,
          path,
          depends,
          message:
            `${schema.code}.${path}: ${what} depend on ${via}, but in ${where} it is placed after this cell — ` +
            `a person filling top to bottom hits this cell while ${symptom}`,
        });
      }
    };

    const scan = (
      fields: readonly Field[],
      table: string | null,
      position: (key: string) => number,
    ): void => {
      for (const field of fields) {
        if (field.type === "subtable") continue;
        const path = table === null ? field.key : `${table}.${field.key}`;
        const self = position(field.key);
        if (self < 0) continue;
        // The cell that brings a value must also sit after its source — the same invariant as refFilter below,
        // with a different origin. refFilter says which candidates this cell can choose. snapshot / refDefault says
        // where this cell's value comes from. A reversed order has the same symptom: zero runtime errors.
        // A person filling top to bottom sees "pending calculation" on this cell, and the cell that would give it a value is below it.
        //
        // Hit in practice: `purchaseInvoice.views.form` placed `supplierId` (snapshot ← statementId)
        // ahead of `statementId`. The bring-along mechanism itself is fine — the supplier fills in the moment a statement is chosen —
        // but in reading order a person first sees an empty supplier, which reads as "this field was never built".
        //
        // A cell that is not on the form is a legal shape (`self < 0` above already skips it).
        // `materialIssue.productionOrderId` is that tier: refDefault brings the value, and a person never touches it.
        const broughtFrom = field.snapshot?.match ?? field.refDefault?.match ?? null;
        if (broughtFrom !== null) {
          if (table === null) {
            judge(path, `$bill.${broughtFrom}`, self, schema.fields, headerAt, "the form", "value");
          } else {
            // A line column's source is on the same row (`snapshot.match` / `refDefault.match` is a column of this row),
            // so compare this line table's own column order, the same branch as `$line.`
            judge(path, `$line.${broughtFrom}`, self, fields, position, "this line table's column order", "value");
          }
        }
        for (const operand of Object.values(field.refFilter ?? {})) {
          if (!isRefFilterRef(operand)) continue;
          if (operand.from.startsWith("$line.")) {
            // A line column references another column of the same row: compare column order
            if (table === null) continue; // $line. on a header field is rejected by the declaration-time gate
            judge(path, operand.from, self, fields, position, "this line table's column order", "filter");
            continue;
          }
          // `$bill.` — the dependency lives on the header. A line column's position becomes the position of this line table on the form.
          const consumerAt = table === null ? self : headerAt(table);
          judge(path, operand.from, consumerAt, schema.fields, headerAt, "the form", "filter");
        }
      }
    };

    scan(schema.fields, null, headerAt);
    for (const table of schema.fields) {
      if (table.type !== "subtable") continue;
      // The line table itself is not on the form, so its columns have no entry order either
      if (headerAt(table.key) < 0) continue;
      const columns = table.fields ?? [];
      const columnAt = (key: string): number => columns.findIndex((c) => c.key === key);
      scan(columns, table.key, columnAt);
    }
  }
  return out;
}

/**
 * Run every gate. Offline — no database and no running service.
 *
 * This is what a zero-IO kernel buys: an FDE edits a schema on a laptop and knows immediately whether it is right,
 * instead of pushing to an environment and waiting for the error.
 */
export async function validate(domainsRoot: string, only?: string): Promise<ValidateResult> {
  const catalog = await loadCatalog({ domainsRoot });
  const targets = only ? [requireModule(catalog, only)] : [...catalog.modules.values()];

  const perModule = targets.map((m) => ({ code: m.code, errors: validateModule(m.schema).errors }));
  // Both are cross-module criteria. They hold only with the whole catalog in hand, so they do not run for `only` (one module):
  // from a single module, "nobody pushes to it" is always true and would report every push target as unreachable
  const crossRefs = only ? [] : checkCrossReferences(catalog);
  const createPaths = only ? [] : checkCreatePaths(catalog);
  // A single-module criterion (a module's own views.form and its own fields), so it still runs for `only`
  const formOrder = formCandidateOrderDrift(targets.map((m) => m.schema));

  return {
    ok:
      perModule.every((m) => m.errors.length === 0) &&
      crossRefs.length === 0 &&
      createPaths.length === 0 &&
      formOrder.length === 0,
    moduleCount: catalog.modules.size,
    domains: catalog.domains.map((d) => d.code),
    perModule,
    crossRefs,
    createPaths,
    formOrder,
    ...hatchesOf(catalog),
  };
}

/**
 * Where the declaration and the table definitions already on disk differ. Returns the names of files that differ (empty means in sync).
 *
 * Does not write. What is wanted here is a criterion, not a side effect. Regenerating for them in passing
 * would hide the habit of changing a declaration without regenerating tables. On a path with no gate (running the service directly)
 * that is a "relation does not exist" — it runs fine on the machine that already has the table, and blows up in someone else's hands.
 */
export {
  ANALYSIS_CATALOG_BANNER,
  analysisCatalogDrift,
  genAnalysisCatalog,
  renderAnalysisCatalog,
  type AnalysisCatalogArtifact,
} from "./analysisCatalogGen.js";

export {
  HATCHES_BANNER,
  genHatches,
  hatchesDrift,
  hatchesOf,
  renderHatches,
  type HatchInsight,
  type HatchModule,
  type HatchSurface,
  type HatchesArtifact,
} from "./hatchesGen.js";

export { writeGeneratedTables } from "./codegen.js";

export async function genDbDrift(domainsRoot: string, outDir: string): Promise<readonly string[]> {
  const { files } = await genDb(domainsRoot);
  const drift: string[] = [];
  for (const file of files) {
    let actual: string | null;
    try {
      actual = await readFile(path.join(outDir, file.path), "utf8");
    } catch {
      actual = null;
    }
    if (actual !== file.content) drift.push(file.path);
  }
  return drift;
}

export {
  allTableComments,
  businessTableComments,
  FRAMEWORK_TABLE_COMMENTS,
  renderCommentSql,
  type ColumnComment,
  type TableComment,
} from "./dbComments.js";

export {
  assertChoiceSetIdentityEvolution,
  choiceSetIdentityManifest,
  renderChoiceSetIdentityManifest,
  type ChoiceSetIdentityManifest,
} from "./choiceSetIdentities.js";

export {
  catalog,
  type CatalogBinding,
  type CatalogDomain,
  type CatalogField,
  type CatalogFlow,
  type CatalogGuard,
  type CatalogListing,
  type CatalogModule,
  type CatalogModuleCard,
  type CatalogOrigin,
  type CatalogRelation,
  type CatalogRemedy,
  type CatalogResult,
  type CatalogSelector,
  type CatalogStatus,
  type CatalogTransition,
} from "./catalog.js";

export {
  MATERIAL_FEATURES,
  findMaterials,
  materialCards,
  type MaterialCandidate,
  type MaterialCard,
  type MaterialCoverage,
  type MaterialFeature,
  type MaterialFeatureDefinition,
  type MaterialQueryResult,
} from "./materials.js";

export {
  SYSTEM_OVERVIEW_WIRE_VERSION,
  systemOverview,
  type OverviewBinding,
  type OverviewDomain,
  type OverviewFlow,
  type OverviewModule,
  type OverviewOptions,
  type SystemOverview,
} from "./overview.js";

export {
  ACCEPTANCE_MANIFEST_VERSION,
  acceptanceFactsOf,
  acceptanceManifestOf,
  acceptanceObligationsOf,
  assertAcceptanceEvidence,
  type AcceptanceCategory,
  type AcceptanceFacts,
  type AcceptanceLayer,
  type AcceptanceManifest,
  type AcceptanceModuleFact,
  type AcceptanceObligation,
  type AcceptanceTransitionFact,
} from "./acceptance.js";
