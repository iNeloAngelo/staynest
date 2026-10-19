import { randomUUID } from 'node:crypto';
import type { ListingPhotoDto, UpdatePhotoOrderInput } from '@staynest/shared';
import { MAX_PHOTOS_PER_UPLOAD, MIN_PUBLISHED_PHOTOS } from '@staynest/shared';
import type { Transaction } from 'kysely';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { DB } from '../../platform/db/schema.generated';
import { errorCode } from '../../platform/errors/code';
import type { MediaStorage } from '../../platform/storage/index';
import { photoKeys, variantKey } from '../../platform/storage/index';
import { requireOwnedListing } from '../listings/index';
import { toPhotoDto } from './dto';
import {
  photoFilesRequired,
  photoNotFound,
  photoOrderInvalid,
  photoPixelsExceeded,
  photoTooLarge,
  photoUnsupported,
  photoUploadRateLimited,
  photosLimitReached,
  photosPerUploadLimit,
  photosTooFewPublished,
  storageUnavailable,
} from './errors';
import { PhotoTooLargeError, PhotoUnsupportedError, processPhoto } from './image';
import type { ProcessedPhoto } from './image';
import { createLimiter } from './limiter';
import {
  clearCover,
  countPhotos,
  deletePhoto,
  findPhoto,
  firstPhoto,
  hasCover,
  insertPhotos,
  listPhotos,
  markCover,
  nextPosition,
  setListingCover,
  updatePositions,
} from './repo';
import type { NewPhoto, PhotoRow } from './repo';

export type UploadFile = {
  /** Читается внутри слота семафора, чтобы в очереди не копились буферы. */
  read: () => Promise<Buffer>;
};

export type PhotoServiceDependencies = {
  db: Db;
  config: AppConfig;
  storage: MediaStorage;
  logger: Logger;
};

type PreparedPhoto = Omit<NewPhoto, 'position' | 'is_cover'>;

async function uploadVariants(
  storage: MediaStorage,
  prefix: string,
  variants: Record<'thumb' | 'md' | 'lg', Buffer>,
  uploadedKeys: string[],
): Promise<void> {
  for (const variant of ['thumb', 'md', 'lg'] as const) {
    const key = variantKey(prefix, variant);
    await storage.put(key, variants[variant], 'image/webp');
    uploadedKeys.push(key);
  }
}

function toDtos(rows: PhotoRow[], storage: MediaStorage): ListingPhotoDto[] {
  return rows.map((row) => toPhotoDto(row, storage));
}

async function removeQuietly(storage: MediaStorage, logger: Logger, keys: string[]): Promise<void> {
  try {
    await storage.remove(keys);
  } catch (error) {
    // Объект-сирота хуже, чем сломанный ответ; чистим повторно через бэклог.
    logger.warn({ code: errorCode(error) }, 'failed to remove media objects');
  }
}

type Limits = {
  maxBytes: number;
  maxPerListing: number;
  maxPixels: number;
};

type ProcessInput = {
  storage: MediaStorage;
  limits: Limits;
  listingId: string;
  files: AsyncIterable<UploadFile>;
  uploadedKeys: string[];
  limit: <T>(task: () => Promise<T>) => Promise<T>;
  logger: Logger;
};

async function processFiles({
  storage,
  limits,
  listingId,
  files,
  uploadedKeys,
  limit,
  logger,
}: ProcessInput): Promise<PreparedPhoto[]> {
  const prepared: PreparedPhoto[] = [];

  for await (const file of files) {
    if (prepared.length >= MAX_PHOTOS_PER_UPLOAD) {
      throw photosPerUploadLimit(MAX_PHOTOS_PER_UPLOAD);
    }

    const preparedPhoto = await limit(async () => {
      const buffer = await file.read();
      if (buffer.byteLength > limits.maxBytes) throw photoTooLarge(limits.maxBytes);

      let processed: ProcessedPhoto;
      try {
        processed = await processPhoto(buffer, { maxPixels: limits.maxPixels });
      } catch (error) {
        if (error instanceof PhotoTooLargeError) throw photoPixelsExceeded();
        if (error instanceof PhotoUnsupportedError) throw photoUnsupported();
        throw error;
      }

      const id = randomUUID();
      const prefix = `listings/${listingId}/${id}`;

      try {
        await uploadVariants(storage, prefix, processed.variants, uploadedKeys);
      } catch (error) {
        logger.error({ code: errorCode(error) }, 'photo upload to storage failed');
        throw storageUnavailable();
      }

      return {
        id,
        listing_id: listingId,
        storage_prefix: prefix,
        width: processed.width,
        height: processed.height,
        blurhash: processed.blurhash,
      } satisfies PreparedPhoto;
    });

    prepared.push(preparedPhoto);
  }

  if (prepared.length === 0) throw photoFilesRequired();
  return prepared;
}

/** Не больше 30 загрузок за 10 минут на пользователя: sharp — дорогая операция. */
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UPLOAD_MAX = 30;

