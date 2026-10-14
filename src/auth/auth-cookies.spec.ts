import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth-cookies';

describe('auth cookies', () => {
  it('allows production auth cookies on cross-site requests', () => {
    const cookie = vi.fn();
    const clearCookie = vi.fn();
    const response = {
      cookie,
      clearCookie,
    } as unknown as Response;
    const config = {
      get: (key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
    } as ConfigService;

    setAuthCookies(
      response,
      { accessToken: 'access', refreshToken: 'refresh' },
      config,
    );
    clearAuthCookies(response, config);

    expect(cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none' }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none' }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });

  it('keeps development auth cookies lax and non-secure', () => {
    const cookie = vi.fn();
    const response = {
      cookie,
    } as unknown as Response;
    const config = {
      get: () => undefined,
    } as ConfigService;

    setAuthCookies(
      response,
      { accessToken: 'access', refreshToken: 'refresh' },
      config,
    );

    expect(cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access',
      expect.objectContaining({ secure: false, sameSite: 'lax' }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh',
      expect.objectContaining({ secure: false, sameSite: 'lax' }),
    );
  });
});
