import { createBookingJobs } from './modules/bookings/index';
import { createNotificationService } from './modules/notifications/index';
import { loadConfig } from './platform/config/index';
import { createDb } from './platform/db/index';
import { errorCode } from './platform/errors/code';
import { createEventBus } from './platform/events/index';
import { startJobRunner } from './platform/jobs/index';
import { createLogger } from './platform/logger/index';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger(config.logLevel, config.nodeEnv === 'development');
const db = createDb(config.databaseUrl, logger, config.dbQueryTimeoutMs);
const events = createEventBus(logger);
const bookingJobs = createBookingJobs({ db, config, events, logger });
const notifications = createNotificationService({ db, config, logger, events });

const runner = await startJobRunner({
  connectionString: config.databaseUrl,
  logger,
  jobs: [
    {
      name: 'bookings.expire-pending',
      cron: '* * * * *',
      run: () => bookingJobs.expirePending(),
    },
    {
      name: 'bookings.complete-past',
      cron: '15 0 * * *',
      timeZone: config.listingTimeZone,
      run: () => bookingJobs.completePast(),
    },
    {
      name: 'bookings.expiring-soon',
      cron: '*/10 * * * *',
      run: () => bookingJobs.expiringSoon(),
    },
    {
      name: 'bookings.cleanup-idempotency',
      cron: '30 3 * * *',
      run: () => bookingJobs.cleanupIdempotency(),
    },
  ],
});

logger.info({ jobs: 4 }, 'worker started');

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker shutting down');

  const timer = setTimeout(() => {
    logger.error('worker shutdown timeout, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  let exitCode = 0;

  try {
    await runner.stop();
  } catch (error) {
    exitCode = 1;
    logger.error({ code: errorCode(error) }, 'job runner stop failed');
  }

  notifications.close();

  try {
    await db.close();
  } catch (error) {
    exitCode = 1;
    logger.error({ code: errorCode(error) }, 'db close failed');
  }

  process.exit(exitCode);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (error) => {
  logger.error({ code: errorCode(error) }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ code: errorCode(reason) }, 'unhandled rejection');
  process.exit(1);
});
