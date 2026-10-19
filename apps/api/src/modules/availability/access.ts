import { eachNight } from '@staynest/shared';
import type { DbExecutor } from '../../platform/db/index';
import { listAvailabilityRanges } from './repo';
import type { AvailabilityRange } from './repo';

type UnavailableNight = { date: string; kind: 'booked' | 'blocked' };

function unavailableNights(
  ranges: AvailabilityRange[],
  from: string,
  to: string,
): UnavailableNight[] {
  const nights = new Map<string, 'booked' | 'blocked'>();

  for (const range of ranges) {
    // Не разворачиваем весь диапазон блокировки: только пересечение с окном.
    const start = range.from > from ? range.from : from;
    const end = range.to < to ? range.to : to;
    if (start >= end) continue;

    for (const date of eachNight(start, end)) {
      // Занятая бронь важнее блокировки для объяснения пользователю.
      if (range.kind === 'booked' || !nights.has(date)) nights.set(date, range.kind);
    }
  }

  return [...nights.entries()]
    .map(([date, kind]) => ({ date, kind }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function loadUnavailableNights(
  executor: DbExecutor,
  listingId: string,
  from: string,
  to: string,
): Promise<UnavailableNight[]> {
  return unavailableNights(await listAvailabilityRanges(executor, listingId, from, to), from, to);
}
