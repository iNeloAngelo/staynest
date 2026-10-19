import type { ListingDto, ListingPhotoDto, UserDto } from '@staynest/shared';
import { vi } from 'vitest';

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
  { id: 1, code: 'wifi', nameRu: 'Wi-Fi', nameEn: 'Wi-Fi', icon: 'wifi', sortOrder: 1 },
  { id: 2, code: 'sauna', nameRu: 'Сауна', nameEn: 'Sauna', icon: 'flame', sortOrder: 2 },
];

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

function listingGetRoute({ url }: RouteContext): Response | null {
  if (url.endsWith('/me/listings')) return null;
  if (url.endsWith('/amenities')) return jsonResponse({ amenities: demoAmenities });
  return null;
}

function listingPostRoute({ url, store, options }: RouteContext): Response | null {
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
  if (ctx.method === 'PATCH') return listingPatchRoute(ctx);
  if (ctx.method === 'DELETE') return new Response(null, { status: 204 });

  return null;
}

function route(ctx: RouteContext): Response {
  const auth = authRoute(ctx);
  if (auth) return auth;

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
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    options.onRequest?.(String(input), init);
    const method = (init?.method ?? 'GET').toUpperCase();
    return Promise.resolve(route({ url: String(input), method, init, store, options }));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
