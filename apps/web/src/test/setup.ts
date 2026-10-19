import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setLocale } from '../shared/i18n';

beforeEach(() => {
  window.localStorage.clear();
  setLocale('ru');
});

afterEach(() => {
  cleanup();
});
