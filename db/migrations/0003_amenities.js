/**
 * Справочник удобств и идемпотентный сид (DB.md, раздел 19).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE amenities (
      id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code       text NOT NULL UNIQUE,
      name_ru    text NOT NULL,
      name_en    text NOT NULL,
      icon       text NOT NULL,
      sort_order smallint NOT NULL DEFAULT 0
    );

    INSERT INTO amenities (code, name_ru, name_en, icon, sort_order) VALUES
      ('wifi',           'Wi-Fi',                    'Wi-Fi',             'wifi',              10),
      ('sauna',          'Сауна',                    'Sauna',             'flame',             20),
      ('parking',        'Парковка',                 'Parking',           'car',               30),
      ('fireplace',      'Камин',                    'Fireplace',         'fireplace',         40),
      ('pets_allowed',   'Можно с питомцами',        'Pets allowed',      'paw-print',         50),
      ('pool',           'Бассейн',                  'Pool',              'waves',             60),
      ('bbq',            'Зона барбекю',             'BBQ area',          'grill',             70),
      ('kitchen',        'Кухня',                    'Kitchen',           'utensils',          80),
      ('washer',         'Стиральная машина',        'Washing machine',   'washing-machine',   90),
      ('ac',             'Кондиционер',              'Air conditioning',  'air-vent',         100),
      ('tv',             'Телевизор',                'TV',                'tv',               110),
      ('kids_friendly',  'Подходит для детей',       'Kid-friendly',      'baby',             120),
      ('lake_view',      'Вид на озеро',             'Lake view',         'water',            130),
      ('mountain_view',  'Вид на горы',              'Mountain view',     'mountain',         140)
    ON CONFLICT (code) DO NOTHING;
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS amenities;');
};
