import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { BlockInput, CalendarQuery } from '@staynest/shared';
import { blockInputSchema, calendarQuerySchema } from '@staynest/shared';
import { z } from 'zod';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import { createAvailabilityService } from './service';

type AvailabilityRoutesOptions = {
  config: AppConfig;
  db: Db;
};

const listingParamsSchema = z.object({ id: z.uuid() }).strict();
const blockParamsSchema = z.object({ id: z.uuid(), blockId: z.uuid() }).strict();

type Guard = ReturnType<typeof createAuthGuard>;

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

function registerPublicCalendar(
  app: FastifyInstance,
  service: ReturnType<typeof createAvailabilityService>,
) {
  app.get('/listings/:id/calendar', async (request, reply) => {
    const { id } = parseInput(listingParamsSchema, request.params);
    const query = parseInput<CalendarQuery>(calendarQuerySchema, request.query);
    reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=60');
    return reply.send(await service.publicCalendar(id, query));
  });
}

function registerHostCalendar(
  app: FastifyInstance,
  service: ReturnType<typeof createAvailabilityService>,
  guard: Guard,
) {
  app.get('/listings/:id/calendar/host', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    const query = parseInput<CalendarQuery>(calendarQuerySchema, request.query);
    const calendar = await service.hostCalendar(actorOf(request).userId, id, query);
    return reply.send(calendar);
  });
}

function registerBlockRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createAvailabilityService>,
  guard: Guard,
) {
  app.get('/listings/:id/blocks', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    return reply.send({ blocks: await service.blocks(actorOf(request).userId, id) });
  });

  app.post('/listings/:id/blocks', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    const input = parseInput<BlockInput>(blockInputSchema, request.body);
    const block = await service.createBlock(actorOf(request).userId, id, input);
    return reply.status(201).send({ block });
  });

  app.delete('/listings/:id/blocks/:blockId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id, blockId } = parseInput(blockParamsSchema, request.params);
    await service.removeBlock(actorOf(request).userId, id, blockId);
    return reply.status(204).send();
  });
}

export const availabilityRoutes: FastifyPluginAsync<AvailabilityRoutesOptions> = async (
  app,
  options,
) => {
  const service = createAvailabilityService({ db: options.db, config: options.config });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  registerPublicCalendar(app, service);
  registerHostCalendar(app, service, guard);
  registerBlockRoutes(app, service, guard);
};
