import { z } from 'zod';

/** Исходный файл до обработки: 10 МБ (FR-L3). */
export const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Сколько фото допускается у одного объявления. */
export const MAX_PHOTOS_PER_LISTING = 20;
/** Сколько файлов можно отправить одним multipart-запросом. */
export const MAX_PHOTOS_PER_UPLOAD = 10;

export const photoVariantSchema = z.object({
  thumb: z.string(),
  md: z.string(),
  lg: z.string(),
});

export const listingPhotoDtoSchema = z.object({
  id: z.uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurhash: z.string().nullable(),
  position: z.number().int().min(0),
  isCover: z.boolean(),
  urls: photoVariantSchema,
});

export const updatePhotoOrderInputSchema = z
  .object({
    photoIds: z
      .array(z.uuid())
      .max(MAX_PHOTOS_PER_LISTING)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Фото не должны повторяться.',
      }),
  })
  .strict();

export const listingPhotosResponseSchema = z.object({
  photos: z.array(listingPhotoDtoSchema),
});

export type PhotoVariants = z.infer<typeof photoVariantSchema>;
export type ListingPhotoDto = z.infer<typeof listingPhotoDtoSchema>;
export type UpdatePhotoOrderInput = z.infer<typeof updatePhotoOrderInputSchema>;
export type ListingPhotosResponse = z.infer<typeof listingPhotosResponseSchema>;
