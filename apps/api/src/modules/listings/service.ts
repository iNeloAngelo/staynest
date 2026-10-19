import type {
  AmenityDto,
  CreateListingInput,
  ListingDto,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db, DbExecutor } from '../../platform/db/index';
import { errorCode } from '../../platform/errors/code';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { photoKeys } from '../../platform/storage/index';
import type { MediaStorage } from '../../platform/storage/index';
import type { Logger } from 'pino';
import { toAmenityDto, toListingDto } from './dto';
import {
  amenityNotFound,
  listingAlreadyPublished,
  listingHasActiveBookings,
  listingIncomplete,
  listingInvalid,
  listingNotDraft,
  listingNotPublished,
  listingNotFound,
  publishingRequiresVerifiedEmail,
} from './errors';
import { toListingPatch } from './mapping';
import {
  archiveListing,
  countPendingBookings,
  countPhotos,
  deleteListing,
  existingAmenityIds,
  findOwnedListing,
  hasActiveFutureBookings,
  insertDraft,
  listAmenities,
  listAmenitiesForListings,
  listListingAmenities,
  listListingPhotos,
  listOwnedListings,
  listPhotoPrefixes,
  listPhotosForListings,
  lockOwnedListing,
  publishListing,
  replaceAmenities as replaceListingAmenities,
  updateListing,
} from './repo';
import type { AmenityRow, ListingAmenityRow, ListingPatch, ListingRow, PhotoRow } from './repo';
import { assertNightsRange, completenessIssues, publishIssues } from './validation';
import type { CompletenessFields } from './validation';

export type ListingServiceDependencies = {
  db: Db;
  config: AppConfig;
  events: EventBus;
  storage: MediaStorage;
  logger: Logger;
};

async function withDetails(
  executor: DbExecutor,
  row: ListingRow,
  storage: MediaStorage,
): Promise<ListingDto> {
  const [photos, amenities, counts] = await Promise.all([
    listListingPhotos(executor, row.id),
    listListingAmenities(executor, row.id),
    countPendingBookings(executor, [row.id]),
  ]);

  return toListingDto({
    row,
    photos,
    amenities,
    pendingBookingsCount: counts.get(row.id) ?? 0,
    storage,
  });
}

function groupAmenities(rows: ListingAmenityRow[]): Map<string, AmenityRow[]> {
  const groups = new Map<string, AmenityRow[]>();

  for (const row of rows) {
    const list = groups.get(row.listing_id) ?? [];
    list.push(row);
    groups.set(row.listing_id, list);
  }

  return groups;
}

function groupPhotos(rows: PhotoRow[]): Map<string, PhotoRow[]> {
  const groups = new Map<string, PhotoRow[]>();

  for (const row of rows) {
    const list = groups.get(row.listing_id) ?? [];
    list.push(row);
    groups.set(row.listing_id, list);
  }

  return groups;
}

async function requireOwned(
  executor: DbExecutor,
  ownerId: string,
  id: string,
  lock = false,
): Promise<ListingRow> {
  const row = lock
    ? await lockOwnedListing(executor, ownerId, id)
    : await findOwnedListing(executor, ownerId, id);
  if (!row) throw listingNotFound();
  return row;
}

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23514'
  );
}

function mergedFields(row: ListingRow, patch: ListingPatch): CompletenessFields {
  const pick = <K extends keyof CompletenessFields>(key: K): CompletenessFields[K] =>
    key in patch ? (patch[key] as CompletenessFields[K]) : row[key];

  return {
    title: pick('title'),
    description: pick('description'),
    city: pick('city'),
    address_line: pick('address_line'),
    max_guests: pick('max_guests'),
    bedrooms: pick('bedrooms'),
    beds: pick('beds'),
    base_price_minor: pick('base_price_minor'),
  };
}

function assertEmailVerified(config: AppConfig, actor: AuthContext): void {
  if (config.auth.requireEmailVerification && !actor.user.emailVerified) {
    throw publishingRequiresVerifiedEmail();
  }
}

function assertStillComplete(row: ListingRow, patch: ListingPatch): void {
  if (row.status === 'draft') return;

  const issues = completenessIssues(mergedFields(row, patch));
  if (issues.length > 0) throw listingIncomplete(issues);
}

