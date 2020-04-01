import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadGatewayException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorHunterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // todo error downgrade
      catchError(err => throwError(new BadGatewayException('what error you got'))),
    );
  }

}
