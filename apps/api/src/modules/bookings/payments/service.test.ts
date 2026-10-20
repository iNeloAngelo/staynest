import { describe, expect, it } from 'vitest';
import { depositAmountMinor, depositDueAt } from './service';

describe('депозит', () => {
  it('считает процент и округляет вверх до копейки', () => {
    expect(depositAmountMinor(100_000, 20)).toBe(20_000);
    expect(depositAmountMinor(33_333, 20)).toBe(6_667);
    expect(depositAmountMinor(1, 20)).toBe(1);
    expect(depositAmountMinor(100_000, 0)).toBeNull();
    expect(depositAmountMinor(0, 20)).toBeNull();
  });

  it('ставит срок ровно через TTL часов', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    expect(depositDueAt(48, now).toISOString()).toBe('2026-10-22T12:00:00.000Z');
  });
});
