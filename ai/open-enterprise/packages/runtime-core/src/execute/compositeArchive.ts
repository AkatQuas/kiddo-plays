// ---------------------------------------------------------------------------
// Composite archive (views.composite) — parent record plus an independent child subject
//
// packages only locate parent and child from the declaration, list children, and check data scope.
// No module name is written here, and no domain's field policy is copied.
// The write path is still createBill / saveDraft / deleteBill / executeTransition.
//
// Generic composite-archive engine (v3.6.0+):
// - `saveCompositeArchive()` drives the save from the `views.composite.commands` declaration
// - Inheritance, generation, freeze, and validation are all declared. Business logic is not scattered across domains
// - A new composite archive needs no new code: declare the rules on the schema
// ---------------------------------------------------------------------------

import {
  QUERY_MAX_LIMIT,
  isCustomFieldKey,
  isSummarizableType,
  isSystemSupplied,
  normalizeQuery,
  type ModuleSchema,
  type Query,
} from "@open-erp/metamodel";
import { requireRuntimeModule, type RuntimeCatalog } from "../contracts/catalog.js";
import type { RuntimeAuthorizer } from "../contracts/authorization.js";
import type { Identity } from "../contracts/identity.js";
import { RepoError } from "../contracts/errors.js";
import type { BillRecord, BillRepo } from "../contracts/repositories.js";
import type { ExecutionRepos } from "./execute.js";

export interface CompositeArchiveSpec {
  readonly parent: ModuleSchema;
  readonly child: ModuleSchema;
  readonly parentField: string;
}

export interface CompositeArchiveLookup {
  readonly catalog: RuntimeCatalog;
  readonly repos: ExecutionRepos;
  readonly authorizer: RuntimeAuthorizer;
}

export function findCompositeArchive(catalog: RuntimeCatalog): CompositeArchiveSpec {
  const hits = [...catalog.modules.values()].filter((item) => item.schema.views.composite !== null);
  if (hits.length === 0) throw new RepoError("Composite archive: the catalog has no views.composite declaration");
  if (hits.length > 1) {
    throw new RepoError(
      `Composite archive: more than one views.composite (${hits.map((item) => item.schema.code).join(" / ")}); refusing to guess`,
    );
  }
  const parent = hits[0]!.schema;
  const spec = parent.views.composite!;
  const child = requireRuntimeModule(catalog, spec.child).schema;
  const parentField = child.fields.find((field) => field.key === spec.parentField);
  if (parentField === undefined || parentField.type !== "ref" || parentField.ref !== parent.code) {
    throw new RepoError(
      `Composite archive: child module "${child.code}" must have a ref field "${spec.parentField}" pointing at "${parent.code}"`,
    );
  }
  return { parent, child, parentField: spec.parentField };
}

function summaryFieldOf(schema: ModuleSchema): string {
  const field = schema.fields.find((candidate) => isSummarizableType(candidate.type));
  if (field === undefined) {
    throw new RepoError(`Composite archive: child module "${schema.code}" has no number/money field, so the data scope cannot be checked`);
  }
  return field.key;
}

export function childListQuery(child: ModuleSchema, parentField: string, parentId: string, offset: number): Query {
  return normalizeQuery(
    child,
    {
      where: { kind: "cond", field: parentField, op: "eq", value: parentId },
      sort: [{ field: "code", desc: false }],
      limit: QUERY_MAX_LIMIT,
      offset,
    },
    `composite archive child list (${child.code})`,
  );
}

export async function listCompositeChildren(
  lookup: CompositeArchiveLookup,
  identity: Identity,
  spec: CompositeArchiveSpec,
  parentId: string,
): Promise<readonly BillRecord[]> {
  lookup.authorizer.assertModule(identity, spec.child.code, "read");
  const out: BillRecord[] = [];
  let offset = 0;
  let total = 0;
  do {
    const query = childListQuery(spec.child, spec.parentField, parentId, offset);
    lookup.authorizer.assertQuery(identity, spec.child, query);
    const page = await lookup.repos.bills.list(identity, spec.child.code, query);
    total = page.total;
    for (const header of page.rows) {
      const id = header["id"];
      if (typeof id !== "string" || id === "") {
        throw new RepoError("Composite archive: a child-list row is missing id");
      }
      out.push(await lookup.repos.bills.get(identity, spec.child.code, id));
    }
    offset += query.limit;
  } while (offset < total);
  if (out.length !== total) {
    throw new RepoError(`Composite archive: child-list page count does not match (read ${String(out.length)}, declared ${String(total)})`);
  }
  return out;
}

