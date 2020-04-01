import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';

@Injectable()
export class EmailTasksService {
  private readonly logger = new Logger(EmailTasksService.name);

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  handleEmail() {
    this.logger.log('Sending email to users!');
  }

  @Interval(150000)
  handleBunous() {
    this.logger.log('Broadcasting bonus to users!');
  }
}
