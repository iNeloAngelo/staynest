# Модуль bookings

## Зачем

Движок бронирования: заявка гостя, подтверждение и отклонение хозяином,
отмена, истечение по TTL и автоматическое завершение после выезда.
Корректность дат держится на exclusion constraint в БД, а не только на коде.

## Публичный API

| Метод | Путь | Доступ | Что делает |
|---|---|---|---|
| `POST` | `/bookings` | гость | создаёт `pending` (обязателен `Idempotency-Key`) |
| `GET` | `/me/bookings?role=guest\|host&status&cursor&limit` | участник | список своих поездок или входящих заявок |
| `GET` | `/bookings/:id` | гость или хозяин | детали и таймлайн `booking_events` |
| `POST` | `/bookings/:id/confirm` | хозяин | `pending → confirmed` |
| `POST` | `/bookings/:id/decline` | хозяин | `pending → declined`, комментарий необязателен |
| `POST` | `/bookings/:id/cancel` | гость или хозяин | отмена по таблице переходов |

## Транзакция создания

1. `pg_advisory_xact_lock` по `(user_id, idempotency-key)` — один ключ
   обрабатывается один раз даже при параллельных запросах.
2. `users ... FOR UPDATE` — лимит пяти `pending` и проверка email не
   разъезжаются с параллельными заявками.
3. `listings ... FOR UPDATE` — тот же порядок блокировок, что у блокировок дат
   (`availability`) и публикации/архива (`listings`). `pricing` правила не
   блокирует, но quote читает их после этой блокировки.
4. `/quote`-расчёт внутри транзакции: цена, правила и занятость читаются после
   блокировки объявления.
5. `INSERT bookings`, `INSERT booking_events`, ответ сохраняется в
   `idempotency_keys`.
6. `booking.requested` публикуется **после** коммита.

Нарушение `bookings_no_overlap` (`23P01`) и конфликт из quote превращаются в
`409 booking_dates_unavailable`.

## Идемпотентность

- Заголовок `Idempotency-Key`: 8–200 символов `[A-Za-z0-9._:-]`.
- Хэш считается по endpoint + нормализованному телу (ключи отсортированы).
- Повтор с тем же ключом и телом возвращает сохранённые `status`/`body` и
  заголовок `Idempotency-Replayed: true`.
- Тот же ключ с другим телом — `422 idempotency_key_conflict`.
- Ключи старше 48 часов удаляет джоб.

## Статусы

```
pending ──confirm──▶ confirmed ──check_out──▶ completed
   │                    │
   ├─decline──▶ declined ├─cancel(guest)──▶ cancelled_by_guest
   ├─cancel(guest)──▶ cancelled_by_guest
   └─expires_at──▶ expired
                          └─cancel(host, reason)──▶ cancelled_by_host
```

Активные статусы (`pending`, `confirmed`) занимают даты. Отмена хозяином
подтверждённой брони требует причину; гость отменяет подтверждённую бронь
только до даты заезда. Полная таблица — `state-machine.ts`.

## Фоновые задачи

`createBookingJobs` вызывается worker-процессом через pg-boss:

| Задача | Расписание | Что делает |
|---|---|---|
| `bookings.expire-pending` | каждую минуту | `pending` с `expires_at <= now()` → `expired` |
| `bookings.complete-past` | 00:15 по `LISTING_TIME_ZONE` | `confirmed` с `check_out < today` → `completed` |
| `bookings.expiring-soon` | каждые 10 минут | публикует `booking.expiring_soon` для заявок, истекающих в ближайшие 3 часа |
| `bookings.cleanup-idempotency` | 03:30 | удаляет `idempotency_keys` старше 48 часов |

Задачи берут строки `FOR UPDATE SKIP LOCKED`, поэтому confirm/decline не
проигрывают гонку джобу, а два воркера не обрабатывают одну бронь.

## Лимиты

- не больше `BOOKING_MAX_ACTIVE_PENDING` (по умолчанию 5) `pending` у гостя;
- rate limit `BOOKING_RATE_LIMIT_MAX` за `BOOKING_RATE_LIMIT_WINDOW_MINUTES`;
- подтверждённый email при `REQUIRE_EMAIL_VERIFICATION=true`;
- бронировать своё объявление нельзя.

Счётчики rate limit живут в памяти процесса (ADR-034). Лимит `pending`
проверяется в БД под блокировкой пользователя, поэтому он точен и между
инстансами.

## Тесты

- `state-machine.test.ts` — все 42 комбинации статус × действие × роль.
- `tests/bookings-create.test.ts` — создание, идемпотентность, конфликты, лимиты.
- `tests/bookings-actions.test.ts` — переходы, права, гонки, список и таймлайн.
- `tests/bookings-jobs.test.ts` — истечение, завершение, очистка ключей.
- `tests/booking-concurrency.test.ts` — 50 параллельных заявок × 20 запусков.
- `tests/security/idor.test.ts` — чужая бронь неотличима от отсутствующей.
