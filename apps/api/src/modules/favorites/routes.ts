import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { FavoritesQuery } from '@staynest/shared';
import { favoriteListingParamsSchema, favoritesQuerySchema } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import type { MediaStorage } from '../../platform/storage/index';
import { createAuthGuard } from '../auth/index';
import { createFavoritesService } from './service';

type FavoritesRoutesOptions = {
  config: AppConfig;
  db: Db;
  storage: MediaStorage;
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

export const favoritesRoutes: FastifyPluginAsync<FavoritesRoutesOptions> = async (app, options) => {
  const service = createFavoritesService({ db: options.db, storage: options.storage });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  app.get('/me/favorites', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const query = parseInput<FavoritesQuery>(favoritesQuerySchema, request.query);
    return reply.send(await service.list(actorOf(request).userId, query));
  });

  app.get('/me/favorites/ids', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    return reply.send({ listingIds: await service.ids(actorOf(request).userId) });
  });

  app.put('/me/favorites/:listingId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { listingId } = parseInput(favoriteListingParamsSchema, request.params);
    await service.add(actorOf(request).userId, listingId);
    return reply.send({ listingId, favorite: true });
  });

  app.delete('/me/favorites/:listingId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { listingId } = parseInput(favoriteListingParamsSchema, request.params);
    await service.remove(actorOf(request).userId, listingId);
    return reply.send({ listingId, favorite: false });
  });
};
