// ---------------------------------------------------------------------------
// Navigation declaration — the business-facing source of truth for grouping
//
// The repo-root `navigation.ts` is maintained by the product. The sidebar, the
// permission-config tree, the data-scope "add module" tree, and `/api/navigation`
// are all projections of it. A domain is a modeling cut. A menu group is the order
// in a business person's head. Both rulers are right, and they are not the same one,
// so grouping does not live on domain.ts or on a module.
//
// This file is zero IO: shape, plus exhaustiveness against the module table and the
// query-surface table. Scanning the disk lives in the loader.
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";

/** Group code: kebab. It enters a URL and a permission-tree node. It is not the same kind of coordinate as a module's camelCase. */
const GROUP_CODE = /^[a-z][a-z0-9-]*$/;
const SURFACE_REF = /^[a-z][a-zA-Z0-9-]*$/;

export interface DeclaredNavItem {
  readonly module: string | null;
  readonly surface: string | null;
  readonly hidden: boolean;
}

export interface DeclaredNavGroup {
  readonly code: string;
  readonly label: string;
  readonly items: readonly DeclaredNavItem[];
  readonly groups: readonly DeclaredNavGroup[];
}

export interface NavigationDeclaration {
  readonly groups: readonly DeclaredNavGroup[];
}

export type NavigationItemKind = "module" | "surface" | "framework";

/** A projected navigation item. `code` is `module:x` / `surface:x` / `framework:x`. `permissionKey: null` is allowed only for framework, and it means any signed-in identity can see it. */
export interface NavigationItem {
  readonly code: string;
  readonly kind: NavigationItemKind;
  readonly module: string | null;
  readonly label: string;
  readonly path: string;
  readonly permissionKey: string | null;
  readonly hidden: boolean;
  /**
   * Parent module code of a composite-archive child module. `null` when this is not a child archive.
   *
   * A derived field. The source of truth is the parent module's `views.composite.child`. The navigation
   * declaration has no such slot (`ITEM_KEYS` does not include it). It only answers "which parent archive
   * maintains this archive". It does not change the permission key, filtering, or exhaustiveness: the child
   * module item stays in the group where it was declared. The permission-config tree and the data-scope tree
   * draw it under the parent module node from this.
   */
  readonly within: string | null;
}

export interface NavigationGroup {
  readonly code: string;
  readonly label: string;
  readonly items: readonly NavigationItem[];
  readonly groups: readonly NavigationGroup[];
}

export interface PathSurface {
  readonly code: string;
  readonly navCode: string;
  readonly label: string;
  readonly path: string;
  readonly permission: string;
}

const NAV_KEYS = ["groups"] as const;
const GROUP_KEYS = ["code", "label", "items", "groups"] as const;
const ITEM_KEYS = ["module", "surface", "hidden"] as const;

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requireText(value, label);
}

function requireGroupCode(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!GROUP_CODE.test(text)) {
    schemaFail(`${label} "${text}" is not a legal group code: it starts with a lowercase letter and contains only lowercase letters, digits, and hyphens`);
  }
  return text;
}

function normalizeItem(raw: unknown, at: string): DeclaredNavItem {
  const obj = requireObject(raw, at, "the shape is { module: \"x\" } or { surface: \"stock-query\" }, and add hidden: true when there is no entry");
  assertClosedKeys(obj, ITEM_KEYS, at);
  const module = optionalText(obj["module"], `${at}.module`);
  const surface = optionalText(obj["surface"], `${at}.surface`);
  if ((module === null) === (surface === null)) {
    schemaFail(`${at} must set exactly one of module or surface — the name follows the module or the query surface, and the item must not declare its own label`);
  }
  const hiddenRaw = obj["hidden"];
  if (hiddenRaw !== undefined && hiddenRaw !== null && typeof hiddenRaw !== "boolean") {
    schemaFail(`${at}.hidden accepts only a boolean`);
  }
  return { module, surface, hidden: hiddenRaw === true };
}

function normalizeGroup(raw: unknown, at: string): DeclaredNavGroup {
  const obj = requireObject(raw, at, "the shape is { code, label, items } or { code, label, groups }");
  assertClosedKeys(obj, GROUP_KEYS, at);
  const code = requireGroupCode(obj["code"], `${at}.code`);
  const label = requireText(obj["label"], `${at}.label`);
  const rawItems = obj["items"];
  const rawGroups = obj["groups"];
  const items = rawItems === undefined || rawItems === null
    ? []
    : requireArray(rawItems, `${at}.items`).map((item, i) => normalizeItem(item, `${at}.items[${String(i)}]`));
  const groups = rawGroups === undefined || rawGroups === null
    ? []
    : requireArray(rawGroups, `${at}.groups`).map((group, i) => normalizeGroup(group, `${at}.groups[${String(i)}]`));
  if (items.length > 0 && groups.length > 0) {
    schemaFail(`group "${code}" (${label}) cannot have both menu items and child groups — exactly one of child groups and menu items must be non-empty`);
  }
  if (items.length === 0 && groups.length === 0) {
    schemaFail(`group "${code}" (${label}) is empty — an empty group appears in no menu. Delete it or add a module`);
  }
  return { code, label, items, groups };
}

