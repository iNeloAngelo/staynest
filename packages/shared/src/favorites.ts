import { z } from 'zod';
import { publicListingSummarySchema } from './catalog';

export const FAVORITES_DEFAULT_LIMIT = 12;
export const FAVORITES_MAX_LIMIT = 48;

export const favoritesQuerySchema = z
  .object({
    cursor: z.string().min(1).max(1024).optional(),
    limit: z.coerce.number().int().min(1).max(FAVORITES_MAX_LIMIT).default(FAVORITES_DEFAULT_LIMIT),
  })
  .strict();

export const favoriteListingParamsSchema = z.object({ listingId: z.uuid() }).strict();

/**
 * Список избранных объявлений с теми же публичными полями, что и каталог:
 * сердечко и страница избранного показывают одну и ту же карточку.
 */
export const favoritesResponseSchema = z.object({
  listings: z.array(publicListingSummarySchema),
  nextCursor: z.string().nullable(),
});

/** Идентификаторы для сердечек: лёгкий запрос, не зависящий от пагинации списка. */
export const favoriteIdsResponseSchema = z.object({ listingIds: z.array(z.uuid()) });

export const favoriteStateResponseSchema = z.object({
  listingId: z.uuid(),
  favorite: z.boolean(),
});

export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>;
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>;
export type FavoriteIdsResponse = z.infer<typeof favoriteIdsResponseSchema>;
export type FavoriteStateResponse = z.infer<typeof favoriteStateResponseSchema>;
