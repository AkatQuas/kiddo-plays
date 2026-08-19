import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { SqlSafetyService } from './sql-safety.service';
import { ChaptersModule } from '../chapters/chapters.module';

@Module({
  imports: [ChaptersModule],
  controllers: [QueryController],
  providers: [QueryService, SqlSafetyService],
  exports: [QueryService, SqlSafetyService],
})
export class QueryModule {}
