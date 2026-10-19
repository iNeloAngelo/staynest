import type {
  AmenityDto,
  CreateListingInput,
  ListingDto,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db, DbExecutor } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import type { AuthContext } from '../../platform/http/auth-context';
import { toAmenityDto, toListingDto } from './dto';
import {
  amenityNotFound,
  listingAlreadyPublished,
  listingHasActiveBookings,
  listingIncomplete,
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
  listOwnedListings,
  publishListing,
  replaceAmenities as replaceListingAmenities,
  updateListing,
} from './repo';
import type { AmenityRow, ListingAmenityRow, ListingPatch, ListingRow } from './repo';
import { assertNightsRange, completenessIssues, publishIssues } from './validation';
import type { CompletenessFields } from './validation';

export type ListingServiceDependencies = {
  db: Db;
  config: AppConfig;
  events: EventBus;
};

async function withDetails(executor: DbExecutor, row: ListingRow): Promise<ListingDto> {
  const [amenities, counts] = await Promise.all([
    listListingAmenities(executor, row.id),
    countPendingBookings(executor, [row.id]),
  ]);

  return toListingDto(row, amenities, counts.get(row.id) ?? 0);
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

async function requireOwned(
  executor: DbExecutor,
  ownerId: string,
  id: string,
): Promise<ListingRow> {
  const row = await findOwnedListing(executor, ownerId, id);
  if (!row) throw listingNotFound();
  return row;
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

function draftService({ db }: ListingServiceDependencies) {
  return {
    async createDraft(ownerId: string, input: CreateListingInput): Promise<ListingDto> {
      const row = await insertDraft(db.kysely, ownerId, input.type);
      return toListingDto(row, [], 0);
    },

    async update(ownerId: string, id: string, input: UpdateListingInput): Promise<ListingDto> {
      const row = await requireOwned(db.kysely, ownerId, id);
      assertNightsRange(input.minNights ?? row.min_nights, input.maxNights ?? row.max_nights);

      const patch = toListingPatch(input);
      assertStillComplete(row, patch);

      const updated = await updateListing(db.kysely, id, patch);
      return withDetails(db.kysely, updated);
    },

    async replaceAmenities(
      ownerId: string,
      id: string,
      input: UpdateListingAmenitiesInput,
    ): Promise<ListingDto> {
      const row = await requireOwned(db.kysely, ownerId, id);
      const existing = await existingAmenityIds(db.kysely, input.amenityIds);
      if (existing.length !== input.amenityIds.length) {
        const found = new Set(existing);
        throw amenityNotFound(input.amenityIds.filter((amenityId) => !found.has(amenityId)));
      }

      await db.kysely.transaction().execute(async (trx) => {
        await replaceListingAmenities(trx, id, input.amenityIds);
      });

      return withDetails(db.kysely, row);
    },
  };
}

function statusService({ db, config, events }: ListingServiceDependencies) {
  return {
    async publish(actor: AuthContext, id: string): Promise<ListingDto> {
      assertEmailVerified(config, actor);
      const row = await requireOwned(db.kysely, actor.userId, id);
      if (row.status === 'published') throw listingAlreadyPublished();

      const photos = await countPhotos(db.kysely, id);
      const issues = publishIssues(row, photos);
      if (issues.length > 0) throw listingIncomplete(issues);

      const updated = await publishListing(db.kysely, id, new Date());
      events.publish('listing.published', {
        listingId: updated.id,
        ownerId: updated.owner_id,
        occurredAt: updated.published_at?.toISOString() ?? new Date().toISOString(),
      });

      return withDetails(db.kysely, updated);
    },

    async archive(ownerId: string, id: string): Promise<ListingDto> {
      const row = await requireOwned(db.kysely, ownerId, id);
      if (row.status !== 'published') throw listingNotPublished();
      if (await hasActiveFutureBookings(db.kysely, id)) throw listingHasActiveBookings();

      const updated = await archiveListing(db.kysely, id);
      return withDetails(db.kysely, updated);
    },

    async remove(ownerId: string, id: string): Promise<void> {
      const row = await requireOwned(db.kysely, ownerId, id);
      if (row.status !== 'draft') throw listingNotDraft();
      await deleteListing(db.kysely, id);
    },
  };
}

function readService({ db }: ListingServiceDependencies) {
  return {
    async listMine(ownerId: string): Promise<ListingDto[]> {
      const rows = await listOwnedListings(db.kysely, ownerId);
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      const [amenities, counts] = await Promise.all([
        listAmenitiesForListings(db.kysely, ids),
        countPendingBookings(db.kysely, ids),
      ]);
      const groups = groupAmenities(amenities);

      return rows.map((row) =>
        toListingDto(row, groups.get(row.id) ?? [], counts.get(row.id) ?? 0),
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
