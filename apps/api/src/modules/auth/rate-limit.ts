import type { RateLimitRule } from '../../platform/http/rate-limit';
import { FixedWindowRateLimiter } from '../../platform/http/rate-limit';

export { FixedWindowRateLimiter };
export type { RateLimitRule } from '../../platform/http/rate-limit';

export type AuthRateLimits = {
  loginIp: RateLimitRule;
  loginEmail: RateLimitRule;
  registerIp: RateLimitRule;
  registerEmail: RateLimitRule;
  resetIp: RateLimitRule;
  resetEmail: RateLimitRule;
  resendIp: RateLimitRule;
  resendEmail: RateLimitRule;
  changePasswordIp: RateLimitRule;
};

const MINUTE = 60_000;

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  loginIp: { max: 20, windowMs: 15 * MINUTE },
  loginEmail: { max: 5, windowMs: 15 * MINUTE },
  registerIp: { max: 10, windowMs: 60 * MINUTE },
  registerEmail: { max: 3, windowMs: 60 * MINUTE },
  resetIp: { max: 10, windowMs: 60 * MINUTE },
  resetEmail: { max: 3, windowMs: 60 * MINUTE },
  resendIp: { max: 10, windowMs: 60 * MINUTE },
  resendEmail: { max: 3, windowMs: 30 * MINUTE },
  changePasswordIp: { max: 20, windowMs: 15 * MINUTE },
};
