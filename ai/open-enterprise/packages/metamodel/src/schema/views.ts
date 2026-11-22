// ---------------------------------------------------------------------------
// ⑥ ViewConfig — list and form presentation
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";

export interface ListView {
  readonly columns: readonly string[];
  /**
   * Which cells name a record inside a reference candidate. When omitted, it is derived from primary plus the readable fields at the front of the list;
   * master data that is easy to pick wrong, such as several specs of the same name, should declare the full identifying fields explicitly.
   */
  readonly referenceLabel?: readonly string[];
  /**
   * How several `referenceLabel` cells are joined. The default is one space.
   * Only a module that needs to be distinguished from a space writes it, for example a system account joins the person's name and the account name with "-".
   */
  readonly referenceLabelSeparator?: string;
  /** Fields used by the quick filter */
  readonly filters: readonly string[];
  readonly searchable: readonly string[];
  /**
   * The list's default order. The product catalog is uniformly `{ field: "createdAt", desc: true }`,
   * pinned by `packages/builder/test/gate.test.ts`. A fixture or a test may give another.
   */
  readonly defaultSort: { readonly field: string; readonly desc: boolean } | null;
  /**
   * Do not force a `status` column on the list. Default `false` — a document module shows status by default.
   *
   * 🔴 Switching status on master data (product / customer / supplier) is not a daily operation. The "enabled / disabled" column on the list
   * is low value to the user and also takes a column of width. After `hideStatus: true` is declared, `planListColumns` no longer inserts status
   * into the default columns; the full candidate set still keeps it (the user can turn it on in column settings).
   *
   * Compared with "write status in columns and then hide it in column settings": that leaves column settings always showing a row
   * of "status: hidden by default", and status still takes part in the default query projection — noise for master data.
   */
  readonly hideStatus: boolean;
  /**
   * Do not append the four audit columns (created by / created at / modified by / last modified at) to the list's default columns.
   * Default `false` — every defineModule document shows them by default.
   *
   * These four are framework audit fields, not business fields; `views.list.columns` writes only business columns,
   * and `planListColumns` appends them after the business columns. The full candidate set still keeps them (column settings can toggle them).
   */
  readonly hideAudit: boolean;
  /**
   * Which page the list entry uses. The default is the generic document list.
   *
   * `snapshot-history`: a read-only snapshot the system generates by day (daily-report management). The entry is a generate/view page,
   * not a document whose fields can be opened and edited.
   */
  readonly page?: "snapshot-history";
}

