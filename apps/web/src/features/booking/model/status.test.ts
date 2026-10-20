import type { BookingStatus } from '@staynest/shared';
import { describe, expect, it } from 'vitest';
import {
  HOST_TABS,
  TRIP_TABS,
  canGuestCancel,
  hostStatusesOf,
  statusMeta,
  statusesOf,
} from './status';

const ALL_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'declined',
  'cancelled_by_guest',
  'cancelled_by_host',
  'expired',
  'completed',
];

describe('статусы брони', () => {
  it('каждый статус имеет тон, иконку и ключ перевода', () => {
    for (const status of ALL_STATUSES) {
      const meta = statusMeta(status);
      expect(meta.labelKey).toMatch(/^booking\.status\./);
      expect(meta.icon).toBeTruthy();
      expect(meta.tone).toBeTruthy();
    }
  });

  it('вкладки гостя и хозяина покрывают все статусы без дублей', () => {
    for (const tabs of [
      TRIP_TABS.flatMap((tab) => statusesOf(tab)),
      HOST_TABS.flatMap((tab) => hostStatusesOf(tab)),
    ]) {
      expect([...tabs].sort()).toEqual([...ALL_STATUSES].sort());
      expect(new Set(tabs).size).toBe(ALL_STATUSES.length);
    }
  });

  it('гость отменяет pending всегда, confirmed — только до заезда', () => {
    expect(canGuestCancel('pending', '2026-11-10', '2026-11-01')).toBe(true);
    expect(canGuestCancel('confirmed', '2026-11-10', '2026-11-01')).toBe(true);
    expect(canGuestCancel('confirmed', '2026-11-01', '2026-11-01')).toBe(false);
    expect(canGuestCancel('completed', '2026-11-10', '2026-11-01')).toBe(false);
  });
});
