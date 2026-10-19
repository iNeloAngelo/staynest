/**
 * Блокировки дат, избранное, уведомления, подписки, платежи и отзывы (v2).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE listing_blocks (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      block_range daterange NOT NULL CHECK (NOT isempty(block_range)),
      reason      text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT listing_blocks_no_overlap
        EXCLUDE USING gist (listing_id WITH =, block_range WITH &&)
    );

    CREATE TABLE listing_price_rules (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id          uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      name                text NOT NULL,
      date_from           date NOT NULL,
      date_to             date NOT NULL,
      nightly_price_minor bigint NOT NULL CHECK (nightly_price_minor > 0),
      min_nights          smallint CHECK (min_nights >= 1),
      priority            smallint NOT NULL DEFAULT 0,
      created_at          timestamptz NOT NULL DEFAULT now(),
      CHECK (date_to >= date_from)
    );
    CREATE INDEX listing_price_rules_listing_idx ON listing_price_rules (listing_id, date_from, date_to);

    CREATE TABLE telegram_identities (
      user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      telegram_id bigint NOT NULL UNIQUE,
      username    text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE favorites (
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, listing_id)
    );
    CREATE INDEX favorites_user_idx ON favorites (user_id, created_at DESC);

    CREATE TABLE notifications (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       text NOT NULL,
      payload    jsonb NOT NULL DEFAULT '{}',
      read_at    timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX notifications_user_idx   ON notifications (user_id, created_at DESC);
    CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

    CREATE TABLE push_subscriptions (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint     text NOT NULL UNIQUE,
      p256dh       text NOT NULL,
      auth         text NOT NULL,
      user_agent   text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz
    );
    CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

    CREATE TABLE payments (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id   uuid NOT NULL REFERENCES bookings(id),
      provider     text NOT NULL DEFAULT 'mock',
      kind         text NOT NULL CHECK (kind IN ('deposit', 'refund')),
      status       text NOT NULL CHECK (status IN ('created', 'succeeded', 'failed', 'refunded')),
      amount_minor bigint NOT NULL CHECK (amount_minor > 0),
      currency     char(3) NOT NULL,
      external_id  text,
      raw_event    jsonb,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX payments_provider_external_uq ON payments (provider, external_id) WHERE external_id IS NOT NULL;
    CREATE INDEX payments_booking_idx ON payments (booking_id);

    CREATE TABLE reviews (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
      listing_id uuid NOT NULL REFERENCES listings(id),
      author_id  uuid NOT NULL REFERENCES users(id),
      rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment    text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX reviews_listing_idx ON reviews (listing_id, created_at DESC);
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS push_subscriptions;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS favorites;
    DROP TABLE IF EXISTS telegram_identities;
    DROP TABLE IF EXISTS listing_price_rules;
    DROP TABLE IF EXISTS listing_blocks;
  `);
};