export interface Views {
  readonly list: ListView;
  /**
   * A business workbench is one fixed status slice of the same module list, protected by the declaration.
   *
   * It does not copy columns, filters, or actions: those still come from list and lifecycle. This only declares
   * "what this daily work is called, and which statuses belong to it". The fixed condition is ANDed with the user's query at runtime,
   * so the user cannot clear the filter and mix already-handled records back into the to-do workbench.
   */
  readonly workbenches: readonly WorkbenchView[];
  /** Form groups: one group is one card */
  readonly form: readonly { readonly title: string; readonly fields: readonly string[] }[];
  /**
   * An explicit entry that creates a draft of this module from records / lines selected on an upstream list.
   *
   * `path` is the source-reference coordinate on this module: a header `ref`, or a `refLine` inside a line table.
   * The source module is derived only from that field's `ref` and is not written a second time; with no declaration there is no entry, and the consumer
   * must not scan every relation and guess the first one.
   */
  readonly createFrom: readonly CreateFromView[];
  /** A declaration-driven entry for "attach an existing record to this record"; the field relationship is still checked by relationsOf. */
  readonly attachExisting: readonly AttachExistingView[];
  /** The hierarchy-maintenance projection of self-referencing master data; business constraints stay with the fields and the preconditions. */
  readonly hierarchy: HierarchyView | null;
  /**
   * Coordinates of the multi-level expansion panel on the detail page. The default `null` is the normal case.
   *
   * The structure it describes: one record of this module hangs a line table, each line points at an entity,
   * and that entity may have another record of this module (the header points at it) — so the structure nests.
   * A BOM is this shape: `bom.productId → product`, `bom.lines.componentProductId → product`,
   * a semi-finished product sits on both sides, the levels hold by this implicit chain, and the declaration has no `childBom` column.
   *
   * 🔴 It cannot be derived, so it must be declared (the same criterion as `availability`, appearing a second time):
   * the shape "one header ref plus one line column with the same target" occurs in more than one place in this repo
   * (a material requirement and a production task both look like this), and those two documents hold a result that is already expanded.
   * Drawing a tree for them is wrong. Which cell is the quantity, which cell is the loss, and which cell means "do not drill further when checked"
   * cannot be derived at all. The renderer, by the discipline "do not draw when there is no unique answer", would delete
   * exactly "the only place the whole tree can be seen before release".
   *
   * 🔴 It only states the coordinates. The criterion is the one copy in the kernel (`walkExplosion` in `derive/structure.ts`):
   * the material expansion at release and this panel walk the same function.
   * Writing each once shows up as "the panel computed 31.5 and the release picked 30", while both numbers call themselves the accumulated quantity.
   */
  readonly explosion: ExplosionView | null;
  /**
   * The three coordinates of the "current available quantity of this document's products" panel in the form's right column. The default `null` is the normal case.
   *
   * The renderer can already derive it from the declaration: the inventory ledger is posted on `product` and lands in `warehouse`
   * (the kernel `EFFECT_SUBJECT.stock`), so when the header has exactly one warehouse reference and exactly one product line column, no declaration is needed. This slot appears only when a unique answer cannot be derived —
   * a production order header has two warehouse references, "finished-goods warehouse" and "issue warehouse". The renderer, by the discipline
   * "several means do not guess, and prefer not to draw", draws nothing, and that is exactly the information most needed for "how much this document will produce".
   *
   * 🔴 It is a declaration, not a heuristic: it gives the renderer an answer for "which warehouse to compute by",
   * instead of letting it guess (pick the first / match by field name). A wrong guess shows up as a panel whose numbers are all correct
   * and whose question is wrong — the finished-goods warehouse has 40 and the issue warehouse's balance shows 0, and it looks completely normal.
   *
   * The three cells are: the warehouse reference on the header, the line table to look at, and the column on the line that points at the product.
   */
  readonly availability: AvailabilityView | null;
  /**
   * A composite archive: one parent archive writes several child archives in one pass (a product archive = a style plus SKUs).
   * Default `null`. packages execute only by parent/child code and do not hardcode a module name.
   */
  readonly composite: CompositeArchiveView | null;
}

export interface WorkbenchView {
  readonly code: string;
  readonly label: string;
  readonly statuses: readonly string[];
}

/**
 * The declared entry for "attach an existing record to this record". The detail page's RelatedSection and the list page's row-action area each consume one copy.
 *
 * 🔴 The only criterion is `hostFilterSatisfied`: the list page does not write a second "only a team can attach a person",
 *    and although the detail page has not switched to this predicate yet, the meaning is already aligned.
 */
export interface AttachExistingView {
  readonly path: string;
  readonly label: string;
  readonly targetLabel: string;
  readonly hostFilter: Readonly<Record<string, string>>;
}

/**
 * Whether the current host row satisfies the hostFilter declared by attachExisting.
 *
 * One pure predicate: the list page's row-action area and the detail page's RelatedSection answer the same sentence —
 * a criterion such as "only a team can attach a person" or "only active can attach" is said once, in this one function.
 * Any one that is not satisfied is false; when hostFilter is omitted it is treated as no filter (always true).
 *
 * 🔴 The caller must not write a hard criterion such as "orgType === 'team'": that would make the second
 *    attachExisting entry that appears in this repo (it really will) able only to copy and paste, and copy-paste is where drift starts.
 */
export function hostFilterSatisfied(
  declaration: AttachExistingView,
  host: Readonly<Record<string, unknown>>,
): boolean {
  const filter = declaration.hostFilter;
  if (filter === undefined) return true;
  for (const [key, expected] of Object.entries(filter)) {
    if (host[key] !== expected) return false;
  }
  return true;
}

