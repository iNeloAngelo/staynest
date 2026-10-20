import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { DashboardQuery } from '@staynest/shared';
import { dashboardQuerySchema } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import { createDashboardService } from './service';

type DashboardRoutesOptions = {
  config: AppConfig;
  db: Db;
};

function actorOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new AppError({
      status: 401,
      code: 'unauthorized',
      title: 'Unauthorized',
      detail: 'Требуется авторизация.',
    });
  }

  return request.auth;
}

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

export const dashboardRoutes: FastifyPluginAsync<DashboardRoutesOptions> = async (app, options) => {
  const service = createDashboardService({ db: options.db, config: options.config });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  app.get('/me/dashboard', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const query = parseInput<DashboardQuery>(dashboardQuerySchema, request.query);
    return reply.send(await service.summary(actorOf(request).userId, query));
  });
};
