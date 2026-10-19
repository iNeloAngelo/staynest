import { describe, expect, it } from 'vitest';
import { i18n, setLocale } from './index';

describe('i18n', () => {
  it('переключает язык, lang документа и localStorage', () => {
    setLocale('en');

    expect(i18n.t('auth.login.submit')).toBe('Log in');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('staynest.locale')).toBe('en');

    setLocale('ru');

    expect(i18n.t('auth.login.submit')).toBe('Войти');
    expect(document.documentElement.lang).toBe('ru');
    expect(window.localStorage.getItem('staynest.locale')).toBe('ru');
  });

  it('держит одинаковый набор ключей в ru и en', async () => {
    const { ru } = await import('./resources/ru');
    const { en } = await import('./resources/en');

    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });
});
