import { Logger, LoggerService } from '@nestjs/common';

export class MyLogger implements LoggerService {
  log(message: any, context?: string) {
    console.log(
      `[INFO] ${new Date().toISOString()} [${context || 'App'}]`,
      message
    );
  }
  error(message: any, trace?: string, context?: string) {
    console.error(
      `[ERROR] ${new Date().toISOString()} [${context || 'App'}]`,
      message,
      trace
    );
  }
  warn(message: any, context?: string) {
    console.warn(
      `[WARN] ${new Date().toISOString()} [${context || 'App'}]`,
      message
    );
  }
  debug(message: any, context?: string) {
    console.debug(
      `[DEBUG] ${new Date().toISOString()} [${context || 'App'}]`,
      message
    );
  }
  verbose(message: any, context?: string) {
    console.log(
      `[VERBOSE] ${new Date().toISOString()} [${context || 'App'}]`,
      message
    );
  }
}

export class MyExtendedLogger extends Logger {
  error(message: string, trace: string) {
    // add your tailored logic here
    super.error(message, trace);
  }
}
