// ---------------------------------------------------------------------------
// Permission catalog — stable capability coordinates compiled from ModuleSchema
//
// The schema declares business shape only. Roles and grants in a tenant are database facts.
// The two meet on the permission key this file generates: a new module, field, or status edge
// appears as a new capability automatically, and it is not granted to any role automatically.
// "A new capability is denied by default" is then a structural result, not a discipline an administrator has to remember.
//
// A coordinate is issued only for an action the module can actually perform. The criterion comes from derive/engine, then capabilities narrow it:
// create looks at hasCreatePath, and capabilities.create is true or "system";
// the checkbox name for a "system" create is "Generate", and import is not issued;
// import looks at hasCreatePath and capabilities.create === true and capabilities.import;
// export looks at capabilities.export;
// delete looks at creatable.manual, update looks at hasEditableStatus.
// Field write is issued when there is a non-system create path or hasEditableStatus, still excluding planner-supplied and system-supplied values.
// On a module whose create is "system", a person only starts generation; record content is written by an internal system entry, and field write is not issued.
// read is still issued for every module; lookup is issued only when some non-derived ref/refLine in this module table points at this module, and a self-reference counts.
// The lookup coordinate is still issued, but it is not a role action: view / create / edit derive whether the target can be referenced when they expand.
// ---------------------------------------------------------------------------

import { isRbacRoleCode } from "./access.js";
import { isPlannerSupplied, isSystemSupplied, type Field } from "./fields.js";
import { transitionActions } from "./lifecycle.js";
import type { ModuleSchema } from "./module.js";
import { hasCreatePath, hasEditableStatus } from "../derive/engine.js";
import { checkActorKeys, type NormalizedCheck } from "../derive/primitives.js";
import { referencedModuleCodes } from "../relations/relations.js";

/**
 * Module-level actions. A closed enum — adding a value is the same as adding a concept, at the same rank as the seventh-concept gate.
 *
 * `lookup` / `export` / `import` passed that criterion because each answers a different question:
 *
 * | Already there | Added |
 * |---|---|
 * | "Can this person browse the customer archive on their own?" (`read`) | "Can this person pick a customer in the customer field of an order?" (`lookup`) |
 * | "Can this person see the customer archive?" (`read`) | "Can this person take the whole customer list out of the system?" (`export`) |
 * | "Can this person create one document?" (`create`) | "Can this person pour in five thousand rows with nobody looking in between?" (`import`) |
 *
 * Folding them into `read` / `create` is not abstract: a salesperson who must have `read` to do the job
 * can export the whole customer list on the day they leave — the most common data-exfiltration shape in an ERP,
 * and nowhere in the system can say "no".
 *
 * `lookup` carries the target module's data scope, but it opens only reference candidates. It does not open the module list, the detail, or the menu, and it does not own the display name on a document.
 * Folding it back into `read` creates transitive authorization along references: a purchase order references a sales order, the sales order references a customer,
 * and a buyer ends up with the sales and customer menus merely by opening a purchase order.
 *
 * 🔴 Outbound and batch actions only narrow, they do not widen: export still requires `read` (the data scope follows that same `read`,
 * so `dataScoped` is false — the scope is not its own, it is `read`'s),
 * and import still requires `create` plus per-field write. Miss either and the new coordinate is a bypass.
 *
 * ⚠️ The cost, stated plainly: adding a value changes `catalogDigest`. Under local RBAC
 * a new coordinate is in no role by default; to use it, check it in permission administration. That is not a defect. It is "a new capability is denied by default".
 * A release does not need a command for this.
 */
export const MODULE_PERMISSION_ACTIONS = ["read", "lookup", "create", "update", "delete", "export", "import"] as const;
export type ModulePermissionAction = (typeof MODULE_PERMISSION_ACTIONS)[number];

/** Module actions a role-grant row may check. lookup is an internally derived coordinate, not a configuration action. */
export const MODULE_ROLE_GRANT_ACTIONS = ["read", "create", "update", "delete", "export", "import"] as const;
export type ModuleRoleGrantAction = (typeof MODULE_ROLE_GRANT_ACTIONS)[number];

export const FIELD_PERMISSION_ACTIONS = ["read", "write"] as const;
export type FieldPermissionAction = (typeof FIELD_PERMISSION_ACTIONS)[number];

/** Business wording of a module action. The permission-catalog label and the 403 share it. A consumer must not map it again. */
export const MODULE_PERMISSION_ACTION_LABELS = {
  read: "View",
  lookup: "Reference",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  export: "Export",
  import: "Import",
} as const satisfies Record<ModulePermissionAction, string>;

/** Business wording of a field action. The catalog and the 403 share it. */
export const FIELD_PERMISSION_ACTION_LABELS = {
  read: "Visible",
  write: "Editable",
} as const satisfies Record<FieldPermissionAction, string>;

/** Separator between segments of a permission business name. The catalog and the 403 checkbox name share it. */
export const PERMISSION_LABEL_SEPARATOR = " · ";

