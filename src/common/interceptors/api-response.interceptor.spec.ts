import { describe, expect, it } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  const interceptor = new ApiResponseInterceptor();
  const context = {} as ExecutionContext;

  it('wraps a single-resource response in data', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ id: 'match-id' }),
      } as CallHandler),
    );

    expect(result).toEqual({ data: { id: 'match-id' } });
  });

  it('preserves the data and metadata shape for paginated responses', async () => {
    const response = {
      data: [{ id: 'match-id' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    const result = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of(response),
      } as CallHandler),
    );

    expect(result).toEqual(response);
  });
});
