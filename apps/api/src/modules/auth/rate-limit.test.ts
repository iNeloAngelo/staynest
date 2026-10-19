import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from './rate-limit';
import { LoginThrottle, progressiveDelayMs } from './throttle';

describe('FixedWindowRateLimiter', () => {
  it('пропускает в пределах лимита и отклоняет сверх него', () => {
    const now = 0;
    const limiter = new FixedWindowRateLimiter(() => now);
    const rule = { max: 2, windowMs: 60_000 };

    expect(limiter.check('ip:1', rule)).toEqual({ allowed: true });
    expect(limiter.check('ip:1', rule)).toEqual({ allowed: true });

    const denied = limiter.check('ip:1', rule);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.retryAfterSeconds).toBe(60);
  });

  it('сбрасывает счётчик после окна', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(() => now);
    const rule = { max: 1, windowMs: 1_000 };

    expect(limiter.check('ip:1', rule).allowed).toBe(true);
    expect(limiter.check('ip:1', rule).allowed).toBe(false);

    now = 1_000;
    expect(limiter.check('ip:1', rule).allowed).toBe(true);
  });

  it('считает разные ключи независимо', () => {
    const limiter = new FixedWindowRateLimiter();
    const rule = { max: 1, windowMs: 60_000 };

    expect(limiter.check('ip:1', rule).allowed).toBe(true);
    expect(limiter.check('ip:2', rule).allowed).toBe(true);
    expect(limiter.check('ip:1', rule).allowed).toBe(false);
  });
});

describe('LoginThrottle', () => {
  it('наращивает задержку после третьей неудачи и сбрасывается', () => {
    const throttle = new LoginThrottle(() => 0);

    expect(throttle.recordFailure('user@example.ru')).toBe(1);
    expect(throttle.recordFailure('user@example.ru')).toBe(2);
    expect(throttle.recordFailure('user@example.ru')).toBe(3);
    expect(progressiveDelayMs(3)).toBe(200);
    expect(progressiveDelayMs(4)).toBe(400);
    expect(progressiveDelayMs(10)).toBe(3_000);

    throttle.reset('user@example.ru');
    expect(throttle.recordFailure('user@example.ru')).toBe(1);
  });
});
