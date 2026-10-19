import { z } from 'zod';
import { invalidBookingCursor } from './errors';

const PRECISE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/;

/**
 * Проверяем не только форму, но и реальность даты: `2026-99-99T99:99:99Z`
 * иначе доедет до `::timestamptz` и даст 500 вместо 400.
 */
function isPreciseTimestamp(value: string): boolean {
  const match = PRECISE_TIMESTAMP.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millis = Number((match[7] ?? '').padEnd(3, '0').slice(0, 3));

  if (year < 2000 || year > 2100) return false;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

const cursorSchema = z
  .object({
    v: z.literal(1),
    createdAt: z.string().refine(isPreciseTimestamp),
    id: z.uuid(),
  })
  .strict();

export type BookingCursor = z.infer<typeof cursorSchema>;

export function encodeBookingCursor(cursor: BookingCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeBookingCursor(value: string): BookingCursor {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString()));
    if (parsed.success) return parsed.data;
  } catch {
    // Ниже отдаём единый 400: содержимое курсора клиенту не показываем.
  }

  throw invalidBookingCursor();
}
