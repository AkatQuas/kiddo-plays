// Catalog view, expansion, and checks for role grants.
// The declared shape lives in productAuthorization.ts. This file does zero IO and knows no concrete module.
// expand is the runtime path: expired coordinates are dropped, not thrown. validate throws RoleGrantError.

import {
  assertScopeConditionValues,
  isLiteralScopeOp,
  isScopeBindingOp,
  isScopeTimeFieldType,
  parseScopeValue,
  SCOPE_CONDITION_OPS,
  scopeValueKey,
} from "./access.js";
import type { ScopeCondition, ScopeConditionOp, ScopeValue } from "./access.js";
import { isCustomFieldKey } from "./customField.js";
import {
  isModuleRoleGrant,
  isSystemRoleGrant,
  type ModuleRoleGrant,
  type RoleGrant,
} from "./productAuthorization.js";
import { linePathOf } from "../normalize/query.js";
import { relationsOf } from "../relations/relations.js";
import type { ModuleSchema } from "./module.js";
import {
  MODULE_PERMISSION_ACTIONS,
  MODULE_ROLE_GRANT_ACTIONS,
  MODULE_PERMISSION_ACTION_LABELS,
  fieldPermissionKey,
  modulePermissionKey,
  transitionPermissionKey,
  type FieldPermissionAction,
  type ModulePermissionAction,
  type ModuleRoleGrantAction,
} from "./permissions.js";

export class RoleGrantError extends Error {
  override readonly name = "RoleGrantError";

  constructor(message: string) {
    super(message);
  }
}

export interface RoleGrantPermissionRef {
  readonly key: string;
  readonly kind: "module" | "transition" | "field" | "system";
  readonly module: string | null;
  readonly action: string;
  readonly field: string | null;
  readonly transition: string | null;
  readonly label: string;
  readonly dataScoped: boolean;
}

export interface RoleGrantScopeFieldRef {
  readonly module: string;
  readonly field: string;
  readonly label: string;
  readonly type: string;
  readonly ops: readonly ScopeConditionOp[];
}

export interface RoleGrantTransitionRef {
  readonly code: string;
  readonly action: string;
}

export interface RoleGrantModuleSlice {
  readonly code: string;
  readonly label: string;
  /** Module actions the catalog actually emits, in MODULE_ROLE_GRANT_ACTIONS order. */
  readonly actions: readonly ModuleRoleGrantAction[];
  /** Non-internal business actions (one item per code), in declaration order. */
  readonly transitions: readonly RoleGrantTransitionRef[];
  /** Field paths with kind=field and action=read, in permissions order. */
  readonly fieldPaths: readonly string[];
  readonly customFieldKeys: readonly string[];
  readonly scopeFields: readonly RoleGrantScopeFieldRef[];
}

export interface RoleGrantCatalog {
  readonly modules: ReadonlyMap<string, RoleGrantModuleSlice>;
  readonly byKey: ReadonlyMap<string, RoleGrantPermissionRef>;
  /** kind=system key → permission row. Duplicate system-permission copy uses the label here. */
  readonly systemByKey: ReadonlyMap<string, RoleGrantPermissionRef>;
  /** The whole module table. Expansion uses relationsOf for non-derived outbound edges. */
  readonly schemas: readonly ModuleSchema[];
}

export interface RoleGrantCatalogInput {
  readonly modules: readonly {
    readonly code: string;
    readonly label: string;
    /**
     * Business actions, one item per code (the output of `transitionActions(lifecycle)`). Not edges: the same action
     * has one edge at each start, but the permission coordinate is a single `module:<m>:transition:<code>`.
     */
    readonly transitions: readonly {
      readonly code: string;
      readonly action: string;
      readonly internal?: boolean;
    }[];
  }[];
  readonly permissions: readonly RoleGrantPermissionRef[];
  readonly scopeFields: readonly RoleGrantScopeFieldRef[];
  readonly customFieldKeys?: ReadonlyMap<string, readonly string[]>;
  readonly schemas: readonly ModuleSchema[];
}

interface MutableSlice {
  code: string;
  label: string;
  actions: ModuleRoleGrantAction[];
  transitions: RoleGrantTransitionRef[];
  fieldPaths: string[];
  customFieldKeys: string[];
  scopeFields: RoleGrantScopeFieldRef[];
}

