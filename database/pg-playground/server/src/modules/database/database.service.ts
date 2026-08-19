import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { ConfigService } from '../../config/config.service';

export interface SessionState {
  client: PoolClient;
  chapterId: string;
  schema: string;
  inTransaction: boolean;
  savepointName: string;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;
  private sessions: Map<string, SessionState> = new Map();

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get().db;
    this.pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      max: cfg.maxConnections,
      idleTimeoutMillis: cfg.idleTimeoutMs,
      connectionTimeoutMillis: cfg.connectionTimeoutMs,
    });
  }

  async onModuleDestroy() {
    for (const session of this.sessions.values()) {
      try {
        await session.client.query('ROLLBACK');
        session.client.release();
      } catch {
        session.client.release(true);
      }
    }
    this.sessions.clear();
    await this.pool.end();
  }

  async getOrCreateSession(sessionId: string, chapterId: string): Promise<SessionState> {
    const existing = this.sessions.get(sessionId);
    if (existing && existing.chapterId === chapterId) {
      return existing;
    }

    if (existing) {
      await this.releaseSession(sessionId);
    }

    const client = await this.pool.connect();
    const schema = `chapter_${chapterId.replace(/[^a-z0-9_]/gi, '_')}`;
    const savepointName = 'chapter_start';

    await client.query(`SET statement_timeout = ${this.configService.get().sqlTimeoutMs}`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);

  const session: SessionState = {
      client,
      chapterId,
      schema,
      inTransaction: false,
      savepointName,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async releaseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    try {
      await session.client.query('ROLLBACK');
    } catch {
      // ignore
    }
    session.client.release();
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  async query(sessionId: string, sql: string, params?: unknown[]): Promise<QueryResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session.client.query(sql, params);
  }

  async runInSchema(schema: string, fn: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schema}, public`);
      await fn(client);
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}
