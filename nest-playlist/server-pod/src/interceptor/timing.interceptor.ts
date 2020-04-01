import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    /**
     * the ExecutionContext is different when the request is graphql
     * as the document said https://docs.nestjs.com/fundamentals/execution-context#argumentshost-class
     */
    const type = context.getType();
    if (type === 'http') {
      const request = context.switchToHttp().getRequest() as Request;
      const { path, method } = request;
      const now = Date.now();

      return next
        .handle()
        .pipe(
          tap(() => Logger.log(
            `${method} ${path} using ${Date.now() - now} ms`,
          ))
        );
    }

    // if (type === 'graphql') {}

    return next.handle();
  }
}
