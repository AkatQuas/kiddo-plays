import { Module } from '@nestjs/common';
import { MigrationController, SchemaController } from './migration.controller';
import { MigrationService } from './migration.service';
import { QueryModule } from '../query/query.module';

@Module({
  imports: [QueryModule],
  controllers: [MigrationController, SchemaController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
