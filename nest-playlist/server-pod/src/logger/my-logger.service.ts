import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyLogger extends Logger {
  info(message: any, context?: string): void {
    super.log(message, context);
  }
}
