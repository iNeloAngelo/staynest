import { z } from 'zod';

/** Микросекунды Postgres: `toISOString()` их теряет и ломает границу страницы. */
const preciseTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/);

const favoritesCursorSchema = z.object({
  v: z.literal(1),
  createdAt: preciseTimestampSchema,
  listingId: z.uuid(),
});

export type FavoritesCursor = z.infer<typeof favoritesCursorSchema>;

export function encodeFavoritesCursor(cursor: FavoritesCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeFavoritesCursor(value: string): FavoritesCursor | null {
  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = favoritesCursorSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