function draftService({ db, storage }: ListingServiceDependencies) {
  return {
    async createDraft(ownerId: string, input: CreateListingInput): Promise<ListingDto> {
      const row = await insertDraft(db.kysely, ownerId, input.type);
      return toListingDto({ row, photos: [], amenities: [], pendingBookingsCount: 0, storage });
    },

    async update(ownerId: string, id: string, input: UpdateListingInput): Promise<ListingDto> {
      let updated: ListingRow;

      try {
        updated = await db.kysely.transaction().execute(async (trx) => {
          const row = await requireOwned(trx, ownerId, id, true);
          assertNightsRange(input.minNights ?? row.min_nights, input.maxNights ?? row.max_nights);

          const patch = toListingPatch(input);
          assertStillComplete(row, patch);

          return updateListing(trx, id, patch);
        });
      } catch (error) {
        if (isCheckViolation(error)) throw listingInvalid();
        throw error;
      }

      return withDetails(db.kysely, updated, storage);
    },

    async replaceAmenities(
      ownerId: string,
      id: string,
      input: UpdateListingAmenitiesInput,
    ): Promise<ListingDto> {
      const row = await db.kysely.transaction().execute(async (trx) => {
        const owned = await requireOwned(trx, ownerId, id, true);
        const existing = await existingAmenityIds(trx, input.amenityIds);
        if (existing.length !== input.amenityIds.length) {
          const found = new Set(existing);
          throw amenityNotFound(input.amenityIds.filter((amenityId) => !found.has(amenityId)));
        }

        await replaceListingAmenities(trx, id, input.amenityIds);
        return owned;
      });

      return withDetails(db.kysely, row, storage);
    },
  };
}

function statusService({ db, config, events, storage, logger }: ListingServiceDependencies) {
  return {
    async publish(actor: AuthContext, id: string): Promise<ListingDto> {
      let updated: ListingRow;

      try {
        updated = await db.kysely.transaction().execute(async (trx) => {
          const row = await requireOwned(trx, actor.userId, id, true);
          assertEmailVerified(config, actor);
          if (row.status === 'published') throw listingAlreadyPublished();

          const photos = await countPhotos(trx, id);
          const issues = publishIssues(row, photos);
          if (issues.length > 0) throw listingIncomplete(issues);

          return publishListing(trx, id, new Date());
        });
      } catch (error) {
        if (isCheckViolation(error)) throw listingInvalid();
        throw error;
      }

      events.publish('listing.published', {
        listingId: updated.id,
        ownerId: updated.owner_id,
        occurredAt: updated.published_at?.toISOString() ?? new Date().toISOString(),
      });

      return withDetails(db.kysely, updated, storage);
    },

    async archive(ownerId: string, id: string): Promise<ListingDto> {
      const updated = await db.kysely.transaction().execute(async (trx) => {
        const row = await requireOwned(trx, ownerId, id, true);
        if (row.status !== 'published') throw listingNotPublished();
        if (await hasActiveFutureBookings(trx, id)) throw listingHasActiveBookings();

        return archiveListing(trx, id);
      });

      return withDetails(db.kysely, updated, storage);
    },

    async remove(ownerId: string, id: string): Promise<void> {
      let prefixes: string[] = [];

      await db.kysely.transaction().execute(async (trx) => {
        const row = await requireOwned(trx, ownerId, id, true);
        if (row.status !== 'draft') throw listingNotDraft();

        prefixes = (await listPhotoPrefixes(trx, id)).map((photo) => photo.storage_prefix);
        await deleteListing(trx, id);
      });

      try {
        await storage.remove(prefixes.flatMap((prefix) => photoKeys(prefix)));
      } catch (error) {
        // Строка уже удалена: объект-сирота не должен превращать 204 в 500.
        logger.warn({ code: errorCode(error) }, 'failed to remove listing media');
      }
    },
  };
}

function readService({ db, storage }: ListingServiceDependencies) {
  return {
    async listMine(ownerId: string): Promise<ListingDto[]> {
      const rows = await listOwnedListings(db.kysely, ownerId);
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      const [photos, amenities, counts] = await Promise.all([
        listPhotosForListings(db.kysely, ids),
        listAmenitiesForListings(db.kysely, ids),
        countPendingBookings(db.kysely, ids),
      ]);
      const photoGroups = groupPhotos(photos);
      const groups = groupAmenities(amenities);

      return rows.map((row) =>
        toListingDto({
          row,
          photos: photoGroups.get(row.id) ?? [],
          amenities: groups.get(row.id) ?? [],
          pendingBookingsCount: counts.get(row.id) ?? 0,
          storage,
        }),
      );
    },

    async amenities(): Promise<AmenityDto[]> {
      const rows = await listAmenities(db.kysely);
      return rows.map(toAmenityDto);
    },
  };
}

export function createListingService(deps: ListingServiceDependencies) {
  return {
    ...draftService(deps),
    ...statusService(deps),
    ...readService(deps),
  };
}

export type ListingService = ReturnType<typeof createListingService>;
