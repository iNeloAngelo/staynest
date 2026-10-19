import multipart from '@fastify/multipart';
import type { UpdatePhotoOrderInput } from '@staynest/shared';
import { MAX_PHOTOS_PER_UPLOAD, updatePhotoOrderInputSchema } from '@staynest/shared';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { z } from 'zod';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { AppError } from '../../platform/http/errors';
import { parseInput } from '../../platform/http/validate';
import type { MediaStorage } from '../../platform/storage/index';
import type { Logger } from 'pino';
import { createAuthGuard } from '../auth/index';
import { photoTooLarge, photosPerUploadLimit } from './errors';
import { createPhotoService } from './service';
import type { PhotoService, UploadFile } from './service';

type PhotosRoutesOptions = {
  config: AppConfig;
  db: Db;
  storage: MediaStorage;
  logger: Logger;
};

const listingParamsSchema = z.object({ id: z.uuid() }).strict();
const photoParamsSchema = z.object({ id: z.uuid(), photoId: z.uuid() }).strict();

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
}

function isFastifyMultipartError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('FST_');
}

function badMultipart(detail: string): AppError {
  return new AppError({
    status: 400,
    code: 'bad_multipart',
    title: 'Bad Request',
    detail,
  });
}

function multipartError(error: unknown, maxBytes: number): AppError {
  const code = (error as { code?: string } | null)?.code;

  if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return photoTooLarge(maxBytes);
  }
  if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return new AppError({
      status: 415,
      code: 'unsupported_media_type',
      title: 'Unsupported Media Type',
      detail: 'Ожидается multipart/form-data.',
    });
  }
  if (code === 'FST_FILES_LIMIT' || code === 'FST_PARTS_LIMIT') {
    return photosPerUploadLimit(MAX_PHOTOS_PER_UPLOAD);
  }
  if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
    return badMultipart('Ожидается multipart/form-data с полем files.');
  }

  return badMultipart('Не удалось разобрать multipart-запрос.');
}

async function* readFiles(request: FastifyRequest): AsyncIterable<UploadFile> {
  for await (const part of request.parts()) {
    if (part.type !== 'file') continue;

    const file = part as MultipartFile;
    if (file.fieldname !== 'files') {
      // Неизвестное поле нужно дочитать, иначе парсер оставит поток открытым.
      file.file.resume();
      continue;
    }

    yield { read: () => file.toBuffer() };
  }
}

function registerUploadRoutes(
  app: FastifyInstance,
  service: PhotoService,
  guard: Guard,
  config: AppConfig,
) {
  app.post(
    '/listings/:id/photos',
    {
      preHandler: guard,
      bodyLimit: config.storage.maxUploadBytes * MAX_PHOTOS_PER_UPLOAD + 128 * 1024,
    },
    async (request, reply) => {
      noStore(reply);
      const { id } = parseInput(listingParamsSchema, request.params);

      try {
        const photos = await service.upload(actorOf(request).userId, id, readFiles(request));
        return reply.status(201).send({ photos });
      } catch (error) {
        if (isFastifyMultipartError(error)) {
          throw multipartError(error, config.storage.maxUploadBytes);
        }
        throw error;
      }
    },
  );
}

function registerManageRoutes(app: FastifyInstance, service: PhotoService, guard: Guard) {
  app.patch('/listings/:id/photos/order', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id } = parseInput(listingParamsSchema, request.params);
    const input = parseInput<UpdatePhotoOrderInput>(updatePhotoOrderInputSchema, request.body);
    const photos = await service.reorder(actorOf(request).userId, id, input);
    return reply.send({ photos });
  });

  app.patch(
    '/listings/:id/photos/:photoId/cover',
    { preHandler: guard },
    async (request, reply) => {
      noStore(reply);
      const { id, photoId } = parseInput(photoParamsSchema, request.params);
      const photos = await service.setCover(actorOf(request).userId, id, photoId);
      return reply.send({ photos });
    },
  );

  app.delete('/listings/:id/photos/:photoId', { preHandler: guard }, async (request, reply) => {
    noStore(reply);
    const { id, photoId } = parseInput(photoParamsSchema, request.params);
    await service.remove(actorOf(request).userId, id, photoId);
    return reply.status(204).send();
  });
}

type Guard = ReturnType<typeof createAuthGuard>;

export const photosRoutes: FastifyPluginAsync<PhotosRoutesOptions> = async (app, options) => {
  await app.register(multipart, {
    limits: {
      fileSize: options.config.storage.maxUploadBytes,
      files: MAX_PHOTOS_PER_UPLOAD,
      fields: 0,
      parts: MAX_PHOTOS_PER_UPLOAD,
    },
  });

  const service = createPhotoService(options);
  const guard = createAuthGuard({ db: options.db, config: options.config });

  registerUploadRoutes(app, service, guard, options.config);
  registerManageRoutes(app, service, guard);
};
