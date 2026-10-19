import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, resolveSort } from './cursor';

const id = '0b6f6f46-6a9d-4f6b-8f4a-4f67f5a1b222';

describe('catalog cursor', () => {
  it('переживает кодирование и декодирование для каждой сортировки', () => {
    const cursors = [
      { v: 1 as const, sort: 'newest' as const, id, publishedAt: '2026-10-19T10:00:00.000Z' },
      {
        v: 1 as const,
        sort: 'newest' as const,
        id,
        publishedAt: '2026-10-19T10:00:00.123456Z',
      },
      { v: 1 as const, sort: 'price_asc' as const, id, price: 750_000 },
      { v: 1 as const, sort: 'price_desc' as const, id, price: 750_000 },
      {
        v: 1 as const,
        sort: 'relevance' as const,
        id,
        query: 'озеро',
        rank: 0.06079271,
        publishedAt: '2026-10-19T10:00:00.000Z',
      },
    ];

    for (const cursor of cursors) {
      expect(decodeCursor(encodeCursor(cursor), cursor.sort)).toEqual(cursor);
    }
  });

  it('отвергает курсор другой сортировки', () => {
    const cursor = encodeCursor({
      v: 1,
      sort: 'price_asc',
      id,
      price: 100,
    });

    expect(decodeCursor(cursor, 'newest')).toBeNull();
  });

  it('отвергает мусор и подделанный id', () => {
    expect(decodeCursor('not-a-cursor', 'newest')).toBeNull();
    expect(
      decodeCursor(
        Buffer.from(
          JSON.stringify({
            v: 1,
            sort: 'newest',
            id: 'x',
            publishedAt: '2026-10-19T10:00:00.000Z',
          }),
        ).toString('base64url'),
        'newest',
      ),
    ).toBeNull();
  });

  it('не включает релевантность без текстового запроса', () => {
    expect(resolveSort(undefined, undefined)).toBe('newest');
    expect(resolveSort(undefined, 'озеро')).toBe('relevance');
    expect(resolveSort('relevance', undefined)).toBe('newest');
    expect(resolveSort('price_asc', 'озеро')).toBe('price_asc');
  });
});
