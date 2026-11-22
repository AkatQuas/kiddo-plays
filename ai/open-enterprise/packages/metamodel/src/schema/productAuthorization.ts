// ---------------------------------------------------------------------------
// Product authorization assembly declaration
//
// Module declarations generate the atomic permission catalog. This file describes
// a different fact: which initial roles a new tenant needs seeded, and how a
// business scope resolves along module relations. It lives in domains/*/authorization.ts
// and the loader aggregates it. packages interpret only this generic shape and
// know no concrete module, role, or field.
// ---------------------------------------------------------------------------

import type { ScopeCondition } from "./access.js";
import type { ModuleRoleGrantAction } from "./permissions.js";

/** Module actions configurable on a role row. Reference capability is derived from view / create / edit. */
export type { ModuleRoleGrantAction } from "./permissions.js";

/** A standalone client application uses a stable lowercase kebab code; it enters the client routing protocol. */
export const APPLICATION_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface ProductApplicationDeclaration {
  readonly code: string;
  readonly name: string;
}

/** A module grant row. Seed and tenant storage share this shape. No legacy field names. */
export interface ModuleRoleGrant {
  readonly module: string;
  /** Non-empty. */
  readonly actions: readonly ModuleRoleGrantAction[];
  /** Button name = transition.action, not code. */
  readonly buttons: "all" | readonly string[];
  readonly fields: "all" | { readonly except: readonly string[] };
  /** AND inside a group, OR between groups. null = the whole module is visible. */
  readonly scope: readonly (readonly ScopeCondition[])[] | null;
}

export interface SystemRoleGrant {
  readonly systemKey: string;
}

export type RoleGrant = ModuleRoleGrant | SystemRoleGrant;

/** A row that carries both module and systemKey is neither: it is an illegal row, not a system row. */
export function isSystemRoleGrant(grant: RoleGrant): grant is SystemRoleGrant {
  return "systemKey" in grant && !("module" in grant);
}

/** A row that carries both module and systemKey is neither: it is an illegal row, not a module row. */
export function isModuleRoleGrant(grant: RoleGrant): grant is ModuleRoleGrant {
  return "module" in grant && !("systemKey" in grant);
}

/**
 * Role-template fragment applied the first time a new tenant is enabled.
 *
 * It is not runtime authorization config: after it is stored, roles, grants, and
 * scopes follow the tenant database. A later init only fills in codes that do not
 * exist yet. It does not overwrite records the tenant has already changed.
 * Data scope hangs on the role (grant.scope → that role's module conditions). Do not seed positions again.
 */
export interface RoleSeedFragment {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly grants: readonly RoleGrant[];
}

/** Organization-tree coordinates: an org policy walks up this tree to an anchor, or down it to collect descendants. */
export interface ScopeOrgTreeDeclaration {
  readonly module: string;
  readonly parentField: string;
  readonly typeField: string;
}

/**
 * When a business archive such as a worker changes, sync "has a platform account
 * and is attached to an organization of the given type" into subject affiliation.
 * The coordinates are all modules and fields. The implementation does not know about workers or crews.
 */
export interface AffiliationSyncDeclaration {
  readonly fromModule: string;
  readonly userIdField: string;
  readonly displayField: string;
  readonly orgField: string;
  readonly orgTypeField: string;
  readonly orgTypeValue: string;
  /** Status key in the fromModule lifecycle that means active. Leaving that status deletes the derived affiliation. */
  readonly activeStatus: string;
}

/** Anchor type, on this module's anchor field, for this organization and its descendants. */
export interface ScopeTargetDeclaration {
  readonly policy: "own-org-and-descendants";
  readonly module: string;
  readonly field: string;
  /**
   * This organization and its descendants: a person's node walks up to this
   * organization type first, then is compared with the anchor field.
   * Write the organization-type dictionary code (for example `factory`), not a display name.
   */
  readonly walkUpToType: string;
}

/** Account-directory module: an identity that is signed in and has an ERP role receives read/lookup and field read on this module, scope all, with no stored grant. */
export interface SubjectDirectoryDeclaration {
  readonly module: string;
}

export interface ProductAuthorizationFragment {
  /** Catalog of standalone client applications delivered with the product. Application code/name are owned by code and are not created by the tenant at runtime. */
  readonly applications?: readonly ProductApplicationDeclaration[];
  /** Initial template for a new tenant, merged across business domains. Not an uneditable built-in product role. */
  readonly roles?: readonly RoleSeedFragment[];
  /** The repo's single organization-tree coordinate. Declared by the domain that owns orgUnit. */
  readonly orgTree?: ScopeOrgTreeDeclaration;
  readonly scopeTargets?: readonly ScopeTargetDeclaration[];
  readonly affiliationSyncs?: readonly AffiliationSyncDeclaration[];
  /** Account directory. Exactly one in the whole product. The declared module must not be manually creatable, and every status must be editable none. */
  readonly subjectDirectory?: SubjectDirectoryDeclaration;
}
