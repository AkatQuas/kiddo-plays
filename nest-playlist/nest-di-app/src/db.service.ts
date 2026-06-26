import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DbService {
  private readonly logger = new Logger(DbService.name); // 自动填充上下文
  constructor() {}
  connect() {
    this.logger.log('db connected');
  }
  disconnect() {
    this.logger.log('db disconnect');
  }
}
