import { todayInTimeZone } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { EventBus } from '../../platform/events/index';
import { FixedWindowRateLimiter } from '../../platform/http/rate-limit';
import type { RateLimitRule } from '../../platform/http/rate-limit';
import { bookingRateLimited } from './errors';

export type BookingOptions = {
  requestTtlHours?: number;
  maxActivePending?: number;
  rateLimit?: RateLimitRule;
  now?: () => Date;
};

export type BookingServiceDependencies = {
  db: Db;
  config: AppConfig;
  events: EventBus;
  options?: BookingOptions;
};

export type BookingRuntime = {
  db: Db;
  config: AppConfig;
  events: EventBus;
  requestTtlHours: number;
  maxActivePending: number;
  rateLimit: RateLimitRule;
  now: () => Date;
  limiter: FixedWindowRateLimiter;
};

export function createBookingRuntime({
  db,
  config,
  events,
  options = {},
}: BookingServiceDependencies): BookingRuntime {
  const now = options.now ?? (() => new Date());

  return {
    db,
    config,
    events,
    requestTtlHours: options.requestTtlHours ?? config.booking.requestTtlHours,
    maxActivePending: options.maxActivePending ?? config.booking.maxActivePending,
    rateLimit: options.rateLimit ?? config.booking.rateLimit,
    now,
    limiter: new FixedWindowRateLimiter(() => now().getTime()),
  };
}

export function todayOf(runtime: BookingRuntime): string {
  return todayInTimeZone(runtime.config.listingTimeZone, runtime.now());
}

export function enforceBookingRateLimit(runtime: BookingRuntime, userId: string): void {
  const decision = runtime.limiter.check(`booking:${userId}`, runtime.rateLimit);
  if (!decision.allowed) throw bookingRateLimited(decision.retryAfterSeconds);
}