/**
 * Split `path` (`worker.productionOrgId`) into the target module and the target field.
 *
 * After the list page's row-action area clicks "add an existing person", these two coordinates are used to render `AttachExistingDialog`;
 * the field relationship is still checked by `relationsOf`. This only splits the string. It does not judge semantics.
 */
export function parseAttachExistingPath(path: string): { readonly target: string; readonly field: string } {
  const dot = path.indexOf(".");
  if (dot <= 0 || dot >= path.length - 1) {
    throw new Error(`attachExisting.path "${path}" is not in "<target>.<field>" form`);
  }
  return { target: path.slice(0, dot), field: path.slice(dot + 1) };
}

export interface CreateFromView {
  readonly path: string;
  /** When omitted, the consumer generates the action copy from the target module label. */
  readonly label: string | null;
  /** Statuses in which the source document may enter this create flow; null means no restriction. */
  readonly sourceStatuses: readonly string[] | null;
  /**
   * The quantity coordinate the source can still push down. null means this flow has no quantity-balance meaning.
   *
   * line is the final authority: prepare and the final write gate accept only a source line that still has a positive remainder.
   * header is only an optional list-level preview; omit it when lines across products have no single unit that can be added,
   * and the source document can still enter prepare. The final conclusion is "whether a line with a positive remainder exists".
   */
  readonly sourceRemaining: { readonly header: string | null; readonly line: string } | null;
}

export interface HierarchyView {
  readonly parent: string;
  readonly level: string;
  readonly label: string;
}

/**
 * Coordinates of the multi-level expansion panel. None of the nine cells can be guessed — the reason for each is written below.
 *
 * Three cells may be `null`. Each means "this module does not have this tier", not "the renderer decides for itself".
 */
export interface ExplosionView {
  /** The `ref` on the header that points at the entity being expanded (BOM: `productId`) */
  readonly entity: string;
  /** The line table that carries the components (BOM: `lines`) */
  readonly lines: string;
  /** The `ref` on the line that points at the component entity. It must have the same target as `entity` — recursion holds because these two cells share a target */
  readonly component: string;
  /**
   * An optional explicit child-record reference on the line (drill across documents). `null` = this module does not expand along a cross-document chain
   * (a BOM now expresses levels with `parentLineNo` on the same document, and no longer pins a cross-document child version).
   */
  readonly childBom: string | null;
  /**
   * The line column that holds this level's quantity.
   *
   * 🔴 It must be the base-unit cell (BOM: `baseUnitQty`, not `unitQty`): when levels multiply,
   * each level's entry unit may differ, and multiplying the entered quantities multiplies "carton" into "piece",
   * while the computed number has a value, has decimals, and looks completely normal.
   */
  readonly qty: string;
  /** The line column that holds the loss rate (percent; compounded into the accumulated quantity at each level) */
  readonly loss: string;
  /** The line column that, when checked, stops further drilling (bool). `null` = this module does not have this tier */
  readonly stop: string | null;
  /** Which status counts as "in effect" — only a record in effect is treated as the next level */
  readonly activeStatus: string;
  /**
   * The cell (bool) preferred when the same entity has several records in effect, used as a tie-break.
   * `null` = no priority — the module uses `singleActiveWithin` to guarantee one record in effect at the same coordinate
   * (a BOM / a process route is like this), so the one that is found is that one, and no further ranking is needed.
   */
  readonly preferred: string | null;
  /** The cell that names a record on the tree (BOM: `version`). `null` = show only the primary-key code */
  readonly label: string | null;
}

export interface AvailabilityView {
  /** The scope reference on the header (inventory: the warehouse; it must ref the ledger's scope) */
  readonly scopeField: string;
  /** The line table to look at (the key of the subtable field) */
  readonly lines: string;
  /** The column on the line that points at the subject (inventory: the product; it must ref the ledger's subject) */
  readonly subjectField: string;
}

