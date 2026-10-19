# Поиск по свободным датам: планы и замеры (Сессия 10)

Дата: 2026-10-19. Postgres 16 в Docker (`staynest-dev-postgres-1`), API локально
(Node 24, `tsx`), Windows 11. Замеры сделаны на перф-данных из
`scripts/seed-perf.mjs`.

## Данные

| Сущность | Количество |
|---|---|
| Опубликованные объявления | 10 006 (10 000 перф + 6 демо) |
| Брони | 100 000, из них 60 000 активных (`pending`/`confirmed`) |
| Блокировки дат | 5 000 |
| Сезонные правила | 3 000 |
| Фото | 10 000 |

Брони разложены по 10 слотам с шагом 36 дней, поэтому активные интервалы не
пересекаются и не мешают загрузке. 60% слотов заняты активными бронями: запрос
на 7 ночей отсекает примерно 60% объявлений (в плане — 6 000 занятых против
4 006 свободных). Блокировки стоят в свободных промежутках слотов; отдельный
сценарий ниже проверяет диапазон, который попадает в блокировки.

## Как воспроизвести

```bash
pnpm db:migrate
pnpm seed:perf                 # 10 000 объявлений, 100 000 броней
pnpm perf:search               # EXPLAIN (ANALYZE, BUFFERS) + p50/p95 SQL
pnpm --filter @staynest/api dev
pnpm perf:http                 # p50/p95 HTTP GET /listings
```

Удалить перф-данные, не трогая остальную dev-базу:

```bash
pnpm seed:perf --clean
```

## Сценарии

Основной диапазон: `current_date + 30 … + 37` (7 ночей), `limit=24`.
Сценарий с блокировками: `current_date + 16 … + 23`. Проверяются активные брони
и блокировки, как в `DB.md`, раздел 18.

| Сценарий | SQL p50 | SQL p95 | HTTP p50 | HTTP p95 |
|---|---:|---:|---:|---:|
| `newest` + свободные даты | 34.8 мс | 44.0 мс | 47.5 мс | **85.2 мс** |
| `price_asc` + город + даты | 16.6 мс | 18.5 мс | 30.8 мс | **52.4 мс** |
| `relevance` + `q` + даты | 28.7 мс | 32.3 мс | 46.1 мс | **59.7 мс** |
| `newest` + заблокированные даты | 10.3 мс | 11.0 мс | 29.2 мс | **63.5 мс** |
| гости + цена + тип + даты | 19.3 мс | 20.9 мс | 30.3 мс | **41.9 мс** |
| без дат (baseline) | — | — | 14.9 мс | **16.3 мс** |

DoD сессии: p95 меньше 150 мс. Худший сценарий — 85.2 мс end-to-end.

## Что показали планы

### Общий приём: материализованный `busy`

Первый вариант запроса использовал два коррелированных `NOT EXISTS`. На
`q = 'озеро'` планировщик мог выбрать nested loop anti join и сортировать все
10 000 совпадений: EXPLAIN 137–197 мс, HTTP p95 300 мс — DoD не выполнялся.
Повторный `ANALYZE` менял выбор плана, то есть поведение было нестабильным.

Теперь занятые дома собираются один раз в материализованный CTE:

```sql
WITH busy AS MATERIALIZED (
  SELECT listing_id FROM bookings
   WHERE status IN ('pending', 'confirmed') AND stay_range && $1
  UNION
  SELECT listing_id FROM listing_blocks
   WHERE block_range && $1
)
SELECT ...
  FROM listings
 WHERE ... AND NOT EXISTS (SELECT 1 FROM busy WHERE busy.listing_id = listings.id)
```

Планировщик стабильно строит `Hash Right Anti Join`, и только после этого
сортирует свободные строки. Цена — около 10 мс на построение `busy` (6 000
активных броней), зато запрос перестал зависеть от настроения планировщика.

### Новизна + свободные даты

```
CTE busy
  ->  HashAggregate  (rows=6000)
        ->  Index Only Scan using bookings_no_overlap
              Index Cond: (stay_range && daterange(...))
        ->  Index Only Scan using listing_blocks_no_overlap
  ->  Sort  (Sort Method: top-N heapsort  Memory: 68kB)
        ->  Hash Right Anti Join
              ->  CTE Scan on busy
              ->  Hash  (Seq Scan on listings, rows=10006)
```

