import path from "node:path";
import {
  APPLICATION_CODE_PATTERN,
  MODULE_ROLE_GRANT_ACTIONS,
  SCOPE_CONDITION_OPS,
  isCustomFieldKey,
  isRbacRoleCode,
  isPlatformField,
  isRelativeDateValue,
  transitionActions,
  type ModuleRoleGrantAction,
  type ProductApplicationDeclaration,
  type RoleGrant,
  type RoleSeedFragment,
  type ScopeCondition,
  type ScopeConditionOp,
  type ScopeValue,
  type AffiliationSyncDeclaration,
  type ScopeOrgTreeDeclaration,
  type ScopeTargetDeclaration,
  type SubjectDirectoryDeclaration,
} from "@open-erp/metamodel";
import type { LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importDefault } from "./filesystem.js";

export interface ProductAuthorization {
  readonly applications: readonly ProductApplicationDeclaration[];
  readonly roles: readonly RoleSeedFragment[];
  readonly orgTree: ScopeOrgTreeDeclaration | null;
  readonly scopeTargets: readonly ScopeTargetDeclaration[];
  readonly affiliationSyncs: readonly AffiliationSyncDeclaration[];
  readonly subjectDirectory: SubjectDirectoryDeclaration | null;
}

interface LocatedFragment {
  readonly domain: string;
  readonly value: unknown;
}

function object(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${at} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${at} must be a non-empty string`);
  return value.trim();
}

function array(value: unknown, at: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${at} must be an array`);
  return value;
}

function optionalArray(value: unknown, at: string): readonly unknown[] {
  return value === undefined ? [] : array(value, at);
}

function closed(raw: Record<string, unknown>, keys: readonly string[], at: string): void {
  const unknown = Object.keys(raw).filter((key) => !keys.includes(key));
  if (unknown.length) fail(`${at} has unknown keys "${unknown.join(", ")}"`);
}

function moduleOf(modules: ReadonlyMap<string, LoadedModule>, code: string, at: string): LoadedModule {
  const found = modules.get(code);
  if (!found) fail(`${at} references an unknown module "${code}"`);
  return found;
}

function headerField(module: LoadedModule, key: string, at: string): void {
  if (isPlatformField(key)) return;
  const field = module.schema.fields.find((candidate) => candidate.key === key);
  if (!field || field.type === "subtable") fail(`${at} references a header field "${key}" that does not exist on ${module.code}`);
}

function enumList<T extends string>(value: unknown, allowed: readonly T[], at: string): readonly T[] {
  const values = array(value, at).map((item, index) => text(item, `${at}[${String(index)}]`));
  for (const item of values) if (!(allowed as readonly string[]).includes(item)) fail(`${at} contains an unknown value "${item}"`);
  if (new Set(values).size !== values.length) fail(`${at} must not contain duplicates`);
  return values.map((value) => value as T);
}

function declaredFieldPaths(module: LoadedModule): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const field of module.schema.fields) {
    paths.add(field.key);
    if (field.type !== "subtable" || field.fields === null) continue;
    for (const line of field.fields) paths.add(`${field.key}.${line.key}`);
  }
  return paths;
}

function normalizeButtons(raw: unknown, loaded: LoadedModule, at: string): "all" | readonly string[] {
  if (raw === "all") return "all";
  const names = array(raw, `${at}.buttons`).map((item, index) => text(item, `${at}.buttons[${String(index)}]`));
  if (new Set(names).size !== names.length) fail(`${at}.buttons must not contain duplicates`);
  const known = new Set(transitionActions(loaded.schema.lifecycle)
    .filter((transition) => transition.internal !== true)
    .map((transition) => transition.action));
  for (const name of names) {
    if (!known.has(name)) fail(`${at}.buttons references an unknown button "${name}"`);
  }
  return names;
}

function normalizeFields(raw: unknown, loaded: LoadedModule, at: string): "all" | { readonly except: readonly string[] } {
  if (raw === "all") return "all";
  const body = object(raw, `${at}.fields`);
  closed(body, ["except"], `${at}.fields`);
  const except = array(body["except"], `${at}.fields.except`).map((item, index) => text(item, `${at}.fields.except[${String(index)}]`));
  if (new Set(except).size !== except.length) fail(`${at}.fields.except must not contain duplicates`);
  const known = declaredFieldPaths(loaded);
  for (const path of except) {
    if (!known.has(path) && !isCustomFieldKey(path)) fail(`${at}.fields.except references an unknown field "${path}"`);
  }
  return { except };
}