export function roleGrantCatalog(input: RoleGrantCatalogInput): RoleGrantCatalog {
  const slices = new Map<string, MutableSlice>();
  for (const module of input.modules) {
    if (slices.has(module.code)) throw new RoleGrantError(`module "${module.code}" is duplicated in the permission catalog`);
    const codes = module.transitions.map((transition) => transition.code);
    const repeated = codes.filter((code, index) => codes.indexOf(code) !== index);
    if (repeated.length) {
      throw new RoleGrantError(
        `action "${[...new Set(repeated)].join(", ")}" on module "${module.code}" is duplicated in the permission catalog — this collects actions, not edges, ` +
          `and one code is given only one item`,
      );
    }
    slices.set(module.code, {
      code: module.code,
      label: module.label,
      actions: [],
      transitions: module.transitions
        .filter((transition) => transition.internal !== true)
        .map((transition) => ({ code: transition.code, action: transition.action })),
      fieldPaths: [],
      customFieldKeys: [...(input.customFieldKeys?.get(module.code) ?? [])],
      scopeFields: [],
    });
  }

  const byKey = new Map<string, RoleGrantPermissionRef>();
  const systemByKey = new Map<string, RoleGrantPermissionRef>();
  const actionSeen = new Map<string, Set<ModulePermissionAction>>();
  const fieldSeen = new Map<string, Set<string>>();
  for (const permission of input.permissions) {
    if (permission.key.trim() === "") throw new RoleGrantError("a coordinate in the permission catalog must not be empty");
    if (byKey.has(permission.key)) throw new RoleGrantError(`coordinate "${permission.key}" is duplicated in the permission catalog`);
    byKey.set(permission.key, permission);
    if (permission.kind === "system") systemByKey.set(permission.key, permission);
    const moduleCode = permission.module;
    if (moduleCode === null || !slices.has(moduleCode)) continue;
    if (permission.kind === "module" && isModulePermissionAction(permission.action)) {
      const seen = actionSeen.get(moduleCode) ?? new Set<ModulePermissionAction>();
      seen.add(permission.action);
      actionSeen.set(moduleCode, seen);
    }
    if (permission.kind === "field" && permission.action === "read" && permission.field !== null && permission.field !== "") {
      const seen = fieldSeen.get(moduleCode) ?? new Set<string>();
      if (seen.has(permission.field)) continue;
      seen.add(permission.field);
      fieldSeen.set(moduleCode, seen);
      slices.get(moduleCode)?.fieldPaths.push(permission.field);
    }
  }

  for (const field of input.scopeFields) {
    slices.get(field.module)?.scopeFields.push(field);
  }
  for (const [code, slice] of slices) {
    const seen = actionSeen.get(code);
    slice.actions = MODULE_ROLE_GRANT_ACTIONS.filter((action) => seen?.has(action) === true);
  }

  const modules = new Map<string, RoleGrantModuleSlice>();
  for (const [code, slice] of slices) {
    modules.set(code, {
      code: slice.code,
      label: slice.label,
      actions: slice.actions,
      transitions: slice.transitions,
      fieldPaths: slice.fieldPaths,
      customFieldKeys: slice.customFieldKeys,
      scopeFields: slice.scopeFields,
    });
  }
  return { modules, byKey, systemByKey, schemas: input.schemas };
}

export interface ExpandedRoleScope {
  readonly module: string;
  readonly groups: readonly (readonly ScopeCondition[])[];
}

export interface ExpandedRoleGrant {
  readonly permissions: readonly string[];
  /** Present only when this row still has a read coordinate after expansion. An empty groups array means all. */
  readonly scope: ExpandedRoleScope | null;
}

export interface DerivedPermissionOrigin {
  readonly key: string;
  readonly fromModule: string;
  readonly fromLabel: string;
}

export interface ExpandedRoleGrants {
  readonly permissions: readonly string[];
  readonly scopes: readonly ExpandedRoleScope[];
  /** Coordinates that were derived and that no row's own expansion already had. */
  readonly derived: readonly DerivedPermissionOrigin[];
}

