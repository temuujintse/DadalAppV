import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Paginated } from '../dto/paginated';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Wraps every successful response as `{ success: true, data, meta? }`. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope<unknown>> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof Paginated) {
          return { success: true as const, data: value.items, meta: { ...value.meta } };
        }
        return { success: true as const, data: value ?? null };
      }),
    );
  }
}
