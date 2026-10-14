import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export interface IssuedAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  for (const entry of cookieHeader?.split(';') ?? []) {
    const separator = entry.indexOf('=');
    if (separator >= 0 && entry.slice(0, separator).trim() === name) {
      return entry.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function setAuthCookies(
  response: Response,
  tokens: IssuedAuthTokens,
  config: ConfigService,
) {
  const cookieOptions = getCookieOptions(config);
  const accessTtl = config.get<string>('JWT_ACCESS_TTL') ?? '15m';
  const refreshTtl = config.get<string>('JWT_REFRESH_TTL') ?? '7d';
  const accessMaxAge = durationMilliseconds(accessTtl);
  const refreshMaxAge = durationMilliseconds(refreshTtl);

  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    ...(accessMaxAge === undefined ? {} : { maxAge: accessMaxAge }),
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    ...(refreshMaxAge === undefined ? {} : { maxAge: refreshMaxAge }),
  });
}

export function clearAuthCookies(response: Response, config: ConfigService) {
  const cookieOptions = getCookieOptions(config);
  response.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);
  response.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);
}

function getCookieOptions(config: ConfigService) {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/',
  };
  return cookieOptions;
}

function durationMilliseconds(value: string): number | undefined {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unitMilliseconds: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * unitMilliseconds[match[2]];
}
