import { Body, Controller, Get, Post } from '@nestjs/common';
import { MigrationService } from './migration.service';

class MigrationUpDto {
  version!: string;
  name!: string;
  sql!: string;
}

class MigrationDownDto {
  version!: string;
  sql!: string;
}

@Controller('api/migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Get('history')
  async history() {
    const data = await this.migrationService.getHistory();
    return { data, message: 'OK', error: null };
  }

  @Post('up')
  async up(@Body() body: MigrationUpDto) {
    try {
      const data = await this.migrationService.runUp(body.version, body.name, body.sql);
      return { data, message: 'Migration applied', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Migration failed';
      return { data: null, message, error: { code: 'MIGRATION_UP_ERROR', detail: message } };
    }
  }

  @Post('down')
  async down(@Body() body: MigrationDownDto) {
    try {
      await this.migrationService.runDown(body.version, body.sql);
      return { data: { version: body.version }, message: 'Migration rolled back', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed';
      return { data: null, message, error: { code: 'MIGRATION_DOWN_ERROR', detail: message } };
    }
  }
}

@Controller('api/schema')
export class SchemaController {
  constructor(private readonly migrationService: MigrationService) {}

  @Get('status')
  async status() {
    const data = await this.migrationService.getSchemaStatus();
    return { data, message: 'OK', error: null };
  }
}
