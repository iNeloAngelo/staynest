# Модуль notifications

## Зачем

Единая точка уведомлений: запись в `notifications`, доставка по SSE в открытую
вкладку и Web Push на устройство. Модуль подписан на события `booking.*`, но не
читает таблицы броней: все нужные поля приходят в payload события (ADR-070).

## Публичный API

| Метод | Путь | Доступ | Что делает |
|---|---|---|---|
| `GET` | `/me/notifications?limit&cursor` | пользователь | список и `unreadCount`, курсор по `(created_at, id)` |
| `POST` | `/me/notifications/read` | пользователь | отмечает `ids` или все уведомления прочитанными |
| `GET` | `/me/events` | пользователь | SSE-поток (`event: notification`), heartbeat раз в 25 с |
| `GET` | `/me/push/config` | пользователь | `{ enabled, publicKey }` для `PushManager.subscribe` |
| `POST` | `/me/push-subscriptions` | пользователь | upsert подписки по endpoint |
| `DELETE` | `/me/push-subscriptions` | пользователь | удаляет только свою подписку |

Все ответы под `/me` отдаются с `Cache-Control: private, no-store`.

## События → получатель

| Событие | Кому | Push |
|---|---|---|
| `booking.requested` | хозяину | да |
| `booking.confirmed` | гостю | да |
| `booking.declined` | гостю | да |
| `booking.cancelled` | второй стороне (по `actorId`) | да |
| `booking.expiring_soon` | хозяину, один раз на бронь | да |
| `booking.expired` | гостю | нет |
| `booking.completed` | гостю | нет |

`payload` уведомления семантический (`bookingId`, `listingId`, `listingTitle`,
`checkIn`, `checkOut`, `guestName`, `totalMinor`, `currency`, `actorRole`,
`expiresAt`). Клиент переводит тип и поля через i18n, поэтому в БД нет готовых
русских строк. Push-текст собирается на сервере по `users.locale`.

## SSE

- Клиент использует `fetch` + `ReadableStream`, а не `EventSource`: при 401
  обычный single-flight refresh повторяет подключение, cookie работает
  same-origin.
- Hub хранит до пяти потоков на пользователя в памяти процесса. Подписка
  проверяется до `reply.hijack()`, поэтому лишний поток получает
  `429 too_many_event_streams`, а не пустой `200`.
- `service.close()` закрывает открытые `ServerResponse` (`raw.end()`), поэтому
  `app.close()` не ждёт SSE до таймаута. Для маршрута отключён автоматический
  HEAD, а `sec-fetch-site: cross-site` отвергается.
- Для нескольких инстансов API нужен общий broker (Postgres LISTEN/NOTIFY или
  Redis) — записано в Backlog.
- Caddy для `/api/v1/me/events` отключает буферизацию (`flush_interval -1`),
  приложение отдаёт `X-Accel-Buffering: no`.

## Web Push

- VAPID-пара задаётся `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  Без ключей push выключен, но in-app и SSE работают.
- Сгенерировать пару: `pnpm vapid:generate`.
- Endpoint уникален глобально: вход другим пользователем в том же браузере
  перепривязывает подписку (`ON CONFLICT (endpoint) DO UPDATE`).
- Ответы 404/410 от push-сервиса удаляют мёртвую подписку; успешная отправка
  обновляет `last_used_at`.
- Endpoint проверяется на хосте при подписке: разрешены только FCM, Mozilla,
  WNS и Apple (`422 push_host_not_allowed` для остальных). Это и защита от
  SSRF, и честный отказ вместо «включено, но никогда не доставится».
- Браузер запоминает владельца подписки в `localStorage`; при входе другого
  аккаунта старая подписка отписывается, чтобы чужие push не приходили.
- Счётчик подписок — 20 в час на пользователя (память процесса, как остальные
  rate limit).

## Фоновые задачи

`bookings.expiring-soon` (каждые 10 минут) публикует `booking.expiring_soon`
для `pending`, у которых `expires_at` попадает в ближайшие
`BOOKING_EXPIRY_WARNING_HOURS` (по умолчанию 3). Повторный запуск не создаёт
вторую строку: уникальный частичный индекс `notifications_dedupe_uq` по
`(user_id, dedupe_key)`, ключ `expiring:<booking_id>`.

## Таблицы

- `notifications` (`user_id`, `type`, `payload`, `dedupe_key`, `read_at`).
- `push_subscriptions` (`endpoint`, `p256dh`, `auth`, `user_agent`, `last_used_at`).

## Тесты

- `notifications.test.ts` (unit) — курсор, hub, тексты push.
- `tests/notifications.test.ts` — адресаты событий, права, пагинация, дедупликация,
  подписки, мёртвый endpoint, 503 без VAPID.
- `tests/notifications-sse.test.ts` — реальный HTTP-поток: handshake, событие,
  `id:`, `cache-control`.
- `e2e/booking-flow.spec.ts` — колокольчик у хозяина и гостя, обновление после
  подтверждения без перезагрузки.