/**
 * A field-generation strategy.
 *
 * There is only one tier, `uuid`: the moment of generation is "the user did not give a real value" — the field is missing, `null`, an empty string,
 * or exactly equal to `placeholder` (the sentence "generated after save" on the form). A real value is kept as the user's.
 *
 * 🔴 `prefix` must come from the declaration: `PA-` is the basis of a product barcode. Writing it into the engine copies one domain's policy
 * into the framework, and when a second composite archive wants another prefix the only move is to change the framework.
 *
 * 🔴 Adding a tier (a sequence / a timestamp / copy from the parent) has to come in together with its consumer and its tests:
 * a value nobody uses gives the next person who copies it a silently wrong result, not an error.
 */
export type FieldGenerator = {
  readonly strategy: "uuid";
  readonly prefix: string;
  /** The sentence on the form that means "not generated yet". `null` = judge only by missing / empty string */
  readonly placeholder: string | null;
};

/**
 * Cooperative validation rules.
 *
 * - `requireTogether`: several fields must be filled together or empty together
 * - `pattern`: the field value must match a regular expression
 * - `uniqueChild`: a child-archive field is unique under the same parent archive
 *
 * 🔴 Same as above: adding a rule has to come in together with its consumer and its tests.
 */
export type CooperativeValidation =
  | { readonly rule: "requireTogether"; readonly fields: readonly string[]; readonly message: string }
  | { readonly rule: "pattern"; readonly field: string; readonly pattern: string; readonly message: string }
  | { readonly rule: "uniqueChild"; readonly field: string; readonly message: string };

/**
 * Composite-archive command declaration — lift business rules from code into the schema.
 *
 * 🔴 When it is needed: a parent archive and a child archive are saved together, and any of these holds:
 * - a child field is inherited from the parent
 * - a child field is generated (UUID / sequence / barcode)
 * - a field is frozen after creation (it cannot be changed once a child exists)
 * - a cooperative check across parent and child (filled together / uniqueness)
 *
 * 🔴 When it is not needed:
 * - a simple 1:N reference (no inheritance, no generation, no freeze)
 * - independent lifecycles (parent and child can be created separately)
 * - a many-to-many relationship (the middle table is not a "child archive")
 */
export interface CompositeArchiveCommands {
  /**
   * Inheritance rules for child fields.
   *
   * - `inherit`: fields inherited from the parent (simple inheritance: the value is the same)
   * - `frozen`: parent fields that cannot be changed once a child exists (unit, conversion rate, and so on)
   * - `own`: fields the child owns (not inherited from the parent)
   */
  readonly childInherits: {
    readonly inherit: readonly string[];
    readonly frozen: readonly string[];
    readonly own: readonly string[];
  };
  /**
   * Field generators: fill a field value automatically.
   *
   * The key is the field name, and the value is the generation strategy.
   */
  readonly generators: Readonly<Record<string, FieldGenerator>>;
  /**
   * Cooperative validation rules: business constraints across the parent and child archives.
   */
  readonly validations: readonly CooperativeValidation[];
  /**
   * Save-behavior configuration.
   */
  readonly saveOptions: {
    /** How many child archives are required at least. Default 1 */
    readonly minChildren: number;
  };
}

/** What the parent module declares: the child module, plus the ref field on the child that points at the parent. */
export interface CompositeArchiveView {
  readonly child: string;
  readonly parentField: string;
  /** Optional: the business-rule declaration. Default null means structure only, with no special logic */
  readonly commands: CompositeArchiveCommands | null;
}

export function compositeArchiveOf(views: Views): CompositeArchiveView | null {
  return views.composite;
}

const VIEWS_KEYS = [
  "list",
  "form",
  "workbenches",
  "createFrom",
  "attachExisting",
  "hierarchy",
  "availability",
  "explosion",
  "composite",
] as const;
/** Matches `ExplosionView` word for word: one cell more or one cell less must be changed in both places at once, and the closure gate rejects an unknown key from this */
const EXPLOSION_KEYS = [
  "entity",
  "lines",
  "component",
  "childBom",
  "qty",
  "loss",
  "stop",
  "activeStatus",
  "preferred",
  "label",
] as const;
const LIST_KEYS = ["columns", "referenceLabel", "referenceLabelSeparator", "filters", "searchable", "defaultSort", "hideStatus", "hideAudit", "page"] as const;

