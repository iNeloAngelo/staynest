import type { AppConfig } from '../../../platform/config/index';
import type { Db } from '../../../platform/db/index';

export type PaymentRuntime = {
  db: Db;
  config: AppConfig;
  now: () => Date;
};

export type PaymentServiceDependencies = {
  db: Db;
  config: AppConfig;
  now?: () => Date;
};

export function createPaymentRuntime({
  db,
  config,
  now,
}: PaymentServiceDependencies): PaymentRuntime {
  return { db, config, now: now ?? (() => new Date()) };
}