export function expandRoleGrant(catalog: RoleGrantCatalog, grant: RoleGrant): ExpandedRoleGrant {
  if (isSystemRoleGrant(grant)) {
    return {
      permissions: typeof grant.systemKey === "string" && catalog.byKey.has(grant.systemKey) ? [grant.systemKey] : [],
      scope: null,
    };
  }
  if (!isModuleRoleGrant(grant) || typeof grant.module !== "string") return { permissions: [], scope: null };

  const slice = catalog.modules.get(grant.module);
  const actions = Array.isArray(grant.actions) ? grant.actions : [];
  const actionSet = new Set<string>(actions);
  const permissions: string[] = [];
  for (const action of MODULE_ROLE_GRANT_ACTIONS) {
    if (!actionSet.has(action)) continue;
    const key = tryModuleActionKey(grant.module, action);
    if (key !== null && catalog.byKey.has(key)) permissions.push(key);
  }
  for (const transition of matchingTransitions(slice?.transitions ?? [], grant.buttons)) {
    const key = tryTransitionKey(grant.module, transition.code);
    if (key !== null && catalog.byKey.has(key)) permissions.push(key);
  }
  const except = exceptOf(grant.fields);
  if (except !== null) {
    const wantRead = actionSet.has("read");
    const wantWrite = actionSet.has("create") || actionSet.has("update");
    for (const path of slice?.fieldPaths ?? []) {
      if (except.has(path)) continue;
      if (wantRead) pushField(permissions, catalog, grant.module, path, "read");
      if (wantWrite) pushField(permissions, catalog, grant.module, path, "write");
    }
  }

  const readKey = tryModuleActionKey(grant.module, "read");
  const hasData = readKey !== null && permissions.includes(readKey);
  return {
    permissions,
    scope: hasData ? { module: grant.module, groups: scopeGroupsOf(grant.scope) } : null,
  };
}

export function expandRoleGrants(catalog: RoleGrantCatalog, grants: readonly RoleGrant[]): ExpandedRoleGrants {
  const permissions: string[] = [];
  const seenPermissions = new Set<string>();
  const scopes: ExpandedRoleScope[] = [];
  const seenModules = new Set<string>();
  for (const grant of grants) {
    const expanded = expandRoleGrant(catalog, grant);
    for (const key of expanded.permissions) {
      if (seenPermissions.has(key)) continue;
      seenPermissions.add(key);
      permissions.push(key);
    }
    if (!isModuleRoleGrant(grant) || seenModules.has(grant.module)) continue;
    seenModules.add(grant.module);
    if (expanded.scope !== null) scopes.push(expanded.scope);
  }
  const direct = new Set(permissions);
  const derived = deriveLookupPermissions(catalog, grants, permissions, seenPermissions, scopes, seenModules, direct);
  return { permissions, scopes, derived };
}

const DERIVE_ACTIONS = ["read", "create", "update"] as const;

/**
 * View / Create / Edit derive the target's lookup and field read. lookup opens only reference candidates. It does not open the module list, detail, or menu, and it does not supply the display name on a document. It is not the target's read.
 * Outbound edges are the non-derived refs from relationsOf (header and lines). A reference dropped by fields.except is not derived.
 * When the target already has a module row, no extra field read or scope is added; otherwise field read is fully open and the scope is all. read is not added.
 */
function deriveLookupPermissions(
  catalog: RoleGrantCatalog,
  grants: readonly RoleGrant[],
  permissions: string[],
  seenPermissions: Set<string>,
  scopes: ExpandedRoleScope[],
  seenModules: Set<string>,
  direct: ReadonlySet<string>,
): DerivedPermissionOrigin[] {
  const grantModules = new Set<string>();
  for (const grant of grants) {
    if (isModuleRoleGrant(grant)) grantModules.add(grant.module);
  }
  const derived: DerivedPermissionOrigin[] = [];
  for (const grant of grants) {
    if (!isModuleRoleGrant(grant)) continue;
    const actions = new Set<string>(Array.isArray(grant.actions) ? grant.actions : []);
    if (!DERIVE_ACTIONS.some((action) => actions.has(action))) continue;
    const except = exceptOf(grant.fields);
    if (except === null) continue;
    const slice = catalog.modules.get(grant.module);
    const fromLabel = moduleLabel(catalog, grant.module, slice?.label);
    const targets = new Set<string>();
    for (const relation of outboundRefs(catalog, grant.module)) {
      const path = relation.through === null ? relation.field : linePathOf(relation.through, relation.field);
      if (except.has(path)) continue;
      targets.add(relation.to);
    }
    for (const target of targets) {
      const lookupKey = tryModuleActionKey(target, "lookup");
      if (lookupKey === null || !catalog.byKey.has(lookupKey)) continue;
      pushDerived(permissions, seenPermissions, derived, direct, lookupKey, grant.module, fromLabel);
      if (grantModules.has(target)) continue;
      for (const path of catalog.modules.get(target)?.fieldPaths ?? []) {
        const key = tryFieldKey(target, path, "read");
        if (key === null || !catalog.byKey.has(key)) continue;
        pushDerived(permissions, seenPermissions, derived, direct, key, grant.module, fromLabel);
      }
      if (seenModules.has(target)) continue;
      seenModules.add(target);
      scopes.push({ module: target, groups: [] });
    }
  }
  return derived;
}

