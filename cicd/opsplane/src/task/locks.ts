import { HttpError } from '../errors.js';

export type LockManager = {
  withTaskLock<T>(taskId: string, work: () => Promise<T>): Promise<T>;
  withTargetLock<T>(key: string, work: () => Promise<T>): Promise<T>;
};

/** Process-local exclusive locks. Safe with replicas=1; multi-replica needs Postgres advisory locks. */
export function createMemoryLockManager(): LockManager {
  const held = new Set<string>();

  async function withKey<T>(
    key: string,
    busyMessage: string,
    busyCode: string,
    work: () => Promise<T>,
  ): Promise<T> {
    if (held.has(key)) throw new HttpError(409, busyMessage, busyCode);
    held.add(key);
    try {
      return await work();
    } finally {
      held.delete(key);
    }
  }

  return {
    withTaskLock(taskId, work) {
      return withKey(`task:${taskId}`, 'task is busy', 'task_busy', work);
    },
    withTargetLock(key, work) {
      return withKey(`target:${key}`, 'target is busy', 'target_busy', work);
    },
  };
}

export type PgLockClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
  connect: () => Promise<{
    query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ locked?: boolean }> }>;
    release: (err?: Error) => void;
  }>;
};

/** Cross-process locks via Postgres advisory locks. */
export function createPgLockManager(pool: PgLockClient): LockManager {
  async function withAdvisory<T>(
    key: string,
    busyMessage: string,
    busyCode: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      const lock = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [key]);
      if (!lock.rows[0]?.locked) throw new HttpError(409, busyMessage, busyCode);
      try {
        return await work();
      } finally {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]).catch(() => undefined);
      }
    } finally {
      client.release();
    }
  }

  return {
    withTaskLock(taskId, work) {
      return withAdvisory(`opsplane:task:${taskId}`, 'task is busy', 'task_busy', work);
    },
    withTargetLock(key, work) {
      return withAdvisory(`opsplane:target:${key}`, 'target is busy', 'target_busy', work);
    },
  };
}
