/**
 * Расширения, перечисления и общая функция updated_at.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS btree_gist;
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TYPE listing_type AS ENUM ('house', 'cottage', 'cabin', 'villa', 'townhouse');
    CREATE TYPE listing_status AS ENUM ('draft', 'published', 'archived');
    CREATE TYPE booking_status AS ENUM (
      'pending', 'confirmed', 'declined',
      'cancelled_by_guest', 'cancelled_by_host', 'expired', 'completed'
    );

    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS set_updated_at();
    DROP TYPE IF EXISTS booking_status;
    DROP TYPE IF EXISTS listing_status;
    DROP TYPE IF EXISTS listing_type;
    DROP EXTENSION IF EXISTS pg_trgm;
    DROP EXTENSION IF EXISTS citext;
    DROP EXTENSION IF EXISTS btree_gist;
  `);
};
