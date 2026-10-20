import type {
  BlockDto,
  BookingDetail,
  BookingSummary,
  CalendarResponse,
  HostCalendarResponse,
  ListingDto,
  ListingPhotoDto,
  NotificationDto,
  PriceRuleDto,
  PublicListing,
  PublicListingSummary,
  Quote,
  UserDto,
} from '@staynest/shared';
import { addDays, nightsBetween } from '@staynest/shared';
import { vi } from 'vitest';
import { todayLocalIso } from '../shared/lib/dates';

export const demoUser: UserDto = {
  id: '3d0f2f4b-8c47-4d0a-9d55-6f8f1f8b5a11',
  email: 'anna@example.com',
  displayName: 'Анна',
  phone: null,
  avatarKey: null,
  locale: 'ru',
  emailVerified: true,
  createdAt: '2026-10-19T10:00:00.000Z',
};

export const demoListing: ListingDto = {
  id: '0b6f6f46-6a9d-4f6b-8f4a-4f67f5a1b222',
  status: 'draft',
  type: 'house',
  title: null,
  description: '',
  country: 'RU',
  region: null,
  city: null,
  addressLine: null,
  lat: null,
  lng: null,
  maxGuests: null,
  bedrooms: null,
  beds: null,
  bathrooms: 1,
  areaSqm: null,
  basePriceMinor: null,
  weekendPriceMinor: null,
  cleaningFeeMinor: 0,
  currency: 'RUB',
  minNights: 1,
  maxNights: 30,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  houseRules: null,
  coverPhotoId: null,
  photos: [],
  amenities: [],
  pendingBookingsCount: 0,
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
  publishedAt: null,
};

export const demoPhoto: ListingPhotoDto = {
  id: '5b7c6f6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  width: 1000,
  height: 750,
  blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  position: 0,
  isCover: true,
  urls: {
    thumb: '/media/listings/demo/thumb.webp',
    md: '/media/listings/demo/md.webp',
    lg: '/media/listings/demo/lg.webp',
  },
};

export const completeListing: ListingDto = {
  ...demoListing,
  title: 'Дом у озера',
  description: 'Тихий дом у озера с террасой, камином и видом на сосновый лес.',
  city: 'Суздаль',
  region: 'Владимирская область',
  addressLine: 'улица Лесная, 12',
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  basePriceMinor: 750_000,
  photos: [
    demoPhoto,
    { ...demoPhoto, id: '6c8d7f7e-2b3c-5d4e-9f0a-1b2c3d4e5f60', position: 1, isCover: false },
    { ...demoPhoto, id: '7d9e8a8f-3c4d-6e5f-0a1b-2c3d4e5f6071', position: 2, isCover: false },
  ],
};

const demoAmenities = [
  { id: 1, code: 'wifi', nameRu: 'Wi-Fi', nameEn: 'Wi-Fi', icon: 'wifi', sortOrder: 10 },
  { id: 2, code: 'sauna', nameRu: 'Сауна', nameEn: 'Sauna', icon: 'flame', sortOrder: 20 },
];

export const demoPublicListing: PublicListingSummary = {
  id: 'b2f7e8d1-4f1a-4c6e-9a0b-1c2d3e4f5a6b',
  type: 'house',
  title: 'Дом у озера',
  country: 'RU',
  region: 'Владимирская область',
  city: 'Суздаль',
  approxLat: 56.42,
  approxLng: 40.45,
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1,
  areaSqm: 86,
  basePriceMinor: 750_000,
  weekendPriceMinor: 850_000,
  cleaningFeeMinor: 150_000,
  currency: 'RUB',
  minNights: 2,
  maxNights: 14,
  coverPhoto: demoPhoto,
  photoCount: 3,
  stayPrice: null,
  publishedAt: '2026-10-01T10:00:00.000Z',
};

