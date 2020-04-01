import { Module } from '@nestjs/common';
import { EmailTasksService } from './email-tasks.service';

@Module({
  providers: [
    EmailTasksService,
  ]
})
export class TasksModule { }
