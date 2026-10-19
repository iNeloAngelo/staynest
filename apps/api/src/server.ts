import { buildApp } from './app';
import { loadConfig } from './platform/config/index';
import { createDb } from './platform/db/index';
import { errorCode } from './platform/errors/code';
import { createLogger } from './platform/logger/index';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger(config.logLevel, config.nodeEnv === 'development');
const db = createDb(config.databaseUrl, logger);
const app = await buildApp({ config, logger, db });

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const timer = setTimeout(() => {
    logger.error('shutdown timeout, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  let exitCode = 0;

  try {
    await app.close();
  } catch (error) {
    exitCode = 1;
    logger.error({ code: errorCode(error) }, 'app close failed');
  }

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

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, 'api started');
} catch (error) {
  logger.error({ code: errorCode(error) }, 'api failed to start');
  process.exit(1);
}
