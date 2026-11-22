// ---------------------------------------------------------------------------
// Local RBAC PostgreSQL adapter
//
// This owns tenant narrowing, transactions, validity windows, and append-only audit. Permission merge and scope-policy resolution stay with
// the server provider. Storage does not know business module codes, and it does not guess a scope policy into a field.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { and, asc, countDistinct, eq, gt, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  MODULE_ROLE_GRANT_ACTIONS,
  SCOPE_CONDITION_OPS,
  isModuleRoleGrant,
  isSystemRoleGrant,
  parseScopeValue,
  type ModuleRoleGrantAction,
  type RoleGrant,
  type ScopeCondition,
  type ScopeConditionOp,
  type ScopeValue,
} from "@open-erp/metamodel";
import { requireIdentity, requireSubject, type Identity, type SubjectIdentity } from "@open-erp/runtime-core";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  applicationAssignment,
  orgAffiliation,
  rbacAssignment,
  rbacAudit,
  rbacChangeSet,
  rbacRole,
  rbacRoleGrant,
} from "../db/framework.js";
import { scopedWhere, type ScopedTable } from "../db/scope.js";
import type { Executor } from "./support.js";

export class LocalRbacRepoError extends Error {
  override readonly name = "LocalRbacRepoError";
}

export class LocalRbacConflictError extends Error {
  override readonly name = "LocalRbacConflictError";
}

function fail(message: string): never {
  throw new LocalRbacRepoError(message);
}

function conflict(message: string): never {
  throw new LocalRbacConflictError(message);
}

export interface StoredRoleAssignment {
  readonly id: string;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly role: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly description: string;
    readonly status: "active" | "disabled";
    readonly grants: readonly RoleGrant[];
  };
}

type DirectoryPersonRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly orgId: string;
  readonly status: string;
  readonly userName: string;
  readonly displayName: string;
  readonly sourceSyncedAt: Date;
  readonly firstSeenAt: Date | null;
  readonly lastSeenAt: Date | null;
};

export interface DirectoryPersonTable extends ScopedTable {
  readonly id: PgColumn;
  readonly tenantId: PgColumn;
  readonly orgId: PgColumn;
  readonly status: PgColumn;
  readonly userName: PgColumn;
  readonly displayName: PgColumn;
  readonly sourceSyncedAt: PgColumn;
  readonly firstSeenAt: PgColumn;
  readonly lastSeenAt: PgColumn;
  readonly revision: PgColumn;
  readonly createdAt: PgColumn;
  readonly createdBy: PgColumn;
  readonly updatedAt: PgColumn;
  readonly updatedBy: PgColumn;
}

export interface LocalRbacRepoOptions {
  readonly managerPermissionKey: string;
  readonly directoryTable: DirectoryPersonTable;
}

/** An access trace, not a session heartbeat. The same process and subject do not UPDATE last_seen again inside this interval. */
export const SUBJECT_SEEN_THROTTLE_MS = 60_000;

function subjectSeenKey(who: SubjectIdentity): string {
  return `${who.tenantId}\0${who.userId}\0${who.orgId}`;
}

export interface RoleSeedInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly grants: readonly RoleGrant[];
}

export interface StoredAssignmentValue {
  readonly id: string;
  readonly subjectId: string;
  readonly roleId: string;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

export interface StoredAuthorizationSubjectValue {
  readonly id: string;
  readonly userName: string;
  readonly displayName: string;
  readonly status: string;
}

export interface StoredApplicationAssignment {
  readonly id: string;
  readonly applicationCode: string;
  readonly subjectId: string;
  readonly assignedAt: string;
  readonly assignedBy: string;
}

export type StoredAuthorizationChange =
  | { readonly kind: "role.save"; readonly role: {
      readonly id: string; readonly code: string; readonly name: string; readonly description: string;
      readonly status: "active" | "disabled"; readonly grants: readonly RoleGrant[];
    } }
  | { readonly kind: "subject.sync"; readonly subjects: readonly StoredAuthorizationSubjectValue[] }
  | {
      readonly kind: "application.assignments.replace";
      readonly applicationCode: string;
      readonly subjectIds: readonly string[];
    }
  | { readonly kind: "assignment.save"; readonly assignment: StoredAssignmentValue }
  | { readonly kind: "assignment.revoke"; readonly subjectId: string; readonly assignmentId: string }
  | { readonly kind: "affiliation.add"; readonly subjectId: string; readonly orgUnitId: string }
  | { readonly kind: "affiliation.remove"; readonly subjectId: string; readonly orgUnitId: string };

export interface StoredAuthorizationChangeSet {
  readonly idempotencyKey: string;
  readonly baseVersion: string;
  readonly operations: readonly StoredAuthorizationChange[];
}

export interface StoredApprovalUse {
  readonly callId: string;
  readonly proofHash: string;
  readonly inputHash: string;
}

function validDate(value: Date, label: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail(`${label} is not a valid Date`);
}

function roleStatus(value: string, roleId: string): "active" | "disabled" {
  if (value === "active" || value === "disabled") return value;
  return fail(`role "${roleId}" status "${value}" is invalid; the stored authorization fact is corrupt`);
}



function conditionOf(item: unknown, label: string): ScopeCondition {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return fail(`${label} is not an object`);
  }
  const raw = item as Record<string, unknown>;
  const field = raw["field"];
  const op = raw["op"];
  const values = raw["values"];
  if (typeof field !== "string" || field.trim() === "") {
    return fail(`${label}.field is invalid`);
  }
  if (typeof op !== "string" || !(SCOPE_CONDITION_OPS as readonly string[]).includes(op)) {
    return fail(`${label}.op is invalid`);
  }
  if (!Array.isArray(values)) {
    return fail(`${label}.values is invalid`);
  }
  const parsed: ScopeValue[] = [];
  for (const [index, rawValue] of values.entries()) {
    try {
      parsed.push(parseScopeValue(rawValue, `${label}.values[${String(index)}]`));
    } catch (error) {
      if (error instanceof LocalRbacRepoError) throw error;
      fail(error instanceof Error ? error.message : `${label}.values[${String(index)}] is invalid`);
    }
  }
  return {
    field: field.trim(),
    op: op as ScopeConditionOp,
    values: parsed,
  };
}

