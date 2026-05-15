import * as SQLite from 'expo-sqlite';
import * as v1 from './migrations/v1-initial';

const DB_NAME = 'shop_local.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await runMigrations(db);
  }
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase) {
  // Ensure db_version table exists
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS db_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT (datetime('now','localtime'))
    );
  `);

  const row = await database.getFirstAsync<{ version: number }>(
    'SELECT COALESCE(MAX(version), 0) as version FROM db_version'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await database.execAsync('BEGIN TRANSACTION');
    try {
      await v1.up(database);
      await database.execAsync('COMMIT');
    } catch (e) {
      await database.execAsync('ROLLBACK');
      console.error('Migration V1 failed, attempting rollback...', e);
      await v1.down(database);
      throw e;
    }
  }
}