function walkDeclared(
  groups: readonly DeclaredNavGroup[],
  visitGroup: (group: DeclaredNavGroup) => void,
  visitItem: (item: DeclaredNavItem, group: DeclaredNavGroup) => void,
): void {
  for (const group of groups) {
    visitGroup(group);
    for (const item of group.items) visitItem(item, group);
    walkDeclared(group.groups, visitGroup, visitItem);
  }
}

function uniqueOrFail(values: readonly string[], kind: string): void {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const value of values) {
    if (seen.has(value)) dupes.push(value);
    seen.add(value);
  }
  if (dupes.length === 0) return;
  schemaFail(
    `${kind} "${[...new Set(dupes)].join(", ")}" appears more than once in the navigation tree — each ${kind} must appear exactly once`,
  );
}

/**
 * Shape gate. A catalog mismatch (a missing module, a dangling reference) is in `validateNavigation`.
 * Running it again must be idempotent: the loader does not trust the imported value and sends the default export through again.
 */
export function defineNavigation(raw: unknown): NavigationDeclaration {
  const obj = requireObject(raw, "navigation", "the shape is defineNavigation({ groups: [...] })");
  assertClosedKeys(obj, NAV_KEYS, "navigation");
  const groups = requireArray(obj["groups"], "navigation.groups").map((group, i) =>
    normalizeGroup(group, `navigation.groups[${String(i)}]`),
  );
  if (groups.length === 0) {
    schemaFail("navigation.groups is empty — the navigation tree needs at least one group");
  }
  const codes: string[] = [];
  walkDeclared(groups, (group) => codes.push(group.code), () => undefined);
  uniqueOrFail(codes, "group code");
  const modules: string[] = [];
  const surfaces: string[] = [];
  walkDeclared(groups, () => undefined, (item) => {
    if (item.module !== null) modules.push(item.module);
    if (item.surface !== null) surfaces.push(item.surface);
  });
  uniqueOrFail(modules, "module");
  uniqueOrFail(surfaces, "query surface");
  return { groups };
}

function surfaceLookup(pathSurfaces: ReadonlyMap<string, PathSurface>): {
  readonly byRef: ReadonlyMap<string, PathSurface>;
  readonly navCodes: readonly string[];
} {
  const byRef = new Map<string, PathSurface>();
  const navCodes: string[] = [];
  const seen = new Set<string>();
  for (const surface of pathSurfaces.values()) {
    byRef.set(surface.navCode, surface);
    byRef.set(surface.code, surface);
    if (!seen.has(surface.navCode)) {
      seen.add(surface.navCode);
      navCodes.push(surface.navCode);
    }
  }
  return { byRef, navCodes: navCodes.sort() };
}

function lookupSurface(ref: string, lookup: ReturnType<typeof surfaceLookup>, at: string): PathSurface {
  if (!SURFACE_REF.test(ref)) {
    schemaFail(`${at} query surface "${ref}" has an illegal shape`);
  }
  const found = lookup.byRef.get(ref);
  if (found === undefined) {
    schemaFail(
      `the navigation declaration references a query surface "${ref}" that does not exist — query surfaces with a path: ${lookup.navCodes.join(", ") || "(none)"}`,
    );
  }
  return found;
}

/**
 * Exhaustiveness: every module and every query surface that has a path appears in the tree exactly once, and every reference must land in the catalog.
 * The error names the module or the group, for the person editing navigation.ts.
 */
export function validateNavigation(
  declared: NavigationDeclaration,
  input: {
    readonly moduleCodes: ReadonlySet<string>;
    readonly pathSurfaces: ReadonlyMap<string, PathSurface>;
  },
): void {
  const lookup = surfaceLookup(input.pathSurfaces);
  const declaredModules: string[] = [];
  const declaredSurfaceNav: string[] = [];
  walkDeclared(declared.groups, () => undefined, (item, group) => {
    const at = `group "${group.code}" (${group.label})`;
    if (item.module !== null) {
      if (!input.moduleCodes.has(item.module)) {
        schemaFail(`${at} references a module "${item.module}" that does not exist`);
      }
      declaredModules.push(item.module);
      return;
    }
    if (item.surface === null) return;
    const surface = lookupSurface(item.surface, lookup, at);
    declaredSurfaceNav.push(surface.navCode);
  });
  uniqueOrFail(declaredModules, "module");
  uniqueOrFail(declaredSurfaceNav, "query surface");

  const missingModules = [...input.moduleCodes].filter((code) => !declaredModules.includes(code)).sort();
  if (missingModules.length > 0) {
    schemaFail(
      `the navigation tree is missing these modules: ${missingModules.join(", ")} — ` +
        `every module must appear exactly once. A module with no menu entry writes hidden: true. Do not leave an "ungrouped" bucket`,
    );
  }

  const expectedSurfaces = lookup.navCodes;
  const missingSurfaces = expectedSurfaces.filter((code) => !declaredSurfaceNav.includes(code));
  if (missingSurfaces.length > 0) {
    schemaFail(
      `the navigation tree is missing these query surfaces that have a path: ${missingSurfaces.join(", ")} — ` +
        `every query surface with a path must appear exactly once`,
    );
  }
}

