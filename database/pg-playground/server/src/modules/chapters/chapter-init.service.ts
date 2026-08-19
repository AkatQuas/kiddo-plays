import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ChaptersService } from './chapters.service';
import { MigrationDemoInitService } from '../migration/migration-demo-init.service';

@Injectable()
export class ChapterInitService {
  private readonly logger = new Logger(ChapterInitService.name);
  private initialized = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly chaptersService: ChaptersService,
    private readonly migrationDemoInit: MigrationDemoInitService,
  ) {}

  async ensureChapterInitialized(sessionId: string, chapterId: string): Promise<void> {
    const key = `${sessionId}:${chapterId}`;
    if (this.initialized.has(key)) return;

    const chapter = this.chaptersService.getChapterById(chapterId);
    const session = await this.db.getOrCreateSession(sessionId, chapterId);
    const isMigrationChapter = chapter?.features?.migration === true;

    if (isMigrationChapter) {
      await this.migrationDemoInit.ensureDemoSchema();
      await session.client.query('SET search_path TO migration_demo, public');
      session.schema = 'migration_demo';
      this.logger.log(`Using migration_demo schema for chapter ${chapterId}`);
    } else {
      const initSql = this.chaptersService.getInitSql(chapterId);
      if (initSql?.trim()) {
        try {
          await session.client.query(initSql);
          this.logger.log(`Initialized chapter schema: ${session.schema}`);
        } catch (err) {
          this.logger.error(`Failed to init chapter ${chapterId}`, err);
          throw err;
        }
      }
    }

    await session.client.query('BEGIN');
    await session.client.query(`SAVEPOINT ${session.savepointName}`);
    session.inTransaction = true;
    this.initialized.add(key);
  }

  async resetChapter(sessionId: string): Promise<void> {
    const session = this.db.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await session.client.query(`ROLLBACK TO SAVEPOINT ${session.savepointName}`);
    await session.client.query(`RELEASE SAVEPOINT ${session.savepointName}`);
    await session.client.query(`SAVEPOINT ${session.savepointName}`);
  }
}
