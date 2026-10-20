import multipart from '@fastify/multipart';
import { AVATAR_MAX_BYTES } from '@staynest/shared';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { FixedWindowRateLimiter } from '../../platform/http/rate-limit';
import type { MediaStorage } from '../../platform/storage/index';
import { createAuthGuard } from '../auth/index';
import { avatarRateLimited, avatarRequired, avatarTooLarge } from './errors';
import { createProfileService } from './service';

type ProfileRoutesOptions = {
  config: AppConfig;
  db: Db;
  storage: MediaStorage;
  logger: Logger;
};

const AVATAR_RATE = { max: 20, windowMs: 60 * 60 * 1000 };

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

function isMultipartError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('FST_');
}

function multipartError(error: unknown): AppError {
  const code = (error as { code?: string } | null)?.code;

  if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return avatarTooLarge();
  }
  if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
    return avatarRequired();
  }

  return new AppError({
    status: 400,
    code: 'bad_multipart',
    title: 'Bad Request',
    detail: 'Не удалось разобрать multipart-запрос.',
  });
}

async function readAvatar(request: FastifyRequest): Promise<Buffer> {
  for await (const part of request.parts()) {
    if (part.type !== 'file') continue;

    const file = part as MultipartFile;
    if (file.fieldname !== 'avatar') {
      // Неизвестное поле нужно дочитать, иначе парсер оставит поток открытым.
      file.file.resume();
      continue;
    }

    return file.toBuffer();
  }

  throw avatarRequired();
}

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (app, options) => {
  await app.register(multipart, {
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 1 },
  });

  const service = createProfileService(options);
  const guard = createAuthGuard({ db: options.db, config: options.config });
  const limiter = new FixedWindowRateLimiter();

  app.post(
    '/me/avatar',
    { preHandler: guard, bodyLimit: AVATAR_MAX_BYTES + 64 * 1024 },
    async (request, reply) => {
      noStore(reply);
      const actor = actorOf(request);
      const decision = limiter.check(`avatar:${actor.userId}`, AVATAR_RATE);
      if (!decision.allowed) throw avatarRateLimited(decision.retryAfterSeconds);

      try {
        const input = await readAvatar(request);
        return reply.send({ user: await service.setAvatar(actor.userId, input) });
      } catch (error) {
        if (isMultipartError(error)) throw multipartError(error);
        throw error;
      }
    },
  );

  app.delete('/me/avatar', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    return reply.send({ user: await service.removeAvatar(actorOf(request).userId) });
  });
};