export function permissionBusinessLabel(parts: readonly string[]): string {
  for (const part of parts) {
    if (!part.trim()) throw new Error("a permission business name cannot contain an empty segment");
  }
  return parts.join(PERMISSION_LABEL_SEPARATOR);
}

/**
 * Spoken clause for a status-edge consequence (no parentheses). Returns null when there is no consequence.
 * A push-down target must be given the module display name. Do not write a module code into a sentence shown to a business person.
 */
export function transitionConsequenceSpoken(
  transition: { readonly postsToLedger: boolean; readonly push: string | null },
  pushTargetLabel: string | null,
): string | null {
  const parts: string[] = [];
  if (transition.postsToLedger) parts.push("post to the ledger");
  if (transition.push !== null) {
    if (!pushTargetLabel?.trim()) {
      throw new Error(`status-edge push target "${transition.push}" has no module display name`);
    }
    parts.push(`push down and create ${pushTargetLabel}`);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return `This step will ${parts[0]}`;
  return `This step will ${parts.join(" and ")}`;
}

export type PermissionKind = "module" | "transition" | "field";

export interface PermissionDefinition {
  readonly key: string;
  readonly kind: PermissionKind;
  readonly module: string;
  readonly action: ModulePermissionAction | "execute" | FieldPermissionAction;
  readonly field: string | null;
  readonly transition: string | null;
  readonly label: string;
  /** A module read / lookup grant carries row-level data scope. */
  readonly dataScoped: boolean;
}

function segment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.includes(":")) {
    throw new Error(`${label} "${normalized}" must not contain a colon — a colon is the structural separator of a permission coordinate`);
  }
  return normalized;
}

export function modulePermissionKey(module: string, action: ModulePermissionAction): string {
  return `module:${segment(module, "module code")}:${action}`;
}

export function transitionPermissionKey(module: string, transition: string): string {
  return `module:${segment(module, "module code")}:transition:${segment(transition, "status-edge code")}`;
}

export function fieldPermissionKey(module: string, field: string, action: FieldPermissionAction): string {
  return `module:${segment(module, "module code")}:field:${segment(field, "field path")}:${action}`;
}

interface FieldSite {
  readonly path: string;
  readonly label: string;
  readonly field: Field;
  readonly siblings: readonly Field[];
}

function fieldSites(fields: readonly Field[]): readonly FieldSite[] {
  const sites: FieldSite[] = [];
  for (const field of fields) {
    sites.push({ path: field.key, label: field.label, field, siblings: fields });
    if (field.type !== "subtable") continue;
    if (field.fields === null) {
      throw new Error(`line field "${field.key}" has no column declaration, so a field permission catalog cannot be generated`);
    }
    for (const line of field.fields) {
      sites.push({
        path: `${field.key}.${line.key}`,
        label: permissionBusinessLabel([field.label, line.label]),
        field: line,
        siblings: field.fields,
      });
    }
  }
  return sites;
}

/** One module declaration → every grantable capability of that module. The order is stable, for migration review and for grouping in the admin UI. */
export function modulePermissionCatalog(module: ModuleSchema, referenced: boolean): readonly PermissionDefinition[] {
  const definitions: PermissionDefinition[] = [];
  const createPath = hasCreatePath(module);
  const canEdit = hasEditableStatus(module);
  const systemCreate = module.capabilities.create === "system";
  const canCreate = createPath && (module.capabilities.create === true || systemCreate);
  const canImport = createPath && module.capabilities.create === true && module.capabilities.import;
  const humanWritesFields = (createPath && !systemCreate) || canEdit;

  for (const action of MODULE_PERMISSION_ACTIONS) {
    if (action === "lookup" && !referenced) continue;
    if (action === "create" && !canCreate) continue;
    if (action === "import" && !canImport) continue;
    if (action === "export" && !module.capabilities.export) continue;
    if (action === "delete" && !module.creatable.manual) continue;
    if (action === "update" && !canEdit) continue;
    definitions.push({
      key: modulePermissionKey(module.code, action),
      kind: "module",
      module: module.code,
      action,
      field: null,
      transition: null,
      label: permissionBusinessLabel([
        module.label,
        action === "create" && systemCreate ? "Generate" : MODULE_PERMISSION_ACTION_LABELS[action],
      ]),
      dataScoped: action === "read" || action === "lookup",
    });
  }

  // A permission coordinate is issued per action: the same action has one edge per starting status, and what is granted is that one action
  for (const transition of transitionActions(module.lifecycle)) {
    if (transition.internal === true) continue;
    // The checkbox name uses only the module display name · the edge button text. Posting and push-down consequences are added by the 403 spoken clause,
    // not stuffed into the label, or the permission-tree checkbox name becomes an operating instruction.
    definitions.push({
      key: transitionPermissionKey(module.code, transition.code),
      kind: "transition",
      module: module.code,
      action: "execute",
      field: null,
      transition: transition.code,
      label: permissionBusinessLabel([module.label, transition.action]),
      dataScoped: false,
    });
  }

  for (const site of fieldSites(module.fields)) {
    definitions.push({
      key: fieldPermissionKey(module.code, site.path, "read"),
      kind: "field",
      module: module.code,
      action: "read",
      field: site.path,
      transition: null,
      label: permissionBusinessLabel([module.label, site.label, FIELD_PERMISSION_ACTION_LABELS.read]),
      dataScoped: false,
    });
    // Field write serves both creating a document and editing one. It is issued only when a person has a create path or an editable status.
    // Planner-supplied and system-supplied values enter the record as read. They have no write coordinate.
    if (humanWritesFields && !isPlannerSupplied(site.field) && !isSystemSupplied(site.field, site.siblings)) {
      definitions.push({
        key: fieldPermissionKey(module.code, site.path, "write"),
        kind: "field",
        module: module.code,
        action: "write",
        field: site.path,
        transition: null,
        label: permissionBusinessLabel([module.label, site.label, FIELD_PERMISSION_ACTION_LABELS.write]),
        dataScoped: false,
      });
    }
  }

  const keys = definitions.map((definition) => definition.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`module "${module.code}" generated a duplicate permission coordinate — a field or status-edge code is not stable`);
  }
  return definitions;
}

