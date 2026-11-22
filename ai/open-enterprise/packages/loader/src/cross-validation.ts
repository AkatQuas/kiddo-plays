import {
  hasColumn,
  hasEditableStatus,
  isPlatformField,
  isPublicPlatformField,
  PLATFORM_FIELD_TYPES,
  type PlatformField,
  isPushFillable,
  pushSourceTable,
  isPlannerSupplied,
  isSystemSupplied,
  PUBLIC_PLATFORM_FIELDS,
  enumOptionNeedsFacingLabel,
  enumOptionValues,
  hasEnumOption,
  isRefFilterRef,
  pushSourceField,
  keySpaceOf,
  keySpaceText,
  linesRequiredIfRefFieldOf,
  referenceComparisonOf,
  relatedAggKeyOf,
  relatedAggregationOf,
  sameKeySpace,
  snapshotSourceGuarantee,
  checkDependencies,
  REQUIRED_FIELDS_PRIMITIVE,
  enumCandidateSourceOf,
  enumCandidateSourceLabel,
  transitionActions,
  type Field,
  type ModuleSchema,
  type RefFilterOperand,
} from "@open-erp/metamodel";
import type { Catalog } from "./catalog.js";

export interface CrossRefError {
  readonly module: string;
  readonly path: string;
  readonly message: string;
}

/**
 * Fields of the layer a cross-module derive must read: an empty `through` is the header, otherwise the columns of that line table.
 *
 * Returns null when the target module does not exist (that case was already reported by the `derive.from` gate, and is not reported again).
 * When `through` names a field that does not exist or is not a line table, report it here — do not fall back to the header: falling back would turn a
 * mistyped `through` into a header rollup, and that number looks completely normal.
 */
function layerOf(
  target: { readonly schema: { readonly fields: readonly Field[] } } | undefined,
  through: string | null,
  at: string,
  add: (path: string, message: string) => void,
): readonly Field[] | null {
  if (!target) return null;
  if (through === null) return target.schema.fields;
  const table = target.schema.fields.find((f) => f.key === through);
  if (!table) {
    add(`${at}.through`, `the target module has no line table "${through}"`);
    return null;
  }
  if (table.type !== "subtable" || !table.fields) {
    add(`${at}.through`, `"${through}" is a ${table.type} field, not a line table — a row-level derive can drill only into a line table`);
    return null;
  }
  return table.fields;
}

/**
 * Why a field has no column — a derive-coordinate error must say whether "the field is not there at all" or
 * "it is there, but it does not land in a column". The two sentences point at completely different fixes (pick another field vs rewrite this measure),
 * and SQL compile time can only say "there is no corresponding column".
 *
 * The criterion is the kernel's `hasColumn` (shared by table build, seed, and write gates) — this layer does not restate "what counts as having a column".
 */
function noColumnReason(field: Field): string | null {
  if (hasColumn(field)) return null;
  if (field.type === "subtable") return "is a line table (a separate line table is built), not a column";
  return `is a ${field.derive?.kind ?? "derive"} derived field. It builds no column and is computed at query time — SQL has nothing of it to compare`;
}

/** Keys available on the target module header: declared fields that have a column, plus platform fields. An error gives the modeler a list of what is allowed. */
function headerKeysOf(target: { readonly schema: ModuleSchema }): string {
  const declared = target.schema.fields.filter(hasColumn).map((f) => f.key);
  return `${declared.join(", ")} (header fields); ${PUBLIC_PLATFORM_FIELDS.join(", ")} (platform fields)`;
}

/** Which line tables this key actually lives on — the most common wrong-layer shape is "it is on the line table". */
function lineTablesHolding(target: { readonly schema: ModuleSchema }, key: string): readonly string[] {
  return target.schema.fields
    .filter((f) => f.type === "subtable" && (f.fields ?? []).some((c) => c.key === key))
    .map((f) => f.key);
}

/**
 * Create-path gate — "is there any way for this module to produce a row of data".
 *
 * Same layer and the same entry as `checkCrossReferences` (`yarn test`). It is a separate function because
 * it answers not "does the reference resolve" but "can this document come into existence", and the error carries its own code.
 *
 * Any one of these passing is enough:
 *   · manually creatable — among the cells the user must fill on create, none is a type the renderer cannot supply
 *     (`ModuleSchema.creatable.manual`; the criterion is sealed in the one `NO_MANUAL_INPUT_TYPES`);
 *   · system-generated — `capabilities.create === "system"`. There is no manual form; a system job uses `createBill`.
 *   · creatable by push — some other module has an edge whose `push` targets it (`creatable.pushedFrom`);
 *   · creatable by picking a document — `views.createFrom` is non-empty: a person picks an upstream document/line and then generates. Purchase returns take this road.
 *   · written outside the module — manual create is blocked by a blocker, and `hasEditableStatus` is false:
 *     the bills engine has no write surface, and rows are produced by an out-of-module write path such as directory sync. This is not a module-code allow-list.
 *
 * When none of these hold, it is red, not a pressure gauge. The escape hatch's pinned list is a gauge for a legal mechanism;
 * a module nobody can create data in is a bug — it sits in the menu, has a list page, has a New button,
 * and opening it shows a required field the user can never fill. Save is always rejected by the value gate,
 * and nothing on the screen can say "this document does not come into being that way". So a known violation must not be pressed down with an allow-list.
 *
 * It can be checked only at this layer: `validateModule` looks at one module at a time and is structurally blind to "who pushes to me".
 */
export interface CreatePathError {
  readonly module: string;
  readonly code: "MODULE_NO_CREATE_PATH";
  readonly path: string;
  readonly message: string;
}

export function checkCreatePaths(catalog: Catalog): readonly CreatePathError[] {
  const errors: CreatePathError[] = [];
  for (const { code, schema } of catalog.modules.values()) {
    const { manual, blockers, pushedFrom } = schema.creatable;
    if (manual) continue;
    if (schema.capabilities.create === "system") continue;
    // null means withPushOrigins did not run during assembly. Treating it as "no push origin" would report an assembly bug
    // as a room full of unreachable modules, so say here which step was skipped.
    if (pushedFrom === null) {
      errors.push({
        module: code,
        code: "MODULE_NO_CREATE_PATH",
        path: "creatable.pushedFrom",
        message:
          `module "${code}" push origins have not been resolved yet (pushedFrom is null) — ` +
          `this module table did not go through loadCatalog's withPushOrigins assembly step, so the create path cannot be judged`,
      });
      continue;
    }
    if (pushedFrom.length > 0) continue;
    if (schema.views.createFrom.length > 0) continue;
    if (
      blockers.length > 0 &&
      schema.lifecycle.statuses.length > 0 &&
      !hasEditableStatus(schema)
    ) {
      continue;
    }
    errors.push({
      module: code,
      code: "MODULE_NO_CREATE_PATH",
      path: "creatable",
      message:
        `module "${code}" (${schema.label}) has no create path: ` +
        `it cannot be created by hand — ${blockers.map((b) => `"${b.path}" (${b.label}) ${b.why}`).join("; ")}; ` +
        `no module's transition.push points at it, there is no views.createFrom, ` +
        `and it is not an out-of-module write (every status editable none + a blocker). ` +
        `Four repairs: (1) in the real business an upstream document pushes it into being ⇒ add push: "${code}" on that edge; ` +
        `(2) in the real business a person first picks an upstream document/line and then generates ⇒ declare views.createFrom; ` +
        `(3) in the real business a person creates it by hand ⇒ what is missing is the candidate channel for a line-level reference. ` +
        `Fix those required constraints (reference the document rather than the line, or it should not have been required); ` +
        `(4) in the real business the row is produced by a write path outside bills ⇒ nobody supplies the required cells, and every status is editable none. ` +
        `Do not invent a push edge that does not exist in the business just to make this gate green, and do not press it down with an allow-list`,
    });
  }
  return errors;
}

/**
 * The five org-type codes (factory / workshop / line / team / function) are stable identities agreed across the repo.
 * The dictionary only owns extensibility and copy; a product declaration may narrow candidates / write gates to these five codes.
 * Other choiceSets still carry only classification, and cannot enter a refFilter or a flow criterion.
 */
const STRUCTURAL_CHOICE_SETS = new Set(["manufacturing.orgType"]);

function isTenantClassification(choiceSet: string | null): boolean {
  return choiceSet !== null && !STRUCTURAL_CHOICE_SETS.has(choiceSet);
}

function productChoiceSetCodes(catalog: Catalog, choiceSet: string): readonly string[] {
  const found = catalog.choiceSets.find((item) => item.code === choiceSet);
  return found ? found.items.filter((item) => !item.retired).map((item) => item.code) : [];
}

/** Facing copy is a phrase, not the stored code and not another camelCase or SNAKE token. */
function optionLabelIsFacingCopy(label: string, value: string): boolean {
  if (label === value) return false;
  if (/^[a-z][A-Za-z0-9_]*$/.test(label)) return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(label)) return false;
  return true;
}