`bookings_no_overlap` и `listing_blocks_no_overlap` — это gist-индексы
EXCLUDE-ограничений; отдельных индексов под доступность не потребовалось.
Хеш широких строк объявлений read/write 552 блока во временный файл, но
top-N сортирует уже только свободные 4 006 строк. Итог — 44 мс p95.

### Цена + город

```
Bitmap Heap Scan on listings
  Recheck Cond: ((lower(city) = 'суздаль'::text) AND (status = 'published'))
  ->  Bitmap Index Scan on listings_pub_city_lower_price_idx
        Index Cond: (lower(city) = 'суздаль'::text)
```

До миграции `0008` запрос сравнивал `lower(city)`, а индекс был построен по
`city`, поэтому планировщик читал лишние страницы. Функциональный индекс
`(lower(city), base_price_minor) WHERE status = 'published'` используется.
После hash anti join остаётся 534 свободных дома, top-N по цене — 18.5 мс p95.

### Релевантность

Релевантность считается в два этапа: подзапрос сортирует только
`(id, rank, published_at)`, затем 25 полных строк подтягиваются по primary key.
Это убирает сортировку текста объявлений. Полный план:

```
CTE busy
  ->  HashAggregate (rows=6000)
Limit
  ->  Sort (top-N heapsort, rows=25)
        ->  Hash Right Anti Join
              ->  CTE Scan on busy
              ->  Hash (Seq Scan on listings, rows=10006)
                    Filter: search_tsv @@ websearch_to_tsquery('russian', 'озеро')
Nested Loop
  ->  Index Scan using listings_pkey (rows=25)
```

`q = 'озеро'` совпадает со всеми 10 000 объявлений — худший случай для
релевантности. Даже на нём p95 — 32.3 мс SQL и 59.7 мс HTTP. На реальных
данных с меньшей селективностью GIN-индекс `listings_search_tsv_idx`
включается раньше и запрос дешевеет.

### Заблокированные даты

```
CTE busy
  ->  HashAggregate (rows=500)
        ->  Index Only Scan using bookings_no_overlap (rows=0)
        ->  Index Only Scan using listing_blocks_no_overlap (rows=500)
  ->  Nested Loop Anti Join (rows=25)
```

Этот сценарий специально попадает в диапазон блокировок: видно, что ветка
`listing_blocks` реально отсекает дома, а не только присутствует в SQL.

### Гости + цена + тип

```
Hash Right Anti Join
  ->  CTE Scan on busy
  ->  Hash (Seq Scan on listings, rows=1481)
        Filter: max_guests >= 6 AND base_price_minor BETWEEN ... AND type IN (...)
```

На 10 000 строк планировщик выбирает seq scan с фильтрами вместо индекса цены:
после отсечения остаётся 613 свободных домов, top-N — 20.9 мс p95. Индекс
`listings_pub_price_idx` включается, когда фильтр цены селективнее (см.
`price_asc` без города).

## Выводы

1. Для дат достаточно gist-индексов EXCLUDE: `bookings_no_overlap` и
   `listing_blocks_no_overlap` используются как partial/range-индексы.
2. Фильтр города нужно сравнивать с функциональным индексом по `lower(city)`;
   старый `(city, base_price_minor)` не работал.
3. Коррелированные `NOT EXISTS` дают нестабильный план на больших данных.
   Материализованный `busy` + hash anti join стабильно укладывается в 150 мс.
4. Сортировку релевантности нельзя делать по полным строкам: top-N по
   `(rank, published_at, id)` + join по PK даёт 32 мс даже при совпадении со
   всем каталогом.
5. Курсор и даты не конфликтуют: курсор строится по тем же ключам сортировки,
   а `check_in`/`check_out` входят в ключ TanStack Query, поэтому смена дат
   сбрасывает страницы.
6. Запас до 150 мс есть, но `newest` с хешем широких строк — следующий кандидат
   на оптимизацию: вынести выборку `id` в отдельный narrow-запрос, как уже
   сделано для релевантности, если появятся 100 000+ объявлений.