function scopeValues(value: unknown, at: string): readonly ScopeValue[] {
  return array(value, at).map((item, index) => {
    const itemAt = `${at}[${String(index)}]`;
    if (typeof item === "string") {
      if (!item.trim()) fail(`${itemAt} must be a non-empty string`);
      return item.trim();
    }
    if (isRelativeDateValue(item)) return item;
    fail(`${itemAt} must be a non-empty string or a relative time`);
  });
}

function normalizeScope(
  raw: unknown,
  loaded: LoadedModule,
  at: string,
): readonly (readonly ScopeCondition[])[] | null {
  if (raw === null) return null;
  return array(raw, `${at}.scope`).map((group, groupIndex) => {
    const groupAt = `${at}.scope[${String(groupIndex)}]`;
    return array(group, groupAt).map((item, index) => {
      const itemAt = `${groupAt}[${String(index)}]`;
      const condition = object(item, itemAt);
      closed(condition, ["field", "op", "values"], itemAt);
      const field = text(condition["field"], `${itemAt}.field`);
      headerField(loaded, field, `${itemAt}.field`);
      const op = text(condition["op"], `${itemAt}.op`);
      if (!(SCOPE_CONDITION_OPS as readonly string[]).includes(op)) fail(`${itemAt}.op "${op}" is not a scope-condition operator`);
      return { field, op: op as ScopeConditionOp, values: scopeValues(condition["values"], `${itemAt}.values`) };
    });
  });
}

function normalizeGrant(rawValue: unknown, modules: ReadonlyMap<string, LoadedModule>, domain: string, at: string): RoleGrant {
  const raw = object(rawValue, at);
  if ("systemKey" in raw) {
    closed(raw, ["systemKey"], at);
    return { systemKey: text(raw["systemKey"], `${at}.systemKey`) };
  }
  closed(raw, ["module", "actions", "buttons", "fields", "scope"], at);
  const module = text(raw["module"], `${at}.module`);
  const loaded = moduleOf(modules, module, at);
  if (loaded.domain !== domain) {
    fail(`${at} can grant permissions only on this domain's modules: ${domain} cannot declare ${loaded.domain}/${module}`);
  }
  const listed = enumList(raw["actions"], MODULE_ROLE_GRANT_ACTIONS, `${at}.actions`) as readonly ModuleRoleGrantAction[];
  if (listed.length === 0) fail(`${at}.actions must not be empty`);
  const actions: readonly ModuleRoleGrantAction[] = listed;
  const buttons = normalizeButtons(raw["buttons"], loaded, at);
  const fields = normalizeFields(raw["fields"], loaded, at);
  const scope = normalizeScope(raw["scope"], loaded, at);
  // null and an empty array both mean the whole module is visible. A non-empty scope travels only with read.
  if (scope !== null && scope.length > 0 && !actions.includes("read")) {
    fail(`Module "${loaded.schema.label}" has no "read" permission, so a data scope cannot be configured.`);
  }
  return { module, actions, buttons, fields, scope };
}

function normalizeRole(rawValue: unknown, modules: ReadonlyMap<string, LoadedModule>, domain: string, at: string): RoleSeedFragment {
  const raw = object(rawValue, at);
  closed(raw, ["code", "name", "description", "grants"], at);
  const code = text(raw["code"], `${at}.code`);
  if (!isRbacRoleCode(code)) fail(`${at}.code "${code}" is not a legal role code`);
  return {
    code,
    name: text(raw["name"], `${at}.name`),
    description: text(raw["description"], `${at}.description`),
    grants: array(raw["grants"], `${at}.grants`).map((grant, index) =>
      normalizeGrant(grant, modules, domain, `${at}.grants[${String(index)}]`)),
  };
}

function normalizeApplication(rawValue: unknown, at: string): ProductApplicationDeclaration {
  const raw = object(rawValue, at);
  closed(raw, ["code", "name"], at);
  const code = text(raw["code"], `${at}.code`);
  // code enters the mobile routing protocol and cannot be quietly trimmed and accepted the way ordinary display text can.
  if (raw["code"] !== code || !APPLICATION_CODE_PATTERN.test(code)) {
    fail(`${at}.code "${String(raw["code"])}" is not a legal stable identifier: it must be lowercase kebab-case, for example boss-mobile / report-mobile`);
  }
  return {
    code,
    name: text(raw["name"], `${at}.name`),
  };
}

