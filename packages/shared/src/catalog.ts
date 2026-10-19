import { z } from 'zod';
import { nightsBetween } from './dates';
import { amenityDtoSchema, listingTypeSchema } from './listings';
import { listingPhotoDtoSchema } from './photos';
import { isoDateSchema, MAX_QUOTE_NIGHTS } from './pricing';
import { stayPriceSchema } from './stay-price';

export const CATALOG_DEFAULT_LIMIT = 24;
export const CATALOG_MAX_LIMIT = 48;
export const CATALOG_CITY_SUGGESTIONS_LIMIT = 8;

export const catalogSortSchema = z.enum(['newest', 'price_asc', 'price_desc', 'relevance']);

/** Повторяющиеся параметры (`type=a&type=b`) и запись через запятую дают один массив. */
function csvList<T extends z.ZodType>(item: T, max: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') return undefined;

      const parts = (Array.isArray(value) ? value : [value])
        .flatMap((entry) => String(entry).split(','))
        .map((entry) => entry.trim())
        .filter(Boolean);

      return parts.length > 0 ? [...new Set(parts)] : undefined;
    },
    z
      .array(item)
      .max(max)
      .transform((items) => [...new Set(items)])
      .optional(),
  );
}

/** ТЗ использует snake_case и `type[]`, web — camelCase. Принимаем оба варианта. */
const QUERY_ALIASES: Record<string, string> = {
  price_min: 'priceMin',
  price_max: 'priceMax',
  bedrooms_min: 'bedroomsMin',
  check_in: 'checkIn',
  check_out: 'checkOut',
  'type[]': 'type',
  'amenities[]': 'amenities',
};

function normalizeQuery(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;

  const source = { ...(input as Record<string, unknown>) };

  for (const [alias, target] of Object.entries(QUERY_ALIASES)) {
    if (source[target] === undefined && source[alias] !== undefined) source[target] = source[alias];
    delete source[alias];
  }

  return source;
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const catalogQuerySchema = z.preprocess(
  normalizeQuery,
  z
    .object({
      q: optionalText(120),
      city: optionalText(120),
      checkIn: isoDateSchema.optional(),
      checkOut: isoDateSchema.optional(),
      guests: z.coerce.number().int().min(1).max(30).optional(),
      priceMin: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
      priceMax: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
      bedroomsMin: z.coerce.number().int().min(0).max(20).optional(),
      type: csvList(listingTypeSchema, 5),
      amenities: csvList(z.coerce.number().int().positive().max(32_767), 20),
      sort: catalogSortSchema.optional(),
      cursor: z.string().min(1).max(1024).optional(),
      limit: z.coerce.number().int().min(1).max(CATALOG_MAX_LIMIT).default(CATALOG_DEFAULT_LIMIT),
    })
    .refine((value) => (value.checkIn === undefined) === (value.checkOut === undefined), {
      path: ['checkIn'],
      message: 'Для поиска по датам укажите и заезд, и выезд.',
    })
    .refine(
      (value) =>
        value.checkIn === undefined ||
        value.checkOut === undefined ||
        value.checkOut > value.checkIn,
      {
        path: ['checkOut'],
        message: 'Дата выезда должна быть позже даты заезда.',
      },
    )
    .refine(
      (value) =>
        value.checkIn === undefined ||
        value.checkOut === undefined ||
        value.checkOut <= value.checkIn ||
        nightsBetween(value.checkIn, value.checkOut) <= MAX_QUOTE_NIGHTS,
      {
        path: ['checkOut'],
        message: `Максимальный срок поиска — ${MAX_QUOTE_NIGHTS} ночей.`,
      },
    ),
);

export const citySuggestionsQuerySchema = z.object({
  q: optionalText(80),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CATALOG_CITY_SUGGESTIONS_LIMIT)
    .default(CATALOG_CITY_SUGGESTIONS_LIMIT),
});

/**
 * Публичная карточка в списке: только то, что можно раскрывать анониму.
 * Точный адрес и точные координаты сюда не попадают (DB.md, раздел 5).
 */
export const publicListingSummarySchema = z.object({
  id: z.uuid(),
  type: listingTypeSchema,
  title: z.string(),
  country: z.string(),
  region: z.string().nullable(),
  city: z.string(),
  approxLat: z.number().nullable(),
  approxLng: z.number().nullable(),
  maxGuests: z.number().int(),
  bedrooms: z.number().int(),
  beds: z.number().int(),
  bathrooms: z.number().int(),
  areaSqm: z.number().int().nullable(),
  basePriceMinor: z.number().int(),
  weekendPriceMinor: z.number().int().nullable(),
  cleaningFeeMinor: z.number().int(),
  currency: z.string(),
  minNights: z.number().int(),
  maxNights: z.number().int(),
  coverPhoto: listingPhotoDtoSchema.nullable(),
  photoCount: z.number().int(),
  /** Итог за выбранный период; `null`, если даты не переданы. */
  stayPrice: stayPriceSchema.nullable(),
  publishedAt: z.iso.datetime(),
});

export const publicListingSchema = publicListingSummarySchema.extend({
  description: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  houseRules: z.string().nullable(),
  photos: z.array(listingPhotoDtoSchema),
  amenities: z.array(amenityDtoSchema),
});

export const publicListingsResponseSchema = z.object({
  listings: z.array(publicListingSummarySchema),
  nextCursor: z.string().nullable(),
});

export const publicListingResponseSchema = z.object({ listing: publicListingSchema });

export const citySuggestionsResponseSchema = z.object({ cities: z.array(z.string()) });

export type CatalogSort = z.infer<typeof catalogSortSchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type CitySuggestionsQuery = z.infer<typeof citySuggestionsQuerySchema>;
export type PublicListingSummary = z.infer<typeof publicListingSummarySchema>;
export type PublicListing = z.infer<typeof publicListingSchema>;
export type PublicListingsResponse = z.infer<typeof publicListingsResponseSchema>;
export type PublicListingResponse = z.infer<typeof publicListingResponseSchema>;
export type CitySuggestionsResponse = z.infer<typeof citySuggestionsResponseSchema>;
