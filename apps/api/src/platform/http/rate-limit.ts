export type RateLimitRule = {
  max: number;
  windowMs: number;
};

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

const PRUNE_THRESHOLD = 5_000;

/**
 * Простой счётчик с фиксированным окном в памяти процесса.
 * Подходит для одного инстанса API; при горизонтальном масштабировании
 * лимиты нужно перенести в общее хранилище (см. DECISIONS.md).
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  check(key: string, rule: RateLimitRule): RateLimitDecision {
    const now = this.now();
    this.prune(now);

    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true };
    }

    if (current.count >= rule.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }

    current.count += 1;
    return { allowed: true };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(now: number): void {
    if (this.buckets.size < PRUNE_THRESHOLD) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
