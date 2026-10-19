import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setLocale } from '../shared/i18n';

// Ленивые маршруты (календарь, мастер, каталог) в jsdom грузятся дольше секунды.
configure({ asyncUtilTimeout: 10_000 });

beforeEach(() => {
  window.localStorage.clear();
  setLocale('ru');
});

afterEach(() => {
  cleanup();
});