function actionsOf(value: unknown, label: string): readonly ModuleRoleGrantAction[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} actions must be a non-empty array of strings`);
  const seen = new Set<string>();
  const actions: ModuleRoleGrantAction[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") fail(`${label} actions[${String(index)}] is not a string`);
    if (!(MODULE_ROLE_GRANT_ACTIONS as readonly string[]).includes(item)) {
      fail(`${label} actions contain an invalid action "${item}"`);
    }
    if (seen.has(item)) fail(`${label} action "${item}" is duplicated`);
    seen.add(item);
    actions.push(item as ModuleRoleGrantAction);
  }
  return actions;
}

function buttonsOf(value: unknown, label: string): "all" | readonly string[] {
  if (value === "all") return "all";
  if (!Array.isArray(value)) fail(`${label} buttons must be "all" or an array of strings`);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") fail(`${label} buttons[${String(index)}] is not a string`);
    if (seen.has(item)) fail(`${label} button "${item}" is duplicated`);
    seen.add(item);
    names.push(item);
  }
  return names;
}

function fieldsOf(value: unknown, label: string): "all" | { readonly except: readonly string[] } {
  if (value === "all") return "all";
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} fields must be "all" or { except: string[] }`);
  }
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== "except" || !Array.isArray(raw["except"])) {
    fail(`${label} fields must be "all" or { except: string[] }`);
  }
  const seen = new Set<string>();
  const except: string[] = [];
  for (const [index, item] of raw["except"].entries()) {
    if (typeof item !== "string") fail(`${label} fields.except[${String(index)}] is not a string`);
    if (seen.has(item)) fail(`${label} field exception "${item}" is duplicated`);
    seen.add(item);
    except.push(item);
  }
  return { except };
}

/** SQL null in the scope column means "all". undefined and any other shape are corrupt data, and are not collapsed into an empty array. */
function scopeOf(value: unknown, label: string): readonly (readonly ScopeCondition[])[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) fail(`${label} scope is not an array of condition groups`);
  return value.map((group, index) => {
    if (!Array.isArray(group)) fail(`${label} scope[${String(index)}] is not a condition group`);
    return group.map((item, itemIndex) => conditionOf(item, `${label} scope[${String(index)}][${String(itemIndex)}]`));
  });
}

interface RoleGrantColumns {
  readonly module: string | null;
  readonly systemKey: string | null;
  readonly actions: unknown;
  readonly buttons: unknown;
  readonly fields: unknown;
  readonly scope: unknown;
}

function roleGrantFromRow(row: RoleGrantColumns, label: string): RoleGrant {
  const hasModule = row.module !== null;
  const hasSystem = row.systemKey !== null;
  if (hasModule === hasSystem) fail(`${label} grant must be exactly a module permission or a system permission`);
  if (hasSystem) {
    if (typeof row.systemKey !== "string" || row.systemKey.trim() === "") fail(`${label} system permission key is invalid`);
    if (row.actions !== null || row.buttons !== null || row.fields !== null || row.scope !== null) {
      fail(`${label} system permission "${row.systemKey}" cannot carry module actions, buttons, fields, or a scope`);
    }
    return { systemKey: row.systemKey };
  }
  if (typeof row.module !== "string" || row.module.trim() === "") fail(`${label} module is invalid`);
  const moduleLabel = `${label} module "${row.module}"`;
  return {
    module: row.module,
    actions: actionsOf(row.actions, moduleLabel),
    buttons: buttonsOf(row.buttons, moduleLabel),
    fields: fieldsOf(row.fields, moduleLabel),
    scope: scopeOf(row.scope, moduleLabel),
  };
}

function normalizeGrants(grants: readonly unknown[], label: string): readonly RoleGrant[] {
  const normalized: RoleGrant[] = [];
  const modules = new Set<string>();
  const systems = new Set<string>();
  for (const grant of grants) {
    if (grant === null || typeof grant !== "object" || Array.isArray(grant)) {
      fail(`${label} grant must be a module permission or a system permission`);
    }
    const hasModule = "module" in grant;
    const hasSystem = "systemKey" in grant;
    if (hasModule && hasSystem) fail(`${label} grant cannot be both a module permission and a system permission`);
    if (!hasModule && !hasSystem) fail(`${label} grant must be a module permission or a system permission`);
    const raw = grant as Record<string, unknown>;
    if (hasModule) {
      if (typeof raw["module"] !== "string") fail(`${label} module is invalid`);
      const row = roleGrantFromRow({
        module: raw["module"],
        systemKey: null,
        actions: raw["actions"],
        buttons: raw["buttons"],
        fields: raw["fields"],
        scope: raw["scope"] === undefined ? fail(`${label} module "${raw["module"]}" is missing scope`) : raw["scope"],
      }, label);
      if (!isModuleRoleGrant(row)) fail(`${label} grant shape is invalid`);
      if (modules.has(row.module)) fail(`${label} module "${row.module}" is duplicated`);
      modules.add(row.module);
      normalized.push(row);
      continue;
    }
    if (typeof raw["systemKey"] !== "string") fail(`${label} system permission key is invalid`);
    const row = roleGrantFromRow({
      module: null,
      systemKey: raw["systemKey"],
      actions: null,
      buttons: null,
      fields: null,
      scope: null,
    }, label);
    if (!isSystemRoleGrant(row)) fail(`${label} grant shape is invalid`);
    if (systems.has(row.systemKey)) fail(`${label} system permission "${row.systemKey}" is duplicated`);
    systems.add(row.systemKey);
    normalized.push(row);
  }
  return normalized;
}

function grantOrderBy() {
  return [
    sql`case when ${rbacRoleGrant.module} is null then 1 else 0 end`,
    asc(rbacRoleGrant.module),
    asc(rbacRoleGrant.systemKey),
  ];
}

function grantInsertRows(
  who: { readonly tenantId: string; readonly orgId: string; readonly userId: string },
  roleId: string,
  grants: readonly RoleGrant[],
  at: Date,
) {
  return grants.map((grant) => {
    const common = {
      id: randomUUID(),
      tenantId: who.tenantId,
      orgId: who.orgId,
      roleId,
      createdAt: at,
      createdBy: who.userId,
    };
    if (isSystemRoleGrant(grant)) {
      return {
        ...common,
        module: null,
        systemKey: grant.systemKey,
        actions: null,
        buttons: null,
        fields: null,
        scope: null,
      };
    }
    if (!isModuleRoleGrant(grant)) fail("grant shape was corrupt before the write");
    return {
      ...common,
      module: grant.module,
      systemKey: null,
      actions: [...grant.actions],
      buttons: grant.buttons === "all" ? "all" as const : [...grant.buttons],
      fields: grant.fields === "all" ? "all" as const : { except: [...grant.fields.except] },
      scope: grant.scope === null ? null : grant.scope.map((group) => group.map((condition) => ({
        field: condition.field,
        op: condition.op,
        values: [...condition.values],
      }))),
    };
  });
}

async function lockTenant(exec: Executor, tenantId: string): Promise<void> {
  await exec.execute(sql`select pg_advisory_xact_lock(hashtext(${`open-local-rbac:${tenantId}`}))`);
}

async function appendAudit(
  exec: Executor,
  actor: SubjectIdentity,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown,
  at: Date,
): Promise<void> {
  await exec.insert(rbacAudit).values({
    id: randomUUID(),
    tenantId: actor.tenantId,
    orgId: actor.orgId,
    action,
    targetType,
    targetId,
    before,
    after,
    actorId: actor.userId,
    at,
  });
}

