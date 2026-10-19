/**
 * Индексы под поиск по датам и нормализованный город (Сессия 10).
 *
 * Фильтр каталога сравнивает город через `lower(city)`, поэтому обычный
 * индекс по `city` не задействовался. Функциональный индекс снимает это
 * ограничение и по-прежнему поддерживает сортировку по цене.
 *
 * Доступность фильтруется через `NOT EXISTS` по `bookings` и
 * `listing_blocks`; там работают gist-индексы EXCLUDE-ограничений, отдельный
 * индекс не нужен.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS listings_pub_city_price_idx;
    CREATE INDEX listings_pub_city_lower_price_idx
      ON listings (lower(city), base_price_minor)
      WHERE status = 'published';

    CREATE INDEX listings_pub_city_lower_newest_idx
      ON listings (lower(city), published_at DESC, id DESC)
      WHERE status = 'published';
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS listings_pub_city_lower_newest_idx;
    DROP INDEX IF EXISTS listings_pub_city_lower_price_idx;
    CREATE INDEX listings_pub_city_price_idx
      ON listings (city, base_price_minor)
      WHERE status = 'published';
  `);
};
