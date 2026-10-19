/**
 * Объявления, удобства объявления и фото.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE listings (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id            uuid NOT NULL REFERENCES users(id),
      status              listing_status NOT NULL DEFAULT 'draft',
      type                listing_type NOT NULL DEFAULT 'house',
      title               text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
      description         text NOT NULL DEFAULT '',
      country             text NOT NULL DEFAULT 'RU',
      region              text,
      city                text NOT NULL,
      address_line        text,
      lat                 numeric(9,6) CHECK (lat BETWEEN -90 AND 90),
      lng                 numeric(9,6) CHECK (lng BETWEEN -180 AND 180),
      max_guests          smallint NOT NULL CHECK (max_guests BETWEEN 1 AND 30),
      bedrooms            smallint NOT NULL CHECK (bedrooms BETWEEN 0 AND 20),
      beds                smallint NOT NULL CHECK (beds BETWEEN 1 AND 40),
      bathrooms           smallint NOT NULL DEFAULT 1 CHECK (bathrooms BETWEEN 0 AND 20),
      area_sqm            smallint CHECK (area_sqm > 0),
      base_price_minor    bigint NOT NULL CHECK (base_price_minor > 0),
      weekend_price_minor bigint CHECK (weekend_price_minor > 0),
      cleaning_fee_minor  bigint NOT NULL DEFAULT 0 CHECK (cleaning_fee_minor >= 0),
      currency            char(3) NOT NULL DEFAULT 'RUB',
      min_nights          smallint NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
      max_nights          smallint NOT NULL DEFAULT 30,
      check_in_time       time NOT NULL DEFAULT '15:00',
      check_out_time      time NOT NULL DEFAULT '11:00',
      house_rules         text,
      cover_photo_id      uuid,
      rating_avg          numeric(3,2),
      rating_count        integer NOT NULL DEFAULT 0,
      search_tsv          tsvector GENERATED ALWAYS AS (
                            to_tsvector('russian', coalesce(title,'') || ' ' || coalesce(description,''))
                          ) STORED,
      published_at        timestamptz,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now(),
      CHECK (max_nights >= min_nights)
    );

    CREATE TRIGGER listings_set_updated_at BEFORE UPDATE ON listings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE INDEX listings_owner_idx          ON listings (owner_id);
    CREATE INDEX listings_pub_city_price_idx ON listings (city, base_price_minor) WHERE status = 'published';
    CREATE INDEX listings_pub_newest_idx     ON listings (published_at DESC, id DESC) WHERE status = 'published';
    CREATE INDEX listings_pub_price_idx      ON listings (base_price_minor, id) WHERE status = 'published';
    CREATE INDEX listings_search_tsv_idx     ON listings USING gin (search_tsv);
    CREATE INDEX listings_city_trgm_idx      ON listings USING gin (city gin_trgm_ops);

    CREATE TABLE listing_amenities (
      listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      amenity_id smallint NOT NULL REFERENCES amenities(id),
      PRIMARY KEY (listing_id, amenity_id)
    );
    CREATE INDEX listing_amenities_amenity_idx ON listing_amenities (amenity_id, listing_id);

    CREATE TABLE listing_photos (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id     uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      storage_prefix text NOT NULL,
      width          integer NOT NULL,
      height         integer NOT NULL,
      blurhash       text,
      position       smallint NOT NULL,
      is_cover       boolean NOT NULL DEFAULT false,
      created_at     timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT listing_photos_position_uq UNIQUE (listing_id, position) DEFERRABLE INITIALLY DEFERRED
    );
    CREATE UNIQUE INDEX listing_photos_one_cover_uq ON listing_photos (listing_id) WHERE is_cover;

    ALTER TABLE listings
      ADD CONSTRAINT listings_cover_photo_fk
      FOREIGN KEY (cover_photo_id) REFERENCES listing_photos(id) ON DELETE SET NULL;
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_cover_photo_fk;
    DROP TABLE IF EXISTS listing_photos;
    DROP TABLE IF EXISTS listing_amenities;
    DROP TABLE IF EXISTS listings;
  `);
};
