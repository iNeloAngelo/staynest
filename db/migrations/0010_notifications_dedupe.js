/**
 * Дедупликация уведомлений: напоминание «заявка скоро истечёт» создаётся
 * один раз на бронь, даже если джоб запускается повторно.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE notifications ADD COLUMN dedupe_key text;

    CREATE UNIQUE INDEX notifications_dedupe_uq
      ON notifications (user_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS notifications_dedupe_uq;
    ALTER TABLE notifications DROP COLUMN IF EXISTS dedupe_key;
  `);
};