async function roleRow(exec: Executor, identity: Identity, roleId: string): Promise<typeof rbacRole.$inferSelect> {
  const [row] = await exec
    .select()
    .from(rbacRole)
    .where(scopedWhere(rbacRole, identity, eq(rbacRole.id, roleId)))
    .limit(1);
  if (!row) fail(`the current tenant has no role "${roleId}"`);
  return row;
}

function subjectInsertValues(
  who: SubjectIdentity,
  input: {
    readonly id: string;
    readonly userName: string;
    readonly displayName: string;
    readonly at: Date;
    readonly firstSeenAt: Date | null;
    readonly lastSeenAt: Date | null;
  },
) {
  return {
    id: input.id,
    tenantId: who.tenantId,
    orgId: who.orgId,
    status: "active",
    revision: 1,
    createdAt: input.at,
    createdBy: who.userId,
    updatedAt: input.at,
    updatedBy: who.userId,
    userName: input.userName,
    displayName: input.displayName,
    sourceSyncedAt: input.at,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
  };
}

async function subjectRow(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  identity: Identity,
  subjectId: string,
): Promise<DirectoryPersonRow> {
  const [row] = await exec
    .select()
    .from(directoryTable)
    .where(scopedWhere(directoryTable, identity, eq(directoryTable.id, subjectId)))
    .limit(1);
  if (!row) fail(`the current tenant has no platform user "${subjectId}"`);
  return row as DirectoryPersonRow;
}

async function grantsFor(exec: Executor, identity: Identity, roleId: string): Promise<readonly RoleGrant[]> {
  const rows = await exec
    .select({
      module: rbacRoleGrant.module,
      systemKey: rbacRoleGrant.systemKey,
      actions: rbacRoleGrant.actions,
      buttons: rbacRoleGrant.buttons,
      fields: rbacRoleGrant.fields,
      scope: rbacRoleGrant.scope,
    })
    .from(rbacRoleGrant)
    .where(scopedWhere(rbacRoleGrant, identity, eq(rbacRoleGrant.roleId, roleId)))
    .orderBy(...grantOrderBy());
  return rows.map((row) => roleGrantFromRow(row, `role "${roleId}"`));
}

function toAssignment(
  row: {
    readonly assignmentId: string;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
    readonly roleId: string;
    readonly roleCode: string;
    readonly roleName: string;
    readonly roleDescription: string;
    readonly roleStatus: string;
  },
  grants: readonly RoleGrant[],
): StoredRoleAssignment {
  return {
    id: row.assignmentId,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    role: {
      id: row.roleId,
      code: row.roleCode,
      name: row.roleName,
      description: row.roleDescription,
      status: roleStatus(row.roleStatus, row.roleId),
      grants,
    },
  };
}

async function activeAssignments(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  who: SubjectIdentity,
  at: Date,
): Promise<readonly StoredRoleAssignment[]> {
  validDate(at, "resolve assignment time");
  const rows = await exec
    .select({
      assignmentId: rbacAssignment.id,
      validFrom: rbacAssignment.validFrom,
      validUntil: rbacAssignment.validUntil,
      roleId: rbacRole.id,
      roleCode: rbacRole.code,
      roleName: rbacRole.name,
      roleDescription: rbacRole.description,
      roleStatus: rbacRole.status,
      grantId: rbacRoleGrant.id,
      module: rbacRoleGrant.module,
      systemKey: rbacRoleGrant.systemKey,
      actions: rbacRoleGrant.actions,
      buttons: rbacRoleGrant.buttons,
      fields: rbacRoleGrant.fields,
      scope: rbacRoleGrant.scope,
    })
    .from(directoryTable)
    .innerJoin(
      rbacAssignment,
      and(
        eq(rbacAssignment.tenantId, directoryTable.tenantId),
        eq(rbacAssignment.subjectId, directoryTable.id),
        isNull(rbacAssignment.revokedAt),
        lte(rbacAssignment.validFrom, at),
        or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
      ),
    )
    .innerJoin(rbacRole, and(
      eq(rbacRole.tenantId, rbacAssignment.tenantId),
      eq(rbacRole.id, rbacAssignment.roleId),
    ))
    .leftJoin(
      rbacRoleGrant,
      and(eq(rbacRoleGrant.tenantId, rbacRole.tenantId), eq(rbacRoleGrant.roleId, rbacRole.id)),
    )
    .where(scopedWhere(
      directoryTable,
      who,
      eq(directoryTable.id, who.userId),
      eq(directoryTable.status, "active"),
    ))
    .orderBy(asc(rbacRole.code), ...grantOrderBy());

  const grantsByAssignment = new Map<string, RoleGrant[]>();
  const firstRow = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!firstRow.has(row.assignmentId)) firstRow.set(row.assignmentId, row);
    if (row.grantId == null) continue;
    const grants = grantsByAssignment.get(row.assignmentId) ?? [];
    grants.push(roleGrantFromRow(row, `role "${row.roleId}"`));
    grantsByAssignment.set(row.assignmentId, grants);
  }
  return [...firstRow.values()].map((row) => toAssignment(
    row,
    grantsByAssignment.get(row.assignmentId) ?? [],
  ));
}

async function managerRows(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  identity: SubjectIdentity,
  permissionKey: string,
  at: Date,
  extra?: ReturnType<typeof eq>,
) {
  return await exec
    .select({ subjectId: rbacAssignment.subjectId, id: rbacAssignment.id })
    .from(rbacAssignment)
    .innerJoin(directoryTable, and(
      eq(directoryTable.tenantId, rbacAssignment.tenantId),
      eq(directoryTable.id, rbacAssignment.subjectId),
      eq(directoryTable.status, "active"),
    ))
    .innerJoin(rbacRole, and(
      eq(rbacRole.tenantId, rbacAssignment.tenantId),
      eq(rbacRole.id, rbacAssignment.roleId),
      eq(rbacRole.status, "active"),
    ))
    .innerJoin(rbacRoleGrant, and(
      eq(rbacRoleGrant.tenantId, rbacRole.tenantId),
      eq(rbacRoleGrant.roleId, rbacRole.id),
      // Permission management is a system row. managerPermissionKey matches system_key, and permission_key is no longer queried.
      eq(rbacRoleGrant.systemKey, permissionKey),
    ))
    .where(scopedWhere(
      rbacAssignment,
      identity,
      isNull(rbacAssignment.revokedAt),
      lte(rbacAssignment.validFrom, at),
      or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
      extra,
    ))
    .limit(1);
}

async function assertManagerRemains(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  identity: SubjectIdentity,
  permissionKey: string,
  at: Date,
): Promise<void> {
  if ((await managerRows(exec, directoryTable, identity, permissionKey, at)).length === 0) {
    fail("this change would remove the tenant's last effective permission administrator; refusing to run");
  }
}

