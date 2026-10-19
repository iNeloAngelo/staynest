/**
 * Движок бронирования: конечные границы диапазонов и индексы для лимитов/аудита.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    -- Бесконечная бронь или блокировка делает check_out/nights NULL и ломает
    -- расчёты, поэтому обе границы обязательны (Backlog сессии 10).
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_finite_range CHECK (
        NOT lower_inf(stay_range) AND NOT upper_inf(stay_range)
      ),
      ADD CONSTRAINT bookings_half_open_range CHECK (
        lower_inc(stay_range) AND NOT upper_inc(stay_range)
      );
    ALTER TABLE listing_blocks
      ADD CONSTRAINT listing_blocks_finite_range CHECK (
        NOT lower_inf(block_range) AND NOT upper_inf(block_range)
      ),
      ADD CONSTRAINT listing_blocks_half_open_range CHECK (
        lower_inc(block_range) AND NOT upper_inc(block_range)
      );

    -- Лимит активных заявок гостя считается по (guest_id, status).
    CREATE INDEX bookings_guest_pending_idx ON bookings (guest_id) WHERE status = 'pending';

    -- Таймлайн событий: id (identity) — единственный монотонный порядок.
    -- created_at у событий из разных транзакций может идти не по порядку,
    -- потому что now() фиксируется на старте транзакции.
    CREATE INDEX booking_events_booking_order_idx ON booking_events (booking_id, id);
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_events_booking_order_idx;
    DROP INDEX IF EXISTS bookings_guest_pending_idx;
    ALTER TABLE listing_blocks DROP CONSTRAINT IF EXISTS listing_blocks_half_open_range;
    ALTER TABLE listing_blocks DROP CONSTRAINT IF EXISTS listing_blocks_finite_range;
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_half_open_range;
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_finite_range;
  `);
};
