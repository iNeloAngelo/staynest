/**
 * Черновик объявления создаётся пустым и заполняется в мастере (Сессия 7).
 * Поэтому обязательные для гостя поля становятся nullable, а полноту
 * проверяет табличное ограничение: всё, что не draft, обязано быть заполнено.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE listings
      ALTER COLUMN title DROP NOT NULL,
      ALTER COLUMN city DROP NOT NULL,
      ALTER COLUMN max_guests DROP NOT NULL,
      ALTER COLUMN bedrooms DROP NOT NULL,
      ALTER COLUMN beds DROP NOT NULL,
      ALTER COLUMN base_price_minor DROP NOT NULL;

    ALTER TABLE listings
      ADD CONSTRAINT listings_complete_when_not_draft CHECK (
        status = 'draft' OR (
          title IS NOT NULL
          AND char_length(title) BETWEEN 5 AND 120
          AND char_length(description) >= 50
          AND city IS NOT NULL AND char_length(btrim(city)) > 0
          AND address_line IS NOT NULL AND char_length(btrim(address_line)) > 0
          AND max_guests IS NOT NULL
          AND bedrooms IS NOT NULL
          AND beds IS NOT NULL
          AND base_price_minor IS NOT NULL
        )
      );
  `);
};

/**
 * Откат возвращает NOT NULL. Черновики без обязательных полей в старой схеме
 * существовать не могли, поэтому удаляются: заполнить их вымышленными
 * значениями было бы хуже, чем потерять недозаполненный черновик.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_complete_when_not_draft;

    DELETE FROM listings
     WHERE title IS NULL
        OR city IS NULL
        OR max_guests IS NULL
        OR bedrooms IS NULL
        OR beds IS NULL
        OR base_price_minor IS NULL;

    ALTER TABLE listings
      ALTER COLUMN title SET NOT NULL,
      ALTER COLUMN city SET NOT NULL,
      ALTER COLUMN max_guests SET NOT NULL,
      ALTER COLUMN bedrooms SET NOT NULL,
      ALTER COLUMN beds SET NOT NULL,
      ALTER COLUMN base_price_minor SET NOT NULL;
  `);
};
