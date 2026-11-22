// ---------------------------------------------------------------------------
// Identity — one of the two axes orthogonal to the six concepts
//
// This file is security-critical: the connection uses the database owner account and does not go through RLS.
// There is no second line of defense in the database. Tenant isolation depends entirely on every query carrying a scope.
// The rule is one sentence: if identity is missing, throw. Never "no tenant means query everything".
//
// The counterexample actually happened: `where tenantId = ctx.tenantId ?? undefined`
// is equivalent, in the ORM, to omitting the condition. It does not error. It returns every tenant's data to one person.
// ---------------------------------------------------------------------------

import type { DataScope } from "@open-erp/metamodel";

/** Platform subject the gateway has already authenticated. It is not yet an ERP user and cannot access business data. */
export interface SubjectIdentity {
  readonly tenantId: string;
  readonly orgId: string;
  readonly userId: string;
  /** Personal/enterprise axis resolved by the gateway; authorization and billing must not infer it from tenantId. */
  readonly identify?: "0" | "1";
  /**
   * Which agent sent this request; `null` when a person acts directly.
   *
   * This is not the same thing as tenant/org/user and must not stand in for them.
   * Those three say "on whose behalf"; this one says "who is acting on their behalf".
   * It has to live on Identity, not only inside `/api/agent/*`.
   * `$actor.agentId` in rules holds for every entry. Resolving it on only one route means
   * a modeler who writes "only a person may press this" gets a constant pass on `/run`, with no symptom.
   *
   * `null` is a known fact (this request was not sent by an agent), not "we failed to resolve it".
   * A missing header and null are the same thing here, because a person action has no such header.
   */
  readonly agentId: string | null;
}

/**
 * Effective ERP identity for one request.
 *
 * The platform subject is resolved against central authorization by `(tenantId, userId)` before this exists.
 * `permissions` and `dataScopes` are a request-scoped snapshot of central authorization facts.
 * HTTP headers and the request body have no write path into them.
 */
/** One effective role on a request. `code` is what rules, todos, and agent audience compare; `name` is for sentences shown to people. */
export interface IdentityRole {
  readonly code: string;
  readonly name: string;
}

/** `$actor.roles`, handoff `toRole`, and agent audience compare codes, not display names. */
export function roleCodesOf(identity: { readonly roles: readonly IdentityRole[] }): readonly string[] {
  return identity.roles.map((role) => role.code);
}

export interface Identity extends SubjectIdentity {
  readonly identify: "0" | "1";
  readonly roles: readonly IdentityRole[];
  readonly permissions: readonly string[];
  /** module code → widest row scope after merging positive grants from every role. A missing key means neither read nor lookup. */
  readonly dataScopes: Readonly<Record<string, DataScope>>;
  /** Audit coordinates of the central authorization decision. Any business execution can recover the policy version it relied on. */
  readonly authorization: {
    readonly applicationId: "open-erp";
    readonly policyVersion: string;
    readonly catalogDigest: string;
    readonly decisionId: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
  };
}

export class IdentityMissingError extends Error {
  override readonly name = "IdentityMissingError";
}

/**
 * Take an identity and throw if any axis is missing.
 *
 * Check each axis, not only null: `{ tenantId: "", orgId: "x", ... }` is the same disaster,
 * and it passes an "the object exists" check.
 */
export function requireSubject<T extends SubjectIdentity>(identity: T | null | undefined): T {
  if (!identity) throw new IdentityMissingError("This request has no identity; refusing to access data");
  const missing = (["tenantId", "orgId", "userId"] as const).filter((k) => !identity[k]?.trim());
  if (missing.length) {
    throw new IdentityMissingError(`Identity is missing ${missing.join(", ")} — an incomplete isolation axis is always refused, never a degraded query`);
  }
  return identity;
}

export function requireIdentity(identity: Identity | null | undefined): Identity {
  return requireSubject(identity);
}