async function managerExists(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  identity: SubjectIdentity,
  permissionKey: string,
  at: Date,
): Promise<boolean> {
  return (await managerRows(exec, directoryTable, identity, permissionKey, at)).length > 0;
}

async function currentRbacVersion(exec: Executor, identity: SubjectIdentity): Promise<string> {
  const [row] = await exec.select({
    count: sql<number>`count(*)::int`,
    maxId: sql<string | null>`max(${rbacAudit.id})`,
  }).from(rbacAudit).where(scopedWhere(rbacAudit, identity));
  if (!row || row.count === 0) return "initial";
  return `${String(row.count)}:${row.maxId ?? "missing"}`;
}

async function assertActorIsManager(
  exec: Executor,
  directoryTable: DirectoryPersonTable,
  identity: SubjectIdentity,
  permissionKey: string,
  at: Date,
): Promise<void> {
  const [row] = await exec.select({ id: directoryTable.id }).from(directoryTable)
    .where(scopedWhere(
      directoryTable,
      identity,
      eq(directoryTable.id, identity.userId),
      eq(directoryTable.status, "active"),
    ))
    .limit(1);
  if (!row) fail("this person is not synced yet or is no longer in the active directory, and cannot manage permissions");
  const rows = await managerRows(exec, directoryTable, identity, permissionKey, at, eq(rbacAssignment.subjectId, String(row.id)));
  if (rows.length === 0) fail("the current user is no longer an effective permission administrator; sign in again or contact another administrator");
}