/** Permission catalog across modules. A duplicate module code also fails fast, so a later entry does not overwrite an earlier one. */
export function permissionCatalog(modules: readonly ModuleSchema[]): readonly PermissionDefinition[] {
  const referenced = referencedModuleCodes(modules);
  const definitions = modules.flatMap((module) => modulePermissionCatalog(module, referenced.has(module.code)));
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.key)) throw new Error(`duplicate permission coordinate "${definition.key}"`);
    seen.add(definition.key);
  }
  return definitions;
}

// ── Position roles that appear in the declarations ─────────────────────────

/**
 * Which position roles this set of declarations knows — derived from `domains/`, not a list kept somewhere.
 *
 * 🔴 Position templates are declared by each domain's `authorization.ts` and synced into local RBAC. This derives a different fact:
 * "which stable position codes the module rules and handoffs have referenced". Both come from the domain, and they are used differently:
 * the atomic permission catalog is compiled from the module declaration. Who is granted it is still decided by the position grant and the person's authorization.
 *
 * Two sources of truth, and both must be scanned (missing either shows up as "that edge cannot be pressed / that to-do is never received",
 * and both directions report zero errors):
 *
 * | Source | Example | What goes wrong if it is missing |
 * |---|---|---|
 * | `handoff[].to` | `warehouse-clerk` receives "go pick" | The task is still written to `oe_handoff_task`, but the inbox filters `to_role in my roles`. Nobody has that role ⇒ a to-do list that stays empty forever, which looks like "not finished" |
 * | A literal compared with `$actor.roles` in a rule | releasing over stock requires `warehouse-manager` | That `block` never passes ⇒ the route exit is a button that cannot be pressed (and `stock_sufficient` is exactly what sends a person there when stock is short) |
 *
 * 🔴 A consumer must not hard-code a role list. The hard-coded list silently misses the next role someone adds,
 * and the symptom (a button that will not press / an empty to-do) is a long way from that edit. Same discipline as
 * `relationsOf` / `refSitesOf` / `uniqueSitesOf`: derive coordinates from the declaration.
 *
 * ⚠️ Only literals that have the shape of an RBAC role code (`isRbacRoleCode`) are collected: something compared
 * next to `$actor.roles` is not necessarily a role (there may be other comparisons later). Emitting a string that is not a role
 * as a role stuffs a coordinate nobody can explain onto the authorization surface.
 */
export function rolesOf(modules: readonly ModuleSchema[]): readonly string[] {
  const found = new Set<string>();

  const fromCheck = (check: NormalizedCheck | null): void => {
    if (check === null) return;
    // ① Whether this rule actually looks at `$actor.roles` — the criterion is the primitive's own projection, not a guess from the parameter name
    if (!checkActorKeys(check).includes("roles")) return;
    const params = check.params;
    if (params === null || typeof params !== "object") return;
    // ② The literals sitting next to it in the same rule are the roles that are required.
    //    Only same-level siblings: deeper in the parameter tree there is no "compared with $actor.roles" relation
    const operands = Object.values(params as Record<string, unknown>).filter(isOperandLike);
    if (!operands.some((operand) => "ref" in operand && operand.ref === "$actor.roles")) return;
    for (const operand of operands) {
      if (!("value" in operand)) continue;
      for (const one of Array.isArray(operand.value) ? operand.value : [operand.value]) {
        if (typeof one === "string" && isRbacRoleCode(one)) found.add(one);
      }
    }
  };

  for (const module of modules) {
    for (const handoff of module.handoff) found.add(handoff.to);
    for (const precondition of module.preconditions) {
      fromCheck(precondition.check);
      // `when` (the applicability tier) may also decide by role: it and `check` are two positions of the same kind of thing
      fromCheck(precondition.when);
    }
  }
  // Sorted: this list enters snapshots, logs, and test assertions, so the order must not follow module scan order
  return [...found].sort();
}

function isOperandLike(value: unknown): value is { readonly ref?: string; readonly value?: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return "ref" in value || "value" in value;
}
