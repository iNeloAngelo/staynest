const VISITS_KEY = 'staynest:pwa-visits';
const VISIT_SESSION_KEY = 'staynest:pwa-visit-counted';
const DISMISSED_KEY = 'staynest:pwa-install-dismissed';
const ELIGIBLE_KEY = 'staynest:pwa-install-eligible';

const DISMISS_DAYS = 30;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;
const MIN_VISITS = 2;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Приватный режим может запрещать localStorage: баннер просто не покажется.
  }
}

function readNumber(key: string): number {
  const raw = read(key);
  const value = raw === null ? 0 : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Второй визит в приложение, а не второй переход внутри одной сессии. */
export function countVisit(): number {
  try {
    if (window.sessionStorage.getItem(VISIT_SESSION_KEY) === '1') return readNumber(VISITS_KEY);

    window.sessionStorage.setItem(VISIT_SESSION_KEY, '1');
  } catch {
    // Без sessionStorage считаем каждый монтированный макет визитом.
  }

  const visits = readNumber(VISITS_KEY) + 1;
  write(VISITS_KEY, String(visits));
  return visits;
}

/** Успешная заявка — достаточный повод предложить установку уже на первом визите. */
export function markInstallEligible(): void {
  write(ELIGIBLE_KEY, '1');
}

export function dismissInstall(now = Date.now()): void {
  write(DISMISSED_KEY, String(now));
}

export function isInstallDismissed(now = Date.now()): boolean {
  const dismissedAt = readNumber(DISMISSED_KEY);
  return dismissedAt > 0 && now - dismissedAt < DISMISS_MS;
}

export function shouldOfferInstall(visits: number): boolean {
  return read(ELIGIBLE_KEY) === '1' || visits >= MIN_VISITS;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia?.('(display-mode: standalone)');
  return (
    Boolean(media?.matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(userAgent);
  // iPadOS 13+ притворяется macOS, но имеет touch-события.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export const installStorageKeys = {
  visits: VISITS_KEY,
  dismissed: DISMISSED_KEY,
  eligible: ELIGIBLE_KEY,
} as const;
