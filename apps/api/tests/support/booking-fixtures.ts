import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { BookingStatus } from '@staynest/shared';
import { addDays, todayInTimeZone } from '@staynest/shared';
import type { Harness, TestUser } from './harness';

export const LISTING_DESCRIPTION =
  'Тихий дом с террасой, камином и видом на сосновый лес. Подходит для семьи из четырёх человек.';

export type ListingOptions = {
  status?: 'draft' | 'published' | 'archived';
  weekendPriceMinor?: number | null;
  cleaningFeeMinor?: number;
  minNights?: number;
  maxNights?: number;
  maxGuests?: number;
};

export async function seedListing(
  h: Harness,
  ownerId: string,
  options: ListingOptions = {},
): Promise<string> {
  const row = await h.db.kysely
    .insertInto('listings')
    .values({
      owner_id: ownerId,
      status: options.status ?? 'published',
      type: 'house',
      title: 'Дом у озера',
      description: LISTING_DESCRIPTION,
      country: 'RU',
      region: 'Владимирская область',
      city: 'Суздаль',
      address_line: 'Лесная улица, 12',
      max_guests: options.maxGuests ?? 4,
      bedrooms: 2,
      beds: 3,
      base_price_minor: 100_000,
      weekend_price_minor: options.weekendPriceMinor ?? null,
      cleaning_fee_minor: options.cleaningFeeMinor ?? 50_000,
      min_nights: options.minNights ?? 1,
      max_nights: options.maxNights ?? 30,
      published_at: options.status === 'draft' ? null : new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return row.id;
}

export function futureDay(offset = 14): string {
  return addDays(todayInTimeZone('Europe/Moscow'), offset);
}

export type BookingSeed = {
  listingId: string;
  guestId: string;
  from: string;
  to: string;
  status?: BookingStatus;
  expiresAt?: Date | null;
  confirmedAt?: Date | null;
  hostResponse?: string | null;
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  createdAt?: Date;
};

function priceBreakdown(from: string, to: string) {
  return {
    checkIn: from,
    checkOut: to,
    nights: 2,
    guests: 2,
    currency: 'RUB',
    minNightsApplied: 1,
    maxNights: 30,
    nightly: [],
    groups: [],
    nightlyTotalMinor: 100_000,
    cleaningFeeMinor: 0,
    serviceFeeMinor: 0,
    totalMinor: 100_000,
  };
}

export async function insertBookingRow(h: Harness, seed: BookingSeed): Promise<string> {
  const row = await h.db.kysely
    .insertInto('bookings')
    .values({
      listing_id: seed.listingId,
      guest_id: seed.guestId,
      stay_range: sql<string>`daterange(${seed.from}::date, ${seed.to}::date, '[)')`,
      guests_count: 2,
      status: seed.status ?? 'pending',
      total_minor: 100_000,
      currency: 'RUB',
      price_breakdown: priceBreakdown(seed.from, seed.to) as never,
      expires_at: seed.expiresAt ?? null,
      confirmed_at: seed.confirmedAt ?? null,
      host_response: seed.hostResponse ?? null,
      cancelled_at: seed.cancelledAt ?? null,
      cancel_reason: seed.cancelReason ?? null,
      ...(seed.createdAt === undefined ? {} : { created_at: seed.createdAt }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await h.db.kysely
    .insertInto('booking_events')
    .values({
      booking_id: row.id,
      actor_id: seed.guestId,
      from_status: null,
      to_status: 'pending',
      note: null,
    })
    .execute();

  return row.id;
}

export type CreateBookingOverrides = {
  checkIn?: string;
  checkOut?: string;
  guestsCount?: number;
  guestMessage?: string;
  key?: string;
};

export function createBookingRequest(
  h: Harness,
  guest: TestUser,
  listingId: string,
  overrides: CreateBookingOverrides = {},
) {
  const checkIn = overrides.checkIn ?? futureDay(14);
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/bookings',
    headers: {
      cookie: guest.cookie,
      'idempotency-key': overrides.key ?? randomUUID(),
    },
    payload: {
      listingId,
      checkIn,
      checkOut: overrides.checkOut ?? addDays(checkIn, 2),
      guestsCount: overrides.guestsCount ?? 2,
      ...(overrides.guestMessage === undefined ? {} : { guestMessage: overrides.guestMessage }),
    },
  });
}
