import type { Locale } from '@staynest/shared';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { en } from './resources/en';
import { ru } from './resources/ru';

export type { TranslationKey } from './resources/ru';
export { i18n };

const LOCALE_STORAGE_KEY = 'staynest.locale';
const FALLBACK_LOCALE: Locale = 'ru';

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en';
}

function detectLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Приватный режим и заблокированное хранилище не должны ломать приложение.
  }

  return FALLBACK_LOCALE;
}

function applySideEffects(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Язык продолжит работать до перезагрузки.
  }

  document.documentElement.lang = locale;
  z.config(locale === 'en' ? z.locales.en() : z.locales.ru());
}

export function setLocale(locale: Locale): void {
  applySideEffects(locale);
  void i18n.changeLanguage(locale);
}

function initI18n(locale: Locale = detectLocale()): void {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: { ru: { translation: ru }, en: { translation: en } },
      lng: locale,
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: ['ru', 'en'],
      interpolation: { escapeValue: false },
      initAsync: false,
      returnNull: false,
    });
  } else {
    void i18n.changeLanguage(locale);
  }

  applySideEffects(locale);
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { i18n: instance } = useTranslation();
  const locale: Locale = instance.resolvedLanguage === 'en' ? 'en' : 'ru';

  return { locale, setLocale };
}

initI18n();
