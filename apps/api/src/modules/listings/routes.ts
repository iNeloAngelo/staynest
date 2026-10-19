import type {
  CreateListingInput,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import {
  createListingInputSchema,
  updateListingAmenitiesInputSchema,
  updateListingInputSchema,
} from '@staynest/shared';
import { z } from 'zod';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import { createListingService } from './service';
import type { ListingService } from './service';

type ListingsRoutesOptions = {
  config: AppConfig;
  db: Db;
  events: EventBus;
};

const listingParamsSchema = z.object({ id: z.uuid() }).strict();

type ListingParams = z.infer<typeof listingParamsSchema>;

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

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

function paramsOf(request: FastifyRequest): ListingParams {
  return parseInput(listingParamsSchema, request.params);
}

function registerAmenityRoutes(app: FastifyInstance, service: ListingService, guard: Guard) {
  app.get('/amenities', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    const amenities = await service.amenities();
    return reply.send({ amenities });
  });

  app.put('/listings/:id/amenities', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = paramsOf(request);
    const input = parseInput<UpdateListingAmenitiesInput>(
      updateListingAmenitiesInputSchema,
      request.body,
    );
    const listing = await service.replaceAmenities(actorOf(request).userId, id, input);
    return reply.send({ listing });
  });
}

function registerListingRoutes(app: FastifyInstance, service: ListingService, guard: Guard) {
  app.get('/me/listings', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const listings = await service.listMine(actorOf(request).userId);
    return reply.send({ listings });
  });

  app.post('/listings', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<CreateListingInput>(createListingInputSchema, request.body ?? {});
    const listing = await service.createDraft(actorOf(request).userId, input);
    return reply.status(201).send({ listing });
  });

  app.patch('/listings/:id', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = paramsOf(request);
    const input = parseInput<UpdateListingInput>(updateListingInputSchema, request.body);
    const listing = await service.update(actorOf(request).userId, id, input);
    return reply.send({ listing });
  });

  app.delete('/listings/:id', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = paramsOf(request);
    await service.remove(actorOf(request).userId, id);
    return reply.status(204).send();
  });
}

function registerStatusRoutes(app: FastifyInstance, service: ListingService, guard: Guard) {
  app.post('/listings/:id/publish', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = paramsOf(request);
    const listing = await service.publish(actorOf(request), id);
    return reply.send({ listing });
  });

  app.post('/listings/:id/archive', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = paramsOf(request);
    const listing = await service.archive(actorOf(request).userId, id);
    return reply.send({ listing });
  });
}

type Guard = ReturnType<typeof createAuthGuard>;

export const listingsRoutes: FastifyPluginAsync<ListingsRoutesOptions> = async (app, options) => {
  const service = createListingService({
    db: options.db,
    config: options.config,
    events: options.events,
  });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  registerAmenityRoutes(app, service, guard);
  registerListingRoutes(app, service, guard);
  registerStatusRoutes(app, service, guard);
};