function normalizeOrgTree(
  rawValue: unknown,
  modules: ReadonlyMap<string, LoadedModule>,
  domain: string,
  at: string,
): ScopeOrgTreeDeclaration {
  const raw = object(rawValue, at);
  closed(raw, ["module", "parentField", "typeField"], at);
  const module = text(raw["module"], `${at}.module`);
  const loaded = moduleOf(modules, module, at);
  if (loaded.domain !== domain) fail(`${at} org-tree module must be owned by the current domain`);
  headerField(loaded, text(raw["parentField"], `${at}.parentField`), at);
  headerField(loaded, text(raw["typeField"], `${at}.typeField`), at);
  return {
    module,
    parentField: text(raw["parentField"], `${at}.parentField`),
    typeField: text(raw["typeField"], `${at}.typeField`),
  };
}

function normalizeAffiliationSync(rawValue: unknown, modules: ReadonlyMap<string, LoadedModule>, domain: string, at: string): AffiliationSyncDeclaration {
  const raw = object(rawValue, at);
  closed(raw, ["fromModule", "userIdField", "displayField", "orgField", "orgTypeField", "orgTypeValue", "activeStatus"], at);
  const fromModule = text(raw["fromModule"], `${at}.fromModule`);
  const loaded = moduleOf(modules, fromModule, at);
  if (loaded.domain !== domain) fail(`${at} can declare affiliation sync only for this domain's modules`);
  headerField(loaded, text(raw["userIdField"], `${at}.userIdField`), at);
  headerField(loaded, text(raw["displayField"], `${at}.displayField`), at);
  headerField(loaded, text(raw["orgField"], `${at}.orgField`), at);
  const activeStatus = text(raw["activeStatus"], `${at}.activeStatus`);
  if (!loaded.schema.lifecycle.statuses.some((status) => status.key === activeStatus)) {
    fail(`${at}.activeStatus "${activeStatus}" is not a status declared by ${fromModule}`);
  }
  return {
    fromModule,
    userIdField: text(raw["userIdField"], `${at}.userIdField`),
    displayField: text(raw["displayField"], `${at}.displayField`),
    orgField: text(raw["orgField"], `${at}.orgField`),
    orgTypeField: text(raw["orgTypeField"], `${at}.orgTypeField`),
    orgTypeValue: text(raw["orgTypeValue"], `${at}.orgTypeValue`),
    activeStatus,
  };
}

function normalizeSubjectDirectory(
  rawValue: unknown,
  modules: ReadonlyMap<string, LoadedModule>,
  domain: string,
  at: string,
): SubjectDirectoryDeclaration {
  const raw = object(rawValue, at);
  closed(raw, ["module"], at);
  const module = text(raw["module"], `${at}.module`);
  const loaded = moduleOf(modules, module, at);
  if (loaded.domain !== domain) fail(`${at} account-directory module must be owned by the current domain`);
  if (loaded.schema.creatable.manual !== false) {
    fail(`${at} declared module "${module}" must not be manually creatable`);
  }
  if (!loaded.schema.lifecycle.statuses.every((status) => status.editable === "none")) {
    fail(`${at} declared module "${module}" must have every status non-editable`);
  }
  return { module };
}

function normalizeTarget(rawValue: unknown, modules: ReadonlyMap<string, LoadedModule>, domain: string, at: string): ScopeTargetDeclaration {
  const raw = object(rawValue, at);
  closed(raw, ["policy", "module", "field", "walkUpToType"], at);
  const module = text(raw["module"], `${at}.module`);
  const loaded = moduleOf(modules, module, at);
  if (loaded.domain !== domain) fail(`${at} can declare a scope anchor only for this domain's modules`);
  const field = text(raw["field"], `${at}.field`);
  headerField(loaded, field, at);
  const parsedPolicy = text(raw["policy"], `${at}.policy`);
  if (parsedPolicy !== "own-org-and-descendants") {
    fail(`${at} only own-org-and-descendants may declare walkUpToType`);
  }
  const walkUpToType = text(raw["walkUpToType"], `${at}.walkUpToType`);
  if (!/^[a-z][a-z0-9_-]*$/.test(walkUpToType)) {
    fail(`${at}.walkUpToType "${walkUpToType}" must be an org-type dictionary code, not a Chinese display name`);
  }
  return { policy: "own-org-and-descendants", module, field, walkUpToType };
}