function pushDerived(
  permissions: string[],
  seenPermissions: Set<string>,
  derived: DerivedPermissionOrigin[],
  direct: ReadonlySet<string>,
  key: string,
  fromModule: string,
  fromLabel: string,
): void {
  if (!seenPermissions.has(key)) {
    seenPermissions.add(key);
    permissions.push(key);
  }
  if (!direct.has(key)) derived.push({ key, fromModule, fromLabel });
}

function moduleLabel(catalog: RoleGrantCatalog, code: string, sliceLabel: string | undefined): string {
  if (sliceLabel !== undefined && sliceLabel.trim() !== "") return sliceLabel;
  const schemaLabel = catalog.schemas.find((schema) => schema.code === code)?.label;
  if (schemaLabel !== undefined && schemaLabel.trim() !== "") return schemaLabel;
  return code;
}

function outboundRefs(catalog: RoleGrantCatalog, code: string) {
  if (!catalog.schemas.some((schema) => schema.code === code)) return [];
  return relationsOf(catalog.schemas, code).outbound;
}

export function validateRoleGrant(catalog: RoleGrantCatalog, grant: RoleGrant): void {
  if ("module" in grant && "systemKey" in grant) {
    throw new RoleGrantError("one grant cannot be both a module permission and a system permission");
  }
  if (isSystemRoleGrant(grant)) {
    if (typeof grant.systemKey !== "string" || !catalog.systemByKey.has(grant.systemKey)) {
      const key = typeof grant.systemKey === "string" ? grant.systemKey : "";
      throw new RoleGrantError(`the current permission catalog has no system permission "${key}"`);
    }
    return;
  }
  if (!isModuleRoleGrant(grant)) throw new RoleGrantError("one grant must be a module permission or a system permission");
  const slice = typeof grant.module === "string" ? catalog.modules.get(grant.module) : undefined;
  if (slice === undefined) {
    const code = typeof grant.module === "string" ? grant.module : "";
    throw new RoleGrantError(`the current permission catalog has no module "${code}"`);
  }
  validateActions(slice, grant);
  validateButtons(slice, grant);
  validateFields(slice, grant);
  validateScope(slice, grant);
}

export function validateRoleGrants(catalog: RoleGrantCatalog, grants: readonly RoleGrant[]): void {
  for (const grant of grants) validateRoleGrant(catalog, grant);
  const modules = new Set<string>();
  const systems = new Set<string>();
  for (const grant of grants) {
    if (isModuleRoleGrant(grant)) {
      if (modules.has(grant.module)) {
        throw new RoleGrantError(`the grant for module "${catalog.modules.get(grant.module)?.label ?? grant.module}" is duplicated`);
      }
      modules.add(grant.module);
      continue;
    }
    if (!isSystemRoleGrant(grant)) continue;
    if (systems.has(grant.systemKey)) {
      const label = catalog.systemByKey.get(grant.systemKey)?.label;
      const name = label !== undefined && label.trim() !== "" ? label : grant.systemKey;
      throw new RoleGrantError(`system permission "${name}" is duplicated`);
    }
    systems.add(grant.systemKey);
  }
}

function validateActions(slice: RoleGrantModuleSlice, grant: ModuleRoleGrant): void {
  if (!Array.isArray(grant.actions) || grant.actions.length === 0) {
    throw new RoleGrantError(`module "${slice.label}" must check at least one operation.`);
  }
  const seen = new Set<ModuleRoleGrantAction>();
  for (const action of grant.actions) {
    if (!isModuleRoleGrantAction(action)) {
      throw new RoleGrantError(`action "${String(action)}" on module "${slice.label}" is invalid.`);
    }
    if (!slice.actions.includes(action)) {
      throw new RoleGrantError(`module "${slice.label}" has no "${actionLabel(action)}".`);
    }
    if (seen.has(action)) throw new RoleGrantError(`"${actionLabel(action)}" on module "${slice.label}" is duplicated`);
    seen.add(action);
  }
}

