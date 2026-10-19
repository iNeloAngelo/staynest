import { z } from 'zod';

export const listingTypeSchema = z.enum(['house', 'cottage', 'cabin', 'villa', 'townhouse']);

export const listingStatusSchema = z.enum(['draft', 'published', 'archived']);

export const MAX_LISTING_TITLE = 120;
export const MIN_LISTING_TITLE = 5;
export const MIN_PUBLISHED_DESCRIPTION = 50;
export const MAX_DESCRIPTION = 5000;
export const MIN_PUBLISHED_PHOTOS = 3;
/** Потолок денежных полей: защищает bigint от переполнения и UI от абсурдных сумм. */
export const MAX_MONEY_MINOR = 100_000_000_000;

/** Длина в Unicode code points: PostgreSQL `char_length` считает так же, а JS `.length` — нет. */
export function textLength(value: string): number {
  return Array.from(value).length;
}

const trimmedText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => textLength(value) >= min, message)
    .refine((value) => textLength(value) <= max, message);

/** Пустая строка из формы означает «поле не заполнено», в БД это NULL. */
const nullableText = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    trimmedText(min, max, message).nullable(),
  );

const moneySchema = z.number().int().min(1, 'Цена должна быть больше нуля.').max(MAX_MONEY_MINOR);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время указывается как ЧЧ:ММ.');

export const listingInputSchema = z
  .object({
    title: nullableText(
      MIN_LISTING_TITLE,
      MAX_LISTING_TITLE,
      `Название: от ${MIN_LISTING_TITLE} до ${MAX_LISTING_TITLE} символов.`,
    ).optional(),
    description: z
      .string()
      .trim()
      .refine(
        (value) => textLength(value) <= MAX_DESCRIPTION,
        `Описание не длиннее ${MAX_DESCRIPTION} символов.`,
      )
      .optional(),
    type: listingTypeSchema.optional(),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, 'Код страны — две буквы.')
      .transform((value) => value.toUpperCase())
      .optional(),
    region: nullableText(1, 120, 'Регион не длиннее 120 символов.').optional(),
    city: nullableText(1, 120, 'Город не длиннее 120 символов.').optional(),
    addressLine: nullableText(1, 300, 'Адрес не длиннее 300 символов.').optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    maxGuests: z.number().int().min(1).max(30).nullable().optional(),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    beds: z.number().int().min(1).max(40).nullable().optional(),
    bathrooms: z.number().int().min(0).max(20).optional(),
    areaSqm: z.number().int().min(1).max(2000).nullable().optional(),
    basePriceMinor: moneySchema.nullable().optional(),
    weekendPriceMinor: moneySchema.nullable().optional(),
    cleaningFeeMinor: z.number().int().min(0).max(MAX_MONEY_MINOR).optional(),
    currency: z.enum(['RUB']).optional(),
    minNights: z.number().int().min(1).max(365).optional(),
    maxNights: z.number().int().min(1).max(365).optional(),
    checkInTime: timeSchema.optional(),
    checkOutTime: timeSchema.optional(),
    houseRules: nullableText(1, 2000, 'Правила не длиннее 2000 символов.').optional(),
  })
  .strict();

export const updateListingInputSchema = listingInputSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Нужно передать хотя бы одно поле.' },
);

export const createListingInputSchema = z.object({ type: listingTypeSchema.optional() }).strict();

export const updateListingAmenitiesInputSchema = z
  .object({
    amenityIds: z
      .array(z.number().int().positive())
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Удобства не должны повторяться.',
      }),
  })
  .strict();

export const amenityDtoSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  nameRu: z.string(),
  nameEn: z.string(),
  icon: z.string(),
  sortOrder: z.number().int(),
});

export const listingDtoSchema = z.object({
  id: z.uuid(),
  status: listingStatusSchema,
  type: listingTypeSchema,
  title: z.string().nullable(),
  description: z.string(),
  country: z.string(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  addressLine: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  maxGuests: z.number().int().nullable(),
  bedrooms: z.number().int().nullable(),
  beds: z.number().int().nullable(),
  bathrooms: z.number().int(),
  areaSqm: z.number().int().nullable(),
  basePriceMinor: z.number().int().nullable(),
  weekendPriceMinor: z.number().int().nullable(),
  cleaningFeeMinor: z.number().int(),
  currency: z.string(),
  minNights: z.number().int(),
  maxNights: z.number().int(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  houseRules: z.string().nullable(),
  coverPhotoId: z.uuid().nullable(),
  amenities: z.array(amenityDtoSchema),
  pendingBookingsCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
});

/** Поля, которые мешают публикации; UI переводит коды в подсказки. */
export const listingPublishIssueSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});

export const listingResponseSchema = z.object({ listing: listingDtoSchema });
export const listingsResponseSchema = z.object({ listings: z.array(listingDtoSchema) });
export const amenitiesResponseSchema = z.object({ amenities: z.array(amenityDtoSchema) });

export type ListingType = z.infer<typeof listingTypeSchema>;
export type ListingStatus = z.infer<typeof listingStatusSchema>;
export type ListingInput = z.infer<typeof listingInputSchema>;
export type UpdateListingInput = z.infer<typeof updateListingInputSchema>;
export type CreateListingInput = z.infer<typeof createListingInputSchema>;
export type UpdateListingAmenitiesInput = z.infer<typeof updateListingAmenitiesInputSchema>;
export type AmenityDto = z.infer<typeof amenityDtoSchema>;
export type ListingDto = z.infer<typeof listingDtoSchema>;
export type ListingPublishIssue = z.infer<typeof listingPublishIssueSchema>;
export type ListingResponse = z.infer<typeof listingResponseSchema>;
export type ListingsResponse = z.infer<typeof listingsResponseSchema>;
export type AmenitiesResponse = z.infer<typeof amenitiesResponseSchema>;
