import { buildApp } from './app';
import { loadConfig } from './platform/config/index';
import { createDb } from './platform/db/index';
import { createLogger } from './platform/logger/index';

const config = loadConfig();
const logger = createLogger(config.logLevel, config.nodeEnv === 'development');
const db = createDb(config.databaseUrl);
const app = await buildApp({ config, logger, db });

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');

  try {
    await app.close();
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'shutdown failed');
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, 'api started');
} catch (error) {
  logger.error({ err: error }, 'api failed to start');
  process.exit(1);
}
