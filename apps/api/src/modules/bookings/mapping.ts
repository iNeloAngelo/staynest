import type {
  BookingContacts,
  BookingDeposit,
  BookingDetail,
  BookingEvent,
  BookingSummary,
  Quote,
} from '@staynest/shared';
import type { BookingDetailRow, BookingEventRow } from './repo';

function iso(value: Date): string {
  return value.toISOString();
}

function isoOrNull(value: Date | null): string | null {
  return value === null ? null : iso(value);
}

function coverPhotoUrl(prefix: string | null, publicPath: string): string | null {
  return prefix === null ? null : `${publicPath}/${prefix}/thumb.webp`;
}

function cancelledByRole(row: BookingDetailRow): 'guest' | 'host' | null {
  if (row.cancelled_by === null) return null;
  return row.cancelled_by === row.guest_id ? 'guest' : 'host';
}

function actorRole(
  actorId: string | null,
  guestId: string,
  hostId: string,
): 'guest' | 'host' | 'system' {
  if (actorId === guestId) return 'guest';
  if (actorId === hostId) return 'host';
  return 'system';
}

function summaryOf(row: BookingDetailRow, publicPath: string): BookingSummary {
  return {
    id: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    status: row.status,
    checkIn: row.check_in ?? '',
    checkOut: row.check_out ?? '',
    nights: row.nights ?? 0,
    guestsCount: row.guests_count,
    totalMinor: Number(row.total_minor),
    currency: row.currency.trim(),
    priceBreakdown: row.price_breakdown as unknown as Quote,
    guestMessage: row.guest_message,
    hostResponse: row.host_response,
    expiresAt: isoOrNull(row.expires_at),
    confirmedAt: isoOrNull(row.confirmed_at),
    cancelledAt: isoOrNull(row.cancelled_at),
    cancelledByRole: cancelledByRole(row),
    cancelReason: row.cancel_reason,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    listing: {
      id: row.listing_id,
      title: row.listing_title,
      city: row.listing_city,
      coverPhotoUrl: coverPhotoUrl(row.cover_storage_prefix, publicPath),
    },
    guest: {
      id: row.guest_id,
      displayName: row.guest_display_name,
    },
  };
}

function eventOf(row: BookingEventRow, guestId: string, hostId: string): BookingEvent {
  return {
    id: row.id,
    actorRole: actorRole(row.actor_id, guestId, hostId),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    createdAt: iso(row.created_at),
  };
}

/**
 * Адрес и телефон второй стороны открываются только после подтверждения.
 * До этого гость и хозяин видят только город, а завершённая бронь остаётся
 * полезной для истории поездок.
 */
function contactsOf(row: BookingDetailRow, viewerId: string): BookingContacts | null {
  if (row.status !== 'confirmed' && row.status !== 'completed') return null;
  if (viewerId !== row.guest_id && viewerId !== row.listing_owner_id) return null;

  const viewerIsGuest = viewerId === row.guest_id;

  return {
    addressLine: row.listing_address_line,
    hostPhone: viewerIsGuest ? row.host_phone : null,
    guestPhone: viewerIsGuest ? null : row.guest_phone,
  };
}

export function toBookingSummary(row: BookingDetailRow, publicPath: string): BookingSummary {
  return summaryOf(row, publicPath);
}

export type BookingDetailContext = {
  publicPath: string;
  viewerId: string;
  deposit?: BookingDeposit | null;
};

export function toBookingDetail(
  row: BookingDetailRow,
  events: BookingEventRow[],
  context: BookingDetailContext,
): BookingDetail {
  return {
    ...summaryOf(row, context.publicPath),
    events: events.map((event) => eventOf(event, row.guest_id, row.listing_owner_id)),
    contacts: contactsOf(row, context.viewerId),
    deposit: context.deposit ?? null,
  };
}