export const demoPublicDetail: PublicListing = {
  ...demoPublicListing,
  description:
    'Тихий дом с террасой и видом на озеро. Внутри камин, просторная кухня и три спальных места. Подходит для семьи из четырёх человек.',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  houseRules: 'Курить нельзя. С животными — по договорённости.',
  photos: [
    demoPhoto,
    { ...demoPhoto, id: '6c8d7f7e-2b3c-5d4e-9f0a-1b2c3d4e5f60', position: 1, isCover: false },
    { ...demoPhoto, id: '7d9e8a8f-3c4d-6e5f-0a1b-2c3d4e5f6071', position: 2, isCover: false },
  ],
  amenities: demoAmenities,
};

export function demoBooking(status: BookingSummary['status'] = 'pending'): BookingSummary {
  const checkIn = addDays(todayLocalIso(), 10);
  const checkOut = addDays(checkIn, 2);

  return {
    id: 'a11f5f4b-0f77-4c4e-9f0a-6b1c2d3e4f55',
    listingId: demoPublicListing.id,
    guestId: demoUser.id,
    status,
    checkIn,
    checkOut,
    nights: 2,
    guestsCount: 2,
    totalMinor: 1_650_000,
    currency: 'RUB',
    priceBreakdown: demoQuote(`/quote?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`),
    guestMessage: 'Приедем к вечеру, с собакой.',
    hostResponse: null,
    expiresAt: addDays(todayLocalIso(), 1),
    confirmedAt: null,
    cancelledAt: null,
    cancelledByRole: null,
    cancelReason: null,
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
    listing: {
      id: demoPublicListing.id,
      title: demoPublicListing.title,
      city: demoPublicListing.city,
      coverPhotoUrl: demoPhoto.urls.thumb,
    },
    guest: { id: demoUser.id, displayName: demoUser.displayName },
  };
}

export function demoBookingDetail(status: BookingSummary['status'] = 'pending'): BookingDetail {
  const booking = demoBooking(status);
  return {
    ...booking,
    contacts:
      status === 'confirmed' || status === 'completed'
        ? {
            addressLine: 'улица Лесная, 12',
            hostPhone: '+7 900 000-00-22',
            guestPhone: null,
          }
        : null,
    events: [
      {
        id: '1',
        actorRole: 'guest',
        fromStatus: null,
        toStatus: 'pending',
        note: null,
        createdAt: booking.createdAt,
      },
    ],
  };
}

