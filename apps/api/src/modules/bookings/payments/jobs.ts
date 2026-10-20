import type { Logger } from 'pino';
import type { AppConfig } from '../../../platform/config/index';
import type { Db } from '../../../platform/db/index';
import type { EventBus } from '../../../platform/events/index';
import { createPaymentRuntime } from './context';
import { createDepositService } from './service';

export type PaymentJobsDependencies = {
  db: Db;
  config: AppConfig;
  events: EventBus;
  logger: Logger;
  now?: () => Date;
};

const BATCHES_PER_RUN = 10;

export function createPaymentJobs(dependencies: PaymentJobsDependencies) {
  const { db, config, events, logger } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const service = createDepositService(createPaymentRuntime({ db, config, now }));

  return {
    /** confirmed с истёкшим deposit_due_at → expired, открытые платежи → failed. */
    async expireDeposits(at: Date = now()): Promise<number> {
      let total = 0;

      for (let batch = 0; batch < BATCHES_PER_RUN; batch += 1) {
        // Сервис берёт до 100 строк за транзакцию; повторяем, если пачка полная.
        const payloads = await service.expireUnpaid(at);
        for (const payload of payloads) events.publish('booking.deposit_expired', payload);
        total += payloads.length;
        if (payloads.length < 100) break;
      }

      if (total > 0) logger.info({ count: total }, 'deposits expired');
      return total;
    },
  };
}
