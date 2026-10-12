import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface PaginatedResponse {
  data: unknown[];
  meta: Record<string, unknown>;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor<
  unknown,
  { data: unknown }
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ data: unknown }> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (this.isPaginatedResponse(result)) {
          return result;
        }
        return { data: result ?? null };
      }),
    );
  }

  private isPaginatedResponse(value: unknown): value is PaginatedResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      Array.isArray(value.data) &&
      'meta' in value &&
      typeof value.meta === 'object' &&
      value.meta !== null
    );
  }
}
