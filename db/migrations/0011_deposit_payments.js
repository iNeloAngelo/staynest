/**
 * Депозит: срок оплаты в брони и служебный updated_at у платежей.
 * Сама таблица payments создана в 0006, здесь появляется только то,
 * чего не хватало движку депозита.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE bookings ADD COLUMN deposit_due_at timestamptz;

    CREATE INDEX bookings_deposit_due_idx
      ON bookings (deposit_due_at)
      WHERE status = 'confirmed' AND deposit_due_at IS NOT NULL;

    -- Один платёж = одна строка, updated_at меняется при переходе статуса.
    CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- Последний депозит брони читается по (booking_id, created_at DESC).
    CREATE INDEX payments_booking_deposit_idx
      ON payments (booking_id, created_at DESC)
      WHERE kind = 'deposit';
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS payments_booking_deposit_idx;
    DROP TRIGGER IF EXISTS payments_set_updated_at ON payments;
    DROP INDEX IF EXISTS bookings_deposit_due_idx;
    ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_due_at;
  `);
};