/** Module facts resolveNavigation needs: the display name plus `views.composite.child` (null when it is not a composite parent). */
export interface NavigationModule {
  readonly label: string;
  readonly compositeChild: string | null;
}

/**
 * Composite-archive child module → parent module. The only source of truth is the parent module's `views.composite.child`.
 * The navigation declaration has no such slot, and the framework does not recognize anyone by module code.
 */
function compositeParents(
  modules: ReadonlyMap<string, NavigationModule>,
): ReadonlyMap<string, string> {
  const parents = new Map<string, string>();
  for (const [code, loaded] of modules) {
    const child = loaded.compositeChild;
    if (child === null) continue;
    if (child === code) {
      schemaFail(`module "${code}" has views.composite.child pointing at itself — the parent archive and the child archive must be two modules`);
    }
    if (!modules.has(child)) {
      schemaFail(`module "${code}" has views.composite.child "${child}", which is not a loaded module`);
    }
    const claimed = parents.get(child);
    if (claimed !== undefined) {
      schemaFail(
        `module "${child}" is declared as a composite-archive child by both "${claimed}" and "${code}" — a child archive can hang on only one parent`,
      );
    }
    parents.set(child, code);
  }
  for (const [child, parent] of parents) {
    if (modules.get(child)?.compositeChild !== null) {
      schemaFail(
        `module "${child}" is a composite-archive child of "${parent}" and also declares views.composite itself — nested composite archives are not supported`,
      );
    }
  }
  return parents;
}

export function resolveNavigation(
  declared: NavigationDeclaration,
  input: {
    readonly modules: ReadonlyMap<string, NavigationModule>;
    readonly pathSurfaces: ReadonlyMap<string, PathSurface>;
  },
): readonly NavigationGroup[] {
  const lookup = surfaceLookup(input.pathSurfaces);
  const parents = compositeParents(input.modules);
  const withinOf = (module: string): string | null => {
    const parent = parents.get(module);
    if (parent === undefined) return null;
    const loaded = input.modules.get(parent);
    if (loaded === undefined || loaded.compositeChild !== module) {
      schemaFail(`module "${module}" has parent "${parent}", which does not exist or does not declare it as views.composite.child`);
    }
    return parent;
  };
  const resolveItem = (item: DeclaredNavItem, group: DeclaredNavGroup): NavigationItem => {
    if (item.module !== null) {
      const loaded = input.modules.get(item.module);
      if (loaded === undefined) {
        schemaFail(`group "${group.code}" references a module "${item.module}" that does not exist`);
      }
      return {
        code: `module:${item.module}`,
        kind: "module",
        module: item.module,
        label: loaded.label,
        path: `/${encodeURIComponent(item.module)}`,
        permissionKey: `module:${item.module}:read`,
        hidden: item.hidden,
        within: withinOf(item.module),
      };
    }
    if (item.surface === null) {
      schemaFail(`group "${group.code}" has an item with neither module nor surface`);
    }
    const surface = lookupSurface(item.surface, lookup, `group "${group.code}"`);
    return {
      code: `surface:${surface.navCode}`,
      kind: "surface",
      module: null,
      label: surface.label,
      path: surface.path,
      permissionKey: surface.permission,
      hidden: item.hidden,
      within: null,
    };
  };
  const resolveGroup = (group: DeclaredNavGroup): NavigationGroup => ({
    code: group.code,
    label: group.label,
    items: group.items.map((item) => resolveItem(item, group)),
    groups: group.groups.map(resolveGroup),
  });
  return declared.groups.map(resolveGroup);
}

export function walkNavigationItems(groups: readonly NavigationGroup[]): readonly NavigationItem[] {
  const out: NavigationItem[] = [];
  const walk = (list: readonly NavigationGroup[]): void => {
    for (const group of list) {
      out.push(...group.items);
      walk(group.groups);
    }
  };
  walk(groups);
  return out;
}
