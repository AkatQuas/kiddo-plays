import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { DatabaseService } from '../database/database.service';
import { ChapterInitService } from '../chapters/chapter-init.service';
import { SqlSafetyService } from './sql-safety.service';

export interface QueryMessage {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'NOTICE';
  message: string;
  timestamp: string;
}

export interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  messages: QueryMessage[];
  explain?: unknown;
  transactionStatus: 'none' | 'active' | 'committed' | 'rolled_back';
  sql: string;
}

@Injectable()
export class QueryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly sqlSafety: SqlSafetyService,
    private readonly chapterInit: ChapterInitService,
  ) {}

  async execute(
    sessionId: string,
    chapterId: string,
    sql: string,
    options?: {
      explain?: boolean;
      clozeValues?: Record<string, string>;
    },
  ): Promise<QueryResultData> {
    await this.chapterInit.ensureChapterInitialized(sessionId, chapterId);
    const session = this.db.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    let finalSql = sql;
    if (options?.clozeValues) {
      finalSql = this.sqlSafety.substituteCloze(sql, options.clozeValues);
    }

    const validation = this.sqlSafety.validate(finalSql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const start = Date.now();
    const messages: QueryMessage[] = [];
    let explain: unknown = undefined;

    if (validation.isDml && !session.inTransaction) {
      await session.client.query('BEGIN');
      await session.client.query(`SAVEPOINT ${session.savepointName}`);
      session.inTransaction = true;
    }

    if (options?.explain) {
      const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${finalSql}`;
      const explainResult = await session.client.query(explainSql);
      explain = explainResult.rows[0]?.['QUERY PLAN'] ?? explainResult.rows[0];
    }

    const result = await session.client.query(finalSql);
    const executionTimeMs = Date.now() - start;

    const rows = result.rows.slice(0, this.config.get().maxRows).map((row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = v;
      }
      return out;
    });

    if (!validation.isDml) {
      messages.push({
        level: 'INFO',
        message: `Query returned ${result.rowCount ?? rows.length} rows in ${executionTimeMs}ms`,
        timestamp: new Date().toISOString(),
      });
    } else {
      messages.push({
        level: 'INFO',
        message: `DML affected ${result.rowCount ?? 0} rows. Transaction is open — commit or rollback.`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      columns: result.fields?.map((f: { name: string }) => f.name) ?? [],
      rows,
      rowCount: result.rowCount ?? rows.length,
      executionTimeMs,
      messages,
      explain,
      transactionStatus: session.inTransaction ? 'active' : 'none',
      sql: finalSql,
    };
  }

  async explainOnly(sessionId: string, chapterId: string, sql: string): Promise<unknown> {
    await this.chapterInit.ensureChapterInitialized(sessionId, chapterId);
    const session = this.db.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const validation = this.sqlSafety.validate(sql);
    if (!validation.valid) throw new Error(validation.error);

    const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
    const result = await session.client.query(explainSql);
    return result.rows[0]?.['QUERY PLAN'] ?? result.rows[0];
  }

  async commit(sessionId: string): Promise<void> {
    const session = this.db.getSession(sessionId);
    if (!session || !session.inTransaction) throw new Error('No active transaction');

    await session.client.query('COMMIT');
    await session.client.query('BEGIN');
    await session.client.query(`SAVEPOINT ${session.savepointName}`);
    session.inTransaction = true;
  }

  async rollback(sessionId: string): Promise<void> {
    const session = this.db.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await session.client.query(`ROLLBACK TO SAVEPOINT ${session.savepointName}`);
    await session.client.query(`RELEASE SAVEPOINT ${session.savepointName}`);
    await session.client.query(`SAVEPOINT ${session.savepointName}`);
  }

  async reset(sessionId: string): Promise<void> {
    await this.chapterInit.resetChapter(sessionId);
  }
}
