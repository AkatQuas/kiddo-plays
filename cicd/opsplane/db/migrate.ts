/**
 * Placeholder migrator. The default runtime uses an in-memory store.
 * When DATABASE_URL is set in a future Postgres-backed build, place SQL under db/migrations/.
 */
console.log('opsplane: no Postgres migrations in the memory-store build. Set DATABASE_URL when enabling pg store.');
process.exit(0);
