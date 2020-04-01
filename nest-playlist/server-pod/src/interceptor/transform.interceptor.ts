import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Response<T> {
  data: T,
  [key: string]: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {

    const type = context.getType();
    if (type === 'http') {
      return next.handle().pipe(
        tap(() => Logger.log('data is got, let\'s transform it!')),
        map(data => ({
          data,
          meta: {
            extra: 'extra info from transform interceptor',
          },
        }))
      );
    }

    return next.handle();
  }
}