function createUploadRateLimit() {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function assertAllowed(userId: string): void {
    const now = Date.now();
    if (buckets.size > 1000) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }

    const bucket = buckets.get(userId);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(userId, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
      return;
    }

    bucket.count += 1;
    if (bucket.count > UPLOAD_MAX) throw photoUploadRateLimited();
  };
}

function uploadService({ db, config, storage, logger }: PhotoServiceDependencies) {
  const limits: Limits = {
    maxBytes: config.storage.maxUploadBytes,
    maxPerListing: config.storage.maxPerListing,
    maxPixels: config.storage.maxPixels,
  };
  const limit = createLimiter(2);
  const assertRate = createUploadRateLimit();

  return {
    async upload(
      ownerId: string,
      listingId: string,
      files: AsyncIterable<UploadFile>,
    ): Promise<ListingPhotoDto[]> {
      assertRate(ownerId);
      // Ранняя проверка владения: не тратим CPU и трафик на чужое объявление.
      await requireOwnedListing(db.kysely, ownerId, listingId);

      const current = await countPhotos(db.kysely, listingId);
      if (current >= limits.maxPerListing) throw photosLimitReached(limits.maxPerListing);

      const uploadedKeys: string[] = [];

      try {
        const prepared = await processFiles({
          storage,
          limits,
          listingId,
          files,
          uploadedKeys,
          limit,
          logger,
        });

        const rows = await db.kysely.transaction().execute(async (trx) => {
          await requireOwnedListing(trx, ownerId, listingId, { lock: true });

          const current = await countPhotos(trx, listingId);
          if (current + prepared.length > limits.maxPerListing) {
            throw photosLimitReached(limits.maxPerListing);
          }

          const coverExists = await hasCover(trx, listingId);
          let position = await nextPosition(trx, listingId);
          const inserts: NewPhoto[] = prepared.map((photo, index) => ({
            ...photo,
            position: position++,
            is_cover: !coverExists && index === 0,
          }));

          await insertPhotos(trx, inserts);

          const first = inserts[0];
          if (!coverExists && first) {
            await setListingCover(trx, listingId, first.id);
          }

          return listPhotos(trx, listingId);
        });

        return toDtos(rows, storage);
      } catch (error) {
        await removeQuietly(storage, logger, uploadedKeys);
        throw error;
      }
    },
  };
}

async function reassignCover(
  trx: Transaction<DB>,
  listingId: string,
  wasCover: boolean,
): Promise<void> {
  if (!wasCover) return;

  const next = await firstPhoto(trx, listingId);
  if (!next) {
    await setListingCover(trx, listingId, null);
    return;
  }

  await markCover(trx, listingId, next.id);
  await setListingCover(trx, listingId, next.id);
}

function manageService({ db, storage, logger }: PhotoServiceDependencies) {
  return {
    async reorder(
      ownerId: string,
      listingId: string,
      input: UpdatePhotoOrderInput,
    ): Promise<ListingPhotoDto[]> {
      const rows = await db.kysely.transaction().execute(async (trx) => {
        await requireOwnedListing(trx, ownerId, listingId, { lock: true });
        const existing = await listPhotos(trx, listingId);
        const existingIds = new Set(existing.map((photo) => photo.id));

        if (
          existing.length !== input.photoIds.length ||
          input.photoIds.some((id) => !existingIds.has(id))
        ) {
          throw photoOrderInvalid();
        }

        await updatePositions(trx, listingId, input.photoIds);
        return listPhotos(trx, listingId);
      });

      return toDtos(rows, storage);
    },

    async setCover(
      ownerId: string,
      listingId: string,
      photoId: string,
    ): Promise<ListingPhotoDto[]> {
      const rows = await db.kysely.transaction().execute(async (trx) => {
        await requireOwnedListing(trx, ownerId, listingId, { lock: true });
        const photo = await findPhoto(trx, listingId, photoId);
        if (!photo) throw photoNotFound();

        await clearCover(trx, listingId);
        await markCover(trx, listingId, photo.id);
        await setListingCover(trx, listingId, photo.id);

        return listPhotos(trx, listingId);
      });

      return toDtos(rows, storage);
    },

    async remove(ownerId: string, listingId: string, photoId: string): Promise<void> {
      const removed = await db.kysely.transaction().execute(async (trx) => {
        const listing = await requireOwnedListing(trx, ownerId, listingId, { lock: true });
        const photo = await findPhoto(trx, listingId, photoId);
        if (!photo) throw photoNotFound();

        await deletePhoto(trx, photo.id);
        await reassignCover(trx, listingId, photo.is_cover);

        // Опубликованное объявление не может остаться с меньшим числом фото.
        const remaining = await countPhotos(trx, listingId);
        if (listing.status === 'published' && remaining < MIN_PUBLISHED_PHOTOS) {
          throw photosTooFewPublished(MIN_PUBLISHED_PHOTOS);
        }

        return photo;
      });

      await removeQuietly(storage, logger, photoKeys(removed.storage_prefix));
    },
  };
}

export function createPhotoService(deps: PhotoServiceDependencies) {
  return {
    ...uploadService(deps),
    ...manageService(deps),
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;