export function demoNotification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  const booking = demoBooking('pending');
  return {
    id: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
    type: 'booking_requested',
    payload: {
      bookingId: booking.id,
      listingId: booking.listingId,
      listingTitle: booking.listing.title,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestName: booking.guest.displayName,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
    },
    readAt: null,
    createdAt: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

export function demoCalendar(listingId = demoPublicListing.id): CalendarResponse {
  const today = todayLocalIso();
  return {
    listingId,
    from: addDays(today, -1),
    to: addDays(today, 366),
    today,
    minNights: 2,
    maxNights: 14,
    basePriceMinor: 750_000,
    weekendPriceMinor: 850_000,
    cleaningFeeMinor: 150_000,
    currency: 'RUB',
    unavailable: [{ date: addDays(today, 5), kind: 'booked' }],
  };
}

function demoQuote(url: string): Quote {
  const params = new URL(url, 'http://localhost').searchParams;
  const checkIn = params.get('checkIn') ?? todayLocalIso();
  const checkOut = params.get('checkOut') ?? addDays(checkIn, 2);
  const nights = nightsBetween(checkIn, checkOut);
  const nightlyTotal = nights * 750_000;

  return {
    checkIn,
    checkOut,
    nights,
    guests: Number(params.get('guests') ?? 1),
    currency: 'RUB',
    minNightsApplied: 2,
    maxNights: 14,
    nightly: [],
    groups: [{ priceMinor: 750_000, nights, source: 'base', ruleId: null, ruleName: null }],
    nightlyTotalMinor: nightlyTotal,
    cleaningFeeMinor: 150_000,
    serviceFeeMinor: 0,
    totalMinor: nightlyTotal + 150_000,
  };
}

function demoHostCalendar(listingId: string, url: string): HostCalendarResponse {
  const params = new URL(url, 'http://localhost').searchParams;
  return {
    listingId,
    from: params.get('from') ?? todayLocalIso(),
    to: params.get('to') ?? addDays(todayLocalIso(), 30),
    today: todayLocalIso(),
    bookings: [],
    blocks: [],
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export type ApiMockOptions = {
  user?: UserDto | null;
  loginStatus?: number;
  loginBody?: unknown;
  registerBody?: unknown;
  listings?: ListingDto[];
  catalogListings?: PublicListingSummary[];
  catalogDetail?: PublicListing | null;
  priceRules?: PriceRuleDto[];
  blocks?: BlockDto[];
  bookings?: BookingSummary[];
  bookingDetail?: BookingDetail;
  notifications?: NotificationDto[];
  unreadCount?: number;
  pushEnabled?: boolean;
  bookingCreateStatus?: number;
  bookingCreateBody?: unknown;
  pendingHostCalendar?: boolean;
  publishStatus?: number;
  publishBody?: unknown;
  onRequest?: (url: string, init?: RequestInit) => void;
};

type RouteContext = {
  url: string;
  method: string;
  init: RequestInit | undefined;
  store: ListingDto[];
  options: ApiMockOptions;
};

const SIMPLE_ROUTES: Array<[string, () => Response]> = [
  ['/auth/logout', () => new Response(null, { status: 204 })],
  ['/auth/verify-email', () => new Response(null, { status: 204 })],
  ['/auth/reset-password', () => new Response(null, { status: 204 })],
  ['/auth/forgot-password', () => jsonResponse({ status: 'accepted' }, 202)],
  ['/health', () => jsonResponse({ status: 'ok', db: 'up', version: '0.1.0', uptime: 1 })],
];

function sessionResponse(user: UserDto | null): Response {
  return user ? jsonResponse({ user }) : jsonResponse({ code: 'unauthorized' }, 401);
}

function authRoute({ url, options }: RouteContext): Response | null {
  const user = options.user ?? null;

  if (url.endsWith('/auth/refresh') || url.endsWith('/me')) return sessionResponse(user);

  if (url.endsWith('/auth/login')) {
    return jsonResponse(options.loginBody ?? { user: demoUser }, options.loginStatus ?? 200);
  }

  if (url.endsWith('/auth/register')) {
    return jsonResponse(
      options.registerBody ?? { status: 'accepted', emailVerificationRequired: true },
      202,
    );
  }

  return null;
}

function listingId(url: string): string {
  return url.split('/listings/')[1]?.split('/')[0] ?? demoListing.id;
}

function currentListing(store: ListingDto[], url: string): ListingDto {
  return store.find((listing) => listing.id === listingId(url)) ?? demoListing;
}

// eslint-disable-next-line complexity -- мини-API тестов маршрутизирует десяток эндпоинтов.
function listingGetRoute({ url, method, options }: RouteContext): Response | null {
  if (method !== 'GET') return null;
  if (url.endsWith('/me/listings')) return null;
  if (url.includes('/cities')) return jsonResponse({ cities: ['Суздаль', 'Кострома'] });
  if (url.endsWith('/amenities')) return jsonResponse({ amenities: demoAmenities });
  if (url.includes('/calendar/host')) {
    return jsonResponse(demoHostCalendar(listingId(url), url));
  }
  if (url.includes('/calendar?')) return jsonResponse(demoCalendar(listingId(url)));
  if (url.includes('/quote?')) return jsonResponse({ quote: demoQuote(url) });
  if (url.includes('/price-rules')) {
    return jsonResponse({ priceRules: options.priceRules ?? [] });
  }
  if (url.includes('/blocks')) return jsonResponse({ blocks: options.blocks ?? [] });
  if (url.includes('/listings?')) {
    return jsonResponse({
      listings: options.catalogListings ?? [demoPublicListing],
      nextCursor: null,
    });
  }
  if (/\/listings\/[^/?]+$/.test(url)) {
    if (options.catalogDetail === null) return jsonResponse({ code: 'listing_not_found' }, 404);
    return jsonResponse({ listing: options.catalogDetail ?? demoPublicDetail });
  }
  return null;
}

function priceRuleFrom(url: string, init: RequestInit | undefined): PriceRuleDto {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  const ruleId = url.split('/price-rules/')[1] ?? 'rule-1';

  return {
    id: ruleId,
    listingId: listingId(url),
    name: String(body.name ?? 'Высокий сезон'),
    dateFrom: String(body.dateFrom ?? addDays(todayLocalIso(), 10)),
    dateTo: String(body.dateTo ?? addDays(todayLocalIso(), 20)),
    nightlyPriceMinor: Number(body.nightlyPriceMinor ?? 900_000),
    minNights:
      body.minNights === undefined || body.minNights === null ? null : Number(body.minNights),
    priority: Number(body.priority ?? 0),
    createdAt: '2026-10-19T10:00:00.000Z',
  };
}

function blockFrom(url: string, init: RequestInit | undefined): BlockDto {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

  return {
    id: 'block-1',
    listingId: listingId(url),
    dateFrom: String(body.dateFrom ?? addDays(todayLocalIso(), 1)),
    dateTo: String(body.dateTo ?? addDays(todayLocalIso(), 2)),
    reason: typeof body.reason === 'string' ? body.reason : null,
    createdAt: '2026-10-19T10:00:00.000Z',
  };
}

function listingPostRoute({ url, init, store, options }: RouteContext): Response | null {
  if (url.includes('/price-rules')) {
    return jsonResponse({ priceRule: priceRuleFrom(url, init) }, 201);
  }

  if (url.includes('/blocks')) {
    return jsonResponse({ block: blockFrom(url, init) }, 201);
  }

  if (url.endsWith('/listings')) {
    const listing = { ...demoListing, id: `listing-${store.length + 1}` };
    store.unshift(listing);
    return jsonResponse({ listing }, 201);
  }

  if (url.endsWith('/publish')) {
    if (options.publishBody) {
      return jsonResponse(options.publishBody, options.publishStatus ?? 422);
    }
    return jsonResponse({ listing: { ...demoListing, status: 'published' } });
  }

  if (url.endsWith('/archive')) {
    return jsonResponse({ listing: { ...demoListing, status: 'archived' } });
  }

  return null;
}

function listingPatchRoute({ url, init, store }: RouteContext): Response | null {
  if (!url.includes('/listings/')) return null;

  const current = currentListing(store, url);
  if (init?.body) Object.assign(current, JSON.parse(String(init.body)) as Partial<ListingDto>);
  return jsonResponse({ listing: current });
}

function listingsRoute(ctx: RouteContext): Response | null {
  if (ctx.url.endsWith('/me/listings')) return jsonResponse({ listings: ctx.store });

  if (ctx.method === 'GET') return listingGetRoute(ctx);
  if (ctx.method === 'POST') return listingPostRoute(ctx);
  if (ctx.method === 'PUT') return jsonResponse({ listing: ctx.store[0] ?? demoListing });
  if (ctx.method === 'PATCH' && ctx.url.includes('/price-rules/')) {
    return jsonResponse({ priceRule: priceRuleFrom(ctx.url, ctx.init) });
  }
  if (ctx.method === 'PATCH') return listingPatchRoute(ctx);
  if (ctx.method === 'DELETE') return new Response(null, { status: 204 });

  return null;
}

function bookingStatusAfter(
  action: string,
  current: BookingDetail['status'],
): BookingDetail['status'] {
  if (action === 'confirm') return 'confirmed';
  if (action === 'decline') return 'declined';
  return current === 'confirmed' ? 'cancelled_by_host' : 'cancelled_by_guest';
}

function bookingActionRoute(
  url: string,
  action: string,
  details: Map<string, BookingDetail>,
): Response {
  const id = url.split('/bookings/')[1]?.split('/')[0] ?? '';
  const current = details.get(id) ?? demoBookingDetail();
  const next: BookingDetail = {
    ...current,
    status: bookingStatusAfter(action, current.status),
    updatedAt: '2026-10-19T11:00:00.000Z',
    events: [
      ...current.events,
      {
        id: String(current.events.length + 1),
        actorRole: 'host',
        fromStatus: current.status,
        toStatus: bookingStatusAfter(action, current.status),
        note: null,
        createdAt: '2026-10-19T11:00:00.000Z',
      },
    ],
  };
  details.set(next.id, next);
  return jsonResponse({ booking: next });
}

function bookingCreateRoute(
  ctx: RouteContext,
  details: Map<string, BookingDetail>,
): Response | null {
  const { url, method, options } = ctx;
  if (method !== 'POST' || !url.endsWith('/bookings')) return null;

  if (options.bookingCreateStatus && options.bookingCreateStatus >= 400) {
    return jsonResponse(
      options.bookingCreateBody ?? { code: 'booking_dates_unavailable' },
      options.bookingCreateStatus,
    );
  }

  const detail = options.bookingDetail ?? demoBookingDetail();
  details.set(detail.id, detail);
  return jsonResponse({ booking: detail }, 201);
}

function bookingDetailRoute(
  ctx: RouteContext,
  details: Map<string, BookingDetail>,
): Response | null {
  const match = /\/bookings\/([^/?]+)$/.exec(ctx.url);
  if (ctx.method !== 'GET' || !match?.[1]) return null;

  const detail = details.get(match[1]) ?? ctx.options.bookingDetail ?? demoBookingDetail();
  return jsonResponse({ booking: detail });
}

function bookingsRoute(ctx: RouteContext, details: Map<string, BookingDetail>): Response | null {
  const { url, method, options } = ctx;

  if (url.includes('/me/bookings')) {
    return jsonResponse({
      bookings: options.bookings ?? [...details.values()],
      nextCursor: null,
    });
  }

  const create = bookingCreateRoute(ctx, details);
  if (create) return create;

  const action = method === 'POST' ? /\/(confirm|decline|cancel)$/.exec(url)?.[1] : undefined;
  if (action) return bookingActionRoute(url, action, details);

  return bookingDetailRoute(ctx, details);
}

function notificationsRoute({ url, method, options }: RouteContext): Response | null {
  if (url.includes('/me/push/config')) {
    return jsonResponse({
      enabled: options.pushEnabled ?? false,
      publicKey: options.pushEnabled ? 'test-public-key' : null,
    });
  }

  if (url.includes('/me/push-subscriptions')) {
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(
      {
        subscription: {
          id: 'f2f7e8d1-4f1a-4c6e-9a0b-1c2d3e4f5a6c',
          endpoint: 'https://push.example.test/mock',
          createdAt: '2026-10-20T10:00:00.000Z',
        },
      },
      201,
    );
  }

  if (url.endsWith('/me/notifications/read')) {
    const unreadCount = options.unreadCount ?? 0;
    return jsonResponse({ updated: 0, unreadCount });
  }

  if (url.includes('/me/notifications')) {
    const notifications = options.notifications ?? [];
    return jsonResponse({
      notifications,
      unreadCount: options.unreadCount ?? notifications.filter((item) => !item.readAt).length,
      nextCursor: null,
    });
  }

  return null;
}

function route(ctx: RouteContext, details: Map<string, BookingDetail>): Response {
  const auth = authRoute(ctx);
  if (auth) return auth;

  const notifications = notificationsRoute(ctx);
  if (notifications) return notifications;

  const booking = bookingsRoute(ctx, details);
  if (booking) return booking;

  const listing = listingsRoute(ctx);
  if (listing) return listing;

  const simple = SIMPLE_ROUTES.find(([suffix]) => ctx.url.endsWith(suffix));
  return simple ? simple[1]() : jsonResponse({ code: 'not_found' }, 404);
}

/**
 * Мини-API для тестов: /me и refresh отвечают 401, пока user не задан.
 * Логин по умолчанию успешен и возвращает demoUser.
 */
export function mockApi(options: ApiMockOptions = {}): ReturnType<typeof vi.fn> {
  const store = [...(options.listings ?? [])];
  const details = new Map<string, BookingDetail>();
  for (const booking of options.bookings ?? []) {
    details.set(booking.id, { ...demoBookingDetail(booking.status), ...booking });
  }
  if (options.bookingDetail) details.set(options.bookingDetail.id, options.bookingDetail);

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    options.onRequest?.(String(input), init);
    if (options.pendingHostCalendar && String(input).includes('/calendar/host')) {
      return new Promise<Response>(() => undefined);
    }
    const method = (init?.method ?? 'GET').toUpperCase();
    return Promise.resolve(route({ url: String(input), method, init, store, options }, details));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
