import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  UpdateMeInput,
} from '@staynest/shared';
import {
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  resendVerificationInputSchema,
  updateMeInputSchema,
  verifyEmailInputSchema,
} from '@staynest/shared';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import type { Mailer } from '../../platform/mailer/index';
import { parseInput } from '../../platform/http/validate';
import { unauthorized } from './errors';
import { createAuthGuard } from './guard';
import { createAuthService } from './service';
import type { AuthService } from './service';
import type { AuthOptions } from './service-context';
import type { IssuedTokens, SessionMeta } from './session';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  accessCookieOptions,
  refreshCookieOptions,
} from './tokens';

type AuthRoutesOptions = {
  config: AppConfig;
  db: Db;
  logger: Logger;
  mailer: Mailer;
  events: EventBus;
  auth?: AuthOptions;
};

type Guard = ReturnType<typeof createAuthGuard>;

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
}

function metaOf(request: FastifyRequest): SessionMeta {
  return {
    ip: request.ip || null,
    userAgent: request.headers['user-agent'] ?? null,
  };
}

function sessionCookies(reply: FastifyReply, tokens: IssuedTokens, config: AppConfig): void {
  const secure = config.nodeEnv === 'production';
  const refreshMaxAge = config.auth.refreshTokenTtlDays * 24 * 60 * 60;

  reply.setCookie(
    ACCESS_COOKIE,
    tokens.accessToken,
    accessCookieOptions(secure, config.auth.accessTokenTtlSeconds),
  );
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(secure, refreshMaxAge));
}

function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

function registerPublicRoutes(app: FastifyInstance, service: AuthService, config: AppConfig): void {
  app.post('/auth/register', async (request, reply) => {
    noStore(reply);
    const input = parseInput<RegisterInput>(registerInputSchema, request.body);
    const result = await service.register(input, metaOf(request));
    return reply.status(202).send({
      status: 'accepted',
      emailVerificationRequired: result.emailVerificationRequired,
    });
  });

  app.post('/auth/login', async (request, reply) => {
    noStore(reply);
    const input = parseInput<LoginInput>(loginInputSchema, request.body);
    const result = await service.login(input, metaOf(request));
    sessionCookies(reply, result.tokens, config);
    return reply.send({ user: result.user });
  });

  app.post('/auth/refresh', async (request, reply) => {
    noStore(reply);
    try {
      const result = await service.refresh(request.cookies[REFRESH_COOKIE], metaOf(request));
      sessionCookies(reply, result.tokens, config);
      return reply.send({ user: result.user });
    } catch (error) {
      if (error instanceof AppError && error.status === 401) clearSessionCookies(reply);
      throw error;
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    noStore(reply);
    await service.logout(request.cookies[REFRESH_COOKIE], request.cookies[ACCESS_COOKIE]);
    clearSessionCookies(reply);
    return reply.status(204).send();
  });

  app.post('/auth/verify-email', async (request, reply) => {
    noStore(reply);
    const input = parseInput(verifyEmailInputSchema, request.body);
    await service.verifyEmail(input.token, input.password);
    return reply.status(204).send();
  });

  app.post('/auth/forgot-password', async (request, reply) => {
    noStore(reply);
    const input = parseInput<ForgotPasswordInput>(forgotPasswordInputSchema, request.body);
    await service.requestPasswordReset(input, metaOf(request));
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/auth/reset-password', async (request, reply) => {
    noStore(reply);
    const input = parseInput<ResetPasswordInput>(resetPasswordInputSchema, request.body);
    await service.resetPassword(input, metaOf(request));
    clearSessionCookies(reply);
    return reply.status(204).send();
  });
}

function registerAccountRoutes(app: FastifyInstance, service: AuthService, guard: Guard): void {
  app.post('/auth/resend-verification', async (request, reply) => {
    noStore(reply);
    const input = parseInput<ResendVerificationInput>(resendVerificationInputSchema, request.body);
    await service.resendVerification(input, metaOf(request));
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/auth/change-password', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<ChangePasswordInput>(changePasswordInputSchema, request.body);
    await service.changePassword(authOf(request).userId, input, metaOf(request));
    clearSessionCookies(reply);
    return reply.status(204).send();
  });
}

function registerMeRoutes(app: FastifyInstance, service: AuthService, guard: Guard): void {
  app.get('/me', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    return reply.send({ user: authOf(request).user });
  });

  app.patch('/me', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const input = parseInput<UpdateMeInput>(updateMeInputSchema, request.body);
    const user = await service.updateMe(authOf(request).userId, input);
    return reply.send({ user });
  });

  app.get('/me/sessions', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const auth = authOf(request);
    const sessions = await service.listSessions(auth.userId, auth.sessionId);
    return reply.send({ sessions });
  });

  app.delete('/me/sessions', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    await service.revokeAllSessions(authOf(request).userId);
    clearSessionCookies(reply);
    return reply.status(204).send();
  });
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const service = createAuthService({
    db: options.db,
    logger: options.logger,
    mailer: options.mailer,
    events: options.events,
    config: options.config,
    options: options.auth,
  });

  const guard = createAuthGuard({ db: options.db, config: options.config });
  registerPublicRoutes(app, service, options.config);
  registerAccountRoutes(app, service, guard);
  registerMeRoutes(app, service, guard);
};
