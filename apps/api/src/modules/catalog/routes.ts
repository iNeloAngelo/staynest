import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  catalogQuerySchema,
  citySuggestionsQuerySchema,
  type CatalogQuery,
  type CitySuggestionsQuery,
} from '@staynest/shared';
import { z } from 'zod';
import type { Db } from '../../platform/db/index';
import { parseInput } from '../../platform/http/validate';
import type { MediaStorage } from '../../platform/storage/index';
import { catalogListingNotFound } from './errors';
import { createCatalogService } from './service';

type CatalogRoutesOptions = {
  db: Db;
  storage: MediaStorage;
};

function publicCache(reply: FastifyReply, maxAge: number): void {
  reply.header('cache-control', `public, max-age=${maxAge}, stale-while-revalidate=60`);
}

export const catalogRoutes: FastifyPluginAsync<CatalogRoutesOptions> = async (app, options) => {
  const service = createCatalogService({ db: options.db, storage: options.storage });

  app.get('/listings', async (request, reply) => {
    const query = parseInput<CatalogQuery>(catalogQuerySchema, request.query);
    publicCache(reply, 30);
    return reply.send(await service.list(query));
  });

  app.get('/listings/:id', async (request, reply) => {
    const id = (request.params as { id?: unknown }).id;
    // Битая ссылка — это не ошибка валидации, а несуществующий дом.
    if (typeof id !== 'string' || !z.uuid().safeParse(id).success) {
      throw catalogListingNotFound();
    }

    publicCache(reply, 60);
    return reply.send({ listing: await service.detail(id) });
  });

  app.get('/cities', async (request, reply) => {
    const query = parseInput<CitySuggestionsQuery>(citySuggestionsQuerySchema, request.query);
    publicCache(reply, 300);
    return reply.send({ cities: await service.cities(query) });
  });
};
