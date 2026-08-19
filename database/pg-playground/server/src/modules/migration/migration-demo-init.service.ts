import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MigrationDemoInitService {
  private initialized = false;

  constructor(private readonly db: DatabaseService) {}

  async ensureDemoSchema(): Promise<void> {
    if (this.initialized) return;

    const initPath = path.join(process.cwd(), 'data', 'migration_demo', 'init.sql');
    if (!fs.existsSync(initPath)) return;

    const sql = fs.readFileSync(initPath, 'utf-8');
    const client = await this.db.getPool().connect();
    try {
      await client.query(sql);
      this.initialized = true;
    } finally {
      client.release();
    }
  }
}