function validateButtons(slice: RoleGrantModuleSlice, grant: ModuleRoleGrant): void {
  if (grant.buttons === "all") return;
  if (!Array.isArray(grant.buttons)) throw new RoleGrantError(`buttons on module "${slice.label}" must be all or button names`);
  const known = new Set(slice.transitions.map((transition) => transition.action));
  const seen = new Set<string>();
  for (const name of grant.buttons) {
    if (typeof name !== "string" || !known.has(name)) {
      throw new RoleGrantError(`module "${slice.label}" has no button "${typeof name === "string" ? name : ""}"`);
    }
    if (seen.has(name)) throw new RoleGrantError(`button "${name}" on module "${slice.label}" is duplicated`);
    seen.add(name);
  }
}

function validateFields(slice: RoleGrantModuleSlice, grant: ModuleRoleGrant): void {
  if (grant.fields === "all") return;
  if (!isFieldExcept(grant.fields)) throw new RoleGrantError(`fields on module "${slice.label}" must be all or an exclusion list`);
  const seen = new Set<string>();
  for (const path of grant.fields.except) {
    if (typeof path !== "string") throw new RoleGrantError(`module "${slice.label}" has no field ""`);
    if (seen.has(path)) throw new RoleGrantError(`field "${path}" on module "${slice.label}" is duplicated`);
    seen.add(path);
    if (!fieldAllowed(slice, path)) throw new RoleGrantError(`module "${slice.label}" has no field "${path}"`);
  }
}

function validateScope(slice: RoleGrantModuleSlice, grant: ModuleRoleGrant): void {
  if (grant.scope !== null && !Array.isArray(grant.scope)) {
    throw new RoleGrantError(`the data scope of module "${slice.label}" is malformed`);
  }
  const groups = grant.scope ?? [];
  if (groups.length === 0) return;
  if (!grant.actions.includes("read")) {
    throw new RoleGrantError(`module "${slice.label}" has no "View" permission, so a data scope cannot be configured.`);
  }
  for (const group of groups) {
    if (!Array.isArray(group)) throw new RoleGrantError(`the data scope of module "${slice.label}" is malformed`);
    const seen = new Set<string>();
    for (const raw of group) {
      const condition = readCondition(raw, slice.label);
      const scopeField = slice.scopeFields.find((item) => item.field === condition.field);
      if (scopeField === undefined) {
        throw new RoleGrantError(`field "${condition.field}" on module "${slice.label}" is not a configurable data scope`);
      }
      const op = scopeOp(slice.label, scopeField, condition.op);
      rejectScopeValues(slice.label, scopeField, op, condition.values);
      if (seen.has(condition.field)) {
        throw new RoleGrantError(`"${scopeField.label}" on module "${slice.label}" is duplicated in the same group`);
      }
      seen.add(condition.field);
    }
  }
}

function readCondition(raw: unknown, moduleLabel: string): { readonly field: string; readonly op: string; readonly values: unknown } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new RoleGrantError(`a data-scope condition on module "${moduleLabel}" is malformed`);
  }
  const body = raw as Record<string, unknown>;
  const field = body["field"];
  const op = body["op"];
  if (typeof field !== "string" || field.trim() === "") {
    throw new RoleGrantError(`a data scope on module "${moduleLabel}" is missing a field`);
  }
  if (typeof op !== "string" || op.trim() === "") {
    throw new RoleGrantError(`a data scope on module "${moduleLabel}" is missing a condition`);
  }
  return { field: field.trim(), op: op.trim(), values: body["values"] };
}

function scopeOp(moduleLabel: string, scopeField: RoleGrantScopeFieldRef, op: string): ScopeConditionOp {
  if (!(SCOPE_CONDITION_OPS as readonly string[]).includes(op) || !scopeField.ops.includes(op as ScopeConditionOp)) {
    throw new RoleGrantError(`"${scopeField.label}" on module "${moduleLabel}" does not support "${op}"`);
  }
  return op as ScopeConditionOp;
}

function rejectScopeValues(
  moduleLabel: string,
  scopeField: RoleGrantScopeFieldRef,
  op: ScopeConditionOp,
  rawValues: unknown,
): void {
  const at = `module "${moduleLabel}" field "${scopeField.label}"`;
  if (!Array.isArray(rawValues)) throw new RoleGrantError(`${at} scope values must be an array`);
  const values = op === "specified" ? specifiedValues(at, rawValues) : literalValues(at, scopeField, rawValues);
  if (new Set(values.map(scopeValueKey)).size !== values.length) {
    throw new RoleGrantError(`${at} scope values are duplicated`);
  }
  if (isScopeTimeFieldType(scopeField.type)) {
    assertScopeValues(scopeField.type, op, values, at);
    return;
  }
  if (op === "between" && values.length !== 2) {
    throw new RoleGrantError(`${at} a range must be exactly two values`);
  }
  if ((op === "is_empty" || op === "not_empty" || (isScopeBindingOp(op) && op !== "specified")) && values.length > 0) {
    throw new RoleGrantError(`${at} must not set scope values when using "${op}"`);
  }
  if (isLiteralScopeOp(op) && op !== "is_empty" && op !== "not_empty" && op !== "between" && values.length === 0) {
    throw new RoleGrantError(`${at} must set scope values when using "${op}"`);
  }
}