export async function loadAuthorizationFragment(domainDir: string, domain: string): Promise<LocatedFragment | null> {
  const file = ["authorization.ts", "authorization.js"].map((name) => path.join(domainDir, name)).find(exists);
  return file ? { domain, value: await importDefault(file) } : null;
}

export function normalizeProductAuthorization(
  located: readonly LocatedFragment[],
  modules: ReadonlyMap<string, LoadedModule>,
): ProductAuthorization {
  const applications: ProductApplicationDeclaration[] = [];
  const applicationCodes = new Map<string, string>();
  const applicationNames = new Map<string, string>();
  const roles = new Map<string, RoleSeedFragment>();
  const scopeTargets: ScopeTargetDeclaration[] = [];
  const affiliationSyncs: AffiliationSyncDeclaration[] = [];
  let orgTree: ScopeOrgTreeDeclaration | null = null;
  let orgTreeAt: string | null = null;
  let subjectDirectory: SubjectDirectoryDeclaration | null = null;
  let subjectDirectoryAt: string | null = null;
  for (const entry of located) {
    const at = `${entry.domain}/authorization.ts`;
    const raw = object(entry.value, at);
    closed(raw, ["applications", "roles", "orgTree", "scopeTargets", "affiliationSyncs", "subjectDirectory"], at);
    for (const [index, value] of optionalArray(raw["applications"], `${at}.applications`).entries()) {
      const applicationAt = `${at}.applications[${String(index)}]`;
      const application = normalizeApplication(value, applicationAt);
      const codeOwner = applicationCodes.get(application.code);
      if (codeOwner !== undefined) {
        fail(`${applicationAt}.code declares application "${application.code}" again; already declared by ${codeOwner}`);
      }
      const nameOwner = applicationNames.get(application.name);
      if (nameOwner !== undefined) {
        fail(`${applicationAt}.name declares application name "${application.name}" again; already declared by ${nameOwner}`);
      }
      applicationCodes.set(application.code, applicationAt);
      applicationNames.set(application.name, applicationAt);
      applications.push(application);
    }
    for (const [index, value] of optionalArray(raw["roles"], `${at}.roles`).entries()) {
      const role = normalizeRole(value, modules, entry.domain, `${at}.roles[${String(index)}]`);
      const existing = roles.get(role.code);
      if (existing && (existing.name !== role.name || existing.description !== role.description)) {
        fail(`${at} role "${role.code}" name/description does not match the fragment from another domain`);
      }
      roles.set(role.code, existing
        ? { ...existing, grants: [...existing.grants, ...role.grants] }
        : role);
    }
    if (raw["orgTree"] !== undefined) {
      if (orgTree !== null) fail(`${at}.orgTree and ${orgTreeAt} both declare the org tree`);
      orgTree = normalizeOrgTree(raw["orgTree"], modules, entry.domain, `${at}.orgTree`);
      orgTreeAt = `${at}.orgTree`;
    }
    for (const [index, value] of optionalArray(raw["scopeTargets"], `${at}.scopeTargets`).entries()) {
      scopeTargets.push(normalizeTarget(value, modules, entry.domain, `${at}.scopeTargets[${String(index)}]`));
    }
    for (const [index, value] of optionalArray(raw["affiliationSyncs"], `${at}.affiliationSyncs`).entries()) {
      affiliationSyncs.push(normalizeAffiliationSync(value, modules, entry.domain, `${at}.affiliationSyncs[${String(index)}]`));
    }
    if (raw["subjectDirectory"] !== undefined) {
      if (subjectDirectory !== null) fail(`${at}.subjectDirectory and ${subjectDirectoryAt} both declare the account directory`);
      subjectDirectory = normalizeSubjectDirectory(raw["subjectDirectory"], modules, entry.domain, `${at}.subjectDirectory`);
      subjectDirectoryAt = `${at}.subjectDirectory`;
    }
  }
  const targetKeys = scopeTargets.map((target) => `${target.module}:${target.field}`);
  if (new Set(targetKeys).size !== targetKeys.length) fail("the same module cannot declare the same own-org-and-descendants anchor twice");
  if (scopeTargets.length > 0 && orgTree === null) {
    fail("an own-org-and-descendants anchor is declared but there is no org tree");
  }
  if (subjectDirectory === null && located.length > 0) fail("the whole product must declare subjectDirectory in exactly one place");
  return {
    applications: applications.sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    roles: [...roles.values()].sort((a, b) => a.code.localeCompare(b.code)),
    orgTree,
    scopeTargets,
    affiliationSyncs,
    subjectDirectory,
  };
}
