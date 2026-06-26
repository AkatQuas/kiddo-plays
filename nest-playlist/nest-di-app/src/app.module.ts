import { Module } from '@nestjs/common';
import { CommandRunnerModule } from 'nest-commander';
import { BizService } from './biz.service';
import { DbService } from './db.service';
import { TestCommand } from './demo.command';
import { DemoService } from './demo.service';

@Module({
  imports: [CommandRunnerModule],
  providers: [DbService, BizService, DemoService, TestCommand]
})
export class AppModule {}