function specifiedValues(at: string, rawValues: readonly unknown[]): readonly ScopeValue[] {
  if (rawValues.length === 0) throw new RoleGrantError(`${at} a specified scope must select a resource`);
  return rawValues.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new RoleGrantError(`${at} a specified-scope value must be a resource id`);
    }
    return value.trim();
  });
}

function literalValues(at: string, scopeField: RoleGrantScopeFieldRef, rawValues: readonly unknown[]): readonly ScopeValue[] {
  if (isScopeTimeFieldType(scopeField.type)) {
    return rawValues.map((value, index) => {
      try {
        return parseScopeValue(value, `${at}.values[${String(index)}]`);
      } catch (error) {
        throw new RoleGrantError(error instanceof Error ? error.message : "the data-scope value is invalid");
      }
    });
  }
  return rawValues.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new RoleGrantError(`${at} a scope value must be a non-empty string`);
    }
    return value.trim();
  });
}

function assertScopeValues(
  fieldType: string,
  op: ScopeConditionOp,
  values: readonly ScopeValue[],
  at: string,
): void {
  try {
    assertScopeConditionValues(fieldType, op, values, at);
  } catch (error) {
    if (error instanceof RoleGrantError) throw error;
    throw new RoleGrantError(error instanceof Error ? error.message : "the data-scope value is invalid");
  }
}

function fieldAllowed(slice: RoleGrantModuleSlice, path: string): boolean {
  return slice.fieldPaths.includes(path) || slice.customFieldKeys.includes(path) || isCustomFieldKey(path);
}

function isFieldExcept(fields: ModuleRoleGrant["fields"]): fields is { readonly except: readonly string[] } {
  return typeof fields === "object" && fields !== null && "except" in fields && Array.isArray(fields.except);
}

function exceptOf(fields: ModuleRoleGrant["fields"]): ReadonlySet<string> | null {
  if (fields === "all") return new Set();
  if (!isFieldExcept(fields)) return null;
  return new Set(fields.except.filter((path): path is string => typeof path === "string"));
}

function matchingTransitions(
  transitions: readonly RoleGrantTransitionRef[],
  buttons: ModuleRoleGrant["buttons"],
): readonly RoleGrantTransitionRef[] {
  if (buttons === "all") return transitions;
  if (!Array.isArray(buttons)) return [];
  const wanted = new Set(buttons.filter((name): name is string => typeof name === "string"));
  return transitions.filter((transition) => wanted.has(transition.action));
}

function scopeGroupsOf(scope: ModuleRoleGrant["scope"]): readonly (readonly ScopeCondition[])[] {
  return Array.isArray(scope) ? scope : [];
}

function pushField(
  permissions: string[],
  catalog: RoleGrantCatalog,
  module: string,
  field: string,
  action: FieldPermissionAction,
): void {
  const key = tryFieldKey(module, field, action);
  if (key !== null && catalog.byKey.has(key)) permissions.push(key);
}

function isModulePermissionAction(value: string): value is ModulePermissionAction {
  return (MODULE_PERMISSION_ACTIONS as readonly string[]).includes(value);
}

function isModuleRoleGrantAction(value: string): value is ModuleRoleGrantAction {
  return (MODULE_ROLE_GRANT_ACTIONS as readonly string[]).includes(value);
}

function actionLabel(action: string): string {
  return isModulePermissionAction(action) ? MODULE_PERMISSION_ACTION_LABELS[action] : action;
}

function canSegment(value: string): boolean {
  return value.trim() !== "" && !value.includes(":");
}

function tryModuleActionKey(module: string, action: ModulePermissionAction): string | null {
  if (!canSegment(module)) return null;
  return modulePermissionKey(module, action);
}

function tryTransitionKey(module: string, code: string): string | null {
  if (!canSegment(module) || !canSegment(code)) return null;
  return transitionPermissionKey(module, code);
}

function tryFieldKey(module: string, field: string, action: FieldPermissionAction): string | null {
  if (!canSegment(module) || !canSegment(field)) return null;
  return fieldPermissionKey(module, field, action);
}