/**
 * Load child headers for a set of parent ids in one read.
 *
 * List and detail share this one `parentField in (...)`. They do not call `bills.get` once per parent.
 * The result is header rows from the child module's `bills.list`. The caller then trims keys with the child schema's `readableRow`.
 * Pages walk through `QUERY_MAX_LIMIT`. If the row count does not match `total`, refuse. A missing page is not "there are no children".
 */
export async function listCompositeChildHeaders(
  bills: Pick<BillRepo, "list">,
  authorizer: RuntimeAuthorizer,
  identity: Identity,
  child: ModuleSchema,
  parentField: string,
  parentIds: readonly string[],
): Promise<ReadonlyMap<string, readonly Readonly<Record<string, unknown>>[]>> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of parentIds) {
    if (id === "") throw new RepoError("Composite archive: parent id must be a non-empty string");
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  const grouped = new Map<string, Readonly<Record<string, unknown>>[]>();
  for (const id of ids) grouped.set(id, []);
  if (ids.length === 0) return grouped;

  const field = child.fields.find((item) => item.key === parentField);
  if (field === undefined || field.type !== "ref") {
    throw new RepoError(`Composite archive: child module "${child.code}" has no ref field "${parentField}"`);
  }

  let offset = 0;
  let total = 0;
  let read = 0;
  do {
    const query = normalizeQuery(
      child,
      {
        where: { kind: "cond", field: parentField, op: "in", value: [...ids] },
        sort: [{ field: "code", desc: false }],
        limit: QUERY_MAX_LIMIT,
        offset,
      },
      `composite archive child list (${child.code})`,
    );
    authorizer.assertQuery(identity, child, query);
    const page = await bills.list(identity, child.code, query);
    total = page.total;
    if (page.rows.length === 0) {
      if (offset < total) {
        throw new RepoError(`Composite archive: child-list page count does not match (read ${String(read)}, declared ${String(total)})`);
      }
      break;
    }
    for (const header of page.rows) {
      const parentId = header[parentField];
      const bucket = typeof parentId === "string" ? grouped.get(parentId) : undefined;
      if (bucket === undefined) {
        throw new RepoError(`Composite archive: "${parentField}" on child "${child.code}" is not in this parent set`);
      }
      bucket.push(header);
      read += 1;
    }
    offset += query.limit;
  } while (offset < total);
  if (read !== total) {
    throw new RepoError(`Composite archive: child-list page count does not match (read ${String(read)}, declared ${String(total)})`);
  }
  return grouped;
}

export async function assertVisibleChildSet(
  lookup: CompositeArchiveLookup,
  identity: Identity,
  spec: CompositeArchiveSpec,
  parentId: string,
  visible: readonly BillRecord[],
): Promise<void> {
  const query = childListQuery(spec.child, spec.parentField, parentId, 0);
  const tenant = await lookup.repos.bills.invariantBillSummary(identity, spec.child.code, query, {
    field: summaryFieldOf(spec.child),
    fn: "count",
  });
  if (tenant.total !== visible.length) {
    throw new RepoError(
      `The current data scope cannot see every "${spec.child.label}" under this "${spec.parent.label}". Refusing this operation`,
    );
  }
}

export function initialStatusOf(schema: ModuleSchema): string {
  const hit = schema.lifecycle.statuses.find((status) => status.initial);
  if (hit === undefined) throw new RepoError(`Composite archive: module "${schema.code}" has no initial status`);
  return hit.key;
}

