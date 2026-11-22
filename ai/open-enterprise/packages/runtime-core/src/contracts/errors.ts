import type { BillIssue } from "@open-erp/metamodel";

/** Expected business refusal from a repository port; the PG implementation and the runtime share this error type. */
export class RepoError extends Error {
  override readonly name = "RepoError";
  readonly apiHint: string | null;

  constructor(message: string, apiHint: string | null = null) {
    super(message);
    this.apiHint = apiHint;
  }
}

/**
 * The repository cannot read this bill: it does not exist, or it is outside the caller's view
 * (the two cases are deliberately the same sentence; see the repository implementation).
 *
 * A dedicated type exists for one reason: a human entry that writes against "the revision I saw"
 * must treat "not found" as "deleted after you opened it" (`StaleRevisionError`, actualRevision = null),
 * not as a 404. Other not-found paths (agent, internal) stay on `RepoError`.
 */
export class BillNotFoundError extends RepoError {
  constructor(
    readonly module: string,
    readonly billId: string,
    message: string,
    apiHint: string | null = null,
  ) {
    super(message, apiHint);
  }
}

function invalidMessage(what: string, issues: readonly BillIssue[]): string {
  const first = issues[0];
  if (first === undefined) {
    throw new Error(`${what}: BillInvalidError must carry at least one issue; an empty array cannot express an entry failure`);
  }
  return issues.length === 1
    ? first.message
    : `${what}: ${String(issues.length)} entries are invalid; the first is: ${first.message}`;
}

export class BillInvalidError extends Error {
  override readonly name = "BillInvalidError";
  constructor(
    what: string,
    readonly issues: readonly BillIssue[],
  ) {
    super(invalidMessage(what, issues));
  }
}

/**
 * The bill snapshot the caller used to judge, display, or edit is stale.
 *
 * This is not a PG transaction conflict: the database did not roll back a legal transaction.
 * The application `WHERE revision = expectedRevision` proved "what you confirmed is no longer the current revision".
 * The caller should read again and let the user decide from the latest facts; the system must not replay the old request as-is.
 */
export class StaleRevisionError extends Error {
  override readonly name = "StaleRevisionError";

  constructor(
    readonly module: string,
    readonly billId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number | null,
  ) {
    // The user-facing sentence only says "changed by someone else; please reopen".
    // Module code, record id, and revision are internal, and the user already has this record open.
    // Those values stay on the fields for server logs.
    super("This record was changed by someone else after you opened it. Reopen it before continuing.");
  }
}

/** Ledger query coordinates are invalid; this is a caller 400, not a storage failure. */
export class BalanceArgumentError extends Error {
  override readonly name = "BalanceArgumentError";
}

/**
 * The ledger contract refused this posting (the balance must not go negative).
 *
 * This is a business refusal, not a storage failure: the coordinates are legal and the lock was taken,
 * but the balance would break the contract after the deduction.
 * HTTP maps it to 400 and returns the original text to the caller.
 */
export class LedgerConstraintError extends Error {
  override readonly name = "LedgerConstraintError";
}

/**
 * Expected refusal of a staged action: missing row, status conflict, or an inconsistent staged payload.
 *
 * 400 = the caller or the stored content is invalid; 409 = this staged row's current status does not allow this decision
 * (rejected, expired, or an old row missing revision). Do not throw a bare `Error`: that falls through to HTTP 500.
 */
export class StagedActionError extends Error {
  override readonly name = "StagedActionError";
  constructor(
    message: string,
    readonly httpStatus: 400 | 409 = 400,
  ) {
    super(message);
  }
}
