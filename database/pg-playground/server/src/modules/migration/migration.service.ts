import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SqlSafetyService } from '../query/sql-safety.service';
import { MigrationDemoInitService } from './migration-demo-init.service';

export interface MigrationRecord {
  version: string;
  name: string;
  executed_at: string;
  status: string;
  operator: string;
}

@Injectable()
export class MigrationService {
  private readonly schema = 'migration_demo';

  constructor(
    private readonly db: DatabaseService,
    private readonly sqlSafety: SqlSafetyService,
    private readonly migrationDemoInit: MigrationDemoInitService,
  ) {}

  async getHistory(): Promise<MigrationRecord[]> {
    await this.migrationDemoInit.ensureDemoSchema();
    const pool = this.db.getPool();
    const result = await pool.query(
      `SELECT version, name, executed_at, status, operator
       FROM migration_demo.schema_migrations
       ORDER BY executed_at DESC`,
    );
    return result.rows as MigrationRecord[];
  }

  async runUp(version: string, name: string, sql: string): Promise<MigrationRecord> {
    await this.migrationDemoInit.ensureDemoSchema();

    const validation = this.sqlSafety.validate(sql, { allowDdl: true });
    if (!validation.valid) throw new Error(validation.error);
    if (validation.isDml) throw new Error('Migration up scripts must be DDL only');

    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${this.schema}, public`);
      await client.query('SAVEPOINT migration_up');
      await client.query(sql);
      const insert = await client.query(
        `INSERT INTO schema_migrations (version, name, status, operator)
         VALUES ($1, $2, 'success', 'local_user')
         RETURNING version, name, executed_at, status, operator`,
        [version, name],
      );
      await client.query('COMMIT');
      return insert.rows[0] as MigrationRecord;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async runDown(version: string, sql: string): Promise<void> {
    await this.migrationDemoInit.ensureDemoSchema();

    const validation = this.sqlSafety.validate(sql, { allowDdl: true });
    if (!validation.valid) throw new Error(validation.error);
    if (validation.isDml) throw new Error('Migration down scripts must be DDL only');

    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${this.schema}, public`);
      await client.query('SAVEPOINT migration_down');
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getSchemaStatus(): Promise<{ tables: string[]; migrationCount: number }> {
    await this.migrationDemoInit.ensureDemoSchema();
    const pool = this.db.getPool();
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this.schema],
    );
    const count = await pool.query(
      'SELECT COUNT(*)::int AS count FROM migration_demo.schema_migrations',
    );
    return {
      tables: tables.rows.map((r: { table_name: string }) => r.table_name),
      migrationCount: count.rows[0]?.count ?? 0,
    };
  }
}
