import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type {
  BookingListQuery,
  CancelBookingInput,
  CreateBookingInput,
  DeclineBookingInput,
} from '@staynest/shared';
import {
  BOOKING_IDEMPOTENCY_KEY_MAX,
  bookingListQuerySchema,
  cancelBookingInputSchema,
  createBookingInputSchema,
  declineBookingInputSchema,
} from '@staynest/shared';
import { z } from 'zod';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import type { BookingOptions } from './context';
import { idempotencyKeyRequired, invalidIdempotencyKey } from './errors';
import { createBookingService } from './service';
import type { BookingService } from './service';

const bookingParamsSchema = z.object({ id: z.uuid() }).strict();
const KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

type BookingRoutesOptions = {
  config: AppConfig;
  db: Db;
  events: EventBus;
  booking?: BookingOptions;
};

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

function idempotencyKeyOf(request: FastifyRequest): string {
  const raw = request.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.trim() === '') throw idempotencyKeyRequired();

  const key = value.trim();
  if (key.length < 8 || key.length > BOOKING_IDEMPOTENCY_KEY_MAX || !KEY_PATTERN.test(key)) {
    throw invalidIdempotencyKey();
  }

  return key;
}

function registerCreateRoute(app: FastifyInstance, service: BookingService, guard: Guard): void {
  app.post('/bookings', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const key = idempotencyKeyOf(request);
    const input = parseInput<CreateBookingInput>(createBookingInputSchema, request.body);
    const result = await service.create(actorOf(request).userId, input, key);

    if (result.replayed) reply.header('idempotency-replayed', 'true');
    return reply.status(result.status).send(result.body);
  });
}

function registerReadRoutes(app: FastifyInstance, service: BookingService, guard: Guard): void {
  app.get('/me/bookings', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const query = parseInput<BookingListQuery>(bookingListQuerySchema, request.query);
    return reply.send(await service.list(actorOf(request).userId, query));
  });

  app.get('/bookings/:id', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(bookingParamsSchema, request.params);
    return reply.send({ booking: await service.get(actorOf(request).userId, id) });
  });
}

function registerActionRoutes(app: FastifyInstance, service: BookingService, guard: Guard): void {
  app.post('/bookings/:id/confirm', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(bookingParamsSchema, request.params);
    return reply.send(await service.confirm(actorOf(request).userId, id));
  });

  app.post('/bookings/:id/decline', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(bookingParamsSchema, request.params);
    const input = parseInput<DeclineBookingInput>(declineBookingInputSchema, request.body ?? {});
    return reply.send(await service.decline(actorOf(request).userId, id, input));
  });

  app.post('/bookings/:id/cancel', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(bookingParamsSchema, request.params);
    const input = parseInput<CancelBookingInput>(cancelBookingInputSchema, request.body ?? {});
    return reply.send(await service.cancel(actorOf(request).userId, id, input));
  });
}

export const bookingsRoutes: FastifyPluginAsync<BookingRoutesOptions> = async (app, options) => {
  const service = createBookingService({
    db: options.db,
    config: options.config,
    events: options.events,
    options: options.booking,
  });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  registerCreateRoute(app, service, guard);
  registerReadRoutes(app, service, guard);
  registerActionRoutes(app, service, guard);
};