// ---------------------------------------------------------------------------
// Generic composite-archive save engine (v3.6.0+)
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import type {
  CompositeArchiveCommands,
  FieldGenerator,
} from "@open-erp/metamodel";
import { StaleRevisionError } from "../contracts/errors.js";
import type { BillWriteLockRequest } from "../contracts/repositories.js";
import {
  createBill,
  deleteBill,
  pinClock,
  saveDraft,
  type RuntimeDeps,
} from "./execute.js";

/**
 * Generic composite-archive input: parent header, child rows, and child ids to delete.
 */
export interface CompositeArchiveInput {
  readonly header: {
    readonly id?: string;
    readonly expectedRevision?: number;
    readonly [key: string]: unknown;
  };
  readonly lines: readonly {
    readonly id?: string;
    readonly [key: string]: unknown;
  }[];
  readonly removeChildIds?: readonly string[];
}

/**
 * Generic composite-archive output: the parent plus the child list.
 */
export interface CompositeArchiveOutput {
  readonly parent: Readonly<Record<string, unknown>>;
  readonly children: readonly Readonly<Record<string, unknown>>[];
}

function inputError(archiveLabel: string, message: string): never {
  throw new RepoError(`Save ${archiveLabel}: ${message}`);
}

/**
 * Did the user supply a real value in this cell.
 *
 * "Not given" has four shapes. Missing one skips generation: the field is absent, `null`, an empty string
 * (what a cleared input often sends back), or a value equal to the placeholder (the form echoes "generated after save").
 * Recognizing only the placeholder looks like this: a row that omitted the cell is stored with an empty barcode, and the request returns 201.
 */
export function userSuppliedValue(inputValue: unknown, placeholder: string | null): boolean {
  if (inputValue === undefined || inputValue === null) return false;
  if (typeof inputValue !== "string") return true;
  const text = inputValue.trim();
  if (text === "") return false;
  return placeholder === null || text !== placeholder;
}

