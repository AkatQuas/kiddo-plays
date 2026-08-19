import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigrationDemoInitService } from '../migration/migration-demo-init.service';

@Global()
@Module({
  providers: [DatabaseService, MigrationDemoInitService],
  exports: [DatabaseService, MigrationDemoInitService],
})
export class DatabaseModule {}
