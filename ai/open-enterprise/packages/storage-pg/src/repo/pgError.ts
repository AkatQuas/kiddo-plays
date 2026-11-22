// ---------------------------------------------------------------------------
// Database constraint conflicts → errors that say what happened
//
// Drizzle wraps the driver error as `Failed query: insert into ... params: Alice,10000,...`,
// and the real cause (which constraint was violated) is hidden in `cause`. Two consequences, neither of which can stay:
//
//   1. `http/app.ts` returns `err.message` to the browser as-is — so a duplicate document number
//      dumps the whole SQL and **every parameter value** (customer name, amount) to the client.
//   2. The user sees a blob of SQL, and all they need is one sentence: "document number SO-001 already exists".
//
// 🔴 This is not "prettifying errors". The AGENTS rule "present the error as-is, do not swallow or rewrite it" means
// **do not replace a useful cause with "the operation failed"**; this does the opposite: it digs out the cause the ORM buried.
// The constraint name and the conflicting key values stay. What is dropped is the statement itself and unrelated parameters.
// ---------------------------------------------------------------------------

import { sql } from "drizzle-orm";

/** PostgreSQL unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";

/**
 * Two ceilings for a write transaction. **Constants, not configuration** (same criterion as `CLOCK_SKEW_TOLERANCE_MS`):
 * they express "past this duration, this request no longer means anything to the **user**" —
 * and that moment is pinned by the browser XHR timeout (30 seconds), not by the deployment environment.
 * Making them configurable would let someone set them to an hour, and then this line of defense is only a sentence.
 *
 * 🔴 **Both are required, and they stop different things**:
 *   · `lock_timeout` covers only **waiting for a lock**. It is the ceiling this round of work named.
 *   · `statement_timeout` covers a statement that cannot finish on its own (missing index, full scan, bad network).
 *     With only the first, a slow query that takes no lock can still hang the request indefinitely.
 *
 * Value criterion: both must be **clearly under** the client's 30 seconds, or the browser still hits its limit first,
 * and a browser timeout leaves no sentence on the server — that is exactly the shape this exists to remove.
 * `lock_timeout` is the smaller of the two: if a lock is still not held after 10 seconds, the other side is holding
 * a long transaction, and waiting longer only turns this request into a long transaction too.
 */
export const LOCK_TIMEOUT_MS = 10_000;
export const STATEMENT_TIMEOUT_MS = 20_000;

/** Only requires "can send one statement" — a structural type, to avoid `Executor` (it lives in index.ts and would cycle the import). */
interface StatementSink {
  execute(statement: unknown): Promise<unknown>;
}

/**
 * Install both ceilings on **one write transaction**.
 *
 * 🔴 They live in the same file as the two constants above and the two sentences in `TIMEOUT_KIND` that cite them,
 * so "what was set" and "what the error message says" cannot drift structurally:
 * split apart, someone changes the timeout while the error still quotes the old number, and that message sends the investigator into a ditch.
 *
 * 🔴 **`SET LOCAL`, not `SET`.** Connections are pooled: without LOCAL the timeout **stays on that connection**,
 * and whoever reuses it later carries it — so a task that is supposed to run a long time (seed / reap) gets cut off for no visible reason,
 * with no visible link to the request that set it, and there is nowhere to start looking.
 * `SET LOCAL` follows the transaction and expires on commit or rollback.
 *
 * The values are spliced into the statement: `SET LOCAL` does not accept placeholder parameters. Both operands are **numeric constants** in this file,
 * not from any external input, so there is no injection surface here; do not change them to values taken from env or the request.
 */
export async function applyWriteTimeouts(tx: StatementSink): Promise<void> {
  await tx.execute(sql.raw(`set local lock_timeout = '${String(LOCK_TIMEOUT_MS)}ms'`));
  await tx.execute(sql.raw(`set local statement_timeout = '${String(STATEMENT_TIMEOUT_MS)}ms'`));
}

/**
 * Transaction failures PostgreSQL explicitly defines as **retryable** (Class 40 — Transaction Rollback).
 *
 * 🔴 These two codes are not "an unexpected server fault". Dropping them into the `onError` fallback 500
 * **turns a named error with a known remedy into an error with no clue**: in measurement the client received
 * "internal server error, see the server log", while the real cause (a concurrency conflict) and the real remedy
 * (retry as-is) were both in the layer that got swallowed, and the caller had no way to know that trying once more would work.
 *
 * Same class as `UniqueViolationError`, same 409: that message already says
 * "usually concurrency... please retry", and these two codes are two other shapes of the same thing.
 */
