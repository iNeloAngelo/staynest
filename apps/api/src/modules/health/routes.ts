import type { HealthResponse } from '@staynest/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../../platform/db/index';

export type HealthRoutesOptions = {
  db: Pick<Db, 'check'>;
};

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get('/health', async (_request, reply) => {
    const dbStatus = await options.db.check();

    const body: HealthResponse = {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      db: dbStatus,
      version: process.env['npm_package_version'] ?? '0.1.0',
      uptime: Math.round(process.uptime()),
    };

    return reply
      .header('cache-control', 'no-store')
      .status(dbStatus === 'up' ? 200 : 503)
      .send(body);
  });
};
