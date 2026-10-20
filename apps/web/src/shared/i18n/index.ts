import type { Locale } from '@staynest/shared';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { ru } from './resources/ru';

export type { TranslationKey } from './resources/ru';
export { i18n };

const LOCALE_STORAGE_KEY = 'staynest.locale';
const FALLBACK_LOCALE: Locale = 'ru';

let englishLoaded = false;
let englishLoading: Promise<void> | null = null;

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

async function loadEnglish(): Promise<void> {
  if (englishLoaded) return;
  if (!englishLoading) {
    englishLoading = import('./resources/en')
      .then(({ en }) => {
        i18n.addResourceBundle('en', 'translation', en, true, true);
        englishLoaded = true;
      })
      .catch((error: unknown) => {
        // Не кэшируем отклонённый промис: следующая попытка снова загрузит чанк.
        englishLoading = null;
        throw error;
      });
  }
  await englishLoading;
}

/** Английский словарь грузится по требованию: он не нужен на первом экране. */
export async function setLocale(locale: Locale): Promise<void> {
  if (locale === 'en') await loadEnglish();
  applySideEffects(locale);
  await i18n.changeLanguage(locale);
}

function initI18n(locale: Locale = detectLocale()): void {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: { ru: { translation: ru } },
      lng: 'ru',
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: ['ru', 'en'],
      interpolation: { escapeValue: false },
      initAsync: false,
      returnNull: false,
    });
  }

  if (locale !== 'en') {
    applySideEffects('ru');
    return;
  }

  // Сохранённый английский применяем только после загрузки словаря,
  // иначе интерфейс и атрибут lang разъедутся при медленной сети.
  void loadEnglish()
    .then(() => {
      applySideEffects('en');
      return i18n.changeLanguage('en');
    })
    .catch(() => applySideEffects('ru'));
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => Promise<void> } {
  const { i18n: instance } = useTranslation();
  const locale: Locale = instance.resolvedLanguage === 'en' ? 'en' : 'ru';

  return { locale, setLocale };
}

initI18n();
