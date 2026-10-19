# Модуль pricing

## Зачем

Расчёт стоимости проживания и сезонные цены. Сумму считает только сервер:
клиент показывает готовый ответ `/quote` и не пересчитывает деньги сам
(CONSTITUTION, п. 2).

## Публичный API

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/listings/:id/quote?check_in&check_out&guests` | ночи, цены по группам, уборка, итог |
| `GET` | `/listings/:id/price-rules` | сезонные правила хозяина |
| `POST` | `/listings/:id/price-rules` | создать правило |
| `PATCH` | `/listings/:id/price-rules/:ruleId` | изменить правило |
| `DELETE` | `/listings/:id/price-rules/:ruleId` | удалить правило |

`/quote` публичный, остальные маршруты требуют вход и владение объявлением.
Чужое объявление неотличимо от несуществующего (`404 listing_not_found`).
Ответ `/quote` не кэшируется: цены и занятость должны быть свежими.

## Расчёт (`calculator.ts`)

Чистая функция без БД и без `Date`:

1. Валидирует диапазон, прошлое, гостей, min/max nights.
2. Для каждой ночи выбирает правило с наибольшим `priority`; при равенстве —
   с более поздней `dateFrom`, затем с меньшим `id`.
3. Если сезонного правила нет, но ночь пятница/суббота и задана
   `weekend_price_minor`, берётся цена выходных, иначе базовая.
4. `min_nights`: максимум из `listings.min_nights` и `min_nights` правил,
   которые выиграли цену хотя бы на одной ночи.
5. Уборка добавляется один раз, сервисный сбор в MVP равен 0.
6. Занятая ночь даёт `409 dates_unavailable`; проверка идёт по `[check_in, check_out)`,
   поэтому выезд в день заезда следующего гостя разрешён.

Контракты — `packages/shared/src/pricing.ts`.

## Тесты

```bash
pnpm --filter @staynest/api exec vitest run src/modules/pricing/calculator.test.ts
pnpm --filter @staynest/api test
```

33 юнит-кейса в `calculator.test.ts`, интеграционные сценарии — в
`apps/api/tests/pricing-calendar.test.ts`.