const DEADLOCK_DETECTED = "40P01";
const SERIALIZATION_FAILURE = "40001";

const CONFLICT_KIND: Readonly<Record<string, string>> = {
  [DEADLOCK_DETECTED]: "two writes are each waiting for the other to let go (deadlock); the database rolled one of them back",
  [SERIALIZATION_FAILURE]: "the snapshot this transaction read was changed by another write that already committed (serialization failure)",
};

/**
 * Concurrency conflict: this request is itself completely legal, and it **collided with another concurrent write**.
 *
 * 🔴 **Do not retry automatically on the server.** A retry means running a write a second time without the user knowing;
 * only the caller knows whether this write is idempotent (a planner edge already carries `idempotencyKey` and has that ability,
 * and an ordinary create does not). If the server decides for them, the result is a duplicate document, and nothing anywhere says it happened.
 */
export class ConcurrencyConflictError extends Error {
  override readonly name = "ConcurrencyConflictError";
  constructor(
    message: string,
    /** PostgreSQL SQLSTATE: `40P01` deadlock / `40001` serialization failure. Kept so logs and alerts can tell the two apart. */
    readonly code: string,
    override readonly cause: unknown,
  ) {
    super(message);
  }
}

/** `SET LOCAL lock_timeout` fired: waiting for a coordinate lock ran over. */
const LOCK_NOT_AVAILABLE = "55P03";
/** `SET LOCAL statement_timeout` fired (also the code for a manual `pg_cancel_backend`). */
const QUERY_CANCELED = "57014";

const TIMEOUT_KIND: Readonly<Record<string, string>> = {
  [LOCK_NOT_AVAILABLE]:
    `waiting for a document coordinate lock exceeded ${String(LOCK_TIMEOUT_MS)} ms — another write is holding the same document or master data and not letting go`,
  [QUERY_CANCELED]:
    `one statement in this write exceeded ${String(STATEMENT_TIMEOUT_MS)} ms — it was not waiting for a lock; the statement itself could not finish`,
};

/**
 * A write transaction hit a ceiling.
 *
 * 🔴 **The whole reason it exists: a request that hangs forever is worse than a request that errors.**
 * What no ceiling looks like was measured (2026-08-05, old production issuing Planner):
 * the request ran 33 seconds, the browser XHR timed out at 30 seconds first, so the user saw a **button that spun forever**;
 * server stdout had not one word; the database connection sat in `idle in transaction`.
 * Each of the three places looked "fine" on its own, and none of them could say what happened — the investigator could only guess.
 * With the ceiling, the same event becomes an error that carries the millisecond count and a remedy.
 *
 * 🔴 **A separate type from `ConcurrencyConflictError`, not merged**, and the criterion is word-for-word the same shape as
 * "keep unique-conflict 400 and 409 wording apart":
 *   · a concurrency conflict (40P01 / 40001) means two writes collided, and **retrying as-is is enough**;
 *   · a timeout (55P03 / 57014) means someone is holding **for a long time**, or the statement itself cannot finish,
 *     and a retry will usually time out again. The remedy is to see who holds the lock, or why this path is so slow.
 * Folded into one sentence, an error that means "go look at the server" is forever read as "click once more",
 * and clicking any number of times changes nothing.
 */
export class WriteTimeoutError extends Error {
  override readonly name = "WriteTimeoutError";
  constructor(
    message: string,
    /** `55P03` lock-wait timeout / `57014` statement timeout. Kept so logs and alerts can tell the two apart. */
    readonly code: string,
    override readonly cause: unknown,
  ) {
    super(message);
  }
}

export class UniqueViolationError extends Error {
  override readonly name = "UniqueViolationError";
  constructor(
    message: string,
    readonly constraint: string,
    override readonly cause: unknown,
  ) {
    super(message);
  }
}

interface PgErrorish {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
  readonly detail?: unknown;
  readonly cause?: unknown;
}