function normalizeList(raw: unknown, label: string): ListView {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, LIST_KEYS, label);

  const columns = requireArray(obj["columns"], `${label}.columns`).map((c, i) =>
    requireText(c, `${label}.columns[${i}]`),
  );
  if (!columns.length) schemaFail(`${label}.columns must not be empty — a list has to show something`);
  assertUniqueKeys(columns, `${label}.columns`);

  const referenceLabelRaw = obj["referenceLabel"];
  const referenceLabel = referenceLabelRaw === undefined || referenceLabelRaw === null
    ? undefined
    : requireArray(referenceLabelRaw, `${label}.referenceLabel`).map((field, index) =>
        requireText(field, `${label}.referenceLabel[${index}]`));
  if (referenceLabel !== undefined) {
    if (referenceLabel.length === 0) schemaFail(`${label}.referenceLabel must not be empty`);
    if (referenceLabel.length > 4) schemaFail(`${label}.referenceLabel is at most four cells, so a reference candidate does not become a long explanation`);
    assertUniqueKeys(referenceLabel, `${label}.referenceLabel`);
  }

  const separatorRaw = obj["referenceLabelSeparator"];
  let referenceLabelSeparator: string | undefined;
  if (separatorRaw !== undefined && separatorRaw !== null) {
    if (typeof separatorRaw !== "string" || separatorRaw.length < 1 || separatorRaw.length > 3) {
      schemaFail(`${label}.referenceLabelSeparator must be 1 to 3 characters, received ${JSON.stringify(separatorRaw)}`);
    }
    referenceLabelSeparator = separatorRaw;
  }

  const readList = (key: "filters" | "searchable"): readonly string[] => {
    const v = obj[key];
    if (v === undefined || v === null) return [];
    return requireArray(v, `${label}.${key}`).map((x, i) => requireText(x, `${label}.${key}[${i}]`));
  };

  const sortRaw = obj["defaultSort"];
  let defaultSort: ListView["defaultSort"] = null;
  if (sortRaw !== undefined && sortRaw !== null) {
    const s = requireObject(sortRaw, `${label}.defaultSort`);
    assertClosedKeys(s, ["field", "desc"], `${label}.defaultSort`);
    defaultSort = { field: requireText(s["field"], `${label}.defaultSort.field`), desc: s["desc"] === true };
  }

  const hideStatusRaw = obj["hideStatus"];
  if (hideStatusRaw !== undefined && typeof hideStatusRaw !== "boolean") {
    schemaFail(`${label}.hideStatus accepts only a boolean, received ${JSON.stringify(hideStatusRaw)}`);
  }
  const hideStatus = hideStatusRaw === true;
  const hideAuditRaw = obj["hideAudit"];
  if (hideAuditRaw !== undefined && typeof hideAuditRaw !== "boolean") {
    schemaFail(`${label}.hideAudit accepts only a boolean, received ${JSON.stringify(hideAuditRaw)}`);
  }
  const hideAudit = hideAuditRaw === true;
  const pageRaw = obj["page"];
  if (pageRaw !== undefined && pageRaw !== "snapshot-history") {
    schemaFail(`${label}.page accepts only snapshot-history, received ${JSON.stringify(pageRaw)}`);
  }

  return {
    columns,
    ...(referenceLabel === undefined ? {} : { referenceLabel }),
    ...(referenceLabelSeparator === undefined ? {} : { referenceLabelSeparator }),
    filters: readList("filters"),
    searchable: readList("searchable"),
    defaultSort,
    hideStatus,
    hideAudit,
    ...(pageRaw === "snapshot-history" ? { page: "snapshot-history" as const } : {}),
  };
}

