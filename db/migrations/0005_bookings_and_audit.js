/**
 * Бронирования, аудит статусов и ключи идемпотентности.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE bookings (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id      uuid NOT NULL REFERENCES listings(id),
      guest_id        uuid NOT NULL REFERENCES users(id),
      stay_range      daterange NOT NULL CHECK (NOT isempty(stay_range)),
      check_in        date GENERATED ALWAYS AS (lower(stay_range)) STORED,
      check_out       date GENERATED ALWAYS AS (upper(stay_range)) STORED,
      nights          integer GENERATED ALWAYS AS (upper(stay_range) - lower(stay_range)) STORED,
      guests_count    smallint NOT NULL CHECK (guests_count >= 1),
      status          booking_status NOT NULL DEFAULT 'pending',
      total_minor     bigint NOT NULL CHECK (total_minor >= 0),
      currency        char(3) NOT NULL,
      price_breakdown jsonb NOT NULL,
      guest_message   text,
      host_response   text,
      expires_at      timestamptz,
      confirmed_at    timestamptz,
      cancelled_at    timestamptz,
      cancelled_by    uuid REFERENCES users(id),
      cancel_reason   text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),

      -- ГЛАВНАЯ ЗАЩИТА: две активные брони одного дома не могут пересекаться по датам
      CONSTRAINT bookings_no_overlap
        EXCLUDE USING gist (listing_id WITH =, stay_range WITH &&)
        WHERE (status IN ('pending', 'confirmed'))
    );

    CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE INDEX bookings_guest_idx          ON bookings (guest_id, created_at DESC);
    CREATE INDEX bookings_listing_status_idx ON bookings (listing_id, status, check_in);
    CREATE INDEX bookings_pending_expiry_idx ON bookings (expires_at) WHERE status = 'pending';
    CREATE INDEX bookings_completion_idx     ON bookings (check_out) WHERE status = 'confirmed';

    CREATE TABLE booking_events (
      id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      actor_id    uuid REFERENCES users(id),
      from_status booking_status,
      to_status   booking_status NOT NULL,
      note        text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, created_at);

    CREATE TABLE idempotency_keys (
      user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key             text NOT NULL,
      endpoint        text NOT NULL,
      request_hash    text NOT NULL,
      response_status integer,
      response_body   jsonb,
      created_at      timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key)
    );
    CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at);
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS idempotency_keys;
    DROP TABLE IF EXISTS booking_events;
    DROP TABLE IF EXISTS bookings;
  `);
};