/** Generate one cell from the declaration. If the user supplied a real value, keep the user's. */
export function resolveGeneratedValue(generator: FieldGenerator, inputValue: unknown): unknown {
  if (userSuppliedValue(inputValue, generator.placeholder)) {
    return typeof inputValue === "string" ? inputValue.trim() : inputValue;
  }
  return `${generator.prefix}${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

/** Custom fields with origin=own on the child header in this tenant's effective schema. Inherited fields are snapshots and cannot be filled on the line. */
function ownCustomFieldKeys(schema: ModuleSchema): readonly string[] {
  const keys: string[] = [];
  for (const field of schema.fields) {
    if (!isCustomFieldKey(field.key) || isSystemSupplied(field)) continue;
    keys.push(field.key);
  }
  return keys;
}

/** Keys allowed on a line. Stable order: id, own fields in declaration order, generated keys not yet listed, own custom fields in schema order. */
function fillableLineKeys(commands: CompositeArchiveCommands, child: ModuleSchema): readonly string[] {
  const keys = ["id"];
  const seen = new Set<string>(keys);
  const push = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  for (const key of commands.childInherits.own) push(key);
  for (const key of Object.keys(commands.generators)) push(key);
  for (const key of ownCustomFieldKeys(child)) push(key);
  return keys;
}

function inheritFieldLabel(spec: CompositeArchiveSpec, key: string): string {
  const onChild = spec.child.fields.find((field) => field.key === key);
  const field = onChild !== undefined ? onChild : spec.parent.fields.find((item) => item.key === key);
  if (field === undefined) {
    throw new RepoError(`Composite archive: inherited field "${key}" is not a field of "${spec.parent.code}" or "${spec.child.code}"`);
  }
  return field.label;
}

/**
 * Validate composite-archive input from the declaration.
 */
function validateCompositeInput(
  spec: CompositeArchiveSpec,
  commands: CompositeArchiveCommands,
  input: CompositeArchiveInput,
  existingParent: BillRecord | null,
  existingChildren: readonly BillRecord[],
): void {
  const fail = (message: string): never => inputError(spec.parent.label, message);

  // Minimum child count
  if (input.lines.length < commands.saveOptions.minChildren) {
    fail(`At least ${commands.saveOptions.minChildren} lines are required`);
  }

  // An unrecognized key on a line must be refused. Dropping it silently makes the caller believe it was written when the store has nothing.
  const fillable = fillableLineKeys(commands, spec.child);
  const fillableSet = new Set(fillable);
  for (const [index, line] of input.lines.entries()) {
    const row = String(index + 1);
    for (const key of Object.keys(line)) {
      if (fillableSet.has(key)) continue;
      if (commands.childInherits.inherit.includes(key)) {
        const label = inheritFieldLabel(spec, key);
        fail(`Line ${row} cannot fill "${label}" on its own: it is decided by the ${spec.parent.label} header and is the same on every ${spec.child.label}`);
      }
      fail(`"${key}" on line ${row} is not a field that can be filled on ${spec.child.label}; fillable fields: ${fillable.join(", ")}`);
    }
  }

  // Frozen-field check
  // Plan A: freeze only when the cell already had a value. Filling a blank is allowed; changing one value to another is refused.
  if (existingChildren.length > 0 && commands.childInherits.frozen.length > 0) {
    for (const field of commands.childInherits.frozen) {
      const existingValue = existingParent?.header[field];
      const existingIsBlank = existingValue === null || existingValue === undefined || existingValue === "";
      const newValue = input.header[field];
      if (!existingIsBlank && newValue !== undefined && newValue !== existingValue) {
        fail(`Once a child exists, field "${field}" cannot be changed`);
      }
    }
  }

  // Joint validation
  for (const validation of commands.validations) {
    if (validation.rule === "requireTogether") {
      const { fields, message } = validation;
      const values = fields.map((f) => input.header[f]);
      const allEmpty = values.every((v) => v === null || v === undefined || v === "");
      const allFilled = values.every((v) => v !== null && v !== undefined && v !== "");
      if (!allEmpty && !allFilled) {
        fail(message);
      }
    } else if (validation.rule === "pattern") {
      const { field, pattern, message } = validation;
      const value = input.header[field];
      if (value !== undefined && value !== null && typeof value === "string") {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          fail(message);
        }
      }
    } else if (validation.rule === "uniqueChild") {
      const { field, message } = validation;
      const seen = new Set<unknown>();
      for (const line of input.lines) {
        const value = line[field];
        if (value !== undefined && value !== null && value !== "") {
          if (seen.has(value)) {
            fail(message);
          }
          seen.add(value);
        }
      }
    }
  }
}

/**
 * Build the child header (field inheritance plus generation).
 */
function buildChildHeader(
  spec: CompositeArchiveSpec,
  commands: CompositeArchiveCommands,
  parentHeader: Readonly<Record<string, unknown>>,
  lineInput: Readonly<Record<string, unknown>>,
  mode: "create" | "update",
): Record<string, unknown> {
  const out: Record<string, unknown> = { [spec.parentField]: parentHeader["id"] };

  // 1. Take child-only fields from lineInput, plus this tenant's own custom fields.
  //    An absent key is not written: on update, a cell that was not sent keeps the stored value.
  for (const key of commands.childInherits.own) {
    if (Object.hasOwn(lineInput, key)) {
      out[key] = lineInput[key];
    }
  }
  for (const key of ownCustomFieldKeys(spec.child)) {
    if (Object.hasOwn(lineInput, key)) {
      out[key] = lineInput[key];
    }
  }

  // 2. Inherit fields from the parent
  const childFieldKeys = new Set(spec.child.fields.map((f) => f.key));
  for (const key of commands.childInherits.inherit) {
    // Skip frozen fields on update
    if (mode === "update" && commands.childInherits.frozen.includes(key)) {
      continue;
    }
    // Inherit only fields that actually exist on the child schema
    if (!childFieldKeys.has(key)) {
      continue;
    }
    // Skip system fields
    const childField = spec.child.fields.find((f) => f.key === key);
    if (childField && isSystemSupplied(childField)) {
      continue;
    }
    if (Object.hasOwn(parentHeader, key)) {
      out[key] = parentHeader[key];
    }
  }

  // 3. Apply field generators
  //
  // Empty means the opposite thing on create and on update. Do not collapse them into one sentence:
  // - create with nothing given generates one;
  // - update with nothing given does not write the cell and keeps the stored value. Collapsing to "generate when absent"
  //   replaces the barcode on every edit, and that barcode is printed on a physical label.
  for (const [field, generator] of Object.entries(commands.generators)) {
    const inputValue = lineInput[field];
    if (mode === "create") {
      out[field] = resolveGeneratedValue(generator, inputValue);
    } else if (userSuppliedValue(inputValue, generator.placeholder)) {
      out[field] = typeof inputValue === "string" ? inputValue.trim() : inputValue;
    }
  }

  return out;
}

/**
 * Generic composite-archive save engine.
 *
 * Drive the save from the `views.composite.commands` declaration:
 * - field inheritance (copy values from the parent)
 * - field generation (declared prefix + uuid; written only when the user did not supply a real value)
 * - field freeze (cannot change once a child exists)
 * - joint checks (requireTogether / pattern / uniqueChild)
 *
 * @example
 * ```typescript
 * const result = await saveCompositeArchive(deps, identity, {
 *   header: { id: "...", name: "Product A", mainUnit: "ea" },
 *   lines: [
 *     { spec: "Spec 1", barcode: "generated after save" },
 *     { spec: "Spec 2", barcode: "custom barcode" },
 *   ],
 * });
 * ```
 */
export async function saveCompositeArchive(
  deps: RuntimeDeps,
  identity: Identity,
  input: CompositeArchiveInput,
): Promise<CompositeArchiveOutput> {
  const spec = findCompositeArchive(deps.catalog);
  const compositeView = spec.parent.views.composite;
  if (compositeView === null || compositeView.commands === null) {
    throw new RepoError(`Composite archive: module "${spec.parent.code}" does not declare commands`);
  }
  const commands = compositeView.commands;
  const fail = (message: string): never => inputError(spec.parent.label, message);

  const parseRemoveIds = (value: unknown): readonly string[] => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return fail("The lines marked for deletion are invalid. Reopen and try again");
    return value.map((id: unknown, index: number) => {
      if (typeof id !== "string" || id.trim() === "") {
        return fail(`Deletion entry ${String(index + 1)} is invalid. Reopen and try again`);
      }
      return id.trim();
    });
  };

  const removeIds = parseRemoveIds(input.removeChildIds);
  const parentId = typeof input.header.id === "string" && input.header.id !== "" ? input.header.id : null;

  return await deps.repos.transaction(async (repos: typeof deps.repos) => {
    const inner: RuntimeDeps = pinClock({ ...deps, repos });
    const lookup = { catalog: deps.catalog, repos, authorizer: deps.authorizer };

    let existingParent: BillRecord | null = null;
    let existingChildren: readonly BillRecord[] = [];

    if (parentId !== null) {
      existingParent = await repos.bills.lockForAction(identity, spec.parent.code, parentId);
      if (input.header.expectedRevision !== undefined) {
        if (!Number.isInteger(input.header.expectedRevision) || input.header.expectedRevision < 1) {
          fail("The revision is invalid. Reopen and try again");
        }
        if (existingParent.revision !== input.header.expectedRevision) {
          throw new StaleRevisionError(
            spec.parent.code,
            existingParent.id,
            input.header.expectedRevision,
            existingParent.revision,
          );
        }
      }
      existingChildren = await listCompositeChildren(lookup, identity, spec, parentId);
      await assertVisibleChildSet(lookup, identity, spec, parentId, existingChildren);
    }

    // Validate input
    validateCompositeInput(spec, commands, input, existingParent, existingChildren);

    // Build the parent header patch
    const parentPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.header)) {
      if (key !== "id" && key !== "expectedRevision") {
        parentPatch[key] = value;
      }
    }

    // Build the write-lock request
    const existingById = new Map(existingChildren.map((row) => [row.id, row]));
    const keep = new Set<string>();
    for (const line of input.lines) {
      if (line.id !== undefined && line.id !== "") {
        if (!existingById.has(line.id)) fail(`Line "${line.id}" does not belong to the current ${spec.parent.label}`);
        keep.add(line.id);
      }
    }
    for (const id of removeIds) {
      if (!existingById.has(id)) fail(`Child "${id}" marked for deletion does not belong to the current ${spec.parent.label}`);
      if (keep.has(id)) fail(`Child "${id}" cannot appear both in the lines and in removeChildIds`);
    }

    const lockRequests: BillWriteLockRequest[] =
      existingParent === null
        ? [{ kind: "create", module: spec.parent.code, header: parentPatch, lines: {} }]
        : [
            {
              kind: "save",
              module: spec.parent.code,
              id: existingParent.id,
              patch: parentPatch,
              lines: null,
            },
          ];

    for (const line of input.lines) {
      if (line.id !== undefined && line.id !== "") {
        lockRequests.push({
          kind: "save",
          module: spec.child.code,
          id: line.id,
          patch: {},
          lines: null,
        });
      } else if (existingParent !== null) {
        lockRequests.push({
          kind: "create",
          module: spec.child.code,
          header: { [spec.parentField]: existingParent.id },
          lines: {},
        });
      }
    }
    for (const id of removeIds) {
      lockRequests.push({ kind: "action", module: spec.child.code, id });
    }

    await repos.bills.lockWriteSet(identity, lockRequests);

    // Save the parent
    const parent =
      existingParent === null
        ? await createBill(inner, identity, spec.parent.code, parentPatch, {})
        : await saveDraft(
            inner,
            identity,
            spec.parent.code,
            existingParent.id,
            parentPatch,
            null,
            existingParent.revision,
          );

    const parentValues = { ...parent.header, id: parent.id, revision: parent.revision };

    // Lock children before create
    if (existingParent === null) {
      await repos.bills.lockWriteSet(
        identity,
        input.lines.map(() => ({
          kind: "create" as const,
          module: spec.child.code,
          header: { [spec.parentField]: parent.id },
          lines: {},
        })),
      );
    }

    // Save children
    const children: Record<string, unknown>[] = [];
    for (const line of input.lines) {
      const mode = line.id ? "update" : "create";
      const header = buildChildHeader(spec, commands, parentValues, line, mode);

      if (line.id) {
        const old = existingById.get(line.id)!;
        const saved = await saveDraft(
          inner,
          identity,
          spec.child.code,
          old.id,
          header,
          null,
          old.revision,
        );
        children.push({ ...saved.header, id: saved.id, revision: saved.revision });
      } else {
        const created = await createBill(inner, identity, spec.child.code, header, {});
        children.push({ ...created.header, id: created.id, revision: created.revision });
      }
    }

    // Delete children
    for (const id of removeIds) {
      const old = existingById.get(id)!;
      await deleteBill(inner, identity, spec.child.code, old.id, old.revision);
    }

    return { parent: parentValues, children };
  });
}

/**
 * Generic composite-archive delete.
 */
export async function removeCompositeArchive(
  deps: RuntimeDeps,
  identity: Identity,
  id: string,
  expectedRevision: number,
): Promise<void> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new RepoError("Delete composite archive: the revision is invalid. Reopen and try again");
  }
  const spec = findCompositeArchive(deps.catalog);
  await deps.repos.transaction(async (repos: typeof deps.repos) => {
    const inner: RuntimeDeps = pinClock({ ...deps, repos });
    const lookup = { catalog: deps.catalog, repos, authorizer: deps.authorizer };
    const parent = await repos.bills.lockForAction(identity, spec.parent.code, id);
    if (parent.revision !== expectedRevision) {
      throw new StaleRevisionError(spec.parent.code, id, expectedRevision, parent.revision);
    }
    const children = await listCompositeChildren(lookup, identity, spec, id);
    await assertVisibleChildSet(lookup, identity, spec, id, children);
    await repos.bills.lockWriteSet(identity, [
      { kind: "action", module: spec.parent.code, id },
      ...children.map((child) => ({ kind: "action" as const, module: spec.child.code, id: child.id })),
    ]);
    for (const child of children) {
      await deleteBill(inner, identity, spec.child.code, child.id, child.revision);
    }
    await deleteBill(inner, identity, spec.parent.code, parent.id, parent.revision);
  });
}

