const FAILURE_WINDOW_MS = 15 * 60_000;
const THRESHOLD = 3;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 3_000;
const MAX_KEYS = 5_000;

/**
 * Прогрессивная задержка вместо блокировки аккаунта: после третьей неудачи
 * ответ замедляется экспоненциально до 3 секунд. Блокировка позволила бы
 * злоумышленнику вывести чужой аккаунт из строя.
 */
export function progressiveDelayMs(failures: number): number {
  if (failures < THRESHOLD) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (failures - THRESHOLD), MAX_DELAY_MS);
}

type FailureEntry = {
  count: number;
  updatedAt: number;
};

export class LoginThrottle {
  private readonly failures = new Map<string, FailureEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  recordFailure(key: string): number {
    const now = this.now();
    this.prune(now);

    const entry = this.failures.get(key);
    if (!entry || now - entry.updatedAt > FAILURE_WINDOW_MS) {
      this.failures.set(key, { count: 1, updatedAt: now });
      return 1;
    }

    entry.count += 1;
    entry.updatedAt = now;
    return entry.count;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private prune(now: number): void {
    if (this.failures.size < MAX_KEYS) return;
    for (const [key, entry] of this.failures) {
      if (now - entry.updatedAt > FAILURE_WINDOW_MS) this.failures.delete(key);
    }
  }
}