export function normalizeViews(raw: unknown, label = "views"): Views {
  const obj = requireObject(raw, label);
  assertClosedKeys(obj, VIEWS_KEYS, label);

  const formRaw = obj["form"];
  const form =
    formRaw === undefined || formRaw === null
      ? []
      : requireArray(formRaw, `${label}.form`).map((g, i) => {
          const at = `${label}.form[${i}]`;
          const group = requireObject(g, at);
          assertClosedKeys(group, ["title", "fields"], at);
          const fields = requireArray(group["fields"], `${at}.fields`).map((f, j) =>
            requireText(f, `${at}.fields[${j}]`),
          );
          if (!fields.length) schemaFail(`${at}.fields must not be empty`);
          return { title: requireText(group["title"], `${at}.title`), fields };
        });

  const workbenchesRaw = obj["workbenches"];
  const workbenches = workbenchesRaw === undefined || workbenchesRaw === null
    ? []
    : requireArray(workbenchesRaw, `${label}.workbenches`).map((item, i) => {
        const at = `${label}.workbenches[${i}]`;
        const value = requireObject(item, at);
        assertClosedKeys(value, ["code", "label", "statuses"], at);
        const statuses = requireArray(value["statuses"], `${at}.statuses`).map((status, j) =>
          requireText(status, `${at}.statuses[${j}]`),
        );
        if (statuses.length === 0) schemaFail(`${at}.statuses must not be empty`);
        assertUniqueKeys(statuses, `${at}.statuses`);
        return {
          code: requireText(value["code"], `${at}.code`),
          label: requireText(value["label"], `${at}.label`),
          statuses,
        };
      });
  assertUniqueKeys(workbenches.map((item) => item.code), `${label}.workbenches.code`);

  const createFromRaw = obj["createFrom"];
  const createFrom =
    createFromRaw === undefined || createFromRaw === null
      ? []
      : requireArray(createFromRaw, `${label}.createFrom`).map((item, i) => {
          const at = `${label}.createFrom[${i}]`;
          const value = requireObject(item, at);
          assertClosedKeys(value, ["path", "label", "sourceStatuses", "sourceRemaining"], at);
          const customLabel = value["label"];
          const sourceStatusesRaw = value["sourceStatuses"];
          const sourceStatuses = sourceStatusesRaw === undefined || sourceStatusesRaw === null
            ? null
            : requireArray(sourceStatusesRaw, `${at}.sourceStatuses`).map((status, j) =>
                requireText(status, `${at}.sourceStatuses[${j}]`),
              );
          if (sourceStatuses !== null) {
            if (sourceStatuses.length === 0) schemaFail(`${at}.sourceStatuses must not be an empty array`);
            assertUniqueKeys(sourceStatuses, `${at}.sourceStatuses`);
          }
          const sourceRemainingRaw = value["sourceRemaining"];
          let sourceRemaining: CreateFromView["sourceRemaining"] = null;
          if (sourceRemainingRaw !== undefined && sourceRemainingRaw !== null) {
            const remaining = requireObject(sourceRemainingRaw, `${at}.sourceRemaining`);
            assertClosedKeys(remaining, ["header", "line"], `${at}.sourceRemaining`);
            const headerRaw = remaining["header"];
            sourceRemaining = {
              header:
                headerRaw === undefined || headerRaw === null
                  ? null
                  : requireText(headerRaw, `${at}.sourceRemaining.header`),
              line: requireText(remaining["line"], `${at}.sourceRemaining.line`),
            };
          }
          return {
            path: requireText(value["path"], `${at}.path`),
            label:
              customLabel === undefined || customLabel === null
                ? null
                : requireText(customLabel, `${at}.label`),
            sourceStatuses,
            sourceRemaining,
          };
        });
  assertUniqueKeys(createFrom.map((item) => item.path), `${label}.createFrom.path`);

  const attachRaw = obj["attachExisting"];
  const attachExisting = attachRaw === undefined || attachRaw === null
    ? []
    : requireArray(attachRaw, `${label}.attachExisting`).map((item, i) => {
        const at = `${label}.attachExisting[${i}]`;
        const value = requireObject(item, at);
        assertClosedKeys(value, ["path", "label", "targetLabel", "hostFilter"], at);
        const filter = requireObject(value["hostFilter"], `${at}.hostFilter`);
        const hostFilter: Record<string, string> = {};
        for (const [key, raw] of Object.entries(filter)) hostFilter[requireText(key, `${at}.hostFilter key`)] = requireText(raw, `${at}.hostFilter.${key}`);
        return {
          path: requireText(value["path"], `${at}.path`),
          label: requireText(value["label"], `${at}.label`),
          targetLabel: requireText(value["targetLabel"], `${at}.targetLabel`),
          hostFilter,
        };
      });
  assertUniqueKeys(attachExisting.map((item) => item.path), `${label}.attachExisting.path`);

  const hierarchyRaw = obj["hierarchy"];
  let hierarchy: HierarchyView | null = null;
  if (hierarchyRaw !== undefined && hierarchyRaw !== null) {
    const at = `${label}.hierarchy`;
    const value = requireObject(hierarchyRaw, at);
    assertClosedKeys(value, ["parent", "level", "label"], at);
    hierarchy = {
      parent: requireText(value["parent"], `${at}.parent`),
      level: requireText(value["level"], `${at}.level`),
      label: requireText(value["label"], `${at}.label`),
    };
  }

  const availabilityRaw = obj["availability"];
  let availability: AvailabilityView | null = null;
  if (availabilityRaw !== undefined && availabilityRaw !== null) {
    const at = `${label}.availability`;
    const value = requireObject(availabilityRaw, at);
    // All three cells are required, with no default: one missing cell would have to be guessed ("if there is only one line table, use that one"),
    // and the whole reason this slot exists is "do not guess when a unique answer cannot be derived"
    assertClosedKeys(value, ["scopeField", "lines", "subjectField"], at);
    availability = {
      scopeField: requireText(value["scopeField"], `${at}.scopeField`),
      lines: requireText(value["lines"], `${at}.lines`),
      subjectField: requireText(value["subjectField"], `${at}.subjectField`),
    };
  }

  const compositeRaw = obj["composite"];
  let composite: CompositeArchiveView | null = null;
  if (compositeRaw !== undefined && compositeRaw !== null) {
    const at = `${label}.composite`;
    const value = requireObject(compositeRaw, at);
    assertClosedKeys(value, ["child", "parentField", "commands"], at);

    let commands: CompositeArchiveCommands | null = null;
    const commandsRaw = value["commands"];
    if (commandsRaw !== undefined && commandsRaw !== null) {
      const cmdAt = `${at}.commands`;
      const cmd = requireObject(commandsRaw, cmdAt);
      assertClosedKeys(cmd, ["childInherits", "generators", "validations", "saveOptions"], cmdAt);

      // childInherits
      const inheritsAt = `${cmdAt}.childInherits`;
      const inherits = requireObject(cmd["childInherits"], inheritsAt);
      assertClosedKeys(inherits, ["inherit", "frozen", "own"], inheritsAt);
      const inherit = requireArray(inherits["inherit"] ?? [], `${inheritsAt}.inherit`).map((f, i) =>
        requireText(f, `${inheritsAt}.inherit[${i}]`),
      );
      const frozen = requireArray(inherits["frozen"] ?? [], `${inheritsAt}.frozen`).map((f, i) =>
        requireText(f, `${inheritsAt}.frozen[${i}]`),
      );
      const own = requireArray(inherits["own"] ?? [], `${inheritsAt}.own`).map((f, i) =>
        requireText(f, `${inheritsAt}.own[${i}]`),
      );

      // generators
      const generatorsAt = `${cmdAt}.generators`;
      const generatorsRaw = requireObject(cmd["generators"] ?? {}, generatorsAt);
      const generators: Record<string, FieldGenerator> = {};
      for (const [key, genRaw] of Object.entries(generatorsRaw)) {
        const genAt = `${generatorsAt}.${key}`;
        const gen = requireObject(genRaw, genAt);
        assertClosedKeys(gen, ["strategy", "prefix", "placeholder"], genAt);
        const strategy = requireText(gen["strategy"], `${genAt}.strategy`);
        if (strategy !== "uuid") {
          schemaFail(
            `${genAt}.strategy supports only uuid, received "${strategy}" — ` +
              `adding a tier has to come in together with its consumer and its tests. A value nobody uses gives the next person who copies it a silently wrong result`,
          );
        }
        const placeholderRaw = gen["placeholder"];
        if (placeholderRaw === undefined) {
          schemaFail(`${genAt}.placeholder is required: if there is no placeholder text, write null explicitly — omitting it and "there is none" are not the same sentence`);
        }
        generators[key] = {
          strategy: "uuid",
          prefix: requireText(gen["prefix"], `${genAt}.prefix`),
          placeholder: placeholderRaw === null ? null : requireText(placeholderRaw, `${genAt}.placeholder`),
        };
      }

      // validations
      const validationsAt = `${cmdAt}.validations`;
      const validationsRaw = requireArray(cmd["validations"] ?? [], validationsAt);
      const validations: CooperativeValidation[] = validationsRaw.map((valRaw, i) => {
        const valAt = `${validationsAt}[${i}]`;
        const val = requireObject(valRaw, valAt);
        const rule = requireText(val["rule"], `${valAt}.rule`);
        const message = requireText(val["message"], `${valAt}.message`);
        if (rule === "requireTogether") {
          const fields = requireArray(val["fields"], `${valAt}.fields`).map((f, j) =>
            requireText(f, `${valAt}.fields[${j}]`),
          );
          return { rule, fields, message };
        } else if (rule === "pattern") {
          return {
            rule,
            field: requireText(val["field"], `${valAt}.field`),
            pattern: requireText(val["pattern"], `${valAt}.pattern`),
            message,
          };
        } else if (rule === "uniqueChild") {
          return { rule, field: requireText(val["field"], `${valAt}.field`), message };
        } else {
          schemaFail(
            `${valAt}.rule does not support "${rule}" — allowed: requireTogether / pattern / uniqueChild. ` +
              `Adding one has to come in together with its consumer and its tests`,
          );
        }
      });

      // saveOptions
      const optionsAt = `${cmdAt}.saveOptions`;
      const options = requireObject(cmd["saveOptions"], optionsAt);
      assertClosedKeys(options, ["minChildren"], optionsAt);
      const minChildren = options["minChildren"];
      if (minChildren !== undefined && (typeof minChildren !== "number" || !Number.isInteger(minChildren) || minChildren < 0)) {
        schemaFail(`${optionsAt}.minChildren must be a non-negative integer`);
      }

      commands = {
        childInherits: { inherit, frozen, own },
        generators,
        validations,
        saveOptions: {
          minChildren: minChildren ?? 1,
        },
      };
    }

    composite = {
      child: requireText(value["child"], `${at}.child`),
      parentField: requireText(value["parentField"], `${at}.parentField`),
      commands,
    };
  }

  const explosionRaw = obj["explosion"];
  let explosion: ExplosionView | null = null;
  if (explosionRaw !== undefined && explosionRaw !== null) {
    const at = `${label}.explosion`;
    const value = requireObject(explosionRaw, at);
    assertClosedKeys(value, EXPLOSION_KEYS, at);
    // 🔴 Six cells are required and three are explicitly nullable: `null` on `stop` / `preferred` / `label` says
    // "this module does not have this tier". Making "omitted means none" would let a mistyped key name silently degrade into not having that tier,
    // and the consequence is a row that should have stopped at this layer keeps drilling, or one row is picked at random among several effective versions of the same entity — both with zero errors
    const optional = (key: "stop" | "preferred" | "label" | "childBom"): string | null => {
      const raw = value[key];
      if (raw === undefined) {
        schemaFail(`${at}.${key} is required: if this tier does not exist, write null explicitly — omitting it and "there is none" are not the same sentence`);
      }
      return raw === null ? null : requireText(raw, `${at}.${key}`);
    };
    explosion = {
      entity: requireText(value["entity"], `${at}.entity`),
      lines: requireText(value["lines"], `${at}.lines`),
      component: requireText(value["component"], `${at}.component`),
      childBom: optional("childBom"),
      qty: requireText(value["qty"], `${at}.qty`),
      loss: requireText(value["loss"], `${at}.loss`),
      stop: optional("stop"),
      activeStatus: requireText(value["activeStatus"], `${at}.activeStatus`),
      preferred: optional("preferred"),
      label: optional("label"),
    };
  }

  return {
    list: normalizeList(obj["list"], `${label}.list`),
    form,
    workbenches,
    createFrom,
    attachExisting,
    hierarchy,
    availability,
    composite,
    explosion,
  };
}
