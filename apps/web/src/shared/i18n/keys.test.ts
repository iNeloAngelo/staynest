import { describe, expect, it } from 'vitest';
import { en } from './resources/en';
import { ru } from './resources/ru';

const sources = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/*.test.{ts,tsx}'], {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function literalKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? '').sort();
}

describe('i18n-ключи', () => {
  it('не содержит литеральных ключей, которых нет в словарях', () => {
    const missing = new Set<string>();

    for (const source of Object.values(sources)) {
      for (const key of literalKeys(source)) {
        const exists =
          key in ru ||
          `${key}_one` in ru ||
          `${key}_few` in ru ||
          `${key}_many` in ru ||
          `${key}_other` in ru;
        if (!exists) missing.add(key);
      }
    }

    expect([...missing].sort()).toEqual([]);
  });

  it('английский словарь не содержит пустых строк', () => {
    const empty = Object.entries(en)
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it('одинаковые placeholders в русском и английском вариантах', () => {
    const mismatched = Object.keys(ru).filter((key) => {
      const sourceKey = key as keyof typeof ru;
      const target = key as keyof typeof en;
      if (!(target in en)) return false;
      return placeholders(ru[sourceKey]).join(',') !== placeholders(en[target]).join(',');
    });

    expect(mismatched).toEqual([]);
  });
});
