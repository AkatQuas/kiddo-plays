import {
  Injectable,
  Logger,
  OnModuleDestroy
} from '@nestjs/common';
import { DbService } from './db.service';

@Injectable()
export class BizService implements OnModuleDestroy {
  private readonly logger = new Logger(BizService.name); // 自动填充上下文
  constructor(private readonly db: DbService) {}

  runTask() {
    this.db.connect();
    this.logger.log('execute biz task');
  }

  onModuleDestroy() {
    this.db.disconnect();
  }
}
