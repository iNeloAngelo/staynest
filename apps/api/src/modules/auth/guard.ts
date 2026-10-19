import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { createSessionManager } from './session';
import { ACCESS_COOKIE } from './tokens';

export type AuthGuardDependencies = {
  db: Db;
  config: AppConfig;
};

/**
 * Публичный preHandler авторизации для других модулей.
 * Проверяет access-токен и активную family, кладёт `request.auth`.
 */
export function createAuthGuard({ db, config }: AuthGuardDependencies) {
  const sessions = createSessionManager({ db, config });

  return async (request: FastifyRequest): Promise<void> => {
    request.auth = await sessions.authenticate(request.cookies[ACCESS_COOKIE]);
  };
}
