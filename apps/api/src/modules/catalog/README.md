# Модуль catalog

## Зачем

Публичная read-модель каталога. Гость ищет опубликованные дома по тексту,
городу, гостям, цене, спальням, типу жилья и удобствам, листает выдачу курсором
и открывает карточку дома. Модуль ничего не пишет: таблицами владеют `listings`
и `photos` (ADR-017).

## Публичный API

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/listings` | список опубликованных домов с фильтрами, сортировкой и курсором |
| `GET` | `/listings/:id` | карточка опубликованного дома |
| `GET` | `/cities` | подсказки городов из опубликованных объявлений |

Параметры `GET /listings`: `q`, `city`, `guests`, `priceMin`, `priceMax`,
`bedroomsMin`, `type`, `amenities`, `sort`, `cursor`, `limit`. Массивы `type` и
`amenities` передаются повторением параметра или через запятую. Для совместимости
с ТЗ принимаются и snake_case-имена `price_min`, `price_max`, `bedrooms_min`,
`type[]`, `amenities[]`. Повторяющиеся значения дедуплицируются. `limit` — 1–48,
по умолчанию 24. Цены — в минимальных единицах (копейках).

Сортировки: `newest` (по умолчанию), `price_asc`, `price_desc`, `relevance`
(только при `q`, иначе сервер возвращает `newest`). `q` ищет по `search_tsv`
(русская конфигурация) и по городу через триграммы.

Контракты — `packages/shared/src/catalog.ts`.

## Приватность публичной выдачи

`PublicListingSummary` и `PublicListing` **не содержат** `addressLine`, точных
`lat`/`lng`, `ownerId`, `pendingBookingsCount` и `status`. Вместо координат
отдаются `approxLat`/`approxLng`, округлённые до 0.01° (~1 км). Точный адрес
появится в брони после подтверждения (Сессия 12).

## Курсор

Курсор — base64url от JSON с версией, сортировкой и ключом последней строки:

- `newest`: `(published_at, id) < (cursor.publishedAt, cursor.id)`;
- `price_asc` / `price_desc`: `(base_price_minor, id)` со знаком `>` / `<`;
- `relevance`: `(rank, published_at, id) < (...)`.

`id` в кортеже делает порядок строгим при одинаковой цене или ранге, поэтому
страницы не дают дублей и пропусков. Время в курсоре хранится строкой с шестью
знаками после точки (`to_char ... US`): `Date.toISOString()` теряет микросекунды
Postgres и ломает границу страницы на сидах через `now()`. Курсор другой
сортировки, другой `q` в релевантности или битый JSON даёт `400 invalid_cursor`.

## Индексы

Используются индексы из миграции `0004`:
`listings_pub_newest_idx`, `listings_pub_price_idx`,
`listings_search_tsv_idx`, `listings_city_trgm_idx`. Замеры и оптимизация —
Сессия 10.

## Как тестировать

```bash
pnpm --filter @staynest/api test
```

Интеграционные тесты: `apps/api/tests/catalog.test.ts`. Юнит-тесты курсора:
`src/modules/catalog/cursor.test.ts`. Тесты БД требуют `DATABASE_URL_TEST`
(см. `docs/DECISIONS.md`, ADR-029).
