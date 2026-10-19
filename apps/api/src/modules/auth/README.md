# Модуль auth

## Зачем

Регистрация, вход, сессии и восстановление доступа. Модуль выдаёт access- и
refresh-токены, проверяет пароль, ведёт одноразовые токены подтверждения email и
сброса пароля. Пароли и токены никогда не возвращаются клиенту и не пишутся в логи.

## Публичный API

| Метод | Маршрут | Доступ | Ответ |
|---|---|---|---|
| POST | `/api/v1/auth/register` | аноним | `202 { status: "accepted", emailVerificationRequired }` |
| POST | `/api/v1/auth/login` | аноним | `200 { user }` + cookies |
| POST | `/api/v1/auth/refresh` | refresh-cookie | `200 { user }` + новые cookies |
| POST | `/api/v1/auth/logout` | refresh/access-cookie | `204` |
| POST | `/api/v1/auth/verify-email` | токен + пароль | `204` |
| POST | `/api/v1/auth/resend-verification` | аноним, `{ email }` | `202 { status: "accepted" }` |
| POST | `/api/v1/auth/forgot-password` | аноним | `202 { status: "accepted" }` |
| POST | `/api/v1/auth/reset-password` | токен в теле | `204` |
| POST | `/api/v1/auth/change-password` | вход | `204` |
| GET | `/api/v1/me` | вход | `200 { user }` |
| PATCH | `/api/v1/me` | вход | `200 { user }` |
| GET | `/api/v1/me/sessions` | вход | `200 { sessions }` |
| DELETE | `/api/v1/me/sessions` | вход | `204` |

Ошибки — `application/problem+json` с полем `code`: `invalid_credentials`,
`email_not_verified`, `invalid_token` (refresh), `invalid_link_token` (ссылка из письма),
`weak_password`, `current_password_invalid`, `rate_limited`, `origin_not_allowed`,
`validation_error`, `unauthorized`.

## Сессии и cookies

- `sn_access` — JWT HS256, 15 минут, httpOnly, SameSite=Lax, path `/`.
- `sn_refresh` — случайные 32 байта, 30 дней, httpOnly, SameSite=Lax, path `/api/v1/auth`.
- В БД refresh-токен хранится только как SHA-256 в `refresh_tokens.token_hash`.
- `family_id` связывает цепочку ротаций. Повторное использование старого refresh
  отзывает все активные токены family, а не только текущий.
- Access-токен содержит `sub` (user id) и `sid` (family_id). Кроме подписи,
  guard проверяет, что family ещё активна в БД, поэтому logout и смена пароля
  действуют сразу, не дожидаясь истечения access-токена.
- Cookie `Secure` включается только в `NODE_ENV=production`.
- `logout` отзывает всю family, даже если предъявлен уже ротированный refresh-токен
  или только access-токен.
- `change-password`, `reset-password` и `DELETE /me/sessions` сериализуются с refresh
  через `SELECT ... FOR UPDATE` по строке пользователя: гонка «refresh vs выход на всех»
  не оставляет живую сессию.

Одновременные refresh-запросы с одним cookie считаются повторным использованием
и завершают сессию. Клиент должен сериализовать обновление токена.

## Пароли

- argon2id, параметры по OWASP: 19 МиБ памяти, 2 итерации, 1 поток (настраиваются env).
- Минимум 10 символов, максимум 128.
- Локальный список 10 000 распространённых паролей (SecLists), плюс запрет email/имени внутри пароля.
- Единый ответ на неверный пароль и несуществующий email; для несуществующего
  пользователя выполняется фиктивный argon2-verify, чтобы выровнять время ответа.
- После третьей неудачи включается прогрессивная задержка до 3 секунд; жёсткой
  блокировки аккаунта нет.

## Rate limit

Счётчики в памяти процесса (один инстанс API). Жёсткий `429` с `Retry-After`
отдаётся только по IP. Лимит по email не блокирует вход: после исчерпания он
добавляет максимальную прогрессивную задержку к неудачным попыткам, а верный
пароль по-прежнему пускает. Для регистрации, сброса и переотправки письма
email-лимит мягкий и ключуется парой email+IP: при превышении ответ всё равно
`202`, но письмо не уходит. Новый аккаунт при исчерпанном лимите не создаётся.

## Подтверждение email и сброс пароля

- Токены одноразовые, в `auth_tokens` хранится только SHA-256; verify email живёт
  24 часа, reset password — 1 час.
- При `REQUIRE_EMAIL_VERIFICATION=true` вход без подтверждения возвращает
  `403 email_not_verified` (после верного пароля). Переотправить письмо можно
  публичным `POST /auth/resend-verification { email }`; ответ всегда одинаковый.
- Подтверждение email принимает `{ token, password }` и **задаёт пароль**:
  ссылка из письма не активирует аккаунт с паролем того, кто зарегистрировал
  чужой email. Это закрывает pre-hijack: владелец ящика выбирает свой пароль.
- При `REQUIRE_EMAIL_VERIFICATION=false` (только demo/dev; в production запрещён)
  регистрация сразу ставит `email_verified_at`, письмо не отправляется.
- Письма отправляются через `platform/mailer`; в dev/staging — Mailpit.
- Повторная регистрация существующего email отвечает тем же `202`, но шлёт
  письмо «аккаунт уже существует» без токена.
- После сброса и смены пароля все сессии отзываются; успешный сброс подтверждает
  email, потому что ссылка пришла на этот ящик.
- Смена пароля гасит ранее выданные reset-токены.
- Письмо уходит в фоне с бюджетом 200 мс, а ответ не быстрее 250 мс в обеих
  ветках — существование email не определяется по времени.

## Таблицы

`refresh_tokens`, `auth_tokens` — владелец модуль `auth`. `users` — владелец
модуль `users`, доступ только через `modules/users/index.ts`.

## События

- `user.registered` — после успешного коммита регистрации. Публикуется через
  `platform/events`; сейчас подписчиков нет, событие оставлено для notifications.

## Как тестировать

```bash
pnpm --filter @staynest/api test
```

Интеграционные тесты требуют `DATABASE_URL_TEST` (суффикс `_test`), сбрасывают
схему и накатывают миграции. Без переменной блок пропускается; в CI переменная
обязательна.

Ручная проверка (Mailpit: http://localhost:8025):

```bash
curl.exe -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.ru","password":"Forest-Lake-2026","displayName":"Демо"}' \
  http://localhost:3100/api/v1/auth/register

# открыть письмо в Mailpit, скопировать token из ссылки и задать пароль
curl.exe -i -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","password":"Forest-Lake-2026"}' \
  http://localhost:3100/api/v1/auth/verify-email

curl.exe -i -c cookies.txt -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.ru","password":"Forest-Lake-2026"}' \
  http://localhost:3100/api/v1/auth/login

curl.exe -i -b cookies.txt http://localhost:3100/api/v1/me
curl.exe -i -b cookies.txt -c cookies.txt -X POST http://localhost:3100/api/v1/auth/refresh
curl.exe -i -b cookies.txt http://localhost:3100/api/v1/me/sessions
curl.exe -i -b cookies.txt -c cookies.txt -X POST http://localhost:3100/api/v1/auth/logout
```

В PowerShell используйте `curl.exe`, а не алиас `curl`. Файл `cookies.txt` не
коммитить: в нём refresh-токен.
