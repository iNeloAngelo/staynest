import { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';
import { errorCode } from '../errors/code';

type JobDefinition = {
  name: string;
  cron: string;
  /** Таймзона cron-выражения; по умолчанию UTC. */
  timeZone?: string;
  run: () => Promise<unknown>;
};

export type JobRunnerOptions = {
  connectionString: string;
  logger: Logger;
  jobs: JobDefinition[];
};

export type JobRunner = {
  stop: () => Promise<void>;
};

/**
 * pg-boss на той же Postgres: отдельный процесс worker, без Redis.
 * Схема `pgboss` создаётся и мигрируется самим pg-boss при старте.
 */
export async function startJobRunner({
  connectionString,
  logger,
  jobs,
}: JobRunnerOptions): Promise<JobRunner> {
  const boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    application_name: 'staynest-worker',
    max: 2,
  });

  boss.on('error', (error) => {
    logger.error({ code: errorCode(error) }, 'pg-boss error');
  });

  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name);
    await boss.work(job.name, async () => {
      const result = await job.run();
      logger.info({ job: job.name, result }, 'scheduled job finished');
    });
    await boss.schedule(job.name, job.cron, {}, { tz: job.timeZone ?? 'UTC', missed: 'once' });
  }

  return {
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
  };
}
