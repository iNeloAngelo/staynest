import type { CatalogSort } from '@staynest/shared';
import { z } from 'zod';

const baseCursorSchema = z.object({
  v: z.literal(1),
  id: z.uuid(),
});

const priceBaseSchema = baseCursorSchema.extend({
  price: z.number().int().nonnegative(),
});

/** Микросекунды Postgres: toISOString() их теряет и ломает границу страницы. */
const preciseTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/);

const relevanceCursorSchema = baseCursorSchema.extend({
  sort: z.literal('relevance'),
  query: z.string().min(1),
  rank: z.number().finite(),
  publishedAt: preciseTimestampSchema,
});

const newestCursorSchema = baseCursorSchema.extend({
  sort: z.literal('newest'),
  publishedAt: preciseTimestampSchema,
});

const cursorSchema = z.discriminatedUnion('sort', [
  newestCursorSchema,
  priceBaseSchema.extend({ sort: z.literal('price_asc') }),
  priceBaseSchema.extend({ sort: z.literal('price_desc') }),
  relevanceCursorSchema,
]);

export type CatalogCursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value: string, sort: CatalogSort): CatalogCursor | null {
  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = cursorSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.sort !== sort) return null;

    return parsed.data;
  } catch {
    return null;
  }
}

/** Сортировка по релевантности имеет смысл только при текстовом запросе. */
export function resolveSort(sort: CatalogSort | undefined, q: string | undefined): CatalogSort {
  if (!sort) return q ? 'relevance' : 'newest';
  if (sort === 'relevance' && !q) return 'newest';
  return sort;
}