export function createLocalRbacRepo(exec: Executor, options: LocalRbacRepoOptions) {
  const directoryTable = options.directoryTable;
  const lastSeenWrittenAt = new Map<string, number>();
  const roleDetail = async (identity: Identity, roleId: string, at: Date) => {
    const role = await roleRow(exec, identity, roleId);
    const [grants, assignments] = await Promise.all([
      grantsFor(exec, identity, roleId),
      exec
        .select({ subjectId: rbacAssignment.subjectId })
        .from(rbacAssignment)
        .where(scopedWhere(
          rbacAssignment,
          identity,
          eq(rbacAssignment.roleId, roleId),
          isNull(rbacAssignment.revokedAt),
          lte(rbacAssignment.validFrom, at),
          or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
        )),
    ]);
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: roleStatus(role.status, role.id),
      memberCount: new Set(assignments.map((assignment) => assignment.subjectId)).size,
      updatedAt: role.updatedAt.toISOString(),
      grants,
    };
  };

  return {
    async observe(subject: SubjectIdentity, at: Date): Promise<void> {
      const who = requireSubject(subject);
      validDate(at, "platform subject registration time");
      const key = subjectSeenKey(who);
      const previous = lastSeenWrittenAt.get(key);
      if (previous !== undefined && at.getTime() - previous < SUBJECT_SEEN_THROTTLE_MS) return;
      await exec.update(directoryTable)
        .set({ orgId: who.orgId, lastSeenAt: at, updatedAt: at, updatedBy: who.userId })
        .where(scopedWhere(directoryTable, who, eq(directoryTable.id, who.userId)));
      await exec.update(directoryTable)
        .set({ firstSeenAt: at, updatedAt: at, updatedBy: who.userId })
        .where(scopedWhere(
          directoryTable,
          who,
          eq(directoryTable.id, who.userId),
          isNull(directoryTable.firstSeenAt),
        ));
      lastSeenWrittenAt.set(key, at.getTime());
    },

    async resolve(subject: SubjectIdentity, at: Date): Promise<readonly StoredRoleAssignment[]> {
      return await activeAssignments(exec, directoryTable, requireSubject(subject), at);
    },

    async seedRoles(subject: SubjectIdentity, seeds: readonly RoleSeedInput[], at: Date): Promise<void> {
      const who = requireSubject(subject);
      validDate(at, "authorization seed time");
      if (new Set(seeds.map((seed) => seed.code)).size !== seeds.length) fail("authorization seed codes cannot be duplicated");
      await exec.transaction(async (tx) => {
        await lockTenant(tx, who.tenantId);
        const existingRoles = await tx.select().from(rbacRole).where(scopedWhere(rbacRole, who));
        const changes: string[] = [];
        for (const seed of seeds) {
          const grants = normalizeGrants(seed.grants, `role seed "${seed.code}"`);
          if (existingRoles.some((role) => role.code === seed.code)) continue;
          const roleId = randomUUID();
          await tx.insert(rbacRole).values({
            id: roleId,
            tenantId: who.tenantId,
            orgId: who.orgId,
            code: seed.code,
            name: seed.name,
            description: seed.description,
            kind: "custom",
            status: "active",
            createdAt: at,
            createdBy: who.userId,
            updatedAt: at,
            updatedBy: who.userId,
          });
          if (grants.length) {
            await tx.insert(rbacRoleGrant).values(grantInsertRows(who, roleId, grants, at));
          }
          changes.push(`create-role:${seed.code}`);
        }
        if (changes.length === 0) return;
        await appendAudit(tx, who, "authorization.seed", "tenant", who.tenantId, null, { changes }, at);
      });
    },

    async bootstrapManager(subject: SubjectIdentity, tenantAdminRoleCode: string, at: Date): Promise<boolean> {
      const who = requireSubject(subject);
      validDate(at, "first-admin initialization time");
      return await exec.transaction(async (tx) => {
        await lockTenant(tx, who.tenantId);
        if (await managerExists(tx, directoryTable, who, options.managerPermissionKey, at)) return false;
        const [storedSubject] = await tx
          .select()
          .from(directoryTable)
          .where(scopedWhere(directoryTable, who, eq(directoryTable.id, who.userId)))
          .limit(1);
        const effectiveSubject = storedSubject
          ? (await tx.update(directoryTable).set({
              orgId: who.orgId,
              status: "active",
              sourceSyncedAt: at,
              lastSeenAt: at,
              updatedAt: at,
              updatedBy: who.userId,
            }).where(scopedWhere(directoryTable, who, eq(directoryTable.id, (storedSubject as DirectoryPersonRow).id))).returning())[0]! as DirectoryPersonRow
          : (await tx.insert(directoryTable).values(subjectInsertValues(who, {
              id: who.userId, userName: who.userId, displayName: who.userId,
              at, firstSeenAt: at, lastSeenAt: at,
            })).returning())[0]! as DirectoryPersonRow;
        if (effectiveSubject.firstSeenAt === null) {
          await tx.update(directoryTable).set({ firstSeenAt: at, updatedAt: at, updatedBy: who.userId })
            .where(scopedWhere(directoryTable, who, eq(directoryTable.id, effectiveSubject.id)));
        }
        const [role] = await tx
          .select()
          .from(rbacRole)
          .where(scopedWhere(rbacRole, who, eq(rbacRole.code, tenantAdminRoleCode), eq(rbacRole.status, "active")))
          .limit(1);
        if (!role) fail(`the current tenant has no active role "${tenantAdminRoleCode}"`);
        const [managerGrant] = await tx
          .select({ id: rbacRoleGrant.id })
          .from(rbacRoleGrant)
          .where(scopedWhere(rbacRoleGrant, who, eq(rbacRoleGrant.roleId, role.id), eq(rbacRoleGrant.systemKey, options.managerPermissionKey)))
          .limit(1);
        if (!managerGrant) fail(`role "${tenantAdminRoleCode}" has no permission-management grant; refusing to initialize the first administrator`);
        const [existing] = await tx
          .select({ id: rbacAssignment.id })
          .from(rbacAssignment)
          .where(scopedWhere(
            rbacAssignment,
            who,
            eq(rbacAssignment.subjectId, effectiveSubject.id),
            eq(rbacAssignment.roleId, role.id),
            isNull(rbacAssignment.revokedAt),
            or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
          ))
          .limit(1);
        if (existing) {
          await appendAudit(tx, who, "tenant.bootstrap-manager", "subject", effectiveSubject.id, storedSubject, effectiveSubject, at);
          return true;
        }
        const assignment = {
          id: randomUUID(),
          tenantId: who.tenantId,
          orgId: who.orgId,
          subjectId: effectiveSubject.id,
          roleId: role.id,
          validFrom: at,
          validUntil: null,
          createdAt: at,
          createdBy: who.userId,
          updatedAt: at,
          updatedBy: who.userId,
        };
        await tx.insert(rbacAssignment).values(assignment);
        await appendAudit(tx, who, "tenant.bootstrap-manager", "assignment", assignment.id, null, assignment, at);
        return true;
      });
    },

    async listRoles(identity: Identity, at: Date) {
      const who = requireIdentity(identity);
      validDate(at, "role list time");
      // 🔴 Leave the count in SQL. Pulling assignment rows into memory to filter and count grows linearly with the grant size,
      // and the list only wants one integer per role.
      const rows = await exec
        .select({
          id: rbacRole.id,
          code: rbacRole.code,
          name: rbacRole.name,
          description: rbacRole.description,
          status: rbacRole.status,
          updatedAt: rbacRole.updatedAt,
          memberCount: countDistinct(rbacAssignment.subjectId),
        })
        .from(rbacRole)
        .leftJoin(
          rbacAssignment,
          and(
            // 🔴 The tenant condition must be in the join: where only narrows the left table, and omitting it on the join pairs across tenants.
            eq(rbacAssignment.tenantId, rbacRole.tenantId),
            eq(rbacAssignment.roleId, rbacRole.id),
            isNull(rbacAssignment.revokedAt),
            lte(rbacAssignment.validFrom, at),
            or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
          ),
        )
        .where(scopedWhere(rbacRole, who))
        .groupBy(rbacRole.id)
        .orderBy(asc(rbacRole.code));
      return rows.map((role) => ({
        ...role,
        status: roleStatus(role.status, role.id),
        updatedAt: role.updatedAt.toISOString(),
      }));
    },

    async getRole(identity: Identity, roleId: string, at: Date) {
      const who = requireIdentity(identity);
      const [exists] = await exec
        .select({ id: rbacRole.id })
        .from(rbacRole)
        .where(scopedWhere(rbacRole, who, eq(rbacRole.id, roleId)))
        .limit(1);
      return exists ? await roleDetail(who, roleId, at) : null;
    },

    async listSubjects(identity: Identity, keyword: string | null, at: Date) {
      const who = requireIdentity(identity);
      validDate(at, "platform user list time");
      const subjects = await exec
        .select()
        .from(directoryTable)
        .where(scopedWhere(
          directoryTable,
          who,
          eq(directoryTable.status, "active"),
          keyword === null ? undefined : or(
            ilike(directoryTable.id, `%${keyword.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`),
            ilike(directoryTable.userName, `%${keyword.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`),
            ilike(directoryTable.displayName, `%${keyword.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`),
          ),
        ))
        .orderBy(asc(directoryTable.displayName), asc(directoryTable.id));
      const assignmentRows = await exec
        .select({
          subjectId: rbacAssignment.subjectId,
          assignmentId: rbacAssignment.id,
          validFrom: rbacAssignment.validFrom,
          validUntil: rbacAssignment.validUntil,
          roleId: rbacRole.id,
          roleName: rbacRole.name,
        })
        .from(rbacAssignment)
        .innerJoin(rbacRole, and(eq(rbacRole.tenantId, rbacAssignment.tenantId), eq(rbacRole.id, rbacAssignment.roleId)))
        .where(scopedWhere(
          rbacAssignment,
          who,
          isNull(rbacAssignment.revokedAt),
          or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
        ));
      return subjects.map((raw) => {
      const row = raw as DirectoryPersonRow;
      return {
        id: row.id,
        userId: row.id,
        userName: row.userName,
        displayName: row.displayName,
        status: row.status,
        sourceSyncedAt: row.sourceSyncedAt.toISOString(),
        orgId: row.orgId,
        orgPath: null,
        workerId: null,
        workerName: null,
        firstSeenAt: row.firstSeenAt?.toISOString() ?? null,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        roles: assignmentRows
          .filter((assignment) => assignment.subjectId === row.id)
          .map((assignment) => ({
            id: assignment.roleId,
            name: assignment.roleName,
            assignmentId: assignment.assignmentId,
            validFrom: assignment.validFrom.toISOString(),
            validUntil: assignment.validUntil?.toISOString() ?? null,
          })),
      };
      });
    },

    async displayNamesOf(identity: Identity, userIds: readonly string[]) {
      const who = requireIdentity(identity);
      if (userIds.length === 0) return new Map<string, string>();
      const unique = [...new Set(userIds.filter((id) => id !== ""))];
      if (unique.length === 0) return new Map<string, string>();
      // Display lookup binds only the tenant. A disabled person stays in the directory, and a name on a historical document must still show.
      // An id that is not in the directory is not given a name here; the display caller throws.
      const subjects = await exec
        .select({ userId: directoryTable.id, displayName: directoryTable.displayName })
        .from(directoryTable)
        .where(scopedWhere(
          directoryTable,
          who,
          inArray(directoryTable.id, unique),
        ));
      return new Map(subjects.map((row) => [String(row.userId), String(row.displayName)]));
    },

    async listApplicationAssignments(identity: Identity): Promise<readonly StoredApplicationAssignment[]> {
      const who = requireIdentity(identity);
      const rows = await exec
        .select({
          id: applicationAssignment.id,
          applicationCode: applicationAssignment.applicationCode,
          subjectId: applicationAssignment.subjectId,
          assignedAt: applicationAssignment.assignedAt,
          assignedBy: applicationAssignment.assignedBy,
        })
        .from(applicationAssignment)
        .where(scopedWhere(applicationAssignment, who, isNull(applicationAssignment.revokedAt)))
        .orderBy(asc(applicationAssignment.applicationCode), asc(applicationAssignment.subjectId));
      return rows.map((row) => ({ ...row, assignedAt: row.assignedAt.toISOString() }));
    },

    async applicationBootstrap(subject: SubjectIdentity): Promise<{
      readonly applicationCodes: readonly string[];
      readonly authorizationVersion: string;
    }> {
      const who = requireSubject(subject);
      const rows = await exec
        .select({ applicationCode: applicationAssignment.applicationCode })
        .from(directoryTable)
        .innerJoin(applicationAssignment, and(
          eq(applicationAssignment.tenantId, who.tenantId),
          eq(applicationAssignment.subjectId, who.userId),
          isNull(applicationAssignment.revokedAt),
        ))
        .where(scopedWhere(
          directoryTable,
          who,
          eq(directoryTable.id, who.userId),
          eq(directoryTable.status, "active"),
        ))
        .orderBy(asc(applicationAssignment.applicationCode));
      return {
        applicationCodes: rows.map((row) => row.applicationCode),
        authorizationVersion: await currentRbacVersion(exec, who),
      };
    },

    async resolveSubject(identity: Identity, subjectId: string, at: Date) {
      const who = requireIdentity(identity);
      const subject = await subjectRow(exec, directoryTable, who, subjectId).catch((error: unknown) => {
        if (error instanceof LocalRbacRepoError && error.message.includes("has no platform user")) return null;
        throw error;
      });
      if (subject === null) return null;
      const assignments = await activeAssignments(exec, directoryTable, { ...who, userId: subject.id, orgId: subject.orgId }, at);
      return {
        subject: {
          id: subject.id,
          userId: subject.id,
          userName: subject.userName,
          displayName: subject.displayName,
          status: subject.status,
          sourceSyncedAt: subject.sourceSyncedAt.toISOString(),
          orgId: subject.orgId,
          orgPath: null,
          workerId: null,
          workerName: null,
          firstSeenAt: subject.firstSeenAt?.toISOString() ?? null,
          lastSeenAt: subject.lastSeenAt?.toISOString() ?? null,
          roles: assignments.map((assignment) => ({
            id: assignment.role.id,
            name: assignment.role.name,
            assignmentId: assignment.id,
            validFrom: assignment.validFrom.toISOString(),
            validUntil: assignment.validUntil?.toISOString() ?? null,
          })),
        },
        assignments,
      };
    },

    async currentVersion(identity: Identity): Promise<string> {
      return await currentRbacVersion(exec, requireIdentity(identity));
    },

    async applyChangeSet(
      identity: Identity,
      changeSet: StoredAuthorizationChangeSet,
      approval: StoredApprovalUse,
      at: Date,
    ) {
      const who = requireIdentity(identity);
      validDate(at, "authorization change submit time");
      if (!changeSet.idempotencyKey.trim()) fail("authorization change is missing idempotencyKey");
      if (!changeSet.baseVersion.trim()) fail("authorization change is missing baseVersion");
      if (changeSet.operations.length === 0) fail("an authorization change must contain at least one operation");
      if (changeSet.operations.length > 100) fail("one authorization change contains at most 100 operations");
      const applicationOperations = changeSet.operations.filter(
        (operation) => operation.kind === "application.assignments.replace",
      );
      if (new Set(applicationOperations.map((operation) => operation.applicationCode)).size !== applicationOperations.length) {
        fail("the same application can fully replace its person set only once in one authorization change");
      }
      if (!approval.callId.trim() || !approval.proofHash.trim() || !approval.inputHash.trim()) {
        fail("authorization change is missing a trusted approval coordinate");
      }

      return await exec.transaction(async (tx) => {
        await lockTenant(tx, who.tenantId);

        const [replay] = await tx.select().from(rbacChangeSet)
          .where(scopedWhere(rbacChangeSet, who, eq(rbacChangeSet.idempotencyKey, changeSet.idempotencyKey)))
          .limit(1);
        if (replay) {
          if (replay.requestHash !== approval.inputHash) {
            conflict("the same idempotencyKey was already used for a different authorization change; refusing to overwrite");
          }
          const stored = replay.result as {
            changeSetId: string; idempotencyKey: string; appliedAt: string; operationCount: number;
          };
          return { ...stored, replayed: true };
        }

        await assertActorIsManager(tx, directoryTable, who, options.managerPermissionKey, at);
        const version = await currentRbacVersion(tx, who);
        if (version !== changeSet.baseVersion) {
          conflict("permission configuration was changed by someone else after the impact preview; preview again");
        }
        const [usedApproval] = await tx.select({ id: rbacChangeSet.id }).from(rbacChangeSet)
          .where(scopedWhere(rbacChangeSet, who, eq(rbacChangeSet.approvalCallId, approval.callId)))
          .limit(1);
        if (usedApproval) conflict("this session approval was already consumed and cannot be used for another authorization change");

        if (applicationOperations.length > 0) {
          const desiredApplicationBySubject = new Map<string, string>();
          for (const operation of applicationOperations) {
            for (const subjectId of operation.subjectIds) {
              const previous = desiredApplicationBySubject.get(subjectId);
              if (previous !== undefined && previous !== operation.applicationCode) {
                fail(
                  `person "${subjectId}" can be bound to only one mobile application at a time; ` +
                  `cannot bind both "${previous}" and "${operation.applicationCode}" in the same change`,
                );
              }
              desiredApplicationBySubject.set(subjectId, operation.applicationCode);
            }
          }
          const activeApplications = await tx
            .select({
              subjectId: applicationAssignment.subjectId,
              applicationCode: applicationAssignment.applicationCode,
            })
            .from(applicationAssignment)
            .where(scopedWhere(applicationAssignment, who, isNull(applicationAssignment.revokedAt)));
          for (const [subjectId, desiredApplication] of desiredApplicationBySubject) {
            const other = activeApplications.find((assignment) =>
              assignment.subjectId === subjectId && assignment.applicationCode !== desiredApplication);
            if (other !== undefined) {
              fail(
                `person "${subjectId}" is already bound to application "${other.applicationCode}"; ` +
                `unbind first, then bind "${desiredApplication}". The application cannot be switched directly in the same change`,
              );
            }
          }
        }

        const effects: unknown[] = [];
        const saveAssignment = async (value: StoredAssignmentValue): Promise<void> => {
          validDate(value.validFrom, "assignment validFrom");
          if (value.validUntil !== null) validDate(value.validUntil, "assignment validUntil");
          if (value.validUntil !== null && value.validUntil <= value.validFrom) fail("validUntil must be later than validFrom");
          const subject = await subjectRow(tx, directoryTable, who, value.subjectId);
          if (subject.status !== "active") {
            fail(`person "${subject.displayName}" is currently ${subject.status} and cannot be assigned`);
          }
          const role = await roleRow(tx, who, value.roleId);
          if (role.status !== "active") fail(`role "${role.name}" is disabled and cannot be assigned`);
          const [before] = await tx.select().from(rbacAssignment)
            .where(scopedWhere(rbacAssignment, who, eq(rbacAssignment.id, value.id))).limit(1);
          if (before && before.subjectId !== value.subjectId) fail("an assignment cannot change which person it belongs to");
          if (before?.revokedAt !== null && before?.revokedAt !== undefined) fail(`assignment "${value.id}" is already revoked and cannot be restored or changed`);
          const duplicateConditions = [
            eq(rbacAssignment.subjectId, value.subjectId),
            eq(rbacAssignment.roleId, value.roleId),
            isNull(rbacAssignment.revokedAt),
            or(isNull(rbacAssignment.validUntil), gt(rbacAssignment.validUntil, at)),
            ...(before ? [ne(rbacAssignment.id, value.id)] : []),
          ];
          const [duplicate] = await tx.select({ id: rbacAssignment.id }).from(rbacAssignment)
            .where(scopedWhere(rbacAssignment, who, ...duplicateConditions)).limit(1);
          if (duplicate) fail(`this user already has an active or scheduled assignment of role "${role.name}"`);
          const stored = {
            id: value.id, tenantId: who.tenantId, orgId: who.orgId,
            subjectId: value.subjectId, roleId: value.roleId,
            validFrom: value.validFrom, validUntil: value.validUntil,
            revokedAt: null, createdAt: before?.createdAt ?? at, createdBy: before?.createdBy ?? who.userId,
            updatedAt: at, updatedBy: who.userId,
          };
          if (before) {
            await tx.update(rbacAssignment).set({
              roleId: stored.roleId, validFrom: stored.validFrom, validUntil: stored.validUntil,
              updatedAt: at, updatedBy: who.userId,
            }).where(scopedWhere(rbacAssignment, who, eq(rbacAssignment.id, value.id)));
          } else {
            await tx.insert(rbacAssignment).values(stored);
          }
          effects.push({ kind: before ? "assignment.update" : "assignment.create", targetId: value.id, before: before ?? null, after: stored });
        };

        for (const operation of changeSet.operations) {
          switch (operation.kind) {
            case "role.save": {
              const value = operation.role;
              if (!value.id.trim() || !value.code.trim() || !value.name.trim()) fail("role id, code, and name cannot be empty");
              const grants = normalizeGrants(value.grants, `role "${value.name}"`);
              const [before] = await tx.select().from(rbacRole)
                .where(scopedWhere(rbacRole, who, eq(rbacRole.id, value.id))).limit(1);
              if (before && before.code !== value.code) fail("role code is a stable identifier and cannot be changed after creation");
              const [sameCode] = await tx.select({ id: rbacRole.id }).from(rbacRole)
                .where(scopedWhere(rbacRole, who, eq(rbacRole.code, value.code))).limit(1);
              if (sameCode && sameCode.id !== value.id) fail(`the current tenant already has role code "${value.code}"`);
              const stored = {
                id: value.id, tenantId: who.tenantId, orgId: who.orgId, code: value.code,
                name: value.name, description: value.description, kind: "custom" as const, status: value.status,
                createdAt: before?.createdAt ?? at, createdBy: before?.createdBy ?? who.userId,
                updatedAt: at, updatedBy: who.userId,
              };
              if (before) await tx.update(rbacRole).set({
                name: value.name, description: value.description, status: value.status, updatedAt: at, updatedBy: who.userId,
              }).where(scopedWhere(rbacRole, who, eq(rbacRole.id, value.id)));
              else await tx.insert(rbacRole).values(stored);
              const beforeGrants = before ? await grantsFor(tx, who, value.id) : [];
              if (before) {
                await tx.delete(rbacRoleGrant).where(scopedWhere(rbacRoleGrant, who, eq(rbacRoleGrant.roleId, value.id)));
              }
              if (grants.length > 0) {
                await tx.insert(rbacRoleGrant).values(grantInsertRows(who, value.id, grants, at));
              }
              effects.push({
                kind: before ? "role.update" : "role.create",
                targetId: value.id,
                before: before ? { role: before, grants: beforeGrants } : null,
                after: {
                  id: value.id,
                  code: value.code,
                  name: value.name,
                  description: value.description,
                  status: value.status,
                  grants,
                },
              });
              break;
            }
            case "subject.sync": {
              if (operation.subjects.length === 0) fail("the person-directory sync result cannot be empty");
              if (new Set(operation.subjects.map((item) => item.id)).size !== operation.subjects.length) {
                fail("the person-directory sync contains a duplicate id");
              }
              const current = (await tx.select().from(directoryTable).where(scopedWhere(directoryTable, who))) as DirectoryPersonRow[];
              const byId = new Map(current.map((row) => [row.id, row]));
              const incomingIds = new Set<string>();
              for (const item of operation.subjects) {
                if (![item.id, item.userName, item.displayName, item.status]
                  .every((value) => value.trim())) fail("a synced person's id, userName, displayName, and status cannot be empty");
                if (item.status !== "active") fail("directory sync can write only active accounts");
                incomingIds.add(item.id);
                const existing = byId.get(item.id);
                const after = {
                  userName: item.userName,
                  displayName: item.displayName,
                  status: "active",
                  sourceSyncedAt: at,
                  orgId: who.orgId,
                  updatedAt: at,
                  updatedBy: who.userId,
                };
                if (existing) {
                  await tx.update(directoryTable).set(after)
                    .where(scopedWhere(directoryTable, who, eq(directoryTable.id, existing.id)));
                } else {
                  await tx.insert(directoryTable).values(subjectInsertValues(who, {
                    id: item.id, userName: item.userName, displayName: item.displayName,
                    at, firstSeenAt: null, lastSeenAt: null,
                  }));
                }
                effects.push({
                  kind: existing ? "subject.sync.update" : "subject.sync.create",
                  targetId: existing?.id ?? item.id,
                  before: existing ?? null,
                  after: item,
                });
              }
              for (const existing of current.filter((row) => !incomingIds.has(row.id))) {
                if (existing.status === "disabled") continue;
                await tx.update(directoryTable).set({
                  status: "disabled", sourceSyncedAt: at, updatedAt: at, updatedBy: who.userId,
                }).where(scopedWhere(directoryTable, who, eq(directoryTable.id, existing.id)));
                effects.push({
                  kind: "subject.sync.remove",
                  targetId: existing.id,
                  before: existing,
                  after: { status: "disabled", sourceSyncedAt: at },
                });
              }
              break;
            }
            case "application.assignments.replace": {
              const applicationCode = operation.applicationCode.trim();
              if (!applicationCode) fail("application code cannot be empty");
              if (operation.subjectIds.some((subjectId) => !subjectId.trim())) fail("an application assignment cannot contain an empty subjectId");
              if (new Set(operation.subjectIds).size !== operation.subjectIds.length) {
                fail(`people in application "${applicationCode}" cannot be duplicated`);
              }
              const desiredSubjectIds = [...operation.subjectIds].sort();
              const subjects = desiredSubjectIds.length === 0 ? [] : await tx
                .select({ id: directoryTable.id, status: directoryTable.status })
                .from(directoryTable)
                .where(scopedWhere(directoryTable, who, inArray(directoryTable.id, desiredSubjectIds)));
              if (subjects.length !== desiredSubjectIds.length) fail(`application "${applicationCode}" references a person who does not exist in the current tenant`);
              const disabled = subjects.find((row) => row.status !== "active");
              if (disabled) fail(`person "${disabled.id}" is currently ${disabled.status} and cannot be assigned an application`);

              const before = await tx
                .select({ id: applicationAssignment.id, subjectId: applicationAssignment.subjectId })
                .from(applicationAssignment)
                .where(scopedWhere(
                  applicationAssignment,
                  who,
                  eq(applicationAssignment.applicationCode, applicationCode),
                  isNull(applicationAssignment.revokedAt),
                ));
              const beforeSubjectIds = before.map((row) => row.subjectId).sort();
              const desired = new Set(desiredSubjectIds);
              const current = new Set(beforeSubjectIds);
              const removed = before.filter((row) => !desired.has(row.subjectId));
              const added = desiredSubjectIds.filter((subjectId) => !current.has(subjectId));
              if (removed.length > 0) {
                await tx.update(applicationAssignment)
                  .set({ revokedAt: at, revokedBy: who.userId })
                  .where(scopedWhere(applicationAssignment, who, inArray(applicationAssignment.id, removed.map((row) => row.id))));
              }
              if (added.length > 0) {
                await tx.insert(applicationAssignment).values(added.map((subjectId) => ({
                  id: randomUUID(),
                  tenantId: who.tenantId,
                  orgId: who.orgId,
                  subjectId,
                  applicationCode,
                  assignedAt: at,
                  assignedBy: who.userId,
                  revokedAt: null,
                  revokedBy: null,
                })));
              }
              effects.push({
                kind: operation.kind,
                targetId: applicationCode,
                before: { subjectIds: beforeSubjectIds },
                after: { subjectIds: desiredSubjectIds },
                addedSubjectIds: added,
                removedSubjectIds: removed.map((row) => row.subjectId).sort(),
              });
              break;
            }
            case "assignment.save":
              await saveAssignment(operation.assignment);
              break;
            case "affiliation.add":
            case "affiliation.remove": {
              const subject = await subjectRow(tx, directoryTable, who, operation.subjectId);
              if (subject.status !== "active") {
                fail(`"${subject.displayName}" is no longer on the person list and cannot have their organization changed`);
              }
              const orgUnitId = operation.orgUnitId.trim();
              if (!orgUnitId) fail("the organization change is missing an organization");
              const [existing] = await tx.select().from(orgAffiliation).where(scopedWhere(
                orgAffiliation, who, eq(orgAffiliation.subjectUserId, subject.id), eq(orgAffiliation.resourceId, orgUnitId),
              )).limit(1);
              const membership = (id: string) => ({ id, subjectId: subject.id, orgUnitId });
              if (operation.kind === "affiliation.add") {
                if (existing) fail(`"${subject.displayName}" is already in this organization; refresh before changing it`);
                const id = randomUUID();
                await tx.insert(orgAffiliation).values({
                  id, tenantId: who.tenantId, orgId: who.orgId,
                  subjectUserId: subject.id, resourceId: orgUnitId,
                  createdAt: at, createdBy: who.userId, updatedAt: at, updatedBy: who.userId,
                });
                await appendAudit(tx, who, operation.kind, "org-affiliation", id, null, membership(id), at);
                effects.push({ kind: operation.kind, targetId: id, before: null, after: membership(id) });
              } else {
                if (!existing) fail(`"${subject.displayName}" is not in this organization; refresh before changing it`);
                await tx.delete(orgAffiliation).where(scopedWhere(orgAffiliation, who, eq(orgAffiliation.id, existing.id)));
                await appendAudit(tx, who, operation.kind, "org-affiliation", existing.id, membership(existing.id), null, at);
                effects.push({ kind: operation.kind, targetId: existing.id, before: membership(existing.id), after: null });
              }
              break;
            }
            case "assignment.revoke": {
              const [before] = await tx.select().from(rbacAssignment).where(scopedWhere(
                rbacAssignment, who, eq(rbacAssignment.id, operation.assignmentId), eq(rbacAssignment.subjectId, operation.subjectId),
              )).limit(1);
              if (!before) fail(`the current user has no assignment "${operation.assignmentId}"`);
              if (before.revokedAt !== null) fail(`assignment "${operation.assignmentId}" is already revoked`);
              if (before.validUntil !== null && before.validUntil <= at) fail("a finished assignment cannot rewrite history");
              const validUntil = before.validFrom < at ? at : before.validUntil;
              await tx.update(rbacAssignment).set({ revokedAt: at, validUntil, updatedAt: at, updatedBy: who.userId })
                .where(scopedWhere(rbacAssignment, who, eq(rbacAssignment.id, operation.assignmentId)));
              effects.push({ kind: "assignment.revoke", targetId: operation.assignmentId, before, after: { ...before, revokedAt: at, validUntil } });
              break;
            }
          }
        }

        await assertManagerRemains(tx, directoryTable, who, options.managerPermissionKey, at);
        const changeSetId = randomUUID();
        const result = {
          changeSetId,
          idempotencyKey: changeSet.idempotencyKey,
          appliedAt: at.toISOString(),
          operationCount: changeSet.operations.length,
        };
        await appendAudit(tx, who, "authorization.change-set.apply", "change-set", changeSetId, null, {
          idempotencyKey: changeSet.idempotencyKey,
          baseVersion: changeSet.baseVersion,
          effects,
        }, at);
        await tx.insert(rbacChangeSet).values({
          id: changeSetId, tenantId: who.tenantId, orgId: who.orgId,
          idempotencyKey: changeSet.idempotencyKey, requestHash: approval.inputHash,
          approvalCallId: approval.callId, approvalProofHash: approval.proofHash,
          baseVersion: changeSet.baseVersion, result, actorId: who.userId, appliedAt: at,
        });
        return { ...result, replayed: false };
      });
    },

    async listAudit(identity: Identity, limit: number) {
      const who = requireIdentity(identity);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) fail("audit limit must be an integer in 1..200");
      const rows = await exec
        .select()
        .from(rbacAudit)
        .where(scopedWhere(rbacAudit, who))
        .orderBy(sql`${rbacAudit.at} desc`)
        .limit(limit);
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        before: row.before,
        after: row.after,
        actorId: row.actorId,
        at: row.at.toISOString(),
      }));
    },
  };
}
