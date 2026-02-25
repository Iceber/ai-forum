import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface EnvelopeResponse<T> {
  data: T | null;
  meta: Record<string, unknown> | null;
  error: null;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, EnvelopeResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<EnvelopeResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        // If the handler already returns an envelope (has data/meta/error keys), pass through
        if (
          value &&
          typeof value === 'object' &&
          'data' in value &&
          'error' in value
        ) {
          return value;
        }
        return {
          data: value ?? null,
          meta: null,
          error: null,
        };
      }),
    );
  }
}