export function checkCrossReferences(catalog: Catalog): readonly CrossRefError[] {
  const errors: CrossRefError[] = [];
  const known = new Set(catalog.modules.keys());
  const knownChoiceSets = new Set(catalog.choiceSets.map((choiceSet) => choiceSet.code));
  const moduleOf = (code: string) => catalog.modules.get(code)?.schema;
  const sameEnumCandidate = (
    left: Field,
    leftSiblings: readonly Field[],
    right: Field,
    rightSiblings: readonly Field[],
  ): boolean => {
    if (left.type !== "enum" || right.type !== "enum") return true;
    const leftSource = enumCandidateSourceOf(left, leftSiblings, moduleOf);
    const rightSource = enumCandidateSourceOf(right, rightSiblings, moduleOf);
    return (leftSource === null && rightSource === null) || leftSource === rightSource;
  };

  const fieldAt = (schema: ModuleSchema, coordinate: string): Field | null => {
    const [head, tail, ...rest] = coordinate.split(".");
    if (!head || rest.length > 0) return null;
    const field = schema.fields.find((candidate) => candidate.key === head) ?? null;
    if (tail === undefined) return field;
    if (field?.type !== "subtable") return null;
    return field.fields?.find((candidate) => candidate.key === tail) ?? null;
  };

  /**
   * One shared push target can accept several sources, so optional business coordinates on the target may be sparse: for example only
   * procurement / outsourcing sources have supplierId, and sales / production sources do not. `pushFrom` must still find a same-typed field
   * on at least one real incoming edge, so a mistyped field name does not leave every source silently empty; a required field still demands a value on every edge.
   */
  const hasCompatiblePushOrigin = (targetCode: string, field: Field, table: Field | null): boolean =>
    [...catalog.modules.values()].some((candidate) => candidate.schema.lifecycle.transitions.some((transition) => {
      if (transition.push !== targetCode) return false;
      const from = pushSourceField(candidate.schema, field, table, transition.pushLine);
      if (from === null || from.type !== field.type || from.ref !== field.ref) return false;
      const targetSchema = catalog.modules.get(targetCode)?.schema;
      const targetSiblings = table === null ? (targetSchema?.fields ?? []) : (table.fields ?? []);
      const sourceTable = table === null ? null : pushSourceTable(candidate.schema, table, transition.pushLine);
      const sourceSiblings = sourceTable === null ? candidate.schema.fields : (sourceTable.fields ?? []);
      return sameEnumCandidate(from, sourceSiblings, field, targetSiblings);
    }));

  for (const { code, schema, escapeHatch } of catalog.modules.values()) {
    const add = (at: string, message: string): void => {
      errors.push({ module: code, path: at, message });
    };

    const facingSites = [
      ...schema.fields.flatMap((field) => [
        { options: field.options, path: `fields.${field.key}` },
        ...(field.fields ?? []).map((column) => ({
          options: column.options,
          path: `fields.${field.key}.fields.${column.key}`,
        })),
      ]),
      // Parameters are an action-level fact: check once per action, not once per edge for the same parameters.
      ...transitionActions(schema.lifecycle).flatMap((edge) =>
        edge.params.flatMap((param) => [
          { options: param.options, path: `lifecycle.transitions.${edge.code}.params.${param.key}` },
          ...(param.lineField?.fields ?? []).map((column) => ({
            options: column.options,
            path: `lifecycle.transitions.${edge.code}.params.${param.key}.lineField.fields.${column.key}`,
          })),
        ]),
      ),
    ];
    for (const site of facingSites) {
      if (site.options === null) continue;
      for (const option of site.options) {
        if (!enumOptionNeedsFacingLabel(option.value)) continue;
        if (!optionLabelIsFacingCopy(option.label, option.value)) {
          add(
            `${site.path}.options`,
            `candidate "${option.value}" is a system code and must be written in options as { value, label } with facing copy — ` +
              `the screen, the sidebar, and the dropdown all show that copy directly, and must not expose a module code or an internal token to a role`,
          );
        }
      }
    }

    const choiceSetSites = schema.fields.flatMap((field) => [
      { field, path: `fields.${field.key}` },
      ...(field.fields ?? []).map((column) => ({ field: column, path: `fields.${field.key}.fields.${column.key}` })),
    ]).filter((site) => site.field.choiceSet !== null);
    for (const site of choiceSetSites) {
      const choiceSet = site.field.choiceSet as string;
      if (!knownChoiceSets.has(choiceSet)) {
        add(`${site.path}.choiceSet`, `points at a product dictionary that does not exist, "${choiceSet}"`);
      }
      if (escapeHatch) {
        add(
          `${site.path}.choiceSet`,
          `directory module "${code}" has custom code / a Planner and cannot bind a tenant-configurable dictionary — ` +
            `build time cannot prove the custom code does not branch on a concrete enum value; keep static options, or move the business logic off a dependency on concrete values first`,
        );
      }
    }

    // A configurable dictionary carries only classification, not flow semantics. The rule registry can already project exactly which
    // header / line / external fields a gate reads. Reuse that. Do not parse the primitive object to guess fields.
    for (const pc of schema.preconditions) {
      for (const [slot, check] of [["check", pc.check], ["when", pc.when]] as const) {
        if (check === null || check.primitive === REQUIRED_FIELDS_PRIMITIVE) continue;
        const deps = checkDependencies(check);
        for (const key of deps.billFields) {
          const field = fieldAt(schema, key);
          if (isTenantClassification(field?.choiceSet ?? null)) {
            add(
              `preconditions.${pc.id}.${slot}`,
              `a rule reads configurable-dictionary field "${key}" (${field?.choiceSet}) — a flow criterion cannot depend on a classification value a tenant can add or retire`,
            );
          }
        }
        for (const key of deps.lineFields) {
          const fields = schema.fields
            .filter((field) => field.type === "subtable")
            .flatMap((field) => field.fields ?? [])
            .filter((field) => field.key === key && isTenantClassification(field.choiceSet));
          if (fields.length > 0) {
            add(
              `preconditions.${pc.id}.${slot}`,
              `a rule reads configurable-dictionary line field "${key}" (${fields[0]?.choiceSet}) — a flow criterion cannot depend on a classification value a tenant can add or retire`,
            );
          }
        }
        for (const external of deps.externalFields) {
          const target = catalog.modules.get(external.module)?.schema;
          const field = target ? fieldAt(target, external.field) : null;
          if (isTenantClassification(field?.choiceSet ?? null)) {
            add(
              `preconditions.${pc.id}.${slot}`,
              `a rule reads configurable dictionary "${external.module}.${external.field}" (${field?.choiceSet}) — ` +
                `a flow criterion cannot depend on a classification value a tenant can add or retire`,
            );
          }
        }
      }
    }

    // The source of createFrom is not a second string in the declaration. It is the target field's ref. Single-module validate
    // can prove the path points at ref/refLine, but cannot see whether that ref's module is really in the full catalog; this hop
    // must stay in the loader. Consumers discover the entry backwards from it. Silently skipping an unknown source only shows up as a button disappearing.
    for (const [index, entry] of schema.views.createFrom.entries()) {
      const parts = entry.path.split(".");
      const table = parts.length === 2
        ? schema.fields.find((field) => field.key === parts[0] && field.type === "subtable")
        : undefined;
      const sourceField = parts.length === 1
        ? schema.fields.find((field) => field.key === parts[0] && field.type === "ref")
        : (table?.fields ?? []).find((field) => field.key === parts[1] && field.type === "refLine");
      // A bad path/type belongs to validateModule; do not keep guessing a source from a broken shape here.
      if (!sourceField?.ref) continue;
      if (!known.has(sourceField.ref)) {
        add(
          `views.createFrom[${index}].path`,
          `source coordinate "${entry.path}" points at a module that does not exist, "${sourceField.ref}" — ` +
            `the source is derived only from that field's ref, and an unknown source must not be silenced into zero create entries`,
        );
      }
      const sourceModule = catalog.modules.get(sourceField.ref)?.schema;
      if (sourceModule && entry.sourceStatuses !== null) {
        const knownStatuses = new Set(sourceModule.lifecycle.statuses.map((status) => status.key));
        for (const status of entry.sourceStatuses) {
          if (!knownStatuses.has(status)) {
            add(
              `views.createFrom[${index}].sourceStatuses`,
              `source status "${status}" is not in the lifecycle of module "${sourceField.ref}"`,
            );
          }
        }
      }
      if (sourceModule && entry.sourceRemaining !== null) {
        const header = entry.sourceRemaining.header === null
          ? null
          : sourceModule.fields.find((field) => field.key === entry.sourceRemaining?.header);
        const [throughKey, lineKey, ...rest] = entry.sourceRemaining.line.split(".");
        const through = sourceModule.fields.find(
          (field) => field.key === throughKey && field.type === "subtable",
        );
        const line = rest.length === 0
          ? (through?.fields ?? []).find((field) => field.key === lineKey)
          : undefined;
        if (header !== null && (header === undefined || (header.type !== "number" && header.type !== "money"))) {
          add(
            `views.createFrom[${index}].sourceRemaining.header`,
            `source-remaining header field "${entry.sourceRemaining.header}" must be a number/money field on module "${sourceField.ref}"`,
          );
        }
        if (through === undefined || line === undefined || (line.type !== "number" && line.type !== "money")) {
          add(
            `views.createFrom[${index}].sourceRemaining.line`,
            `source-remaining line field "${entry.sourceRemaining.line}" must be a "line-table.number/money" coordinate on module "${sourceField.ref}"`,
          );
        } else if (sourceField.through !== throughKey) {
          add(
            `views.createFrom[${index}].sourceRemaining.line`,
            `source-remaining line field "${entry.sourceRemaining.line}" is not on the refLine source lines "${String(sourceField.through)}"`,
          );
        }
      }
    }
    /**
     * The layer this field itself lives on — `lookup.match` is a foreign-key column on this module's own layer, and looking it up needs that context.
     *
     * 🔴 Layer is not a comment; it is part of the coordinate. Header `qty` and line `qty` are two different things
     * (on `productionReceipt` the header "finished goods" and the line "finished item" are both called `productId`).
     */
    const checkFieldRefs = (
      field: Field,
      path: string,
      own: { readonly fields: readonly Field[]; readonly what: string; readonly through: string | null },
    ): void => {
      // 🔴 The exemption criterion is the type, not a name suffix.
      //
      // A `subtable` ref is the line-table name (`salesOrderLine`), not a module code — `relationsOf`
      // explicitly ignores it, so this gate skips it. Exempting by suffix would also let through a natural typo:
      // `{ type:'ref', ref:'salesOrderLine' }` (meant to point at an order line). `yarn test` stays green,
      // while `relationsOf` collects by type and throws on existence — the first time anyone opens any document detail page,
      // GET /api/modules/:code/relations returns 500, the related-documents block is replaced by an error,
      // and the symptom is nowhere near the line that was written wrong. The reverse hole is the same: a genuinely wrong module code that happens to end in Line
      // is never caught. The name suffix is still a convention (see `packages/loader/test/loader.test.ts`), but it is not the gate's criterion.
      if (field.type !== "subtable" && field.ref && !known.has(field.ref)) {
        add(`${path}.ref`, `points at a module that does not exist, "${field.ref}"`);
      }
      // 🔴 `refLine` points at one line table on the other module, and that hop must be checked at build time.
      // Skipping it does not raise here: a mistyped `through` (`line` written as `lines`) makes a row rollup
      // join a line table that does not exist, and it blows up only at SQL compile time, with the symptom "the order list will not open".
      if (field.type === "refLine" && field.ref && field.through) {
        const target = catalog.modules.get(field.ref);
        if (target) {
          const hit = target.schema.fields.find((f) => f.key === field.through);
          if (!hit) {
            add(`${path}.through`, `module "${field.ref}" has no field "${field.through}"`);
          } else if (hit.type !== "subtable") {
            add(
              `${path}.through`,
              `"${field.through}" on module "${field.ref}" is a ${hit.type} field, not a line table — ` +
                `refLine points at one line, and that line must live on a line table`,
            );
          }
        }
      }
      // ── Reference-candidate filters: both ends of the coordinate are checked at build time ──
      //
      // 🔴 A refFilter has two ends. Writing either end wrong raises nothing, and the symptoms are opposite:
      //   · target end (the condition key) wrong ⇒ the candidate side cannot compile that column, and it blows up on the first dropdown;
      //   · source end (`x` in `$bill.x`) wrong ⇒ `resolveRefFilter` cannot read a value and treats it as
      //     "that cell is still empty" ⇒ the UI forever says "fill this in first", and the cell does not exist.
      // The second one is especially poisonous: it looks exactly like an ordinary business hint, and the user goes looking for a field that is not there.
      //
      // 🔴 `refPreselect` (the default row among candidates) shares the target-end half: its condition key is also a column
      // on the target module header, and writing it wrong is the same "candidates stay empty" — the symptom just becomes "a default is never selected",
      // which cannot be told apart on screen from "this batch really has no default version". Skipping the check makes the feature
      // fail silently on the cell that was written wrong. It has no source-end half (a dynamic operand is already rejected at declaration time).
      const checkConditionTarget = (
        target: { readonly schema: ModuleSchema } | undefined,
        at: string,
        key: string,
        operand: RefFilterOperand,
      ): Field | undefined => {
        if (!target) return undefined;
        const targetField = target.schema.fields.find((f) => f.key === key);
        // 🔴 Candidate values for `status` come from the target module lifecycle, and they are checked the same way.
        // Without the check, a typo `status: "actve"` ⇒ candidates stay empty, with no error — the same accident shape as
        // "a static enum value written wrong", missing only this one check. And status is exactly
        // the one written most often ("only active ones" is on almost every reference).
        if (key === "status" && !isRefFilterRef(operand)) {
          const statuses = target.schema.lifecycle.statuses.map((s) => s.key);
          for (const v of Array.isArray(operand) ? operand : [operand]) {
            if (typeof v === "string" && !statuses.includes(v)) {
              add(
                at,
                `"${v}" is not a status of module "${field.ref}" (${statuses.join(" / ")}) — ` +
                  `the filter never matches, candidates stay empty, and an empty dropdown looks exactly like "this tenant has not created any yet"`,
              );
            }
          }
        }
        if (!targetField && !(PUBLIC_PLATFORM_FIELDS as readonly string[]).includes(key)) {
          const onLines = lineTablesHolding(target, key);
          add(
            at,
            `the header of module "${field.ref}" has no "${key}"` +
              (onLines.length
                ? ` — it is on line table "${onLines.join(", ")}". Candidate filters look only at the header: ` +
                  `whether a record can be chosen must not depend on what one of its lines looks like`
                : `. available: ${headerKeysOf(target)}`),
          );
          return undefined;
        }
        if (targetField) {
          if (isTenantClassification(targetField.choiceSet)) {
            add(
              at,
              `target field "${field.ref}.${key}" uses tenant-configurable dictionary "${targetField.choiceSet}" — ` +
                `a reference-candidate constraint cannot depend on classification values a tenant can add or retire; keep static options or use a stable business fact`,
            );
          }
          const why = noColumnReason(targetField);
          if (why !== null) {
            add(
              at,
              `"${key}" on module "${field.ref}" ${why} — a candidate filter compiles to a where, ` +
                `and the comparison must be a column that actually exists in the database`,
            );
          }
          // A wrong static enum value is the most common kind: after "semi" is written as "semi-part"
          // candidates stay empty, and on screen "nothing to pick" looks exactly like "this tenant really has not created any yet".
          if (targetField.type === "enum" && targetField.options) {
            const values = Array.isArray(operand) ? operand : isRefFilterRef(operand) ? [] : [operand];
            for (const v of values) {
              if (typeof v === "string" && !hasEnumOption(targetField.options, v)) {
                add(
                  at,
                  `"${v}" is not among the candidate values of "${key}" on module "${field.ref}"` +
                    ` (${enumOptionValues(targetField.options).join(" / ")}) — the filter never matches, and candidates stay empty`,
                );
              }
            }
          }
          if (
            targetField.choiceSet !== null &&
            STRUCTURAL_CHOICE_SETS.has(targetField.choiceSet) &&
            !isRefFilterRef(operand)
          ) {
            const codes = productChoiceSetCodes(catalog, targetField.choiceSet);
            const values = Array.isArray(operand) ? operand : [operand];
            for (const v of values) {
              if (typeof v === "string" && !codes.includes(v)) {
                add(
                  at,
                  `"${v}" is not a preset of product dictionary "${targetField.choiceSet}" (${codes.join(" / ")}) — ` +
                    `the filter never matches, and candidates stay empty`,
                );
              }
            }
          }
        }
        return targetField;
      };

      if (field.refFilter) {
        const target = field.ref ? catalog.modules.get(field.ref) : undefined;
        for (const [key, operand] of Object.entries(field.refFilter)) {
          const at = `${path}.refFilter.${key}`;
          // (1) Target end: the condition key must be a column-bearing field on the target module header, or a platform field.
          const targetField = checkConditionTarget(target, at, key, operand);
          // (2) Source end: a dynamic operand must live on this module's matching layer and point at the same entity as the target field.
          if (isRefFilterRef(operand)) {
            const { from } = operand;
            const map = operand.map ?? null;
            const isLine = from.startsWith("$line.");
            const sourceKey = from.slice(from.indexOf(".") + 1);
            const layer = isLine ? own.fields : schema.fields;
            const layerWhat = isLine ? own.what : "header";
            const sourceField = layer.find((f) => f.key === sourceKey);
            if (!sourceField) {
              add(
                `${at}.from`,
                `this module's ${layerWhat} has no "${sourceKey}" — ` +
                  `when the value cannot be read, candidates forever show "fill this in first", and that cell does not exist. ` +
                  `available: ${layer.filter(hasColumn).map((f) => f.key).join(", ")}`,
              );
            } else if (
              operand.through === undefined &&
              targetField &&
              targetField.type === "ref" &&
              sourceField.ref !== targetField.ref
            ) {
              // Comparing a product value against the target's production-order column: SQL runs, candidates stay empty.
              // Both sides are uuids, so no runtime check can see it.
              add(
                `${at}.from`,
                `"${sourceKey}" points at "${sourceField.ref ?? sourceField.type}", ` +
                  `while "${key}" on module "${field.ref}" points at "${targetField.ref}" — ` +
                  `the two ends are not the same kind of thing, so the comparison is never equal (candidates stay empty, and nothing reports it)`,
              );
            }
            if (operand.through !== undefined && operand.field !== undefined) {
              const upstream = sourceField?.type === "ref" && sourceField.ref ? catalog.modules.get(sourceField.ref) : undefined;
              if (sourceField && sourceField.type !== "ref") {
                add(
                  `${at}.from`,
                  `line-closure source "${sourceKey}" is ${sourceField.type}; it must be a ref pointing at an upstream document`,
                );
              } else if (sourceField?.ref && !upstream) {
                add(`${at}.from`, `line-closure source points at a module that does not exist, "${sourceField.ref}"`);
              } else if (upstream) {
                const table = upstream.schema.fields.find((f) => f.key === operand.through);
                if (!table || table.type !== "subtable" || !table.fields) {
                  add(
                    `${at}.through`,
                    `module "${sourceField?.ref}" has no line table "${operand.through}" — line closure reads that document's lines`,
                  );
                } else {
                  const viaField = table.fields.find((f) => f.key === operand.field);
                  if (!viaField) {
                    add(
                      `${at}.field`,
                      `line table "${operand.through}" of module "${sourceField?.ref}" has no "${operand.field}"`,
                    );
                  } else if (viaField.type !== "ref" || viaField.ref !== field.ref) {
                    add(
                      `${at}.field`,
                      `line-closure column "${operand.field}" must point at "${field.ref}", the same as this cell — ` +
                        `the two ends are not the same kind of thing, so the comparison is never equal`,
                    );
                  }
                }
              }
            }
            if (map !== null && sourceField) {
              if (sourceField.type !== "enum" || sourceField.options === null) {
                add(
                  `${at}.map`,
                  `dynamic-map source "${sourceKey}" must be an enum — otherwise build time cannot prove every source value has a mapping`,
                );
              } else {
                const sources = new Set(enumOptionValues(sourceField.options));
                for (const option of enumOptionValues(sourceField.options)) {
                  if (!Object.hasOwn(map, option)) {
                    add(
                      `${at}.map`,
                      `source enum value "${option}" has no mapping — reporting it only when that value is reached disguises a declaration error as a user-input error`,
                    );
                  }
                }
                for (const key of Object.keys(map)) {
                  if (!sources.has(key)) {
                    add(`${at}.map.${key}`, `"${key}" is not an enum value of source field "${sourceKey}" (${enumOptionValues(sourceField.options).join(" / ")})`);
                  }
                }
              }
              if (targetField && (targetField.type !== "enum" || targetField.options === null)) {
                add(
                  `${at}.map`,
                  `dynamic-map target "${key}" must be an enum — each mapped value has to be checked at build time`,
                );
              } else if (targetField?.options) {
                for (const [source, targetValues] of Object.entries(map)) {
                  for (const targetValue of Array.isArray(targetValues) ? targetValues : [targetValues]) {
                    if (targetValue !== null && (typeof targetValue !== "string" || !hasEnumOption(targetField.options, targetValue))) {
                      add(
                        `${at}.map.${source}`,
                        `mapped value "${String(targetValue)}" is not among the candidate values of target field "${key}" (${enumOptionValues(targetField.options).join(" / ")})`,
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Default-selection conditions have only a target end. A wrong key is quieter than the refFilter side —
      // candidates still list, but "select automatically" has never happened,
      // and nobody suspects a behavior they have never seen.
      if (field.refPreselect) {
        const target = field.ref ? catalog.modules.get(field.ref) : undefined;
        for (const [key, operand] of Object.entries(field.refPreselect)) {
          checkConditionTarget(target, `${path}.refPreselect.${key}`, key, operand);
        }
      }

      const derive = field.derive;
      // A formula does not cross documents — it only computes the same row, so there is no from to check.
      // Its references are fields on the same layer, checked inside one module by the metamodel FORMULA_FIELD_UNKNOWN gate.
      if (derive && derive.kind !== "formula" && !known.has(derive.from)) {
        add(`${path}.derive.from`, `points at a module that does not exist, "${derive.from}"`);
      }
      // ── Derived coordinates: which module and which layer each dependency lands on ──
      //
      // 🔴 The criterion is not invented here. It is what queryCompiler's three compile functions actually do.
      // This gate checks the coordinates SQL will read, including field / match / measure / where on the target module.
      // Outbound permissions do not check those target coordinates: `deriveDependencies` lists only host-side dependencies
      // (a formula's same-layer fields, a lookup's match, a rollup's written on).
      // A wrong coordinate shows up as a build-time miss and a SQL blow-up at runtime:
      //
      // | dependency | lands on | where queryCompiler reads it |
      // |---|---|---|
      // | `lookup.match`   | this module's own layer (the foreign-key column pointing at from) | `columnFor(scope, derive.match, …)` |
      // | `lookup.field`   | the target module's `through` layer | read on `layerTableOf(target, through)` |
      // | `rollup.match`   | the target module's `through` layer | `cols[derive.match]`, cols from the layer table |
      // | `rollup.measure` | the `through` layer by default; the header when that layer has no such column (the line table must be maxRows: 1) | `cols[derive.measure]`; if the column is missing, join the header and read `h.<measure>` |
      // | `rollup.where` keys | 🔴 the target module header, always | a row rollup `innerJoin`s back to the header before the predicate |
      //
      // Every check is also about a column (`hasColumn`), not merely "the declaration has this key":
      // derived fields and line tables have no column in the database, and using them as coordinates always blows up at SQL compile time.
      if (derive?.kind === "lookup") {
        const target = catalog.modules.get(derive.from);
        // 🔴 `match` is a foreign-key column on this module's own layer, not a field on the target module — it is "which value on this row
        // is compared with the target id". Checking it on the target module reports a legal lookup as "the target has no xxxId";
        // skipping the check lets a wrong foreign-key name blow up at SQL compile time (`columnFor` throws "the table has no corresponding column").
        const matchField = own.fields.find((f) => f.key === derive.match);
        if (!matchField) {
          add(
            `${path}.derive.match`,
            `lookup match is the foreign-key column on this module's own layer (${own.what}) that points at "${derive.from}", ` +
              `not a field on the target module — and ${own.what} has no "${derive.match}". ` +
              `available: ${own.fields.filter(hasColumn).map((f) => f.key).join(", ")}`,
          );
        } else {
          const why = noColumnReason(matchField);
          if (why !== null) {
            add(
              `${path}.derive.match`,
              `lookup match compares this row's value with the id of "${derive.from}", so it must be a field that has a column, ` +
                `and "${derive.match}" on ${own.what} ${why}`,
            );
          }
        }
        // 🔴 When `through` is non-empty the field is checked on that line table, not on the header. Checking the header
        // reports a legal lookup (bringing back an order line's quantity) as "the order has no qty".
        const layer = layerOf(target, derive.through, `${path}.derive`, add);
        const at =
          derive.through === null
            ? `module "${derive.from}"`
            : `line table "${derive.through}" of module "${derive.from}"`;
        if (layer) {
          const valueField = layer.find((f) => f.key === derive.field);
          if (!valueField) {
            add(
              `${path}.derive.field`,
              derive.through === null
                ? `module "${derive.from}" has no field "${derive.field}"`
                : `line table "${derive.through}" of module "${derive.from}" has no column "${derive.field}"`,
            );
          } else {
            const why = noColumnReason(valueField);
            // queryCompiler throws on its own for a derived field (`lookupExpr`: this layer does not nest derives).
            // The wording follows that: the modeler needs to know the way out is "cite a field that has a column directly", not to change through.
            if (why !== null) {
              add(
                `${path}.derive.field`,
                `"${derive.field}" on ${at} ${why} — a lookup must bring back a value already stored; ` +
                  `this layer does not nest derives, so cite a field that has a column directly`,
              );
            }
          }
        }
      }
      if (derive?.kind === "rollup") {
        const target = catalog.modules.get(derive.from);
        const layer = layerOf(target, derive.through, `${path}.derive`, add);
        const at =
          derive.through === null
            ? `module "${derive.from}"`
            : `line table "${derive.through}" of module "${derive.from}"`;
        const on = derive.on ?? null;
        const onField = on === null ? undefined : own.fields.find((f) => f.key === on);
        if (on !== null && !onField) {
          add(
            `${path}.derive.on`,
            `rollup on is the identity column on this module's own layer (${own.what}), and this layer has no "${on}"`,
          );
        } else if (onField) {
          const why = noColumnReason(onField);
          if (why !== null) {
            add(`${path}.derive.on`, `"${on}" on ${own.what} ${why} — a rollup's local match coordinate must be a stored identity column`);
          }
        }

        // `match` follows through (it is a line column for a row rollup). `measure` defaults to the same layer;
        // when the line table has no such column it is read from the header, and the line table must be maxRows: 1.
        if (layer) {
          const matchField = layer.find((f) => f.key === derive.match);
          if (!matchField) {
            add(
              `${path}.derive.match`,
              derive.through === null
                ? `module "${derive.from}" has no field "${derive.match}" pointing back at this document`
                : `line table "${derive.through}" of module "${derive.from}" has no column "${derive.match}" pointing back at this document`,
            );
          } else {
            const why = noColumnReason(matchField);
            if (why !== null) {
              add(
                `${path}.derive.match`,
                `"${derive.match}" on ${at} ${why} — a rollup matches it back to this document's id, so it must be a field that has a column`,
              );
            } else {
              const localSpace = on === null
                ? { module: code, through: own.through }
                : keySpaceOf(on, onField, { module: code, through: own.through });
              const matchSpace = keySpaceOf(derive.match, matchField, { module: derive.from, through: derive.through });
              if (localSpace === null) {
                add(`${path}.derive.on`, `"${on}" is a ${onField?.type ?? "unknown"} field and cannot be a rollup identity coordinate: an explicit on accepts only ref / refLine`);
              } else if (matchSpace === null) {
                add(`${path}.derive.match`, `"${derive.match}" is a ${matchField.type} field and cannot be a rollup identity coordinate: a downstream match accepts only ref / refLine`);
              } else if (!sameKeySpace(localSpace, matchSpace)) {
                add(
                  `${path}.derive.match`,
                  `the two sides of the rollup land in different coordinate spaces: ${on === null ? "this layer's id" : `this layer's "${on}"`} is the id of ${keySpaceText(localSpace)}, ` +
                    `while "${derive.from}${derive.through ? `.${derive.through}` : ""}.${derive.match}" is the id of ${keySpaceText(matchSpace)} — the rollup is always 0`,
                );
              }
            }
          }
          // `count()` has no measure (`measure` is null). The other three ops need a column that can be summed or extremized.
          // Skipping the check has the same shape as match: a mistyped measure name blows up at SQL compile time, and the symptom
          // is "this document's list will not open", nowhere near the line that was written wrong.
          if (derive.measure !== null) {
            const lineMeasure = layer.find((f) => f.key === derive.measure);
            const headerMeasure =
              derive.through !== null && target
                ? target.schema.fields.find((f) => f.key === derive.measure)
                : undefined;
            const measureField = lineMeasure ?? headerMeasure;
            const measureAt = lineMeasure ? at : `the header of module "${derive.from}"`;
            if (!measureField) {
              add(
                `${path}.derive.measure`,
                `${at} has no column for measure "${derive.measure}". ` +
                  `available: ${layer.filter(hasColumn).map((f) => f.key).join(", ")}`,
              );
            } else {
              const why = noColumnReason(measureField);
              if (why !== null) {
                add(
                  `${path}.derive.measure`,
                  `"${derive.measure}" on ${measureAt} ${why} — a rollup measure must be a column that actually exists in the database`,
                );
              } else if (!lineMeasure && headerMeasure) {
                const throughField = target?.schema.fields.find((f) => f.key === derive.through);
                if ((throughField?.maxRows ?? null) !== 1) {
                  add(
                    `${path}.derive.measure`,
                    `row-level rollup measure "${derive.measure}" is on the header: line table "${derive.through}" must be maxRows: 1, ` +
                      `otherwise several lines of one document add the same header quantity more than once`,
                  );
                }
              }
            }
          }
        }
        // 🔴 A `where` key always checks the target module header, independent of `through`, so this gate has no branch:
        // in `rollupExpr`, `filterCols = headerAlias === null ? cols : columnsOf(headerAlias)`,
        // and `headerAlias` is built when there is a filter or a header measure and through is non-empty — both roads read
        // header columns (a row rollup innerJoins back to the header before the predicate).
        //
        // 🔴 This used to say "where still filters the header, so do not check it with layer here", and then checked no layer at all:
        // a wrong-layer where (`{ qty: 1 }` while qty lives only on the line table) left `yarn test` green,
        // and failed only at runtime SQL compile ("rollup filter referenced a field that does not exist"),
        // with the symptom that some module's list page would not open at all.
        if (target) {
          for (const key of Object.keys(derive.where ?? {})) {
            const whereAt = `${path}.derive.where.${key}`;
            // Platform fields are not in `schema.fields`, but every header has those columns (supplied by the framework).
            // Existing where clauses are almost all `{ status: … }`. The criterion is the kernel's copy, not restated here —
            // use `isPublicPlatformField` rather than `isPlatformField`: `tenantId` / `orgId` are
            // header columns too (SQL would compile), but they fail the permission projection
            // (the first line of `authorizer.canExposeField` is `isPublicPlatformField`),
            // so the whole derive cannot leave the station for any identity — one column missing on screen, and no error.
            if (isPublicPlatformField(key)) continue;
            const onHeader = target.schema.fields.find((f) => f.key === key);
            if (!onHeader) {
              const onLines = lineTablesHolding(target, key);
              const hint =
                onLines.length === 0
                  ? ""
                  : ` — it lives only on line table "${onLines.join('", "')}", ` +
                    (derive.through === null
                      ? "and this rollup counts header rows, so the filter is also judged on the header"
                      : "and although this rollup aggregates line rows, the filter is still judged on the header (innerJoin back to the header first)") +
                    ", so that layer's columns cannot be read here; " +
                    `lines have no state machine, and "which lines count" has no matching business fact on the lines either, so this rule can only be rewritten as a header condition`;
              add(
                whereAt,
                `rollup where checks the header of target module "${derive.from}" (independent of through, always), ` +
                  `and its header has no column "${key}"${hint}. ` +
                  `available keys: ${headerKeysOf(target)}`,
              );
              continue;
            }
            const why = noColumnReason(onHeader);
            if (why !== null) {
              add(
                whereAt,
                `rollup where compiles to an SQL condition on the header of target module "${derive.from}", ` +
                  `and "${key}" on the header ${why}. ` +
                  `available keys: ${headerKeysOf(target)}`,
              );
            }
            if (isTenantClassification(onHeader.choiceSet)) {
              add(
                whereAt,
                `rollup.where reads tenant-configurable dictionary "${onHeader.choiceSet}" — ` +
                  `a rollup rule cannot depend on classification values a tenant can add or retire; keep static options or use a stable business fact`,
              );
            }
          }
        }
      }

      if (field.snapshot) {
        const snapshot = field.snapshot;
        const target = catalog.modules.get(snapshot.from);
        const targetLayer = layerOf(target, snapshot.through, `${path}.snapshot`, add);
        if (!target) {
          add(`${path}.snapshot.from`, `points at a module that does not exist, "${snapshot.from}"`);
        } else if (targetLayer) {
          const source = targetLayer.find((candidate) => candidate.key === snapshot.field);
          // Header platform columns (updatedAt and the like) may be a snapshot source: they have a physical column and are never null, but they are not in the module fields.
          const platformSource =
            !source &&
            snapshot.through === null &&
            isPlatformField(snapshot.field) &&
            snapshot.field !== "tenantId" &&
            snapshot.field !== "id";
          if (!source && !platformSource) {
            add(
              `${path}.snapshot.field`,
              snapshot.through === null
                ? `module "${snapshot.from}" has no field "${snapshot.field}"`
                : `line table "${snapshot.through}" of module "${snapshot.from}" has no column "${snapshot.field}"`,
            );
          } else if (source) {
            const why = noColumnReason(source);
            if (why !== null || source.type === "subtable") {
              add(
                `${path}.snapshot.field`,
                `snapshot source "${snapshot.field}" ${why ?? "is a line table"}; it must be a stored scalar field`,
              );
            } else if (!(source.type === field.type || (field.type === "string" && source.type === "enum"))) {
              add(
                `${path}.snapshot.field`,
                `snapshot target "${field.key}" is ${field.type}, source "${snapshot.field}" is ${source.type} — ` +
                  `only the same type may be frozen, or an enum source frozen as string`,
              );
            } else if (source.type === "enum" && field.type === "enum" && !sameEnumCandidate(source, targetLayer, field, own.fields)) {
              add(
                `${path}.snapshot.field`,
                `the two snapshot ends are not the same candidate source of truth: source ${enumCandidateSourceLabel(enumCandidateSourceOf(source, targetLayer, moduleOf))}, ` +
                  `target ${enumCandidateSourceLabel(enumCandidateSourceOf(field, own.fields, moduleOf))} — the same string type does not prove the code can be interpreted in the target dictionary`,
              );
            }

            // 🔴 An optional source (qualified quantity on a work report, and the rest of "optional on draft, required on submit") may declare a snapshot —
            // that declaration is entirely valid. No value at the source moment means there is nothing to freeze; that is a legal state, not an error.
            //
            // So the old gate "the source must be required / auto, otherwise reject" is gone. Its only former
            // reason was that codegen unconditionally did `snapshot ⇒ .notNull()`, and the gate had to underwrite that inference.
            // The premise is now carried by the criterion itself — one `snapshotSourceGuarantee`. Table build uses it for nullability,
            // and the write path uses it to decide whether an empty source is rejected or written as null (see the header of packages/metamodel/src/derive/snapshot.ts).
            //
            // 🔴 The only thing still reported here is a cycle. It is not the same kind of thing as an optional source.
            // Optional is a business fact; a cycle is a sick declaration — `a.x ← b.y ← a.x` and nobody can freeze a value,
            // while on the table side it only shows up as a few mysteriously nullable columns, and at runtime as a cell that is always empty.
            const guarantee = snapshotSourceGuarantee(
              (moduleCode) => catalog.modules.get(moduleCode)?.schema,
              snapshot,
            );
            if (guarantee.cycle) {
              add(`${path}.snapshot.field`, `snapshot source is cyclic: ${guarantee.cycle.join(" → ")}`);
            }
          } else if (platformSource) {
            const sourceType = PLATFORM_FIELD_TYPES[snapshot.field as PlatformField];
            if (!(sourceType === field.type || (field.type === "string" && sourceType === "enum"))) {
              add(
                `${path}.snapshot.field`,
                `snapshot target "${field.key}" is ${field.type}, platform source "${snapshot.field}" is ${sourceType} — ` +
                  `only the same type may be frozen, or an enum source frozen as string`,
              );
            }
          }
        }
      }
      if (field.refDefault) {
        const refDefault = field.refDefault;
        const target = catalog.modules.get(refDefault.from);
        const targetLayer = layerOf(target, refDefault.through, `${path}.refDefault`, add);
        if (!target) {
          add(`${path}.refDefault.from`, `points at a module that does not exist, "${refDefault.from}"`);
        } else if (targetLayer) {
          const source = targetLayer.find((candidate) => candidate.key === refDefault.field);
          if (!source) {
            add(
              `${path}.refDefault.field`,
              refDefault.through === null
                ? `module "${refDefault.from}" has no field "${refDefault.field}"`
                : `line table "${refDefault.through}" of module "${refDefault.from}" has no column "${refDefault.field}"`,
            );
          } else {
            const why = noColumnReason(source);
            if (why !== null || source.type === "subtable") {
              add(
                `${path}.refDefault.field`,
                `refDefault source "${refDefault.field}" ${why ?? "is a line table"}; it must be a stored scalar field`,
              );
            } else if (!(source.type === field.type || (field.type === "string" && source.type === "enum"))) {
              add(
                `${path}.refDefault.field`,
                `refDefault target "${field.key}" is ${field.type}, source "${refDefault.field}" is ${source.type} — ` +
                  `only the same type may be prefilled, or an enum source prefilled as string`,
              );
            } else if (source.type === "enum" && field.type === "enum" && !sameEnumCandidate(source, targetLayer, field, own.fields)) {
              add(
                `${path}.refDefault.field`,
                `the two refDefault ends are not the same candidate source of truth: source ${enumCandidateSourceLabel(enumCandidateSourceOf(source, targetLayer, moduleOf))}, ` +
                  `target ${enumCandidateSourceLabel(enumCandidateSourceOf(field, own.fields, moduleOf))} — the same string type does not prove the code can be interpreted in the target dictionary`,
              );
            }
          }
        }
      }
    };

    for (const field of schema.fields) {
      checkFieldRefs(field, `fields.${field.key}`, { fields: schema.fields, what: `the header of module "${code}"`, through: null });
      // 🔴 Line-table columns also ref outward (a line's productId → product).
      // Without drilling into this layer, a reference inside lines that points at a missing module is a blind spot.
      if (field.fields) {
        for (const sub of field.fields) {
          checkFieldRefs(sub, `fields.${field.key}.fields.${sub.key}`, {
            fields: field.fields,
            what: `line table "${field.key}" of module "${code}"`,
            through: field.key,
          });
        }
      }
    }

    // Required lines conditioned on a ref: the metamodel checks the local via ref type and landing point; this layer checks the target module and field.
    for (const pc of schema.preconditions) {
      if (!pc.check) continue;
      const linesCheck = linesRequiredIfRefFieldOf(pc.check);
      if (!linesCheck) continue;
      const at = `preconditions.${pc.id}.check`;
      const target = catalog.modules.get(linesCheck.entity);
      if (!target) {
        add(`${at}.entity`, `points at a module that does not exist, "${linesCheck.entity}"`);
        continue;
      }
      const projectedPlatform = isPlatformField(linesCheck.field) && linesCheck.field !== "tenantId";
      if (!target.schema.fields.some((field) => field.key === linesCheck.field) && !projectedPlatform) {
        add(`${at}.field`, `module "${linesCheck.entity}" has no field "${linesCheck.field}"`);
      }
    }

    // The target layer of `ref_field_compare` can be checked only with the full catalog.
    // The metamodel semantic gate owns consistency of the local via ref/refLine type with entity/through;
    // this layer pins that the target entity, the target line table, and the compared field themselves really exist.
    for (const pc of schema.preconditions) {
      if (!pc.check) continue;
      const refCheck = referenceComparisonOf(pc.check);
      if (!refCheck) continue;
      const at = `preconditions.${pc.id}.check`;
      const target = catalog.modules.get(refCheck.entity);
      if (!target) {
        add(`${at}.entity`, `points at a module that does not exist, "${refCheck.entity}"`);
        continue;
      }
      const layer = layerOf(target, refCheck.through, at, add);

      // ── Hop 2: check that each hop's coordinate exists ──
      //
      // 🔴 A wrong middle hop says nothing at modeling time. At runtime
      // `row["prevProcessTaskI"]` reads undefined ⇒ "not filled in" ⇒ this gate rejects every document,
      // and the user is told to fill a field that does not exist on an upstream document. So every hop is checked here:
      // whether the column exists, whether it is a reference, whether the module it points at is the next hop's landing point, and whether the layer is right.
      let finalEntity = refCheck.entity;
      let finalThrough = refCheck.through;
      let finalLayer = layer;
      const hop = refCheck.then;
      if (hop !== null) {
        finalEntity = hop.entity;
        finalThrough = hop.through;
        finalLayer = null;
        const column = layer?.find((f) => f.key === hop.field) ?? null;
        if (layer && !column) {
          add(
            `${at}.via`,
            refCheck.through === null
              ? `hop 2: module "${refCheck.entity}" has no field "${hop.field}"`
              : `hop 2: line table "${refCheck.through}" of module "${refCheck.entity}" has no column "${hop.field}"`,
          );
        } else if (column) {
          // Layer and type must agree, for the same reason as `PRECONDITION_REF_VIA_NOT_REF(_LINE)`:
          // looking up a header with a line id (or the reverse) matches no row, while the declaration looks fine on its own.
          const want = hop.through === null ? "ref" : "refLine";
          if (column.type !== want) {
            add(
              `${at}.then`,
              `hop 2 "${refCheck.entity}.${hop.field}" is a ${column.type} field; ` +
                `a landing point on ${hop.through === null ? "the header" : `line table "${hop.through}"`} must hop through a ${want} field`,
            );
          } else if (column.ref !== hop.entity) {
            add(
              `${at}.then.entity`,
              `hop 2 "${refCheck.entity}.${hop.field}" points at ${String(column.ref)}, ` +
                `but then.entity writes ${hop.entity} — the landing point does not match, so the field read belongs to another table`,
            );
          } else if (hop.through !== null && column.through !== hop.through) {
            add(
              `${at}.then.through`,
              `hop 2 "${refCheck.entity}.${hop.field}" points at line table "${String(column.through)}", ` +
                `but the rule looks up "${hop.through}"`,
            );
          }
        }
        const hopTarget = catalog.modules.get(hop.entity);
        if (!hopTarget) {
          add(`${at}.then.entity`, `points at a module that does not exist, "${hop.entity}"`);
        } else {
          finalLayer = layerOf(hopTarget, hop.through, `${at}.then`, add);
        }
      }

      // Header and line projections both have platform fields (such as id). Only tenantId is deliberately stripped by the store:
      // the query is already bound to a tenant, so it is neither visible nor a business criterion. Treating it as readable makes every comparison read undefined.
      const projectedPlatform = isPlatformField(refCheck.field) && refCheck.field !== "tenantId";
      if (finalLayer && !finalLayer.some((f) => f.key === refCheck.field) && !projectedPlatform) {
        add(
          `${at}.field`,
          finalThrough === null
            ? `module "${finalEntity}" has no field "${refCheck.field}"`
            : `line table "${finalThrough}" of module "${finalEntity}" has no column "${refCheck.field}"`,
        );
      }
    }

    // ── `related_agg`: `on` and `match` must land in the same coordinate space ──
    //
    // 🔴 This gate used to be missing entirely, and what it stops is a class of errors that only show up as a pass:
    // `on` says "the order line this row points at", `match` says "the column on the downstream row that points back",
    // and the two must be the same set of ids. After one letter is swapped (`sourceOrderLineId` ↔ `sourceOrderId`,
    // or `match` points at another line table), `list()` compares an order id with the order-line id column,
    // no row matches ⇒ the total is 0 ⇒ "cumulative must not exceed the cap" always passes, `verdict = pass`,
    // and both declarations look completely normal on their own. There is no runtime symptom, so it can only go red here.
    //
    // 🔴 The criterion is the kernel's `keySpaceOf`, one ruler for both sides (`on` is derived from this module's declaration,
    // `match` from the target module's). Writing a second copy is how the gate convinces itself they match.
    for (const pc of schema.preconditions) {
      if (!pc.check) continue;
      const agg = relatedAggregationOf(pc.check);
      if (!agg) continue;
      const at = `preconditions.${pc.id}.check`;
      const target = catalog.modules.get(agg.from);
      if (!target) {
        add(`${at}.from`, `points at a module that does not exist, "${agg.from}"`);
        continue;
      }
      const layer = layerOf(target, agg.through, at, add);
      if (!layer) continue;

      // The `match` side. `id` is a platform field (the downstream row's own identity), so finding no declaration is normal.
      const matchField = layer.find((f) => f.key === agg.match);
      if (!matchField && agg.match !== "id") {
        add(
          `${at}.match`,
          agg.through === null
            ? `module "${agg.from}" has no field "${agg.match}" — it is the column on the downstream row that points back at this document`
            : `line table "${agg.through}" of module "${agg.from}" has no column "${agg.match}" — it is the column on the downstream row that points back at this document`,
        );
        continue;
      }
      const matchSpace = keySpaceOf(agg.match, matchField, { module: agg.from, through: agg.through });
      if (matchSpace === null) {
        add(
          `${at}.match`,
          `"${agg.match}" is a ${matchField?.type ?? "unknown"} field and cannot be a join key: ` +
            `a downstream row points back at this document only as id / ref / refLine. ` +
            `matching by value does not raise; it only makes the total count rows whose cell happens to be equal`,
        );
        continue;
      }

      // The `on` side. Its type gate is in `validateModule` (`PRECONDITION_ON_NOT_KEY`);
      // here the spaces are compared only when both sides resolve — the side that does not resolve has already been reported.
      // 🔴 When there is not exactly one line table, skip: there is no basis for which table `$line.` means,
      // and that case is reported by `PRECONDITION_LINE_AMBIGUOUS` / `_NO_SUBTABLE`.
      // Picking the first table and comparing anyway would emit a coordinate error that looks very specific from a guessed layer.
      const onKey = relatedAggKeyOf(agg);
      const subtables = schema.fields.filter((f) => f.type === "subtable");
      const onTable = onKey.from === "line" ? (subtables.length === 1 ? subtables[0] : undefined) : undefined;
      if (onKey.from === "line" && !onTable) continue;
      const onLayer = onKey.from === "bill" ? schema.fields : (onTable?.fields ?? []);
      const onOwn = { module: code, through: onTable?.key ?? null };
      const onSpace = keySpaceOf(
        onKey.field,
        onLayer.find((f) => f.key === onKey.field),
        onOwn,
      );
      if (onSpace === null) continue;

      if (!sameKeySpace(onSpace, matchSpace)) {
        add(
          `${at}.match`,
          `the two sides of the join key land in different coordinate spaces: this document's "${onKey.from === "bill" ? "" : "$line."}${onKey.field}" ` +
            `is the id of ${keySpaceText(onSpace)}, while "${agg.from}${agg.through ? `.${agg.through}` : ""}.${agg.match}" ` +
            `is the id of ${keySpaceText(matchSpace)} — the two id sets are disjoint, ` +
            `so not a single downstream row matches, and the total is always 0: the upper-bound gate always passes, the lower-bound gate always blocks, and both declarations look right on their own`,
        );
      }
    }

    for (const edge of schema.lifecycle.transitions) {
      let resolvedPushLine = edge.pushLine;
      if (edge.push && !known.has(edge.push)) {
        add(`lifecycle.transitions.${edge.code}.push`, `push target module "${edge.push}" does not exist`);
      }
      if (edge.push && edge.pushLine) {
        const at = `lifecycle.transitions.${edge.code}.push.line`;
        const sourceTable = schema.fields.find((field) => field.key === edge.pushLine?.source);
        if (!sourceTable) {
          add(`${at}.source`, `source module "${schema.code}" has no field "${edge.pushLine.source}"`);
          resolvedPushLine = null;
        } else if (sourceTable.type !== "subtable") {
          add(`${at}.source`, `"${edge.pushLine.source}" on source module "${schema.code}" is ${sourceTable.type}, not a line table`);
          resolvedPushLine = null;
        }
        const target = catalog.modules.get(edge.push);
        if (target) {
          const targetTable = target.schema.fields.find((field) => field.key === edge.pushLine?.target);
          if (!targetTable) {
            add(`${at}.target`, `push target "${edge.push}" has no field "${edge.pushLine.target}"`);
            resolvedPushLine = null;
          } else if (targetTable.type !== "subtable") {
            add(`${at}.target`, `"${edge.pushLine.target}" on push target "${edge.push}" is ${targetTable.type}, not a line table`);
            resolvedPushLine = null;
          } else {
            const incompatible = (targetTable.fields ?? []).filter((field) =>
              field.type === "refLine" && field.ref === schema.code && field.through !== edge.pushLine?.source
            );
            for (const field of incompatible) {
              add(
                `${at}.source`,
                `explicit source table "${edge.pushLine.source}" and refLine.through "${String(field.through)}" on target "${edge.push}.${targetTable.key}.${field.key}" do not match — one line reference cannot point at two source line tables at once`,
              );
            }
            if (incompatible.length > 0) resolvedPushLine = null;
          }
        }
      }
      // 🔴 The field `pushFrom` names must really exist on the source document, and the types must agree.
      // Same layer first; an explicit pushFrom on a line column may fall back to the header (the same rule as `pushSourceField`).
      //
      // This hop can be checked only once both modules are in hand (a single-module gate is structurally blind to it). Skipping it
      // silently carries no value: `pushFrom: "netPrice"` mistyped as `"netprice"` ⇒ that target cell stays empty,
      // and if it is required that becomes a runtime 400, if not a quiet blank —
      // a shipment's unit price stays empty, the amount is computed as 0, and receivables miss a whole document.
      if (edge.push) {
        const target = catalog.modules.get(edge.push);
        if (target) {
          const at = `lifecycle.transitions.${edge.code}.push`;
          const pinned = new Set(edge.pushDefaults === null ? [] : Object.keys(edge.pushDefaults));
          for (const field of target.schema.fields) {
            const sites = field.type === "subtable"
              ? (field.fields ?? []).map((column) => ({ field: column, path: `${field.key}.${column.key}` }))
              : [{ field, path: field.key }];
            for (const site of sites) {
              if (!isPlannerSupplied(site.field)) continue;
              if (pinned.has(site.path) || (site.field.pushFrom !== null && field.type !== "subtable")) continue;
              add(
                at,
                `field "${site.path}" on push target "${edge.push}" declares plannerSupplied — ` +
                  `an ordinary transition.push can freeze that field only through an explicit pushFrom or pushDefaults, and must not guess by the same name`,
              );
            }
          }
          const checkPushFrom = (field: Field, table: Field | null): void => {
            if (field.pushFrom === null) return;
            const where = table === null ? field.key : `${table.key}.${field.key}`;
            const layerName = table === null ? "header" : `line table "${table.key}"`;
            const from = pushSourceField(schema, field, table, resolvedPushLine);
            if (!from) {
              if (!field.required && hasCompatiblePushOrigin(edge.push!, field, table)) return;
              add(
                at,
                `"${where}" on push target "${edge.push}" declares pushFrom: "${field.pushFrom}", ` +
                  `but this module's ${layerName} has no such field — the push silently carries no value`,
              );
              return;
            }
            if (from.type !== field.type || from.ref !== field.ref) {
              add(
                at,
                `"${where}" on push target "${edge.push}" is ${field.type}, ` +
                  `while pushFrom "${field.pushFrom}" is ${from.type} — a different type has no usable display or comparator for the carried value`,
              );
            } else if (from.type === "enum" && field.type === "enum") {
              const targetSiblings = table === null ? target.schema.fields : (table.fields ?? []);
              const sourceTable = table === null ? null : pushSourceTable(schema, table, resolvedPushLine);
              const sourceSiblings = sourceTable === null ? schema.fields : (sourceTable.fields ?? []);
              if (!sameEnumCandidate(from, sourceSiblings, field, targetSiblings)) {
                add(
                  at,
                  `"${where}" on push target "${edge.push}" and source "${field.pushFrom}" are not the same candidate source of truth: ` +
                    `${enumCandidateSourceLabel(enumCandidateSourceOf(field, targetSiblings, moduleOf))} / ${enumCandidateSourceLabel(enumCandidateSourceOf(from, sourceSiblings, moduleOf))}`,
                );
              }
            }
          };
          for (const field of target.schema.fields) {
            if (field.type === "subtable") {
              for (const column of field.fields ?? []) checkPushFrom(column, field);
              continue;
            }
            checkPushFrom(field, null);
          }
        }
      }
      // 🔴 A draft produced by push must be able to land.
      //
      // A `required` field on the target, if the source document cannot carry it, leaves that cell empty on the draft, and `bills.create`
      // goes through `prepareWrite(..., "whole", ...)` — a missing required value is judged `REQUIRED_BLANK` immediately.
      // The symptom is a 400 on the first "ship", while the offline gate is green and the unit tests are green (a stub store's create does not run the value gate).
      // This was hit once for real: `salesDelivery.deliveryDate` is required, and the sales order has no such field.
      //
      // The criterion borrows `isPushFillable` (the kernel), the same copy `buildPushDraft` uses when it actually fills —
      // a second copy would let this gate and the runtime fill drift apart, and the drift still shows up as a runtime 400.
      //
      // The way out is "optional on draft, required on submit": declare it optional and hang `required_fields` on that edge.
      if (edge.push) {
        const target = catalog.modules.get(edge.push);
        if (target) {
          const at = `lifecycle.transitions.${edge.code}.push`;
          // A cell this edge itself pins counts as fillable — that is exactly what covers the kind push cannot copy.
          // Key shape matches the declaration: a header key is the field key, a line key is `<line-table>.<column>`.
          const pinned = new Set(edge.pushDefaults === null ? [] : Object.keys(edge.pushDefaults));
          const complain = (field: Field, table: Field | null): void => {
            const where = table === null ? `${field.key}` : `${table.key}.${field.key}`;
            add(
              at,
              `required field "${where}" (${field.label}) on push target "${edge.push}" cannot be carried over from this module — ` +
                `the pushed draft is missing that cell, and a missing required value is judged REQUIRED_BLANK on write (runtime 400, invisible to the offline gate). ` +
                `For "optional on draft, required on submit", declare it optional and hang required_fields on that edge of the target module`,
            );
          };
          for (const field of target.schema.fields) {
            if (field.type === "subtable") {
              // 🔴 When the source document has no line table of the same key, `buildPushDraft` `continue`s at that layer
              // (`if (!sourceTable?.fields || !columns) continue`) — that target line table
              // produces no rows at all, and zero line rows are legal (`instance.ts`: a draft is there for a person to fill in slowly).
              // So the "missing required value, 400 on write" symptom never happens in this shape,
              // and judging it would be asserting something that is not true. The real shape is `productionTask.createReceipt`
              // (the source document has no lines at all) forcing every line column of `productionReceipt` to be optional,
              // while that line table's `productId` is exactly the subject of the `stock` effect.
              //
              // The criterion must share its wording with `buildPushDraft` (the discipline in the comment above this block).
              // Dropping this condition means the two sites judge separately: the gate says no, and at runtime nothing is actually missing.
              //
              // Which source line table pairs is the kernel's `pushSourceTable` (the criterion is the explicit `refLine.through`
              // declaration, not the same name). Writing a second copy here is exactly what that discipline prevents:
              // under a differently named declaration the gate would skip as "the source document has no matching line table", while the executor can already carry the lines.
              const sourceTable = pushSourceTable(schema, field, resolvedPushLine);
              if (!sourceTable?.fields) continue;
              for (const column of field.fields ?? []) {
                if (
                  column.required &&
                  !pinned.has(`${field.key}.${column.key}`) &&
                  !isPushFillable(schema, column, field, isSystemSupplied, resolvedPushLine)
                ) {
                  complain(column, field);
                }
              }
              continue;
            }
            if (field.required && !pinned.has(field.key) && !isPushFillable(schema, field, null, isSystemSupplied, resolvedPushLine)) {
              complain(field, null);
            }
          }
        }
      }
      // 🔴 Every cell pinned by `pushDefaults` must really exist on the target module, and the value must be legal.
      //
      // This hop can likewise be checked only once both modules are in hand. The three consequences of skipping it all raise nothing:
      // a mistyped key ⇒ that cell stays empty as before, and if required it becomes a runtime 400; a value outside the enum ⇒ an illegal state is written,
      // and every later query that filters on that field misses a batch of rows; pinning a cell push could already copy ⇒ two sources of truth,
      // and which one wins depends on the statement order inside buildPushDraft.
      if (edge.push && edge.pushDefaults) {
        const target = catalog.modules.get(edge.push);
        if (target) {
          const at = `lifecycle.transitions.${edge.code}.pushDefaults`;
          const layerOf = (key: string): { readonly field: Field | null; readonly table: Field | null } => {
            const dot = key.indexOf(".");
            if (dot < 0) return { field: target.schema.fields.find((f) => f.key === key) ?? null, table: null };
            const table = target.schema.fields.find((f) => f.key === key.slice(0, dot) && f.type === "subtable");
            if (!table) return { field: null, table: null };
            return { field: (table.fields ?? []).find((c) => c.key === key.slice(dot + 1)) ?? null, table };
          };
          for (const [key, value] of Object.entries(edge.pushDefaults)) {
            const { field, table } = layerOf(key);
            if (!field) {
              add(at, `"${key}" does not exist on push target "${edge.push}" — write a field key for the header, and <line-table>.<column> for a line`);
              continue;
            }
            if (isSystemSupplied(field) && !isPlannerSupplied(field)) {
              add(at, `"${key}" is a system-supplied field (auto / derive / lineAgg); a value pinned here is overwritten by the value computed at write time`);
              continue;
            }
            if (isPushFillable(schema, field, table, isSystemSupplied, resolvedPushLine)) {
              add(
                at,
                `"${key}" can already be carried from the source document (same-named field or pushFrom); pinning another copy is two sources of truth — ` +
                  `delete this pushDefaults entry, or delete that pushFrom`,
              );
              continue;
            }
            if (field.type === "ref" || field.type === "refLine") {
              add(at, `"${key}" is a reference field; pinning an id welds one concrete row into the declaration — a reference is either carried from the source document or left for a person to choose`);
              continue;
            }
            if (field.choiceSet !== null) {
              add(
                at,
                `"${key}" uses tenant-configurable dictionary "${field.choiceSet}", and pushDefaults cannot pin a concrete code — ` +
                  `the tenant may have retired that item, and a system push would then lose a usable write path`,
              );
              continue;
            }
            const wantsNumber = field.type === "number" || field.type === "money" || field.type === "percent";
            if (wantsNumber !== (typeof value === "number")) {
              add(at, `"${key}" is ${field.type}, but the given value is ${typeof value}`);
              continue;
            }
            if (field.type === "enum" && !hasEnumOption(field.options, String(value))) {
              add(at, `value "${String(value)}" of "${key}" is not among the enum candidates (${enumOptionValues(field.options).join(" / ")})`);
            }
          }
        }
      }
      for (const param of edge.params) {
        if (param.ref && !known.has(param.ref)) {
          add(`lifecycle.transitions.${edge.code}.params.${param.key}.ref`, `points at a module that does not exist, "${param.ref}"`);
        }
        if (param.lineField !== null) {
          const paramPath = `lifecycle.transitions.${edge.code}.params.${param.key}.lineField`;
          checkFieldRefs(param.lineField, paramPath, {
            fields: schema.fields,
            what: `the temporary lines of action "${edge.code}" on module "${code}"`,
            through: null,
          });
          for (const column of param.lineField.fields ?? []) {
            checkFieldRefs(column, `${paramPath}.fields.${column.key}`, {
              fields: param.lineField.fields ?? [],
              what: `the temporary lines of action "${edge.code}" on module "${code}"`,
              through: null,
            });
          }
        }
      }
    }
  }

  return errors;
}
