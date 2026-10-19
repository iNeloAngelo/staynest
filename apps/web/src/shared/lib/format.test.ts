import { describe, expect, it } from 'vitest';
import { formatMoney, inputToMinor, minorToInput } from './format';

describe('money helpers', () => {
  it('переводит рубли в копейки и обратно', () => {
    expect(inputToMinor('7500')).toBe(750_000);
    expect(inputToMinor('7500,5')).toBe(750_050);
    expect(minorToInput(750_000)).toBe('7500');
    expect(minorToInput(null)).toBe('');
  });

  it('форматирует рубли без копеек и с копейками', () => {
    expect(formatMoney(750_000, 'ru')).toContain('7');
    expect(formatMoney(750_050, 'ru')).toContain(',50');
  });

  it('не роняет экран из-за неизвестной валюты в старых данных', () => {
    expect(formatMoney(650_000, 'ru', '123')).toContain('6');
  });
});
