import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../../platform/config/index';
import type { IssuedTokens } from './session';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  accessCookieOptions,
  refreshCookieOptions,
} from './tokens';

export function setSessionCookies(
  reply: FastifyReply,
  tokens: IssuedTokens,
  config: AppConfig,
): void {
  const secure = config.nodeEnv === 'production';
  const refreshMaxAge = config.auth.refreshTokenTtlDays * 24 * 60 * 60;

  reply.setCookie(
    ACCESS_COOKIE,
    tokens.accessToken,
    accessCookieOptions(secure, config.auth.accessTokenTtlSeconds),
  );
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(secure, refreshMaxAge));
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}
