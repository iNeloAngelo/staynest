import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { PriceRuleInput, PriceRulePatch, QuoteQuery } from '@staynest/shared';
import { priceRuleInputSchema, priceRulePatchSchema, quoteQuerySchema } from '@staynest/shared';
import { z } from 'zod';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import { createAuthGuard } from '../auth/index';
import { createPricingService } from './service';

type PricingRoutesOptions = {
  config: AppConfig;
  db: Db;
};

const listingParamsSchema = z.object({ id: z.uuid() }).strict();
const ruleParamsSchema = z.object({ id: z.uuid(), ruleId: z.uuid() }).strict();

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

function registerQuoteRoute(
  app: FastifyInstance,
  service: ReturnType<typeof createPricingService>,
) {
  app.get('/listings/:id/quote', async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    const query = parseInput<QuoteQuery>(quoteQuerySchema, request.query);
    return reply.send({ quote: await service.quote(id, query) });
  });
}

function registerRuleRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createPricingService>,
  guard: Guard,
) {
  app.get('/listings/:id/price-rules', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    return reply.send({ priceRules: await service.listRules(actorOf(request).userId, id) });
  });

  app.post('/listings/:id/price-rules', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    const input = parseInput<PriceRuleInput>(priceRuleInputSchema, request.body);
    const priceRule = await service.createRule(actorOf(request).userId, id, input);
    return reply.status(201).send({ priceRule });
  });

  app.patch('/listings/:id/price-rules/:ruleId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id, ruleId } = parseInput(ruleParamsSchema, request.params);
    const input = parseInput<PriceRulePatch>(priceRulePatchSchema, request.body);
    const priceRule = await service.updateRule(actorOf(request).userId, id, ruleId, input);
    return reply.send({ priceRule });
  });

  app.delete('/listings/:id/price-rules/:ruleId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id, ruleId } = parseInput(ruleParamsSchema, request.params);
    await service.removeRule(actorOf(request).userId, id, ruleId);
    return reply.status(204).send();
  });
}

export const pricingRoutes: FastifyPluginAsync<PricingRoutesOptions> = async (app, options) => {
  const service = createPricingService({ db: options.db, config: options.config });
  const guard = createAuthGuard({ db: options.db, config: options.config });

  registerQuoteRoute(app, service);
  registerRuleRoutes(app, service, guard);
};
