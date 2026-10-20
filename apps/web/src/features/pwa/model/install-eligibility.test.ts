import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countVisit,
  dismissInstall,
  installStorageKeys,
  isInstallDismissed,
  isStandalone,
  markInstallEligible,
  shouldOfferInstall,
} from './install-eligibility';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('установка PWA', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('считает визит один раз за сессию вкладки', () => {
    expect(countVisit()).toBe(1);
    expect(countVisit()).toBe(1);

    window.sessionStorage.clear();
    expect(countVisit()).toBe(2);
  });

  it('предлагает установку со второго визита или после заявки', () => {
    expect(shouldOfferInstall(1)).toBe(false);
    expect(shouldOfferInstall(2)).toBe(true);

    markInstallEligible();
    expect(shouldOfferInstall(1)).toBe(true);
  });

  it('скрывает баннер на 30 дней после «Не сейчас»', () => {
    const now = Date.UTC(2026, 9, 20);
    dismissInstall(now);

    expect(isInstallDismissed(now + DAY_MS)).toBe(true);
    expect(isInstallDismissed(now + 29 * DAY_MS)).toBe(true);
    expect(isInstallDismissed(now + 31 * DAY_MS)).toBe(false);
  });

  it('хранит счётчик визитов под стабильным ключом', () => {
    countVisit();
    expect(window.localStorage.getItem(installStorageKeys.visits)).toBe('1');
  });

  it('определяет standalone-режим по display-mode', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMedia);

    expect(isStandalone()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');

    vi.unstubAllGlobals();
  });
});