/** Walk the cause chain to the driver-layer error — Drizzle wraps one layer, and may wrap two later. */
function pgErrorIn(error: unknown): PgErrorish | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as PgErrorish;
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  return null;
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Run a write, and translate a unique-constraint conflict into plain language.
 *
 * Other errors **throw as-is**: an unrecognized failure must not be rephrased by this layer, or the real cause gets covered.
 */
export async function guardWrite<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    const pg = pgErrorIn(error);
    if (pg?.code !== UNIQUE_VIOLATION) throw error;

    const constraint = textOf(pg.constraint_name) ?? "unknown constraint";
    // detail looks like `Key (tenant_id, code)=(T1, SO-001) already exists.` —
    // the conflicting key values are exactly what the user needs to see, and they are data the user just submitted, so returning them is not an overreach.
    const detail = textOf(pg.detail);
    throw new UniqueViolationError(
      `${what}: unique constraint "${constraint}" was violated${detail ? ` — ${detail}` : ""}. ` +
        // 🔴 The wording is deliberately **not** "you typed a duplicate". A unique field the user can fill (`Field.unique`) is
        // already checked by the application layer before storage and marked on the field (`UNIQUE_DUPLICATE` → 400), so a conflict that
        // reaches this layer is usually **concurrency**: another write committed between that check and this store.
        // Folding the two into one sentence means a real concurrency problem is forever read as a user input error,
        // and the user can correct it any number of times and still be right — that is the shape "a user input error must be classified before it reaches the database" exists to prevent.
        "Unique fields the user can fill were already checked before storage, so a conflict at this layer is usually concurrency (another write committed in between): please retry. " +
        "If the retry still conflicts, it is a server problem, not what you entered",
      constraint,
      error,
    );
  }
}

/**
 * Run a transaction, and translate PostgreSQL Class 40 (retryable transaction rollback) into an **actionable** conflict.
 *
 * 🔴 Same criterion as `guardWrite`, same discipline: **other errors throw as-is**. This layer recognizes only those two
 * explicitly defined codes. An unrecognized failure still falls into the `onError` fallback 500 and the server log.
 *
 * 🔴 **No retry** (see `ConcurrencyConflictError`). This does only one thing:
 * replace "internal server error, see the server log" with "concurrency conflict, retry as-is" —
 * and the latter is the only remedy that worked in measurement (40P01 five times, 40001 once, and each as-is retry passed).
 *
 * 🔴 **Do not send SQL or parameters out**: the driver-layer `message` is the whole statement plus every parameter value
 * (customer name, amount). This takes only the SQLSTATE and a sentence written here; the original text is still logged higher in the call chain.
 */
export async function guardConcurrency<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    // 🔴 Already translated: throw as-is. Transactions nest (`billRepo.inTx` issues a SAVEPOINT inside the executor's outer transaction),
    // and without this short-circuit the same conflict is wrapped once inside and once outside. The second layer then reads its own `code`
    // off `cause` as if it were the driver's code — the error message repeats the same sentence twice, and the real original is buried deeper.
    if (error instanceof ConcurrencyConflictError) throw error;
    // Same as above: an already translated timeout throws as-is, or a nested transaction wraps the same timeout once inside and once outside.
    if (error instanceof WriteTimeoutError) throw error;
    const pg = pgErrorIn(error);
    const code = typeof pg?.code === "string" ? pg.code : null;
    if (code !== null && Object.hasOwn(TIMEOUT_KIND, code)) {
      throw new WriteTimeoutError(
        `${what}: timed out (PostgreSQL ${code}) — ${TIMEOUT_KIND[code] as string}. ` +
          "This write was rolled back as a whole, and no half document was left. " +
          "Unlike a concurrency conflict, retrying as-is will usually time out again: see who has been holding these coordinates for a long time " +
          "(`select * from pg_locks join pg_stat_activity using (pid)`), or why this write path is so slow.",
        code,
        error,
      );
    }
    if (code === null || !Object.hasOwn(CONFLICT_KIND, code)) throw error;
    throw new ConcurrencyConflictError(
      `${what}: concurrency conflict (PostgreSQL ${code}) — ${CONFLICT_KIND[code] as string}. ` +
        "This write was rolled back as a whole, and no half document was left. **Retry as-is**: this request itself is valid, " +
        "it only collided with another write in progress. " +
        "Only if retries keep conflicting is it a server problem, not the content you sent",
      code,
      error,
    );
  }
}
